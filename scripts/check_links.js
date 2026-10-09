#!/usr/bin/env node
/**
 * Link-Checker für das Archiv.
 *
 * Prüft jede URL aus src/articles-enhanced.js und meldet tote Links.
 *
 *   node scripts/check_links.js                 # Report auf der Konsole
 *   node scripts/check_links.js --json out.json # Ergebnis zusätzlich als JSON
 *   node scripts/check_links.js --concurrency 4 # Parallelität drosseln
 *
 * Exit-Code 1, wenn defekte Links gefunden wurden (404, 410, DNS-Fehler, Timeout).
 * "Verdächtige" Links (403/429 – meist Bot-Wall oder Paywall) führen NICHT zum
 * Fehlschlag, weil Verlage Server-Requests oft grundsätzlich blocken.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src', 'articles-enhanced.js');

// Manche Verlage blocken alles, was nicht nach Browser aussieht.
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const TIMEOUT_MS = 20000;
const DEFAULT_CONCURRENCY = 6;
// Mindestabstand zwischen zwei Requests an denselben Host – sonst antworten
// Archivdienste und kleinere Seiten mit 429 (Too Many Requests).
const HOST_DELAY_MS = 1500;

// 403/406/429/451 heißt in der Praxis fast immer Bot-Wall oder Paywall,
// nicht "Link tot".
const SUSPECT_STATUS = new Set([401, 403, 406, 429, 451]);

function parseArgs(argv) {
  const args = { json: null, markdown: null, concurrency: DEFAULT_CONCURRENCY };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--json') args.json = argv[++i];
    else if (argv[i] === '--markdown') args.markdown = argv[++i];
    else if (argv[i] === '--concurrency') args.concurrency = parseInt(argv[++i], 10) || DEFAULT_CONCURRENCY;
  }
  return args;
}

function toMarkdown(broken, suspect, total) {
  const out = [];
  out.push(`Automatischer Link-Check vom ${new Date().toISOString().slice(0, 10)} – ${total} Links geprüft.`);
  out.push('');
  if (broken.length) {
    out.push(`## ❌ Defekte Links (${broken.length})`);
    out.push('');
    out.push('| Kategorie | Status | Artikel |');
    out.push('| --- | --- | --- |');
    broken.forEach(r => {
      const reason = r.status !== null ? `HTTP ${r.status}` : (r.error || 'Fehler');
      const title = (r.title || '(ohne Titel)').replace(/\|/g, '\\|');
      out.push(`| ${r.category} | ${reason} | [${title}](${r.url}) |`);
    });
    out.push('');
  }
  if (suspect.length) {
    out.push(`## ⚠️ Verdächtig (${suspect.length})`);
    out.push('');
    out.push('Meist Bot-Wall oder Paywall – im Browser gegenprüfen, bevor etwas entfernt wird.');
    out.push('');
    out.push('| Kategorie | Status | Artikel |');
    out.push('| --- | --- | --- |');
    suspect.forEach(r => {
      const title = (r.title || '(ohne Titel)').replace(/\|/g, '\\|');
      out.push(`| ${r.category} | HTTP ${r.status} | [${title}](${r.url}) |`);
    });
    out.push('');
  }
  out.push('---');
  out.push('Als Ersatz für tote Links eignet sich ein Snapshot auf `archive.ph` / `web.archive.org`.');
  out.push('Lokal nachprüfen: `node scripts/check_links.js`');
  return out.join('\n');
}

function loadArticles() {
  const src = fs.readFileSync(SRC, 'utf8');
  const transformed = src.replace(/^\s*export\s+const\s+articles\s*=\s*/m, 'const articles = ');
  const sandbox = {};
  vm.createContext(sandbox);
  try {
    vm.runInContext(transformed + '\n;globalThis.__ARTICLES__ = articles;', sandbox, { timeout: 5000 });
    return sandbox.__ARTICLES__ || {};
  } catch (err) {
    console.error('PARSE_ERROR:', err && err.message ? err.message : err);
    process.exit(2);
  }
}

// Pro Host wird serialisiert und ein Mindestabstand eingehalten.
const hostQueues = new Map();

function throttleHost(url) {
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    return Promise.resolve();
  }
  const previous = hostQueues.get(host) || Promise.resolve();
  let release;
  const slot = new Promise(resolve => { release = resolve; });
  hostQueues.set(host, previous.then(() => slot));
  return previous.then(() => ({
    done: () => setTimeout(release, HOST_DELAY_MS),
  }));
}

async function request(url, method) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
      },
    });
    return { status: res.status };
  } finally {
    clearTimeout(timer);
  }
}

async function checkUrl(url) {
  const slot = await throttleHost(url);
  try {
    // HEAD ist billiger, wird aber nicht überall sauber unterstützt.
    const attempts = ['HEAD', 'GET', 'GET'];
    let last = null;

    for (let i = 0; i < attempts.length; i++) {
      try {
        const res = await request(url, attempts[i]);
        last = { status: res.status, error: null };
        if (res.status >= 200 && res.status < 300) return { state: 'ok', ...last };
        // HEAD abgelehnt, Rate-Limit oder Server-Fehler -> nochmal mit GET versuchen
        if (res.status >= 500 || res.status === 405 || res.status === 403 || res.status === 429) continue;
        break;
      } catch (err) {
        last = { status: null, error: err.name === 'AbortError' ? 'Timeout' : (err.cause?.code || err.message) };
        // Netzwerkfehler einmal wiederholen
      }
    }

    if (last && last.status !== null && SUSPECT_STATUS.has(last.status)) {
      return { state: 'suspect', ...last };
    }
    return { state: 'broken', ...(last || { status: null, error: 'unbekannt' }) };
  } finally {
    if (slot && slot.done) slot.done();
  }
}

async function runPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

async function main() {
  const args = parseArgs(process.argv);
  const articles = loadArticles();

  const entries = [];
  for (const [category, list] of Object.entries(articles)) {
    (list || []).forEach((a, index) => {
      if (a && a.url) entries.push({ category, index, title: a.title || '', url: a.url });
    });
  }

  console.log(`[INFO] Prüfe ${entries.length} Links (Parallelität: ${args.concurrency}) ...\n`);

  let done = 0;
  const checked = await runPool(entries, args.concurrency, async (entry) => {
    const result = await checkUrl(entry.url);
    done++;
    if (done % 25 === 0) console.log(`[INFO] ${done}/${entries.length} geprüft ...`);
    return { ...entry, ...result };
  });

  const broken = checked.filter(r => r.state === 'broken');
  const suspect = checked.filter(r => r.state === 'suspect');
  const ok = checked.filter(r => r.state === 'ok');

  const line = '='.repeat(64);
  console.log(`\n${line}`);
  console.log('LINK-CHECK ERGEBNIS');
  console.log(line);
  console.log(`  Geprüft:    ${checked.length}`);
  console.log(`  OK:         ${ok.length}`);
  console.log(`  Verdächtig: ${suspect.length}  (403/429 – meist Bot-Wall oder Paywall)`);
  console.log(`  Defekt:     ${broken.length}`);
  console.log(`${line}\n`);

  if (suspect.length) {
    console.log('VERDÄCHTIG (bitte manuell im Browser prüfen):');
    suspect.forEach(r => console.log(`  [${r.status}] ${r.category}: ${r.title}\n        ${r.url}`));
    console.log('');
  }

  if (broken.length) {
    console.log('DEFEKT:');
    broken.forEach(r => {
      const reason = r.status !== null ? `HTTP ${r.status}` : r.error;
      console.log(`  [${reason}] ${r.category}: ${r.title}\n        ${r.url}`);
    });
    console.log('');
  }

  if (args.json) {
    const payload = {
      checkedAt: new Date().toISOString(),
      total: checked.length,
      ok: ok.length,
      broken: broken.map(({ category, title, url, status, error }) => ({ category, title, url, status, error })),
      suspect: suspect.map(({ category, title, url, status }) => ({ category, title, url, status })),
    };
    fs.writeFileSync(args.json, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`[OK] JSON-Report geschrieben: ${args.json}`);
  }

  if (args.markdown) {
    fs.writeFileSync(args.markdown, toMarkdown(broken, suspect, checked.length), 'utf8');
    console.log(`[OK] Markdown-Report geschrieben: ${args.markdown}`);
  }

  if (broken.length) {
    console.error(`[FAIL] ${broken.length} defekte Links gefunden.`);
    process.exit(1);
  }
  console.log('[OK] Keine defekten Links.');
}

main().catch(err => {
  console.error('[ERROR]', err);
  process.exit(2);
});
