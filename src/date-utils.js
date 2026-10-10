// Datumshilfen für das Archiv.
// Gespeichert wird im Artikelbestand immer ISO (YYYY-MM-DD): sortierbar,
// maschinenlesbar und direkt für schema.org verwendbar. Angezeigt wird die
// im Deutschen übliche Schreibweise.

const MONATE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

/** "2026-10-08" -> "08.10.2026". Gibt bei ungültiger Eingabe "" zurück. */
export function formatDate(iso) {
  if (!iso) return "";
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(iso);
  const [, y, mo, d] = m;
  return `${d}.${mo}.${y}`;
}

/** "2026-10-08" -> "Oktober 2026" */
export function formatMonth(iso) {
  if (!iso) return "";
  const m = String(iso).match(/^(\d{4})-(\d{2})/);
  if (!m) return "";
  const monat = MONATE[parseInt(m[2], 10) - 1];
  return monat ? `${monat} ${m[1]}` : m[1];
}

/** "2026-10-08" -> "2026" */
export function getYear(iso) {
  const m = String(iso || "").match(/^(\d{4})/);
  return m ? m[1] : null;
}

/** Sortierschlüssel: Artikel ohne Datum landen hinten. */
export function sortByDateDesc(a, b) {
  const da = a.date || "";
  const db = b.date || "";
  if (da && db) return db.localeCompare(da);
  if (da) return -1;
  if (db) return 1;
  return 0;
}
