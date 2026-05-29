# Guia de Contribuição - Veeam Backup MCP Server

**Como contribuir para o projeto seguindo os padrões da Skills IT**

---

## 📑 Índice

- [Bem-vindo!](#-bem-vindo)
- [Código de Conduta](#-código-de-conduta)
- [Como Contribuir](#-como-contribuir)
- [Padrões de Desenvolvimento](#-padrões-de-desenvolvimento)
- [Conventional Commits](#-conventional-commits)
- [Pull Request Process](#-pull-request-process)
- [Diretrizes de Código](#-diretrizes-de-código)
- [Testando Mudanças](#-testando-mudanças)
- [Reportando Bugs](#-reportando-bugs)
- [Solicitando Features](#-solicitando-features)

---

## 👋 Bem-vindo!

Obrigado por considerar contribuir para o Veeam Backup & Replication MCP Server! Este projeto é mantido pela **Skills IT - Soluções em Tecnologia** e valoriza a colaboração da comunidade.

### Por Que Contribuir?

- ✅ Aprender sobre **Model Context Protocol (MCP)**
- ✅ Trabalhar com **Veeam Backup & Replication API**
- ✅ Praticar **Node.js**, **Express.js** e **arquitetura híbrida**
- ✅ Colaborar com profissionais experientes
- ✅ Fazer parte de um projeto open source impactante

### O Que Você Pode Contribuir?

- **Código:** Novas ferramentas, melhorias de performance, correções de bugs
- **Documentação:** Tutoriais, exemplos, traduções
- **Testes:** Casos de teste, validação de funcionalidades
- **Design:** Diagramas de arquitetura, fluxogramas
- **Suporte:** Ajudar outros desenvolvedores com dúvidas

---

## 📜 Código de Conduta

### Nossos Princípios

1. **Respeito Mútuo**: Trate todos com cortesia e profissionalismo
2. **Inclusividade**: Todos são bem-vindos, independentemente de background
3. **Colaboração**: Trabalhe em equipe, compartilhe conhecimento
4. **Construtividade**: Críticas devem ser construtivas e respeitosas
5. **Responsabilidade**: Assuma responsabilidade por suas contribuições

### Comportamento Esperado

- ✅ Usar linguagem inclusiva e profissional
- ✅ Aceitar críticas construtivas com maturidade
- ✅ Focar no que é melhor para a comunidade
- ✅ Demonstrar empatia com outros colaboradores

### Comportamento Inaceitável

- ❌ Linguagem ofensiva, discriminatória ou assediadora
- ❌ Trolling, insultos ou ataques pessoais
- ❌ Publicação de informações privadas de terceiros
- ❌ Qualquer comportamento não profissional

**Violações serão tratadas com advertências, suspensões ou banimentos permanentes, conforme a gravidade.**

---

## 🚀 Como Contribuir

### Processo de Contribuição (5 Passos)

#### Passo 1: Fork o Repositório

```bash
# Via GitHub UI
1. Acesse: https://github.com/DevSkillsIT/Skills-MCP-Veeam-Backup-Pro
2. Clique em "Fork" no canto superior direito
3. Selecione sua conta como destino do fork
```

#### Passo 2: Clone Seu Fork

```bash
# Clone localmente
git clone https://github.com/SEU-USUARIO/veeam-backup-mcp.git
cd veeam-backup-mcp

# Adicione o repositório original como remote
git remote add upstream https://github.com/DevSkillsIT/Skills-MCP-Veeam-Backup-Pro.git

# Verifique remotes
git remote -v
# origin    https://github.com/SEU-USUARIO/Skills-MCP-Veeam-Backup-Pro.git (fetch)
# origin    https://github.com/SEU-USUARIO/Skills-MCP-Veeam-Backup-Pro.git (push)
# upstream  https://github.com/DevSkillsIT/Skills-MCP-Veeam-Backup-Pro.git (fetch)
# upstream  https://github.com/DevSkillsIT/Skills-MCP-Veeam-Backup-Pro.git (push)
```

#### Passo 3: Crie uma Branch para Sua Feature

```bash
# Sempre trabalhe em uma branch específica (não em main)
git checkout -b feat/nova-feature

# Exemplos de nomes de branch:
# feat/adicionar-tool-restore-points
# fix/corrigir-timeout-auth
# docs/atualizar-exemplos-readme
# refactor/simplificar-auth-middleware
```

#### Passo 4: Desenvolva e Commit

```bash
# Faça suas alterações (padrão de nome: <verbo>-<recurso>.js)
nano tools/search-novo-recurso.js

# Adicione arquivos modificados
git add tools/search-novo-recurso.js

# Commit seguindo Conventional Commits (ver seção abaixo)
git commit -m "feat(tools): adicionar tool de restore points"

# Continue desenvolvendo...
git add .
git commit -m "test(tools): adicionar testes para search-restore-points"
git commit -m "docs(readme): documentar uso da nova tool"
```

#### Passo 5: Push e Pull Request

```bash
# Push para seu fork
git push origin feat/nova-feature

# No GitHub:
1. Acesse seu fork
2. Clique em "Compare & pull request"
3. Preencha descrição detalhada
4. Submeta o PR
```

---

## 💻 Padrões de Desenvolvimento

### Estrutura de Branch

| Branch | Propósito | Merge para |
|--------|-----------|------------|
| `main` | Código estável em produção | - |
| `develop` | Código em desenvolvimento | `main` (releases) |
| `feat/*` | Novas funcionalidades | `develop` |
| `fix/*` | Correções de bugs | `develop` ou `main` (hotfix) |
| `docs/*` | Documentação | `develop` |
| `refactor/*` | Refatoração de código | `develop` |
| `test/*` | Adição/melhoria de testes | `develop` |

### Workflow Git

```
main (production)
  │
  ├─ v1.0.0 (release tag)
  │
develop
  │
  ├─ feat/nova-tool-1
  │   └─ commit 1, 2, 3
  │
  ├─ feat/nova-tool-2
  │   └─ commit 1, 2
  │
  └─ fix/corrigir-bug-auth
      └─ commit 1
```

### Sincronizar com Upstream

```bash
# Antes de iniciar nova feature, sincronize com upstream
git checkout develop
git fetch upstream
git merge upstream/develop
git push origin develop

# Agora crie sua branch
git checkout -b feat/minha-feature
```

---

## 📝 Conventional Commits

### Formato Padrão

```
<tipo>(<escopo>): <descrição curta em pt-BR>

<corpo opcional: explicação detalhada>

<rodapé opcional: referências de issues>
```

### Tipos de Commit

| Tipo | Descrição | Exemplo |
|------|-----------|---------|
| `feat` | Nova funcionalidade | `feat(tools): adicionar backup-repository-tool` |
| `fix` | Correção de bug | `fix(auth): corrigir race condition em token cache` |
| `docs` | Documentação | `docs(readme): atualizar seção de instalação` |
| `refactor` | Refatoração (sem mudança de comportamento) | `refactor(auth): simplificar lógica de middleware` |
| `test` | Adição ou correção de testes | `test(tools): adicionar testes para job-details-tool` |
| `chore` | Manutenção (deps, configs) | `chore(deps): atualizar express para v4.19` |
| `style` | Formatação (sem mudança de lógica) | `style: aplicar prettier em todos os arquivos` |
| `perf` | Melhoria de performance | `perf(auth): implementar cache de token` |
| `ci` | Mudanças em CI/CD | `ci: adicionar GitHub Actions para testes` |

### Escopos Comuns

- `tools` - Ferramentas MCP (tools/*.js)
- `auth` - Autenticação (lib/auth-middleware.js)
- `server` - Servidor principal (vbr-mcp-server.js)
- `docs` - Documentação (README, SECURITY, etc.)
- `deps` - Dependências (package.json)
- `config` - Configurações (.env, docker-compose.yml)

### Exemplos Completos

**Feature Nova:**
```bash
git commit -m "feat(tools): adicionar tool de monitoramento de jobs

Implementa nova tool 'monitor-jobs-tool' que:
- Lista jobs ativos em tempo real
- Mostra progresso percentual de cada job
- Alerta sobre jobs travados (>4h sem progresso)

Closes #42"
```

**Correção de Bug:**
```bash
git commit -m "fix(auth): corrigir timeout em token refresh

O token refresh estava falhando após 50 minutos devido a timeout
incorreto no fetch. Aumentado para 60 segundos.

Fixes #38"
```

**Documentação:**
```bash
git commit -m "docs(security): adicionar seção de rate limiting

Documenta configuração de rate limiting no Nginx:
- Limites por IP
- Limites por API key
- Exemplos de configuração"
```

**Breaking Change:**
```bash
git commit -m "feat(auth): migrar para OAuth2 Client Credentials

BREAKING CHANGE: Autenticação agora usa Client Credentials
ao invés de Password Grant. Atualizar .env:

Antes:
  VEEAM_USERNAME=user
  VEEAM_PASSWORD=pass

Depois:
  VEEAM_CLIENT_ID=client_id
  VEEAM_CLIENT_SECRET=secret"
```

---

## 🔄 Pull Request Process

### Checklist Antes de Abrir PR

- [ ] **Código testado localmente** (sem erros)
- [ ] **Commits seguem Conventional Commits**
- [ ] **Branch sincronizada com upstream/develop**
- [ ] **Documentação atualizada** (se aplicável)
- [ ] **CHANGELOG.md atualizado** (se mudança significativa)
- [ ] **Nenhum arquivo sensível** (.env, tokens, etc.)
- [ ] **Código formatado** (Prettier/ESLint)
- [ ] **Sem console.log desnecessários**

### Template de Pull Request

```markdown
## Descrição

Breve descrição da mudança e contexto.

## Tipo de Mudança

- [ ] 🐛 Bug fix (mudança que corrige um issue)
- [ ] ✨ Nova feature (mudança que adiciona funcionalidade)
- [ ] 💥 Breaking change (correção/feature que quebra compatibilidade)
- [ ] 📚 Documentação (apenas docs)
- [ ] 🔧 Refactoring (mudança de código sem alterar comportamento)
- [ ] ⚡ Performance (melhoria de performance)

## Como Testar?

1. Clone o branch: `git checkout feat/minha-feature`
2. Instale dependências: `npm install`
3. Configure .env: `cp env.example .env` (edite com credenciais)
4. Inicie servidor: `npm start`
5. Teste a feature: [descrever passos específicos]

## Checklist

- [ ] Testei localmente todas as mudanças
- [ ] Código segue os padrões do projeto
- [ ] Comentários adicionados em código complexo
- [ ] Documentação atualizada (README, docs/)
- [ ] Nenhum warning/erro no lint
- [ ] Commits seguem Conventional Commits
- [ ] Branch sincronizada com upstream/develop

## Screenshots (se aplicável)

[Adicionar screenshots de UI, logs, etc.]

## Issues Relacionadas

Closes #42
Fixes #38
```

### Processo de Review

1. **Submissão:** Você abre o PR
2. **Automated Checks:** CI/CD executa testes automatizados
3. **Code Review:** Maintainer revisa o código
4. **Feedback:** Discussão e sugestões de melhorias
5. **Aprovação:** PR aprovado após correções
6. **Merge:** Maintainer faz merge para develop
7. **Release:** Código eventualmente vai para main (próxima release)

### Tempo de Review

- **PRs pequenos (<200 linhas):** 1-3 dias
- **PRs médios (200-500 linhas):** 3-7 dias
- **PRs grandes (>500 linhas):** 7-14 dias

**Dica:** PRs menores são revisados mais rapidamente! Divida features grandes em múltiplos PRs.

---

## 🎨 Diretrizes de Código

### Estilo de Código

**Linguagem:**
- **Variáveis/Funções:** Inglês
- **Comentários:** Português-BR
- **Documentação:** Português-BR
- **Commits:** Português-BR

**Formatação:**
- **Indentação:** 2 espaços (sem tabs)
- **Quotes:** Single quotes `'string'`
- **Semicolons:** Sim (sempre)
- **Max line length:** 120 caracteres
- **Trailing comma:** Sim (em objetos/arrays multi-linha)

**Exemplo:**
```javascript
// ✅ BOM
const authManager = {
  token: null,
  expiresAt: null,

  /**
   * Obtém token de autenticação do cache ou gera novo.
   * @returns {Promise<string>} Token de autenticação
   */
  async getToken() {
    if (this.token && this.expiresAt > Date.now()) {
      return this.token;
    }

    return this._authenticate();
  },
};

// ❌ RUIM
const authManager={token:null,expiresAt:null,async getToken(){if(this.token&&this.expiresAt>Date.now())return this.token;return this._authenticate()}}
```

### Nomeação

**Variáveis:**
```javascript
// ✅ BOM - Descritivo e claro
const veeamHost = process.env.VEEAM_HOST;
const authToken = await authManager.getToken();
const backupJobs = await fetchBackupJobs();

// ❌ RUIM - Ambíguo ou não descritivo
const host = process.env.VEEAM_HOST;
const token = await authManager.getToken();
const jobs = await fetchBackupJobs();
```

**Funções:**
```javascript
// ✅ BOM - Verbo + substantivo, ação clara
async function getBackupJobs() { }
async function createBackupSession() { }
async function validateToken() { }

// ❌ RUIM - Não indica ação
async function backupJobs() { }
async function session() { }
async function token() { }
```

**Constantes:**
```javascript
// ✅ BOM - UPPER_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3;
const TOKEN_EXPIRY_BUFFER = 5 * 60 * 1000;
const VEEAM_API_VERSION = '1.2-rev0';

// ❌ RUIM - camelCase ou PascalCase
const maxRetryAttempts = 3;
const TokenExpiryBuffer = 5 * 60 * 1000;
```

### Comentários

**Quando Comentar:**
- Lógica complexa que não é óbvia
- Workarounds ou hacks temporários
- TODOs e FIXMEs
- Algoritmos não triviais

**Quando NÃO Comentar:**
- Código auto-explicativo
- Reafirmar o que o código já diz
- Comentários desatualizados

**Exemplos:**
```javascript
// ✅ BOM - Explica o "porquê"
// Cache de 55 minutos (5 min antes de expirar) para prevenir race conditions
if (this.token && this.expiresAt > Date.now() + 5 * 60 * 1000) {
  return this.token;
}

// ❌ RUIM - Reafirma o óbvio
// Verifica se token existe
if (this.token) {
  return this.token;
}

// ✅ BOM - TODO com contexto
// TODO(adriano): Implementar retry exponencial após falha de auth
// Ticket: VEEAM-123

// ❌ RUIM - TODO sem contexto
// TODO: melhorar isso
```

### Error Handling

**Sempre capture erros e forneça contexto:**

```javascript
// ✅ BOM
async function getBackupJobs() {
  try {
    const token = await authManager.getToken();
    const response = await fetch(`${VEEAM_HOST}/api/v1/jobs`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error(`Veeam API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch backup jobs:', error);
    throw new Error(`Unable to retrieve backup jobs: ${error.message}`);
  }
}

// ❌ RUIM - Erro silencioso
async function getBackupJobs() {
  try {
    const token = await authManager.getToken();
    const response = await fetch(`${VEEAM_HOST}/api/v1/jobs`);
    return await response.json();
  } catch (error) {
    return [];  // Erro silencioso!
  }
}
```

---

## 🧪 Testando Mudanças

### Setup de Ambiente de Desenvolvimento

```bash
# 1. Clone e instale
git clone https://github.com/SEU-USUARIO/veeam-backup-mcp.git
cd veeam-backup-mcp
npm install

# 2. Configure .env
cp env.example .env
nano .env  # Edite com credenciais de desenvolvimento

# 3. Inicie servidor
npm start  # Modo híbrido (recomendado)
# ou
npm run start:http  # Apenas HTTP
# ou
npm run start:mcp  # Apenas MCP stdio
```

### Testando Protocolo MCP HTTP Streamable

**Scripts de Teste Automatizados:**

```bash
# 1. Testar todos os endpoints MCP (initialize, tools/list, tools/call, etc.)
cd /opt/mcp-servers/veeam-backup/tests
./test-mcp-endpoint.sh

# Saída esperada: 11/11 testes passando
# - Health Check
# - Autenticação (sem token, token inválido)
# - Initialize (handshake MCP)
# - Tools List
# - Tools Call (3 ferramentas)
# - Session Management
# - Método não suportado

# 2. Testar todas as ferramentas individualmente
./test-all-tools.sh

# Saída esperada: 10/10 ferramentas testadas passando
# (5 ferramentas puladas - requerem IDs específicos ou alteram estado)
```

**Teste Manual via curl:**

```bash
# Health check (sem autenticação)
curl http://localhost:8825/health

# Teste de autenticação
curl -X POST http://localhost:8825/mcp \
  -H 'Authorization: Bearer SEU_TOKEN_AQUI' \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'

# Executar ferramenta específica
curl -X POST http://localhost:8825/mcp \
  -H 'Authorization: Bearer SEU_TOKEN_AQUI' \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{
      "name":"veeam_search_backup_jobs",
      "arguments":{}
    },
    "id":1
  }'
```

### Testando Tools via REST API (Legacy)

```bash
# Health check (público - sem autenticação)
curl http://localhost:8825/health

# Lista de jobs (endpoint REST legado)
curl -X POST http://localhost:8825/backup-jobs \
  -H 'Content-Type: application/json' \
  -d '{}'

# Sessões de backup
curl -X POST http://localhost:8825/backup-sessions \
  -H 'Content-Type: application/json' \
  -d '{"jobName": "VM-Production-Backup"}'

# Detalhes de job
curl -X POST http://localhost:8825/job-details \
  -H 'Content-Type: application/json' \
  -d '{"jobName": "SQL-Backup-Daily"}'
```

**Nota:** Os endpoints REST (não-MCP) são mantidos para compatibilidade com Copilot Studio. Para clientes modernos (Claude Code, Gemini CLI), use o protocolo MCP HTTP Streamable via `/mcp`.

### Testando com Clientes MCP

**Claude Desktop (stdio):**
```json
// ~/.config/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "veeam-backup-dev": {
      "command": "node",
      "args": [
        "/caminho/absoluto/para/veeam-backup-mcp/vbr-mcp-server.js",
        "--mcp"
      ]
    }
  }
}
```

**Claude Code (HTTP Streamable):**
```json
// .mcp.json ou ~/.claude/settings.json
{
  "mcpServers": {
    "veeam-backup-dev": {
      "type": "streamable-http",
      "url": "http://localhost:8825/mcp",
      "headers": {
        "Authorization": "Bearer SEU_TOKEN_AQUI"
      }
    }
  }
}
```

**Gemini CLI (HTTP Streamable):**
```json
// ~/.gemini/settings.json
{
  "mcpServers": {
    "veeam-backup-dev": {
      "httpUrl": "http://localhost:8825/mcp",
      "headers": {
        "Authorization": "Bearer SEU_TOKEN_AQUI"
      },
      "timeout": 30000
    }
  }
}
```

### Linting e Formatação

```bash
# Executar ESLint
npm run lint

# Corrigir automaticamente
npm run lint:fix

# Executar Prettier
npm run format

# Verificar formatação
npm run format:check
```

---

## 🐛 Reportando Bugs

### Antes de Reportar

- [ ] Verifique se o bug já foi reportado (GitHub Issues)
- [ ] Confirme que é um bug (não é comportamento esperado)
- [ ] Teste na versão mais recente
- [ ] Colete informações de debugging

### Template de Bug Report

```markdown
## Descrição do Bug

Descrição clara e concisa do problema.

## Passos para Reproduzir

1. Configurar servidor com '...'
2. Executar comando '...'
3. Observar erro em '...'

## Comportamento Esperado

O que deveria acontecer.

## Comportamento Atual

O que está acontecendo.

## Screenshots/Logs

```
[Colar logs ou screenshots aqui]
```

## Ambiente

- **SO:** Ubuntu 22.04 LTS
- **Node.js:** v20.10.0
- **Versão do MCP:** 1.0.0
- **Veeam VBR:** v12.1
- **Modo de Execução:** HTTP/Hybrid/MCP

## Contexto Adicional

Qualquer outra informação relevante.
```

---

## 💡 Solicitando Features

### Template de Feature Request

```markdown
## Problema a Resolver

Descreva o problema que essa feature resolve.

## Solução Proposta

Descreva a solução que você gostaria de ver.

## Alternativas Consideradas

Outras abordagens que você considerou.

## Casos de Uso

Exemplos de como seria usado:

1. Usuário X faria Y
2. Sistema Z chamaria a API

## Benefícios

- Benefício 1
- Benefício 2

## Impacto

- Retrocompatibilidade: [Sim/Não]
- Performance: [Melhora/Neutro/Piora]
- Complexidade: [Baixa/Média/Alta]
```

---

## 📞 Contato e Suporte

### Canais de Comunicação

- **GitHub Issues:** Bugs e feature requests
- **GitHub Discussions:** Perguntas e discussões gerais
- **Email:** contato@skillsit.com.br (suporte oficial)
- **LinkedIn:** [Skills IT](https://linkedin.com/company/skills-it)

### Tempo de Resposta

- **Issues críticos (P0):** 24 horas
- **Bugs (P1):** 3-5 dias úteis
- **Features (P2):** 1-2 semanas
- **Melhorias (P3):** Best effort

---

## 🎖️ Reconhecimento

Contribuidores serão reconhecidos em:

- **CONTRIBUTORS.md** - Lista de todos os colaboradores
- **Release Notes** - Menção em changelog de releases
- **LinkedIn Skills IT** - Post de agradecimento
- **README.md** - Seção de créditos

---

<div align="center">

**Made with ❤️ by [Skills IT - Soluções em TI](https://skillsit.com.br) - BRAZIL 🇧🇷**

*Building Together, One Contribution at a Time*

</div>
