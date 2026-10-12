#!/usr/bin/env node
/**
 * Gibt den Artikelbestand als JSON auf stdout aus – inklusive Slug,
 * Kategorie-Slug, Datum und Quell-Domain.
 *
 * Für die Python-Skripte (Sitemap, OG-Bilder), damit sie dieselben Slugs
 * verwenden wie React, statt die Logik in Python nachzubauen.
 *
 *   node scripts/articles_json.js
 */

const { flatArticles } = require('./lib/articles');

process.stdout.write(JSON.stringify(flatArticles()));
