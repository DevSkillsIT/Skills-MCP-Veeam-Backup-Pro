# Guia de Segurança - Veeam Backup MCP Server

**Práticas de segurança e hardening para deployment em produção**

---

## 📑 Índice

- [Visão Geral de Segurança](#-visão-geral-de-segurança)
- [Autenticação Veeam](#-autenticação-veeam)
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
    allow 192.168.1.0/24;   # Rede interna
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
# Veeam Server
VEEAM_HOST=veeam-prod.skillsit.local
VEEAM_PORT=9419
VEEAM_API_VERSION=1.2-rev0

# Authentication (usar conta read-only)
VEEAM_USERNAME=.\\svc-mcp-reader
VEEAM_PASSWORD=R3@d0nlyP@ssw0rd2024!Secure

# SSL (sempre false em produção)
VEEAM_IGNORE_SSL=false

# Server
HTTP_PORT=8825
NODE_ENV=production
```

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
ufw allow from 192.168.1.0/24 to any port 8825

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
iptables -A INPUT -p tcp -s 192.168.1.0/24 --dport 8825 -j ACCEPT

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

### Logging Estruturado

**Formato de Log:**
```json
{
  "timestamp": "2024-12-09T10:30:45.123Z",
  "level": "INFO",
  "component": "auth-middleware",
  "action": "token_refresh",
  "user": "svc-mcp-reader",
  "client_ip": "192.168.1.50",
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

### Eventos Auditados

| Evento | Severidade | Ação |
|--------|------------|------|
| **Auth Failure** | WARNING | Log + Alerta após 3 falhas |
| **Token Expired** | INFO | Log apenas |
| **Invalid Request** | WARNING | Log + Rate limit |
| **API Error 5xx** | ERROR | Log + Alerta |
| **High Latency (>2s)** | WARNING | Log + Métrica |
| **Unauthorized Access** | CRITICAL | Log + Alerta + Block IP |

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

- [ ] **Conta de serviço read-only criada no Veeam**
- [ ] **Senha forte (20+ caracteres) configurada**
- [ ] **Arquivo `.env` com permissões 600**
- [ ] **SSL/TLS habilitado (`VEEAM_IGNORE_SSL=false`)**
- [ ] **Certificados válidos instalados no Veeam VBR**
- [ ] **Firewall configurado (UFW/iptables)**
- [ ] **Reverse proxy (Nginx) com SSL termination**
- [ ] **Basic Authentication configurada no Nginx**
- [ ] **Rate limiting ativo**
- [ ] **IP whitelisting configurado**

### Deployment

- [ ] **Servidor em network segment isolada**
- [ ] **Logs estruturados habilitados**
- [ ] **Monitoramento (Prometheus) ativo**
- [ ] **Alertas configurados (AlertManager)**
- [ ] **Backup do arquivo `.env`**
- [ ] **Política de rotação de senhas documentada**
- [ ] **Procedimento de incident response definido**
- [ ] **Time de resposta 24x7 definido**

### Pós-Deployment

- [ ] **Auditoria de logs (primeiros 7 dias)**
- [ ] **Teste de penetração executado**
- [ ] **Scan de vulnerabilidades (Nessus/OpenVAS)**
- [ ] **Revisão de permissões de conta**
- [ ] **Validação de certificados SSL**
- [ ] **Teste de failover de auth**
- [ ] **Documentação de runbooks atualizada**
- [ ] **Treinamento da equipe de ops concluído**

### Manutenção Recorrente

| Tarefa | Frequência | Responsável |
|--------|------------|-------------|
| Rotação de senhas | 90 dias | DevOps |
| Renovação de certificados | Anual | DevOps |
| Auditoria de logs | Semanal | SecOps |
| Scan de vulnerabilidades | Mensal | SecOps |
| Review de firewall rules | Trimestral | NetOps |
| Teste de disaster recovery | Semestral | DevOps |
| Atualização de dependências | Mensal | Desenvolvimento |
| Security training | Anual | Toda equipe |

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

<div align="center">

**Made with ❤️ by [Skills IT - Soluções em TI](https://skillsit.com.br) - BRAZIL 🇧🇷**

*Securing AI-Infrastructure Connections, One Layer at a Time*

</div>
