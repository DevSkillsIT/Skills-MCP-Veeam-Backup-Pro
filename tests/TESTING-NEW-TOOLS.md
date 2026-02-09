# Testing - 9 Novas Tools do MCP Veeam Backup

**Autor:** Adriano Fante - Skills IT
**Data:** 2025-12-09
**MCP:** Veeam Backup & Replication
**Porta:** 8825 (HTTP mode)

---

## Pré-requisitos

1. **MCP rodando:**
   ```bash
   pm2 list | grep veeam
   # Deve mostrar processo ativo
   ```

2. **Credenciais configuradas:**
   ```bash
   cat /opt/mcp-servers/veeam-backup/.env | grep VEEAM_
   # Verificar VEEAM_HOST, VEEAM_USERNAME, VEEAM_PASSWORD
   ```

3. **Servidor VBR acessível:**
   ```bash
   curl -k https://VEEAM_HOST:9419/api/oauth2/token
   # Deve retornar 405 Method Not Allowed (endpoint existe)
   ```

---

## BLOCO 1: Quick Wins (3 tools GET simples)

### 1. veeam_list_running_sessions

**Propósito:** Listar apenas sessions em execução (real-time monitoring)

**Teste 1 - Health Check:**
```bash
curl http://localhost:8825/health
```

**Teste 2 - Listar sessions em execução:**
```bash
curl -X POST http://localhost:8825/veeam_list_running_sessions \
  -H 'Content-Type: application/json' \
  -d '{"limit": 50}'
```

**Resultado esperado:**
- Se houver sessions rodando: lista com progresso médio e tempo estimado
- Se não houver: mensagem informativa com possíveis razões
- Campos: `summary`, `statistics`, `sessions` com `progressFormatted`

---

### 2. veeam_list_failed_sessions

**Propósito:** Listar sessions que falharam (morning checklist MSP)

**Teste 1 - Últimas 24 horas (padrão):**
```bash
curl -X POST http://localhost:8825/veeam_list_failed_sessions \
  -H 'Content-Type: application/json' \
  -d '{"limit": 100}'
```

**Teste 2 - Últimas 48 horas:**
```bash
curl -X POST http://localhost:8825/veeam_list_failed_sessions \
  -H 'Content-Type: application/json' \
  -d '{"limit": 100, "hours": 48}'
```

**Resultado esperado:**
- Se houver falhas: análise com top erros, agrupamento por tipo
- Se não houver: mensagem positiva de compliance
- Campos: `summary`, `analysis.topErrors`, `analysis.byType`

---

### 3. veeam_list_backup_copy_jobs

**Propósito:** Listar Backup Copy jobs (3-2-1 rule compliance)

**Teste 1 - Listar Backup Copy jobs:**
```bash
curl -X POST http://localhost:8825/veeam_list_backup_copy_jobs \
  -H 'Content-Type: application/json' \
  -d '{"limit": 100}'
```

**Resultado esperado:**
- Se houver jobs: análise de compliance 3-2-1, score de compliance
- Se não houver: warning sobre falta de estratégia off-site
- Campos: `compliance321`, `analysis`, `jobs`

---

## BLOCO 2: Tools POST (2 tools de controle)

### 4. veeam_start_backup_job

**Propósito:** Iniciar backup job sob demanda

**Pré-requisito:** Obter ID de um job parado
```bash
curl -X POST http://localhost:8825/veeam_list_backup_jobs \
  -H 'Content-Type: application/json' \
  -d '{"limit": 10}' | jq '.jobs[] | select(.state == 0) | .id'
```

**Teste 1 - Iniciar job incremental:**
```bash
JOB_ID="SEU_JOB_ID_AQUI"

curl -X POST http://localhost:8825/veeam_start_backup_job \
  -H 'Content-Type: application/json' \
  -d "{\"jobId\": \"$JOB_ID\", \"fullBackup\": false}"
```

**Teste 2 - Iniciar job full backup:**
```bash
curl -X POST http://localhost:8825/veeam_start_backup_job \
  -H 'Content-Type: application/json' \
  -d "{\"jobId\": \"$JOB_ID\", \"fullBackup\": true}"
```

**Resultado esperado:**
- Sucesso: `summary.message` com confirmação, `sessionId` criado
- Falha: validação de estado (se job já está rodando)
- Audit log: entrada em `/opt/mcp-servers/veeam-backup/logs/audit.log`

**Validação de audit log:**
```bash
tail -f /opt/mcp-servers/veeam-backup/logs/audit.log | grep veeam_start_backup_job
```

---

### 5. veeam_stop_backup_job

**Propósito:** Parar backup job em execução

**Pré-requisito:** Job em execução (state=3)
```bash
curl -X POST http://localhost:8825/veeam_list_running_sessions \
  -H 'Content-Type: application/json' \
  -d '{"limit": 10}' | jq '.sessions[0].id'
```

**Teste 1 - Parar job:**
```bash
JOB_ID="SEU_JOB_ID_AQUI"

curl -X POST http://localhost:8825/veeam_stop_backup_job \
  -H 'Content-Type: application/json' \
  -d "{\"jobId\": \"$JOB_ID\"}"
```

**Resultado esperado:**
- Sucesso: `summary.message` com confirmação de parada
- Warnings: avisos sobre backup incompleto, snapshots órfãos
- Audit log: entrada em `/opt/mcp-servers/veeam-backup/logs/audit.log`

**Validação de audit log:**
```bash
tail -f /opt/mcp-servers/veeam-backup/logs/audit.log | grep veeam_stop_backup_job
```

---

## BLOCO 3: Tools GET Avançadas (4 tools)

### 6. veeam_list_restore_points

**Propósito:** Listar restore points de uma VM

**Teste 1 - Por VM ID (recomendado):**
```bash
VM_ID="SEU_VM_ID_AQUI"

curl -X POST http://localhost:8825/veeam_list_restore_points \
  -H 'Content-Type: application/json' \
  -d "{\"vmId\": \"$VM_ID\", \"limit\": 50}"
```

**Teste 2 - Por VM Name (fallback não implementado):**
```bash
# Este teste deve retornar erro informativo
curl -X POST http://localhost:8825/veeam_list_restore_points \
  -H 'Content-Type: application/json' \
  -d '{"vmName": "VM-Producao-01", "limit": 50}'
```

**Resultado esperado:**
- Sucesso: lista de restore points ordenados por data (mais recente primeiro)
- Campos: `summary.mostRecent`, `analysis.retentionRange`, `restorePoints`
- Erro vmName: mensagem explicando que vmId deve ser usado

---

### 7. veeam_get_backup_job_schedule

**Propósito:** Obter detalhes de scheduling de um job

**Pré-requisito:** Obter ID de um job
```bash
curl -X POST http://localhost:8825/veeam_list_backup_jobs \
  -H 'Content-Type: application/json' \
  -d '{"limit": 5}' | jq '.jobs[0].id'
```

**Teste 1 - Obter schedule:**
```bash
JOB_ID="SEU_JOB_ID_AQUI"

curl -X POST http://localhost:8825/veeam_get_backup_job_schedule \
  -H 'Content-Type: application/json' \
  -d "{\"jobId\": \"$JOB_ID\"}"
```

**Resultado esperado:**
- Campos: `schedule.enabled`, `schedule.type`, `schedule.pattern`
- Execution info: `lastRun`, `nextRun` formatados
- Recommendations: sugestões baseadas em configuração

---

### 8. veeam_get_session_log

**Propósito:** Obter log detalhado de uma session (troubleshooting)

**Pré-requisito:** Obter ID de uma session
```bash
curl -X POST http://localhost:8825/veeam_list_failed_sessions \
  -H 'Content-Type: application/json' \
  -d '{"limit": 5}' | jq '.sessions[0].id'
```

**Teste 1 - Todos os logs:**
```bash
SESSION_ID="SEU_SESSION_ID_AQUI"

curl -X POST http://localhost:8825/veeam_get_session_log \
  -H 'Content-Type: application/json' \
  -d "{\"sessionId\": \"$SESSION_ID\", \"logLevel\": \"All\"}"
```

**Teste 2 - Apenas erros:**
```bash
curl -X POST http://localhost:8825/veeam_get_session_log \
  -H 'Content-Type: application/json' \
  -d "{\"sessionId\": \"$SESSION_ID\", \"logLevel\": \"Error\"}"
```

**Resultado esperado:**
- Campos: `logs` array com `timestampFormatted`, `messageFormatted`
- Analysis: `analysis.byLevel`, `analysis.topErrors`
- Troubleshooting: recomendações baseadas em análise de logs

---

## Validação Completa

### Checklist de Validação

**Bibliotecas Auxiliares:**
- [x] `/lib/veeam-dictionaries.js` criado
- [x] `/lib/format-helpers.js` criado
- [x] `/lib/audit-logger.js` criado
- [x] `/lib/validation-helpers.js` criado
- [x] `/lib/response-enricher.js` criado

**Quick Wins (GET simples):**
- [ ] `veeam_list_running_sessions` testado
- [ ] `veeam_list_failed_sessions` testado
- [ ] `veeam_list_backup_copy_jobs` testado

**Tools POST (controle):**
- [ ] `veeam_start_backup_job` testado (sucesso)
- [ ] `veeam_start_backup_job` testado (validação de erro)
- [ ] `veeam_stop_backup_job` testado (sucesso)
- [ ] `veeam_stop_backup_job` testado (validação de erro)
- [ ] Audit log registrando operações POST

**Tools GET Avançadas:**
- [ ] `veeam_list_restore_points` testado (vmId)
- [ ] `veeam_list_restore_points` testado (vmName - erro esperado)
- [ ] `veeam_get_backup_job_schedule` testado
- [ ] `veeam_get_session_log` testado (All)
- [ ] `veeam_get_session_log` testado (Error filter)

---

## Troubleshooting

### Erro: "Tool handler not found"
**Causa:** Tool não foi carregada corretamente
**Solução:**
```bash
# Verificar logs do PM2
pm2 logs veeam-backup --lines 50

# Reiniciar MCP
pm2 restart veeam-backup
```

### Erro: "Autenticação Veeam falhou"
**Causa:** Credenciais inválidas ou VBR inacessível
**Solução:**
```bash
# Verificar credenciais
cat /opt/mcp-servers/veeam-backup/.env | grep VEEAM_

# Testar conectividade manual
curl -k https://VEEAM_HOST:9419/api/oauth2/token \
  -X POST \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'grant_type=password&username=USERNAME&password=PASSWORD'
```

### Erro: "Job não pode ser iniciado no estado atual"
**Causa:** Job não está em estado "Stopped" (0)
**Solução:**
```bash
# Verificar estado do job
curl -X POST http://localhost:8825/veeam_list_backup_jobs \
  -H 'Content-Type: application/json' \
  -d '{"limit": 10}' | jq '.jobs[] | {name, state, stateFormatted}'
```

### Audit log não está sendo criado
**Causa:** Diretório logs/ não existe ou sem permissões
**Solução:**
```bash
# Criar diretório
mkdir -p /opt/mcp-servers/veeam-backup/logs

# Verificar permissões
ls -la /opt/mcp-servers/veeam-backup/logs/

# Verificar se audit.log está sendo criado
tail -f /opt/mcp-servers/veeam-backup/logs/audit.log
```

---

## Métricas de Sucesso

**Todas as 9 tools devem:**
1. Retornar status 200 OK
2. Incluir campos `_metadata` com timestamp e server
3. Enriquecer respostas com formatação (datas, tamanhos, etc)
4. Ter tratamento de erros completo
5. Logar operações POST no audit log

**Performance:**
- Resposta < 2 segundos para tools GET
- Resposta < 3 segundos para tools POST (inclui validação)

---

## Próximos Passos

Após validação completa:

1. **Atualizar README.md:**
   - Adicionar documentação das 9 novas tools
   - Atualizar contagem total de tools (de 8 para 17)

2. **Commit das alterações:**
   ```bash
   cd /opt/mcp-servers/veeam-backup
   git add .
   git commit -m "feat(veeam): adicionar 9 novas tools (monitoring, controle e troubleshooting)"
   git push origin dev-adriano
   ```

3. **Criar SPEC para futuras tools:**
   - get-vm-details (endpoint /api/v1/inventory/vms)
   - configure-job-schedule (PATCH /api/v1/jobs/{id})
   - delete-restore-point (DELETE /api/v1/vmRestorePoints/{id})

---

**Skills IT - Soluções em Tecnologia**
Dezembro 2025
