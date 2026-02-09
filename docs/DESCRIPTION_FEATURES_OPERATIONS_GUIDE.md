# Veeam Backup MCP - Description Features Operations Guide

## Para Operadores e Arquitetos de Soluções

Este documento explica como usar as novas features de descrição para gerenciar backups em ambientes multi-cliente (MSP).

---

## O Que Mudou

### Antes (Busca por nome técnico)
```
"Buscar jobs do cliente ACME"
→ Precisa saber o nome técnico do job
→ Exemplo: BKP-JOB-LOCAL-OK-PMW-VCENTER-OKDTCVM001-APP
→ Difícil de lembrar
```

### Agora (Busca por informações do cliente)
```
"Buscar jobs do cliente ACME"
→ Basta saber o nome da empresa ou ID
→ Sistema encontra automaticamente
→ Muito mais fácil! ✅
```

---

## Formato de Description (Obrigatório para MSP)

### Template
```
Cliente: {NOME_DA_EMPRESA} | ID: {ID_CLIENTE} | Local: {LOCALIZAÇÃO} | Contrato: {TIPO}
```

### Exemplos Reais
```
Cliente: ACME Corporation | ID: CLI-001 | Local: Curitiba | Contrato: Premium
Cliente: Ramada Hotéis | ID: CLI-002 | Local: São Paulo | Contrato: Enterprise
Cliente: TechCo Solutions | ID: CLI-015 | Local: Brasília | Contrato: Standard
Cliente: Skills IT | ID: CLI-INTERNO | Local: Curitiba | Contrato: Interno
```

### Componentes
| Campo | Descrição | Exemplo | Obrigatório |
|-------|-----------|---------|------------|
| Cliente | Nome da empresa cliente | ACME Corp | ✅ SIM |
| ID | Identificador único (formato: CLI-XXX) | CLI-001 | ✅ SIM |
| Local | Localização/filial | Curitiba, São Paulo | ✅ SIM |
| Contrato | Tipo de contrato | Premium, Enterprise, Standard | ✅ SIM |

---

## Como Configurar em Novo Job

### 1. No Console VBR
Ao criar novo job de backup:

**Tab: General**
- Nome do Job: `BKP-JOB-LOCAL-ACME-001`
- **Description:** `Cliente: ACME Corp | ID: CLI-001 | Local: Curitiba | Contrato: Premium`

### 2. Via API VBR
```bash
curl -X POST https://vbr.servidor.one:9419/api/v1/jobs \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "name": "BKP-JOB-LOCAL-ACME-001",
    "description": "Cliente: ACME Corp | ID: CLI-001 | Local: Curitiba | Contrato: Premium",
    ...
  }'
```

### 3. Validação
O MCP valida automaticamente o format. Se description estiver inválido:
- ❌ Buscas por Cliente/ID/Local **não funcionarão**
- ✅ Mas o job continuará aparecendo em listagens gerais
- 📝 O sistema usa fallback com o nome do job

---

## Usando as Buscas

### Opção 1: Buscar por Nome do Cliente
```
Parâmetro: descriptionFilter: "ACME"
Resultado: Todos jobs onde "ACME" aparece no nome do cliente
Exemplo: "Cliente: ACME Corp | ID: CLI-001 | ..."
```

### Opção 2: Buscar por ID do Cliente
```
Parâmetro: descriptionFilter: "CLI-001"
Resultado: Todos jobs do cliente CLI-001
Múltiplos jobs possíveis (diferentes servidores/serviços)
```

### Opção 3: Buscar por Localização
```
Parâmetro: descriptionFilter: "Curitiba"
Resultado: Todos jobs em Curitiba (de qualquer cliente)
Útil para gerenciar por filial
```

### Opção 4: Buscar por Tipo de Contrato
```
Parâmetro: descriptionFilter: "Premium"
Resultado: Todos jobs com contrato Premium
Útil para SLA reporting
```

---

## Exemplos de Uso com Claude AI

### Pergunta 1: "Qual é o status dos backups do cliente ACME?"
Claude faz:
```
1. Busca veeam_list_backup_jobs com descriptionFilter="ACME"
2. Encontra todos os jobs ACME
3. Verifica status de cada um
4. Responde com status consolidado
```

### Pergunta 2: "Quais backups estão falhando em Curitiba?"
Claude faz:
```
1. Busca veeam_list_backup_jobs com descriptionFilter="Curitiba"
2. Filtra por state="Failed"
3. Retorna lista de jobs falhando em Curitiba
4. Propõe ações corretivas
```

### Pergunta 3: "Listar todos os contratos Enterprise"
Claude faz:
```
1. Busca veeam_list_backup_jobs com descriptionFilter="Enterprise"
2. Retorna todos os jobs Enterprise
3. Agrupa por cliente
4. Exibe relatório consolidado
```

---

## API Reference - Novos Parâmetros

### `veeam_list_backup_jobs`

**Novo Parâmetro:**
```
descriptionFilter: string (opcional)
Description: Filtra jobs por informações de cliente no campo description
Examples:
- "ACME" - jobs do cliente ACME
- "Curitiba" - jobs em Curitiba
- "CLI-001" - jobs do cliente com ID CLI-001
- "Premium" - jobs com contrato Premium
```

**Exemplo de Chamada:**
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "veeam_list_backup_jobs",
    "arguments": {
      "limit": 100,
      "typeFilter": "Backup",
      "descriptionFilter": "ACME"
    }
  },
  "id": 1
}
```

### `veeam_list_backup_copy_jobs`

**Novo Parâmetro:**
```
descriptionFilter: string (opcional)
Description: Filtra backup copy jobs por cliente
```

**Uso Idêntico a veeam_list_backup_jobs**

---

## Resposta Típica (Com Description)

```json
{
  "summary": "Retrieved 5 backup jobs out of 21 total jobs",
  "jobs": [
    {
      "id": "8f07369e-ed2e-44d7-9bca-92159a74a11a",
      "name": "BKP-JOB-LOCAL-OK-PMW-VCENTER-OKDTCVM001-APP",
      "type": "Backup",
      "state": "Stopped",
      "platformName": "VMware",
      "description": "Cliente: ACME Corp | ID: CLI-001 | Local: Curitiba | Contrato: Premium",
      "scheduleEnabled": true,
      "scheduleType": "Daily",
      "lastRun": "2025-12-10T23:15:00Z",
      "nextRun": "2025-12-11T23:15:00Z",
      "result": "Success",
      "message": "Backup completed successfully"
    }
  ],
  "pagination": {
    "total": 21,
    "count": 5,
    "skip": 0,
    "limit": 100
  },
  "filters": {
    "typeFilter": "Backup",
    "descriptionFilter": "ACME"
  }
}
```

---

## Troubleshooting

### Problema: Busca por "ACME" não retorna nenhum resultado
**Solução:**
1. Verificar se o job tem description preenchido
2. Verificar se descrição segue o format: `Cliente: ACME | ID: ... | Local: ... | Contrato: ...`
3. Verificar spelling (case-insensitive, mas deve conter exatamente "ACME")
4. Se tudo correto, description está mal formatado

### Problema: Job aparece na listagem geral mas não na busca por cliente
**Causa:** Description está vazio ou mal formatado
**Solução:**
1. Editar job no VBR Console
2. Preencher description com format correto
3. Salvar e tentar busca novamente

### Problema: Busca lenta (> 5 segundos) com muitos jobs
**Causa:** Performance de O(n) com muitos jobs (> 5000)
**Solução:**
1. Usar filtros adicionais (typeFilter, stateFilter)
2. Usar descriptionFilter + typeFilter em conjunto
3. Considerar paginação com limit/skip

---

## Melhores Práticas

### ✅ DOs (O Que Fazer)

1. **Use a format consistente**
   ```
   ✅ Cliente: ACME Corp | ID: CLI-001 | Local: Curitiba | Contrato: Premium
   ❌ ACME - Curitiba - Premium
   ❌ Client=ACME,Location=Curitiba
   ```

2. **Use IDs estruturados**
   ```
   ✅ CLI-001, CLI-002, CLI-015
   ❌ 1, 2, 15
   ❌ ACME-CURITIBA-001
   ```

3. **Sejam descritivos nos nomes também**
   ```
   ✅ BKP-JOB-LOCAL-ACME-VCENTER-PROD
   ❌ BACKUP
   ❌ JOB123
   ```

4. **Atualize descriptions ao mudar cliente**
   ```
   Se realocar um job de cliente, atualize o description!
   ```

### ❌ DON'Ts (O Que Evitar)

1. **Não use formatos variados**
   ```
   ❌ Cliente: ACME | ID: CLI-001 | ...
   ❌ Cliente = ACME, ID = CLI-001, ...
   ❌ client:ACME;id:CLI-001;...
   ```

2. **Não deixe descriptions vazios**
   ```
   ❌ description: ""
   ❌ description: null
   ✅ description: "Cliente: ... | ID: ... | Local: ... | Contrato: ..."
   ```

3. **Não use caracteres especiais**
   ```
   ❌ Cliente: ACME & Corp | ...
   ❌ Cliente: ACME "Corp" | ...
   ✅ Cliente: ACME Corp | ...
   ```

---

## Casos de Uso Típicos

### Caso 1: Onboarding de Novo Cliente
```
1. Criar jobs de backup para cliente ACME
2. Preencher description: "Cliente: ACME Corp | ID: CLI-001 | Local: Curitiba | Contrato: Premium"
3. Claude consegue identificar e gerenciar automaticamente
```

### Caso 2: Auditar Backups por SLA
```
1. Filtrar por descriptionFilter="Premium" para contratos Premium
2. Verificar success rate de cada cliente
3. Gerar relatório de SLA compliance
```

### Caso 3: Responder Incidente de Cliente
```
Cliente reporta: "Backup não funcionou"
1. Buscar descriptionFilter="ACME"
2. Verificar status dos últimos runs
3. Identificar qual job falhou e o erro
4. Tomar ação corretiva
```

### Caso 4: Migrar Cliente para Novo Servidor
```
1. Buscar todos jobs do cliente: descriptionFilter="CLI-001"
2. Verificar configurações de cada job
3. Criar jobs equivalentes no novo servidor
4. Atualizar description com novas informações
```

---

## Monitoramento

### Métricas de Description
```bash
# Quantos jobs têm description válido?
curl ... | jq '.jobs | length'

# Quantos clientes únicos?
curl ... | jq '.jobs[].description' | grep -o 'Cliente: [^|]*' | sort -u

# Distribuição por contrato?
curl ... | jq '.jobs[].description' | grep -o 'Contrato: [^|]*' | sort | uniq -c
```

### Alertas Recomendados
1. ⚠️ Jobs criados sem description (durante 7 dias)
2. ⚠️ Description format inválido detectado
3. ⚠️ Múltiplos jobs com mesmo ID de cliente (possível duplicação)

---

## Migração de Jobs Existentes

Se seus jobs atuais **não têm** descriptions estruturados:

### Passo 1: Auditar Jobs Existentes
```bash
pm2 logs mcp-veeam --lines 100 | grep "description"
```

### Passo 2: Atualizar Descriptions
**No VBR Console:**
1. Selecionar job
2. Properties → General
3. Preencher Description com format correto
4. Save

### Passo 3: Validar
```bash
# Testar busca por cliente
curl -X POST http://localhost:8825/mcp \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "method":"tools/call",
    "params":{"name":"veeam_list_backup_jobs","arguments":{"descriptionFilter":"NOME_CLIENTE"}}
  }'
```

---

## Suporte & Escalação

### Questões Técnicas
- 📧 Email: adriano@skillsit.com.br
- 📞 Slack: #infrastructure

### Reportar Bugs
- 📋 GitHub Issues: (se aplicável)
- 📧 Email com detalhe do erro

### Documentação Completa
- 📖 QUALITY_VERIFICATION_REPORT_DESCRIPTION_FEATURES.md
- 📖 DESCRIPTION_FEATURES_SUMMARY.md

---

**Última Atualização:** 2025-12-11
**Versão:** 1.0.0
**Status:** ✅ Production Ready
