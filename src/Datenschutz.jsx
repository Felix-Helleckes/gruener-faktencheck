import React, { useEffect } from "react";
import { Helmet } from "react-helmet";
import SiteFooter, { IMPRESSUM_URL } from "./SiteFooter";
import { openConsentSettings } from "./consent";

export default function Datenschutz() {
  useEffect(() => {
    try {
      document.body.classList.toggle("darkmode", JSON.parse(localStorage.getItem("darkmode")) === true);
    } catch {
      /* ignorieren */
    }
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="container legal-page">
      <Helmet>
        <title>Datenschutzerklärung | Grüner Faktencheck</title>
        <meta name="description" content="Datenschutzerklärung von grüner-faktencheck.de" />
        <link rel="canonical" href="https://grüner-faktencheck.de/datenschutz" />
        <meta name="robots" content="noindex, follow" />
      </Helmet>

      <p>
        <a href="/">← Zurück zur Startseite</a>
      </p>

      <h1>Datenschutzerklärung</h1>
      <p>Stand: November 2026</p>

      <h2>1. Verantwortlicher</h2>
      <p>
        Verantwortlich für die Datenverarbeitung auf dieser Website (grüner-faktencheck.de) ist:
        <br />
        Felix Florian Helleckes
        <br />
        c/o Online-Impressum 13381
        <br />
        Europaring 90
        <br />
        53757 Sankt Augustin
        <br />
        E-Mail: <a href="mailto:fhelleckes@gmail.com">fhelleckes@gmail.com</a>
        <br />
        Vollständiges Impressum:{" "}
        <a href={IMPRESSUM_URL} target="_blank" rel="noopener noreferrer">
          {IMPRESSUM_URL}
        </a>
      </p>

      <h2>2. Hosting und Server-Logfiles</h2>
      <p>
        Diese Website wird bei Netlify, Inc. (San Francisco, USA) gehostet. Beim Aufruf der Seite verarbeitet
        Netlify automatisch technisch notwendige Daten, die dein Browser übermittelt: IP-Adresse, Datum und Uhrzeit
        des Abrufs, aufgerufene Adresse, Referrer-URL, Browsertyp und Betriebssystem. Diese Daten sind erforderlich,
        um die Website auszuliefern und ihre Sicherheit zu gewährleisten. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f
        DSGVO; unser berechtigtes Interesse liegt im sicheren und stabilen Betrieb der Website. Eine Zusammenführung
        mit anderen Datenquellen findet nicht statt.
      </p>
      <p>
        Dabei können Daten in die USA übermittelt werden. Die Übermittlung stützt sich auf das EU-US Data Privacy
        Framework bzw. auf Standardvertragsklauseln der EU-Kommission (Art. 45, 46 DSGVO). Details:{" "}
        <a href="https://www.netlify.com/privacy/" target="_blank" rel="noopener noreferrer">
          netlify.com/privacy
        </a>
        .
      </p>

      <h2>3. Lokale Speicherung in deinem Browser</h2>
      <p>
        Wir speichern in deinem Browser (Local Storage) nur, ob du den Dunkelmodus eingeschaltet hast und wie du dich
        zu Google Analytics entschieden hast. Außerdem legt ein Service Worker Seiten zwischen, damit die Website
        schneller lädt und offline teilweise funktioniert. Diese Daten verlassen dein Gerät nicht. Die Speicherung
        ist für die von dir gewünschten Funktionen unbedingt erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG). Du kannst sie
        jederzeit über die Einstellungen deines Browsers löschen.
      </p>

      <h2>4. Google Analytics (nur mit Einwilligung)</h2>
      <p>
        Wenn du im Banner auf „Akzeptieren“ klickst, nutzen wir Google Analytics 4 der Google Ireland Limited,
        Gordon House, Barrow Street, Dublin 4, Irland („Google“). Google Analytics setzt Cookies (z. B. „_ga“, „_ga_*“,
        Speicherdauer bis zu 2 Jahre) und wertet aus, welche Seiten wie genutzt werden. Dabei werden u. a.
        Geräte- und Browserinformationen, ungefährer Standort, aufgerufene Seiten und Verweildauer verarbeitet.
        Google Analytics 4 speichert nach Angaben von Google keine vollständigen IP-Adressen.
      </p>
      <p>
        Rechtsgrundlage ist deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO, § 25 Abs. 1 TDDDG). Ohne Einwilligung
        wird Google Analytics nicht geladen. Daten können an Google LLC in die USA übermittelt werden; Google ist
        unter dem EU-US Data Privacy Framework zertifiziert (Art. 45 DSGVO).
      </p>
      <p>
        Du kannst deine Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen:{" "}
        <button type="button" className="footer-link-button" onClick={openConsentSettings}>
          Cookie-Einstellungen öffnen
        </button>
        . Weitere Informationen:{" "}
        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
          policies.google.com/privacy
        </a>
        .
      </p>

      <h2>5. Links zu anderen Websites</h2>
      <p>
        Diese Website verlinkt auf externe Angebote, insbesondere auf die Quellen der Artikel, auf YouTube und auf
        PayPal. Diese Dienste werden erst geladen, wenn du einen Link anklickst. Ab dann gelten die
        Datenschutzbestimmungen des jeweiligen Anbieters.
      </p>

      <h2>6. Kontakt per E-Mail</h2>
      <p>
        Wenn du uns per E-Mail schreibst, verarbeiten wir deine Angaben, um deine Anfrage zu beantworten
        (Art. 6 Abs. 1 lit. f DSGVO bzw. lit. b DSGVO bei vertragsbezogenen Anfragen). Die Daten werden gelöscht,
        sobald sie nicht mehr erforderlich sind und keine gesetzlichen Aufbewahrungspflichten bestehen.
      </p>

      <h2>7. Deine Rechte</h2>
      <p>
        Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der
        Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch gegen Verarbeitungen auf Grundlage
        von Art. 6 Abs. 1 lit. f DSGVO (Art. 21). Eine erteilte Einwilligung kannst du jederzeit widerrufen
        (Art. 7 Abs. 3 DSGVO). Wende dich dazu an die oben genannte E-Mail-Adresse.
      </p>
      <p>
        Außerdem kannst du dich bei einer Datenschutz-Aufsichtsbehörde beschweren, zum Beispiel bei der
        Landesbeauftragten für Datenschutz und Informationsfreiheit Nordrhein-Westfalen (LDI NRW).
      </p>

      <h2>8. Verschlüsselung und automatisierte Entscheidungen</h2>
      <p>
        Die Website wird ausschließlich verschlüsselt per HTTPS ausgeliefert. Eine automatisierte
        Entscheidungsfindung einschließlich Profiling nach Art. 22 DSGVO findet nicht statt.
      </p>

      <SiteFooter />
    </div>
  );
}
