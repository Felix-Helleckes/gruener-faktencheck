"""
Static HTML Generator für Grüner Faktencheck
Generiert separate HTML-Seiten für jede Kategorie zur SEO-Optimierung
Läuft unabhängig und beeinflusst nicht die React-App
"""

import sys
import os
import json
import re
sys.stdout.reconfigure(encoding='utf-8') if hasattr(sys.stdout, 'reconfigure') else None
from datetime import datetime
from pathlib import Path

import html as html_module

# Use ASCII/Punycode site domain for generated canonical/og URLs
SITE_DOMAIN = "https://grüner-faktencheck.de"

# ========== ARTIKELDATEN ==========
# Lädt die Artikel automatisch aus articles-enhanced.js

def load_articles_from_enhanced_js():
    """Lädt Artikel direkt aus der articles-enhanced.js Datei"""
    articles_file = Path(__file__).parent.parent / "src" / "articles-enhanced.js"
    
    with open(articles_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    articles = {}
    
    # Regex um Kategorien und Artikel zu extrahieren
    category_pattern = r'"([^"]+)":\s*\[([\s\S]*?)\](?=,\s*"[^"]+"\s*:\s*\[|\s*\}\s*;)'
    
    for cat_match in re.finditer(category_pattern, content):
        category = cat_match.group(1)
        category_content = cat_match.group(2)
        
        articles[category] = []
        
        # Regex um Artikel zu finden
        article_pattern = r'\{\s*"title":\s*"([^"]+)"\s*,\s*"url":\s*"([^"]+)"'
        
        for art_match in re.finditer(article_pattern, category_content):
            title = art_match.group(1)
            url = art_match.group(2)
            articles[category].append({
                "title": title,
                "url": url
            })
    
    return articles

ARTICLES = load_articles_from_enhanced_js()

# ========== HTML TEMPLATE ==========
HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Grüner Faktencheck – {category}</title>
    <meta name="description" content="Grüner Faktencheck - {category} Artikel: Unabhängige Analyse und Faktenchecks zur Grünen Partei. Artikel, Quellen und kritische Bewertung von Grünen-Politik in Deutschland.">
    <link rel="canonical" href="{site_domain}/category/{category_slug}">
    
    <!-- Open Graph -->
    <meta property="og:title" content="Grüner Faktencheck – {category}">
    <meta property="og:description" content="{category} Artikel - Faktencheck zur Grünen Partei Deutschland">
    <meta property="og:type" content="website">
    <meta property="og:url" content="{site_domain}/category/{category_slug}">
    <meta property="og:image" content="{site_domain}/og-image.jpg">
    
    <!-- JSON-LD Schema -->
    <script type="application/ld+json">
    {{
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": "Grüner Faktencheck - {category}",
        "url": "{site_domain}/category/{category_slug}",
        "description": "{category} Artikel zum Grünen Faktencheck. Kritische Analyse und Faktenüberprüfung.",
        "mainEntity": {{
            "@type": "ItemList",
            "itemListElement": {items_json}
        }}
    }}
    </script>
    
    <style>
        body {{ font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; line-height: 1.6; }}
        h1 {{ color: #217c3b; border-bottom: 3px solid #217c3b; padding-bottom: 10px; }}
        .article {{ border: 1px solid #ddd; padding: 15px; margin: 15px 0; border-radius: 6px; }}
        .article h2 {{ margin-top: 0; }}
        a {{ color: #217c3b; text-decoration: none; }}
        a:hover {{ text-decoration: underline; }}
        .meta {{ color: #666; font-size: 0.9em; }}
        .back-link {{ margin-bottom: 20px; }}
        footer {{ border-top: 1px solid #ddd; padding-top: 20px; margin-top: 40px; color: #666; font-size: 0.9em; }}
    </style>
</head>
<body>
    <div class="back-link">
        <a href="/">← Zurück zur Startseite</a>
    </div>
    
    <h1>Grüner Faktencheck – {category}</h1>
    <p class="meta">Kritische Analyse und Faktenüberprüfung zur Grünen Partei Deutschland</p>
    
    <div class="articles">
        {articles_html}
    </div>
    
    <footer>
        <p>Erstellt von: <a href="https://www.youtube.com/@reallifemitfelix" target="_blank">Felix H.</a> | 
        <a href="https://paypal.me/Sparky512" target="_blank">Trinkgeld via PayPal</a></p>
        <p><a href="https://mein.online-impressum.de/reallifemitfelix/" target="_blank">Impressum</a> | <a href="/datenschutz">Datenschutz</a></p>
        <p>&copy; 2025 Grüner Faktencheck. Letzte Aktualisierung: {timestamp}</p>
    </footer>
</body>
</html>"""

# ========== FUNKTIONEN ==========

def get_domain(url):
    """Extrahiert Domain aus URL"""
    try:
        from urllib.parse import urlparse
        domain = urlparse(url).netloc.replace("www.", "")
        return domain
    except:
        return url

def generate_article_html(article):
    """Generiert HTML für einen Artikel"""
    return f"""
    <div class="article">
        <h2>{article['title']}</h2>
        <a href="{article['url']}" target="_blank" rel="noopener noreferrer">
            Weiterlesen auf {get_domain(article['url'])}
        </a>
    </div>
    """

def generate_json_ld_items(articles):
    """Generiert JSON-LD ItemList für Schema.org"""
    items = []
    for idx, article in enumerate(articles, 1):
        items.append({
            "@type": "ListItem",
            "position": idx,
            "name": article['title'],
            "url": article['url']
        })
    return json.dumps(items)

def category_to_slug(category):
    """Create SEO slug for category paths."""
    return (
        category.strip()
        .replace("Ä", "Ae")
        .replace("Ö", "Oe")
        .replace("Ü", "Ue")
        .replace("ä", "ae")
        .replace("ö", "oe")
        .replace("ü", "ue")
        .replace("ß", "ss")
        .lower()
        .replace(" ", "-")
    )

def generate_category_page(category, articles_list):
    """Generiert statische HTML-Seite für eine Kategorie"""
    
    category_slug = category_to_slug(category)
    
    # Artikel HTML generieren
    articles_html = "".join([generate_article_html(a) for a in articles_list])
    
    # JSON-LD Items generieren
    items_json = generate_json_ld_items(articles_list)
    
    # Template mit Daten füllen
    html = HTML_TEMPLATE.format(
        category=category,
        category_slug=category_slug,
        articles_html=articles_html,
        items_json=items_json,
        timestamp=datetime.now().strftime("%d.%m.%Y %H:%M"),
        site_domain=SITE_DOMAIN
    )
    
    return html, category_slug

def slugify(text, maxlen=80):
    """Erzeugt einen Dateiname/Slug aus Titel (ASCII, minuszeichen)."""
    import re
    text = text.strip().lower()
    # Ersetze Umlaute grob
    trans = str.maketrans({"ä":"ae","ö":"oe","ü":"ue","ß":"ss","Ä":"Ae","Ö":"Oe","Ü":"Ue"})
    text = text.translate(trans)
    # Entferne nicht-alphanumerische Zeichen
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    if len(text) > maxlen:
        text = text[:maxlen].rstrip("-")
    if not text:
        text = "article"
    return text

def generate_article_page(category, article):
    """Generiert eine einzelne statische HTML-Seite für einen Artikel auf der eigenen Domain."""
    category_slug = category_to_slug(category)
    title = article.get('title', 'Artikel')
    description = article.get('description', '')
    source_url = article.get('url', '#')

    article_slug = slugify(title)
    # Pfad: static_pages/articles/<category_slug>-<article_slug>.html
    filename = f"static_pages/articles/{category_slug}-{article_slug}.html"

    # escape values for safe HTML embedding
    esc_title = html_module.escape(title)
    esc_description = html_module.escape(description or title)

    html_content = f"""<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>{esc_title} — Grüner Faktencheck</title>
        <meta name="description" content="{esc_description}" />
        <link rel="canonical" href="{SITE_DOMAIN}/articles/{category_slug}-{article_slug}.html" />
    <meta property="og:title" content="{esc_title}" />
    <meta property="og:description" content="{esc_description}" />
  <meta property="og:type" content="article" />
        <meta property="og:url" content="{SITE_DOMAIN}/articles/{category_slug}-{article_slug}.html" />
    <meta property="og:image" content="{SITE_DOMAIN}/og-image.jpg" />
</head>
<body>
  <a href="/">← Zurück zur Startseite</a>
    <h1>{esc_title}</h1>
        <p>{esc_description}</p>
        <p><a href="{source_url}" target="_blank" rel="noopener noreferrer">Originalquelle lesen</a></p>
    <script type="application/ld+json">
    {{
        "@context": "https://schema.org",
        "@type": "NewsArticle",
                "headline": "{esc_title}",
                                "description": "{esc_description}",
                                "url": "{SITE_DOMAIN}/articles/{category_slug}-{article_slug}.html"
    }}
    </script>
</body>
</html>
"""

    return filename, html_content

def save_html_files(output_dir="./static_pages"):
    """Speichert alle Kategorie-Seiten als HTML-Dateien"""
    
    # Output-Verzeichnis erstellen
    Path(output_dir).mkdir(exist_ok=True)
    
    generated_files = []
    
    for category, articles_list in ARTICLES.items():
        if articles_list:  # Nur Kategorien mit Artikeln
            html, slug = generate_category_page(category, articles_list)
            
            filename = f"{output_dir}/{slug}.html"
            with open(filename, "w", encoding="utf-8") as f:
                f.write(html)
            
            generated_files.append({
                "category": category,
                "slug": slug,
                "file": filename,
                "articles": len(articles_list)
            })
            
            print(f"[OK] Generiert: {filename} ({len(articles_list)} Artikel)")

            # Generiere einzelne Artikel-Seiten (sicher, keine Änderung an articles-enhanced.js)
            articles_out_dir = Path(output_dir) / "articles"
            articles_out_dir.mkdir(parents=True, exist_ok=True)
            for art in articles_list:
                art_filename, art_html = generate_article_page(category, art)
                fullpath = Path(art_filename)
                # Stelle sicher, dass das Verzeichnis existiert
                fullpath.parent.mkdir(parents=True, exist_ok=True)
                with open(fullpath, "w", encoding="utf-8") as fa:
                    fa.write(art_html)
                print(f"[OK] Generiert Artikelseite: {fullpath}")
                generated_files.append({
                    "category": category,
                    "article": art.get('title'),
                    "file": str(fullpath)
                })
    
    return generated_files

# SFTP-Upload wird bei PythonAnywhere nicht benötigt
# Die Dateien werden direkt ins Dateisystem geschrieben

# ========== HAUPTFUNKTION ==========

def main():
    """Hauptfunktion - führt alles aus"""
    
    print("=" * 50)
    print("Grüner Faktencheck - Static HTML Generator")
    print("=" * 50)
    
    # 1. HTML-Dateien generieren
    print("\n1. Generiere statische HTML-Seiten...")
    generated = save_html_files()
    print(f"\n✓ {len(generated)} Kategorien generiert!")
    
    print("\n" + "=" * 50)
    print("Fertig! Die HTML-Seiten sind unter ./static_pages/ verfügbar.")
    print("\nPythonAnywhere Cron-Job:")
    print("  - Gehe zu: https://www.pythonanywhere.com/ → Tasks")
    print("  - Zeitplan: Täglich um 02:00 Uhr (oder deine Vorliebe)")
    print("  - Befehl: python /home/username/generate_static_html.py")
    print("=" * 50)

if __name__ == "__main__":
    main()
