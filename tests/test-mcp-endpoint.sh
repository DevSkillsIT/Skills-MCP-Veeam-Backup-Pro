#!/bin/bash
# test-mcp-endpoint.sh
# Script de testes automatizados para MCP HTTP Streamable - Veeam Backup
# Skills IT - Dezembro 2025
#
# Testa todos os endpoints MCP (initialize, tools/list, tools/call) e autenticação

set -e

# ============================================
# Configuração
# ============================================
HOST="localhost"
PORT="8825"
BASE_URL="http://${HOST}:${PORT}"
AUTH_TOKEN="bf2571ca23445da17a8415e1c8344db6e311adca2bd55d8b544723ad65f604b9"

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Contadores
PASSED=0
FAILED=0
TOTAL=0

# ============================================
# Funções Helper
# ============================================

print_header() {
  echo ""
  echo "================================================"
  echo -e "${BLUE}$1${NC}"
  echo "================================================"
  echo ""
}

print_test() {
  TOTAL=$((TOTAL + 1))
  echo -e "${YELLOW}Teste $TOTAL:${NC} $1"
}

print_success() {
  PASSED=$((PASSED + 1))
  echo -e "${GREEN}✅ PASSOU:${NC} $1"
  echo ""
}

print_failure() {
  FAILED=$((FAILED + 1))
  echo -e "${RED}❌ FALHOU:${NC} $1"
  echo ""
}

# ============================================
# Início dos Testes
# ============================================

print_header "Veeam Backup MCP - Testes de Endpoint HTTP Streamable"

echo "📍 Servidor: ${BASE_URL}"
echo "🔐 Autenticação: Bearer Token"
echo ""

# ============================================
# Teste 1: Health Check (sem autenticação)
# ============================================
print_test "Health Check (endpoint público)"
RESPONSE=$(curl -s "${BASE_URL}/health")

if echo "$RESPONSE" | jq -e '.status == "healthy"' > /dev/null 2>&1; then
  TOOLS_COUNT=$(echo "$RESPONSE" | jq -r '.toolsCount')
  MCP_SESSIONS=$(echo "$RESPONSE" | jq -r '.mcpSessions.active')
  print_success "Health check OK - Tools: $TOOLS_COUNT, Sessions ativas: $MCP_SESSIONS"
else
  print_failure "Health check retornou status inesperado"
fi

# ============================================
# Teste 2: Autenticação - Sem Token (deve falhar com 401)
# ============================================
print_test "Autenticação - Request sem token (espera 401)"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${BASE_URL}/mcp" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}')

if [ "$HTTP_CODE" = "401" ]; then
  print_success "Corretamente rejeitou request sem token (401)"
else
  print_failure "Esperado 401, recebido: $HTTP_CODE"
fi

# ============================================
# Teste 3: Autenticação - Token Inválido (deve falhar com 401)
# ============================================
print_test "Autenticação - Token inválido (espera 401)"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "${BASE_URL}/mcp" \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer TOKEN_INVALIDO_12345' \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}')

if [ "$HTTP_CODE" = "401" ]; then
  print_success "Corretamente rejeitou token inválido (401)"
else
  print_failure "Esperado 401, recebido: $HTTP_CODE"
fi

# ============================================
# Teste 4: Initialize (handshake MCP)
# ============================================
print_test "MCP Protocol - Initialize (handshake)"
RESPONSE=$(curl -s -X POST "${BASE_URL}/mcp" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{},"id":1}')

if echo "$RESPONSE" | jq -e '.result.protocolVersion == "2024-11-05"' > /dev/null 2>&1; then
  SERVER_NAME=$(echo "$RESPONSE" | jq -r '.result.serverInfo.name')
  print_success "Initialize OK - Protocol: 2024-11-05, Server: $SERVER_NAME"
else
  print_failure "Initialize falhou ou retornou protocolo incorreto"
  echo "$RESPONSE" | jq '.'
fi

# ============================================
# Teste 5: Tools List
# ============================================
print_test "MCP Protocol - Tools List"
RESPONSE=$(curl -s -X POST "${BASE_URL}/mcp" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":2}')

if echo "$RESPONSE" | jq -e '.result.tools | length > 0' > /dev/null 2>&1; then
  TOOLS_COUNT=$(echo "$RESPONSE" | jq -r '.result.tools | length')
  print_success "Tools list OK - Total de ferramentas: $TOOLS_COUNT"

  # Listar nomes das tools
  echo "🔧 Ferramentas disponíveis:"
  echo "$RESPONSE" | jq -r '.result.tools[].name' | while read tool; do
    echo "   - $tool"
  done
  echo ""
else
  print_failure "Tools list falhou ou retornou array vazio"
  echo "$RESPONSE" | jq '.'
fi

# ============================================
# Teste 6: Tool Call - get-server-info (sem parâmetros)
# ============================================
print_test "Tool Call - get-server-info (sem parâmetros)"
RESPONSE=$(curl -s -X POST "${BASE_URL}/mcp" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{
      "name":"get-server-info",
      "arguments":{}
    },
    "id":3
  }')

if echo "$RESPONSE" | jq -e '.result.content' > /dev/null 2>&1; then
  print_success "get-server-info executado com sucesso"
  # Mostrar trecho do resultado
  echo "📄 Resultado (primeiros 200 chars):"
  echo "$RESPONSE" | jq -r '.result.content[0].text' | head -c 200
  echo "..."
  echo ""
else
  print_failure "get-server-info falhou"
  echo "$RESPONSE" | jq '.'
fi

# ============================================
# Teste 7: Tool Call - get-backup-jobs (com parâmetros)
# ============================================
print_test "Tool Call - get-backup-jobs (limit=5)"
RESPONSE=$(curl -s -X POST "${BASE_URL}/mcp" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{
      "name":"get-backup-jobs",
      "arguments":{"limit":5}
    },
    "id":4
  }')

if echo "$RESPONSE" | jq -e '.result.content' > /dev/null 2>&1; then
  print_success "get-backup-jobs executado com sucesso"

  # Tentar extrair summary se disponível
  SUMMARY=$(echo "$RESPONSE" | jq -r '.result.content[0].text' 2>/dev/null | jq -r '.summary' 2>/dev/null || echo "N/A")
  if [ "$SUMMARY" != "N/A" ]; then
    echo "📊 $SUMMARY"
  fi
  echo ""
else
  print_failure "get-backup-jobs falhou"
  echo "$RESPONSE" | jq '.'
fi

# ============================================
# Teste 8: Tool Call - get-license-info
# ============================================
print_test "Tool Call - get-license-info"
RESPONSE=$(curl -s -X POST "${BASE_URL}/mcp" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{
      "name":"get-license-info",
      "arguments":{}
    },
    "id":5
  }')

if echo "$RESPONSE" | jq -e '.result.content' > /dev/null 2>&1; then
  print_success "get-license-info executado com sucesso"
else
  print_failure "get-license-info falhou"
  echo "$RESPONSE" | jq '.'
fi

# ============================================
# Teste 9: Tool Call - Tool inexistente (deve retornar erro)
# ============================================
print_test "Tool Call - Tool inexistente (espera erro)"
RESPONSE=$(curl -s -X POST "${BASE_URL}/mcp" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{
      "name":"tool-que-nao-existe",
      "arguments":{}
    },
    "id":6
  }')

if echo "$RESPONSE" | jq -e '.error' > /dev/null 2>&1; then
  ERROR_MSG=$(echo "$RESPONSE" | jq -r '.error.message')
  print_success "Corretamente retornou erro: $ERROR_MSG"
else
  print_failure "Esperado erro JSON-RPC, mas não foi retornado"
  echo "$RESPONSE" | jq '.'
fi

# ============================================
# Teste 10: Session ID Header
# ============================================
print_test "Session Management - Verificar header Mcp-Session-Id"
RESPONSE=$(curl -s -i -X POST "${BASE_URL}/mcp" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{"jsonrpc":"2.0","method":"initialize","id":7}')

if echo "$RESPONSE" | grep -i "Mcp-Session-Id:" > /dev/null 2>&1; then
  SESSION_ID=$(echo "$RESPONSE" | grep -i "Mcp-Session-Id:" | cut -d' ' -f2 | tr -d '\r')
  print_success "Session ID retornado: ${SESSION_ID:0:20}..."
else
  print_failure "Header Mcp-Session-Id não encontrado"
fi

# ============================================
# Teste 11: Método não suportado (deve retornar erro)
# ============================================
print_test "MCP Protocol - Método não suportado (espera erro)"
RESPONSE=$(curl -s -X POST "${BASE_URL}/mcp" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d '{"jsonrpc":"2.0","method":"metodo/invalido","id":8}')

if echo "$RESPONSE" | jq -e '.error.message | contains("não suportado")' > /dev/null 2>&1; then
  print_success "Corretamente retornou erro para método não suportado"
else
  print_failure "Erro esperado para método não suportado não foi retornado"
  echo "$RESPONSE" | jq '.'
fi

# ============================================
# Teste 12: GET /mcp (SSE endpoint - apenas verificar que aceita conexão)
# ============================================
print_test "SSE Endpoint - GET /mcp (Gemini CLI requirement)"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X GET "${BASE_URL}/mcp" \
  -H "Authorization: Bearer ${AUTH_TOKEN}")

if [ "$HTTP_CODE" = "200" ]; then
  print_success "SSE endpoint aceita conexões (200 OK)"
else
  print_failure "SSE endpoint retornou código inesperado: $HTTP_CODE"
fi

# ============================================
# Teste 13: DELETE /mcp (Session termination)
# ============================================
print_test "Session Termination - DELETE /mcp"
RESPONSE=$(curl -s -X DELETE "${BASE_URL}/mcp" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -H "Mcp-Session-Id: test-session-123")

if echo "$RESPONSE" | jq -e '.status == "session_terminated"' > /dev/null 2>&1; then
  print_success "Session termination OK"
else
  print_failure "DELETE /mcp retornou resposta inesperada"
  echo "$RESPONSE" | jq '.'
fi

# ============================================
# Resumo Final
# ============================================
print_header "Resumo dos Testes"

echo "Total de testes executados: $TOTAL"
echo -e "${GREEN}✅ Testes passados: $PASSED${NC}"
echo -e "${RED}❌ Testes falhados: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}🎉 TODOS OS TESTES PASSARAM!${NC}"
  echo ""
  echo "✅ Servidor MCP HTTP Streamable está funcionando corretamente"
  echo "✅ Autenticação Bearer Token está funcionando"
  echo "✅ Protocolo MCP 2024-11-05 implementado corretamente"
  echo "✅ Todas as ferramentas estão acessíveis via MCP"
  echo ""
  echo "📋 Próximos passos:"
  echo "   1. Configurar no Claude Code (settings.json)"
  echo "   2. Configurar no Gemini CLI (~/.gemini/settings.json)"
  echo "   3. Testar integração com clientes MCP"
  echo ""
  exit 0
else
  echo -e "${RED}⚠️  ALGUNS TESTES FALHARAM${NC}"
  echo ""
  echo "Verifique:"
  echo "  1. Servidor está rodando: curl http://localhost:8825/health"
  echo "  2. AUTH_TOKEN configurado no .env"
  echo "  3. Logs do servidor: pm2 logs vbr-mcp-server"
  echo ""
  exit 1
fi
