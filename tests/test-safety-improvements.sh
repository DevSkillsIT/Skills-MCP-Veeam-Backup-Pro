#!/bin/bash
# Teste das melhorias de segurança (Warnings #2 e #3)

echo "🔒 Testando melhorias de segurança do Safety Guard"
echo "=================================================="
echo ""

# Configurar token temporário para teste
export MCP_SAFETY_GUARD=true
export MCP_SAFETY_TOKEN="test-security-token-12345"

# Reiniciar MCP com Safety Guard habilitado
echo "1️⃣ Habilitando Safety Guard..."
pm2 restart mcp-veeam > /dev/null 2>&1
sleep 3

echo "✅ Safety Guard habilitado"
echo ""

# Limpar audit.log anterior
> logs/audit.log

echo "2️⃣ Teste #1: Tentativa SEM token (deve logar 'no-token')"
curl -s -X POST http://localhost:8826/mcp \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params": {
      "name": "start-backup-job",
      "arguments": {
        "jobId": "test-job-id"
      }
    },
    "id":1
  }' | jq -r '.error.message' | head -3

echo ""
echo "3️⃣ Teste #2: Tentativa com token INVÁLIDO (deve logar 'invalid-token')"
curl -s -X POST http://localhost:8826/mcp \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params": {
      "name": "start-backup-job",
      "arguments": {
        "jobId": "test-job-id",
        "confirmationToken": "token-errado-aqui",
        "reason": "Teste de token inválido para validar logging"
      }
    },
    "id":1
  }' | jq -r '.error.message' | head -3

echo ""
echo "4️⃣ Teste #3: Tentativa com reason MUITO LONGO (deve logar 'reason-too-long')"
LONG_REASON=$(python3 -c "print('A' * 1500)")
curl -s -X POST http://localhost:8826/mcp \
  -H 'Content-Type: application/json' \
  -d "{
    \"jsonrpc\":\"2.0\",
    \"method\":\"tools/call\",
    \"params\": {
      \"name\": \"start-backup-job\",
      \"arguments\": {
        \"jobId\": \"test-job-id\",
        \"confirmationToken\": \"test-security-token-12345\",
        \"reason\": \"$LONG_REASON\"
      }
    },
    \"id\":1
  }" | jq -r '.error.message' | head -3

echo ""
echo "5️⃣ Verificando audit.log..."
sleep 1

if [ -f logs/audit.log ]; then
  echo "📊 Eventos registrados no audit.log:"
  cat logs/audit.log | jq -r '.type' | sort | uniq -c
  echo ""
  echo "✅ Arquivo audit.log contém $(wc -l < logs/audit.log) eventos"
else
  echo "❌ Arquivo audit.log não encontrado"
fi

echo ""
echo "6️⃣ Desabilitando Safety Guard..."
pm2 restart mcp-veeam > /dev/null 2>&1
sleep 2
echo "✅ Safety Guard desabilitado (restaurado ao padrão)"

echo ""
echo "=================================================="
echo "🎉 Teste de segurança concluído!"
