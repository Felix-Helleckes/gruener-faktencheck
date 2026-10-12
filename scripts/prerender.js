#!/usr/bin/env node
/**
 * Prerendering der Meta-Tags – läuft nach "vite build".
 *
 * Problem: Die Website ist eine Single Page App. WhatsApp, X, Facebook und
 * LinkedIn führen kein JavaScript aus und sehen deshalb für JEDE Adresse nur
 * das statische index.html – gleicher Titel, gleiches Bild, und og:url zeigt
 * auf die Startseite. Wer die Chronik teilt, teilt dort faktisch die Startseite.
 *
 * Lösung: Für jede wichtige Seite wird eine Kopie von dist/index.html mit
 * eigenen Meta-Tags erzeugt und unter dist/_prerender/ abgelegt. In
 * dist/_redirects kommt pro Seite eine 200-Rewrite-Regel dazu, z. B.
 *     /chronik   /_prerender/chronik.html   200
 * Das ist derselbe Mechanismus wie der SPA-Catch-all; die Adresse bleibt
 * unverändert. Bewusst NICHT als dist/chronik.html: Mit Netlifys "Pretty URLs"
 * würde /chronik dann per 301 auf /chronik/ umgeleitet, während Canonical,
 * Sitemap und Links /chronik nennen.
 *
 * React startet auf diesen Seiten ganz normal; die App ist identisch.
 *
 * Der Lauf bricht ab, wenn eine erwartete Stelle im Template fehlt. Ein
 * fehlgeschlagener Build lässt die letzte gute Version online – besser als
 * stillschweigend falsche Vorschauen.
 */

const fs = require('fs');
const path = require('path');
const { flatArticles, ROOT } = require('./lib/articles');

const DIST = path.join(ROOT, 'dist');
const OUT = path.join(DIST, '_prerender');

const SITE = 'https://grüner-faktencheck.de';
// Bild-URLs in Punycode: Crawler holen sie direkt ab
const IMG_BASE = 'https://xn--grner-faktencheck-32b.de';
const OG_DEFAULT = `${IMG_BASE}/og-image.jpg`;
const OG_CHRONIK = `${IMG_BASE}/og-chronik.jpg`;
const MARKER = '# @@PRERENDER_RULES@@';

const CATEGORIES = { Wirtschaft: 'wirtschaft', Innenpolitik: 'innenpolitik', 'Außenpolitik': 'aussenpolitik' };

// --- Hilfsfunktionen -------------------------------------------------------

function esc(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Wie in src/ArticlePage.jsx – damit Titel identisch ausfallen. */
function truncate(text, max) {
  if (!text || text.length <= max) return text || '';
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${cut.slice(0, space > max * 0.6 ? space : max).trim()} …`;
}

function formatDate(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
}

/** JSON sicher in <script> einbetten */
function jsonLd(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

/**
 * Ersetzt genau eine Fundstelle. Findet das Muster nichts oder mehr als
 * eine Stelle, bricht der Build ab – das Template hat sich dann geändert.
 */
function replaceOnce(html, pattern, replacement, label) {
  const matches = html.match(new RegExp(pattern.source, pattern.flags.replace('g', '') + 'g'));
  const count = matches ? matches.length : 0;
  if (count !== 1) {
    throw new Error(`Prerender: "${label}" ${count}x im Template gefunden, erwartet genau 1x.`);
  }
  return html.replace(pattern, replacement);
}

// --- Seite aus dem Template bauen ------------------------------------------

function renderPage(template, page) {
  let html = template;
  const r = (pattern, value, label) => {
    html = replaceOnce(html, pattern, value, label);
  };

  r(/<title>[\s\S]*?<\/title>/, `<title>${esc(page.title)}</title>`, 'title');
  r(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(page.description)}">`, 'description');

  r(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(page.ogTitle)}">`, 'og:title');
  r(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(page.ogDescription)}">`, 'og:description');
  r(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${esc(page.url)}">`, 'og:url');
  r(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${esc(page.image)}">`, 'og:image');
  r(/<meta property="og:image:alt" content="[^"]*">/, `<meta property="og:image:alt" content="${esc(page.imageAlt)}">`, 'og:image:alt');

  // og:type + Artikel-Metadaten
  const typeTags = [`<meta property="og:type" content="${esc(page.ogType)}">`];
  if (page.publishedTime) typeTags.push(`<meta property="article:published_time" content="${esc(page.publishedTime)}">`);
  if (page.section) typeTags.push(`<meta property="article:section" content="${esc(page.section)}">`);
  r(/<meta property="og:type" content="[^"]*">/, typeTags.join('\n    '), 'og:type');

  r(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${esc(page.ogTitle)}">`, 'twitter:title');
  r(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${esc(page.ogDescription)}">`, 'twitter:description');
  r(/<meta name="twitter:image" content="[^"]*">/, `<meta name="twitter:image" content="${esc(page.image)}">`, 'twitter:image');
  r(/<meta name="twitter:image:alt" content="[^"]*">/, `<meta name="twitter:image:alt" content="${esc(page.imageAlt)}">`, 'twitter:image:alt');

  r(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${esc(page.url)}">`, 'canonical');
  // hreflang: auf der Unterseite selbstreferenzierend statt auf die Startseite
  html = html.replace(/(<link rel="alternate" hreflang="[^"]+" href=")[^"]*(">)/g, `$1${esc(page.url)}$2`);

  r(
    /<script type="application\/ld\+json" id="page-jsonld">[\s\S]*?<\/script>/,
    `<script type="application/ld+json" id="page-jsonld">${jsonLd(page.jsonLd)}</script>`,
    'page-jsonld'
  );

  // Inhalt für Crawler ohne JavaScript; für Besucher unsichtbar
  if (page.noscript) {
    r(/<div id="root"><\/div>/, `<div id="root"></div>\n    <noscript>${page.noscript}</noscript>`, 'root');
  }

  return html;
}

function linkList(items) {
  return `<ul>${items
    .map((a) => `<li><a href="/artikel/${esc(a.slug)}">${esc(a.title)}</a>${a.date ? ` (${formatDate(a.date)})` : ''}</li>`)
    .join('')}</ul>`;
}

const byDateDesc = (a, b) => {
  if (a.date && b.date) return b.date.localeCompare(a.date);
  if (a.date) return -1;
  if (b.date) return 1;
  return 0;
};

// --- Seitendefinitionen ----------------------------------------------------

function pages(articles) {
  const sorted = [...articles].sort(byDateDesc);
  const isPartOf = { '@type': 'WebSite', name: 'Grüner Faktencheck', url: `${SITE}/` };
  const list = [];

  // Chronik
  const years = {};
  articles.forEach((a) => { if (a.date) years[a.date.slice(0, 4)] = (years[a.date.slice(0, 4)] || 0) + 1; });
  const latest = Object.keys(years).sort().pop();
  const chronikDesc = latest
    ? `${years[latest]} dokumentierte Berichte im Jahr ${latest} – alle ${articles.length} Einträge chronologisch, mit Quelle und Datum.`
    : `Alle ${articles.length} dokumentierten Berichte chronologisch, mit Quelle und Datum.`;
  list.push({
    route: '/chronik',
    file: 'chronik.html',
    url: `${SITE}/chronik`,
    title: 'Chronik – Grüner Faktencheck | Alle Berichte nach Jahr',
    description: `Chronik des Grünen Faktenchecks: ${chronikDesc}`,
    ogTitle: 'Chronik – Grüner Faktencheck',
    ogDescription: chronikDesc,
    ogType: 'website',
    image: OG_CHRONIK,
    imageAlt: latest ? `${years[latest]} dokumentierte Berichte im Jahr ${latest} – Chronik des Grünen Faktenchecks` : 'Chronik des Grünen Faktenchecks',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Chronik – Grüner Faktencheck',
      url: `${SITE}/chronik`,
      description: chronikDesc,
      inLanguage: 'de',
      isPartOf,
      mainEntity: { '@type': 'ItemList', numberOfItems: articles.length },
    },
    noscript: `<h1>Chronik</h1><p>${esc(chronikDesc)}</p>${linkList(sorted)}`,
  });

  // Kategorien
  for (const [category, slug] of Object.entries(CATEGORIES)) {
    const items = sorted.filter((a) => a.category === category);
    const url = `${SITE}/category/${slug}`;
    list.push({
      route: `/category/${slug}`,
      file: `category/${slug}.html`,
      url,
      title: `Grüner Faktencheck - ${category} | Kritische Analyse der Grünen`,
      description: `${category}-Artikel zum Grüner Faktencheck: Unabhängige Analyse und Faktenchecks zur Grünen Partei mit Quellen und kritischer Bewertung.`,
      ogTitle: `Grüner Faktencheck - ${category}`,
      ogDescription: `${items.length} Berichte zu ${category}: Unabhängige Faktenchecks zur Grünen Partei Deutschland`,
      ogType: 'website',
      image: OG_DEFAULT,
      imageAlt: `Grüner Faktencheck – ${category}`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: `Grüner Faktencheck - ${category}`,
        url,
        inLanguage: 'de',
        isPartOf,
        mainEntity: { '@type': 'ItemList', numberOfItems: items.length },
      },
      noscript: `<h1>${esc(category)}</h1>${linkList(items)}`,
    });
  }

  // Artikel
  for (const a of articles) {
    const url = `${SITE}/artikel/${a.slug}`;
    const description = truncate(a.description || a.title, 200);
    list.push({
      route: `/artikel/${a.slug}`,
      file: `artikel/${a.slug}.html`,
      url,
      title: `${truncate(a.title, 60)} | Grüner Faktencheck`,
      description,
      ogTitle: a.title,
      ogDescription: description,
      ogType: 'article',
      publishedTime: a.date,
      section: a.category,
      image: OG_DEFAULT,
      imageAlt: `Grüner Faktencheck – ${a.category}`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: a.title,
        url,
        inLanguage: 'de',
        description,
        isPartOf,
        breadcrumb: {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Startseite', item: `${SITE}/` },
            { '@type': 'ListItem', position: 2, name: a.category, item: `${SITE}/category/${a.categorySlug}` },
            { '@type': 'ListItem', position: 3, name: a.title, item: url },
          ],
        },
        // Der verlinkte Beitrag stammt von der Quelle, nicht von uns
        mainEntity: {
          '@type': 'NewsArticle',
          headline: a.title,
          url: a.url,
          ...(a.date ? { datePublished: a.date } : {}),
          publisher: { '@type': 'Organization', name: a.domain },
        },
      },
      noscript:
        `<h1>${esc(a.title)}</h1>` +
        `<p>${[formatDate(a.date), esc(a.category), esc(a.domain)].filter(Boolean).join(' · ')}</p>` +
        (a.description ? `<p>${esc(a.description)}</p>` : '') +
        `<p><a href="${esc(a.url)}">Weiterlesen auf ${esc(a.domain)}</a></p>` +
        `<p><a href="/chronik">Alle Berichte in der Chronik</a></p>`,
    });
  }

  return list;
}

// --- Ablauf ----------------------------------------------------------------

function main() {
  const templatePath = path.join(DIST, 'index.html');
  const redirectsPath = path.join(DIST, '_redirects');
  if (!fs.existsSync(templatePath)) throw new Error('dist/index.html fehlt – erst "vite build" ausführen.');
  if (!fs.existsSync(redirectsPath)) throw new Error('dist/_redirects fehlt.');

  const template = fs.readFileSync(templatePath, 'utf8');
  const articles = flatArticles();
  const all = pages(articles);

  fs.rmSync(OUT, { recursive: true, force: true });
  for (const page of all) {
    const target = path.join(OUT, page.file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, renderPage(template, page), 'utf8');
  }

  // Rewrite-Regeln vor den SPA-Catch-all setzen
  const redirects = fs.readFileSync(redirectsPath, 'utf8');
  if (!redirects.includes(MARKER)) {
    throw new Error(`Prerender: Platzhalter "${MARKER}" fehlt in public/_redirects.`);
  }
  const width = Math.max(...all.map((p) => p.route.length)) + 2;
  const rules = all.map((p) => `${p.route.padEnd(width)}/_prerender/${p.file}   200`).join('\n');
  fs.writeFileSync(
    redirectsPath,
    redirects.replace(MARKER, `# Automatisch erzeugt von scripts/prerender.js (${all.length} Seiten)\n${rules}`),
    'utf8'
  );

  const n = (prefix) => all.filter((p) => p.route.startsWith(prefix)).length;
  console.log(`[OK] Prerendering: ${all.length} Seiten – Chronik ${n('/chronik')}, Kategorien ${n('/category/')}, Artikel ${n('/artikel/')}`);
  console.log(`[OK] ${all.length} Rewrite-Regeln in dist/_redirects eingetragen`);
}

try {
  main();
} catch (err) {
  console.error(`[FEHLER] ${err.message}`);
  process.exit(1);
}
