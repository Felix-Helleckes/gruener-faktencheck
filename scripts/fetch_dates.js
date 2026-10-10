#!/usr/bin/env node
/**
 * Liest das Veröffentlichungsdatum jedes Archiv-Artikels aus der Quelle aus.
 *
 *   node scripts/fetch_dates.js --out dates.json
 *   node scripts/fetch_dates.js --only-missing   # nur Einträge ohne date
 *
 * Die Daten werden NICHT geschätzt, sondern aus der jeweiligen Seite gelesen:
 * article:published_time, JSON-LD datePublished, itemprop, <time datetime>
 * oder – als letzte Möglichkeit – ein Datum im URL-Pfad.
 * Findet sich nichts Belastbares, bleibt der Eintrag leer. Lieber kein Datum
 * als ein falsches.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src', 'articles-enhanced.js');

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const TIMEOUT_MS = 25000;
const CONCURRENCY = 6;
const HOST_DELAY_MS = 1500;

function parseArgs(argv) {
  const args = { out: 'dates.json', onlyMissing: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--out') args.out = argv[++i];
    else if (argv[i] === '--only-missing') args.onlyMissing = true;
  }
  return args;
}

function loadArticles() {
  const src = fs.readFileSync(SRC, 'utf8');
  const transformed = src.replace(/^\s*export\s+const\s+articles\s*=\s*/m, 'const articles = ');
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(transformed + '\n;globalThis.__ARTICLES__ = articles;', sandbox, { timeout: 5000 });
  return sandbox.__ARTICLES__ || {};
}

const hostQueues = new Map();
function throttleHost(url) {
  let host;
  try { host = new URL(url).hostname; } catch { return Promise.resolve(null); }
  const previous = hostQueues.get(host) || Promise.resolve();
  let release;
  const slot = new Promise(resolve => { release = resolve; });
  hostQueues.set(host, previous.then(() => slot));
  return previous.then(() => ({ done: () => setTimeout(release, HOST_DELAY_MS) }));
}

/** Prüft, ob ein ISO-Datum für dieses Archiv plausibel ist. */
function plausible(iso) {
  const when = new Date(iso + 'T12:00:00Z');
  if (Number.isNaN(when.getTime())) return false;
  return when >= new Date('2000-01-01') && when <= new Date(Date.now() + 36e5 * 24);
}

/** Kalendertag in deutscher Ortszeit – en-CA liefert das Format YYYY-MM-DD. */
const BERLIN = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
});

/** Normalisiert auf YYYY-MM-DD und verwirft Unplausibles. */
function normalize(raw) {
  if (!raw) return null;
  const text = String(raw).trim();
  let y, m, d;

  // Zeitstempel mit Zeitzone zuerst: "2008-09-30T22:00:00Z" ist in deutscher
  // Ortszeit bereits der 01.10.2008. Ohne Umrechnung wäre das Datum um einen
  // Tag zu früh, sobald eine Quelle in UTC auszeichnet.
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(text) && /(Z|[+-]\d{2}:?\d{2})\s*$/.test(text)) {
    const dt = new Date(text.replace(' ', 'T'));
    if (!Number.isNaN(dt.getTime())) {
      const iso = BERLIN.format(dt);
      return plausible(iso) ? iso : null;
    }
  }

  let mt = text.match(/^(\d{4})-(\d{2})-(\d{2})/);                 // ISO 8601
  if (mt) { [, y, m, d] = mt; }

  if (!y) {                                                        // 08.10.2026
    mt = text.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/);
    if (mt) { d = mt[1]; m = mt[2]; y = mt[3]; }
  }

  if (!y) {                                                        // 2026/10/08
    mt = text.match(/\b(\d{4})\/(\d{1,2})\/(\d{1,2})\b/);
    if (mt) { [, y, m, d] = mt; }
  }

  if (!y) return null;

  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  // Vor 2000 oder in der Zukunft ist für dieses Archiv nicht plausibel.
  return plausible(iso) ? iso : null;
}

const META_PATTERNS = [
  /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']article:published_time["']/i,
  /<meta[^>]+itemprop=["']datePublished["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+name=["']date["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+name=["']DC\.date\.issued["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+name=["']pubdate["'][^>]+content=["']([^"']+)["']/i,
];

function extractDate(html, url) {
  for (const re of META_PATTERNS) {
    const m = html.match(re);
    const iso = m && normalize(m[1]);
    if (iso) return { date: iso, via: 'meta', raw: m[1] };
  }

  // JSON-LD: erstes datePublished gewinnt
  const ld = html.match(/"datePublished"\s*:\s*"([^"]+)"/i);
  if (ld) {
    const iso = normalize(ld[1]);
    if (iso) return { date: iso, via: 'json-ld', raw: ld[1] };
  }

  const t = html.match(/<time[^>]+datetime=["']([^"']+)["']/i);
  if (t) {
    const iso = normalize(t[1]);
    if (iso) return { date: iso, via: 'time-tag', raw: t[1] };
  }

  // Letzte Möglichkeit: vollständiges Datum im URL-Pfad (z. B. /2026/01/21/)
  const u = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
  if (u) {
    const iso = normalize(`${u[1]}-${u[2]}-${u[3]}`);
    if (iso) return { date: iso, via: 'url-pfad', raw: `${u[1]}-${u[2]}-${u[3]}` };
  }

  return { date: null, via: null, raw: null };
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
      },
    });
    if (!res.ok) return { html: null, status: res.status };
    return { html: await res.text(), status: res.status };
  } finally {
    clearTimeout(timer);
  }
}

async function runPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  }));
  return results;
}

async function main() {
  const args = parseArgs(process.argv);
  const articles = loadArticles();

  const entries = [];
  for (const [category, list] of Object.entries(articles)) {
    (list || []).forEach((a, index) => {
      if (!a || !a.url) return;
      if (args.onlyMissing && a.date) return;
      entries.push({ category, index, title: a.title || '', url: a.url });
    });
  }

  console.log(`[INFO] Lese Datum für ${entries.length} Artikel ...\n`);

  let done = 0;
  const results = await runPool(entries, CONCURRENCY, async (entry) => {
    const slot = await throttleHost(entry.url);
    try {
      let out = { ...entry, date: null, via: null, raw: null, note: null };
      try {
        const { html, status } = await fetchHtml(entry.url);
        if (!html) out.note = `HTTP ${status}`;
        else Object.assign(out, extractDate(html, entry.url));
      } catch (err) {
        out.note = err.name === 'AbortError' ? 'Timeout' : (err.cause?.code || err.message);
      }
      // Auch wenn die Seite nicht abrufbar war (Bot-Wall, Paywall, 404):
      // Ein vollständiges Datum im URL-Pfad ist eine belastbare Angabe.
      if (!out.date) {
        const u = entry.url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
        const iso = u && normalize(`${u[1]}-${u[2]}-${u[3]}`);
        if (iso) Object.assign(out, { date: iso, via: 'url-pfad', raw: iso });
      }
      done++;
      if (done % 25 === 0) console.log(`[INFO] ${done}/${entries.length} ...`);
      return out;
    } finally {
      if (slot && slot.done) slot.done();
    }
  });

  const found = results.filter(r => r.date);
  const missing = results.filter(r => !r.date);

  const line = '='.repeat(64);
  console.log(`\n${line}`);
  console.log(`  Gelesen:      ${results.length}`);
  console.log(`  Datum da:     ${found.length}`);
  console.log(`  Kein Datum:   ${missing.length}`);
  console.log(line);

  const byVia = {};
  found.forEach(r => { byVia[r.via] = (byVia[r.via] || 0) + 1; });
  console.log('\nQuelle des Datums:');
  Object.entries(byVia).sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log(`  ${String(k).padEnd(10)} ${v}`));

  if (missing.length) {
    console.log('\nOhne Datum (bleiben leer):');
    missing.forEach(r => console.log(`  [${r.note || 'nicht gefunden'}] ${r.category}: ${r.title.slice(0, 64)}\n        ${r.url}`));
  }

  fs.writeFileSync(args.out, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\n[OK] Ergebnis geschrieben: ${args.out}`);
}

if (require.main === module) {
  main().catch(err => { console.error('[ERROR]', err); process.exit(2); });
}

module.exports = { normalize, extractDate };
