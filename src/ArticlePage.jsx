import React, { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import { articles } from "./articles-enhanced";
import { buildSlugMap } from "./article-slug";
import { categoryToSlug } from "./category-seo";
import { formatDate, sortByDateDesc } from "./date-utils";

const SITE = "https://grüner-faktencheck.de";
// Zum Teilen die ASCII-Domain: lesbar in jeder App, leitet per 301 auf die
// kanonische Umlaut-Domain weiter. Crawler folgen der Weiterleitung.
const SHARE_BASE = "https://gruener-faktencheck.de";
const OG_IMAGE = "https://xn--grner-faktencheck-32b.de/og-image.jpg";

function getDomain(url) {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

function truncate(text, max) {
  if (!text || text.length <= max) return text || "";
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${cut.slice(0, space > max * 0.6 ? space : max).trim()} …`;
}

// Alle Artikel einmalig flach aufbereitet, in Chronik-Reihenfolge
const slugMap = buildSlugMap(articles);
const ALL = Object.entries(articles)
  .flatMap(([category, list]) =>
    (list || []).map((a) => ({ ...a, category, slug: slugMap.get(a.url) }))
  )
  .sort(sortByDateDesc);

function ArticlePage() {
  const { slug } = useParams();
  const year = new Date().getFullYear();

  const [darkmode, setDarkmode] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("darkmode");
      if (saved !== null) return saved === "true";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem("darkmode", darkmode);
    if (darkmode) document.body.classList.add("darkmode");
    else document.body.classList.remove("darkmode");
  }, [darkmode]);

  // Beim Wechsel zwischen Artikeln nach oben springen
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  const { article, newer, older } = useMemo(() => {
    const i = ALL.findIndex((a) => a.slug === slug);
    if (i === -1) return { article: null, newer: null, older: null };
    return {
      article: ALL[i],
      newer: i > 0 ? ALL[i - 1] : null,
      older: i < ALL.length - 1 ? ALL[i + 1] : null,
    };
  }, [slug]);

  const footer = (
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
  );

  if (!article) {
    return (
      <div className="container article-page">
        <Helmet>
          <title>Artikel nicht gefunden | Grüner Faktencheck</title>
          <meta name="robots" content="noindex, follow" />
        </Helmet>
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <div className="nav-left">
            <a href={`${SITE}/`} title="Startseite">Startseite</a>
            <Link to="/chronik">Chronik</Link>
          </div>
        </nav>
        <h1>Artikel nicht gefunden</h1>
        <p style={{ textAlign: "center" }}>
          Unter dieser Adresse gibt es keinen Eintrag. Alle Berichte findest du in der{" "}
          <Link to="/chronik">Chronik</Link>.
        </p>
        {footer}
      </div>
    );
  }

  const categorySlug = categoryToSlug(article.category);
  const domain = getDomain(article.url);
  const canonical = `${SITE}/artikel/${article.slug}`;
  const shareUrl = `${SHARE_BASE}/artikel/${article.slug}`;
  const description = truncate(article.description || article.title, 200);
  const shareText = `${article.title} – dokumentiert im Grünen Faktencheck`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": article.title,
    "url": canonical,
    "inLanguage": "de",
    "description": description,
    "isPartOf": { "@type": "WebSite", "name": "Grüner Faktencheck", "url": `${SITE}/` },
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Startseite", "item": `${SITE}/` },
        { "@type": "ListItem", "position": 2, "name": article.category, "item": `${SITE}/category/${categorySlug}` },
        { "@type": "ListItem", "position": 3, "name": article.title, "item": canonical },
      ],
    },
    // Der verlinkte Beitrag stammt von der jeweiligen Quelle, nicht von uns
    "mainEntity": {
      "@type": "NewsArticle",
      "headline": article.title,
      "url": article.url,
      ...(article.date ? { "datePublished": article.date } : {}),
      "publisher": { "@type": "Organization", "name": domain },
    },
  };

  return (
    <div className="container article-page">
      <Helmet>
        <title>{`${truncate(article.title, 60)} | Grüner Faktencheck`}</title>
        <meta name="description" content={description} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={canonical} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={canonical} />
        <meta property="og:title" content={article.title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={OG_IMAGE} />
        {article.date && <meta property="article:published_time" content={article.date} />}
        <meta property="article:section" content={article.category} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <nav className="breadcrumb" aria-label="Breadcrumb">
        <div className="nav-left">
          <a href={`${SITE}/`} title="Startseite">Startseite</a>
          <span> / </span>
          <Link to={`/category/${categorySlug}`}>{article.category}</Link>
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

      <article className="article-teaser">
        <h1>{article.title}</h1>
        <p className="article-meta">
          {article.date && (
            <>
              <time dateTime={article.date}>{formatDate(article.date)}</time>
              <span className="meta-separator"> • </span>
            </>
          )}
          <Link to={`/category/${categorySlug}`} style={{ color: "inherit" }}>
            {article.category}
          </Link>
          <span className="meta-separator"> • </span>
          <span>{domain}</span>
        </p>
        {article.description && <p className="article-description">{article.description}</p>}
        <a href={article.url} target="_blank" rel="noopener noreferrer" className="article-link">
          Weiterlesen auf {domain}
        </a>
        <p className="article-source-note">
          Zusammenfassung des verlinkten Beitrags. Der vollständige Text und alle Rechte daran
          liegen bei {domain}.
        </p>
      </article>

      <div className="share-buttons" aria-label="Artikel teilen">
        <a
          className="share-btn share-whatsapp"
          href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          WhatsApp
        </a>
        <a
          className="share-btn share-telegram"
          href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Telegram
        </a>
        <a
          className="share-btn share-twitter"
          href={`https://x.com/intent/post?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          X
        </a>
        <a
          className="share-btn share-facebook"
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Facebook
        </a>
      </div>

      <nav className="article-nav" aria-label="Weitere Berichte">
        {newer ? (
          <Link to={`/artikel/${newer.slug}`} className="article-nav-link">
            <span className="article-nav-label">← Neuerer Bericht</span>
            <span>{truncate(newer.title, 90)}</span>
          </Link>
        ) : (
          <span />
        )}
        {older ? (
          <Link to={`/artikel/${older.slug}`} className="article-nav-link article-nav-older">
            <span className="article-nav-label">Älterer Bericht →</span>
            <span>{truncate(older.title, 90)}</span>
          </Link>
        ) : (
          <span />
        )}
      </nav>

      <p style={{ textAlign: "center", margin: "2em 0" }}>
        <Link to="/chronik" style={{ color: "#217c3b" }}>Alle Berichte in der Chronik</Link>
        {" · "}
        <Link to={`/category/${categorySlug}`} style={{ color: "#217c3b" }}>
          Alle Artikel zu {article.category}
        </Link>
      </p>

      {footer}
    </div>
  );
}

export default ArticlePage;
