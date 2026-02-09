# Quick Test Reference - Safety Guard

**Teste rápido de funcionalidade do Safety Guard**

---

## 1️⃣ Verificar Status do SafetyGuard

```bash
# Ver logs de inicialização
pm2 logs mcp-veeam --lines 30 | grep SafetyGuard

# Esperado (se habilitado):
# [SafetyGuard] ✅ HABILITADO - Operações críticas exigem confirmação

# Ou (se desabilitado):
# [SafetyGuard] ⚠️  DESABILITADO - Operações críticas não exigem confirmação
```

---

## 2️⃣ Teste A: SafetyGuard DESABILITADO

```bash
# Verificar configuração
grep "MCP_SAFETY_GUARD" /opt/mcp-servers/veeam-backup/.env
# Resultado esperado: MCP_SAFETY_GUARD=false

# Chamar veeam_start_backup_job SEM confirmação
curl -X POST http://localhost:8825/tools/call \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_AUTH_TOKEN' \
  -d '{
    "name": "veeam_start_backup_job",
    "arguments": {
      "jobId": "urn:veeam:Job:VALID-JOB-ID",
      "fullBackup": false
    }
  }'

# Resultado esperado: ✅ Job inicia sem pedir confirmação
```

---

## 3️⃣ Teste B: SafetyGuard HABILITADO - SEM Confirmação

```bash
# Ativar Safety Guard
echo "MCP_SAFETY_GUARD=true" >> /opt/mcp-servers/veeam-backup/.env
echo "MCP_SAFETY_TOKEN=test-token-12345678" >> /opt/mcp-servers/veeam-backup/.env

# Reiniciar MCP
pm2 restart mcp-veeam

# Aguardar 2 segundos
sleep 2

# Chamar veeam_start_backup_job SEM confirmação (deve falhar)
curl -X POST http://localhost:8825/tools/call \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_AUTH_TOKEN' \
  -d '{
    "name": "veeam_start_backup_job",
    "arguments": {
      "jobId": "urn:veeam:Job:VALID-JOB-ID",
      "fullBackup": false
    }
  }'

# Resultado esperado: ❌ Erro 403 ou mensagem:
# "SAFETY GUARD: Operação veeam_start_backup_job requer confirmação explícita"
```

---

## 4️⃣ Teste C: SafetyGuard HABILITADO - COM Confirmação

```bash
# Chamar veeam_start_backup_job COM confirmação válida
curl -X POST http://localhost:8825/tools/call \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_AUTH_TOKEN' \
  -d '{
    "name": "veeam_start_backup_job",
    "arguments": {
      "jobId": "urn:veeam:Job:VALID-JOB-ID",
      "fullBackup": false,
      "confirmationToken": "test-token-12345678",
      "reason": "Teste de Safety Guard funcionando corretamente com token e reason"
    }
  }'

# Resultado esperado: ✅ Job inicia com sucesso
# Verificar que aparece em audit.log
```

---

## 5️⃣ Teste D: Token INVÁLIDO

```bash
# Chamar com token errado (deve falhar)
curl -X POST http://localhost:8825/tools/call \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_AUTH_TOKEN' \
  -d '{
    "name": "veeam_start_backup_job",
    "arguments": {
      "jobId": "urn:veeam:Job:VALID-JOB-ID",
      "fullBackup": false,
      "confirmationToken": "token-errado-aqui",
      "reason": "Teste com token inválido para verificar rejeição"
    }
  }'

# Resultado esperado: ❌ Erro
# "SAFETY GUARD: Token de confirmação inválido"
# Verificar console: [SafetyGuard] ⚠️ Tentativa de operação... com token INVÁLIDO
```

---

## 6️⃣ Teste E: Reason Muito Curto

```bash
# Chamar com reason < 10 caracteres (deve falhar)
curl -X POST http://localhost:8825/tools/call \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_AUTH_TOKEN' \
  -d '{
    "name": "veeam_start_backup_job",
    "arguments": {
      "jobId": "urn:veeam:Job:VALID-JOB-ID",
      "fullBackup": false,
      "confirmationToken": "test-token-12345678",
      "reason": "teste"
    }
  }'

# Resultado esperado: ❌ Erro
# "SAFETY GUARD: Justificativa obrigatória"
# "A justificativa (reason) deve ter pelo menos 10 caracteres"
# "Atual: 5 caracteres"
```

---

## 7️⃣ Verificar Audit Log

```bash
# Ver últimas 10 operações autorizadas
tail -10 /opt/mcp-servers/veeam-backup/logs/audit.log | jq

# Filtrar por operação específica
grep "safety-guard-authorized" /opt/mcp-servers/veeam-backup/logs/audit.log | jq

# Ver apenas reasons
grep "safety-guard-authorized" /opt/mcp-servers/veeam-backup/logs/audit.log | \
  jq -r '.metadata.reason'

# Contar operações
grep "safety-guard-authorized" /opt/mcp-servers/veeam-backup/logs/audit.log | wc -l
```

---

## 8️⃣ Teste F: Stop Job (Operação Crítica Protegida)

```bash
# Testar que veeam_stop_backup_job também é protegido
curl -X POST http://localhost:8825/tools/call \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_AUTH_TOKEN' \
  -d '{
    "name": "veeam_stop_backup_job",
    "arguments": {
      "jobId": "urn:veeam:Job:VALID-JOB-ID-RUNNING"
    }
  }'

# Resultado esperado (com Safety Guard ON): ❌ Erro de confirmação
# Depois repetir COM confirmationToken + reason → ✅ Job para
```

---

## 🔧 Troubleshooting Rápido

### Problema: "ERRO DE CONFIGURAÇÃO: MCP_SAFETY_TOKEN não está definido"

```bash
# Solução: Gerar e configurar token
openssl rand -hex 32

# Copiar token gerado para .env
echo "MCP_SAFETY_TOKEN=COLA_TOKEN_GERADO_AQUI" >> .env

# Reiniciar
pm2 restart mcp-veeam
```

### Problema: "Token de confirmação inválido"

```bash
# Verificar token configurado
grep "MCP_SAFETY_TOKEN" /opt/mcp-servers/veeam-backup/.env

# Comparar com token usado na requisição
# DEVEM ser EXATAMENTE iguais (case-sensitive)
```

### Problema: Tools funcionam SEM pedir confirmação (Safety Guard ignorado)

```bash
# Verificar valor de MCP_SAFETY_GUARD
grep "MCP_SAFETY_GUARD" /opt/mcp-servers/veeam-backup/.env

# Deve ser EXATAMENTE: MCP_SAFETY_GUARD=true (case-sensitive)
# Restartar MCP
pm2 restart mcp-veeam
```

---

## ✅ Checklist de Verificação

- [ ] SafetyGuard inicializa corretamente (verificar logs)
- [ ] Teste A: Desabilitado - sem confirmação funciona
- [ ] Teste B: Habilitado - sem confirmação falha com erro
- [ ] Teste C: Habilitado - com confirmação funciona
- [ ] Teste D: Token inválido é rejeitado
- [ ] Teste E: Reason curto é rejeitado
- [ ] Teste F: Stop job também é protegido
- [ ] Audit log registra operações autorizadas
- [ ] Mensagens de erro são em português-BR
- [ ] Documentação está acessível (SAFETY_GUARD.md)

---

## 📝 Notas Importantes

1. **MCP_SAFETY_GUARD=true/false é uma STRING, não boolean**
   - Correto: `MCP_SAFETY_GUARD=true`
   - Errado: `MCP_SAFETY_GUARD=1` ou `true` sem aspas

2. **Token deve ter mínimo 8 caracteres**
   - Recomendado: 16+ caracteres
   - Gerado com: `openssl rand -hex 32` (64 caracteres)

3. **Reason deve ter mínimo 10 caracteres**
   - Espaços em branco não contam
   - Exemplo válido: "Backup emergencial solicitado pelo cliente"

4. **Audit log é JSON, 1 linha por operação**
   - Pode ser parseado com: `jq`
   - Deve ser monitorado para conformidade

5. **Timing-safe comparison previne timing attacks**
   - Implementado com: `crypto.timingSafeEqual()`
   - Tempo de comparação é idêntico para token correto/errado

---

**Última atualização:** 2025-12-10
**Versão:** 1.0.0

