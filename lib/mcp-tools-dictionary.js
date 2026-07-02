/**
 * MCP Tools Dictionary - Veeam Backup & Replication Server
 *
 * 12 tools: 4 search + 2 manage + 2 get + 4 bridge
 * Pattern: search_* (read-only) / manage_* (CRUD + operations) / get_* (single resource)
 *
 * SPEC-VEEAM-ENHANCE-001 / F04
 * Nomenclatura: DIRETRIZES-OBRIGATORIAS-MCP-TOOLS-NOMENCLATURA.md
 *
 * @module mcp-tools-dictionary
 * @version 4.0.0
 * @author Skills IT - MCP Servers
 */

// ============================================================================
// TOOLS DICTIONARY (4 search + 2 manage + 2 get + 4 bridge = 12)
// ============================================================================
export const MCP_TOOLS_DICTIONARY = {

  // ============================================================================
  // CORE TOOLS: SEARCH (4 read-only tools)
  // ============================================================================

  "veeam_search_backup_jobs": {
    name: "veeam_search_backup_jobs",
    description: "Jobs de backup, tarefas agendadas e copias (backup copy) no Veeam Backup & Replication. Busca pelo nome do job OU pelo nome de uma VM dentro do job (parcial, por trecho); jobs fora do inventario (Veeam Agent, replica, site remoto) sao derivados do historico de sessoes. Use quando precisar localizar um job, ver estado, resultado, numero de VMs e ultima execucao. Retorna tabela Markdown.",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    },
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximo de jobs a retornar (padrao: 35, max 50)",
          default: 35,
          minimum: 1,
          maximum: 50
        },
        skip: {
          type: "number",
          description: "Offset para paginacao (padrao: 0)",
          default: 0,
          minimum: 0
        },
        typeFilter: {
          type: "string",
          description: "Tipo de job (VBR 12.3 / REST v1.2-rev0 aceita 'Backup' no endpoint /api/v1/jobs; 'All' omite o filtro). Replicas/Tape/Copy ficam em endpoints dedicados.",
          enum: ["Backup", "All"],
          default: "Backup"
        },
        stateFilter: {
          type: "string",
          description: "Filtro por estado do job",
          enum: ["Started", "Stopped", "Paused", "Working"]
        },
        nameFilter: {
          type: "string",
          description: "Busca parcial por trecho do nome (case/acento-insensitive; vira '*termo*' automaticamente). Casa o nome do JOB e, se nenhum job casar, tambem o nome de uma VM dentro de um job (retorna o job dono da VM). Se ainda assim nao houver job no inventario, deriva do historico de sessoes (7 dias)."
        },
        descriptionFilter: {
          type: "string",
          description: "Busca por info do cliente no campo description (nome, ID, localizacao, contrato). NAO aciona a busca por VM/sessoes (essa e so para nameFilter)."
        }
      },
      required: []
    }
  },

  "veeam_search_backup_sessions": {
    name: "veeam_search_backup_sessions",
    description: "Sessions, execucoes e rodadas de backup no Veeam Backup & Replication. Janela de tempo: hours (ultimas N horas) OU from/to por data. Para o dia inteiro de ontem use from='ontem' e to='ontem'. Um job gera varias tentativas; use groupByJob=true para UMA linha por job em vez de cada execucao. Use quando for monitorar saude, investigar falhas ou auditar o Veeam. Retorna tabela Markdown.",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    },
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximo de sessions a retornar (padrao: 35, max 50)",
          default: 35,
          minimum: 1,
          maximum: 50
        },
        skip: {
          type: "number",
          description: "Offset para paginacao (padrao: 0)",
          default: 0,
          minimum: 0
        },
        scope: {
          type: "string",
          description: "'all' inclui system tasks; 'backup_only' exclui MalwareDetection, SureBackup, etc.",
          enum: ["all", "backup_only"],
          default: "all"
        },
        statusFilter: {
          type: "string",
          description: "Filtro por status: Running (em execucao), Failed, Success, Warning, ou All",
          enum: ["All", "Running", "Failed", "Success", "Warning"],
          default: "All"
        },
        hours: {
          type: "number",
          description: "Janela de tempo em horas (max 168 = 7 dias), filtro client-side das ultimas N horas. Quando usado, o total da paginacao reflete o conjunto filtrado (nao o total bruto). Com groupByJob=true o padrao e 24h.",
          minimum: 1,
          maximum: 168
        },
        from: {
          type: "string",
          description: "Inicio da janela. Formatos aceitos (nao invente outros): ISO '2026-05-28' ou '2026-05-28T05:30'; BR '28/05/2026' ou '28/05/2026 05:30'; palavra 'ontem'/'hoje'/'anteontem' com hora opcional (ex: 'ontem 23:59'); relativo 'ultimas 6 horas'/'7 dias'. Dia inteiro de ontem: from='ontem'. Alternativa a hours; se informado, tem prioridade sobre hours."
        },
        to: {
          type: "string",
          description: "Fim da janela (mesmos formatos de from). Opcional (padrao: agora). So tem efeito com from. Dica: quando voce passa so uma data/palavra (sem hora), 'to' ja inclui ate 23:59:59 daquele dia — para o dia inteiro de ontem use from='ontem' e to='ontem'."
        },
        jobIdFilter: {
          type: "string",
          description: "Filtra sessions de um job. Aceita o UUID OU o NOME do job (parcial) — o nome e resolvido para UUID automaticamente. Se o nome casar varios jobs, retorna os candidatos."
        },
        typeFilter: {
          type: "string",
          description: "Tipo de session (BackupJob, ReplicaJob, BackupCopyJob)"
        },
        groupByJob: {
          type: "boolean",
          description: "Quando true, agrega as sessions em UMA linha por job (ultimo resultado, ultima execucao, tentativas, falhas, sucessos), jobs com falha no topo. Remove o ruido de retentativas. Ideal para visao geral de saude. Combina com hours (padrao 24 nesse modo). Padrao: false.",
          default: false
        }
      },
      required: []
    }
  },

  "veeam_search_restore_points": {
    name: "veeam_search_restore_points",
    description: "Pontos de restauracao (restore points), recovery points e snapshots de uma VM no Veeam Backup & Replication. Busca por nome (parcial) ou UUID; filtra por data via from/to (ISO, BR, 'ontem'/'hoje'). Mostra o job dono e o span de retencao (primeiro/ultimo ponto), util para ver acumulo ou falta de backups. Use para planejar restore ou auditar RPO no Veeam. Retorna tabela Markdown.",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    },
    inputSchema: {
      type: "object",
      properties: {
        vmName: {
          type: "string",
          description: "Nome da VM — busca parcial por trecho (case/acento-insensitive; ex: 'GWPMW' casa 'GWPMWVM010-AD'). Usar vmName OU vmId"
        },
        vmId: {
          type: "string",
          description: "UUID da VM. Usar vmName OU vmId"
        },
        limit: {
          type: "number",
          description: "Maximo de pontos LISTADOS (padrao 35, max 50) — aplicado de verdade. O span de retencao (primeiro/ultimo) e sempre calculado sobre TODOS os pontos, independente do limit.",
          default: 35,
          minimum: 1,
          maximum: 50
        },
        from: {
          type: "string",
          description: "Filtra pontos a partir desta data/hora. Formatos aceitos (nao invente outros): ISO ('2026-05-20'), BR ('20/05/2026 05:00'), palavra 'ontem'/'hoje' (hora opcional) ou relativo ('ultimas 48 horas', '7 dias'). Opcional."
        },
        to: {
          type: "string",
          description: "Filtra pontos ate esta data/hora (mesmos formatos de from). Opcional, padrao agora."
        }
      },
      required: []
    }
  },

  "veeam_search_infrastructure": {
    name: "veeam_search_infrastructure",
    description: "Infraestrutura de backup — repositorios de armazenamento e proxies de processamento no Veeam Backup & Replication. Repositorios trazem status (CRITICO, ATENCAO, OFFLINE) e uso de espaco, ordenados do mais cheio ao mais vazio. Parametro type e obrigatorio. Use quando for monitorar espaco, achar repositorio offline ou diagnosticar desempenho no Veeam. Retorna tabela Markdown.",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    },
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          description: "Tipo de infraestrutura: 'proxies' ou 'repositories'",
          enum: ["proxies", "repositories"]
        },
        limit: {
          type: "number",
          description: "Maximo de itens a retornar (padrao: 35, max 50)",
          default: 35,
          minimum: 1,
          maximum: 50
        },
        skip: {
          type: "number",
          description: "Offset para paginacao (padrao: 0)",
          default: 0,
          minimum: 0
        },
        threshold: {
          type: "number",
          description: "Threshold % de espaco livre para warning (apenas repositories, padrao: 20)",
          default: 20,
          minimum: 1,
          maximum: 99
        }
      },
      required: ["type"]
    }
  },

  // ============================================================================
  // CORE TOOLS: MANAGE (2 tools with read + write actions)
  // ============================================================================

  "veeam_manage_backup_jobs": {
    name: "veeam_manage_backup_jobs",
    description: "Backup jobs no Veeam Backup & Replication — detalhes, agendamento e operacao (iniciar/parar). Acao get_details traz config, sessoes recentes e as VMs protegidas com numero de restore points e datas do primeiro e ultimo ponto, como ao expandir o job no console do Veeam. Use quando for inspecionar, agendar, iniciar ou parar um job (UUID via search_backup_jobs). Retorna Markdown.",
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true
    },
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          description: "Acao: get_details, get_schedule (read-only) ou start, stop (operacao)",
          enum: ["get_details", "get_schedule", "start", "stop"]
        },
        jobId: {
          type: "string",
          description: "Nome (parcial) OU UUID do backup job (obrigatorio). O nome exibido por veeam_search_backup_jobs e resolvido para UUID automaticamente; se casar varios, retorna os candidatos."
        },
        fullBackup: {
          type: "boolean",
          description: "Forcar full backup (apenas para action=start, padrao: false)",
          default: false
        },
        includeSessions: {
          type: "boolean",
          description: "Incluir sessions recentes (apenas para action=get_details, padrao: true)",
          default: true
        },
        sessionLimit: {
          type: "number",
          description: "Max sessions recentes (apenas para action=get_details, padrao: 10)",
          default: 10,
          minimum: 1,
          maximum: 100
        },
        confirmationToken: {
          type: "string",
          description: "Token de confirmacao (obrigatorio se MCP_SAFETY_GUARD=true, para start/stop)"
        },
        reason: {
          type: "string",
          description: "Justificativa (obrigatorio se MCP_SAFETY_GUARD=true, para start/stop)"
        }
      },
      required: ["action", "jobId"]
    }
  },

  "veeam_manage_backup_sessions": {
    name: "veeam_manage_backup_sessions",
    description: "Diagnostico de uma session (execucao) de backup no Veeam Backup & Replication via action=get_log. Mostra o resultado, a causa da falha e, em jobs com varias VMs, o resultado POR VM (Statistics): detalha as VMs com falha ou aviso e a mensagem de erro de cada uma. Use quando for investigar por que um backup falhou no Veeam. Retorna Markdown.",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    },
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          description: "Acao: get_log",
          enum: ["get_log"]
        },
        sessionId: {
          type: "string",
          description: "UUID da session de backup (obrigatorio)"
        },
        logLevel: {
          type: "string",
          description: "Nivel de log: All, Info, Warning, Error, Debug (padrao: All)",
          enum: ["All", "Info", "Warning", "Error", "Debug"],
          default: "All"
        }
      },
      required: ["action", "sessionId"]
    }
  },

  // ============================================================================
  // CORE TOOLS: GET (2 read-only tools)
  // ============================================================================

  "veeam_get_license_compliance": {
    name: "veeam_get_license_compliance",
    description: "Licenciamento e compliance do servidor Veeam Backup & Replication com dados de licenca, cobertura de protecao e workloads protegidos. Informacoes de validade, edicao, instancias licenciadas e utilizacao em uma unica chamada. Use para auditoria de licenciamento ou verificacao de compliance no Veeam. Retorna em Markdown.",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    },
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },

  "veeam_get_server_info": {
    name: "veeam_get_server_info",
    description: "Informacoes do servidor Veeam Backup & Replication para diagnostico e inventario. Versao, build, banco de dados, status geral e configuracao do ambiente de backup. Use para verificacao de saude, planejamento de atualizacoes ou troubleshooting de conectividade no Veeam. Retorna em Markdown.",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    },
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },

  // ============================================================================
  // BRIDGE TOOLS MCPHUB (4 tools)
  // Expose Resources and Prompts as tools for MCPHub
  // SPEC-VEEAM-ENHANCE-001 / F07
  // ============================================================================

  "veeam_list_mcp_resources": {
    name: "veeam_list_mcp_resources",
    description: "Resources MCP (dados estaticos, catalogo) disponiveis no servidor Veeam Backup & Replication, como informacoes do servidor e licenciamento. Lista as URIs veeam:// que podem ser lidas. Use quando precisar descobrir quais recursos estaticos existem antes de le-los com veeam_read_mcp_resource no Veeam. Retorna lista em Markdown.",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    },
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },

  "veeam_read_mcp_resource": {
    name: "veeam_read_mcp_resource",
    description: "Dados estaticos (resource MCP) do servidor Veeam Backup & Replication lidos por URI veeam://, como informacoes do servidor ou licenciamento. Leitura direta de um recurso especifico. Use apos veeam_list_mcp_resources, quando ja souber a URI do dado que deseja consultar no Veeam. Retorna conteudo em Markdown.",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    },
    inputSchema: {
      type: "object",
      properties: {
        uri: {
          type: "string",
          description: "URI do resource a ler",
          enum: ["veeam://server-info", "veeam://license"]
        }
      },
      required: ["uri"]
    }
  },

  "veeam_list_mcp_prompts": {
    name: "veeam_list_mcp_prompts",
    description: "Prompts, workflows e fluxos parametrizados disponiveis no servidor Veeam Backup & Replication, cada um com descricao e argumentos aceitos. Catalogo de automacoes pre-definidas. Use quando precisar descobrir quais workflows existem antes de executa-los com veeam_get_mcp_prompt no Veeam. Retorna catalogo em Markdown.",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    },
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },

  "veeam_get_mcp_prompt": {
    name: "veeam_get_mcp_prompt",
    description: "Workflow parametrizado (prompt) executado no servidor Veeam Backup & Replication, com argumentos customizaveis para automacoes e fluxos pre-definidos. Executa uma automacao especifica pelo nome. Use veeam_list_mcp_prompts para descobrir os prompts disponiveis antes de executar no Veeam. Retorna resultado em Markdown.",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true
    },
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Nome do prompt a executar"
        },
        arguments: {
          type: "object",
          description: "Argumentos do prompt"
        }
      },
      required: ["name"]
    }
  }
};

// ============================================================================
// EXPORTED FUNCTIONS
// ============================================================================

/**
 * Returns list of tools in MCP protocol format.
 * @returns {Array<Object>} Array of MCP tools with schemas
 */
export function getMCPToolsList() {
  return Object.values(MCP_TOOLS_DICTIONARY);
}

/**
 * Returns schema of a specific tool by name.
 * @param {string} toolName - Tool name (format: veeam_{verb}_{resource})
 * @returns {Object|null} Tool schema or null if not found
 */
export function getToolSchema(toolName) {
  return MCP_TOOLS_DICTIONARY[toolName] || null;
}

/**
 * Validates if a tool name exists in the dictionary.
 * @param {string} toolName - Tool name to verify
 * @returns {boolean} true if tool exists
 */
export function isValidTool(toolName) {
  return toolName in MCP_TOOLS_DICTIONARY;
}

/**
 * Returns dictionary statistics.
 * @returns {Object} Statistics
 */
export function getToolsStatistics() {
  const tools = Object.values(MCP_TOOLS_DICTIONARY);

  return {
    total: tools.length,
    categories: {
      search: 4,
      manage: 2,
      get: 2,
      bridge: 4
    },
    tools: tools.map(t => t.name)
  };
}
