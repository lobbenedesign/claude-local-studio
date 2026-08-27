#!/bin/bash
# CUSTOM CLAUDE CODER - macOS Launcher
cd "$(dirname "$0")"

echo "======================================================"
echo "🚀 CUSTOM CLAUDE CODER - Starting on macOS..."
echo "======================================================"

# Check if Bun is installed, otherwise try node
if command -v bun &> /dev/null; then
    RUNNER="bun"
elif command -v node &> /dev/null; then
    RUNNER="node"
else
    echo "❌ Errore: Bun o Node.js non trovati. Installa Bun da https://bun.sh"
    exit 1
fi

# Launch server in background, then open the browser once the local access
# token exists (Fase 2: il server richiede ?token=... alla prima apertura,
# altrimenti il browser si aprirebbe su una pagina "Accesso non autorizzato").
$RUNNER server.ts &
SERVER_PID=$!

(
  for i in $(seq 1 30); do
    if [ -s ".config/auth-token" ]; then
      TOKEN=$(cat ".config/auth-token")
      sleep 0.3
      open "http://localhost:3001/?token=${TOKEN}"
      exit 0
    fi
    sleep 0.2
  done
  echo "⚠️ Token di accesso non trovato dopo 6s, apro senza — controlla la console per l'URL corretto."
  open "http://localhost:3001"
) &

wait $SERVER_PID
