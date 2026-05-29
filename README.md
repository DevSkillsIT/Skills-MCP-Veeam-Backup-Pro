<div align="center">

# 🔵 Veeam Backup & Replication MCP Server

### **Hybrid MCP Architecture for Veeam VBR**

**Conecte IA ao Veeam Backup & Replication através de Protocolo MCP Moderno**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![MCP Protocol](https://img.shields.io/badge/MCP-2024--11--05%20HTTP%20Streamable-purple.svg)](https://modelcontextprotocol.io/)
[![Tools](https://img.shields.io/badge/Tools-12-orange.svg)](#-ferramentas-disponíveis)
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
> 📞 **WhatsApp/Telefone:** (63) 3224-4925 - Brasil
> 🌐 **Website:** skillsit.com.br 📧 **Email:** contato@skillsit.com.br
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

### 🛠️ 12 Ferramentas Veeam (v2.0.0)

| Categoria | Ferramenta | Descrição |
|-----------|------------|-----------|
| **Busca** | `veeam_search_backup_jobs` | Jobs de backup (VMs, replicação, cópia) |
| **Busca** | `veeam_search_backup_sessions` | Sessions/histórico de execuções |
| **Busca** | `veeam_search_restore_points` | Pontos de restauração de VMs |
| **Busca** | `veeam_search_infrastructure` | Proxies e repositórios de backup |
| **Gerenciamento** | `veeam_manage_backup_jobs` | Detalhes, schedule, iniciar ou parar jobs |
| **Gerenciamento** | `veeam_manage_backup_sessions` | Logs de sessions para troubleshooting |
| **Consulta** | `veeam_get_license_compliance` | Licenciamento, compliance e workloads |
| **Consulta** | `veeam_get_server_info` | Versão do VBR, banco de dados, build |
| **Bridge** | `veeam_list_mcp_resources` | Catálogo de resources MCP disponíveis |
| **Bridge** | `veeam_read_mcp_resource` | Leitura de resources via URI veeam:// |
| **Bridge** | `veeam_list_mcp_prompts` | Catálogo de 15 prompts disponíveis |
| **Bridge** | `veeam_get_mcp_prompt` | Execução de prompt/workflow específico |

**Pattern:** `search_*` (somente leitura) / `manage_*` (leitura + escrita) / `get_*` (recurso único)

**🔍 Busca Semântica:** Ferramentas `veeam_search_backup_jobs` e `veeam_search_restore_points` suportam busca semântica inteligente (multi-palavra, normalização de acentos, busca parcial).

### v2.0.0 Melhorias

- **91% redução de tokens**: Respostas Markdown em vez de JSON bruto
- **12 tools consolidadas**: Pattern search_*/manage_*/get_* (Block recommendation)
- **Tool Annotations**: readOnlyHint, destructiveHint, openWorldHint em todas as tools
- **Server Instructions**: Guia operacional para LLM no initialize
- **MCP Resources**: Dados estáticos (server-info, license) via URI veeam://
- **Bridge Tools MCPHub**: Resources e Prompts acessíveis via tools
- **Validação UUID**: Erros claros antes de chamar API
- **Testes automatizados**: 74 testes (unit + integration)

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
AUTH_TOKEN=SEU_TOKEN_AQUI
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

## Ferramentas Disponíveis (v2.0.0)

O Veeam MCP v2.0.0 consolidou as 17 ferramentas originais em 12 ferramentas otimizadas seguindo o padrão search_*/manage_*/get_* (Block recommendation). Todas as respostas são formatadas em Markdown (redução de ~91% em tokens vs JSON bruto).

### Ferramentas de Busca (search_*) — Somente Leitura

| Tool | Descrição | Parâmetros Principais |
|---|---|---|
| `veeam_search_backup_jobs` | Jobs de backup, cópia e jobs derivados de sessões (Agent/replica/site remoto) | `nameFilter` (job OU nome de VM), `descriptionFilter`, `typeFilter`, `stateFilter` |
| `veeam_search_backup_sessions` | Sessions/histórico de execuções | `statusFilter`, `scope`, `hours`, `from`/`to`, **`groupByJob`** (1 linha por job) |
| `veeam_search_restore_points` | Pontos de restauração de VMs (com span de retenção) | `vmName` ou `vmId`, `from`/`to` |
| `veeam_search_infrastructure` | Proxies e repositórios (status CRÍTICO/ATENÇÃO/OFFLINE) | `type` (proxies/repositories), `threshold` |

### Ferramentas de Gerenciamento (manage_*) — Leitura + Escrita

| Tool | Descrição | Actions |
|---|---|---|
| `veeam_manage_backup_jobs` | Detalhes, schedule, iniciar ou parar jobs | get_details, get_schedule, start, stop |
| `veeam_manage_backup_sessions` | Logs de sessions para troubleshooting | get_log (com logLevel filter) |

### Ferramentas de Consulta (get_*) — Somente Leitura

| Tool | Descrição |
|---|---|
| `veeam_get_license_compliance` | Licenciamento, compliance e workloads protegidos |
| `veeam_get_server_info` | Versão do VBR, banco de dados, build |

### Bridge Tools MCPHub

| Tool | Descrição |
|---|---|
| `veeam_list_mcp_resources` | Catálogo de resources MCP disponíveis |
| `veeam_read_mcp_resource` | Leitura de resources via URI veeam:// |
| `veeam_list_mcp_prompts` | Catálogo de 15 prompts disponíveis |
| `veeam_get_mcp_prompt` | Execução de prompt/workflow específico |

### MCP Resources (Dados Estáticos)

| URI | Descrição |
|---|---|
| `veeam://server-info` | Informações do servidor VBR |
| `veeam://license` | Dados de licenciamento e workloads |

### Recursos Avançados (alinhados ao código atual)

- **`groupByJob=true`** em `search_backup_sessions`: agrega as N tentativas de cada job em **uma linha** (último resultado, tentativas, falhas), com jobs falhando no topo — a visão de saúde do ambiente.
- **Cobertura híbrida**: `search_backup_jobs` encontra jobs fora do inventário `/jobs` (Veeam Agent, replica, backup copy, site remoto) derivando-os do histórico de sessões. Busca também por **nome de VM** dentro do job.
- **Datas flexíveis** (`from`/`to`): aceitam ISO (`2026-05-28`), BR (`28/05/2026 05:30`) e natural (`ontem`, `últimas 6 horas`, `7 dias`).
- **Resolução nome→UUID**: `manage_backup_jobs` aceita o nome (parcial) do job; se casar vários, retorna os candidatos. `start`/`stop` exigem nome exato e único.
- **`get_log` com resultado por VM**: em jobs multi-VM, detalha quais VMs falharam e a causa de cada uma (aba *Statistics* do console), agrupando VMs com o mesmo erro.
- **Span de retenção**: `search_restore_points` mostra o primeiro e o último ponto da VM, e retorna candidatos quando o nome casa várias VMs distintas.

### Exemplos de Uso

**Buscar sessions com falha das últimas 24h:**
```bash
curl -X POST http://localhost:8825/mcp \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"veeam_search_backup_sessions","arguments":{"statusFilter":"Failed","hours":24,"limit":10}},"id":1}'
```

**Ver detalhes de um job:**
```bash
curl -X POST http://localhost:8825/mcp \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"veeam_manage_backup_jobs","arguments":{"action":"get_details","jobId":"UUID-DO-JOB"}},"id":1}'
```

**Verificar uso de repositórios:**
```bash
curl -X POST http://localhost:8825/mcp \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"veeam_search_infrastructure","arguments":{"type":"repositories"}},"id":1}'
```

### Tool Annotations

Todas as ferramentas possuem annotations MCP para segurança automática:

| Annotation | Significado | Exemplo |
|---|---|---|
| `readOnlyHint: true` | Não modifica dados (auto-aprovável) | search_*, get_* |
| `destructiveHint: true` | Pode modificar dados (requer confirmação) | manage_backup_jobs (start/stop) |
| `openWorldHint: true` | Acessa API externa (latência possível) | Todas exceto list_mcp_* |
| `idempotentHint: true` | Chamadas repetidas são seguras | search_*, get_* |

### Formato de Resposta: Markdown

Todas as respostas são formatadas em Markdown (tabelas), não JSON bruto:

```markdown
**5 resultados** | Pagina 1 (total: 9646, limit: 5)

| ID | Nome | Tipo | Resultado | Inicio | Duracao | Progresso |
|---|---|---|---|---|---|---|
| 12dc2486... | BKP-JOB-LOCAL-SK-PMW... | BackupJob | Sucesso | 22/03/2026 12:00 | 5 min | 100% |
```

Benefícios do Markdown vs JSON bruto:
- **91% menos tokens** por resposta (testado com dados reais)
- Tabelas legíveis diretamente no chat
- Paginação com informação de total

### Limites de Paginação

| Parâmetro | Default | Máximo |
|---|---|---|
| `limit` | 35 | 50 |
| `skip` | 0 | — |

Limites otimizados para evitar token explosion. Use `skip` para navegar páginas.

---

## 🔐 Nota sobre Safety Guard

As ações **start** e **stop** de `veeam_manage_backup_jobs` são protegidas por **Tool Annotations** (`destructiveHint: true`) devido ao impacto potencial:

- **Requerem confirmação explícita** via token
- **Justificativa obrigatória** com mínimo 10 caracteres
- **Logs de auditoria** registram quem executou e por quê
- **Podem ser desabilitados** via `MCP_SAFETY_GUARD=false` no `.env` (NÃO recomendado em produção)

**Como obter o token:**
O token está configurado no `.env` do servidor MCP como `MCP_SAFETY_TOKEN`.

---

## 📋 MCP Prompts

Este MCP oferece **15 prompts profissionais** (workflows pré-configurados) que guiam você através de operações complexas de Veeam Backup & Replication usando linguagem natural.

**O Que São Prompts MCP?**
Prompts são templates de conversação reutilizáveis que estruturam tarefas multi-passo em workflows guiados. Em vez de executar uma única ação, prompts orquestram múltiplas ferramentas e fornecem análises contextuais.

**Como Usar Prompts:**
- **Claude Code:** Use o comando `/prompt` seguido do nome do prompt
- **Claude Desktop:** Digite "use prompt [nome]" na conversação
- **Gemini CLI:** Use o comando `gemini prompt [nome]`

### Categorias de Prompts

Os prompts estão organizados em **duas categorias** para diferentes perfis de usuário:

| Categoria | Público-Alvo | Foco | Quantidade |
|-----------|--------------|------|------------|
| **Gestores** | Gerentes, Diretores, CIOs | Dashboards executivos, relatórios estratégicos, compliance, custos | 7 prompts |
| **Analistas** | Técnicos, Admins, DevOps | Troubleshooting, operações práticas, guias de restore | 8 prompts |

---

### 🎯 Prompts para Gestores (7)

Foco em visão estratégica, compliance e relatórios executivos (formato compacto, ideal para WhatsApp/Teams).

| Prompt | Descrição | Argumentos |
|--------|-----------|------------|
| `veeam_backup_health_summary` | Resumo executivo de saúde dos backups com taxa de sucesso e alertas críticos | `period_days` (opcional, padrão 7) |
| `veeam_storage_growth_forecast` | Previsão de crescimento de storage com projeção de capacidade | `forecast_months` (opcional, padrão 3) |
| `veeam_backup_cost_analysis` | Análise de custo de backup por cliente com otimizações recomendadas | `client_name` (opcional) |
| `veeam_recovery_sla_compliance` | Compliance de RTO/RPO e aderência aos SLAs de recuperação | `period_days` (opcional, padrão 30) |
| `veeam_backup_success_rate` | Taxa de sucesso de backups por job com tendências e alertas | `period_days` (opcional, padrão 7) |
| `veeam_repository_capacity` | Capacidade de repositórios com alertas de espaço e previsão de esgotamento | `threshold_percent` (opcional, padrão 80) |
| `veeam_vm_protection_coverage` | Cobertura de proteção de VMs, identificando VMs não protegidas | `client_name` (opcional) |

### 🔧 Prompts para Analistas Técnicos (8)

Foco em troubleshooting, operações práticas e guias de restore.

| Prompt | Descrição | Argumentos |
|--------|-----------|------------|
| `veeam_failed_job_investigation` | Investigação detalhada de job falhado com logs e troubleshooting | `job_id` (**obrigatório**) |
| `veeam_restore_point_lookup` | Busca de restore points disponíveis para uma VM específica | `vm_name` (**obrigatório**) |
| `veeam_restore_guide` | Guia passo-a-passo para restauração de VM/arquivo | `vm_name` (**obrigatório**), `restore_type` (opcional) |
| `veeam_backup_validation` | Validação de integridade de backup com teste de restore | `vm_name` (**obrigatório**) |
| `veeam_vm_backup_history` | Histórico completo de backups de uma VM com estatísticas de performance | `vm_name` (**obrigatório**), `period_days` (opcional) |
| `veeam_repository_space_alert` | Alerta de espaço em repositório com análise de crescimento | `repository_name` (**obrigatório**) |
| `veeam_job_status` | Status rápido de jobs de backup com última execução e próxima janela | `job_name` (opcional) |
| `veeam_tape_job_status` | Status de jobs de fita com última gravação e mídia utilizada | `tape_job_name` (opcional) |

> 💡 Cada prompt inclui uma linha **🛠️ Ferramentas** que indica quais tools acionar (ex.: `groupByJob=true` para saúde, busca por nome de VM, `get_log` por VM), guiando o assistente ao caminho mais eficiente.

**Como descobrir e executar (via MCPHub):**

- `veeam_list_mcp_prompts` — lista os 15 prompts com seus argumentos
- `veeam_get_mcp_prompt` — executa um prompt pelo `name` (+ objeto `arguments`). Argumentos obrigatórios ausentes retornam um erro claro em pt-BR (ex.: falta `job_id`).

```bash
# Exemplo: investigar um job que falhou
curl -X POST http://localhost:8825/mcp \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"veeam_get_mcp_prompt","arguments":{"name":"veeam_failed_job_investigation","arguments":{"job_id":"BKP-JOB-LOCAL-..."}}},"id":1}'
```

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
        "Authorization": "Bearer SEU_TOKEN_AQUI"
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
        "Authorization": "Bearer SEU_TOKEN_AQUI"
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
1. Claude chama `veeam_search_backup_sessions` com statusFilter="Failed" e hours=24
2. Recebe resultado já filtrado e formatado em Markdown
3. Apresenta tabela com jobs falhados

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
1. Claude chama `veeam_search_infrastructure` com type="repositories"
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
1. Claude chama `veeam_manage_backup_jobs` com action="get_details" e jobId
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
1. Claude chama `veeam_get_license_compliance`
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
   ufw allow from 203.0.113.0/24 to any port 8825
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
