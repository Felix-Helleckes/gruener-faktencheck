// Einwilligung für Google Analytics (§ 25 TDDDG, Art. 6 Abs. 1 lit. a DSGVO).
// Ohne gespeicherte Zustimmung wird kein Google-Skript geladen.
const KEY = "analytics-consent"; // "granted" | "denied"

export function getConsent() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setConsent(value) {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    /* Speicher blockiert – Entscheidung gilt nur für diesen Besuch */
  }
  if (value === "granted" && typeof window.loadGtag === "function") {
    window.loadGtag();
  }
  if (value === "denied" && window._gtag_loaded) {
    // Bereits geladenes Analytics lässt sich nicht entladen: Neu laden,
    // damit ab sofort keine Daten mehr gesendet werden.
    window.location.reload();
  }
}

// Öffnet das Banner erneut (Link "Cookie-Einstellungen" im Footer)
export function openConsentSettings() {
  window.dispatchEvent(new Event("open-consent-settings"));
}
