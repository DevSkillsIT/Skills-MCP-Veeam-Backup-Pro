<div align="center">

# 🔵 Veeam Backup & Replication MCP Server

### **Hybrid MCP Architecture for Veeam VBR**

**Conecte IA ao Veeam Backup & Replication através de Protocolo MCP Moderno**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![MCP Protocol](https://img.shields.io/badge/MCP-2024--11--05%20HTTP%20Streamable-purple.svg)](https://modelcontextprotocol.io/)
[![Tools](https://img.shields.io/badge/Tools-16-orange.svg)](#-ferramentas-disponíveis)
[![Status](https://img.shields.io/badge/Status-Production%20Ready-success.svg)](#)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Compatible-blue.svg)](#)
[![Gemini CLI](https://img.shields.io/badge/Gemini%20CLI-Compatible-green.svg)](#)

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

O **Veeam Backup & Replication MCP Server** é uma implementação completa do **Model Context Protocol (MCP) HTTP Streamable (2024-11-05)** que permite que assistentes de IA (Claude Code, Gemini CLI, Claude Desktop) interajam diretamente com sua infraestrutura de backup Veeam VBR através de linguagem natural, com autenticação Bearer Token e gerenciamento de sessões.

### O Que É MCP?

**Model Context Protocol (MCP)** é um protocolo aberto que permite que modelos de IA acessem dados contextuais e executem ações em sistemas externos de forma estruturada e segura.

### O Que Este MCP Faz?

Permite que você faça perguntas e execute ações no Veeam VBR usando linguagem natural:

**Monitoramento e Consultas:**
- ✅ "Mostre todos os jobs de backup que falharam hoje"
- ✅ "Qual o status atual dos repositórios de backup?"
- ✅ "Liste os últimos 5 backups do servidor SQL-PROD"
- ✅ "Quantas licenças Veeam tenho disponíveis?"
- ✅ "Me mostre informações detalhadas do job 'VM-Production-Backup'"

**Controle e Troubleshooting:**
- ✅ "Quais backups estão rodando agora?"
- ✅ "Me mostre os restore points disponíveis para a VM 'SQL-SERVER-01'"
- ✅ "Liste os jobs de backup copy configurados para compliance 3-2-1"
- ✅ "Qual o próximo agendamento do job 'Daily-Full-Backup'?"
- ✅ "Me mostre os logs detalhados da última sessão de backup do job 'Exchange-Backup'"

Tudo isso sem sair do chat da IA!

---

> 💼 **Precisa de Ajuda com Veeam Backup ou IA?**
>
> A **Skills IT - Soluções em Tecnologia** é especialista em infraestrutura de TI e domina profundamente **Veeam Backup & Replication**. Nossa equipe possui expertise em **Inteligência Artificial** e **Model Context Protocol (MCP)**, oferecendo soluções completas para automação e integração de sistemas.
>
> **Nossos Serviços:**
> - ✅ Consultoria e implementação Veeam Backup & Replication
> - ✅ Desenvolvimento de MCPs customizados para sua infraestrutura
> - ✅ Integração de IA com sistemas corporativos
> - ✅ Automação de processos de backup e recuperação
> - ✅ Treinamento e suporte especializado
>
> 📞 **WhatsApp/Telefone:** **(63) 3224-4925**
> 🌐 **Website:** [skillsit.com.br](https://skillsit.com.br)
> 📧 **Email:** contato@skillsit.com.br
> 🇧🇷 **Localização:** Palmas - TO, Brasil
>
> *"Transformando infraestrutura em inteligência"*

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

### 🛠️ 16 Ferramentas Veeam Abrangentes

| Categoria | Ferramenta | Descrição | Método | Destrutivo | Tipo |
|-----------|------------|-----------|---------|------------|------|
| **Jobs** | `get-backup-jobs` | Lista todos os jobs de backup configurados | GET | Não | Leitura |
| **Jobs** | `get-backup-copy-jobs` | Lista Backup Copy jobs (3-2-1 compliance) | GET | Não | Leitura |
| **Jobs** | `get-job-details` | Informações detalhadas de job específico | GET | Não | Leitura |
| **Jobs** | `get-job-schedule` | Detalhes de scheduling de um job | GET | Não | Leitura |
| **Sessões** | `get-backup-sessions` | Histórico de execuções de backup | GET | Não | Leitura |
| **Sessões** | `get-running-sessions` | Lista TODAS as sessions em execução (backup jobs + system tasks) | GET | Não | Leitura |
| **Sessões** | `get-running-backup-jobs` | Lista APENAS backup jobs em execução (exclui system tasks) | GET | Não | Leitura |
| **Sessões** | `get-failed-sessions` | Lista sessions que falharam (troubleshooting) | GET | Não | Leitura |
| **Sessões** | `get-session-log` | Logs detalhados de uma session | GET | Não | Leitura |
| **Restore** | `get-restore-points` | Lista restore points de uma VM | GET | Não | Leitura |
| **Infraestrutura** | `get-backup-proxies` | Status dos servidores proxy | GET | Não | Leitura |
| **Armazenamento** | `get-backup-repositories` | Informações de repositórios | GET | Não | Leitura |
| **Licenciamento** | `get-license-info` | Detalhes da licença Veeam | GET | Não | Leitura |
| **Servidor** | `get-server-info` | Informações do servidor VBR | GET | Não | Leitura |
| **Controle** | `start-backup-job` | Inicia job de backup sob demanda | POST | Sim | Escrita (Safety Guard) |
| **Controle** | `stop-backup-job` | Para job de backup em execução | POST | Sim | Escrita (Safety Guard) |

**Safety Guard:** Ferramentas de escrita requerem `confirmationToken` e `reason` para execução segura.

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

- **Protocolo MCP HTTP Streamable (2024-11-05)**: Compatível com Claude Code e Gemini CLI
- **Autenticação Bearer Token**: Segurança integrada via header Authorization
- **Session Management**: Gerenciamento de sessões com UUID e timeout de 15 minutos
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
│  │              18 Ferramentas Compartilhadas                  │ │
│  │  Jobs | Control | Sessions | Restore | Infra | License     │ │
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
git clone https://github.com/DevSkillsIT/Skills-MCP-Veeam-Backup-Pro.git
cd Skills-MCP-Veeam-Backup-Pro

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
git clone https://github.com/DevSkillsIT/Skills-MCP-Veeam-Backup-Pro.git
cd Skills-MCP-Veeam-Backup-Pro

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
| `AUTH_TOKEN` | ✅ **Sim** | Token de autenticação Bearer para MCP | `bf2571ca23445da...` |
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

# MCP HTTP Streamable Authentication
AUTH_TOKEN=bf2571ca23445da17a8415e1c8344db6e311adca2bd55d8b544723ad65f604b9
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

Descrições detalhadas das 16 ferramentas MCP com exemplos práticos, parâmetros e casos de uso reais.

---

### 1. **get-backup-jobs** - Listar Jobs de Backup

Lista todos os jobs de backup configurados no Veeam VBR com informações detalhadas sobre configuração, agendamento e última execução.

**Descrição Completa:**
Retorna lista completa de jobs de backup (ativos, desabilitados, em manutenção). Essencial para dashboards de monitoramento, validação de políticas de backup e auditoria de compliance.

**Parâmetros:**
- Nenhum (lista todos os jobs)

**Retorno JSON:**
- `id`: UUID do job (formato URN)
- `name`: Nome descritivo do job
- `type`: Tipo (Backup, BackupCopy, Replica)
- `jobType`: Subtipo (Incremental, Full, Differential)
- `isEnabled`: Se o job está habilitado
- `scheduleEnabled`: Se agendamento está ativo
- `nextRun`: Próxima execução (ISO 8601)
- `lastResult`: Resultado (Success, Warning, Failed)
- `lastRunTime`: Última execução (timestamp)
- `targetRepository`: Repositório de destino

**Casos de Uso:**
1. Dashboard de monitoramento geral
2. Auditoria de compliance (validar cobertura)
3. Planejamento de janelas de manutenção
4. Troubleshooting de jobs falhando
5. Relatórios executivos de cobertura

**Uso em Linguagem Natural:**
- "Mostre todos os jobs de backup configurados"
- "Liste jobs desabilitados"
- "Quais jobs rodam hoje à noite?"
- "Jobs que fazem backup do SQL-PROD"
- "Jobs com status Failed na última execução"

**Curl Example:**
```bash
curl -X POST http://localhost:8825/mcp \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{"name":"get-backup-jobs","arguments":{}},
    "id":1
  }'
```

---

### 2. **get-backup-copy-jobs** - Jobs de Backup Copy (3-2-1 Compliance)

Lista jobs de Backup Copy configurados para compliance com regra 3-2-1 (3 cópias, 2 mídias diferentes, 1 offsite).

**Descrição Completa:**
Backup Copy jobs replicam backups existentes para repositório secundário. Crítico para disaster recovery e compliance regulatório.

**Parâmetros:**
- Nenhum

**Retorno JSON:**
- `id`: UUID do job
- `name`: Nome do job copy
- `source`: Job de origem
- `targetRepository`: Repositório secundário
- `scheduleType`: Tipo de agendamento
- `retentionPolicy`: Política de retenção
- `isEnabled`: Status ativo/inativo

**Casos de Uso:**
1. Validar compliance 3-2-1
2. Verificar replicação offsite
3. Auditoria SOX/HIPAA
4. Planejamento de DR
5. Otimização de custos de storage

**Uso em Linguagem Natural:**
- "Liste jobs de backup copy"
- "Quais backups estão sendo replicados offsite?"
- "Jobs copy para compliance 3-2-1"
- "Backup copy com falhas"
- "Repositórios secundários em uso"

**Curl Example:**
```bash
curl -X POST http://localhost:8825/mcp \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{"name":"get-backup-copy-jobs","arguments":{}},
    "id":1
  }'
```

---

### 3. **get-job-details** - Detalhes Completos de Job Específico

Obtém informações detalhadas de um job incluindo configuração, objetos protegidos, últimas sessões e agendamento.

**Descrição Completa:**
Fornece visão completa de um job específico. Útil para troubleshooting, análise de performance e validação de configuração.

**Parâmetros:**
- `jobId`: UUID do job (obrigatório)

**Retorno JSON:**
- Configuração completa do job
- Últimas 10 sessões de execução
- Lista de VMs/objetos protegidos
- Configuração de agendamento
- Repositório alvo
- Política de retenção
- Statistics (taxa de sucesso, duração média)

**Casos de Uso:**
1. Troubleshooting de job específico
2. Análise de performance
3. Validação de objetos protegidos
4. Auditoria de configuração
5. Relatórios de SLA

**Uso em Linguagem Natural:**
- "Detalhes do job SQL-Backup-Daily"
- "Configuração completa do VM-Production"
- "Últimas execuções do Exchange-Backup"
- "Quais VMs estão no job Prod-Servers?"
- "Taxa de sucesso do job File-Server-Backup"

**Curl Example:**
```bash
curl -X POST http://localhost:8825/mcp \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{"name":"get-job-details","arguments":{"jobId":"urn:veeam:Job:..."}},
    "id":1
  }'
```

---

### 4. **get-job-schedule** - Agendamento de Job

Retorna detalhes do agendamento configurado para um job específico.

**Descrição Completa:**
Mostra quando e como um job está agendado para executar (diário, semanal, contínuo).

**Parâmetros:**
- `jobId`: UUID do job

**Retorno JSON:**
- `scheduleType`: Tipo (Daily, Weekly, Monthly, Continuous)
- `startTime`: Hora de início
- `daysOfWeek`: Dias da semana
- `retrySettings`: Configuração de retry
- `nextRun`: Próxima execução

**Casos de Uso:**
1. Planejamento de janelas de manutenção
2. Otimização de horários
3. Validação de SLA
4. Resolução de conflitos de agenda
5. Auditoria de compliance temporal

**Uso em Linguagem Natural:**
- "Quando roda o job SQL-Daily?"
- "Agendamento do VM-Production"
- "Próxima execução do Exchange-Backup"
- "Jobs que rodam às 22h"
- "Configuração de retry do FileServer-Backup"

**Curl Example:**
```bash
curl -X POST http://localhost:8825/mcp \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{"name":"get-job-schedule","arguments":{"jobId":"urn:veeam:Job:..."}},
    "id":1
  }'
```

---

### 5. **get-backup-sessions** - Histórico de Execuções de Backup

Obtém histórico de sessões de backup (execuções passadas) com filtros por job, período ou status.

**Descrição Completa:**
Retorna lista de sessões executadas com status, duração, dados processados e resultado.

**Parâmetros:**
- `jobId`: Filtrar por job (opcional)
- `limit`: Máximo de sessões (padrão: 100)
- `stateFilter`: Filtrar por estado
- `resultFilter`: Filtrar por resultado

**Retorno JSON:**
- `sessionId`: UUID da sessão
- `jobName`: Nome do job
- `state`: Estado (Working, Stopped, Failed)
- `result`: Resultado (Success, Warning, Failed)
- `startTime`: Início (ISO 8601)
- `endTime`: Fim
- `duration`: Duração total
- `processedSize`: Dados processados (bytes)
- `transferredSize`: Dados transferidos
- `avgSpeed`: Velocidade média (MB/s)

**Casos de Uso:**
1. Troubleshooting de falhas
2. Análise de performance histórica
3. Relatórios de SLA
4. Validação de janelas de backup
5. Otimização de recursos

**Uso em Linguagem Natural:**
- "Últimos 50 backups executados"
- "Backups que falharam ontem"
- "Histórico do VM-Production-Backup"
- "Sessões com warnings esta semana"
- "Backups mais lentos do mês"

**Curl Example:**
```bash
curl -X POST http://localhost:8825/mcp \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{"name":"get-backup-sessions","arguments":{"limit":50}},
    "id":1
  }'
```

---

### 6. **get-running-sessions** - Sessões em Execução (Todas)

Lista TODAS as sessões atualmente em execução (backup jobs + system tasks).

**Descrição Completa:**
Mostra tudo que está rodando no Veeam VBR neste momento, incluindo backups, replicas, copy jobs e tarefas do sistema.

**Parâmetros:**
- Nenhum

**Retorno JSON:**
- `sessionId`: UUID
- `jobName`: Nome do job
- `state`: Estado (Working)
- `progress`: Percentual (0-100)
- `currentVm`: VM sendo processada
- `startTime`: Início da sessão
- `estimatedTimeLeft`: Tempo restante estimado
- `processedObjects`: Objetos já processados
- `totalObjects`: Total de objetos

**Casos de Uso:**
1. Monitoramento em tempo real
2. Identificar jobs travados
3. Validar progresso de backups
4. Otimização de recursos
5. Troubleshooting de lentidão

**Uso em Linguagem Natural:**
- "O que está rodando agora?"
- "Backups em execução"
- "Progresso do job VM-Production"
- "Jobs travados ou lentos"
- "Qual VM está sendo processada no job SQL?"

**Curl Example:**
```bash
curl -X POST http://localhost:8825/mcp \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{"name":"get-running-sessions","arguments":{}},
    "id":1
  }'
```

---

### 7. **get-running-backup-jobs** - Backup Jobs em Execução (Filtrado)

Lista APENAS backup jobs em execução, EXCLUINDO system tasks e outros tipos de sessão.

**Descrição Completa:**
Versão filtrada de `get-running-sessions` mostrando apenas jobs de backup ativos. Ideal para dashboards focados.

**Parâmetros:**
- Nenhum

**Retorno JSON:**
- Mesmo formato de `get-running-sessions`
- Apenas jobs do tipo Backup

**Casos de Uso:**
1. Dashboard específico de backups
2. Alertas de jobs longos
3. Validação de janela de backup
4. Relatórios operacionais
5. Automação condicional

**Uso em Linguagem Natural:**
- "Quais backups estão rodando?"
- "Jobs de backup ativos agora"
- "Backups em andamento"
- "Jobs de backup há mais de 2 horas"
- "Próximo backup a iniciar"

**Curl Example:**
```bash
curl -X POST http://localhost:8825/mcp \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{"name":"get-running-backup-jobs","arguments":{}},
    "id":1
  }'
```

---

### 8. **get-failed-sessions** - Sessões com Falha (Troubleshooting)

Lista sessões que falharam nas últimas X horas. Crítico para troubleshooting e alertas.

**Descrição Completa:**
Ferramenta focada em falhas. Retorna apenas sessões Failed/Warning para análise rápida.

**Parâmetros:**
- `hours`: Janela temporal (padrão: 24h, máx: 168h)
- `limit`: Máximo de resultados

**Retorno JSON:**
- Sessões com `result`: Failed ou Warning
- `errorMessage`: Mensagem de erro
- `failedVms`: VMs que falharam
- `warningCount`: Quantidade de warnings
- `errorCode`: Código do erro Veeam

**Casos de Uso:**
1. Troubleshooting matinal
2. Alertas automáticos
3. Análise de tendências de falha
4. Priorização de correções
5. Relatórios de incidentes

**Uso em Linguagem Natural:**
- "Backups que falharam hoje"
- "Falhas nas últimas 48 horas"
- "Jobs com warnings ontem"
- "Qual erro no job SQL-Backup?"
- "VMs que falharam no último backup"

**Curl Example:**
```bash
curl -X POST http://localhost:8825/mcp \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{"name":"get-failed-sessions","arguments":{"hours":24}},
    "id":1
  }'
```

---

### 9. **get-session-log** - Logs Detalhados de Sessão

Retorna logs completos de uma sessão específica para troubleshooting profundo.

**Descrição Completa:**
Extrai logs linha a linha de uma sessão. Essencial para diagnóstico de erros complexos.

**Parâmetros:**
- `sessionId`: UUID da sessão (obrigatório)
- `logLevel`: Filtro (All, Info, Warning, Error) - padrão: All

**Retorno JSON:**
- `logs`: Array de linhas de log
- `timestamp`: Timestamp de cada linha
- `level`: Nível (Info, Warning, Error)
- `message`: Mensagem do log
- `component`: Componente Veeam

**Casos de Uso:**
1. Diagnóstico de erros específicos
2. Análise de performance granular
3. Suporte técnico Veeam
4. Auditoria detalhada
5. Troubleshooting avançado

**Uso em Linguagem Natural:**
- "Logs da última sessão do SQL-Backup"
- "Erros da sessão 123abc"
- "Log completo do backup que falhou ontem"
- "Warnings da sessão mais recente"
- "O que causou o erro no backup do Exchange?"

**Curl Example:**
```bash
curl -X POST http://localhost:8825/mcp \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{"name":"get-session-log","arguments":{"sessionId":"abc-123","logLevel":"Error"}},
    "id":1
  }'
```

---

### 10. **get-restore-points** - Restore Points de VM

Lista restore points disponíveis para uma VM específica. Essencial para planejamento de restore.

**Descrição Completa:**
Mostra todos os pontos de restauração de uma VM, incluindo data, tipo e repositório.

**Parâmetros:**
- `vmId`: ID da VM (opcional)
- `vmName`: Nome da VM (opcional)
- `limit`: Máximo de restore points

**Retorno JSON:**
- `vmName`: Nome da VM
- `restorePoints`: Array de pontos
- `creationTime`: Data de criação (ISO 8601)
- `type`: Tipo (Full, Incremental, Differential)
- `repository`: Repositório onde está
- `isConsistent`: Se é application-consistent
- `size`: Tamanho do restore point

**Casos de Uso:**
1. Planejamento de restore
2. Validação de retenção
3. Auditoria de compliance
4. Troubleshooting de missing backups
5. Relatórios de RPO

**Uso em Linguagem Natural:**
- "Restore points do SQL-SERVER-01"
- "Backups disponíveis da VM Exchange"
- "Pontos de restauração mais antigos"
- "Restore points full da VM-PROD"
- "Qual o último backup da VM-FILE-01?"

**Curl Example:**
```bash
curl -X POST http://localhost:8825/mcp \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{"name":"get-restore-points","arguments":{"vmName":"SQL-SERVER-01"}},
    "id":1
  }'
```

---

### 11. **get-backup-proxies** - Status dos Servidores Proxy

Lista proxies de backup com status de saúde, carga atual e capacidade.

**Descrição Completa:**
Proxies processam dados de backup. Monitorar saúde é crítico para performance.

**Parâmetros:**
- Nenhum

**Retorno JSON:**
- `name`: Nome do proxy
- `type`: Tipo (VMware, Hyper-V)
- `status`: Status (Online, Offline, Maintenance)
- `currentTasks`: Tarefas em execução
- `maxTasks`: Capacidade máxima
- `utilizationPercent`: % de utilização
- `host`: Host onde está instalado

**Casos de Uso:**
1. Otimização de performance
2. Balanceamento de carga
3. Troubleshooting de lentidão
4. Planejamento de capacidade
5. Monitoramento de saúde

**Uso em Linguagem Natural:**
- "Status dos proxies de backup"
- "Proxies sobrecarregados"
- "Quantos proxies estão online?"
- "Proxy com mais tarefas"
- "Capacidade disponível nos proxies"

**Curl Example:**
```bash
curl -X POST http://localhost:8825/mcp \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{"name":"get-backup-proxies","arguments":{}},
    "id":1
  }'
```

---

### 12. **get-backup-repositories** - Informações de Repositórios de Backup

Lista repositórios com capacidade, espaço livre e alertas de threshold.

**Descrição Completa:**
Repositórios armazenam backups. Monitorar espaço é crítico para evitar falhas.

**Parâmetros:**
- `threshold`: % de alerta (padrão: 20%)

**Retorno JSON:**
- `name`: Nome do repositório
- `type`: Tipo (Windows, Linux, S3, etc.)
- `path`: Caminho do storage
- `capacity`: Capacidade total (bytes)
- `freeSpace`: Espaço livre (bytes)
- `freePercent`: % livre
- `status`: Status (OK, Warning, Critical)
- `isRotatedDrive`: Se é rotated drive

**Casos de Uso:**
1. Alertas de espaço em disco
2. Planejamento de expansão
3. Otimização de retenção
4. Troubleshooting de falhas
5. Relatórios de capacidade

**Uso em Linguagem Natural:**
- "Espaço livre nos repositórios"
- "Repositórios com menos de 10% livre"
- "Capacidade total de storage"
- "Repositório mais cheio"
- "Alertas de espaço em disco"

**Curl Example:**
```bash
curl -X POST http://localhost:8825/mcp \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{"name":"get-backup-repositories","arguments":{"threshold":20}},
    "id":1
  }'
```

---

### 13. **get-license-info** - Informações de Licença Veeam

Retorna detalhes da licença Veeam: tipo, validade, capacidade e uso.

**Descrição Completa:**
Monitora licenciamento para evitar expiração e overuse. Crítico para compliance.

**Parâmetros:**
- Nenhum

**Retorno JSON:**
- `licenseType`: Tipo (Evaluation, Rental, Perpetual)
- `edition`: Edição (Community, Standard, Enterprise, Enterprise Plus)
- `expirationDate`: Data de expiração
- `status`: Status (Valid, Expired, Grace Period)
- `licensedInstances`: Instâncias licenciadas
- `usedInstances`: Instâncias em uso
- `supportExpirationDate`: Fim do suporte

**Casos de Uso:**
1. Alertas de expiração
2. Planejamento de renovação
3. Auditoria de compliance
4. Validação de capacidade
5. Relatórios executivos

**Uso em Linguagem Natural:**
- "Status da licença Veeam"
- "Quando expira minha licença?"
- "Quantas instâncias estou usando?"
- "Tenho licenças disponíveis?"
- "Edição da licença Veeam"

**Curl Example:**
```bash
curl -X POST http://localhost:8825/mcp \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{"name":"get-license-info","arguments":{}},
    "id":1
  }'
```

---

### 14. **get-server-info** - Informações do Servidor Veeam VBR

Retorna informações do servidor Veeam: versão, hostname, uptime e configuração.

**Descrição Completa:**
Visão geral do servidor Veeam. Útil para troubleshooting e auditoria.

**Parâmetros:**
- Nenhum

**Retorno JSON:**
- `serverName`: Nome do servidor
- `version`: Versão Veeam (ex: 12.1.2.172)
- `build`: Build number
- `installDate`: Data de instalação
- `databaseType`: Tipo de DB (SQL Server)
- `databaseSize`: Tamanho do DB
- `cloudConnectEnabled`: Cloud Connect ativo
- `backupServerRole`: Papel do servidor

**Casos de Uso:**
1. Validação de versão
2. Planejamento de upgrade
3. Troubleshooting de compatibilidade
4. Auditoria de infraestrutura
5. Documentação técnica

**Uso em Linguagem Natural:**
- "Versão do Veeam VBR"
- "Informações do servidor de backup"
- "Quando foi instalado o Veeam?"
- "Tamanho do banco de dados Veeam"
- "Cloud Connect está habilitado?"

**Curl Example:**
```bash
curl -X POST http://localhost:8825/mcp \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{"name":"get-server-info","arguments":{}},
    "id":1
  }'
```

---

### 15. **start-backup-job** - Iniciar Job de Backup Sob Demanda 🔐 SAFETY GUARD

Inicia execução manual de job de backup. **OPERAÇÃO CRÍTICA** protegida por Safety Guard.

**Descrição Completa:**
Dispara backup fora do agendamento. Requer confirmação explícita devido ao impacto em recursos.

**⚠️ SAFETY GUARD ATIVO:**
Esta ferramenta requer:
- `confirmationToken`: Token único de confirmação
- `reason`: Justificativa com mínimo 10 caracteres

**Parâmetros:**
- `jobId`: UUID do job (obrigatório)
- `fullBackup`: Forçar full (padrão: false)
- `reason`: Justificativa (obrigatório)
- `confirmationToken`: Token MCP_SAFETY_TOKEN

**Retorno JSON:**
- `sessionId`: UUID da sessão iniciada
- `jobName`: Nome do job
- `startTime`: Hora de início
- `estimatedDuration`: Duração estimada

**Casos de Uso:**
1. Backup emergencial antes de manutenção
2. Teste de job recém-configurado
3. Backup extra após mudanças críticas
4. Recovery de janela perdida
5. Validação de troubleshooting

**Uso em Linguagem Natural:**
- "Inicie backup do SQL-Daily agora"
- "Execute job VM-Production imediatamente"
- "Backup full do Exchange-Backup agora"
- "Dispare backup do FileServer sob demanda"
- "Inicie backup de emergência"

**Curl Example:**
```bash
curl -X POST http://localhost:8825/mcp \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{
      "name":"start-backup-job",
      "arguments":{
        "jobId":"urn:veeam:Job:...",
        "fullBackup":false,
        "reason":"Backup emergencial antes de upgrade do SQL Server",
        "confirmationToken":"seu-token-aqui"
      }
    },
    "id":1
  }'
```

---

### 16. **stop-backup-job** - Parar Job de Backup em Execução 🔐 SAFETY GUARD

Para job de backup em execução. **OPERAÇÃO DESTRUTIVA** protegida por Safety Guard.

**Descrição Completa:**
Interrompe backup em andamento. Pode causar restore points incompletos. Usar com cautela extrema.

**⚠️ SAFETY GUARD ATIVO:**
Esta ferramenta requer:
- `confirmationToken`: Token único de confirmação
- `reason`: Justificativa DETALHADA (mínimo 10 caracteres)

**⚠️ AVISO:**
Parar backup pode resultar em:
- Restore point incompleto/corrompido
- Reprocessamento na próxima execução
- Impacto no RPO

**Parâmetros:**
- `jobId`: UUID do job (obrigatório)
- `reason`: Justificativa detalhada (obrigatório)
- `confirmationToken`: Token MCP_SAFETY_TOKEN

**Retorno JSON:**
- `sessionId`: UUID da sessão parada
- `jobName`: Nome do job
- `stopTime`: Hora de parada
- `processedObjects`: Objetos já processados
- `status`: Status final

**Casos de Uso:**
1. Job travado por mais de X horas
2. Impacto em produção (lentidão)
3. Manutenção emergencial
4. Job iniciado por engano
5. Troubleshooting de problemas

**Uso em Linguagem Natural:**
- "Pare o job SQL-Backup agora"
- "Interrompa backup do VM-Production"
- "Cancele execução do Exchange-Backup"
- "Pare backup travado há 10 horas"
- "Stop do job FileServer por manutenção"

**Curl Example:**
```bash
curl -X POST http://localhost:8825/mcp \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{
      "name":"stop-backup-job",
      "arguments":{
        "jobId":"urn:veeam:Job:...",
        "reason":"Job travado há 12 horas causando lentidão no storage",
        "confirmationToken":"seu-token-aqui"
      }
    },
    "id":1
  }'
```

---

## 🔐 Nota sobre Safety Guard

As ferramentas **start-backup-job** e **stop-backup-job** são protegidas por **Safety Guard** devido ao impacto potencial:

- **Requerem confirmação explícita** via token
- **Justificativa obrigatória** com mínimo 10 caracteres
- **Logs de auditoria** registram quem executou e por quê
- **Podem ser desabilitados** via `MCP_SAFETY_GUARD=false` no `.env` (NÃO recomendado em produção)

**Como obter o token:**
O token está configurado no `.env` do servidor MCP como `MCP_SAFETY_TOKEN`.

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

### Claude Code (Modo HTTP Streamable) ⭐

Adicione ao `.mcp.json` no workspace ou `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "veeam-backup": {
      "type": "streamable-http",
      "url": "http://localhost:8825/mcp",
      "headers": {
        "Authorization": "Bearer bf2571ca23445da17a8415e1c8344db6e311adca2bd55d8b544723ad65f604b9"
      }
    }
  }
}
```

**Recursos:**
- ✅ Protocolo MCP 2024-11-05 (JSON-RPC 2.0)
- ✅ Autenticação Bearer Token obrigatória
- ✅ Session management com UUID
- ✅ 15 ferramentas disponíveis

**Endpoints Implementados:**
- `POST /mcp` - Handler JSON-RPC principal (initialize, tools/list, tools/call)
- `GET /mcp` - Server-Sent Events para notificações
- `DELETE /mcp` - Terminação de sessão graceful
- `GET /health` - Health check com info de autenticação

---

### Gemini CLI (Modo HTTP) ⭐

Adicione ao `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "veeam-backup": {
      "httpUrl": "http://localhost:8825/mcp",
      "headers": {
        "Authorization": "Bearer bf2571ca23445da17a8415e1c8344db6e311adca2bd55d8b544723ad65f604b9"
      },
      "timeout": 30000
    }
  }
}
```

**Diferenças de Configuração:**
- **Claude Code:** Usa propriedade `url`
- **Gemini CLI:** Usa propriedade `httpUrl`
- **Ambos:** Requerem header `Authorization: Bearer TOKEN`

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

1. **GitHub Issues:** [Abrir Issue](https://github.com/DevSkillsIT/Skills-MCP-Veeam-Backup-Pro/issues)
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
