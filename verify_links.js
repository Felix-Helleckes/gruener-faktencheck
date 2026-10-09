#!/usr/bin/env node
/**
 * Struktur-Check für src/articles-enhanced.js.
 *
 * Prüft die Datenqualität des Archivs, ohne das Netz anzufassen:
 *   - Pflichtfelder (title, url) vorhanden und nicht leer
 *   - URLs syntaktisch gültig und http(s)
 *   - keine doppelten URLs (auch kategorieübergreifend)
 *   - keine leeren Beschreibungen
 *   - Beschreibung ist nicht bloß eine Kopie des Titels
 *
 * Aufruf:  node verify_links.js
 * Exit-Code 1, wenn Fehler gefunden wurden (Warnungen allein sind okay).
 *
 * Für die Erreichbarkeit der Links siehe scripts/check_links.js
 * (wird wöchentlich von .github/workflows/link-check.yml ausgeführt).
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, 'src', 'articles-enhanced.js');

function loadArticles() {
  const src = fs.readFileSync(SRC, 'utf8');
  const transformed = src.replace(/^\s*export\s+const\s+articles\s*=\s*/m, 'const articles = ');
  const sandbox = {};
  vm.createContext(sandbox);
  try {
    vm.runInContext(transformed + '\n;globalThis.__ARTICLES__ = articles;', sandbox, { timeout: 5000 });
    return sandbox.__ARTICLES__ || {};
  } catch (err) {
    console.error('❌ PARSE-FEHLER in src/articles-enhanced.js:');
    console.error('   ' + (err && err.message ? err.message : err));
    process.exit(2);
  }
}

const errors = [];
const warnings = [];
const articles = loadArticles();
const seenUrls = new Map();

let total = 0;

for (const [category, list] of Object.entries(articles)) {
  const entries = Array.isArray(list) ? list : [];
  console.log(`\n📋 Kategorie: ${category}`);
  console.log(`   ${entries.length} Artikel`);

  entries.forEach((article, index) => {
    total++;
    const where = `${category}[${index}]`;
    const title = (article && article.title) || '';
    const url = (article && article.url) || '';
    const description = (article && article.description) || '';

    if (!title.trim()) errors.push(`❌ ${where}: title fehlt oder ist leer`);
    if (!url.trim()) {
      errors.push(`❌ ${where}: url fehlt oder ist leer (${title.slice(0, 60)})`);
      return;
    }

    let parsed = null;
    try {
      parsed = new URL(url);
    } catch {
      errors.push(`❌ ${where}: ungültige URL -> ${url}`);
      return;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      errors.push(`❌ ${where}: URL ist kein http(s) -> ${url}`);
    }

    if (seenUrls.has(url)) {
      errors.push(`❌ ${where}: doppelte URL, schon in ${seenUrls.get(url)} -> ${url}`);
    } else {
      seenUrls.set(url, where);
    }

    if (!description.trim()) {
      warnings.push(`⚠️  ${where}: leere description (${title.slice(0, 60)})`);
    } else if (description.trim() === title.trim()) {
      warnings.push(`⚠️  ${where}: description ist identisch mit dem Titel (${title.slice(0, 60)})`);
    }
  });
}

const line = '='.repeat(60);
console.log(`\n${line}`);
console.log('✅ VERIFIKATIONSERGEBNIS:');
console.log(`   Artikel geprüft:  ${total}`);
console.log(`   Eindeutige URLs:  ${seenUrls.size}`);
console.log(`   Fehler:           ${errors.length}`);
console.log(`   Warnungen:        ${warnings.length}`);
console.log(line);

if (warnings.length) {
  console.log(`\n⚠️  WARNUNGEN (${warnings.length}):`);
  warnings.forEach(w => console.log(`   ${w}`));
}

if (errors.length) {
  console.log(`\n❌ FEHLER (${errors.length}):`);
  errors.forEach(e => console.log(`   ${e}`));
  console.log('');
  process.exit(1);
}

console.log('\n✅ Keine Fehler gefunden – die Artikeldaten sind sauber.\n');
process.exit(0);
