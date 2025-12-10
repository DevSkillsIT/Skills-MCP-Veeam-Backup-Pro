#!/bin/bash
# test-all-tools.sh - Testa todas as 15 ferramentas MCP individualmente
# Skills IT - Dezembro 2025

echo "🧪 Testando as 15 ferramentas do Veeam Backup MCP"
echo "================================================"
echo ""

TOKEN="bf2571ca23445da17a8415e1c8344db6e311adca2bd55d8b544723ad65f604b9"
ENDPOINT="http://localhost:8825/mcp"

# Contador de resultados
PASSED=0
FAILED=0

# Função para testar uma tool
test_tool() {
    local tool_name="$1"
    local args="$2"

    echo -n "Testing $tool_name... "

    response=$(curl -s -X POST "$ENDPOINT" \
        -H 'Content-Type: application/json' \
        -H "Authorization: Bearer $TOKEN" \
        -d "{\"jsonrpc\":\"2.0\",\"method\":\"tools/call\",\"params\":{\"name\":\"$tool_name\",\"arguments\":$args},\"id\":1}")

    if echo "$response" | jq -e '.result' > /dev/null 2>&1; then
        echo "✅ PASS"
        ((PASSED++))
    else
        echo "❌ FAIL"
        echo "   Error: $(echo "$response" | jq -r '.error.message')"
        ((FAILED++))
    fi
}

# Tools de leitura (GET) - sem parâmetros ou com limit
echo "📖 GET Tools (leitura de dados):"
test_tool "get-server-info" "{}"
test_tool "get-license-info" "{}"
test_tool "get-backup-jobs" '{"limit":2}'
test_tool "get-backup-sessions" '{"limit":2}'
test_tool "get-backup-proxies" '{"limit":2}'
test_tool "get-backup-repositories" '{"limit":2}'
test_tool "get-running-sessions" '{"limit":2}'
test_tool "get-failed-sessions" '{"limit":2,"hours":24}'
test_tool "get-backup-copy-jobs" '{"limit":2}'
test_tool "get-restore-points" '{"limit":2}'

echo ""
echo "🔍 Tools de consulta detalhada (requerem IDs):"
echo "⚠️  Pulando get-job-details, get-job-schedule, get-session-log (requerem IDs válidos)"

echo ""
echo "⚙️  Tools de ação (START/STOP):"
echo "⚠️  Pulando start-backup-job e stop-backup-job (requerem confirmação e alteram estado)"

echo ""
echo "================================================"
echo "📊 Resultados:"
echo "   ✅ Passaram: $PASSED"
echo "   ❌ Falharam: $FAILED"
echo "   📝 Puladas: 5 (requerem IDs ou alteram estado)"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "🎉 Todas as tools testadas funcionaram!"
    exit 0
else
    echo "⚠️  Algumas tools falharam. Verificar logs acima."
    exit 1
fi
