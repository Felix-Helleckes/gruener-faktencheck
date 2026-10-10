#!/usr/bin/env node
/**
 * Trägt die von scripts/fetch_dates.js ermittelten Daten in
 * src/articles-enhanced.js ein.
 *
 *   node scripts/fetch_dates.js --out dates.json
 *   node scripts/apply_dates.js dates.json           # Vorschau
 *   node scripts/apply_dates.js dates.json --write   # schreiben
 *
 * Arbeitet zeilenweise auf der Quelldatei, damit Formatierung, Reihenfolge und
 * Kommentare unverändert bleiben. Vorhandene date-Felder werden nicht
 * überschrieben, es sei denn, --overwrite ist gesetzt.
 */

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src', 'articles-enhanced.js');

function parseArgs(argv) {
  const args = { input: null, write: false, overwrite: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--write') args.write = true;
    else if (argv[i] === '--overwrite') args.overwrite = true;
    else if (!args.input) args.input = argv[i];
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.input) {
    console.error('Aufruf: node scripts/apply_dates.js <dates.json> [--write] [--overwrite]');
    process.exit(1);
  }

  const records = JSON.parse(fs.readFileSync(args.input, 'utf8'));
  const dateByUrl = new Map();
  records.forEach(r => { if (r && r.url && r.date) dateByUrl.set(r.url, r.date); });
  console.log(`[INFO] ${dateByUrl.size} Datumsangaben eingelesen.`);

  // Manuelle Korrekturen haben Vorrang: date=null entfernt ein Datum bewusst.
  const overridePath = path.join(__dirname, 'date-overrides.json');
  const forcedEmpty = new Set();
  if (fs.existsSync(overridePath)) {
    const overrides = JSON.parse(fs.readFileSync(overridePath, 'utf8'));
    let n = 0;
    for (const [url, entry] of Object.entries(overrides)) {
      if (url.startsWith('_') || !entry || typeof entry !== 'object') continue;
      if (entry.date) dateByUrl.set(url, entry.date);
      else { dateByUrl.delete(url); forcedEmpty.add(url); }
      n++;
    }
    console.log(`[INFO] ${n} manuelle Korrekturen angewendet (scripts/date-overrides.json).`);
  }

  const lines = fs.readFileSync(SRC, 'utf8').split('\n');
  const out = [];

  let pendingUrl = null;       // URL des Eintrags, in dem wir gerade stehen
  let entryHasDate = false;
  let added = 0, skippedExisting = 0, skippedNoDate = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const urlMatch = line.match(/^\s*"url":\s*"([^"]+)"\s*,?\s*$/);
    if (urlMatch) {
      pendingUrl = urlMatch[1];
      entryHasDate = false;
    }

    if (/^\s*"date":\s*"/.test(line)) entryHasDate = true;

    // Ende eines Eintrags: hier wird das date-Feld eingefügt
    const isEntryEnd = /^\s*\},?\s*$/.test(line);
    if (isEntryEnd && pendingUrl) {
      const date = dateByUrl.get(pendingUrl);
      if (!date) {
        skippedNoDate++;
      } else if (entryHasDate && !args.overwrite) {
        skippedExisting++;
      } else if (entryHasDate && args.overwrite) {
        // vorhandene Zeile im bereits geschriebenen Puffer ersetzen
        for (let j = out.length - 1; j >= 0; j--) {
          if (/^\s*"date":\s*"/.test(out[j])) { out[j] = `      "date": "${date}",`; added++; break; }
          if (/^\s*\{\s*$/.test(out[j])) break;
        }
      } else {
        out.push(`      "date": "${date}",`);
        added++;
      }
      pendingUrl = null;
      entryHasDate = false;
    }

    out.push(line);
  }

  console.log(`[INFO] Eingetragen:        ${added}`);
  console.log(`[INFO] Schon vorhanden:    ${skippedExisting}`);
  console.log(`[INFO] Kein Datum bekannt: ${skippedNoDate}`);

  if (!args.write) {
    console.log('\n[INFO] Vorschau – nichts geschrieben. Mit --write ausführen.');
    return;
  }

  fs.writeFileSync(SRC, out.join('\n'), 'utf8');
  console.log(`\n[OK] ${SRC} aktualisiert.`);
}

if (require.main === module) main();
