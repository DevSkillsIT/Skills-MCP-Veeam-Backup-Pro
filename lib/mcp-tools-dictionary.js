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
    description: "Jobs de backup (VMs, replicacao, copia, sincronizacao) no Veeam Backup & Replication. Trabalhos de backup, tarefas agendadas e backup copy jobs com filtro por tipo, estado, nome ou cliente. Use para inventario, auditoria de protecao ou busca de agendamentos no Veeam. Retorna em Markdown.",
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
          description: "Maximo de jobs a retornar (padrao: 25)",
          default: 25,
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
          description: "Tipo de job. 'BackupCopy' para copy jobs (3-2-1), 'All' para todos",
          enum: ["Backup", "Replica", "BackupCopy", "BackupSync", "All"],
          default: "Backup"
        },
        stateFilter: {
          type: "string",
          description: "Filtro por estado do job",
          enum: ["Started", "Stopped", "Paused", "Working"]
        },
        nameFilter: {
          type: "string",
          description: "Busca semantica por nome (parcial, case-insensitive, accent-insensitive)"
        },
        descriptionFilter: {
          type: "string",
          description: "Busca por info do cliente no campo description (nome, ID, localizacao, contrato)"
        }
      },
      required: []
    }
  },

  "veeam_search_backup_sessions": {
    name: "veeam_search_backup_sessions",
    description: "Sessions e historico de execucoes de backup no Veeam Backup & Replication. Rodadas de backup, registros de execucao e resultados com filtro por status (Running, Failed, Success, Warning), escopo e janela de tempo. Use para monitoramento, troubleshooting de falhas ou auditoria de operacoes no Veeam. Retorna em Markdown.",
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
          description: "Maximo de sessions a retornar (padrao: 25)",
          default: 25,
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
          description: "Janela de tempo em horas (max 168 = 7 dias). Filtra sessions das ultimas N horas",
          minimum: 1,
          maximum: 168
        },
        jobIdFilter: {
          type: "string",
          description: "UUID do job para filtrar sessions especificas"
        },
        typeFilter: {
          type: "string",
          description: "Tipo de session (BackupJob, ReplicaJob, BackupCopyJob)"
        }
      },
      required: []
    }
  },

  "veeam_search_restore_points": {
    name: "veeam_search_restore_points",
    description: "Pontos de restauracao (restore points) de VMs no Veeam Backup & Replication. Snapshots, recovery points e backups disponiveis para recuperacao com filtro por nome ou UUID da VM. Use para planejamento de restore, auditoria de RPO ou verificacao de cobertura de protecao no Veeam. Retorna em Markdown.",
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
          description: "Nome da VM (busca semantica parcial, case-insensitive). Usar vmName OU vmId"
        },
        vmId: {
          type: "string",
          description: "UUID da VM. Usar vmName OU vmId"
        },
        limit: {
          type: "number",
          description: "Maximo de restore points a retornar (padrao: 25)",
          default: 25,
          minimum: 1,
          maximum: 50
        }
      },
      required: []
    }
  },

  "veeam_search_infrastructure": {
    name: "veeam_search_infrastructure",
    description: "Infraestrutura de backup (proxies e repositorios) no Veeam Backup & Replication. Proxies de processamento, repositorios de armazenamento e storage com dados de capacidade e uso. Use para diagnostico de desempenho, inventario ou monitoramento de espaco disponivel no Veeam. Retorna em Markdown.",
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
          description: "Maximo de itens a retornar (padrao: 25)",
          default: 25,
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
    description: "Backup jobs no Veeam — detalhes, schedule, iniciar ou parar trabalhos de backup no Veeam Backup & Replication. Acoes disponiveis: get_details (informacoes completas), get_schedule (agendamento), start (iniciar tarefa de backup) e stop (parar execucao). Use para gerenciamento operacional de jobs. Retorna em Markdown.",
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
          description: "UUID do backup job (obrigatorio)"
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
    description: "Logs e detalhes de sessions de backup no Veeam Backup & Replication. Historico de execucoes, registros de rodadas e diagnostico com filtro por nivel de log (Info, Warning, Error, Debug). Use para troubleshooting de falhas, auditoria de operacoes ou analise de desempenho no Veeam. Retorna em Markdown.",
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
    description: "Resources MCP disponiveis no servidor Veeam Backup & Replication. Catalogo de dados estaticos acessiveis via protocolo MCP, incluindo informacoes do servidor e licenciamento. Use para descobrir URIs de resources antes de acessar dados estaticos do Veeam. Retorna em Markdown.",
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
    description: "Dados estaticos do servidor Veeam via URI veeam:// no Veeam Backup & Replication. Leitura direta de resources MCP como informacoes do servidor ou licenciamento. Use apos veeam_list_mcp_resources para acessar dados estaticos do Veeam por URI especifica. Retorna em Markdown.",
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
    description: "Prompts e workflows parametrizados do Veeam Backup & Replication. Catalogo de prompts disponiveis no servidor Veeam com descricao e argumentos aceitos por cada workflow. Use para descobrir automacoes e fluxos de trabalho antes de executar prompts no Veeam. Retorna em Markdown.",
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
    description: "Workflow parametrizado (prompt) no Veeam Backup & Replication. Execucao de automacoes e fluxos de trabalho pre-definidos no servidor Veeam com argumentos customizaveis. Use veeam_list_mcp_prompts para ver prompts disponiveis antes de executar no Veeam. Retorna em Markdown.",
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
