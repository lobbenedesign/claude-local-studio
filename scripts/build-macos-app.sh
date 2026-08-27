#!/bin/bash
# Fase 4 (ROADMAP.md) — packaging: compila server.ts in un eseguibile Bun
# standalone e lo impacchetta in un vero bundle .app macOS + installer .dmg.
#
# Perché un binario compilato e non solo lo script start-macos.command:
# un utente non tecnico non deve installare Bun/Node né aprire un terminale.
# Il runtime Bun (~70MB) viene incluso nell'eseguibile da `bun build --compile`;
# gli asset che il server legge da disco a runtime (public/, .config/,
# whisper-models/) NON vengono incorporati nel binario (bun li tratterebbe
# come stringhe di path, non come file) e vanno quindi copiati accanto
# all'eseguibile dentro il bundle. `src/config/paths.ts` risolve
# PROJECT_ROOT alla cartella dell'eseguibile reale (process.execPath)
# quando gira come binario compilato — vedi quel file per i dettagli.
set -euo pipefail
cd "$(dirname "$0")/.."

APP_NAME="Claude Local Studio"
BUNDLE_ID="com.lobbenedesign.claudelocalstudio"
VERSION=$(bun -e "console.log(require('./package.json').version)" 2>/dev/null || echo "1.0.0")
DIST_DIR="dist"
APP_DIR="$DIST_DIR/${APP_NAME}.app"

echo "==> Pulizia build precedente"
rm -rf "$APP_DIR"
mkdir -p "$APP_DIR/Contents/MacOS" "$APP_DIR/Contents/Resources"

echo "==> Compilazione binario standalone (bun build --compile)"
bun build server.ts --compile --outfile "$APP_DIR/Contents/MacOS/claude-local-studio-bin"

echo "==> Copia risorse (public/, whisper-models/, assets/)"
cp -R public "$APP_DIR/Contents/Resources/public"
mkdir -p "$APP_DIR/Contents/Resources/whisper-models"
cp assets/AppIcon.icns "$APP_DIR/Contents/Resources/AppIcon.icns"

echo "==> Scrittura launcher"
cat > "$APP_DIR/Contents/MacOS/claude-local-studio" << 'LAUNCHER'
#!/bin/bash
# Lanciato da Finder al doppio click sul .app. Avvia il binario compilato
# (che vive accanto a questo script) e apre il browser di default sull'URL
# autenticato, stesso schema di logica di start-macos.command per la CLI.
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
RESOURCES="$DIR/../Resources"
export STUDIO_RESOURCES_DIR="$RESOURCES"

LOG_DIR="$HOME/Library/Logs/ClaudeLocalStudio"
mkdir -p "$LOG_DIR"
"$DIR/claude-local-studio-bin" >> "$LOG_DIR/server.log" 2>&1 &
SERVER_PID=$!

TOKEN_FILE="$RESOURCES/.config/auth-token"
for i in $(seq 1 50); do
  if [ -s "$TOKEN_FILE" ]; then
    TOKEN=$(cat "$TOKEN_FILE")
    sleep 0.3
    open "http://localhost:3001/?token=${TOKEN}"
    wait "$SERVER_PID"
    exit 0
  fi
  sleep 0.2
done

open "http://localhost:3001"
wait "$SERVER_PID"
LAUNCHER
chmod +x "$APP_DIR/Contents/MacOS/claude-local-studio"

echo "==> Scrittura Info.plist"
cat > "$APP_DIR/Contents/Info.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>${APP_NAME}</string>
  <key>CFBundleDisplayName</key><string>${APP_NAME}</string>
  <key>CFBundleIdentifier</key><string>${BUNDLE_ID}</string>
  <key>CFBundleVersion</key><string>${VERSION}</string>
  <key>CFBundleShortVersionString</key><string>${VERSION}</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>claude-local-studio</string>
  <key>CFBundleIconFile</key><string>AppIcon.icns</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>LSUIElement</key><false/>
</dict>
</plist>
PLIST

echo "==> App bundle creato: $APP_DIR"

if [ "${SKIP_DMG:-0}" != "1" ]; then
  echo "==> Creazione .dmg"
  DMG_PATH="$DIST_DIR/${APP_NAME// /-}-${VERSION}.dmg"
  rm -f "$DMG_PATH"
  STAGING=$(mktemp -d)
  cp -R "$APP_DIR" "$STAGING/"
  ln -s /Applications "$STAGING/Applications"
  hdiutil create -volname "$APP_NAME" -srcfolder "$STAGING" -ov -format UDZO "$DMG_PATH"
  rm -rf "$STAGING"
  echo "==> Installer creato: $DMG_PATH"
fi

echo "==> Fatto."
