import React, { useEffect, useState } from "react";
import { getConsent, setConsent } from "./consent";

export default function ConsentBanner() {
  const [open, setOpen] = useState(() => getConsent() === null);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("open-consent-settings", show);
    return () => window.removeEventListener("open-consent-settings", show);
  }, []);

  if (!open) return null;

  const choose = (value) => {
    setConsent(value);
    setOpen(false);
  };

  return (
    <div className="consent-banner" role="dialog" aria-live="polite" aria-label="Datenschutz-Einstellungen">
      <p>
        Wir möchten mit <strong>Google Analytics</strong> auswerten, wie unsere Seite genutzt wird. Dafür
        werden Cookies gesetzt und Daten an Google übertragen – auch in die USA. Das passiert nur mit deiner
        Einwilligung, die du jederzeit über „Cookie-Einstellungen“ im Seitenfuß widerrufen kannst. Mehr in der{" "}
        <a href="/datenschutz">Datenschutzerklärung</a>.
      </p>
      <div className="consent-buttons">
        <button type="button" onClick={() => choose("denied")}>
          Ablehnen
        </button>
        <button type="button" onClick={() => choose("granted")}>
          Akzeptieren
        </button>
      </div>
    </div>
  );
}
