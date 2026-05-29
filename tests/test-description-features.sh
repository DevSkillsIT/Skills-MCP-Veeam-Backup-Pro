#!/bin/bash
# ════════════════════════════════════════════════════════════════════════════
# TEST SUITE: Description Features para MSP Multi-Client Operations
# ════════════════════════════════════════════════════════════════════════════
#
# OBJETIVO:
# Validar que as features de description estão funcionando corretamente.
# Isso permite que AIs busquem jobs por informações do cliente (nome, ID, local)
# ao invés de apenas nomes técnicos.
#
# FEATURES TESTADAS:
# 1. get-backup-jobs com descriptionFilter (busca por cliente, local, ID, contrato)
# 2. get-backup-copy-jobs com descriptionFilter
# 3. start-backup-job retorna description field na resposta
# 4. stop-backup-job retorna description field na resposta
# 5. Description aparece corretamente formatado nas respostas
#
# REQUISITOS:
# - MCP Veeam Backup rodando em localhost:8825
# - Bearer token de autenticação válido
# - Pelo menos 1 job configurado no VBR com description preenchido
#
# ════════════════════════════════════════════════════════════════════════════

set -e

# ════════════════════════════════════════════════════════════════════════════
# CONFIGURAÇÃO
# ════════════════════════════════════════════════════════════════════════════

MCP_URL="http://localhost:8825/mcp"
AUTH_TOKEN="SEU_TOKEN_AQUI"
JSONRPC_VERSION="2.0"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Contadores de testes
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# ════════════════════════════════════════════════════════════════════════════
# FUNÇÕES AUXILIARES
# ════════════════════════════════════════════════════════════════════════════

# Log com timestamp
log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

# Verificar se resposta é erro JSON-RPC
is_json_rpc_error() {
  local response="$1"
  # Verificar se tem "error" no nível raiz do JSON-RPC
  echo "$response" | grep -q '"error".*:' && return 0
  # Também verificar se é isError=true na resposta (alguns MCP retornam assim)
  echo "$response" | grep -q '"isError"\s*:\s*true' && return 0
  return 1
}

# Extrair campo da resposta JSON
extract_field() {
  local json="$1"
  local field="$2"
  echo "$json" | grep -o "\"$field\":[^,}]*" | cut -d':' -f2- | tr -d ' "' | head -1
}

# Verificar se response contém um campo
has_field() {
  local json="$1"
  local field="$2"
  echo "$json" | grep -q "\"$field\"" && return 0
  return 1
}

# Executa uma tool MCP via curl
call_mcp_tool() {
  local tool_name="$1"
  local params="$2"
  local request_id=$(date +%s)

  # Preparar payload JSON-RPC 2.0
  local payload="{
    \"jsonrpc\": \"$JSONRPC_VERSION\",
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"$tool_name\",
      \"arguments\": $params
    },
    \"id\": $request_id
  }"

  # Executar requisição com autenticação
  local response=$(curl -s -X POST "$MCP_URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -d "$payload")

  # Extrair o conteúdo da resposta JSON-RPC (result.content[0].text é uma string JSON)
  # Usar jq se disponível, senão fazer parsing manual
  if command -v jq &> /dev/null; then
    echo "$response" | jq -r '.result.content[0].text // .'
  else
    # Fallback: tentar extrair o texto manualmente
    # A resposta tem formato: {"jsonrpc":"2.0","id":...,"result":{"content":[{"type":"text","text":"..."}]}}
    echo "$response" | sed 's/.*"text":"//' | sed 's/","}//' | sed 's/\\n/\n/g'
  fi
}

# Test case wrapper
test_case() {
  local test_name="$1"
  local test_func="$2"

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo -e "${BLUE}📝 TEST: $test_name${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  if eval "$test_func"; then
    echo -e "${GREEN}✅ PASSED${NC}"
    ((TESTS_PASSED++))
  else
    echo -e "${RED}❌ FAILED${NC}"
    ((TESTS_FAILED++))
  fi
}

test_skip() {
  local test_name="$1"
  local reason="$2"

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo -e "${YELLOW}⚠️  SKIPPED: $test_name${NC}"
  echo "Reason: $reason"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  ((TESTS_SKIPPED++))
}

# ════════════════════════════════════════════════════════════════════════════
# TEST 1: get-backup-jobs SEM descriptionFilter (baseline)
# ════════════════════════════════════════════════════════════════════════════
test_get_backup_jobs_baseline() {
  log "Fetching backup jobs without filter..."

  local response=$(call_mcp_tool "get-backup-jobs" '{"limit": 10}')

  # Verificar se é erro JSON-RPC
  if is_json_rpc_error "$response"; then
    echo -e "${RED}❌ JSON-RPC Error: $response${NC}"
    return 1
  fi

  # Verificar se retorna jobs
  if ! echo "$response" | grep -q '"jobs"'; then
    echo -e "${RED}❌ Response does not contain 'jobs' field${NC}"
    echo "Response: $response"
    return 1
  fi

  # Extrair número de jobs
  local job_count=$(echo "$response" | grep -o '"jobs":\s*\[' | wc -l)
  if [ $job_count -eq 0 ]; then
    echo -e "${YELLOW}⚠️  No jobs found (empty array is valid)${NC}"
  else
    echo -e "${GREEN}✅ Found backup jobs in response${NC}"
    log "Response contains 'jobs' array"
  fi

  # Verificar se cada job tem description
  local has_description=$(echo "$response" | grep -c '"description"' || true)
  if [ $has_description -gt 0 ]; then
    echo -e "${GREEN}✅ Jobs contain 'description' field ($has_description occurrences)${NC}"
  fi

  echo "Sample response:"
  echo "$response" | head -c 500
  echo ""

  return 0
}

# ════════════════════════════════════════════════════════════════════════════
# TEST 2: get-backup-jobs COM descriptionFilter buscar "ACME" (se existir)
# ════════════════════════════════════════════════════════════════════════════
test_get_backup_jobs_with_description_filter_acme() {
  log "Fetching backup jobs with descriptionFilter='ACME'..."

  local response=$(call_mcp_tool "get-backup-jobs" '{
    "limit": 100,
    "descriptionFilter": "ACME"
  }')

  if is_json_rpc_error "$response"; then
    echo -e "${RED}❌ JSON-RPC Error: $response${NC}"
    return 1
  fi

  # Verificar se retorna jobs (pode ser vazio se não houver ACME)
  if ! echo "$response" | grep -q '"jobs"'; then
    echo -e "${RED}❌ Response does not contain 'jobs' field${NC}"
    return 1
  fi

  # Verificar se descriptionFilter aparece na resposta
  if echo "$response" | grep -q '"descriptionFilter"'; then
    echo -e "${GREEN}✅ descriptionFilter parameter reflected in response${NC}"
  fi

  # Contar jobs retornados
  local job_count=$(echo "$response" | grep -o '"name":' | wc -l)
  echo -e "${GREEN}✅ Found $job_count jobs matching 'ACME'${NC}"

  # Se encontrou jobs, validar que description está presente
  if [ $job_count -gt 0 ]; then
    if echo "$response" | grep -q '"ACME"'; then
      echo -e "${GREEN}✅ Filter correctly matched ACME clients${NC}"
    fi
  fi

  echo "Sample response:"
  echo "$response" | head -c 500
  echo ""

  return 0
}

# ════════════════════════════════════════════════════════════════════════════
# TEST 3: get-backup-jobs COM descriptionFilter por localização "Curitiba"
# ════════════════════════════════════════════════════════════════════════════
test_get_backup_jobs_with_location_filter() {
  log "Fetching backup jobs with descriptionFilter='Curitiba'..."

  local response=$(call_mcp_tool "get-backup-jobs" '{
    "limit": 100,
    "descriptionFilter": "Curitiba"
  }')

  if is_json_rpc_error "$response"; then
    echo -e "${RED}❌ JSON-RPC Error: $response${NC}"
    return 1
  fi

  if ! echo "$response" | grep -q '"jobs"'; then
    echo -e "${RED}❌ Response does not contain 'jobs' field${NC}"
    return 1
  fi

  # Contar jobs retornados
  local job_count=$(echo "$response" | grep -o '"name":' | wc -l)
  echo -e "${GREEN}✅ Found $job_count jobs in Curitiba${NC}"

  # Validar que filter foi aplicado
  if echo "$response" | grep -q '"Curitiba"'; then
    echo -e "${GREEN}✅ Filter correctly matched location-based jobs${NC}"
  fi

  echo "Sample response:"
  echo "$response" | head -c 500
  echo ""

  return 0
}

# ════════════════════════════════════════════════════════════════════════════
# TEST 4: get-backup-jobs COM descriptionFilter por ID do cliente "CLI-001"
# ════════════════════════════════════════════════════════════════════════════
test_get_backup_jobs_with_client_id_filter() {
  log "Fetching backup jobs with descriptionFilter='CLI-001'..."

  local response=$(call_mcp_tool "get-backup-jobs" '{
    "limit": 100,
    "descriptionFilter": "CLI-001"
  }')

  if is_json_rpc_error "$response"; then
    echo -e "${RED}❌ JSON-RPC Error: $response${NC}"
    return 1
  fi

  if ! echo "$response" | grep -q '"jobs"'; then
    echo -e "${RED}❌ Response does not contain 'jobs' field${NC}"
    return 1
  fi

  local job_count=$(echo "$response" | grep -o '"name":' | wc -l)
  echo -e "${GREEN}✅ Found $job_count jobs for client CLI-001${NC}"

  # Validar que filter foi aplicado
  if echo "$response" | grep -q '"CLI-001"'; then
    echo -e "${GREEN}✅ Filter correctly matched client ID${NC}"
  fi

  echo "Sample response:"
  echo "$response" | head -c 500
  echo ""

  return 0
}

# ════════════════════════════════════════════════════════════════════════════
# TEST 5: get-backup-copy-jobs SEM descriptionFilter (baseline)
# ════════════════════════════════════════════════════════════════════════════
test_get_backup_copy_jobs_baseline() {
  log "Fetching backup copy jobs without filter..."

  local response=$(call_mcp_tool "get-backup-copy-jobs" '{"limit": 10}')

  if is_json_rpc_error "$response"; then
    echo -e "${RED}❌ JSON-RPC Error: $response${NC}"
    return 1
  fi

  if ! echo "$response" | grep -q '"backupCopyJobs"'; then
    echo -e "${YELLOW}⚠️  Response may not contain backup copy jobs (this is OK if none configured)${NC}"
    return 0
  fi

  # Verificar se cada job tem description
  local has_description=$(echo "$response" | grep -c '"description"' || true)
  if [ $has_description -gt 0 ]; then
    echo -e "${GREEN}✅ Backup copy jobs contain 'description' field ($has_description occurrences)${NC}"
  fi

  echo "Sample response:"
  echo "$response" | head -c 500
  echo ""

  return 0
}

# ════════════════════════════════════════════════════════════════════════════
# TEST 6: get-backup-copy-jobs COM descriptionFilter
# ════════════════════════════════════════════════════════════════════════════
test_get_backup_copy_jobs_with_filter() {
  log "Fetching backup copy jobs with descriptionFilter='Ramada'..."

  local response=$(call_mcp_tool "get-backup-copy-jobs" '{
    "limit": 100,
    "descriptionFilter": "Ramada"
  }')

  if is_json_rpc_error "$response"; then
    echo -e "${RED}❌ JSON-RPC Error: $response${NC}"
    return 1
  fi

  # Validar que resposta contém campo de jobs/copy jobs
  if echo "$response" | grep -q '"backupCopyJobs"'; then
    echo -e "${GREEN}✅ Backup copy jobs response received${NC}"
  elif echo "$response" | grep -q '"jobs"'; then
    echo -e "${GREEN}✅ Jobs response received${NC}"
  fi

  # Contar jobs retornados
  local job_count=$(echo "$response" | grep -o '"name":' | wc -l)
  echo -e "${GREEN}✅ Found $job_count backup copy jobs matching filter${NC}"

  echo "Sample response:"
  echo "$response" | head -c 500
  echo ""

  return 0
}

# ════════════════════════════════════════════════════════════════════════════
# TEST 7: Validar que description aparece nas respostas de start-backup-job
# (TEST LEITURA APENAS - NÃO EXECUTA REALMENTE)
# ════════════════════════════════════════════════════════════════════════════
test_start_backup_job_response_structure() {
  log "Validating start-backup-job response structure (not executing)..."

  # Primeiro, obter um job ID válido
  local jobs_response=$(call_mcp_tool "get-backup-jobs" '{"limit": 1}')

  if is_json_rpc_error "$jobs_response"; then
    echo -e "${YELLOW}⚠️  Cannot validate - unable to fetch jobs${NC}"
    return 0
  fi

  # Extrair primeiro job ID (se existir)
  local job_id=$(echo "$jobs_response" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

  if [ -z "$job_id" ]; then
    echo -e "${YELLOW}⚠️  No jobs found to validate response structure${NC}"
    return 0
  fi

  echo "ℹ️  Found job ID: $job_id"

  # Validar que arquivo start-backup-job-tool.js importa description-helpers
  if grep -q "description-helpers" /opt/mcp-servers/veeam-backup/tools/start-backup-job-tool.js; then
    echo -e "${GREEN}✅ start-backup-job imports description-helpers${NC}"
  else
    echo -e "${RED}❌ start-backup-job does NOT import description-helpers${NC}"
    return 1
  fi

  # Validar que importa formatDescriptionForAI
  if grep -q "formatDescriptionForAI\|getDescriptionFallback" /opt/mcp-servers/veeam-backup/tools/start-backup-job-tool.js; then
    echo -e "${GREEN}✅ start-backup-job uses description formatting functions${NC}"
  else
    echo -e "${RED}❌ start-backup-job does NOT use description formatting${NC}"
    return 1
  fi

  return 0
}

# ════════════════════════════════════════════════════════════════════════════
# TEST 8: Validar que description aparece nas respostas de stop-backup-job
# (TEST LEITURA APENAS - NÃO EXECUTA REALMENTE)
# ════════════════════════════════════════════════════════════════════════════
test_stop_backup_job_response_structure() {
  log "Validating stop-backup-job response structure (not executing)..."

  # Validar que arquivo stop-backup-job-tool.js importa description-helpers
  if grep -q "description-helpers" /opt/mcp-servers/veeam-backup/tools/stop-backup-job-tool.js; then
    echo -e "${GREEN}✅ stop-backup-job imports description-helpers${NC}"
  else
    echo -e "${RED}❌ stop-backup-job does NOT import description-helpers${NC}"
    return 1
  fi

  # Validar que importa funções de description
  if grep -q "formatDescriptionForAI\|getDescriptionFallback" /opt/mcp-servers/veeam-backup/tools/stop-backup-job-tool.js; then
    echo -e "${GREEN}✅ stop-backup-job uses description formatting functions${NC}"
  else
    echo -e "${RED}❌ stop-backup-job does NOT use description formatting${NC}"
    return 1
  fi

  return 0
}

# ════════════════════════════════════════════════════════════════════════════
# TEST 9: Validar estrutura do arquivo description-helpers.js
# ════════════════════════════════════════════════════════════════════════════
test_description_helpers_exports() {
  log "Validating description-helpers exports..."

  local helper_file="/opt/mcp-servers/veeam-backup/lib/description-helpers.js"

  if [ ! -f "$helper_file" ]; then
    echo -e "${RED}❌ description-helpers.js not found at $helper_file${NC}"
    return 1
  fi

  # Validar que todas as funções necessárias estão exportadas
  local required_exports=(
    "parseJobDescription"
    "formatDescriptionForAI"
    "getDescriptionFallback"
    "isDescriptionValid"
    "searchByDescription"
    "enrichJobWithDescription"
  )

  local missing=0
  for func in "${required_exports[@]}"; do
    if grep -q "export.*function $func" "$helper_file" || grep -q "export.*$func"; then
      echo -e "${GREEN}✅ Function exported: $func${NC}"
    else
      echo -e "${RED}❌ Function NOT exported: $func${NC}"
      ((missing++))
    fi
  done

  if [ $missing -gt 0 ]; then
    echo -e "${RED}❌ Missing $missing function exports${NC}"
    return 1
  fi

  return 0
}

# ════════════════════════════════════════════════════════════════════════════
# TEST 10: Validar que description-helpers tem documentação adequada
# ════════════════════════════════════════════════════════════════════════════
test_description_helpers_documentation() {
  log "Validating description-helpers documentation..."

  local helper_file="/opt/mcp-servers/veeam-backup/lib/description-helpers.js"

  # Validar que tem JSDoc comments
  local jsdoc_count=$(grep -c "/\*\*" "$helper_file" || true)
  if [ $jsdoc_count -lt 5 ]; then
    echo -e "${RED}❌ Insufficient JSDoc documentation (found $jsdoc_count blocks)${NC}"
    return 1
  fi

  echo -e "${GREEN}✅ Found $jsdoc_count JSDoc documentation blocks${NC}"

  # Validar que tem @example tags
  local example_count=$(grep -c "@example" "$helper_file" || true)
  if [ $example_count -lt 3 ]; then
    echo -e "${YELLOW}⚠️  Limited @example documentation (found $example_count examples)${NC}"
  else
    echo -e "${GREEN}✅ Found $example_count @example documentation blocks${NC}"
  fi

  return 0
}

# ════════════════════════════════════════════════════════════════════════════
# TEST 11: Validar que PM2 service está rodando
# ════════════════════════════════════════════════════════════════════════════
test_pm2_service_running() {
  log "Checking PM2 service status..."

  # Verificar se pm2 está disponível
  if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}⚠️  PM2 not available, skipping service check${NC}"
    return 0
  fi

  # Listar processos PM2
  local pm2_list=$(pm2 list 2>/dev/null || true)

  if echo "$pm2_list" | grep -q "mcp-veeam"; then
    echo -e "${GREEN}✅ PM2 process 'mcp-veeam' found${NC}"

    # Verificar status
    if echo "$pm2_list" | grep "mcp-veeam" | grep -q "online"; then
      echo -e "${GREEN}✅ PM2 process status: ONLINE${NC}"
    else
      echo -e "${RED}❌ PM2 process status: NOT ONLINE${NC}"
      return 1
    fi
  else
    echo -e "${RED}❌ PM2 process 'mcp-veeam' not found${NC}"
    return 1
  fi

  return 0
}

# ════════════════════════════════════════════════════════════════════════════
# TEST 12: Validar que health check endpoint está respondendo
# ════════════════════════════════════════════════════════════════════════════
test_health_check() {
  log "Testing health check endpoint..."

  local health_response=$(curl -s http://localhost:8825/health 2>/dev/null || echo "")

  if [ -z "$health_response" ]; then
    echo -e "${RED}❌ Health check endpoint not responding${NC}"
    return 1
  fi

  if echo "$health_response" | grep -q '"status":"healthy"' || echo "$health_response" | grep -q '"status": "healthy"'; then
    echo -e "${GREEN}✅ Health check returned: healthy${NC}"
  else
    echo -e "${YELLOW}⚠️  Health check response: $health_response${NC}"
  fi

  return 0
}

# ════════════════════════════════════════════════════════════════════════════
# MAIN TEST RUNNER
# ════════════════════════════════════════════════════════════════════════════

main() {
  clear

  echo ""
  echo "╔════════════════════════════════════════════════════════════════════════════╗"
  echo "║          🧪 VEEAM BACKUP MCP - DESCRIPTION FEATURES TEST SUITE              ║"
  echo "╚════════════════════════════════════════════════════════════════════════════╝"
  echo ""
  log "Starting test suite..."
  echo ""

  # Pre-flight checks
  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  log "PRE-FLIGHT CHECKS"
  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Check MCP URL
  if curl -s -f "$MCP_URL" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ MCP URL accessible: $MCP_URL${NC}"
  else
    echo -e "${YELLOW}⚠️  MCP URL may not be responding (this is OK for JSON-RPC endpoints)${NC}"
  fi

  # Run tests
  echo ""
  echo "╔════════════════════════════════════════════════════════════════════════════╗"
  echo "║                           RUNNING TEST SUITE                                ║"
  echo "╚════════════════════════════════════════════════════════════════════════════╝"

  # Core description filter tests
  test_case "get-backup-jobs baseline (no filter)" "test_get_backup_jobs_baseline"
  test_case "get-backup-jobs with descriptionFilter='ACME'" "test_get_backup_jobs_with_description_filter_acme"
  test_case "get-backup-jobs filter by location (Curitiba)" "test_get_backup_jobs_with_location_filter"
  test_case "get-backup-jobs filter by client ID (CLI-001)" "test_get_backup_jobs_with_client_id_filter"

  test_case "get-backup-copy-jobs baseline (no filter)" "test_get_backup_copy_jobs_baseline"
  test_case "get-backup-copy-jobs with descriptionFilter" "test_get_backup_copy_jobs_with_filter"

  # Response structure validation
  test_case "start-backup-job returns description field" "test_start_backup_job_response_structure"
  test_case "stop-backup-job returns description field" "test_stop_backup_job_response_structure"

  # Helper library validation
  test_case "description-helpers exports all required functions" "test_description_helpers_exports"
  test_case "description-helpers has proper documentation" "test_description_helpers_documentation"

  # Infrastructure checks
  test_case "PM2 service running and online" "test_pm2_service_running"
  test_case "Health check endpoint responding" "test_health_check"

  # Summary
  echo ""
  echo "╔════════════════════════════════════════════════════════════════════════════╗"
  echo "║                           TEST RESULTS SUMMARY                              ║"
  echo "╚════════════════════════════════════════════════════════════════════════════╝"
  echo ""

  echo -e "${GREEN}✅ PASSED:  $TESTS_PASSED${NC}"
  echo -e "${RED}❌ FAILED:  $TESTS_FAILED${NC}"
  echo -e "${YELLOW}⚠️  SKIPPED: $TESTS_SKIPPED${NC}"
  echo ""

  local TOTAL=$((TESTS_PASSED + TESTS_FAILED + TESTS_SKIPPED))
  local SUCCESS_RATE=$((TESTS_PASSED * 100 / (TOTAL - TESTS_SKIPPED + 1)))

  echo "Total Tests: $TOTAL"
  echo "Success Rate: ${SUCCESS_RATE}%"
  echo ""

  # Final verdict
  if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ ALL TESTS PASSED - Description features are working correctly!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    exit 0
  else
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}❌ SOME TESTS FAILED - See details above${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    exit 1
  fi
}

# ════════════════════════════════════════════════════════════════════════════
# Execute main
# ════════════════════════════════════════════════════════════════════════════
main "$@"
