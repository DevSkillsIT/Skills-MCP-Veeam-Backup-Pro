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

## Ferramentas Disponíveis (v2.0.0)

O Veeam MCP v2.0.0 consolidou as 17 ferramentas originais em 12 ferramentas otimizadas seguindo o padrão search_*/manage_*/get_* (Block recommendation). Todas as respostas são formatadas em Markdown (redução de ~91% em tokens vs JSON bruto).

### Ferramentas de Busca (search_*) — Somente Leitura

| Tool | Descrição | Parâmetros Principais |
|---|---|---|
| `veeam_search_backup_jobs` | Jobs de backup (VMs, replicação, cópia) | typeFilter, stateFilter, nameFilter, limit |
| `veeam_search_backup_sessions` | Sessions/histórico de execuções | statusFilter (Running/Failed/Success), scope, hours |
| `veeam_search_restore_points` | Pontos de restauração de VMs | vmName ou vmId |
| `veeam_search_infrastructure` | Proxies e repositórios de backup | type (proxies/repositories) |

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
| `limit` | 25 | 50 |
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

Prompts focados em **visão estratégica**, **compliance** e **relatórios executivos**.

#### 1. `veeam_backup_health_report` - Relatório de Saúde Geral do Ambiente

**Descrição:** Dashboard completo de saúde da infraestrutura de backup com análise de jobs, restore points, repositórios e SLA.

**Quando Usar:**
- Reuniões de status semanal/mensal
- Relatórios executivos
- Validação de conformidade
- Planejamento de capacidade

**Argumentos:**
- `client_filter` (opcional): Filtrar por nome do cliente MSP
- `period_days` (opcional): Janela temporal (padrão: 7 dias)
- `format` (opcional): `compact` (WhatsApp) ou `detailed` (padrão)

**O Que Este Prompt Faz:**
1. Lista todos os backup jobs e calcula taxa de sucesso geral
2. Identifica VMs críticas sem restore points recentes (>24h)
3. Verifica espaço disponível em repositórios (<20% = alerta)
4. Analisa compliance 3-2-1 via backup copy jobs
5. Calcula RPO médio e identifica VMs fora do SLA
6. Detecta jobs com falhas recorrentes (>3 falhas/semana)
7. Lista licenças próximas de vencimento (<30 dias)

**Exemplo de Uso:**
```
Claude, use o prompt veeam_backup_health_report para análise completa do ambiente
```

**Output Esperado:**
```
📊 RELATÓRIO DE SAÚDE - VEEAM BACKUP
Período: Últimos 7 dias

✅ STATUS DOS JOBS:
• Total de jobs: 25
• Taxa de sucesso: 92% (23 ok, 2 com warnings)
• Jobs falhando: Exchange-Backup (erro de rede)

⚠️ RESTORE POINTS CRÍTICOS:
• SQL-PROD-01: Último backup há 36h (SLA: 24h)
• FILE-SERVER-02: Sem restore points há 48h

💾 CAPACIDADE:
• Repositório PROD: 15% livre (1.5 TB) - OK
• Repositório ARCHIVE: 8% livre (400 GB) - ⚠️ CRÍTICO

🔄 COMPLIANCE 3-2-1:
• 18 de 25 jobs com backup copy configurado (72%)
• 7 jobs SEM replicação offsite
```

---

#### 2. `veeam_failed_jobs_analysis` - Análise de Jobs com Falha

**Descrição:** Investigação profunda de jobs que falharam, agrupando por tipo de erro e fornecendo recomendações.

**Quando Usar:**
- Troubleshooting matinal (revisar falhas da noite)
- Análise de tendências de falha
- Priorização de correções
- Relatórios de incidentes

**Argumentos:**
- `hours` (opcional): Janela temporal (padrão: 24h, máx: 168h)
- `group_by_error` (opcional): Agrupar por tipo de erro (padrão: true)
- `format` (opcional): `compact` ou `detailed`

**O Que Este Prompt Faz:**
1. Busca todas as sessões com falha nas últimas X horas
2. Agrupa falhas por tipo de erro (rede, disco, timeout, etc.)
3. Identifica jobs com falhas recorrentes
4. Extrai VMs específicas que falharam em cada job
5. Analisa logs de erro para diagnóstico
6. Fornece recomendações de correção por tipo de erro
7. Calcula impacto no RPO

**Exemplo de Uso:**
```
Claude, analise jobs que falharam nas últimas 48 horas usando veeam_failed_jobs_analysis
```

**Output Esperado:**
```
🔍 ANÁLISE DE FALHAS - ÚLTIMAS 48H

📊 RESUMO:
• Total de falhas: 5 jobs
• VMs afetadas: 12
• Impacto no RPO: 3 VMs fora do SLA

🚨 FALHAS POR TIPO:

1️⃣ TIMEOUT DE REDE (3 ocorrências):
   Jobs: SQL-Backup, Exchange-Backup, FileServer-Daily
   VMs afetadas: SQL-PROD-01, EXCHANGE-01, FILE-01
   Recomendação: Verificar latência de rede para storage

2️⃣ DISCO CHEIO (2 ocorrências):
   Jobs: VM-Production, Archive-Weekly
   Repositório: REPO-PROD (5% livre)
   Recomendação: Expandir repositório ou ajustar retenção
```

---

#### 3. `veeam_capacity_planning` - Planejamento de Capacidade

**Descrição:** Projeção de crescimento de storage e previsão de quando será necessário expandir repositórios.

**Quando Usar:**
- Planejamento trimestral de orçamento
- Análise de crescimento de dados
- Justificativa de investimento em storage
- Prevenção de falhas por disco cheio

**Argumentos:**
- `analysis_period_days` (opcional): Período de análise histórica (padrão: 30)
- `projection_days` (opcional): Quantos dias projetar no futuro (padrão: 90)
- `alert_threshold_percent` (opcional): % de uso para alerta (padrão: 80)

**O Que Este Prompt Faz:**
1. Analisa crescimento de dados nos últimos X dias
2. Calcula taxa de crescimento diária média
3. Projeta uso futuro dos repositórios
4. Identifica data estimada de esgotamento
5. Calcula custo de expansão baseado em crescimento
6. Fornece recomendações de otimização de retenção
7. Sugere repositórios candidatos para arquivamento

**Exemplo de Uso:**
```
Claude, faça projeção de capacidade para os próximos 3 meses usando veeam_capacity_planning
```

**Output Esperado:**
```
📈 PLANEJAMENTO DE CAPACIDADE - 90 DIAS

📊 ANÁLISE HISTÓRICA (últimos 30 dias):
• Crescimento médio: 150 GB/dia
• Taxa de crescimento: +4.2% ao mês

🔮 PROJEÇÃO:

REPOSITÓRIO PROD (10 TB total):
• Uso atual: 7.5 TB (75%)
• Projeção em 30 dias: 8.0 TB (80%) ⚠️
• Projeção em 60 dias: 8.5 TB (85%) 🚨
• Projeção em 90 dias: 9.0 TB (90%) ⛔
• Esgotamento estimado: ~110 dias

RECOMENDAÇÕES:
✅ Adicionar 5 TB ao REPO-PROD em até 60 dias
✅ Revisar retenção de jobs antigos (>180 dias)
✅ Considerar compressão adicional
```

---

#### 4. `veeam_compliance_report` - Relatório de Compliance

**Descrição:** Auditoria de conformidade com políticas de backup (3-2-1, retenção, SLA).

**Quando Usar:**
- Auditorias SOX/HIPAA/ISO 27001
- Validação de políticas corporativas
- Relatórios de compliance trimestral
- Due diligence em aquisições

**Argumentos:**
- `compliance_standard` (opcional): `3-2-1`, `sox`, `hipaa`, `gdpr` (padrão: `3-2-1`)
- `include_evidence` (opcional): Incluir evidências de compliance (padrão: true)

**O Que Este Prompt Faz:**
1. Valida regra 3-2-1 (3 cópias, 2 mídias, 1 offsite)
2. Verifica políticas de retenção vs. requisitos regulatórios
3. Identifica VMs críticas sem backup adequado
4. Valida SLA de RPO/RTO
5. Verifica encryption at rest e in transit
6. Analisa logs de acesso e modificações
7. Gera relatório de conformidade com evidências

**Exemplo de Uso:**
```
Claude, gere relatório de compliance 3-2-1 usando veeam_compliance_report
```

**Output Esperado:**
```
📋 RELATÓRIO DE COMPLIANCE - REGRA 3-2-1

✅ CONFORMIDADE GERAL: 72% (18 de 25 jobs)

DETALHES POR REQUISITO:

1️⃣ 3 CÓPIAS DE DADOS:
   ✅ Conformes: 23 jobs (backup primary + incremental)
   ⚠️ Não conformes: 2 jobs (apenas 1 cópia)

2️⃣ 2 TIPOS DE MÍDIA:
   ✅ Conformes: 20 jobs (disco + tape/cloud)
   ⚠️ Não conformes: 5 jobs (apenas disco)

3️⃣ 1 CÓPIA OFFSITE:
   ✅ Conformes: 18 jobs (backup copy configurado)
   🚨 CRÍTICO: 7 jobs SEM backup copy
      • SQL-Daily, Exchange-Weekly, FileServer-Production
      • VM-Archive, Domain-Controllers, SharePoint-Backup
      • Critical-Apps-Backup

RECOMENDAÇÕES:
🔧 Configurar backup copy jobs para os 7 não conformes
🔧 Validar funcionamento de jobs de tape/cloud
🔧 Implementar immutability para proteção ransomware
```

---

#### 5. `veeam_sla_dashboard` - Dashboard de SLA

**Descrição:** Métricas de SLA (RPO/RTO) com identificação de VMs fora do objetivo.

**Quando Usar:**
- Reuniões de revisão de SLA
- Relatórios de disponibilidade mensal
- Validação de contratos com clientes MSP
- Análise de performance operacional

**Argumentos:**
- `client_filter` (opcional): Filtrar por cliente MSP
- `sla_rpo_hours` (opcional): RPO objetivo em horas (padrão: 24)
- `period_days` (opcional): Período de análise (padrão: 30)

**O Que Este Prompt Faz:**
1. Calcula RPO real de cada VM (tempo desde último backup)
2. Compara com SLA definido
3. Identifica VMs fora do SLA
4. Calcula percentual de conformidade
5. Analisa tendências de degradação
6. Identifica jobs com execuções falhando
7. Fornece métricas de uptime de backup

**Exemplo de Uso:**
```
Claude, mostre dashboard de SLA dos últimos 30 dias usando veeam_sla_dashboard
```

**Output Esperado:**
```
📊 DASHBOARD SLA - ÚLTIMOS 30 DIAS
SLA Objetivo: RPO 24h

✅ CONFORMIDADE GERAL: 94% (47 de 50 VMs)

📈 MÉTRICAS:
• VMs dentro do SLA: 47 (94%)
• VMs fora do SLA: 3 (6%)
• RPO médio: 18h
• Disponibilidade de backup: 99.2%

🚨 VMs FORA DO SLA:

1. SQL-PROD-01
   RPO atual: 36h (12h acima do SLA)
   Último backup: 2024-12-09 03:00
   Causa: Job SQL-Backup falhando há 2 dias

2. EXCHANGE-01
   RPO atual: 28h (4h acima do SLA)
   Último backup: 2024-12-09 07:00
   Causa: Job em manutenção

3. FILE-CRITICAL-02
   RPO atual: 48h (24h acima do SLA)
   Último backup: 2024-12-08 03:00
   Causa: VM removida do job por engano
```

---

#### 6. `veeam_cost_analysis` - Análise de Custos de Backup

**Descrição:** Análise de custos por cliente, job ou repositório com otimização de investimento.

**Quando Usar:**
- Planejamento orçamentário
- Análise de custo por cliente MSP
- Otimização de storage
- Justificativa de investimentos

**Argumentos:**
- `cost_per_tb_month` (opcional): Custo mensal por TB (padrão: 50 USD)
- `group_by` (opcional): `client`, `job`, `repository` (padrão: `client`)
- `include_licensing` (opcional): Incluir custos de licença (padrão: true)

**O Que Este Prompt Faz:**
1. Calcula consumo de storage por cliente/job
2. Multiplica por custo por TB
3. Adiciona custos de licenciamento proporcional
4. Identifica clientes/jobs mais caros
5. Calcula ROI de otimizações (deduplicação, compressão)
6. Fornece recomendações de redução de custos
7. Projeta custos futuros baseado em crescimento

**Exemplo de Uso:**
```
Claude, analise custos de backup por cliente usando veeam_cost_analysis com custo de $40/TB
```

**Output Esperado:**
```
💰 ANÁLISE DE CUSTOS - POR CLIENTE

CUSTO TOTAL MENSAL: $3,200
(Storage: $2,800 + Licenças: $400)

📊 TOP 5 CLIENTES MAIS CAROS:

1. Cliente ACME Corp
   Storage: 25 TB
   Custo: $1,000/mês ($40/TB)
   Licenças: 50 VMs × $2 = $100/mês
   TOTAL: $1,100/mês (34% do total)

2. Cliente Global Industries
   Storage: 18 TB
   Custo: $720/mês
   Licenças: 35 VMs × $2 = $70/mês
   TOTAL: $790/mês (25% do total)

💡 OPORTUNIDADES DE OTIMIZAÇÃO:

✅ Deduplicação adicional: -15% storage (~$420/mês)
✅ Arquivamento de backups antigos: -$200/mês
✅ Ajuste de retenção: -$150/mês

ECONOMIA POTENCIAL: $770/mês (24%)
```

---

#### 7. `veeam_backup_optimization` - Recomendações de Otimização

**Descrição:** Análise de performance e recomendações de otimização de recursos.

**Quando Usar:**
- Troubleshooting de lentidão
- Planejamento de otimização
- Análise de janelas de backup
- Tuning de performance

**Argumentos:**
- `analysis_period_days` (opcional): Período de análise (padrão: 7)
- `focus_area` (opcional): `performance`, `storage`, `network`, `all` (padrão: `all`)

**O Que Este Prompt Faz:**
1. Analisa duração de jobs vs. janela de backup
2. Identifica jobs com throughput baixo (<100 MB/s)
3. Verifica utilização de proxies (identificar gargalos)
4. Analisa compression ratio e deduplication
5. Identifica jobs com muitos incrementais (recomendar full)
6. Verifica configurações de parallel processing
7. Fornece checklist de otimização priorizado

**Exemplo de Uso:**
```
Claude, analise performance e sugira otimizações usando veeam_backup_optimization
```

**Output Esperado:**
```
⚡ ANÁLISE DE OTIMIZAÇÃO - PERFORMANCE

🔍 GARGALOS IDENTIFICADOS:

1️⃣ JOBS LENTOS (throughput <100 MB/s):
   • SQL-Backup: 45 MB/s (esperado: 200+ MB/s)
     Recomendação: Aumentar parallel tasks de 2 para 4

   • Exchange-Weekly: 60 MB/s
     Recomendação: Adicionar proxy dedicado

2️⃣ PROXIES SOBRECARREGADOS:
   • PROXY-01: 95% utilização (8/8 tasks)
     Recomendação: Adicionar proxy ou redistribuir jobs

3️⃣ COMPRESSION BAIXA:
   • Job VM-Production: ratio 1.2x (esperado: 2x+)
     Recomendação: Ajustar compression level para "Optimal"

4️⃣ DEDUPLICATION:
   • Repositório PROD: 30% dedupe (potencial: 50%)
     Recomendação: Habilitar storage-level deduplication

💡 CHECKLIST DE OTIMIZAÇÃO:
✅ [ALTO IMPACTO] Adicionar 2º proxy (+40% throughput)
✅ [MÉDIO IMPACTO] Ajustar compression settings (+15% storage)
✅ [BAIXO IMPACTO] Redistribuir agendamentos
```

---

### 🔧 Prompts para Analistas (8)

Prompts focados em **operações práticas**, **troubleshooting** e **execução técnica**.

#### 1. `veeam_quick_restore_guide` - Guia Rápido de Restore de VM

**Descrição:** Workflow passo-a-passo para restaurar uma VM específica.

**Quando Usar:**
- Restore de VM em situação de emergência
- Treinamento de novos técnicos
- Validação de restore points antes de restore
- Teste de DR (Disaster Recovery)

**Argumentos:**
- `vm_name` (obrigatório): Nome da VM a restaurar (busca semântica)
- `restore_type` (opcional): `full_vm`, `files`, `application_items` (padrão: `full_vm`)
- `target_location` (opcional): `original`, `alternate` (padrão: `original`)

**O Que Este Prompt Faz:**
1. Busca restore points disponíveis para a VM (com busca semântica multi-palavra)
2. Valida se restore points estão íntegros
3. Mostra informações de cada restore point (data, tipo, tamanho)
4. Fornece passo-a-passo de restore via Veeam Console
5. Lista pré-requisitos (espaço em disco, recursos de vSphere)
6. Alerta sobre impactos (downtime, IP duplicado, etc.)
7. Fornece checklist pós-restore

**Exemplo de Uso:**
```
Claude, preciso restaurar a VM SQL-SERVER-01 usando veeam_quick_restore_guide
```

**Output Esperado:**
```
🔄 GUIA DE RESTORE - SQL-SERVER-01

📦 RESTORE POINTS DISPONÍVEIS:

1. 2024-12-09 23:00 (Full Backup) - 250 GB
   Tipo: Application-consistent
   Repositório: REPO-PROD
   Status: ✅ Íntegro

2. 2024-12-09 03:00 (Incremental) - 45 GB
   Tipo: Crash-consistent
   Repositório: REPO-PROD
   Status: ✅ Íntegro

📋 PASSO-A-PASSO RESTORE:

PREPARAÇÃO:
✅ Confirmar espaço no datastore (250 GB necessários)
✅ Verificar licenças vSphere disponíveis
✅ Desligar VM original (se existir)

EXECUÇÃO:
1. Abrir Veeam Console
2. Home > Backups > Disk
3. Localizar "SQL-SERVER-01"
4. Botão direito > Restore entire VM
5. Selecionar restore point: 2024-12-09 23:00
6. Restore mode: Original location
7. Power on after restore: No (validar antes)
8. Click "Finish"

VALIDAÇÃO PÓS-RESTORE:
✅ Verificar VM iniciou corretamente
✅ Testar conectividade de rede
✅ Validar serviços SQL Server
✅ Conferir data/hora do sistema
✅ Remover snapshot criado pelo restore

⏱️ TEMPO ESTIMADO: 15-20 minutos
```

---

#### 2. `veeam_job_troubleshooting` - Troubleshooting de Job com Falha

**Descrição:** Diagnóstico sistemático de jobs com falha incluindo análise de logs.

**Quando Usar:**
- Job falhando repetidamente
- Investigação de erros específicos
- Validação pós-manutenção
- Suporte técnico

**Argumentos:**
- `job_name` (opcional): Nome do job para troubleshoot (busca semântica)
- `session_id` (opcional): ID de sessão específica
- `auto_fix` (opcional): Sugerir correções automáticas (padrão: true)

**O Que Este Prompt Faz:**
1. Busca últimas sessões do job (especialmente com falha)
2. Extrai logs detalhados de erros
3. Identifica VMs específicas que falharam
4. Classifica tipo de erro (rede, disco, permissions, etc.)
5. Busca em knowledge base Veeam soluções conhecidas
6. Fornece checklist de troubleshooting por tipo de erro
7. Sugere correções e next steps

**Exemplo de Uso:**
```
Claude, troubleshoot o job SQL-Backup que está falhando usando veeam_job_troubleshooting
```

**Output Esperado:**
```
🔍 TROUBLESHOOTING - SQL-Backup

📊 STATUS DO JOB:
• Última execução: Failed (2024-12-09 03:30)
• Tentativas: 3 (todas falharam)
• VMs afetadas: SQL-PROD-01

🚨 ERRO IDENTIFICADO:
Tipo: Network Timeout
Código: VSS Writer timeout (0x800423F4)
Mensagem: "Failed to create VSS snapshot. Timeout waiting for VSS Writers"

🔧 DIAGNÓSTICO:

CAUSA PROVÁVEL:
VSS Writers do SQL Server não estão respondendo em tempo hábil

CHECKLIST DE VALIDAÇÃO:
✅ Verificar VSS Writers no SQL Server:
   CMD> vssadmin list writers

✅ Reiniciar serviço VSS:
   CMD> net stop vss
   CMD> net start vss

✅ Verificar espaço em disco System Volume (mínimo 5 GB)

✅ Aumentar timeout VSS no Veeam:
   Registry: HKLM\SOFTWARE\Veeam\Veeam Backup and Replication
   Key: VssSnapshotTimeout
   Value: 1800 (30 min)

📋 NEXT STEPS:
1. Executar checklist de validação
2. Tentar backup manual (veeam_manage_backup_jobs action=start)
3. Se persistir, validar SQL Server VSS Writers com DBA
```

---

#### 3. `veeam_vm_backup_status` - Status de Backup de VM Específica

**Descrição:** Consulta rápida do status de backup de uma VM individual.

**Quando Usar:**
- Validação rápida antes de manutenção
- Confirmar backup recente
- Verificar cobertura de nova VM
- Atender chamado de usuário

**Argumentos:**
- `vm_name` (obrigatório): Nome da VM (busca semântica multi-palavra)
- `show_history` (opcional): Mostrar histórico de backups (padrão: true)

**O Que Este Prompt Faz:**
1. Busca VM usando busca semântica multi-palavra e normalização de acentos
2. Identifica job(s) que fazem backup da VM
3. Mostra status do último backup
4. Lista restore points disponíveis
5. Calcula RPO atual
6. Verifica agendamento do próximo backup
7. Alerta se VM não está em nenhum job

**Exemplo de Uso:**
```
Claude, qual o status de backup da VM FILE-SERVER-01 usando veeam_vm_backup_status?
```

ou com **busca semântica multi-palavra**:
```
Claude, status de backup da "SK VCENTER" usando veeam_vm_backup_status
```

**Output Esperado:**
```
📊 STATUS DE BACKUP - FILE-SERVER-01

✅ VM PROTEGIDA

JOB: FileServer-Daily-Backup
Status: Enabled
Último backup: 2024-12-09 23:00 ✅ Sucesso
RPO atual: 9h (dentro do SLA de 24h)

📦 RESTORE POINTS DISPONÍVEIS: 7
• 2024-12-09 23:00 (Full) - 180 GB
• 2024-12-08 23:00 (Incremental) - 25 GB
• 2024-12-07 23:00 (Incremental) - 30 GB
• ... (mais 4 pontos)

⏭️ PRÓXIMO BACKUP: Hoje 23:00 (em 14 horas)

🔄 RETENÇÃO: 7 dias (7 restore points)

✅ VM ESTÁ ADEQUADAMENTE PROTEGIDA
```

---

#### 4. `veeam_restore_point_lookup` - Busca de Restore Points

**Descrição:** Busca avançada de restore points com filtros por data, tipo e VM.

**Quando Usar:**
- Buscar backup de data específica
- Validar restore points antes de limpeza
- Auditoria de retenção
- Planejamento de restore

**Argumentos:**
- `vm_name` (opcional): Nome da VM (busca semântica)
- `date_from` (opcional): Data inicial (YYYY-MM-DD)
- `date_to` (opcional): Data final (YYYY-MM-DD)
- `type_filter` (opcional): `full`, `incremental`, `differential`

**O Que Este Prompt Faz:**
1. Busca restore points com filtros especificados
2. Agrupa por VM
3. Mostra informações detalhadas (data, tipo, tamanho, repositório)
4. Valida integridade dos restore points
5. Calcula espaço total ocupado
6. Identifica restore points órfãos
7. Fornece comandos para restore via PowerShell

**Exemplo de Uso:**
```
Claude, busque restore points da VM SQL-PROD entre 2024-12-01 e 2024-12-07 usando veeam_restore_point_lookup
```

**Output Esperado:**
```
🔍 RESTORE POINTS - SQL-PROD-01
Período: 2024-12-01 a 2024-12-07

📦 7 RESTORE POINTS ENCONTRADOS:

1. 2024-12-07 23:00
   Tipo: Full Backup (250 GB)
   Repositório: REPO-PROD
   Status: ✅ Íntegro

2. 2024-12-06 23:00
   Tipo: Incremental (45 GB)
   Repositório: REPO-PROD
   Status: ✅ Íntegro

[... outros pontos ...]

💾 ESPAÇO TOTAL: 520 GB

🔧 COMANDO POWERSHELL PARA RESTORE:
Get-VBRRestorePoint -Name "SQL-PROD-01" | Where-Object {$_.CreationTime -eq "2024-12-07 23:00"} | Start-VBRRestoreVM -Server "vcenter.domain.local"
```

---

#### 5. `veeam_repository_health` - Verificação de Saúde de Repositório

**Descrição:** Diagnóstico completo de saúde de repositório específico.

**Quando Usar:**
- Troubleshooting de lentidão em backups
- Validação pós-manutenção
- Planejamento de expansão
- Alertas de espaço em disco

**Argumentos:**
- `repository_name` (opcional): Nome do repositório
- `check_integrity` (opcional): Executar check de integridade (padrão: false)

**O Que Este Prompt Faz:**
1. Lista todos os repositórios ou foca em um específico
2. Verifica espaço disponível e tendência de uso
3. Analisa I/O performance (latência, throughput)
4. Identifica jobs que usam o repositório
5. Calcula taxa de deduplicação e compression
6. Verifica configurações de immutability
7. Fornece recomendações de otimização

**Exemplo de Uso:**
```
Claude, verifique saúde do repositório REPO-PROD usando veeam_repository_health
```

**Output Esperado:**
```
💾 SAÚDE DO REPOSITÓRIO - REPO-PROD

📊 CAPACIDADE:
• Total: 10 TB
• Usado: 7.5 TB (75%)
• Livre: 2.5 TB (25%)
• Taxa de crescimento: +150 GB/dia

📈 PERFORMANCE:
• Latência média de escrita: 15ms ✅
• Throughput: 850 MB/s ✅
• Operações IOPS: 12,000 ✅

🔧 OTIMIZAÇÃO:
• Compression ratio: 2.1x (Bom)
• Deduplication: 35% (Pode melhorar)
• Immutability: ✅ Habilitado (14 dias)

📦 JOBS USANDO ESTE REPO:
• SQL-Backup-Daily
• VM-Production
• Exchange-Weekly
• FileServer-Daily
[... 5 outros jobs]

⚠️ ALERTAS:
• Espaço livre abaixo de 30% (considerar expansão)
• Projeção de esgotamento: ~16 dias

💡 RECOMENDAÇÕES:
✅ Expandir repositório em 5 TB nas próximas 2 semanas
✅ Revisar retenção de jobs antigos
✅ Habilitar storage-level deduplication
```

---

#### 6. `veeam_tape_management` - Gerenciamento de Tape Backup

**Descrição:** Operações e monitoramento de backup em tape/library.

**Quando Usar:**
- Validar backups em fita
- Troubleshooting de tape library
- Planejamento de rotação de mídias
- Auditoria de mídias offsite

**Argumentos:**
- `operation` (opcional): `status`, `inventory`, `verify`, `eject` (padrão: `status`)
- `library_name` (opcional): Nome da library

**O Que Este Prompt Faz:**
1. Lista tape libraries e status
2. Mostra tapes disponíveis e em uso
3. Verifica jobs de tape backup
4. Identifica tapes com erros
5. Calcula espaço disponível em tapes
6. Fornece procedimentos de manutenção
7. Gera relatório de mídias para rotação

**Exemplo de Uso:**
```
Claude, status das tape libraries usando veeam_tape_management
```

**Output Esperado:**
```
📼 GERENCIAMENTO DE TAPE

🏢 LIBRARIES DISPONÍVEIS:

1. HP MSL6048 Library
   Status: Online ✅
   Tapes carregadas: 48/48
   Slots livres: 0

📦 TAPES ATIVAS:

Full Tapes (prontas para ejeção): 12
• TAPE-001: Backup 2024-12-01 (Full)
• TAPE-002: Backup 2024-12-02 (Full)
[... outras tapes]

Tapes em uso: 4
• TAPE-048: Gravando (SQL-Copy-Job) - 85% completa

⚠️ ALERTAS:
• 3 tapes com erros de leitura (TAPE-015, TAPE-022, TAPE-031)
• Nenhum slot livre para novos jobs

📋 AÇÕES RECOMENDADAS:
✅ Ejetar 12 tapes full e substituir por vazias
✅ Validar integridade de tapes com erros
✅ Agendar limpeza de drives
```

---

#### 7. `veeam_replication_monitor` - Monitoramento de Replicação

**Descrição:** Monitoramento de jobs de replicação e DR readiness.

**Quando Usar:**
- Validação de DR (Disaster Recovery)
- Troubleshooting de replicação
- Teste de failover
- Auditoria de RTO

**Argumentos:**
- `replica_job_name` (opcional): Nome do job de replicação
- `show_failover_plan` (opcional): Mostrar plano de failover (padrão: true)

**O Que Este Prompt Faz:**
1. Lista todos os replica jobs
2. Verifica status de cada réplica
3. Calcula lag de replicação (RPO real)
4. Identifica réplicas desatualizadas
5. Valida DR readiness (réplicas prontas para failover)
6. Fornece procedimento de failover
7. Calcula RTO estimado

**Exemplo de Uso:**
```
Claude, monitore status de replicação usando veeam_replication_monitor
```

**Output Esperado:**
```
🔄 MONITORAMENTO DE REPLICAÇÃO

📊 RESUMO:
• Total de replicas: 15 VMs
• Réplicas atualizadas: 14 ✅
• Réplicas com lag: 1 ⚠️

🔄 STATUS POR JOB:

1. Critical-VMs-Replica
   VMs: 5 (SQL-PROD, Exchange, DC01, DC02, FileServer)
   Última replicação: 2024-12-09 22:00 ✅
   RPO atual: 2h ✅ (SLA: 4h)
   DR Ready: ✅ Sim

2. Secondary-Apps-Replica
   VMs: 10
   Última replicação: 2024-12-09 18:00 ⚠️
   RPO atual: 6h ⚠️ (SLA: 4h)
   DR Ready: ⚠️ Parcial (1 VM com lag)

⏱️ RTO ESTIMADO: 15 minutos (failover automático)

📋 PROCEDIMENTO DE FAILOVER:
1. Validar réplicas estão atualizadas
2. Veeam Console > Replicas > Failover Now
3. Selecionar réplicas a failover
4. Validar conectividade de rede após failover
5. Executar testes de aplicação
```

---

#### 8. `veeam_backup_window_planner` - Planejamento de Janela de Manutenção

**Descrição:** Análise de janelas de backup e planejamento de manutenções.

**Quando Usar:**
- Planejar manutenção de servidores
- Otimizar horários de backup
- Evitar conflitos de agendamento
- Validar janelas de backup

**Argumentos:**
- `maintenance_date` (opcional): Data da manutenção (YYYY-MM-DD)
- `maintenance_time` (opcional): Hora da manutenção (HH:MM)
- `duration_hours` (opcional): Duração estimada (padrão: 2)

**O Que Este Prompt Faz:**
1. Analisa jobs agendados para data/hora específica
2. Identifica conflitos com janela de manutenção
3. Calcula impacto no RPO se jobs forem suspensos
4. Fornece recomendações de reprogramação
5. Lista jobs que podem ser adiados
6. Calcula janela ideal livre
7. Fornece checklist pré e pós-manutenção

**Exemplo de Uso:**
```
Claude, planeje manutenção para 2024-12-15 às 14:00 com duração de 3 horas usando veeam_backup_window_planner
```

**Output Esperado:**
```
📅 PLANEJAMENTO DE MANUTENÇÃO

Data/Hora: 2024-12-15 14:00-17:00 (3 horas)

⚠️ CONFLITOS IDENTIFICADOS:

1. SQL-Backup-Hourly (Executa a cada hora)
   Próximas execuções durante manutenção:
   • 14:00, 15:00, 16:00
   Impacto no RPO: +3h (aceitável, SLA: 24h)

2. Exchange-Incremental (Agendado para 15:00)
   Impacto no RPO: +24h (próximo backup amanhã 15:00)
   ⚠️ CRÍTICO: Recomendado executar antes da manutenção

💡 RECOMENDAÇÕES:

ANTES DA MANUTENÇÃO (13:00):
✅ Executar Exchange-Incremental manualmente
✅ Pausar SQL-Backup-Hourly (Disable schedule)
✅ Validar backups recentes de VMs críticas

DURANTE MANUTENÇÃO (14:00-17:00):
✅ Desligar servidores conforme planejado
✅ Executar manutenção

APÓS MANUTENÇÃO (17:00):
✅ Reativar SQL-Backup-Hourly
✅ Executar full backup de VMs afetadas
✅ Validar restore points criados
```

---

### 📞 Como Usar os Prompts

#### Claude Code

```bash
# Listar prompts disponíveis
/prompt list

# Executar um prompt
/prompt veeam_backup_health_report

# Executar com argumentos
/prompt veeam_failed_jobs_analysis hours=48 format=compact
```

#### Claude Desktop

```
Você: use prompt veeam_backup_health_report para análise completa do ambiente
```

#### Gemini CLI

```bash
# Listar prompts
gemini prompt list

# Executar prompt
gemini prompt veeam_backup_health_report

# Com argumentos
gemini prompt veeam_failed_jobs_analysis --hours=48 --format=compact
```

---

### 🎯 Casos de Uso Práticos dos Prompts

#### Rotina Matinal do Administrador

```
1. veeam_failed_jobs_analysis (revisar falhas da noite)
2. veeam_backup_health_report (status geral)
3. veeam_sla_dashboard (validar conformidade)
```

#### Planejamento Trimestral (Gestor)

```
1. veeam_capacity_planning (projeção de crescimento)
2. veeam_cost_analysis (análise de custos)
3. veeam_compliance_report (auditoria)
```

#### Troubleshooting de Emergência (Analista)

```
1. veeam_vm_backup_status (validar VM específica)
2. veeam_job_troubleshooting (diagnosticar falha)
3. veeam_quick_restore_guide (restaurar VM)
```

#### Preparação para Auditoria (Compliance)

```
1. veeam_compliance_report compliance_standard=sox
2. veeam_sla_dashboard period_days=90
3. veeam_backup_health_report include_evidence=true
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
