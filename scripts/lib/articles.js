/**
 * Gemeinsamer Zugriff auf den Artikelbestand für alle Build-Skripte.
 *
 * Lädt src/articles-enhanced.js, src/article-slug.js und src/category-seo.js
 * direkt aus dem Quellcode – dieselben Dateien, die React verwendet. So
 * stimmen Slugs in Sitemap, vorgerenderten Seiten und App immer überein.
 *
 * Die src-Dateien sind ES-Module ohne "type": "module" in package.json.
 * Statt auf Node-Eigenheiten beim Modul-Erkennen zu setzen, werden sie wie
 * in den übrigen Skripten per vm ausgewertet.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');

function loadModule(relPath, exportNames) {
  const src = fs
    .readFileSync(path.join(ROOT, relPath), 'utf8')
    .replace(/^export\s+(const|let|function)\s/gm, '$1 ');
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(
    `${src}\n;globalThis.__EXPORTS__ = { ${exportNames.join(', ')} };`,
    sandbox,
    { timeout: 5000, filename: relPath }
  );
  return sandbox.__EXPORTS__;
}

function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Alle Artikel als flache Liste, angereichert um Slug, Kategorie-Slug und
 * Quell-Domain. Reihenfolge wie in der Quelldatei.
 */
function flatArticles() {
  const { articles } = loadModule('src/articles-enhanced.js', ['articles']);
  const { buildSlugMap } = loadModule('src/article-slug.js', ['slugify', 'buildSlugMap']);
  const { categoryToSlug } = loadModule('src/category-seo.js', ['categoryToSlug']);

  const slugs = buildSlugMap(articles);
  const out = [];
  for (const [category, list] of Object.entries(articles)) {
    (list || []).forEach((a) => {
      if (!a || !a.url) return;
      out.push({
        category,
        categorySlug: categoryToSlug(category),
        title: a.title || '',
        description: a.description || '',
        url: a.url,
        date: a.date || null,
        slug: slugs.get(a.url),
        domain: getDomain(a.url),
      });
    });
  }
  return out;
}

module.exports = { flatArticles, getDomain, ROOT };
