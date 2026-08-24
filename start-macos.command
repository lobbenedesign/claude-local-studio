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

# Launch server and open browser
(sleep 1.5 && open "http://localhost:3001") &
$RUNNER server.ts
