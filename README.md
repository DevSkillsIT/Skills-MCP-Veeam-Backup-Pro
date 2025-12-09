<div align="center">

# 🔵 Veeam Backup & Replication MCP Server

### **Hybrid MCP Architecture for Veeam VBR**

**Conecte IA ao Veeam Backup & Replication através de Protocolo MCP Moderno**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![MCP Protocol](https://img.shields.io/badge/MCP-2024--11--05-purple.svg)](https://modelcontextprotocol.io/)
[![Tools](https://img.shields.io/badge/Tools-7-orange.svg)](#-ferramentas-disponíveis)
[![Status](https://img.shields.io/badge/Status-Production%20Ready-success.svg)](#)

<p align="center">
  <strong>Made with ❤️ by <a href="https://skillsit.com.br">Skills IT - Soluções em TI</a> - BRAZIL 🇧🇷</strong>
</p>

</div>

---

## 📑 Índice

- [Visão Geral](#-visão-geral)
- [Por Que Arquitetura Híbrida?](#-por-que-arquitetura-híbrida)
- [Comparação: Hybrid vs MCPO](#-comparação-hybrid-vs-mcpo)
- [Principais Recursos](#-principais-recursos)
- [Arquitetura](#-arquitetura)
- [Instalação](#-instalação)
- [Configuração](#-configuração)
- [Modo de Uso](#-modo-de-uso)
- [Ferramentas Disponíveis](#-ferramentas-disponíveis)
- [Integração com IDEs](#-integração-com-ides)
- [Exemplos Práticos](#-exemplos-práticos)
- [Segurança](#-segurança)
- [Contribuindo](#-contribuindo)
- [Licença](#-licença)
- [Créditos](#-créditos)
- [Suporte](#-suporte)

---

## 🎯 Visão Geral

O **Veeam Backup & Replication MCP Server** é uma implementação híbrida do **Model Context Protocol (MCP)** que permite que assistentes de IA (Claude, ChatGPT, Gemini) interajam diretamente com sua infraestrutura de backup Veeam VBR através de linguagem natural.

### O Que É MCP?

**Model Context Protocol (MCP)** é um protocolo aberto que permite que modelos de IA acessem dados contextuais e executem ações em sistemas externos de forma estruturada e segura.

### O Que Este MCP Faz?

Permite que você faça perguntas e execute ações no Veeam VBR usando linguagem natural:

- ✅ "Mostre todos os jobs de backup que falharam hoje"
- ✅ "Qual o status atual dos repositórios de backup?"
- ✅ "Liste os últimos 5 backups do servidor SQL-PROD"
- ✅ "Quantas licenças Veeam tenho disponíveis?"
- ✅ "Me mostre informações detalhadas do job 'VM-Production-Backup'"

Tudo isso sem sair do chat da IA!

---

## 🏗️ Por Que Arquitetura Híbrida?

Este não é apenas mais um MCP Server. É uma **arquitetura híbrida única** que resolve um problema real:

### ❌ Problema Comum

Servidores MCP tradicionais funcionam apenas com clientes MCP nativos (como Claude Desktop via stdio). Para usar com outras ferramentas (Copilot Studio, APIs web), você precisa:

1. Instalar um proxy externo (como MCPO)
2. Configurar roteamento entre proxy e MCP
3. Gerenciar dois serviços separados
4. Debugar duas camadas de comunicação

### ✅ Solução Híbrida

Nosso servidor executa **dois protocolos simultaneamente** em um único processo:

1. **Modo MCP (stdio)**: Para Claude Desktop, Claude Code
2. **Modo HTTP (REST)**: Para Copilot Studio, Gemini CLI, APIs web
3. **Modo Híbrido**: Ambos ao mesmo tempo (recomendado)

**Resultado:** Um servidor, uma configuração, zero dependências externas.

---

## 📊 Comparação: Hybrid vs MCPO

| Característica | **Hybrid (Este Projeto)** | **MCPO (Proxy Externo)** | **MCP Tradicional** |
|----------------|---------------------------|--------------------------|---------------------|
| **Arquitetura** | MCP + HTTP integrados | MCP → Proxy → HTTP | Apenas MCP (stdio) |
| **Deployment** | ✅ Único serviço | ⚠️ Dois serviços | ✅ Único serviço |
| **Performance** | ✅ Zero overhead | ⚠️ Hop adicional | ✅ Direto |
| **Complexidade** | ✅ Simples | ⚠️ Complexo | ✅ Simples |
| **Claude Desktop** | ✅ Suportado | ✅ Suportado | ✅ Suportado |
| **Copilot Studio** | ✅ Suportado | ✅ Suportado | ❌ Não suportado |
| **APIs Web/Custom** | ✅ Suportado | ✅ Suportado | ❌ Não suportado |
| **Swagger UI** | ✅ Incluído | ⚠️ Depende do proxy | ❌ Não disponível |
| **Manutenção** | ✅ Um codebase | ⚠️ Dois codebases | ✅ Um codebase |
| **Logs** | ✅ Centralizados | ⚠️ Dois streams | ✅ Centralizados |
| **Autenticação** | ✅ Automática | ⚠️ Manual | ⚠️ Manual |

**Conclusão:** A arquitetura híbrida oferece a **melhor relação custo-benefício** para ambientes que precisam de compatibilidade universal.

---

## 🚀 Principais Recursos

### 🔄 Arquitetura Híbrida Única

- **Modo MCP (stdio)**: Compatível com Claude Desktop e clientes MCP nativos
- **Modo HTTP (REST)**: Compatível com Copilot Studio, Gemini CLI, APIs web
- **Modo Híbrido**: Execute ambos simultaneamente (recomendado)
- **Zero Dependências Externas**: Sem necessidade de MCPO ou proxies

### 🛠️ 7 Ferramentas Veeam Abrangentes

| Categoria | Ferramenta | Descrição |
|-----------|------------|-----------|
| **Jobs** | `get-backup-jobs` | Lista todos os jobs de backup configurados |
| **Sessões** | `get-backup-sessions` | Histórico de execuções de backup |
| **Detalhes** | `get-job-details` | Informações detalhadas de job específico |
| **Infraestrutura** | `get-backup-proxies` | Status dos servidores proxy |
| **Armazenamento** | `get-backup-repositories` | Informações de repositórios |
| **Licenciamento** | `get-license-info` | Detalhes da licença Veeam |
| **Servidor** | `get-server-info` | Informações do servidor VBR |

### 🔒 Autenticação Automática Inteligente

- **Middleware Transparente**: Autenticação automática com credenciais do `.env`
- **Token Caching**: Cache de token por 55 minutos (evita re-autenticações)
- **Promise Memoization**: Previne race conditions em chamadas concorrentes
- **Zero Configuração**: Ferramentas não precisam gerenciar autenticação

### 📚 Documentação Interativa

- **Swagger UI**: Documentação interativa em `/docs`
- **OpenAPI 3.0**: Especificação completa em `/openapi.json`
- **Health Check**: Endpoint `/health` com status de autenticação
- **Exemplos de Código**: Snippets prontos para uso

### 🔧 Operação Flexível

- **3 Modos de Operação**: MCP-only, HTTP-only, Híbrido
- **PM2 Ready**: Gerenciamento de processo em produção
- **Docker Support**: Containerização completa com docker-compose
- **Environment Variables**: Configuração via `.env`

---

## 🏛️ Arquitetura

### Diagrama de Arquitetura

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Claude Desktop │    │  Copilot Studio  │    │   Gemini CLI    │
│  (MCP Client)   │    │ (OpenAPI Client) │    │ (HTTP Client)   │
└────────┬────────┘    └─────────┬────────┘    └────────┬────────┘
         │                        │                       │
         │ stdio                  │ HTTP                  │ HTTP
         │                        │                       │
         ▼                        ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│           Veeam Backup & Replication MCP Server                 │
│                     (Hybrid Architecture)                       │
│                                                                 │
│  ┌─────────────────┐         ┌─────────────────────────────────┐ │
│  │   MCP Mode      │         │      HTTP/OpenAPI Mode          │ │
│  │   (stdio)       │         │      (Express.js)               │ │
│  │                 │         │                                 │ │
│  │ • McpServer     │         │ • REST Endpoints                │ │
│  │ • Tool Registry │         │ • Swagger UI (/docs)            │ │
│  │ • stdio Transport│        │ • OpenAPI 3.0 (/openapi.json)  │ │
│  └─────────────────┘         └─────────────────────────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │        Autenticação Automática (Middleware)                 │ │
│  │  • Token Cache (55 min)                                     │ │
│  │  • Promise Memoization                                      │ │
│  │  • Refresh Automático                                       │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              7 Ferramentas Compartilhadas                   │ │
│  │  Jobs | Sessions | Details | Proxies | Repos | License | Info│ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ HTTPS (Port 9419)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│           Veeam Backup & Replication Server (VBR)               │
│                       REST API v1.2-rev0                        │
│                                                                 │
│  • Jobs de Backup          • Repositórios                       │
│  • Sessões de Backup       • Licenciamento                      │
│  • Servidores Proxy        • Configurações                      │
└─────────────────────────────────────────────────────────────────┘
```

### Fluxo de Execução

1. **Cliente** envia requisição (stdio ou HTTP)
2. **Middleware** autentica automaticamente com Veeam (cache de token)
3. **Tool Handler** executa lógica de negócio
4. **Veeam API** processa requisição e retorna dados
5. **Resposta** formatada retorna ao cliente

---

## 📦 Instalação

### Pré-requisitos

- **Node.js 20+** (LTS recomendado)
- **Veeam Backup & Replication 12+** com REST API habilitado
- **Credenciais Veeam** com permissões de leitura
- **Acesso de rede** ao servidor Veeam (porta 9419)

### Método 1: NPM Install (Recomendado)

```bash
# Clone o repositório
git clone https://github.com/skillsit/veeam-backup-mcp.git
cd veeam-backup-mcp

# Instale dependências
npm install

# Configure variáveis de ambiente
cp env.example .env
nano .env

# Inicie o servidor (modo híbrido)
npm start
```

### Método 2: Docker

```bash
# Clone o repositório
git clone https://github.com/skillsit/veeam-backup-mcp.git
cd veeam-backup-mcp

# Configure variáveis de ambiente
cp env.example .env
nano .env

# Inicie com Docker Compose
docker-compose up -d

# Verifique logs
docker-compose logs -f
```

### Método 3: PM2 (Produção)

```bash
# Instale PM2 globalmente
npm install -g pm2

# Inicie o servidor com PM2
pm2 start vbr-mcp-server.js --name mcp-veeam -- --port=8825

# Salve configuração PM2
pm2 save

# Configure PM2 para iniciar no boot
pm2 startup
```

---

## ⚙️ Configuração

### Variáveis de Ambiente (.env)

Copie `env.example` para `.env` e configure:

| Variável | Obrigatório | Descrição | Exemplo |
|----------|-------------|-----------|---------|
| `VEEAM_HOST` | ✅ **Sim** | Hostname ou IP do servidor Veeam | `veeam.empresa.com` |
| `VEEAM_PORT` | ⚠️ Opcional | Porta da API REST (padrão: 9419) | `9419` |
| `VEEAM_API_VERSION` | ⚠️ Opcional | Versão da API (padrão: 1.2-rev0) | `1.2-rev0` |
| `VEEAM_USERNAME` | ✅ **Sim** | Usuário Veeam (formato: `.\\usuário` para local) | `.\\admin` |
| `VEEAM_PASSWORD` | ✅ **Sim** | Senha do usuário Veeam | `SenhaSegura123!` |
| `VEEAM_IGNORE_SSL` | ⚠️ Opcional | Ignorar erros SSL (padrão: true) | `true` |
| `HTTP_PORT` | ⚠️ Opcional | Porta do servidor HTTP (padrão: 8825) | `8825` |
| `NODE_ENV` | ⚠️ Opcional | Ambiente de execução | `production` |

### Exemplo de Arquivo .env

```bash
# Veeam Server Configuration
VEEAM_HOST=veeam-prod.skillsit.local
VEEAM_PORT=9419
VEEAM_API_VERSION=1.2-rev0

# Authentication (Local User)
VEEAM_USERNAME=.\\veeam-admin
VEEAM_PASSWORD=SuperSecureP@ssw0rd2024

# Authentication (Domain User - Alternative)
# VEEAM_USERNAME=DOMAIN\\administrator
# VEEAM_PASSWORD=SuperSecureP@ssw0rd2024

# SSL Configuration
VEEAM_IGNORE_SSL=true

# Server Configuration
HTTP_PORT=8825
NODE_ENV=production
```

### Boas Práticas de Segurança

1. **NUNCA commite o arquivo `.env`** ao repositório Git
2. **Use contas de serviço** com permissões mínimas necessárias (read-only)
3. **Rotacione senhas regularmente** (a cada 90 dias)
4. **Habilite SSL/TLS** em produção (`VEEAM_IGNORE_SSL=false`)
5. **Restrinja acesso à porta HTTP** via firewall (apenas IPs confiáveis)
6. **Use autenticação de domínio** quando possível (mais seguro que usuário local)

---

## 🎮 Modo de Uso

### 3 Modos de Operação

#### Modo 1: Híbrido (Recomendado) ⭐

Execute ambos os protocolos simultaneamente:

```bash
# Via NPM
npm start

# Via Node.js
node vbr-mcp-server.js

# Via PM2
pm2 start vbr-mcp-server.js --name mcp-veeam -- --port=8825
```

**Use quando:**
- Você precisa de Claude Desktop **E** Copilot Studio
- Quer máxima flexibilidade
- Está em ambiente de produção

#### Modo 2: MCP-Only (stdio)

Execute apenas o protocolo MCP:

```bash
# Via NPM
npm run start:mcp

# Via Node.js
node vbr-mcp-server.js --mcp

# Via PM2
pm2 start vbr-mcp-server.js --name mcp-veeam-stdio -- --mcp
```

**Use quando:**
- Você usa apenas Claude Desktop ou Claude Code
- Não precisa de acesso HTTP/API
- Quer mínimo de overhead de rede

#### Modo 3: HTTP-Only (REST)

Execute apenas o servidor HTTP:

```bash
# Via NPM (porta padrão 8825)
npm run start:http

# Via Node.js (porta customizada)
node vbr-mcp-server.js --http --port=8825

# Via PM2
pm2 start vbr-mcp-server.js --name mcp-veeam-http -- --http --port=8825
```

**Use quando:**
- Você usa apenas Copilot Studio ou Gemini CLI
- Precisa de acesso via API REST
- Quer documentação Swagger UI

---

## 🛠️ Ferramentas Disponíveis

### 1. **get-backup-jobs** - Listar Jobs de Backup

Lista todos os jobs de backup configurados no Veeam VBR.

**Uso em Linguagem Natural:**
- "Mostre todos os jobs de backup"
- "Liste os jobs de backup configurados"
- "Quais são os jobs de backup disponíveis?"

**Curl Example:**
```bash
curl -X POST http://localhost:8825/backup-jobs \
  -H 'Content-Type: application/json' \
  -d '{}'
```

**Retorno:**
- Nome do job
- Tipo de backup (incremental, full, etc.)
- Próxima execução agendada
- Estado atual (enabled/disabled)

---

### 2. **get-backup-sessions** - Histórico de Execuções

Obtém histórico de execuções de jobs de backup (sessões).

**Uso em Linguagem Natural:**
- "Mostre os últimos backups executados"
- "Quais backups falharam hoje?"
- "Histórico de execuções do job 'VM-Production-Backup'"

**Curl Example:**
```bash
curl -X POST http://localhost:8825/backup-sessions \
  -H 'Content-Type: application/json' \
  -d '{"jobName": "VM-Production-Backup"}'
```

**Retorno:**
- Status da sessão (Success, Warning, Failed)
- Horário de início e fim
- Duração total
- Taxa de transferência
- Quantidade de dados processados

---

### 3. **get-job-details** - Detalhes Completos de Job

Obtém informações detalhadas de um job específico incluindo últimas sessões.

**Uso em Linguagem Natural:**
- "Me mostre detalhes do job 'SQL-Backup-Daily'"
- "Informações completas do backup 'VM-Production'"
- "Status detalhado do job 'Exchange-Backup'"

**Curl Example:**
```bash
curl -X POST http://localhost:8825/job-details \
  -H 'Content-Type: application/json' \
  -d '{"jobName": "VM-Production-Backup"}'
```

**Retorno:**
- Configuração completa do job
- Últimas 5 sessões de execução
- Objetos incluídos no job
- Agendamento configurado

---

### 4. **get-backup-proxies** - Status dos Proxies

Lista servidores proxy Veeam e seus status de recursos.

**Uso em Linguagem Natural:**
- "Status dos servidores proxy"
- "Quais proxies estão disponíveis?"
- "Uso de CPU/memória dos proxies"

**Curl Example:**
```bash
curl -X POST http://localhost:8825/backup-proxies \
  -H 'Content-Type: application/json' \
  -d '{}'
```

**Retorno:**
- Nome do servidor proxy
- Status (online/offline)
- Uso de CPU e memória
- Tasks concorrentes
- Capacidade máxima

---

### 5. **get-backup-repositories** - Informações de Repositórios

Obtém informações sobre repositórios de backup (armazenamento).

**Uso em Linguagem Natural:**
- "Quanto espaço livre tem nos repositórios?"
- "Status dos repositórios de backup"
- "Capacidade total dos repositórios"

**Curl Example:**
```bash
curl -X POST http://localhost:8825/backup-repositories \
  -H 'Content-Type: application/json' \
  -d '{}'
```

**Retorno:**
- Nome do repositório
- Tipo (SMB, NFS, dedup, etc.)
- Capacidade total
- Espaço livre/usado
- Percentual de utilização

---

### 6. **get-license-info** - Informações de Licença

Obtém detalhes da licença Veeam instalada.

**Uso em Linguagem Natural:**
- "Informações da licença Veeam"
- "Quantas licenças tenho disponíveis?"
- "Validade da licença Veeam"

**Curl Example:**
```bash
curl -X POST http://localhost:8825/license-info \
  -H 'Content-Type: application/json' \
  -d '{}'
```

**Retorno:**
- Tipo de licença (Essentials, Enterprise, etc.)
- Data de expiração
- Quantidade de licenças
- Licenças em uso
- Status de suporte

---

### 7. **get-server-info** - Informações do Servidor

Obtém informações sobre o servidor Veeam VBR.

**Uso em Linguagem Natural:**
- "Informações do servidor Veeam"
- "Versão do Veeam instalada"
- "Detalhes do servidor VBR"

**Curl Example:**
```bash
curl -X POST http://localhost:8825/server-info \
  -H 'Content-Type: application/json' \
  -d '{}'
```

**Retorno:**
- Nome do servidor
- Versão do Veeam VBR
- Build number
- Sistema operacional
- Uptime

---

## 🔌 Integração com IDEs

### Claude Desktop (Modo MCP stdio)

Adicione ao arquivo de configuração:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**Linux:** `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "veeam-backup": {
      "command": "node",
      "args": [
        "/opt/mcp-servers/veeam-backup/vbr-mcp-server.js",
        "--mcp"
      ]
    }
  }
}
```

**Importante:**
- Use **caminho absoluto** para o arquivo `.js`
- Use flag `--mcp` para modo stdio
- Reinicie o Claude Desktop após configurar

---

### Claude Code (Modo HTTP Streamable)

Adicione ao `.mcp.json` no workspace ou `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "veeam-backup": {
      "type": "streamable-http",
      "url": "http://localhost:8825/mcp",
      "headers": {
        "Content-Type": "application/json"
      }
    }
  }
}
```

**Nota:** Para modo HTTP, o servidor deve estar rodando com `--http` ou modo híbrido (padrão).

---

### Gemini CLI (Modo HTTP)

Adicione ao `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "veeam-backup": {
      "httpUrl": "http://localhost:8825/mcp",
      "headers": {
        "Content-Type": "application/json"
      },
      "timeout": 30000
    }
  }
}
```

---

### Copilot Studio (OpenAPI)

Configure os endpoints individuais:

- **Base URL:** `http://localhost:8825`
- **Endpoints:**
  - `POST /backup-jobs`
  - `POST /backup-sessions`
  - `POST /job-details`
  - `POST /backup-proxies`
  - `POST /backup-repositories`
  - `POST /license-info`
  - `POST /server-info`

**OpenAPI Spec:** Importe de `http://localhost:8825/openapi.json`

---

## 💼 Exemplos Práticos

### Exemplo 1: Monitorar Jobs com Falha

**Pergunta ao Claude:**
> "Mostre todos os jobs de backup que falharam nas últimas 24 horas"

**Processo:**
1. Claude chama `get-backup-sessions` para obter histórico
2. Filtra sessões com status "Failed"
3. Filtra por data (últimas 24h)
4. Apresenta resultado formatado

**Resposta Esperada:**
```
Encontrei 2 jobs com falha nas últimas 24 horas:

1. Job: SQL-Backup-Daily
   Status: Failed
   Horário: 2024-12-09 03:30
   Erro: "Network timeout during backup"

2. Job: Exchange-Full-Weekly
   Status: Failed
   Horário: 2024-12-09 01:15
   Erro: "Insufficient disk space in repository"
```

---

### Exemplo 2: Verificar Capacidade de Repositórios

**Pergunta ao Claude:**
> "Quais repositórios estão com mais de 80% de uso?"

**Processo:**
1. Claude chama `get-backup-repositories`
2. Calcula percentual de uso
3. Filtra repositórios >80%
4. Alerta sobre espaço crítico

**Resposta Esperada:**
```
⚠️ Atenção: 2 repositórios com uso crítico:

1. Repository: REPO-PRODUCTION
   Capacidade: 10 TB
   Usado: 8.5 TB (85%)
   Livre: 1.5 TB
   Recomendação: Considerar expansão em breve

2. Repository: REPO-ARCHIVE
   Capacidade: 5 TB
   Usado: 4.2 TB (84%)
   Livre: 800 GB
   Recomendação: Mover dados antigos ou expandir
```

---

### Exemplo 3: Análise de Performance de Job

**Pergunta ao Claude:**
> "Me mostre o histórico de performance do job 'VM-Production-Backup' nos últimos 7 dias"

**Processo:**
1. Claude chama `get-job-details` com nome do job
2. Analisa últimas sessões
3. Calcula médias de duração e throughput
4. Identifica tendências

**Resposta Esperada:**
```
Análise de Performance: VM-Production-Backup (últimos 7 dias)

Estatísticas:
• Execuções: 7
• Taxa de sucesso: 100%
• Duração média: 2h 15min
• Throughput médio: 450 GB/hora
• Dados processados (média): 1.2 TB por execução

Tendência:
✅ Duração estável (variação <10%)
✅ Taxa de transferência consistente
⚠️ Última execução 15min mais lenta (investigar)

Próxima execução: Hoje às 23:00
```

---

### Exemplo 4: Verificar Status de Licença

**Pergunta ao Claude:**
> "Minha licença Veeam está próxima de vencer?"

**Processo:**
1. Claude chama `get-license-info`
2. Obtém data de expiração
3. Calcula dias restantes
4. Alerta se <30 dias

**Resposta Esperada:**
```
Status da Licença Veeam:

Tipo: Veeam Backup & Replication Enterprise Plus
Licenças: 50 (48 em uso, 2 disponíveis)
Expiração: 2025-06-15
Dias restantes: 188 dias
Status de suporte: Ativo

✅ Sua licença está válida e com suporte ativo.
📅 Recomendação: Iniciar renovação 30 dias antes (15/05/2025).
```

---

## 🔒 Segurança

### Autenticação Automática

Este servidor implementa **autenticação automática transparente**:

1. **Middleware de Autenticação**: Gerencia tokens automaticamente
2. **Token Caching**: Cache de 55 minutos (evita re-autenticações desnecessárias)
3. **Promise Memoization**: Previne race conditions em requisições concorrentes
4. **Refresh Automático**: Renova token quando próximo de expirar

**Benefícios:**
- ✅ Zero configuração manual de autenticação
- ✅ Ferramentas não precisam gerenciar tokens
- ✅ Performance otimizada (menos chamadas de auth)
- ✅ Thread-safe para requisições paralelas

### SSL/TLS

**Desenvolvimento (padrão):**
```bash
VEEAM_IGNORE_SSL=true
```

**Produção (recomendado):**
```bash
VEEAM_IGNORE_SSL=false
```

Para ambientes de produção:
1. Instale certificados SSL válidos no Veeam VBR
2. Configure `VEEAM_IGNORE_SSL=false`
3. Valide certificados com `openssl s_client`

### Controle de Acesso

**Recomendações:**

1. **Firewall:** Restrinja porta 8825 apenas a IPs confiáveis
   ```bash
   # Exemplo UFW (Linux)
   ufw allow from 192.168.1.0/24 to any port 8825
   ```

2. **Reverse Proxy:** Use Nginx/Apache com autenticação
   ```nginx
   # Exemplo Nginx com Basic Auth
   location / {
       auth_basic "Veeam MCP Server";
       auth_basic_user_file /etc/nginx/.htpasswd;
       proxy_pass http://localhost:8825;
   }
   ```

3. **VPN/Zerotrust:** Acesso via VPN corporativa ou solução Zerotrust

### Princípio do Menor Privilégio

Crie conta de serviço com **apenas permissões de leitura**:

1. Acesse Veeam Console
2. Crie usuário `svc-mcp-reader`
3. Atribua role **Veeam Restore Operator** (read-only)
4. Use este usuário no `.env`

```bash
VEEAM_USERNAME=.\\svc-mcp-reader
VEEAM_PASSWORD=ReadOnlyP@ssw0rd2024
```

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Este projeto segue as práticas de desenvolvimento da Skills IT.

### Processo de Contribuição

1. **Fork** o repositório
2. **Clone** seu fork localmente
3. **Crie branch** para sua feature: `git checkout -b feat/nova-feature`
4. **Desenvolva** seguindo as convenções do projeto
5. **Teste** localmente todas as mudanças
6. **Commit** seguindo Conventional Commits (português-BR):
   ```bash
   git commit -m "feat(tools): adicionar ferramenta de restore points"
   git commit -m "fix(auth): corrigir timeout em token refresh"
   git commit -m "docs(readme): atualizar exemplos de uso"
   ```
7. **Push** para seu fork: `git push origin feat/nova-feature`
8. **Abra Pull Request** com descrição detalhada

### Conventional Commits (PT-BR)

| Tipo | Descrição | Exemplo |
|------|-----------|---------|
| `feat` | Nova funcionalidade | `feat(tools): adicionar backup-repository-tool` |
| `fix` | Correção de bug | `fix(auth): corrigir race condition em token cache` |
| `docs` | Documentação | `docs(readme): adicionar seção de troubleshooting` |
| `refactor` | Refatoração de código | `refactor(auth): simplificar lógica de middleware` |
| `test` | Testes | `test(tools): adicionar testes para job-details-tool` |
| `chore` | Manutenção | `chore(deps): atualizar dependências` |

### Diretrizes de Código

- **Idioma:** Variáveis/funções em inglês, comentários em português-BR
- **Formatação:** Prettier com 2 espaços de indentação
- **Lint:** ESLint configurado no projeto
- **Commits:** Mensagens claras e descritivas em português-BR

---

## 📄 Licença

Este projeto está licenciado sob a **Licença MIT** - veja o arquivo [LICENSE](LICENSE) para detalhes.

**Resumo:**
- ✅ Uso comercial permitido
- ✅ Modificação permitida
- ✅ Distribuição permitida
- ✅ Uso privado permitido
- ⚠️ Sem garantias (AS-IS)

---

## 🎖️ Créditos

### Desenvolvido por

**Skills IT - Soluções em Tecnologia** 🇧🇷

- **Website:** [https://skillsit.com.br](https://skillsit.com.br)
- **Email:** contato@skillsit.com.br
- **LinkedIn:** [Skills IT](https://linkedin.com/company/skills-it)

### Inspirado por

- **Model Context Protocol (MCP)** - Anthropic
- **Jorge de la Cruz** - [Veeam MCP Original](https://github.com/jorgedlcruz/modelcontextprotocol_veeam)
- **Veeam Software** - REST API Documentation

### Tecnologias Utilizadas

- **Node.js 20+** - Runtime JavaScript
- **Express.js** - Framework HTTP
- **@modelcontextprotocol/sdk** - SDK oficial MCP
- **Swagger UI** - Documentação interativa OpenAPI
- **Docker** - Containerização

---

## 📞 Suporte

### Precisa de Ajuda?

1. **GitHub Issues:** [Abrir Issue](https://github.com/skillsit/veeam-backup-mcp/issues)
2. **Email:** contato@skillsit.com.br
3. **Documentação Adicional:**
   - [ARCHITECTURE_AND_DESIGN.md](ARCHITECTURE_AND_DESIGN.md) - Detalhes técnicos de arquitetura
   - [DEPLOYMENT.md](DEPLOYMENT.md) - Guia completo de deploy
   - [SECURITY.md](SECURITY.md) - Guia de segurança
   - [CONTRIBUTING.md](CONTRIBUTING.md) - Guia de contribuição

### Problemas Comuns

Consulte a seção de [Troubleshooting](TROUBLESHOOTING.md) para soluções de problemas comuns.

---

<div align="center">

**Made with ❤️ by [Skills IT - Soluções em TI](https://skillsit.com.br) - BRAZIL 🇧🇷**

*Connecting AI to Infrastructure, One Protocol at a Time*

</div>
