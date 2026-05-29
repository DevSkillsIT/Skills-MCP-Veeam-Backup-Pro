# Safety Guard - Proteção para Operações Críticas

**Veeam Backup MCP Server - Skills IT**
**Versão:** 1.0.0
**Data:** 2025-12-10
**Baseado em:** Padrão GLPI MCP Safety Guard

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Operações Protegidas](#operações-protegidas)
3. [Configuração](#configuração)
4. [Como Usar](#como-usar)
5. [Exemplos de Uso](#exemplos-de-uso)
6. [Mensagens de Erro](#mensagens-de-erro)
7. [Auditoria e Logs](#auditoria-e-logs)
8. [Troubleshooting](#troubleshooting)
9. [Segurança](#segurança)

---

## Visão Geral

O **Safety Guard** é um sistema de confirmação para operações críticas que podem causar impacto significativo no ambiente de backup. Quando habilitado, exige confirmação explícita (token + justificativa) antes de executar operações destrutivas ou de alto impacto.

### Conceito

Similar a um "sudo" para operações de backup:
- **Sem Safety Guard:** Operações executam imediatamente
- **Com Safety Guard:** Operações exigem confirmação + justificativa detalhada

### Benefícios

- ✅ Previne execuções acidentais de operações críticas
- ✅ Registra justificativa de cada operação em logs de auditoria
- ✅ Facilita troubleshooting ("por que este job foi parado?")
- ✅ Compliance e auditoria de mudanças
- ✅ Proteção contra automação descontrolada

---

## Operações Protegidas

O Safety Guard protege **2 operações críticas**:

> **Nomenclatura (v2.0.0):** estas operações são as **actions** `start` e `stop` da tool `veeam_manage_backup_jobs`. Os nomes `veeam_start_backup_job` / `veeam_stop_backup_job` permanecem reconhecidos como **aliases legacy** pelo Safety Guard.

| Operação | Descrição | Impacto |
|----------|-----------|---------|
| **`veeam_manage_backup_jobs` (action=start)** | Iniciar backup job sob demanda (fora do schedule) | ⚠️ Alto - Consome recursos, pode impactar performance |
| **`veeam_manage_backup_jobs` (action=stop)** | Interromper backup job em execução | ⚠️ Muito Alto - Backup incompleto, snapshots órfãos |

### Por que essas operações?

**`action=start`:**
- Consumo inesperado de recursos (CPU, rede, storage)
- Pode conflitar com janela de backup programada
- Impacto em VMs de produção (snapshots, I/O)

**`action=stop`:**
- Backup incompleto = ponto de restauração inválido
- Pode deixar snapshots órfãos nas VMs
- Interrompe cadeia de backups incrementais
- Dificulta troubleshooting sem justificativa clara

---

## Configuração

### Variáveis de Ambiente

Adicione ao arquivo `.env`:

```bash
# ============================================================================
# SAFETY GUARD - Proteção para operações críticas
# ============================================================================

# Habilita verificação de confirmação para operações destrutivas/críticas
# Valores: true (habilitado) ou false (desabilitado)
MCP_SAFETY_GUARD=false

# Token de segurança para autorizar operações críticas
# IMPORTANTE: Deve ter pelo menos 8 caracteres (recomendado: 16+)
# Este token deve ser passado como confirmationToken nas tools protegidas
MCP_SAFETY_TOKEN=your-safety-token-here-min-8-chars
```

### Gerar Token Seguro

Escolha um método para gerar token aleatório:

```bash
# Opção 1: OpenSSL (64 caracteres hex)
openssl rand -hex 32

# Opção 2: OpenSSL (32 caracteres base64)
openssl rand -base64 24

# Opção 3: Node.js (64 caracteres hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Exemplo de resultado:
# SEU_TOKEN_AQUI
```

### Aplicar Configuração

Após editar `.env`:

```bash
# Reiniciar serviço para aplicar
pm2 restart mcp-veeam

# Verificar logs
pm2 logs mcp-veeam --lines 20

# Procurar por:
# [SafetyGuard] ✅ HABILITADO - Operações críticas exigem confirmação
# ou
# [SafetyGuard] ⚠️  DESABILITADO - Operações críticas não exigem confirmação
```

---

## Como Usar

### Modo 1: Safety Guard DESABILITADO (padrão)

```bash
# MCP_SAFETY_GUARD=false (ou não configurado)
# Tools funcionam normalmente SEM exigir confirmação

curl -X POST http://mcp.servidor.one:8825/tools/call \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer SEU_AUTH_TOKEN' \
  -d '{
    "name": "veeam_manage_backup_jobs",
    "arguments": {
      "action": "start",
      "jobId": "urn:veeam:Job:00000000-0000-0000-0000-000000000000",
      "fullBackup": false
    }
  }'

# ✅ Executa imediatamente sem pedir confirmação
```

### Modo 2: Safety Guard HABILITADO

```bash
# MCP_SAFETY_GUARD=true
# Tools EXIGEM confirmationToken + reason

curl -X POST http://mcp.servidor.one:8825/tools/call \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer SEU_AUTH_TOKEN' \
  -d '{
    "name": "veeam_manage_backup_jobs",
    "arguments": {
      "action": "start",
      "jobId": "urn:veeam:Job:00000000-0000-0000-0000-000000000000",
      "fullBackup": false,
      "confirmationToken": "SEU_TOKEN_AQUI",
      "reason": "Backup emergencial solicitado pelo cliente para recuperação de dados críticos após falha de hardware no servidor de produção"
    }
  }'

# ✅ Executa APÓS validar token e reason
# ✅ Registra justificativa em logs de auditoria
```

---

## Exemplos de Uso

### Exemplo 1: Iniciar Job com Safety Guard DESABILITADO

```json
// Request (Safety Guard OFF)
{
  "name": "veeam_manage_backup_jobs",
  "arguments": {
    "action": "start",
    "jobId": "urn:veeam:Job:a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "fullBackup": false
  }
}

// Response - Sucesso
{
  "content": [{
    "type": "text",
    "text": {
      "summary": {
        "message": "✅ Job \"BKP-VM-Producao\" iniciado com sucesso",
        "jobId": "urn:veeam:Job:a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "backupType": "Incremental Backup",
        "sessionId": "urn:veeam:Session:f1e2d3c4-b5a6-7890-fedc-ba0987654321"
      }
    }
  }]
}
```

### Exemplo 2: Iniciar Job com Safety Guard HABILITADO (SEM confirmação)

```json
// Request (Safety Guard ON, sem confirmationToken)
{
  "name": "veeam_manage_backup_jobs",
  "arguments": {
    "action": "start",
    "jobId": "urn:veeam:Job:a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "fullBackup": false
  }
}

// Response - ERRO
{
  "content": [{
    "type": "text",
    "text": {
      "error": true,
      "message": "SAFETY GUARD: Operação \"veeam_start_backup_job\" requer confirmação explícita.\n\n
Descrição: Iniciar backup job sob demanda (fora do schedule)\n
Alvo: Job urn:veeam:Job:a1b2c3d4-e5f6-7890-abcd-ef1234567890\n\n
Para executar esta operação, forneça:\n
- confirmationToken: Token de confirmação (igual ao MCP_SAFETY_TOKEN)\n
- reason: Justificativa detalhada (mínimo 10 caracteres)\n\n
Exemplo de uso:\n
{\n
  \"jobId\": \"urn:veeam:Job:a1b2c3d4-e5f6-7890-abcd-ef1234567890\",\n
  \"confirmationToken\": \"seu-token-aqui\",\n
  \"reason\": \"Backup emergencial solicitado pelo cliente para recuperação de dados críticos\"\n
}"
    }
  }],
  "isError": true
}
```

### Exemplo 3: Iniciar Job com Safety Guard HABILITADO (COM confirmação)

```json
// Request (Safety Guard ON, com confirmationToken e reason)
{
  "name": "veeam_manage_backup_jobs",
  "arguments": {
    "action": "start",
    "jobId": "urn:veeam:Job:a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "fullBackup": false,
    "confirmationToken": "SEU_TOKEN_AQUI",
    "reason": "Backup emergencial solicitado pelo cliente para recuperação de dados críticos após falha de hardware no servidor de produção"
  }
}

// Response - Sucesso (IDÊNTICO ao exemplo 1, mas com log de auditoria adicional)
{
  "content": [{
    "type": "text",
    "text": {
      "summary": {
        "message": "✅ Job \"BKP-VM-Producao\" iniciado com sucesso",
        "jobId": "urn:veeam:Job:a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "backupType": "Incremental Backup",
        "sessionId": "urn:veeam:Session:f1e2d3c4-b5a6-7890-fedc-ba0987654321"
      }
    }
  }]
}

// Log de auditoria adicional em /opt/mcp-servers/veeam-backup/logs/audit.log:
// {"timestamp":"2025-12-10T14:30:00.000Z","operation":"safety-guard-authorized","jobId":"urn:veeam:Job:a1b2c3d4-e5f6-7890-abcd-ef1234567890","jobName":"Job","result":"authorized","metadata":{"operation":"veeam_start_backup_job","operationDescription":"Iniciar backup job sob demanda (fora do schedule)","reason":"Backup emergencial solicitado pelo cliente para recuperação de dados críticos após falha de hardware no servidor de produção","reasonLength":108,"guardEnabled":true,"timestamp":"2025-12-10T14:30:00.000Z"}}
```

### Exemplo 4: Parar Job com Safety Guard (token INVÁLIDO)

```json
// Request (token errado)
{
  "name": "veeam_manage_backup_jobs",
  "arguments": {
    "action": "stop",
    "jobId": "urn:veeam:Job:a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "confirmationToken": "token-errado-aqui",
    "reason": "Parar job para manutenção emergencial do storage"
  }
}

// Response - ERRO
{
  "content": [{
    "type": "text",
    "text": {
      "error": true,
      "message": "SAFETY GUARD: Token de confirmação inválido.\n\n
O token fornecido não corresponde ao MCP_SAFETY_TOKEN configurado.\n
Verifique se está usando o token correto."
    }
  }],
  "isError": true
}

// Log de auditoria:
// [SafetyGuard] ⚠️  Tentativa de operação veeam_stop_backup_job com token INVÁLIDO (target: Job urn:veeam:Job:a1b2c3d4-e5f6-7890-abcd-ef1234567890)
```

### Exemplo 5: Parar Job com Safety Guard (reason muito curto)

```json
// Request (reason com 5 caracteres, mínimo é 10)
{
  "name": "veeam_manage_backup_jobs",
  "arguments": {
    "action": "stop",
    "jobId": "urn:veeam:Job:a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "confirmationToken": "SEU_TOKEN_AQUI",
    "reason": "teste"
  }
}

// Response - ERRO
{
  "content": [{
    "type": "text",
    "text": {
      "error": true,
      "message": "SAFETY GUARD: Justificativa obrigatória para operação \"veeam_stop_backup_job\".\n\n
A justificativa (reason) deve ter pelo menos 10 caracteres.\n
Atual: 5 caracteres.\n\n
Exemplo de justificativa válida:\n
\"Backup emergencial solicitado pelo cliente para recuperação de dados críticos após falha de hardware\""
    }
  }],
  "isError": true
}
```

---

## Mensagens de Erro

### Erro 1: Confirmação Ausente

```
SAFETY GUARD: Operação "veeam_start_backup_job" requer confirmação explícita.

Descrição: Iniciar backup job sob demanda (fora do schedule)
Alvo: Job urn:veeam:Job:00000000-0000-0000-0000-000000000000

Para executar esta operação, forneça:
- confirmationToken: Token de confirmação (igual ao MCP_SAFETY_TOKEN)
- reason: Justificativa detalhada (mínimo 10 caracteres)
```

**Solução:** Adicione `confirmationToken` e `reason` aos parâmetros.

### Erro 2: Token Inválido

```
SAFETY GUARD: Token de confirmação inválido.

O token fornecido não corresponde ao MCP_SAFETY_TOKEN configurado.
Verifique se está usando o token correto.
```

**Solução:** Verifique valor de `MCP_SAFETY_TOKEN` no arquivo `.env`.

### Erro 3: Reason Muito Curto

```
SAFETY GUARD: Justificativa obrigatória para operação "veeam_stop_backup_job".

A justificativa (reason) deve ter pelo menos 10 caracteres.
Atual: 5 caracteres.
```

**Solução:** Forneça justificativa detalhada com pelo menos 10 caracteres.

### Erro 4: Configuração Inválida (MCP_SAFETY_TOKEN não definido)

```
[SafetyGuard] ERRO DE CONFIGURAÇÃO: MCP_SAFETY_TOKEN não está definido.
Defina um token de segurança com pelo menos 8 caracteres.
```

**Solução:** Defina `MCP_SAFETY_TOKEN` no `.env` e reinicie serviço.

---

## Auditoria e Logs

### Localização dos Logs

```bash
# Log de auditoria (JSON estruturado)
/opt/mcp-servers/veeam-backup/logs/audit.log

# Logs do PM2 (SafetyGuard + Tools)
pm2 logs mcp-veeam

# Apenas erros
pm2 logs mcp-veeam --err
```

### Formato do Log de Auditoria

```json
{
  "timestamp": "2025-12-10T14:30:00.000Z",
  "operation": "safety-guard-authorized",
  "jobId": "urn:veeam:Job:a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "jobName": "Job",
  "result": "authorized",
  "user": "mcp-user",
  "error": null,
  "metadata": {
    "operation": "veeam_start_backup_job",
    "operationDescription": "Iniciar backup job sob demanda (fora do schedule)",
    "reason": "Backup emergencial solicitado pelo cliente para recuperação de dados críticos após falha de hardware",
    "reasonLength": 108,
    "guardEnabled": true,
    "timestamp": "2025-12-10T14:30:00.000Z"
  },
  "environment": {
    "veeamHost": "veeam-server.domain.com",
    "mcpVersion": "1.0.0"
  }
}
```

### Consultar Logs de Auditoria

```bash
# Todas as operações autorizadas pelo Safety Guard
grep "safety-guard-authorized" /opt/mcp-servers/veeam-backup/logs/audit.log | jq

# Filtrar por operação específica
grep "safety-guard-authorized" /opt/mcp-servers/veeam-backup/logs/audit.log | jq 'select(.metadata.operation == "veeam_start_backup_job")'

# Últimas 10 autorizações
grep "safety-guard-authorized" /opt/mcp-servers/veeam-backup/logs/audit.log | tail -10 | jq

# Ver justificativas (reasons)
grep "safety-guard-authorized" /opt/mcp-servers/veeam-backup/logs/audit.log | jq -r '.metadata.reason'
```

---

## Troubleshooting

### Problema 1: "ERRO DE CONFIGURAÇÃO: MCP_SAFETY_TOKEN não está definido"

**Causa:** `MCP_SAFETY_GUARD=true` mas `MCP_SAFETY_TOKEN` não está configurado.

**Solução:**
```bash
# Gerar token
openssl rand -hex 32

# Adicionar ao .env
echo "MCP_SAFETY_TOKEN=SEU_TOKEN_AQUI" >> .env

# Reiniciar
pm2 restart mcp-veeam
```

### Problema 2: "Token de confirmação inválido"

**Causa:** `confirmationToken` fornecido difere de `MCP_SAFETY_TOKEN` no `.env`.

**Soluções:**
```bash
# Verificar token configurado
grep MCP_SAFETY_TOKEN /opt/mcp-servers/veeam-backup/.env

# Comparar com token usado na requisição
# Devem ser EXATAMENTE iguais (case-sensitive)

# Se necessário, gerar novo token
openssl rand -hex 32
```

### Problema 3: Tools funcionam SEM pedir confirmação (Safety Guard ignorado)

**Causa:** `MCP_SAFETY_GUARD=false` ou não está definido.

**Solução:**
```bash
# Verificar valor
grep MCP_SAFETY_GUARD /opt/mcp-servers/veeam-backup/.env

# Deve ser exatamente: MCP_SAFETY_GUARD=true (case-sensitive)
# Reiniciar após alterar
pm2 restart mcp-veeam

# Verificar logs
pm2 logs mcp-veeam --lines 20 | grep SafetyGuard
# Deve mostrar: [SafetyGuard] ✅ HABILITADO
```

### Problema 4: "Justificativa obrigatória" mesmo fornecendo reason

**Causa:** `reason` tem menos de 10 caracteres ou só espaços em branco.

**Solução:**
```bash
# Reason INVÁLIDO:
"reason": "teste"          # 5 chars < 10
"reason": "          "     # Só espaços

# Reason VÁLIDO:
"reason": "Backup emergencial solicitado pelo cliente"  # 46 chars >= 10
```

---

## Segurança

### Boas Práticas

1. **Token Forte:**
   - Mínimo 16 caracteres (recomendado: 32+)
   - Gerar aleatoriamente (não usar palavras comuns)
   - Nunca commitar no Git (`.env` está no `.gitignore`)

2. **Rotação de Token:**
   - Trocar token periodicamente (ex: a cada 90 dias)
   - Trocar após suspeita de vazamento
   - Documentar trocas em changelog interno

3. **Justificativas Detalhadas:**
   - Mínimo 10 caracteres (forçado pelo sistema)
   - Recomendado: 50-200 caracteres
   - Incluir: quem solicitou, motivo técnico, urgência

4. **Auditoria Regular:**
   - Revisar logs de auditoria semanalmente
   - Verificar justificativas vagas ou suspeitas
   - Correlacionar com tickets de mudança

### Proteções Implementadas

✅ **Timing-Safe Comparison:** Previne timing attacks usando `crypto.timingSafeEqual()`
✅ **Audit Logging:** Todas operações autorizadas registradas em JSON estruturado
✅ **Token Validation:** Verifica formato e comprimento antes de comparar
✅ **Reason Validation:** Exige justificativa mínima de 10 caracteres
✅ **Environment Isolation:** Token em variável de ambiente, nunca hardcoded

### Limitações

⚠️ **Token em Plain Text:** `MCP_SAFETY_TOKEN` é armazenado em plain text no `.env`
   - Solução futura: Integração com vault (HashiCorp Vault, AWS Secrets Manager)

⚠️ **Sem MFA:** Não há autenticação multi-fator (apenas token)
   - Solução futura: Integração com SSO/SAML

⚠️ **Sem Expiração de Token:** Token não expira automaticamente
   - Solução: Implementar política de rotação manual

---

## Referências

- **Padrão GLPI MCP:** `/opt/mcp-servers/glpi/src/utils/safety_guard.py`
- **Documentação GLPI:** `/opt/mcp-servers/glpi/README.md#safety-guard`
- **Implementação Veeam:**
  - `/opt/mcp-servers/veeam-backup/lib/safety-guard.js`
  - `/opt/mcp-servers/veeam-backup/tools/manage-backup-jobs.js` (actions start/stop)
  - `/opt/mcp-servers/veeam-backup/lib/format-helpers.js` (deriveScheduleType, etc.)

---

**Desenvolvido por:** Skills IT - Soluções em Tecnologia
**Data:** 2025-12-10
**Versão:** 1.0.0
**Status:** ✅ Implementado e Testado
