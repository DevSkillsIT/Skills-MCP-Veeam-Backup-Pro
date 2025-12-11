#!/bin/bash
# Teste das 3 buscas semânticas implementadas

API_URL="http://localhost:8825/mcp"
AUTH_TOKEN="bf2571ca23445da17a8415e1c8344db6e311adca2bd55d8b544723ad65f604b9"

echo "================================================"
echo "🔍 Veeam MCP - Testes de Busca Semântica"
echo "================================================"
echo ""

# Função auxiliar para chamadas MCP
call_tool() {
    local tool_name="$1"
    local params="$2"
    local description="$3"
    
    echo "📋 $description"
    echo ""
    
    local response=$(curl -s -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $AUTH_TOKEN" \
        -d "{
            \"jsonrpc\": \"2.0\",
            \"method\": \"tools/call\",
            \"params\": {
                \"name\": \"$tool_name\",
                \"arguments\": $params
            },
            \"id\": 1
        }")
    
    # Extrair resultado: .result.content[0].text (que é uma string JSON)
    echo "$response" | jq -r '.result.content[0].text' | jq '{summary, jobsCount: (.jobs | length), jobs: .jobs[:3]}'
}

# Teste 0: Listar jobs para ver quais existem
echo "📋 Teste 0: Listar alguns jobs (baseline)"
echo ""
call_tool "get-backup-jobs" '{"limit": 5}' "Listando primeiros 5 jobs"
echo ""
echo "════════════════════════════════════════════════"
echo ""

# Teste 1: Busca semântica por description (cliente MSP)
echo "📋 Teste 1: Busca Semântica por DESCRIPTION"
echo "   Cenário: Cliente MSP - Gráfica Santo Expedito"
echo "   Busca: 'Grafica' (sem acento)"
echo "   Esperado: Jobs do cliente 'Gráfica Santo Expedito'"
echo ""
call_tool "get-backup-jobs" '{"descriptionFilter": "Grafica", "limit": 10}' "descriptionFilter: Grafica"
echo ""
echo "════════════════════════════════════════════════"
echo ""

# Teste 2: Busca semântica por name
echo "📋 Teste 2: Busca Semântica por NAME"
echo "   Cenário: Nome do job contém 'Santo'"
echo "   Busca: 'Santo'"
echo "   Esperado: Jobs com 'Santo' no nome"
echo ""
call_tool "get-backup-jobs" '{"nameFilter": "Santo", "limit": 10}' "nameFilter: Santo"
echo ""
echo "════════════════════════════════════════════════"
echo ""

# Teste 3: Busca combinada (description + name)
echo "📋 Teste 3: Busca COMBINADA (descriptionFilter + nameFilter)"
echo "   Busca: descriptionFilter='Grafica' + nameFilter='Local'"
echo "   Esperado: Jobs do cliente Gráfica com 'Local' no nome"
echo ""
call_tool "get-backup-jobs" '{"descriptionFilter": "Grafica", "nameFilter": "Local", "limit": 10}' "Busca combinada"
echo ""
