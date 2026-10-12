// URL-Kürzel (Slugs) für die Artikelseiten unter /artikel/<slug>.
//
// Diese Datei ist die einzige Quelle für Slugs. React importiert sie direkt,
// die Build-Skripte (Sitemap, Prerendering, OG-Bilder) laden sie über
// scripts/lib/articles.js. Deshalb bewusst ohne Imports und nur mit
// "export function" / "const" auf oberster Ebene.

const UMLAUTE = { "ä": "ae", "ö": "oe", "ü": "ue", "Ä": "Ae", "Ö": "Oe", "Ü": "Ue", "ß": "ss" };

/** "Grünen-Chef „wehrt sich“" -> "gruenen-chef-wehrt-sich" */
export function slugify(text, maxLength = 80) {
  let s = String(text || "")
    .replace(/[äöüÄÖÜß]/g, (c) => UMLAUTE[c])
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " und ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  // Lange Titel an einer Wortgrenze kürzen, damit die URL lesbar bleibt
  if (s.length > maxLength) {
    s = s.slice(0, maxLength);
    const cut = s.lastIndexOf("-");
    if (cut > maxLength * 0.6) s = s.slice(0, cut);
    s = s.replace(/-+$/g, "");
  }
  return s || "artikel";
}

/** Kurzer, stabiler Hash (FNV-1a) – nur für den Fall gleicher Titel. */
function kurzHash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).padStart(6, "0").slice(-6);
}

/**
 * Liefert eine Map URL -> Slug für alle Artikel.
 *
 * Unabhängig von der Reihenfolge der Einträge: Teilen sich mehrere Artikel
 * denselben Titel-Slug, bekommen ALLE einen Hash ihrer Quell-URL angehängt.
 * So verschiebt ein neu oben eingefügter Artikel niemals die URL eines
 * bestehenden.
 */
export function buildSlugMap(articles) {
  const basis = new Map();
  const anzahl = new Map();
  for (const list of Object.values(articles || {})) {
    for (const a of list || []) {
      if (!a || !a.url || basis.has(a.url)) continue;
      const s = slugify(a.title);
      basis.set(a.url, s);
      anzahl.set(s, (anzahl.get(s) || 0) + 1);
    }
  }
  const result = new Map();
  for (const [url, s] of basis) {
    result.set(url, anzahl.get(s) > 1 ? `${s}-${kurzHash(url)}` : s);
  }
  return result;
}
