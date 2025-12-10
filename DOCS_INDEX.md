# Índice da Documentação - Veeam Backup MCP Server

**Guia rápido de navegação entre documentos**

---

## 📚 Documentação Disponível

### 1. **[README.md](README.md)** - Início Rápido ⭐

**Quando ler:** Primeiro contato com o projeto

**Conteúdo:**
- ✅ Visão geral do projeto e MCP HTTP Streamable (2024-11-05)
- ✅ Por que arquitetura híbrida?
- ✅ Comparação com MCPO
- ✅ Instalação (3 métodos)
- ✅ Configuração básica (.env + Bearer Token)
- ✅ 16 ferramentas disponíveis (14 leitura + 2 escrita com Safety Guard)
- ✅ Documentação detalhada de cada ferramenta com exemplos práticos e casos de uso
- ✅ Integração com Claude Code e Gemini CLI (MCP HTTP Streamable)
- ✅ Exemplos práticos de uso
- ✅ Licença MIT e créditos

**Público-alvo:** Iniciantes, desenvolvedores, gestores de TI

**Tempo de leitura:** 15-20 minutos

---

### 2. **[ARCHITECTURE_AND_DESIGN.md](ARCHITECTURE_AND_DESIGN.md)** - Arquitetura Técnica 🏛️

**Quando ler:** Para entender implementação interna

**Conteúdo:**
- 🔍 Diagrama de componentes detalhado
- 🔍 Fluxo de dados (MCP vs HTTP)
- 🔍 Autenticação automática (middleware)
- 🔍 Comparação técnica com MCPO
- 🔍 Escalabilidade e performance
- 🔍 Benchmarks e métricas
- 🔍 Roadmap futuro

**Público-alvo:** Arquitetos, desenvolvedores sênior, DevOps

**Tempo de leitura:** 25-30 minutos

---

### 3. **[DEPLOYMENT.md](DEPLOYMENT.md)** - Guia de Deployment 🚀

**Quando ler:** Para fazer deploy em produção

**Conteúdo:**
- 📦 Deployment em desenvolvimento, staging e produção
- 📦 Docker e Docker Compose
- 📦 PM2 para gerenciamento de processos
- 📦 Load balancing com Nginx
- 📦 Configuração de rede e firewall
- 📦 Monitoramento e logging
- 📦 Troubleshooting comum
- 📦 Checklist de produção

**Público-alvo:** DevOps, SysAdmins, SRE

**Tempo de leitura:** 20-25 minutos

---

### 4. **[SECURITY.md](SECURITY.md)** - Guia de Segurança 🔒

**Quando ler:** Antes de deploy em produção (obrigatório!)

**Conteúdo:**
- 🛡️ Modelo de ameaças
- 🛡️ Autenticação Veeam (OAuth2)
- 🛡️ Controle de acesso HTTP (Nginx + Basic Auth)
- 🛡️ SSL/TLS (desenvolvimento vs produção)
- 🛡️ Gerenciamento de credenciais (.env, Vault)
- 🛡️ Firewall e network security (UFW, iptables)
- 🛡️ Auditoria e monitoramento (logs, SIEM)
- 🛡️ Hardening checklist
- 🛡️ Incident response

**Público-alvo:** SecOps, DevOps, SysAdmins, CISO

**Tempo de leitura:** 30-35 minutos

---

### 5. **[CONTRIBUTING.md](CONTRIBUTING.md)** - Guia de Contribuição 🤝

**Quando ler:** Para contribuir com código ou documentação

**Conteúdo:**
- 🌟 Código de conduta
- 🌟 Processo de contribuição (fork, branch, PR)
- 🌟 Conventional Commits (padrão PT-BR)
- 🌟 Diretrizes de código (estilo, nomeação, comentários)
- 🌟 Pull Request process
- 🌟 Testando mudanças
- 🌟 Reportando bugs
- 🌟 Solicitando features

**Público-alvo:** Desenvolvedores, colaboradores open source

**Tempo de leitura:** 20-25 minutos

---

### 6. **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Resolução de Problemas 🔧

**Quando ler:** Quando encontrar erros ou problemas

**Conteúdo:**
- 🔧 Problemas comuns e soluções
- 🔧 Erros de autenticação
- 🔧 Problemas de conexão Veeam
- 🔧 Erros de loading de tools
- 🔧 Timeouts e latência
- 🔧 Debug mode

**Público-alvo:** Todos

**Tempo de leitura:** 10-15 minutos

---

### 7. **docs/** - Documentação Técnica Detalhada 📁

**Quando ler:** Para implementações específicas e detalhes técnicos

**Arquivos Disponíveis:**
- 📄 **IMPLEMENTACAO-MCP-HTTP-STREAMABLE.md** - Implementação completa do protocolo MCP HTTP Streamable (697 linhas)
- 📄 **SAFETY_GUARD.md** - Documentação do sistema Safety Guard para operações críticas (742 linhas)
- 📄 **SECURITY_IMPROVEMENTS_IMPLEMENTED.md** - Melhorias de segurança implementadas
- 📄 **QUALITY_VERIFICATION_REPORT.md** - Relatório de verificação de qualidade (manager-quality)
- 📄 **VERIFICATION_COMPLETE.txt** - Verificação de conclusão do Safety Guard
- 📄 **quality_verification_safety_guard.xml** - Metadata XML de qualidade
- 📄 **QUICK_TEST_REFERENCE.md** - Referência rápida de testes (curl examples)
- 📄 **TESTING-NEW-TOOLS.md** - Documentação de testes das 9 novas ferramentas
- 📄 **CHANGELOG_SAFETY_GUARD.md** - Changelog detalhado do Safety Guard (versão 1.1.0)
- 📄 **IMPLEMENTATION-SUMMARY.md** - Resumo de implementações
- 📄 **MELHORIAS_IMPLEMENTADAS_2025-12-09.md** - Melhorias implementadas em 09/12/2025

**Público-alvo:** Desenvolvedores, arquitetos, contribuidores técnicos

---

## 🗺️ Fluxo de Leitura Recomendado

### Para Iniciantes (Primeira Vez)

```
1. README.md (visão geral) ✅
     ↓
2. DEPLOYMENT.md (setup básico) ✅
     ↓
3. TROUBLESHOOTING.md (se necessário) ⚠️
```

**Tempo total:** 30-40 minutos

---

### Para Deployment em Produção

```
1. README.md (revisão) ✅
     ↓
2. ARCHITECTURE_AND_DESIGN.md (entender arquitetura) 🏛️
     ↓
3. SECURITY.md (hardening obrigatório!) 🔒
     ↓
4. DEPLOYMENT.md (deploy passo-a-passo) 🚀
     ↓
5. TROUBLESHOOTING.md (referência) 🔧
```

**Tempo total:** 1h30-2h

---

### Para Contribuidores

```
1. README.md (visão geral) ✅
     ↓
2. ARCHITECTURE_AND_DESIGN.md (entender código) 🏛️
     ↓
3. CONTRIBUTING.md (padrões de contribuição) 🤝
     ↓
4. Código fonte (tools/, lib/, vbr-mcp-server.js)
```

**Tempo total:** 1h-1h30

---

## 📂 Estrutura de Arquivos do Projeto

```
/opt/mcp-servers/veeam-backup/
│
├── 📄 README.md                       ← Início aqui!
├── 📄 ARCHITECTURE_AND_DESIGN.md      ← Arquitetura técnica
├── 📄 DEPLOYMENT.md                   ← Guia de deploy
├── 📄 SECURITY.md                     ← Segurança
├── 📄 CONTRIBUTING.md                 ← Como contribuir
├── 📄 TROUBLESHOOTING.md              ← Resolver problemas
├── 📄 DOCS_INDEX.md                   ← Este arquivo
│
├── 📄 LICENSE                         ← Licença MIT
├── 📄 package.json                    ← Dependências Node.js
├── 📄 .env.example                    ← Template de configuração
│
├── 🔧 vbr-mcp-server.js               ← Servidor principal (entrypoint)
│
├── 📁 lib/                            ← Bibliotecas
│   ├── auth-middleware.js             ← Autenticação HTTP automática
│   ├── mcp-auth-middleware.js         ← Autenticação MCP Bearer Token
│   └── safety-guard.js                ← Proteção para operações críticas
│
├── 📁 tools/                          ← Ferramentas MCP (16 tools)
│   ├── get-backup-jobs-tool.js        ← Lista todos os jobs de backup
│   ├── get-backup-copy-jobs-tool.js   ← Jobs de cópia para compliance 3-2-1
│   ├── get-job-details-tool.js        ← Detalhes completos de um job
│   ├── get-job-schedule-tool.js       ← Agendamento de jobs
│   ├── get-backup-sessions-tool.js    ← Histórico de execuções
│   ├── get-running-sessions-tool.js   ← Todas sessões em execução
│   ├── get-running-backup-jobs-tool.js ← Jobs de backup rodando agora
│   ├── get-failed-sessions-tool.js    ← Sessões com falha (troubleshooting)
│   ├── get-session-log-tool.js        ← Logs detalhados de sessão
│   ├── get-restore-points-tool.js     ← Pontos de restauração de VMs
│   ├── get-backup-proxies-tool.js     ← Status dos proxies
│   ├── get-backup-repositories-tool.js ← Repositórios e capacidade
│   ├── get-license-info-tool.js       ← Informações de licença
│   ├── get-server-info-tool.js        ← Informações do servidor VBR
│   ├── start-backup-job-tool.js       ← Iniciar backup sob demanda (Safety Guard)
│   └── stop-backup-job-tool.js        ← Parar backup em execução (Safety Guard)
│
├── 📁 docs/                           ← Documentação técnica detalhada
│   ├── IMPLEMENTACAO-MCP-HTTP-STREAMABLE.md
│   ├── SAFETY_GUARD.md
│   ├── SECURITY_IMPROVEMENTS_IMPLEMENTED.md
│   ├── QUALITY_VERIFICATION_REPORT.md
│   ├── QUICK_TEST_REFERENCE.md
│   ├── TESTING-NEW-TOOLS.md
│   ├── CHANGELOG_SAFETY_GUARD.md
│   ├── IMPLEMENTATION-SUMMARY.md
│   └── MELHORIAS_IMPLEMENTADAS_2025-12-09.md
│
├── 📁 tests/                          ← Scripts de teste
│   ├── test-mcp-endpoint.sh           ← Testa protocolo MCP HTTP (11 testes)
│   ├── test-all-tools.sh              ← Testa todas as 16 ferramentas
│   ├── test-safety-improvements.sh    ← Testa Safety Guard
│   ├── test-skills-it.js              ← Testes específicos Skills IT
│   ├── test-hybrid.js                 ← Testes modo híbrido
│   ├── test-mcp-diagnostico.js        ← Diagnóstico MCP
│   └── debug-sessions.js              ← Debug de sessões ativas
│
└── 📁 scripts/                        ← Scripts de inicialização
    ├── README.md                       ← Documentação dos scripts de inicialização
    ├── start.sh                        ← Produção (validações, 3 modos: --mcp, --http, híbrido)
    └── start-server.sh                ← Desenvolvimento (rápido, porta 8825, logs em /tmp)
```

---

## 🔗 Links Rápidos

| Documento | Link Direto | Descrição Curta |
|-----------|-------------|-----------------|
| **README** | [README.md](README.md) | Visão geral e quick start |
| **Arquitetura** | [ARCHITECTURE_AND_DESIGN.md](ARCHITECTURE_AND_DESIGN.md) | Detalhes técnicos de implementação |
| **Deploy** | [DEPLOYMENT.md](DEPLOYMENT.md) | Como fazer deploy |
| **Segurança** | [SECURITY.md](SECURITY.md) | Hardening e boas práticas |
| **Contribuir** | [CONTRIBUTING.md](CONTRIBUTING.md) | Como contribuir com código |
| **Problemas** | [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Resolução de erros |

---

## 📞 Suporte

### Precisa de Ajuda?

1. **Leia a documentação** acima primeiro
2. **GitHub Issues:** [Abrir Issue](https://github.com/DevSkillsIT/Skills-MCP-Veeam-Backup-Pro/issues)
3. **Email:** contato@skillsit.com.br

### FAQ

**P: Por onde começo?**
R: Leia o [README.md](README.md) primeiro.

**P: Como faço deploy em produção?**
R: Siga [SECURITY.md](SECURITY.md) + [DEPLOYMENT.md](DEPLOYMENT.md).

**P: Como contribuir?**
R: Leia [CONTRIBUTING.md](CONTRIBUTING.md).

**P: Encontrei um bug, o que faço?**
R: Consulte [TROUBLESHOOTING.md](TROUBLESHOOTING.md) primeiro, depois abra uma issue.

---

<div align="center">

**Made with ❤️ by [Skills IT - Soluções em TI](https://skillsit.com.br) - BRAZIL 🇧🇷**

*Organized Documentation for Better Understanding*

</div>
