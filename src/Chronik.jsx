import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { articles } from "./articles-enhanced";
import { Helmet } from "react-helmet";
import { categoryToSlug } from "./category-seo";
import { formatDate, getYear, sortByDateDesc } from "./date-utils";

function getDomain(url) {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

const OHNE_DATUM = "Ohne Datum";

function Chronik() {
  const year = new Date().getFullYear();

  const [darkmode, setDarkmode] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("darkmode");
      if (saved !== null) return saved === "true";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  const [showScrollTop, setShowScrollTop] = useState(false);
  const [openYears, setOpenYears] = useState({});

  // Alle Artikel über alle Kategorien hinweg, nach Datum absteigend
  const { groups, orderedYears, total, dated } = useMemo(() => {
    const all = [];
    for (const [category, list] of Object.entries(articles)) {
      (list || []).forEach((article) => all.push({ ...article, category }));
    }
    all.sort(sortByDateDesc);

    const groups = {};
    all.forEach((article) => {
      const key = getYear(article.date) || OHNE_DATUM;
      (groups[key] = groups[key] || []).push(article);
    });

    // Jahre absteigend, "Ohne Datum" immer zuletzt
    const orderedYears = Object.keys(groups)
      .filter((k) => k !== OHNE_DATUM)
      .sort((a, b) => b.localeCompare(a));
    if (groups[OHNE_DATUM]) orderedYears.push(OHNE_DATUM);

    return {
      groups,
      orderedYears,
      total: all.length,
      dated: all.filter((a) => a.date).length,
    };
  }, []);

  // Jüngstes Jahr standardmäßig aufgeklappt
  useEffect(() => {
    if (orderedYears.length) setOpenYears({ [orderedYears[0]]: true });
  }, [orderedYears]);

  useEffect(() => {
    localStorage.setItem("darkmode", darkmode);
    if (darkmode) document.body.classList.add("darkmode");
    else document.body.classList.remove("darkmode");
  }, [darkmode]);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toggleYear = (y) => {
    setOpenYears((prev) => {
      const next = { ...prev, [y]: !prev[y] };
      if (!prev[y]) {
        setTimeout(() => {
          const el = document.querySelector(`[data-year="${y}"]`);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 0);
      }
      return next;
    });
  };

  const handleYearKey = (e, y) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleYear(y);
    }
  };

  const jumpToYear = (y) => {
    setOpenYears((prev) => ({ ...prev, [y]: true }));
    setTimeout(() => {
      const el = document.querySelector(`[data-year="${y}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Chronik – Grüner Faktencheck",
    "url": "https://grüner-faktencheck.de/chronik",
    "description":
      "Chronologische Übersicht aller im Archiv dokumentierten Vorgänge zur Partei BÜNDNIS 90/DIE GRÜNEN, nach Jahr sortiert.",
    "isPartOf": {
      "@type": "WebSite",
      "name": "Grüner Faktencheck",
      "url": "https://grüner-faktencheck.de",
    },
    "mainEntity": {
      "@type": "ItemList",
      "numberOfItems": total,
    },
  };

  return (
    <div className="container">
      <Helmet>
        <title>Chronik – Grüner Faktencheck | Alle Vorgänge nach Jahr</title>
        <meta
          name="description"
          content="Chronik des Grünen Faktenchecks: alle dokumentierten Vorgänge zur Partei BÜNDNIS 90/DIE GRÜNEN chronologisch nach Jahr sortiert, mit Quelle und Datum."
        />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://grüner-faktencheck.de/chronik" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://grüner-faktencheck.de/chronik" />
        <meta property="og:title" content="Chronik – Grüner Faktencheck" />
        <meta
          property="og:description"
          content="Alle dokumentierten Vorgänge zur Partei BÜNDNIS 90/DIE GRÜNEN, chronologisch nach Jahr sortiert."
        />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <nav className="breadcrumb" aria-label="Breadcrumb">
        <div className="nav-left">
          <a href="https://grüner-faktencheck.de/" title="Startseite">Startseite</a>
          <span> / Chronik</span>
          <button
            onClick={() => setDarkmode(!darkmode)}
            className="theme-toggle-btn-nav"
            title={darkmode ? "Light Mode" : "Dark Mode"}
            aria-label={darkmode ? "Light Mode" : "Dark Mode"}
          >
            {darkmode ? "☀️" : "🌙"}
          </button>
        </div>
      </nav>

      <div className="hero-section">
        <h1>Chronik</h1>
        <p className="tagline">
          Alle {total} dokumentierten Vorgänge zur Partei Bündnis 90/Die Grünen, chronologisch nach Jahr
        </p>
      </div>

      <Link
        to="/"
        style={{ textDecoration: "none", color: "#217c3b", marginBottom: "1em", display: "inline-block", fontSize: "1.1em" }}
      >
        ← Zurück zur Startseite
      </Link>

      {/* Jahresübersicht, zugleich Sprungmarken */}
      <div className="category-stats">
        <h2>Vorgänge pro Jahr</h2>
        <div className="stats-grid">
          {orderedYears.map((y) => (
            <div
              key={y}
              className="stat-box"
              style={{ cursor: "pointer", transition: "transform 0.2s" }}
              tabIndex={0}
              role="button"
              onClick={() => jumpToYear(y)}
              onKeyDown={(e) => handleYearKey(e, y)}
              aria-label={`${groups[y].length} Vorgänge im Jahr ${y}`}
            >
              <strong>{groups[y].length}</strong>
              <span>{y}</span>
            </div>
          ))}
        </div>
      </div>

      {orderedYears.map((y) => (
        <div className="category-box" key={y} data-year={y}>
          <h2
            style={{ cursor: "pointer", userSelect: "none" }}
            tabIndex={0}
            role="button"
            aria-expanded={!!openYears[y]}
            onKeyDown={(e) => handleYearKey(e, y)}
            onClick={() => toggleYear(y)}
          >
            {y} <span style={{ fontWeight: "normal", fontSize: "0.7em" }}>({groups[y].length})</span>{" "}
            {openYears[y] ? "▲" : "▼"}
          </h2>

          {openYears[y] &&
            groups[y].map((article, idx) => (
              <div className="article-teaser" key={`${article.url}-${idx}`}>
                <h3>{article.title}</h3>
                <p className="article-meta">
                  {article.date && (
                    <>
                      <time dateTime={article.date}>{formatDate(article.date)}</time>
                      <span className="meta-separator"> • </span>
                    </>
                  )}
                  <Link to={`/category/${categoryToSlug(article.category)}`} style={{ color: "inherit" }}>
                    {article.category}
                  </Link>
                  <span className="meta-separator"> • </span>
                  <span>{getDomain(article.url)}</span>
                </p>
                {article.description && <p className="article-description">{article.description}</p>}
                <a href={article.url} target="_blank" rel="noopener noreferrer" className="article-link">
                  Weiterlesen auf {getDomain(article.url)}
                </a>
              </div>
            ))}
        </div>
      ))}

      {dated < total && (
        <p style={{ textAlign: "center", color: "#888", fontSize: "0.95em", margin: "1.5em 0" }}>
          Für {total - dated} von {total} Einträgen ließ sich kein belastbares Veröffentlichungsdatum
          aus der Quelle ermitteln. Sie stehen am Ende unter „Ohne Datum“.
        </p>
      )}

      {showScrollTop && (
        <button
          style={{
            position: "fixed",
            bottom: 30,
            right: 30,
            background: "#217c3b",
            color: "#fff",
            border: "none",
            borderRadius: "50%",
            width: 48,
            height: 48,
            fontSize: 28,
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            zIndex: 1000,
          }}
          aria-label="Nach oben"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          ⬆
        </button>
      )}

      <footer>
        <p>
          Erstellt von:{" "}
          <a href="https://www.youtube.com/@reallifemitfelix" target="_blank" rel="noopener noreferrer">
            Felix H. - Impressum
          </a>{" "}
          |{" "}
          <a href="https://paypal.me/Sparky512" target="_blank" rel="noopener noreferrer">
            Trinkgeld via PayPal
          </a>
        </p>
        <p>&copy; {year}</p>
      </footer>
    </div>
  );
}

export default Chronik;
