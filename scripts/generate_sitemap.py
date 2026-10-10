#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generates a dynamic sitemap.xml from articles-enhanced.js
Run this whenever you add new articles to automatically update the sitemap
SEO-optimized with proper priorities and change frequencies
"""

import sys
import re
import json
import subprocess
from shutil import which
sys.stdout.reconfigure(encoding='utf-8') if hasattr(sys.stdout, 'reconfigure') else None
from datetime import datetime
from pathlib import Path
import glob
import unicodedata

# Use Umlaut-Domain für Sitemap und Ping-URLs
SITE_DOMAIN = "https://grüner-faktencheck.de"
SITE_DOMAIN_UE = "https://gruener-faktencheck.de"

def category_to_slug(category):
    """Create SEO slug for category paths (Umlaut-Domain).

    Robust gegen falsche Encodings (Mojibake) und normalisiert Umlaute/ß.
    """
    import unicodedata
    orig = category.strip()
    candidate = orig
    # Versuch Mojibake-Reparatur falls Datei falsch dekodiert wurde
    if 'Ã' in candidate or '�' in candidate:
        try:
            candidate = candidate.encode('latin1').decode('utf-8')
        except Exception:
            candidate = orig
    slug = candidate
    # Repariere typische Mojibake-Sequenzen explizit (z.B. 'ÃŸ' -> 'ss')
    slug = slug.replace('ÃŸ', 'ss').replace('Ã¤', 'ae').replace('Ã¶', 'oe').replace('Ã¼', 'ue')
    slug = slug.replace('Ã„', 'Ae').replace('Ã–', 'Oe').replace('Ãœ', 'Ue')
    # Ersetze Groß-/Umlaute konsistent
    slug = slug.replace("Ä", "Ae").replace("Ö", "Oe").replace("Ü", "Ue")
    slug = slug.replace("ä", "ae").replace("ö", "oe").replace("ü", "ue")
    slug = slug.replace("ß", "ss")
    slug = unicodedata.normalize('NFKC', slug)
    # Sonderfall: Außenpolitik sollte als aussenpolitik ausgegeben werden
    if slug.lower() in ("außenpolitik", "aussenpolitik"):
        return "aussenpolitik"
    slug = slug.lower().replace(" ", "-")
    # Entferne übrige nicht-ASCII-Zeichen (safety)
    slug = slug.encode('ascii', 'ignore').decode('ascii')
    return slug

def category_to_slug_ue(category):
    """Create SEO slug for category paths (UE-Domain, garantiert ohne Umlaute/ß und Encoding-Fehler)."""
    import unicodedata
    orig = category.strip()
    # Versuch, gängige Mojibake-Fälle zu reparieren (z.B. 'ÃŸ' statt 'ß')
    candidate = orig
    if 'Ã' in candidate or '�' in candidate:
        try:
            candidate = candidate.encode('latin1').decode('utf-8')
        except Exception:
            candidate = orig

    slug = candidate.lower()
    slug = unicodedata.normalize('NFKC', slug)
    # Explizite Ersetzung für Umlaute und ß zu UE-Form
    slug = slug.replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue')
    slug = slug.replace('ß', 'ss')
    slug = slug.replace(' ', '-')

    # Spezielle Korrektur für kaputt kodierte Varianten von Außenpolitik
    broken_variants = ('auÃŸenpolitik', 'auÃŸenpolitik', 'auãÿenpolitik', 'auÃ¼enpolitik', 'auÃªenpolitik')
    if any(b in slug for b in broken_variants):
        return 'aussenpolitik'

    # Wenn nach allen Ersetzungen noch eine Variante von außenpolitik auftaucht, erzwinge sie
    if 'aussenpolitik' in slug or 'au\u0000senpolitik' in slug or 'außenpolitik' in slug:
        return 'aussenpolitik'

    # Entferne übrige nicht-ASCII-Zeichen
    slug = slug.encode('ascii', 'ignore').decode('ascii')
    return slug

def extract_static_pages():
    """Extract static HTML pages from static_pages directory"""
    static_pages_dir = Path(__file__).parent.parent / "static_pages"
    static_pages = {}
    
    if static_pages_dir.exists():
        for html_file in static_pages_dir.glob("*.html"):
            # Extract category name from filename (e.g., aussenpolitik.html -> Außenpolitik)
            name = html_file.stem
            # Map to proper category names
            category_map = {
                "aussenpolitik": "Außenpolitik",
                "energie": "Energie",
                "innenpolitik": "Innenpolitik",
                "wirtschaft": "Wirtschaft"
            }
            if name in category_map:
                static_pages[category_map[name]] = f"/{name}.html"
    
    return static_pages

def extract_categories_and_articles_from_js():
    """Extract category names and article count from articles-enhanced.js.

    Prefer using Node helper `scripts/parse_articles.js` for robust parsing.
    Falls Node nicht vorhanden oder Fehler auftritt, wird ein Regex‑Fallback verwendet.
    """
    scripts_dir = Path(__file__).parent
    node_helper = scripts_dir / 'parse_articles.js'

    # Try Node helper first
    if which('node') and node_helper.exists():
        try:
            proc = subprocess.run(['node', str(node_helper)], capture_output=True, text=True, timeout=5)
            if proc.returncode == 0 and proc.stdout:
                parsed = json.loads(proc.stdout)
                # Build categories dict with counts
                return {k: len(v) for k, v in parsed.items()}
            else:
                print('[WARN] Node parser failed, falling back to regex.', file=sys.stderr)
        except Exception as e:
            print(f'[WARN] Node parser error: {e}, falling back to regex.', file=sys.stderr)

    # Regex fallback (older behaviour)
    articles_file = Path(__file__).parent.parent / "src" / "articles-enhanced.js"

    with open(articles_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Extract category names and article counts
    categories = {}
    for match in re.finditer(r'"([^"]+)":\s*\[', content):
        cat_name = match.group(1)
        # Count articles in this category by counting title fields
        start = match.end()
        # Find next category or end
        next_match = re.search(r'},\s*"([^"]+)":\s*\[', content[start:])
        if next_match:
            end = start + next_match.start()
        else:
            end = len(content)

        cat_content = content[start:end]
        article_count = cat_content.count('"title":')
        categories[cat_name] = article_count

    return categories

def generate_sitemap(categories, static_pages, domain=SITE_DOMAIN):
    """Generate sitemap XML content with SEO optimization"""
    sitemap_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
        '  <url>',
        f'    <loc>{domain}/</loc>',
        f'    <lastmod>{datetime.now().strftime("%Y-%m-%d")}</lastmod>',
        '    <changefreq>daily</changefreq>',
        '    <priority>1.0</priority>',
        '  </url>',
    ]
    # Nur Kategorie-Unterseiten aufnehmen
    max_articles = max(categories.values()) if categories else 1
    for category, article_count in sorted(categories.items(), key=lambda x: x[1], reverse=True):
        if domain == SITE_DOMAIN_UE:
            category_slug = category_to_slug_ue(category)
        else:
            category_slug = category_to_slug(category)
        category_url = f"{domain}/category/{category_slug}"
        # Priority based on article count (more articles = higher priority)
        priority = round(0.7 + (article_count / max_articles) * 0.25, 2)
        sitemap_lines.append('  <url>')
        sitemap_lines.append(f'    <loc>{category_url}</loc>')
        sitemap_lines.append(f'    <lastmod>{datetime.now().strftime("%Y-%m-%d")}</lastmod>')
        sitemap_lines.append('    <changefreq>daily</changefreq>')
        sitemap_lines.append(f'    <priority>{priority}</priority>')
        sitemap_lines.append('  </url>')

    # Chronik: chronologische Gesamtuebersicht aller Eintraege
    sitemap_lines.append('  <url>')
    sitemap_lines.append(f'    <loc>{domain}/chronik</loc>')
    sitemap_lines.append(f'    <lastmod>{datetime.now().strftime("%Y-%m-%d")}</lastmod>')
    sitemap_lines.append('    <changefreq>weekly</changefreq>')
    sitemap_lines.append('    <priority>0.9</priority>')
    sitemap_lines.append('  </url>')

    sitemap_lines.append('</urlset>')
    return '\n'.join(sitemap_lines), categories, static_pages

if __name__ == "__main__":
    try:
        categories = extract_categories_and_articles_from_js()
        static_pages = extract_static_pages()
        # Sitemap für ü-Domain
        sitemap_content, cat_data, static_data = generate_sitemap(categories, static_pages, domain=SITE_DOMAIN)
        sitemap_path = Path(__file__).parent.parent / "public" / "sitemap.xml"
        with open(sitemap_path, 'w', encoding='utf-8') as f:
            f.write(sitemap_content)
        print(f"[OK] Sitemap generated: {sitemap_path}")

        # Die ASCII-Domain gruener-faktencheck.de wird per 301 auf die
        # kanonische Umlaut-Domain umgeleitet (siehe public/_redirects).
        # Eine zweite Sitemap dafür wäre ein Widerspruch zu den canonical-Tags
        # und würde identische Inhalte doppelt zur Indexierung anmelden.
        # Altbestände entfernen, inklusive abweichender Gross-/Kleinschreibung.
        sitemap_dir = Path(__file__).parent.parent / "public"
        try:
            for p in sitemap_dir.iterdir():
                if p.is_file() and p.name.lower() == "sitemapue.xml":
                    p.unlink()
                    print(f"[OK] Entfernt (nicht mehr benoetigt): {p}")
        except Exception as e:
            print(f"[WARN] Aufraeumen uebersprungen: {e}")

        # Hinweis: Das Anpingen von Google und Bing wurde entfernt.
        # Google hat den Sitemap-Ping im Juni 2023 abgeschaltet (HTTP 404),
        # Bing beantwortet ihn mit HTTP 410 Gone. Beide Dienste lesen die
        # Sitemap ueber robots.txt und die Search Console.

        print(f"[OK] Kategorien mit Artikel-Zahl:")
        for cat, count in sorted(cat_data.items(), key=lambda x: x[1], reverse=True):
            print(f"     - {cat}: {count} Artikel")
        print(f"[OK] Statische Seiten:")
        for cat, url in static_data.items():
            print(f"     - {cat}: {url}")
        print(f"[OK] Sitemap URL:")
        print(f"  - {SITE_DOMAIN}/sitemap.xml")
        print(f"\n[INFO] NÄCHSTE SCHRITTE:")
        print(f"1. Gehen Sie zu: https://search.google.com/search-console")
        print(f"2. Registrieren Sie {SITE_DOMAIN} als Property")
        print(f"3. Gehen Sie zu: Sitemaps")
        print(f"4. Tragen Sie ein: {SITE_DOMAIN}/sitemap.xml")
        print(f"5. Klicken Sie: 'Absenden'")
        print(f"\n[INFO] {SITE_DOMAIN_UE} leitet per 301 hierher weiter und")
        print(f"       braucht keine eigene Sitemap. Eine dort bereits")
        print(f"       eingereichte sitemapue.xml in der Search Console entfernen.")
        print(f"\n[DONE] Das war's! Google wird Ihre Artikel jetzt regelmäßig crawlen.")
    except Exception as e:
        print(f"[ERROR] Error: {e}")
        exit(1)
