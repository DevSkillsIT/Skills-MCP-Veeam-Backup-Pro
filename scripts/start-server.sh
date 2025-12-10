#!/bin/bash
# start-server.sh - Inicia servidor Veeam MCP com logs
# Skills IT - Dezembro 2025

# Matar processos antigos
echo "🛑 Parando processos antigos..."
lsof -ti:8825 | xargs -r kill -9 2>/dev/null
sleep 2

# Iniciar servidor
echo "🚀 Iniciando servidor Veeam MCP na porta 8825..."
node vbr-mcp-server.js > /tmp/veeam-mcp.log 2>&1 &
SERVER_PID=$!
echo "✅ Servidor iniciado com PID: $SERVER_PID"

# Aguardar startup
sleep 5

# Testar health
echo ""
echo "🏥 Testando health check..."
curl -s http://localhost:8825/health | jq '{status, toolsCount, httpAuthentication}'

echo ""
echo "📋 Ver logs: tail -f /tmp/veeam-mcp.log"
echo "🛑 Parar: lsof -ti:8825 | xargs kill"
