#!/usr/bin/env bash
# Netlify-"ignore"-Befehl, eingebunden über netlify.toml.
#
# Netlify ruft das Skript vor jedem Build auf und entscheidet anhand des
# Exit-Codes:  0 = Build überspringen,  1 = bauen.
#
# Grundsatz: Im Zweifel wird gebaut. Ein überflüssiger Build kostet auf dem
# Free-Plan 15 von 300 Credits im Monat. Ein fälschlich übersprungener Build
# lässt die Website still veralten – das ist teurer.

# Alles, was im ausgelieferten Build landet (relativ zum Base-Verzeichnis /).
# Gegengeprüft gegen "npm run build" = "npm run generate && vite build":
#   src/, index.html, public/   -> von Vite gebündelt bzw. nach dist/ kopiert
#   GFLogo.png                  -> Favicon, in index.html eingebunden
#   scripts/                    -> erzeugt sitemap.xml und feed.xml
#   package*.json               -> Abhängigkeiten und Build-Befehl
#   netlify.toml                -> kann Redirects, Header und Plugins setzen
WATCHED=(src public index.html GFLogo.png scripts package.json package-lock.json netlify.toml)

# Kein Vergleichs-Commit: erster Build oder "Deploy without cache".
if [ -z "${CACHED_COMMIT_REF:-}" ] || [ -z "${COMMIT_REF:-}" ]; then
  echo "[ignore] Kein Vergleichs-Commit verfügbar – Build läuft."
  exit 1
fi

# Derselbe Commit wie beim letzten Build heißt: jemand hat in Netlify von
# Hand "Trigger deploy" gedrückt. Ohne diese Ausnahme wäre der Diff leer und
# der manuelle Deploy würde stillschweigend übersprungen.
if [ "$CACHED_COMMIT_REF" = "$COMMIT_REF" ]; then
  echo "[ignore] Manueller Deploy desselben Commits – Build läuft."
  exit 1
fi

# Vergleichs-Commit fehlt im Klon, etwa nach einem Force-Push.
if ! git cat-file -e "${CACHED_COMMIT_REF}^{commit}" 2>/dev/null; then
  echo "[ignore] Vergleichs-Commit ${CACHED_COMMIT_REF} nicht im Klon – Build läuft."
  exit 1
fi

git diff --quiet "$CACHED_COMMIT_REF" "$COMMIT_REF" -- "${WATCHED[@]}"
status=$?

if [ "$status" -eq 0 ]; then
  echo "[ignore] Seit ${CACHED_COMMIT_REF:0:7} keine buildrelevanten Änderungen – Build übersprungen."
  exit 0
fi

# 1 = Änderungen gefunden. Jeder andere Code ist ein git-Fehler – dann bauen.
echo "[ignore] Buildrelevante Änderungen seit ${CACHED_COMMIT_REF:0:7} – Build läuft."
exit 1
