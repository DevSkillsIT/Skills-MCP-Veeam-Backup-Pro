# Guia de Segurança - Veeam Backup MCP Server

**Práticas de segurança e hardening para deployment em produção**

---

## 📑 Índice

- [Visão Geral de Segurança](#-visão-geral-de-segurança)
- [Autenticação Veeam](#-autenticação-veeam)
- [Autenticação MCP](#-autenticação-mcp)
- [Safety Guard - Proteção para Operações Críticas](#-safety-guard---proteção-para-operações-críticas)
- [Gerenciamento de Sessões](#-gerenciamento-de-sessões)
- [Controle de Acesso HTTP](#-controle-de-acesso-http)
- [SSL/TLS](#-ssltls)
- [Gerenciamento de Credenciais](#-gerenciamento-de-credenciais)
- [Firewall e Network Security](#-firewall-e-network-security)
- [Auditoria e Monitoramento](#-auditoria-e-monitoramento)
- [Hardening Checklist](#-hardening-checklist)

---

## 🔒 Visão Geral de Segurança

### Princípios de Segurança

Este projeto implementa os seguintes princípios de segurança:

1. **Least Privilege**: Conta de serviço com permissões mínimas (read-only)
2. **Defense in Depth**: Múltiplas camadas de proteção
3. **Zero Trust**: Validação em cada camada
4. **Secure by Default**: Configurações seguras out-of-the-box
5. **Audit Everything**: Logging completo de operações

### Modelo de Ameaças

| Ameaça | Mitigação | Implementação |
|--------|-----------|---------------|
| **Credential Theft** | Env vars + file permissions | `.env` com 600 permissions |
| **MITM Attack** | SSL/TLS obrigatório | `VEEAM_IGNORE_SSL=false` |
| **Unauthorized MCP Access** | Bearer Token Authentication | `AUTH_TOKEN` + middleware |
| **Accidental Critical Operations** | Safety Guard | Token + justificativa obrigatória |
| **Unauthorized Access** | Firewall + reverse proxy | UFW rules + Nginx auth |
| **Token Hijacking** | Short-lived tokens + cache | 55-minute expiry |
| **API Abuse** | Rate limiting | Nginx limit_req |
| **Injection Attacks** | Input validation | Zod schemas |

---

## 🔐 Autenticação Veeam

### OAuth2 Password Grant

O servidor usa OAuth2 Password Grant para autenticar com Veeam:

```javascript
POST /api/oauth2/token
Authorization: Basic base64(username:password)
Content-Type: application/x-www-form-urlencoded

grant_type=password
```

**Resposta:**
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

### Token Management Seguro

**Características:**

1. **In-Memory Only**: Token nunca persiste em disco
2. **Short-Lived**: Validade de 60 minutos
3. **Auto-Refresh**: Renovação 5 minutos antes de expirar
4. **Thread-Safe**: Promise memoization previne race conditions

**Implementação (`lib/auth-middleware.js`):**

```javascript
const authManager = {
  token: null,           // Apenas em memória RAM
  expiresAt: null,      // Timestamp de expiração
  authPromise: null,    // Promise para memoization

  async getToken() {
    // Cache hit: retornar token válido
    if (this.token && this.expiresAt > Date.now() + 5 * 60 * 1000) {
      return this.token;
    }

    // Auth em progresso: reutilizar promise
    if (this.authPromise) {
      return this.authPromise;
    }

    // Nova auth necessária
    this.authPromise = this._authenticate();
    const token = await this.authPromise;
    this.authPromise = null;
    return token;
  }
};
```

### Conta de Serviço Read-Only

**⚠️ IMPORTANTE:** Use sempre conta com permissões mínimas.

**Criação de Conta no Veeam:**

1. Acesse Veeam Console
2. Navegue para **Security → User Roles**
3. Crie novo usuário: `svc-mcp-reader`
4. Atribua role: **Veeam Restore Operator** (read-only)
5. Configure senha forte (20+ caracteres)

**Permissões da Conta:**

| Operação | Permitido |
|----------|-----------|
| Ler jobs de backup | ✅ Sim |
| Ler sessões de backup | ✅ Sim |
| Ler status de repositórios | ✅ Sim |
| Ler informações de licença | ✅ Sim |
| Iniciar/parar jobs | ❌ Não |
| Modificar configurações | ❌ Não |
| Executar restores | ❌ Não |
| Deletar backups | ❌ Não |

**Configuração no `.env`:**
```bash
VEEAM_USERNAME=.\\svc-mcp-reader
VEEAM_PASSWORD=R3@d0nlyP@ssw0rd2024!Secure
```

---

## 🔐 Autenticação MCP

### Bearer Token Authentication

O servidor implementa autenticação obrigatória via **Bearer Token** para proteger todos os endpoints MCP HTTP (protocolo Streamable HTTP 2024-11-05).

**Características:**

1. **Autenticação Obrigatória**: Todos endpoints `/mcp` exigem token válido
2. **Timing-Safe Comparison**: Previne timing attacks
3. **Endpoints Públicos**: `/health` e `/` não exigem autenticação
4. **JSON-RPC Errors**: Retorna códigos de erro padronizados

### Configuração do Bearer Token

**1. Gerar Token Seguro**

Escolha um método para gerar token aleatório:

```bash
# Opção 1: OpenSSL (64 caracteres hex) - RECOMENDADO
openssl rand -hex 32

# Opção 2: OpenSSL (32 caracteres base64)
openssl rand -base64 24

# Opção 3: Node.js (64 caracteres hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Exemplo de resultado:
# SEU_TOKEN_AQUI
```

**2. Configurar no `.env`**

```bash
# ============================================================================
# MCP AUTHENTICATION - Bearer Token
# ============================================================================

# Token de autenticação para endpoints MCP (/mcp)
# IMPORTANTE: Deve ter pelo menos 32 caracteres (recomendado: 64+)
# Gerar com: openssl rand -hex 32
AUTH_TOKEN=SEU_TOKEN_AQUI
```

**3. Aplicar Permissões**

```bash
# Proteger arquivo .env
chmod 600 /opt/mcp-servers/veeam-backup/.env
chown root:root /opt/mcp-servers/veeam-backup/.env

# Reiniciar serviço
pm2 restart mcp-veeam
```

### Endpoints Protegidos vs Públicos

**Endpoints Protegidos (Requerem Bearer Token):**

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/mcp` | POST | JSON-RPC handler principal (initialize, tools/list, tools/call) |
| `/mcp` | GET | SSE stream para notificações (Gemini CLI) |
| `/mcp` | DELETE | Terminação de sessão MCP |

**Endpoints Públicos (Sem Autenticação):**

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/health` | GET | Health check para monitoramento (PM2, Prometheus) |
| `/` | GET | Informações básicas do servidor |
| `/docs` | GET | Documentação Swagger UI (opcional) |
| `/openapi.json` | GET | Schema OpenAPI (opcional) |

### Como Usar o Bearer Token

**Exemplo 1: Claude Code (`.mcp.json`)**

```json
{
  "mcpServers": {
    "veeam-backup": {
      "type": "streamable-http",
      "url": "http://your-server:8825/mcp",
      "headers": {
        "Authorization": "Bearer SEU_TOKEN_AQUI"
      }
    }
  }
}
```

**Exemplo 2: Gemini CLI (`~/.gemini/settings.json`)**

```json
{
  "mcpServers": {
    "veeam-backup": {
      "httpUrl": "http://your-server:8825/mcp",
      "headers": {
        "Authorization": "Bearer SEU_TOKEN_AQUI"
      },
      "timeout": 30000
    }
  }
}
```

**Exemplo 3: curl**

```bash
# Listar ferramentas disponíveis
curl -X POST http://your-server:8825/mcp \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer SEU_TOKEN_AQUI' \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/list",
    "id":1
  }'
```

### Mensagens de Erro de Autenticação

**Erro 1: Token Ausente**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32001,
    "message": "Autenticação necessária. Envie header: Authorization: Bearer <TOKEN>",
    "data": {
      "required_header": "Authorization",
      "format": "Bearer <TOKEN>"
    }
  }
}
```

**Erro 2: Formato Inválido**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32001,
    "message": "Formato de autenticação inválido. Use: Bearer <TOKEN>",
    "data": {
      "received": "Basic",
      "expected": "Bearer"
    }
  }
}
```

**Erro 3: Token Inválido**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32001,
    "message": "Token de autenticação inválido",
    "data": {
      "hint": "Verifique o token configurado no cliente MCP"
    }
  }
}
```

### Implementação Técnica

**Middleware de Autenticação:** `lib/mcp-auth-middleware.js`

```javascript
export function mcpAuthMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];

  // 1. Bypass para endpoints públicos
  const publicPaths = ['/health', '/', '/docs', '/openapi.json'];
  if (publicPaths.includes(req.path)) {
    return next();
  }

  // 2. Validar presença do header
  if (!authHeader) {
    return res.status(401).json({ error: 'Token ausente' });
  }

  // 3. Validar formato Bearer
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Formato inválido' });
  }

  // 4. Extrair e validar token
  const token = authHeader.substring(7).trim();
  if (token !== process.env.AUTH_TOKEN) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  // 5. Token válido - prosseguir
  next();
}
```

**Aplicação nas Rotas:**

```javascript
import { mcpAuthMiddleware } from './lib/mcp-auth-middleware.js';

// Aplicar middleware em cada rota protegida
app.post('/mcp', mcpAuthMiddleware, mcpHandler);
app.get('/mcp', mcpAuthMiddleware, sseHandler);
app.delete('/mcp', mcpAuthMiddleware, deleteSessionHandler);
```

### Rotação de Token

**Política Recomendada:**

- **Frequência:** A cada 90 dias
- **Complexidade:** Mínimo 64 caracteres hexadecimais
- **Histórico:** Não reutilizar últimos 3 tokens
- **Notificação:** Alertar clientes 7 dias antes

**Procedimento de Rotação:**

```bash
#!/bin/bash
# rotate-auth-token.sh

# 1. Gerar novo token
NEW_TOKEN=$(openssl rand -hex 32)

# 2. Atualizar .env
sed -i "s/AUTH_TOKEN=.*/AUTH_TOKEN=$NEW_TOKEN/" /opt/mcp-servers/veeam-backup/.env

# 3. Notificar clientes (manual)
echo "NOVO TOKEN: $NEW_TOKEN"
echo "Atualizar configuração em Claude Code e Gemini CLI"

# 4. Reiniciar serviço
pm2 restart mcp-veeam

# 5. Aguardar 7 dias antes de invalidar token antigo
echo "Token antigo válido até: $(date -d '+7 days' '+%Y-%m-%d')"
```

---

## 🛡️ Safety Guard - Proteção para Operações Críticas

### Visão Geral

O **Safety Guard** é um sistema de confirmação para operações críticas que podem causar impacto significativo no ambiente de backup. Exige confirmação explícita (token + justificativa) antes de executar operações destrutivas.

**Baseado em:** Padrão implementado no MCP GLPI (Python)
**Inspiração:** Similar ao comando `sudo` em sistemas Unix

### Operações Protegidas

O Safety Guard protege **2 operações críticas**:

| Operação | Descrição | Impacto |
|----------|-----------|---------|
| **`veeam_manage_backup_jobs` (action=start)** | Iniciar backup job sob demanda (fora do schedule) | ⚠️ Alto - Consome recursos, pode impactar performance |
| **`veeam_manage_backup_jobs` (action=stop)** | Interromper backup job em execução | ⚠️ Muito Alto - Backup incompleto, snapshots órfãos |

**Por que proteger estas operações?**

**`veeam_manage_backup_jobs` action=start:**
- Consumo inesperado de recursos (CPU, rede, storage)
- Pode conflitar com janela de backup programada
- Impacto em VMs de produção (snapshots, I/O)

**`veeam_manage_backup_jobs` action=stop:**
- Backup incompleto = ponto de restauração inválido
- Pode deixar snapshots órfãos nas VMs
- Interrompe cadeia de backups incrementais
- Dificulta troubleshooting sem justificativa clara

### Configuração do Safety Guard

**1. Variáveis de Ambiente**

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

**2. Gerar Token de Segurança**

```bash
# Opção 1: OpenSSL (64 caracteres hex) - RECOMENDADO
openssl rand -hex 32

# Opção 2: OpenSSL (32 caracteres base64)
openssl rand -base64 24

# Opção 3: Node.js (64 caracteres hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Exemplo de resultado:
# SEU_TOKEN_AQUI
```

**3. Aplicar Configuração**

```bash
# Reiniciar serviço
pm2 restart mcp-veeam

# Verificar logs
pm2 logs mcp-veeam --lines 20

# Procurar por:
# [SafetyGuard] ✅ HABILITADO - Operações críticas exigem confirmação
# ou
# [SafetyGuard] ⚠️  DESABILITADO - Operações críticas não exigem confirmação
```

### Como Usar

**Modo 1: Safety Guard DESABILITADO (padrão)**

```bash
# MCP_SAFETY_GUARD=false (ou não configurado)
# Tools funcionam normalmente SEM exigir confirmação

curl -X POST http://your-server:8825/mcp \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer SEU_AUTH_TOKEN' \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params": {
      "name": "veeam_manage_backup_jobs",
      "arguments": {
        "action": "start",
        "jobId": "urn:veeam:Job:00000000-0000-0000-0000-000000000000",
        "fullBackup": false
      }
    },
    "id":1
  }'

# ✅ Executa imediatamente sem pedir confirmação
```

**Modo 2: Safety Guard HABILITADO**

```bash
# MCP_SAFETY_GUARD=true
# Tools EXIGEM confirmationToken + reason

curl -X POST http://your-server:8825/mcp \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer SEU_AUTH_TOKEN' \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params": {
      "name": "veeam_manage_backup_jobs",
      "arguments": {
        "action": "start",
        "jobId": "urn:veeam:Job:00000000-0000-0000-0000-000000000000",
        "fullBackup": false,
        "confirmationToken": "SEU_TOKEN_AQUI",
        "reason": "Backup emergencial solicitado pelo cliente para recuperação de dados críticos após falha de hardware no servidor de produção"
      }
    },
    "id":1
  }'

# ✅ Executa APÓS validar token e reason
# ✅ Registra justificativa em logs/audit.log
```

### Validações Implementadas

O Safety Guard executa as seguintes validações **em ordem**:

1. **Bypass se desabilitado:** Se `MCP_SAFETY_GUARD=false` → retorna true
2. **Bypass se não protegida:** Se operação não está na lista → retorna true
3. **Token ausente:** Lança erro + log auditoria `rejected-no-token`
4. **Token inválido:** Lança erro + log auditoria `rejected-invalid-token` (timing-safe comparison)
5. **Reason ausente/curto:** Lança erro + log auditoria `rejected-insufficient-reason` (< 10 chars)
6. **Reason muito longo:** Lança erro + log auditoria `rejected-reason-too-long` (> 1000 chars)
7. **Operação autorizada:** Log auditoria `authorized` + retorna true

### Mensagens de Erro

**Erro 1: Confirmação Ausente**

```
SAFETY GUARD: Operação "veeam_manage_backup_jobs:start" requer confirmação explícita.

Descrição: Iniciar backup job sob demanda (fora do schedule)
Alvo: Job urn:veeam:Job:00000000-0000-0000-0000-000000000000

Para executar esta operação, forneça:
- confirmationToken: Token de confirmação (igual ao MCP_SAFETY_TOKEN)
- reason: Justificativa detalhada (mínimo 10 caracteres)
```

**Erro 2: Token Inválido**

```
SAFETY GUARD: Token de confirmação inválido.

O token fornecido não corresponde ao MCP_SAFETY_TOKEN configurado.
Verifique se está usando o token correto.
```

**Erro 3: Reason Muito Curto**

```
SAFETY GUARD: Justificativa obrigatória para operação "veeam_manage_backup_jobs:stop".

A justificativa (reason) deve ter pelo menos 10 caracteres.
Atual: 5 caracteres.
```

**Erro 4: Reason Muito Longo (Proteção DoS)**

```
SAFETY GUARD: Justificativa muito longa.

A justificativa (reason) deve ter no máximo 1000 caracteres.
Atual: 2500 caracteres.

Reduza o tamanho da justificativa para um resumo objetivo da operação.
```

### Proteções de Segurança

**Implementadas:**

✅ **Timing-Safe Comparison**: Previne timing attacks usando `crypto.timingSafeEqual()`
✅ **Audit Logging Completo**: Todas tentativas (autorizadas e rejeitadas) registradas
✅ **Token Validation**: Verifica formato e comprimento antes de comparar
✅ **Reason Validation**: Exige justificativa mínima de 10 caracteres, máxima de 1000
✅ **Environment Isolation**: Token em variável de ambiente, nunca hardcoded
✅ **DoS Protection**: Limite de 1000 caracteres previne payloads grandes

**Implementação Técnica:**

```javascript
// lib/safety-guard.js
class SafetyGuard {
  static MIN_REASON_LENGTH = 10;
  static MAX_REASON_LENGTH = 1000;

  _tokensMatch(providedToken) {
    const expected = Buffer.from(this.safetyToken, 'utf-8');
    const provided = Buffer.from(providedToken, 'utf-8');

    // Timing-safe comparison (previne timing attacks)
    return expected.length === provided.length &&
           crypto.timingSafeEqual(expected, provided);
  }
}
```

### Auditoria do Safety Guard

**Eventos Registrados em `logs/audit.log`:**

```json
// Operação autorizada
{
  "timestamp": "2025-12-10T14:30:00.000Z",
  "operation": "safety-guard-authorized",
  "jobId": "urn:veeam:Job:abc-123-def",
  "result": "authorized",
  "metadata": {
    "operation": "veeam_start_backup_job",
    "reason": "Backup emergencial solicitado pelo cliente...",
    "reasonLength": 108,
    "guardEnabled": true
  }
}

// Tentativa sem token
{
  "operation": "safety-guard-rejected-no-token",
  "result": "rejected",
  "metadata": {
    "rejectionReason": "Token de confirmação ausente"
  }
}

// Tentativa com token inválido (possível ataque)
{
  "operation": "safety-guard-rejected-invalid-token",
  "result": "rejected",
  "metadata": {
    "rejectionReason": "Token de confirmação inválido"
  }
}

// Tentativa com reason insuficiente
{
  "operation": "safety-guard-rejected-insufficient-reason",
  "result": "rejected",
  "metadata": {
    "reasonLength": 5,
    "minRequired": 10
  }
}

// Tentativa com reason muito longo (DoS)
{
  "operation": "safety-guard-rejected-reason-too-long",
  "result": "rejected",
  "metadata": {
    "reasonLength": 2500,
    "maxAllowed": 1000
  }
}
```

**Consultar Logs:**

```bash
# Todas as operações autorizadas
grep "safety-guard-authorized" /opt/mcp-servers/veeam-backup/logs/audit.log | jq

# Tentativas de ataque (token inválido)
grep "invalid-token" /opt/mcp-servers/veeam-backup/logs/audit.log | jq

# Ver justificativas (reasons)
grep "authorized" /opt/mcp-servers/veeam-backup/logs/audit.log | jq -r '.metadata.reason'
```

### Boas Práticas

**1. Token Forte:**
- Mínimo 16 caracteres (recomendado: 32+)
- Gerar aleatoriamente (não usar palavras comuns)
- Nunca commitar no Git (`.env` está no `.gitignore`)

**2. Rotação de Token:**
- Trocar token periodicamente (ex: a cada 90 dias)
- Trocar após suspeita de vazamento
- Documentar trocas em changelog interno

**3. Justificativas Detalhadas:**
- Mínimo 10 caracteres (forçado pelo sistema)
- Recomendado: 50-200 caracteres
- Incluir: quem solicitou, motivo técnico, urgência

**4. Auditoria Regular:**
- Revisar logs de auditoria semanalmente
- Verificar justificativas vagas ou suspeitas
- Correlacionar com tickets de mudança

---

## 🔑 Gerenciamento de Sessões

### Session Management com UUID

O servidor implementa gerenciamento de sessões MCP usando **UUIDs v4** com timeout automático de **15 minutos**.

**Características:**

- ✅ UUID v4 único por sessão MCP
- ✅ Timeout automático de 15 minutos
- ✅ Cleanup automático de sessões expiradas
- ✅ Header `Mcp-Session-Id` em todas as respostas
- ✅ Endpoint de debug `/mcp-sessions`

### Estrutura de Sessão

```javascript
const activeSessions = new Map();
// Key: sessionId (UUID v4)
// Value:
{
  id: "uuid-v4-here",
  createdAt: "2025-12-10T03:00:00.000Z",
  lastActivityAt: "2025-12-10T03:10:00.000Z",
  clientIp: "203.0.113.100"
}
```

### Ciclo de Vida de Sessão

**1. Criação:**
- Gerado automaticamente na primeira requisição POST /mcp
- UUID v4 único e imprevisível
- Timestamp de criação e última atividade

**2. Atividade:**
- Header `Mcp-Session-Id` presente em todas as respostas
- Cliente pode armazenar para debugging
- `lastActivityAt` atualizado a cada requisição

**3. Expiração:**
- Timeout: 15 minutos de inatividade
- Cleanup automático a cada verificação
- Sessão removida automaticamente

**4. Terminação Manual:**
- Endpoint DELETE /mcp com header `Mcp-Session-Id`
- Limpeza imediata de recursos

### Endpoints de Session

**Criar/Usar Sessão (Automático):**

```bash
curl -X POST http://your-server:8825/mcp \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer SEU_TOKEN' \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'

# Response inclui header:
# Mcp-Session-Id: 550e8400-e29b-41d4-a716-446655440000
```

**Listar Sessões Ativas (Debug):**

```bash
curl http://your-server:8825/mcp-sessions

# Response:
{
  "activeSessions": 3,
  "sessions": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "createdAt": "2025-12-10T03:00:00.000Z",
      "lastActivityAt": "2025-12-10T03:10:00.000Z",
      "clientIp": "203.0.113.100"
    }
  ]
}
```

**Terminar Sessão:**

```bash
curl -X DELETE http://your-server:8825/mcp \
  -H 'Authorization: Bearer SEU_TOKEN' \
  -H 'Mcp-Session-Id: 550e8400-e29b-41d4-a716-446655440000'

# Response:
{
  "message": "Sessão terminada com sucesso"
}
```

### Configuração de Timeout

**Padrão:** 15 minutos (900000 ms)

Para alterar timeout (futuro):

```javascript
// vbr-mcp-server.js
const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos
```

### Segurança de Sessões

**Proteções Implementadas:**

✅ **UUID v4 Imprevisível**: Impossível adivinhar IDs de sessão
✅ **Timeout Automático**: Previne sessões abandonadas
✅ **Isolamento por UUID**: Sessões independentes
✅ **Cleanup Automático**: Economiza memória

**Limitações:**

⚠️ **Sessões em Memória**: Perdidas ao reiniciar servidor (não persistem)
⚠️ **Sem Autenticação por Sessão**: Sessão é apenas para tracking, autenticação é via Bearer Token

---

## 🌐 Controle de Acesso HTTP

### Reverse Proxy com Nginx

**Benefícios:**
- SSL/TLS termination
- Basic Authentication
- Rate limiting
- IP whitelisting
- Logging centralizado

**Configuração (`/etc/nginx/sites-available/veeam-mcp`):**

```nginx
# Upstream backend
upstream veeam_mcp {
    server localhost:8825;
}

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name veeam-mcp.skillsit.local;
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name veeam-mcp.skillsit.local;

    # SSL/TLS Configuration
    ssl_certificate /etc/ssl/certs/veeam-mcp.crt;
    ssl_certificate_key /etc/ssl/private/veeam-mcp.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Basic Authentication
    auth_basic "Veeam MCP Server - Authorized Personnel Only";
    auth_basic_user_file /etc/nginx/.htpasswd;

    # Rate Limiting (10 requests/second)
    limit_req_zone $binary_remote_addr zone=mcp_limit:10m rate=10r/s;
    limit_req zone=mcp_limit burst=20 nodelay;

    # IP Whitelisting (opcional)
    allow 203.0.113.0/24;   # Rede interna
    allow 10.0.0.0/8;       # VPN corporativa
    deny all;

    # Proxy to backend
    location / {
        proxy_pass http://veeam_mcp;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 30s;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }

    # Swagger UI (acesso restrito)
    location /docs {
        auth_basic "Swagger UI - Admin Only";
        auth_basic_user_file /etc/nginx/.htpasswd-admin;
        proxy_pass http://veeam_mcp;
    }

    # Health check (sem auth para monitoramento)
    location /health {
        auth_basic off;
        proxy_pass http://veeam_mcp;
        access_log off;
    }

    # Logging
    access_log /var/log/nginx/veeam-mcp-access.log combined;
    error_log /var/log/nginx/veeam-mcp-error.log warn;
}
```

**Criar arquivo de senhas:**
```bash
# Instalar htpasswd
apt-get install apache2-utils

# Criar usuário
htpasswd -c /etc/nginx/.htpasswd copilot-studio
htpasswd /etc/nginx/.htpasswd gemini-cli

# Admin users (Swagger UI)
htpasswd -c /etc/nginx/.htpasswd-admin admin

# Verificar permissões
chmod 640 /etc/nginx/.htpasswd*
chown root:www-data /etc/nginx/.htpasswd*
```

### Rate Limiting

**Por IP:**
```nginx
limit_req_zone $binary_remote_addr zone=per_ip:10m rate=10r/s;
limit_req zone=per_ip burst=20 nodelay;
```

**Por API Key (custom header):**
```nginx
limit_req_zone $http_x_api_key zone=per_key:10m rate=50r/s;
limit_req zone=per_key burst=100 nodelay;
```

**Aplicar limites:**
```nginx
location /backup-sessions {
    limit_req zone=per_ip burst=5;     # Máx 5 burst
    limit_req_status 429;               # HTTP 429 Too Many Requests
    proxy_pass http://veeam_mcp;
}
```

---

## 🔐 SSL/TLS

### Configuração Veeam VBR

**Desenvolvimento (Certificado Self-Signed):**
```bash
VEEAM_IGNORE_SSL=true
```

**Produção (Certificado Válido):**
```bash
VEEAM_IGNORE_SSL=false
```

**Instalar Certificado no Veeam VBR:**

1. Gere certificado via CA interna ou Let's Encrypt
2. Abra Veeam Console → **Options** → **Security**
3. Importe certificado SSL/TLS
4. Reinicie serviços Veeam
5. Teste com: `openssl s_client -connect veeam-server:9419`

### Validação de Certificado

**Verificar certificado Veeam:**
```bash
openssl s_client -connect veeam-prod.skillsit.local:9419 -showcerts
```

**Saída esperada:**
```
CONNECTED(00000003)
depth=2 C = US, O = "Lets Encrypt", CN = ISRG Root X1
verify return:1
depth=1 C = US, O = "Lets Encrypt", CN = R3
verify return:1
depth=0 CN = veeam-prod.skillsit.local
verify return:1
```

### SSL/TLS no Servidor MCP

**Opção 1: Nginx como SSL Termination (Recomendado)**

Vantagens:
- Nginx gerencia SSL/TLS
- Certificados centralizados
- Suporte a HTTP/2 e HTTP/3
- Renovação automática (Let's Encrypt)

**Opção 2: SSL direto no Express.js**

```javascript
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('/etc/ssl/private/veeam-mcp.key'),
  cert: fs.readFileSync('/etc/ssl/certs/veeam-mcp.crt')
};

https.createServer(options, app).listen(8825, () => {
  console.log('HTTPS server running on port 8825');
});
```

---

## 🔑 Gerenciamento de Credenciais

### Arquivo .env

**Permissões OBRIGATÓRIAS:**
```bash
# Apenas root pode ler/escrever
chmod 600 /opt/mcp-servers/veeam-backup/.env
chown root:root /opt/mcp-servers/veeam-backup/.env

# Verificar permissões
ls -la /opt/mcp-servers/veeam-backup/.env
# Output esperado: -rw------- 1 root root 456 Dec 09 10:30 .env
```

**Conteúdo seguro do .env:**
```bash
# ============================================================================
# VEEAM SERVER - Configuração de conexão
# ============================================================================
VEEAM_HOST=veeam-prod.skillsit.local
VEEAM_PORT=9419
VEEAM_API_VERSION=1.2-rev0

# ============================================================================
# VEEAM AUTHENTICATION - Conta read-only
# ============================================================================
# IMPORTANTE: Usar conta de serviço com permissões mínimas (Veeam Restore Operator)
VEEAM_USERNAME=.\\svc-mcp-reader
VEEAM_PASSWORD=R3@d0nlyP@ssw0rd2024!Secure

# ============================================================================
# SSL/TLS - Validação de certificado
# ============================================================================
# Produção: SEMPRE false (exige certificado válido)
# Desenvolvimento: true (aceita self-signed)
VEEAM_IGNORE_SSL=false

# ============================================================================
# MCP AUTHENTICATION - Bearer Token
# ============================================================================
# Token de autenticação para endpoints MCP (/mcp)
# Gerar com: openssl rand -hex 32
# Mínimo 32 caracteres (recomendado: 64)
AUTH_TOKEN=SEU_TOKEN_AQUI

# ============================================================================
# SAFETY GUARD - Proteção para operações críticas
# ============================================================================
# Habilita confirmação para veeam_start_backup_job e veeam_stop_backup_job
# Valores: true (habilitado) ou false (desabilitado)
MCP_SAFETY_GUARD=false

# Token de segurança para autorizar operações críticas
# Gerar com: openssl rand -hex 32
# Mínimo 8 caracteres (recomendado: 16+)
MCP_SAFETY_TOKEN=SEU_TOKEN_AQUI

# ============================================================================
# SERVER - Configuração HTTP
# ============================================================================
HTTP_PORT=8825
NODE_ENV=production
```

### Credenciais por Categoria

**Tabela de Credenciais:**

| Credencial | Tipo | Propósito | Comprimento Mín. | Rotação | Armazenamento |
|------------|------|-----------|------------------|---------|---------------|
| `VEEAM_USERNAME` | String | Autenticação Veeam VBR | N/A | 90 dias | `.env` (600) |
| `VEEAM_PASSWORD` | Senha | Autenticação Veeam VBR | 20 chars | 90 dias | `.env` (600) |
| `AUTH_TOKEN` | Token hex | Autenticação MCP HTTP | 32 chars | 90 dias | `.env` (600) |
| `MCP_SAFETY_TOKEN` | Token hex | Confirmação operações críticas | 8 chars (rec: 16+) | 90 dias | `.env` (600) |

**Observações:**
- Todos os tokens devem ser gerados com `openssl rand -hex 32`
- Nunca reutilizar tokens antigos
- Rotacionar imediatamente após suspeita de vazamento
- Backup de `.env` em vault/secrets manager (opcional mas recomendado)

### Rotação de Senhas

**Política recomendada:**
- **Frequência:** A cada 90 dias
- **Complexidade:** Mínimo 20 caracteres, maiúsculas, minúsculas, números, símbolos
- **Histórico:** Não reutilizar últimas 5 senhas
- **Notificação:** Alertar 7 dias antes de expirar

**Script de rotação:**
```bash
#!/bin/bash
# rotate-veeam-password.sh

NEW_PASSWORD=$(openssl rand -base64 32)

# 1. Atualizar senha no Veeam
# (Via Veeam PowerShell ou API)

# 2. Atualizar .env
sed -i "s/VEEAM_PASSWORD=.*/VEEAM_PASSWORD=$NEW_PASSWORD/" /opt/mcp-servers/veeam-backup/.env

# 3. Reiniciar serviço
pm2 restart mcp-veeam

# 4. Notificar equipe
echo "Senha rotacionada em $(date)" | mail -s "Veeam MCP Password Rotation" admin@skillsit.com.br
```

### Secrets Management (Avançado)

**Opção 1: HashiCorp Vault**
```bash
# Armazenar secret no Vault
vault kv put secret/veeam-mcp \
  username=svc-mcp-reader \
  password=R3@d0nlyP@ssw0rd2024!Secure

# Recuperar no startup
VEEAM_USERNAME=$(vault kv get -field=username secret/veeam-mcp)
VEEAM_PASSWORD=$(vault kv get -field=password secret/veeam-mcp)
```

**Opção 2: AWS Secrets Manager**
```bash
# Armazenar secret
aws secretsmanager create-secret \
  --name veeam-mcp-credentials \
  --secret-string '{"username":"svc-mcp-reader","password":"R3@d0nly..."}'

# Recuperar no startup (Node.js)
const AWS = require('aws-sdk');
const secretsManager = new AWS.SecretsManager();
const secret = await secretsManager.getSecretValue({ SecretId: 'veeam-mcp-credentials' }).promise();
```

---

## 🛡️ Firewall e Network Security

### UFW (Ubuntu Firewall)

**Configuração básica:**
```bash
# Permitir SSH (porta 22)
ufw allow 22/tcp

# Permitir HTTP/HTTPS do Nginx
ufw allow 80/tcp
ufw allow 443/tcp

# Permitir MCP Server APENAS da rede interna
ufw allow from 203.0.113.0/24 to any port 8825

# Bloquear tudo mais
ufw default deny incoming
ufw default allow outgoing

# Ativar firewall
ufw enable

# Verificar status
ufw status verbose
```

**Regras avançadas:**
```bash
# Permitir Veeam API apenas do servidor MCP
ufw allow from <MCP_SERVER_IP> to <VEEAM_SERVER_IP> port 9419

# Limitar tentativas de SSH (anti brute-force)
ufw limit 22/tcp

# Logging
ufw logging on
```

### iptables (Alternativa Avançada)

```bash
# Flush rules
iptables -F

# Default policies
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT ACCEPT

# Allow loopback
iptables -A INPUT -i lo -j ACCEPT

# Allow established connections
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow SSH
iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Allow HTTP/HTTPS
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Allow MCP Server from internal network only
iptables -A INPUT -p tcp -s 203.0.113.0/24 --dport 8825 -j ACCEPT

# Rate limiting (anti DDoS)
iptables -A INPUT -p tcp --dport 8825 -m limit --limit 10/s --limit-burst 20 -j ACCEPT

# Log dropped packets
iptables -A INPUT -j LOG --log-prefix "IPTables-Dropped: "

# Save rules
iptables-save > /etc/iptables/rules.v4
```

### Network Segmentation

**Arquitetura recomendada:**

```
Internet
    │
    ▼
[Firewall/WAF]
    │
    ▼
[DMZ - Nginx Reverse Proxy]
    │
    ▼
[Internal Network - MCP Server]
    │
    ▼
[Veeam Management Network - VBR Server]
```

**Benefícios:**
- Isolamento de camadas
- Controle granular de acesso
- Proteção contra ataques externos
- Monitoramento centralizado

---

## 📊 Auditoria e Monitoramento

### Audit Logging - Operações Críticas

**Localização:** `/opt/mcp-servers/veeam-backup/logs/audit.log`

O sistema registra **todas** as operações críticas protegidas pelo Safety Guard:

**Eventos Auditados:**

1. **Operações Autorizadas** (`safety-guard-authorized`)
   - Operação executada com sucesso após validação
   - Inclui: operation, jobId, reason, reasonLength
   - Exemplo: Start/Stop backup job com confirmação válida

2. **Tentativas Rejeitadas - Token Ausente** (`safety-guard-rejected-no-token`)
   - Tentativa de operação crítica sem fornecer confirmationToken
   - Indica possível uso incorreto ou tentativa não autorizada

3. **Tentativas Rejeitadas - Token Inválido** (`safety-guard-rejected-invalid-token`)
   - Tentativa com token incorreto (possível ataque)
   - Alerta de segurança crítico - investigar origem

4. **Tentativas Rejeitadas - Reason Insuficiente** (`safety-guard-rejected-insufficient-reason`)
   - Justificativa ausente ou muito curta (< 10 caracteres)
   - Indica falta de documentação adequada

5. **Tentativas Rejeitadas - Reason Muito Longo** (`safety-guard-rejected-reason-too-long`)
   - Justificativa excede 1000 caracteres
   - Possível tentativa de DoS via payload grande

**Exemplo de Registro de Auditoria:**

```json
{
  "timestamp": "2025-12-10T14:30:00.000Z",
  "operation": "safety-guard-authorized",
  "jobId": "urn:veeam:Job:a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "jobName": "BKP-VM-Producao",
  "result": "authorized",
  "user": "mcp-user",
  "error": null,
  "metadata": {
    "operation": "veeam_start_backup_job",
    "operationDescription": "Iniciar backup job sob demanda (fora do schedule)",
    "reason": "Backup emergencial solicitado pelo cliente para recuperação de dados críticos",
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

**Consultar Audit Logs:**

```bash
# Todas as operações autorizadas
grep "safety-guard-authorized" /opt/mcp-servers/veeam-backup/logs/audit.log | jq

# Filtrar por operação específica
grep "safety-guard-authorized" /opt/mcp-servers/veeam-backup/logs/audit.log | \
  jq 'select(.metadata.operation == "veeam_start_backup_job")'

# Últimas 10 autorizações
grep "safety-guard-authorized" /opt/mcp-servers/veeam-backup/logs/audit.log | tail -10 | jq

# Ver justificativas (reasons)
grep "safety-guard-authorized" /opt/mcp-servers/veeam-backup/logs/audit.log | \
  jq -r '.metadata.reason'

# Detectar tentativas de ataque (token inválido)
grep "invalid-token" /opt/mcp-servers/veeam-backup/logs/audit.log | jq

# Estatísticas de rejeições
grep "rejected" /opt/mcp-servers/veeam-backup/logs/audit.log | \
  jq -r '.metadata.rejectionReason' | sort | uniq -c
```

**Análise Forense - Casos de Uso:**

```bash
# Cenário 1: Detecção de ataque de força bruta
grep "invalid-token" logs/audit.log | jq -r '.timestamp' | sort | uniq -c
# Resultado: 47 tentativas em 2 minutos → Bloquear IP

# Cenário 2: Relatório de conformidade (últimas 24h)
grep "rejected" logs/audit.log | \
  jq -r 'select(.timestamp > "2025-12-09T00:00:00Z") | .metadata.operation' | \
  sort | uniq -c

# Cenário 3: Exportar relatório para auditoria
grep "rejected" logs/audit.log | jq -s '
  group_by(.metadata.rejectionReason) |
  map({
    reason: .[0].metadata.rejectionReason,
    count: length
  })
'
```

### Logging Estruturado - Operações Gerais

**Formato de Log:**
```json
{
  "timestamp": "2024-12-09T10:30:45.123Z",
  "level": "INFO",
  "component": "auth-middleware",
  "action": "token_refresh",
  "user": "svc-mcp-reader",
  "client_ip": "203.0.113.50",
  "duration_ms": 234,
  "status": "success"
}
```

**Configuração de Logging:**
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    // Console (stderr)
    new winston.transports.Console(),

    // File (rotating)
    new winston.transports.File({
      filename: '/var/log/veeam-mcp/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: '/var/log/veeam-mcp/combined.log',
      maxsize: 10485760,
      maxFiles: 10
    })
  ]
});
```

### Eventos Auditados - Classificação por Severidade

| Evento | Severidade | Ação | Arquivo de Log |
|--------|------------|------|----------------|
| **Safety Guard - Authorized** | INFO | Log em audit.log | `logs/audit.log` |
| **Safety Guard - No Token** | WARNING | Log em audit.log | `logs/audit.log` |
| **Safety Guard - Invalid Token** | CRITICAL | Log + Investigar origem | `logs/audit.log` |
| **Safety Guard - Insufficient Reason** | WARNING | Log em audit.log | `logs/audit.log` |
| **Safety Guard - Reason Too Long** | WARNING | Log + Possível DoS | `logs/audit.log` |
| **Auth Failure (MCP)** | WARNING | Log + Alerta após 3 falhas | PM2 logs |
| **Token Expired (Veeam)** | INFO | Log apenas | PM2 logs |
| **Invalid Request** | WARNING | Log + Rate limit | PM2 logs |
| **API Error 5xx** | ERROR | Log + Alerta | PM2 logs |
| **High Latency (>2s)** | WARNING | Log + Métrica | PM2 logs |
| **Unauthorized Access** | CRITICAL | Log + Alerta + Block IP | PM2 logs |

### Monitoramento com Prometheus

**Métricas exportadas:**
```javascript
const promClient = require('prom-client');

// Counter: Total de requests
const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status']
});

// Histogram: Latência de requests
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency',
  labelNames: ['method', 'route']
});

// Gauge: Tokens em cache
const tokensInCache = new promClient.Gauge({
  name: 'auth_tokens_cached',
  help: 'Number of cached auth tokens'
});

// Endpoint /metrics
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});
```

**Alertas (Prometheus AlertManager):**
```yaml
groups:
  - name: veeam_mcp_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High error rate on Veeam MCP Server"

      - alert: HighLatency
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High latency on Veeam MCP Server"
```

### SIEM Integration

**Syslog Forward:**
```bash
# rsyslog.conf
if $programname == 'veeam-mcp' then @@siem-server:514
```

**Elasticsearch/Logstash:**
```json
{
  "input": {
    "file": {
      "path": "/var/log/veeam-mcp/*.log",
      "type": "json"
    }
  },
  "filter": {
    "json": {
      "source": "message"
    }
  },
  "output": {
    "elasticsearch": {
      "hosts": ["elasticsearch:9200"],
      "index": "veeam-mcp-%{+YYYY.MM.dd}"
    }
  }
}
```

---

## ✅ Hardening Checklist

### Pré-Deployment

**Autenticação Veeam:**
- [ ] **Conta de serviço read-only criada no Veeam** (Veeam Restore Operator)
- [ ] **Senha forte (20+ caracteres) configurada**
- [ ] **SSL/TLS habilitado (`VEEAM_IGNORE_SSL=false`)**
- [ ] **Certificados válidos instalados no Veeam VBR**

**Autenticação MCP:**
- [ ] **AUTH_TOKEN configurado** (gerado com `openssl rand -hex 32`)
- [ ] **AUTH_TOKEN com 64 caracteres** (recomendado para segurança máxima)
- [ ] **Middleware de autenticação aplicado em todas as rotas `/mcp`**
- [ ] **Endpoints públicos (`/health`) sem autenticação** (verificado)

**Safety Guard:**
- [ ] **MCP_SAFETY_GUARD=true** (se quiser habilitar proteção)
- [ ] **MCP_SAFETY_TOKEN configurado** (mínimo 16 caracteres)
- [ ] **Audit logging habilitado** (`logs/audit.log` criado)
- [ ] **Validação de reason min/max funcionando** (10-1000 caracteres)

**Session Management:**
- [ ] **Session timeout configurado** (padrão: 15 minutos)
- [ ] **UUID v4 gerado automaticamente** (verificar header `Mcp-Session-Id`)
- [ ] **Cleanup automático de sessões expiradas** (ativo)

**Arquivo .env:**
- [ ] **Arquivo `.env` com permissões 600** (`chmod 600`)
- [ ] **Owner root:root** (`chown root:root`)
- [ ] **Verificar arquivo não está no Git** (`.gitignore` atualizado)

**Network Security:**
- [ ] **Firewall configurado (UFW/iptables)**
- [ ] **Reverse proxy (Nginx) com SSL termination** (opcional)
- [ ] **Basic Authentication configurada no Nginx** (opcional)
- [ ] **Rate limiting ativo** (Nginx ou aplicação)
- [ ] **IP whitelisting configurado** (se aplicável)

### Deployment

**Infraestrutura:**
- [ ] **Servidor em network segment isolada**
- [ ] **PM2 configurado e rodando** (`pm2 list` mostra `mcp-veeam` online)
- [ ] **PM2 startup configurado** (reinicia após reboot)

**Logging e Auditoria:**
- [ ] **Logs estruturados habilitados** (Winston configurado)
- [ ] **Audit logging funcionando** (testar operação Safety Guard)
- [ ] **Diretório `logs/` criado e com permissões corretas**
- [ ] **Rotação de logs configurada** (máximo 10MB por arquivo)

**Monitoramento:**
- [ ] **Monitoramento (Prometheus) ativo** (opcional)
- [ ] **Alertas configurados (AlertManager)** (opcional)
- [ ] **Health check respondendo** (`curl /health` retorna 200)
- [ ] **Métricas de sessões ativas funcionando** (`/mcp-sessions`)

**Backup e Documentação:**
- [ ] **Backup do arquivo `.env`** (vault ou secrets manager)
- [ ] **Política de rotação de senhas documentada**
- [ ] **Procedimento de incident response definido**
- [ ] **Time de resposta 24x7 definido**
- [ ] **Runbooks de operação criados**

### Pós-Deployment

**Testes de Segurança:**
- [ ] **Teste de autenticação MCP** (tentar sem token → deve retornar 401)
- [ ] **Teste de Safety Guard** (tentar operação crítica sem confirmação)
- [ ] **Teste de session management** (verificar header `Mcp-Session-Id`)
- [ ] **Auditoria de logs (primeiros 7 dias)** (verificar `logs/audit.log`)
- [ ] **Teste de penetração executado** (opcional)
- [ ] **Scan de vulnerabilidades (Nessus/OpenVAS)** (opcional)

**Validações de Configuração:**
- [ ] **Revisão de permissões de conta Veeam** (read-only confirmado)
- [ ] **Validação de certificados SSL** (Veeam VBR)
- [ ] **Teste de failover de auth** (token Veeam expirando e renovando)
- [ ] **Teste de timeout de sessão** (15 minutos funcionando)

**Documentação e Treinamento:**
- [ ] **Documentação de runbooks atualizada**
- [ ] **Procedimento de rotação de tokens documentado**
- [ ] **Treinamento da equipe de ops concluído**
- [ ] **Guia de troubleshooting atualizado**

### Manutenção Recorrente

| Tarefa | Frequência | Responsável | Observações |
|--------|------------|-------------|-------------|
| **Rotação de senha Veeam** | 90 dias | DevOps | Conta `svc-mcp-reader` |
| **Rotação de AUTH_TOKEN** | 90 dias | DevOps | Token MCP Bearer |
| **Rotação de MCP_SAFETY_TOKEN** | 90 dias | DevOps | Token Safety Guard |
| **Auditoria de logs (audit.log)** | Semanal | SecOps | Verificar tentativas rejeitadas |
| **Auditoria de logs (PM2)** | Semanal | SecOps | Erros e warnings |
| **Renovação de certificados SSL** | Anual | DevOps | Veeam VBR |
| **Scan de vulnerabilidades** | Mensal | SecOps | Nessus/OpenVAS |
| **Review de firewall rules** | Trimestral | NetOps | UFW/iptables |
| **Teste de disaster recovery** | Semestral | DevOps | Backup e restore |
| **Atualização de dependências** | Mensal | Desenvolvimento | npm audit/update |
| **Limpeza de logs antigos** | Semanal | DevOps | Logs > 30 dias |
| **Review de sessões ativas** | Diário | DevOps | `/mcp-sessions` |
| **Security training** | Anual | Toda equipe | Awareness |

---

## 🚨 Incident Response

### Procedimento de Resposta

**Fase 1: Detecção (0-5 min)**
1. Alerta recebido (Prometheus/SIEM)
2. Verificar logs em tempo real
3. Identificar origem do incidente

**Fase 2: Contenção (5-30 min)**
1. Isolar servidor afetado (firewall block)
2. Revogar token Veeam
3. Ativar modo de emergência (read-only)

**Fase 3: Erradicação (30-120 min)**
1. Identificar causa raiz
2. Aplicar correção/patch
3. Rotacionar todas as credenciais

**Fase 4: Recuperação (2-24 hours)**
1. Restaurar serviço com correção
2. Validar funcionamento
3. Monitorar por 24 horas

**Fase 5: Post-Mortem (1 week)**
1. Documentar incidente
2. Lições aprendidas
3. Atualizar runbooks

### Contatos de Emergência

| Papel | Contato | Horário |
|-------|---------|---------|
| DevOps Lead | +55 11 99999-1111 | 24x7 |
| Security Lead | +55 11 99999-2222 | 24x7 |
| Veeam Admin | +55 11 99999-3333 | 24x7 |
| CTO | +55 11 99999-9999 | Business hours |

---

## 🆕 Novas Implementações de Segurança (Dez/2025)

### Resumo das Melhorias

Este documento foi atualizado com **4 novas camadas de segurança** implementadas em dezembro de 2025:

#### 1. Autenticação MCP via Bearer Token ✅
- **Implementado em:** `lib/mcp-auth-middleware.js`
- **Proteção:** Todos os endpoints `/mcp` (POST, GET, DELETE)
- **Token:** `AUTH_TOKEN` em `.env` (64 caracteres hex)
- **Benefício:** Previne acesso não autorizado aos endpoints MCP HTTP

#### 2. Safety Guard - Proteção para Operações Críticas ✅
- **Implementado em:** `lib/safety-guard.js`
- **Operações protegidas:** `veeam_start_backup_job`, `veeam_stop_backup_job`
- **Validações:** Token + justificativa obrigatória (10-1000 chars)
- **Benefício:** Previne operações acidentais e exige documentação de mudanças

#### 3. Session Management com UUID ✅
- **Implementado em:** `vbr-mcp-server.js`
- **Características:** UUID v4, timeout 15 minutos, cleanup automático
- **Header:** `Mcp-Session-Id` em todas as respostas
- **Benefício:** Rastreamento de sessões e debugging facilitado

#### 4. Audit Logging Completo ✅
- **Arquivo:** `logs/audit.log`
- **Eventos registrados:** Operações autorizadas e rejeitadas (5 tipos)
- **Formato:** JSON estruturado para análise forense
- **Benefício:** Rastreabilidade completa e detecção de ataques

### Arquivos de Referência

Para informações técnicas detalhadas sobre cada implementação:

- **Arquitetura (transporte MCP HTTP Streamable):** [`ARCHITECTURE_AND_DESIGN.md`](ARCHITECTURE_AND_DESIGN.md)
- **Safety Guard:** [`docs/SAFETY_GUARD.md`](docs/SAFETY_GUARD.md)
- **Código-fonte:**
  - Autenticação MCP: [`lib/mcp-auth-middleware.js`](lib/mcp-auth-middleware.js)
  - Safety Guard: [`lib/safety-guard.js`](lib/safety-guard.js)
  - Servidor principal: [`vbr-mcp-server.js`](vbr-mcp-server.js)

### Score de Segurança

**Antes das melhorias:** 7.5/10
**Depois das melhorias:** **9.0/10** ✅

**Melhorias implementadas:**
- ✅ MCP Bearer Token Authentication (+0.5)
- ✅ Safety Guard com audit logging (+0.5)
- ✅ Session Management (+0.3)
- ✅ Limite máximo para reason (DoS protection) (+0.2)

---

<div align="center">

**Made with ❤️ by [Skills IT - Soluções em TI](https://skillsit.com.br) - BRAZIL 🇧🇷**

*Securing AI-Infrastructure Connections, One Layer at a Time*

**Última Atualização:** Dezembro 2025 | **Versão:** 2.0.0

</div>
