#!/usr/bin/env python3
"""
Erzeugt die Vorschaubilder für Social Media (1200x630) aus dem Artikelbestand.

  public/og-image.jpg    – Startseite, Kategorien, Artikelseiten
  public/og-chronik.jpg  – Chronik, mit der Anzahl der Berichte pro Jahr

Läuft bei jedem Build (npm run generate), damit die Zahlen auf den Bildern
nie veralten. Benötigt Pillow (requirements.txt, Netlify installiert es
selbst). Fehlt Pillow – etwa bei einem lokalen Build –, bleibt das zuletzt
eingecheckte Bild stehen und der Build läuft weiter.

Schrift: Liberation Sans (SIL Open Font License), maßgleich zu Arial, das
die Website verwendet. Liegt unter scripts/fonts/, weil die Build-Server
keine Arial haben und Arial nicht frei weitergegeben werden darf.
"""

import json
import subprocess
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
FONTS = Path(__file__).resolve().parent / "fonts"

W, H = 1200, 630

# Farben aus src/style.css (Darkmode), damit die Bilder zur Seite passen
BG = (24, 28, 31)          # #181c1f
PANEL = (35, 39, 42)       # #23272a
CARD = (44, 51, 56)        # #2c3338
HEADLINE = (182, 226, 199) # #b6e2c7
ACCENT = (127, 220, 164)   # #7fdca4
GREEN = (33, 124, 59)      # #217c3b
TEXT = (234, 251, 231)     # #eafbe7
MUTED = (150, 163, 155)

DOMAIN = "grüner-faktencheck.de"
HINWEIS = "Kein offizielles Angebot der Partei BÜNDNIS 90/DIE GRÜNEN"


def load_articles():
    """Artikel über denselben Node-Loader wie Sitemap und Prerendering."""
    proc = subprocess.run(
        ["node", str(ROOT / "scripts" / "articles_json.js")],
        capture_output=True, text=True, timeout=30, check=True,
    )
    return json.loads(proc.stdout)


def fonts():
    from PIL import ImageFont

    bold = FONTS / "LiberationSans-Bold.ttf"
    regular = FONTS / "LiberationSans-Regular.ttf"
    return (
        lambda size: ImageFont.truetype(str(bold), size),
        lambda size: ImageFont.truetype(str(regular), size),
    )


def frame(draw):
    """Panel mit Akzentkante links, analog zu .article-teaser."""
    draw.rounded_rectangle([48, 48, W - 48, H - 48], radius=18, fill=PANEL)
    draw.rounded_rectangle([48, 48, 58, H - 48], radius=4, fill=ACCENT)


def footer(draw, bold, regular, x):
    draw.text((x, 504), DOMAIN, font=bold(28), fill=TEXT)
    draw.text((x, 544), HINWEIS, font=regular(20), fill=MUTED)


def save(img, name):
    target = PUBLIC / name
    img.save(target, "JPEG", quality=90, optimize=True, progressive=True)
    print(f"[OK] {target.relative_to(ROOT)} ({target.stat().st_size // 1024} KB)")


def build_main(articles, bold, regular):
    from PIL import Image, ImageDraw

    counts = Counter(a["category"] for a in articles)
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    frame(d)

    x = 104
    d.text((x, 100), "UNABHÄNGIGES ARCHIV", font=bold(26), fill=ACCENT)
    d.text((x, 146), "Grüner Faktencheck", font=bold(76), fill=HEADLINE)
    d.text((x, 250), "Kritische Analyse der Partei", font=regular(34), fill=TEXT)
    d.text((x, 292), "BÜNDNIS 90/DIE GRÜNEN", font=regular(34), fill=TEXT)
    d.rectangle([x, 356, W - 104, 358], fill=GREEN)

    chips = [(counts.get(c, 0), c) for c in ("Wirtschaft", "Innenpolitik", "Außenpolitik")]
    cw, gap, cy = 236, 26, 382
    for i, (num, label) in enumerate(chips):
        cx = x + i * (cw + gap)
        d.rounded_rectangle([cx, cy, cx + cw, cy + 96], radius=12, fill=CARD)
        d.rounded_rectangle([cx, cy, cx + 5, cy + 96], radius=2, fill=ACCENT)
        d.text((cx + 26, cy + 14), str(num), font=bold(40), fill=ACCENT)
        d.text((cx + 26, cy + 62), label, font=regular(23), fill=MUTED)

    footer(d, bold, regular, x)
    save(img, "og-image.jpg")


def build_chronik(articles, bold, regular):
    from PIL import Image, ImageDraw

    years = Counter(a["date"][:4] for a in articles if a.get("date"))
    if not years:
        print("[WARN] Keine datierten Artikel – Chronik-Bild übersprungen.")
        return

    latest = max(years)
    # Die letzten fünf Jahre bis zum jüngsten, Lücken als 0 sichtbar
    shown = [str(y) for y in range(int(latest) - 4, int(latest) + 1)]
    peak = max(years.get(y, 0) for y in shown) or 1

    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    frame(d)

    x = 104
    d.text((x, 100), "CHRONIK · GRÜNER FAKTENCHECK", font=bold(26), fill=ACCENT)

    big = str(years[latest])
    d.text((x, 140), big, font=bold(132), fill=HEADLINE)
    num_w = d.textlength(big, font=bold(132))
    d.text((x + num_w + 28, 178), "dokumentierte Berichte", font=bold(40), fill=TEXT)
    d.text((x + num_w + 28, 228), f"im Jahr {latest}", font=regular(36), fill=TEXT)

    # Bewusst ohne Gesamtzahl: Die Balken zeigen nur datierte Berichte der
    # letzten fünf Jahre und ergäben sonst nicht die genannte Summe.
    d.text((x, 312), "Die letzten fünf Jahre im Archiv:", font=regular(24), fill=MUTED)

    # Balkendiagramm
    base_y, max_h = 448, 100
    col_w = (W - 2 * x) / len(shown)
    bar_w = min(120, col_w * 0.62)
    for i, y in enumerate(shown):
        n = years.get(y, 0)
        cx = x + i * col_w + (col_w - bar_w) / 2
        h = max(4, round(max_h * n / peak)) if n else 4
        color = ACCENT if y == latest else GREEN
        d.rounded_rectangle([cx, base_y - h, cx + bar_w, base_y], radius=6, fill=color)
        label = str(n)
        lw = d.textlength(label, font=bold(24))
        d.text((cx + (bar_w - lw) / 2, base_y - h - 32), label, font=bold(24), fill=TEXT)
        yw = d.textlength(y, font=regular(22))
        d.text((cx + (bar_w - yw) / 2, base_y + 8), y, font=regular(22), fill=MUTED)

    footer(d, bold, regular, x)
    save(img, "og-chronik.jpg")


def main():
    try:
        import PIL  # noqa: F401
    except ImportError:
        print("[WARN] Pillow nicht installiert – Vorschaubilder bleiben unverändert.")
        print("       Installieren mit: pip install -r requirements.txt")
        return 0

    articles = load_articles()
    bold, regular = fonts()
    build_main(articles, bold, regular)
    build_chronik(articles, bold, regular)
    return 0


if __name__ == "__main__":
    sys.exit(main())
