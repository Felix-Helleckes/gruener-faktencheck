import React from "react";
import { openConsentSettings } from "./consent";

export const IMPRESSUM_URL = "https://mein.online-impressum.de/reallifemitfelix/";

export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer>
      <p>
        Erstellt von:{" "}
        <a href="https://www.youtube.com/@reallifemitfelix" target="_blank" rel="noopener noreferrer">
          Felix H.
        </a>{" "}
        |{" "}
        <a href="https://paypal.me/Sparky512" target="_blank" rel="noopener noreferrer">
          Trinkgeld via PayPal
        </a>
      </p>
      <p>
        <a href={IMPRESSUM_URL} target="_blank" rel="noopener noreferrer">
          Impressum
        </a>{" "}
        | <a href="/datenschutz">Datenschutz</a> |{" "}
        <button type="button" className="footer-link-button" onClick={openConsentSettings}>
          Cookie-Einstellungen
        </button>
      </p>
      <p>&copy; {year}</p>
    </footer>
  );
}
