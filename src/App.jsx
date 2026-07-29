import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { articles } from "./articles-enhanced";
import { Helmet } from "react-helmet";
import { categoryToSlug } from "./category-seo";
import { useLocation } from "react-router-dom";

function getDomain(url) {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

// Zähle alle Artikel pro Kategorie
function getCategoryStats() {
  const stats = {};
  for (const [category, list] of Object.entries(articles)) {
    stats[category] = list.length;
  }
  return stats;
}

function App() {
  const year = new Date().getFullYear();
  const [search, setSearch] = useState("");
  const [openCategories, setOpenCategories] = useState({});
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  // Auto Dark Mode Detection (Lazy Load)
  const [darkmode, setDarkmode] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("darkmode");
      if (saved !== null) return saved === "true";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });
  
  const categoryStats = getCategoryStats();
  const location = useLocation();

  // SEO: Canonical Link + Mastodon Verification
  useEffect(() => {
    const canonical = document.querySelector('link[rel="canonical"]') || document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = 'https://grüner-faktencheck.de/';
    if (!document.head.contains(canonical)) document.head.appendChild(canonical);

    // Mastodon Verification Link
    const mastodonLink = document.querySelector('link[rel="me"][href*="mastodon"]') || document.createElement('link');
    mastodonLink.rel = 'me';
    mastodonLink.href = 'https://mastodon.social/@irgendwasmitfelix';
    if (!document.head.contains(mastodonLink)) document.head.appendChild(mastodonLink);
  }, []);

  // Darkmode Toggle mit LocalStorage
  useEffect(() => {
    localStorage.setItem("darkmode", darkmode);
    if (darkmode) {
      document.body.classList.add("darkmode");
    } else {
      document.body.classList.remove("darkmode");
    }
  }, [darkmode]);

  // Toggle-Funktion mit Auto-Scroll
  const toggleCategory = (category) => {
    setOpenCategories((prev) => {
      const newState = {
        ...prev,
        [category]: !prev[category],
      };
      
      // Wenn Kategorie gerade geöffnet wird, zu ihr scrollen
      if (!prev[category]) {
        setTimeout(() => {
          const element = document.querySelector(`[data-category="${category}"]`);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 0);
      }
      
      return newState;
    });
  };

  // Tastaturbedienung für Kategorie-Reiter
  const handleCategoryKey = (e, category) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleCategory(category);
    }
  };

  // Filtert alle Artikel nach Suchbegriff (in Titel)
  const filteredArticles = useMemo(() => Object.fromEntries(
    Object.entries(articles).map(([category, list]) => [
      category,
      list.filter(article =>
        article.title.toLowerCase().includes(search.toLowerCase())
      ),
    ])
  ), [search]);

  // Kategorien mit Treffern automatisch öffnen, wenn gesucht wird, sonst zuklappen
  useEffect(() => {
    if (search.trim() !== "") {
      const open = {};
      for (const [category, list] of Object.entries(filteredArticles)) {
        if (list.length > 0) open[category] = true;
      }
      setOpenCategories(open);
    } else {
      setOpenCategories({});
    }
  }, [search]); // NUR search als Abhängigkeit, NICHT filteredArticles!

  // Scroll-Button anzeigen
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Strukturierte Daten (JSON-LD)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Grüner Faktencheck",
    "url": "https://grüner-faktencheck.de/",
    "description": "Unabhängige Analyse und Faktenchecks zur Grünen Partei Deutschland",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://grüner-faktencheck.de/?search={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  };

  const hasResults = Object.values(filteredArticles).some(list => list.length > 0);

  useEffect(() => {
    // Prüfe, ob eine Kategorie direkt als Subpage aufgerufen wurde
    const match = location.pathname.match(/^\/category\/(\w+)/);
    if (match) {
      const slug = match[1];
      // Finde den echten Kategorienamen anhand des Slugs
      const categoryName = Object.keys(categoryStats).find(
        (cat) => categoryToSlug(cat) === slug
      );
      if (categoryName) {
        setOpenCategories({ [categoryName]: true });
        // Optional: Scroll zu Kategorie
        setTimeout(() => {
          const element = document.querySelector(`[data-category="${categoryName}"]`);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 100);
      }
    }
  }, [location.pathname]);

  return (
    <div className="container">
      <Helmet>
        <title>Grüner Faktencheck – Kritische Analyse der Grünen Partei Deutschland</title>
        <meta name="description" content="Grüner Faktencheck: Unabhängige Analyse und Faktenchecks zur Grünen Partei. Artikel, Quellen und kritische Bewertung von Grünen-Politik in Deutschland." />
        <meta name="robots" content="index, follow" />
        <meta name="fediverse:creator" content="@irgendwasmitfelix@mastodon.social" />
        <link rel="canonical" href="https://grüner-faktencheck.de/" />
        <link rel="me" href="https://mastodon.social/@irgendwasmitfelix" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://grüner-faktencheck.de/" />
        <meta property="og:title" content="Grüner Faktencheck - Kritische Analyse der Partei BÜNDNIS 90/DIE GRÜNEN" />
        <meta property="og:description" content="Unabhängige Analyse und Faktenchecks zur Grünen Partei Deutschland mit Quellen und kritischen Bewertungen." />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <nav className="breadcrumb" aria-label="Breadcrumb">
        <div className="nav-left">
          <a href="https://grüner-faktencheck.de/" title="Startseite">Startseite</a>
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

      {/* Hero Section */}
      <div className="hero-section">
        <h1>Grüner Faktencheck - Kritische Analyse der Partei "BÜNDNIS 90/DIE GRÜNEN"</h1>
        <p className="tagline">Unabhängige Faktenchecks, Analysen und Quellen zur Partei Bündnis 90 die Grünen</p>
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginBottom: "2em" }}>
        <label htmlFor="search" style={{ display: "none" }}>Suche Artikel</label>
        <input
          id="search"
          type="text"
          placeholder="Suche Artikel..."
          value={search}
          autoFocus
          onChange={e => setSearch(e.target.value)}
          style={{
            width: "100%",
            maxWidth: "400px",
            padding: "0.7em",
            fontSize: "1em",
            borderRadius: "6px",
            border: "1px solid #217c3b",
          }}
        />
      </div>

      {/* Category Statistics */}
      {!search && (
        <div className="category-stats">
          <h2>Faktencheck-Übersicht – Alle Kategorien</h2>
          <div className="stats-grid">
            {Object.entries(categoryStats).map(([cat, count]) => (
              <div
                key={cat}
                className="stat-box"
                style={{ cursor: "pointer", transition: "transform 0.2s" }}
                tabIndex={0}
                onClick={() => toggleCategory(cat)}
                onKeyDown={e => handleCategoryKey(e, cat)}
                data-category={cat}
                aria-expanded={!!openCategories[cat]}
                role="button"
              >
                <strong>{count}</strong>
                <span>{cat}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasResults ? (
        Object.entries(filteredArticles).map(([category, list]) =>
          list.length > 0 ? (
            <div className="category-box" key={category} data-category={category}>
              <h2
                style={{ cursor: "pointer", userSelect: "none" }}
                tabIndex={0}
                onKeyDown={e => handleCategoryKey(e, category)}
                aria-expanded={!!openCategories[category]}
                role="button"
                onClick={() => toggleCategory(category)}
              >
                {category} {openCategories[category] ? "▲" : "▼"}
              </h2>
              {openCategories[category] &&
                list.map((article, idx) => (
                  <div className="article-teaser" key={article.url || idx}>
                    <h3>{article.title}</h3>
                    {article.description && (
                      <p className="article-description">{article.description}</p>
                    )}
                    {(article.date || article.source) && (
                      <p className="article-meta">
                        {article.date && <span>{article.date}</span>}
                        {article.date && article.source && <span className="meta-separator"> • </span>}
                        {article.source && <span>{article.source}</span>}
                      </p>
                    )}
                    <a href={article.url} target="_blank" rel="noopener noreferrer" className="article-link">
                      Weiterlesen auf {getDomain(article.url)}
                    </a>
                  </div>
                ))}
            </div>
          ) : null
        )
      ) : search.trim() !== "" ? (
        <div style={{ textAlign: "center", color: "#888", margin: "2em 0", fontSize: "1.1em" }}>
          <p>Keine Treffer gefunden für „{search}"</p>
        </div>
      ) : null}

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
            zIndex: 1000
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

export default App;
