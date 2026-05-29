# Índice da Documentação - Veeam Backup MCP Server

**Guia rápido de navegação entre documentos** · Versão **2.0.0**

---

## 📚 Documentação Disponível

| # | Documento | Para quê | Público |
|---|-----------|----------|---------|
| 1 | **[README.md](README.md)** ⭐ | Visão geral, instalação, as 12 ferramentas e exemplos | Todos |
| 2 | **[ARCHITECTURE_AND_DESIGN.md](ARCHITECTURE_AND_DESIGN.md)** 🏛️ | Arquitetura interna: transporte MCP HTTP Streamable, interceptor Markdown, libs | Arquitetos, DevOps |
| 3 | **[DEPLOYMENT.md](DEPLOYMENT.md)** 🚀 | Deploy com PM2 e Docker, rede e monitoramento | DevOps, SysAdmin |
| 4 | **[SECURITY.md](SECURITY.md)** 🔒 | Modelo de ameaças, autenticação, hardening | SecOps, DevOps |
| 5 | **[CONTRIBUTING.md](CONTRIBUTING.md)** 🤝 | Como contribuir, Conventional Commits, testes | Colaboradores |
| 6 | **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** 🔧 | Erros comuns e diagnóstico | Todos |
| 7 | **[docs/SAFETY_GUARD.md](docs/SAFETY_GUARD.md)** 🛡️ | Proteção das operações críticas (`start`/`stop`) | DevOps, SecOps |
| 8 | **[docs/DESCRIPTION_FEATURES_OPERATIONS_GUIDE.md](docs/DESCRIPTION_FEATURES_OPERATIONS_GUIDE.md)** 🏢 | Operações MSP multi-cliente via campo `description` | Operadores MSP |
| 9 | **[scripts/README.md](scripts/README.md)** | Scripts de inicialização (`start.sh`) | DevOps |

---

## 🛠️ As 12 Ferramentas (referência rápida)

Padrão `search_*` (leitura) / `manage_*` (leitura + operação) / `get_*` (recurso único) / bridges MCPHub.

### Busca / leitura (4)
| Tool | O que faz |
|------|-----------|
| `veeam_search_backup_jobs` | Jobs e backup copy; busca por nome do job OU de uma VM; deriva jobs fora do inventário (Agent/replica/site remoto) do histórico de sessões |
| `veeam_search_backup_sessions` | Sessions/execuções; janela `hours` ou `from`/`to` flexível; `groupByJob=true` agrega 1 linha por job (visão de saúde) |
| `veeam_search_restore_points` | Restore points de uma VM; span de retenção (primeiro/último); candidatos quando o nome casa várias VMs |
| `veeam_search_infrastructure` | Repositórios (status CRÍTICO/ATENÇÃO/OFFLINE + espaço) e proxies; `type` obrigatório |

### Operação (2)
| Tool | Ações |
|------|-------|
| `veeam_manage_backup_jobs` | `get_details`, `get_schedule` (leitura) · `start`, `stop` (operação, protegidas por Safety Guard). Aceita nome OU UUID |
| `veeam_manage_backup_sessions` | `get_log` — resultado, causa da falha e **resultado por VM** (Statistics) |

### Recurso único (2)
| Tool | O que faz |
|------|-----------|
| `veeam_get_license_compliance` | Licença, edição, instâncias e workloads protegidos |
| `veeam_get_server_info` | Versão, build e banco de dados do VBR |

### Bridges MCPHub (4)
`veeam_list_mcp_resources` · `veeam_read_mcp_resource` · `veeam_list_mcp_prompts` · `veeam_get_mcp_prompt`

> **2 resources** (`veeam://server-info`, `veeam://license`) e **15 prompts** (7 para gestor + 8 técnicos) — veja o README.

---

## 📂 Estrutura de Arquivos (atual)

```
/opt/mcp-servers/veeam-backup/
│
├── vbr-mcp-server.js              ← Servidor principal (modos: --mcp, --http, híbrido)
├── package.json                   ← v2.0.0
├── .env.example                   ← Template de configuração
├── LICENSE                        ← Licença MIT
│
├── README.md · ARCHITECTURE_AND_DESIGN.md · DEPLOYMENT.md
├── SECURITY.md · CONTRIBUTING.md · TROUBLESHOOTING.md · DOCS_INDEX.md
│
├── tools/                         ← 8 arquivos → 12 tools lógicas
│   ├── search-backup-jobs.js
│   ├── search-backup-sessions.js
│   ├── search-restore-points.js
│   ├── search-infrastructure.js
│   ├── manage-backup-jobs.js          (get_details / get_schedule / start / stop)
│   ├── manage-backup-sessions.js      (get_log)
│   ├── get-license.js
│   ├── get-server-info.js
│   └── bridge-tools.js                (list/read resources, list/get prompts)
│
├── lib/
│   ├── auth-middleware.js · mcp-auth-middleware.js   ← autenticação Veeam / Bearer
│   ├── veeam-fetch.js                 ← cliente HTTP (timeout 8s, sem retry, fail-soft)
│   ├── backup-coverage.js             ← VM↔job, span de restore points, resolução de nome
│   ├── session-aggregation.js         ← groupByJob, derivação de jobs por sessão
│   ├── date-helper.js                 ← datas flexíveis (ISO / BR / natural / relativo)
│   ├── description-helpers.js         ← busca semântica por description (MSP)
│   ├── mcp-tools-dictionary.js        ← fonte ÚNICA das 12 descrições (o que a LLM vê)
│   ├── prompts.js                     ← 15 prompts
│   ├── resources.js                   ← 2 resources
│   ├── safety-guard.js                ← proteção de start/stop
│   ├── format-helpers.js · veeam-dictionaries.js · response-enricher.js
│   ├── validation-helpers.js · audit-logger.js
│   └── formatters/
│       ├── response-formatter.js      ← interceptor (roteia por tool → Markdown)
│       ├── veeam-formatters.js
│       └── markdown-helpers.js
│
├── docs/
│   ├── SAFETY_GUARD.md
│   └── DESCRIPTION_FEATURES_OPERATIONS_GUIDE.md
│
├── tests/                         ← node --test (unit/formatters + unit/lib + integration)
│
└── scripts/
    ├── README.md · start.sh · start-server.sh
    └── dev/                       ← scripts de diagnóstico de API
```

---

## 🗺️ Fluxos de leitura recomendados

- **Primeiro contato:** README → DEPLOYMENT → TROUBLESHOOTING
- **Deploy em produção:** README → ARCHITECTURE_AND_DESIGN → SECURITY → DEPLOYMENT
- **Operação MSP:** README → docs/DESCRIPTION_FEATURES_OPERATIONS_GUIDE → docs/SAFETY_GUARD
- **Contribuir:** README → ARCHITECTURE_AND_DESIGN → CONTRIBUTING → código (`tools/`, `lib/`)

---

## 📞 Suporte

1. Consulte a documentação acima.
2. **GitHub Issues:** [Abrir Issue](https://github.com/DevSkillsIT/Skills-MCP-Veeam-Backup-Pro/issues)
3. **Email:** contato@skillsit.com.br

---

<div align="center">

**Made with ❤️ by [Skills IT - Soluções em TI](https://skillsit.com.br) - BRAZIL 🇧🇷**

</div>
