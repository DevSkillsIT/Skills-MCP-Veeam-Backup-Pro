/**
 * MCP Tools Dictionary - Veeam Backup & Replication Server
 *
 * Dicionário completo de ferramentas MCP para integração com Veeam Backup Server.
 * Define schemas JSON para 15 ferramentas divididas em 3 categorias:
 * - Tools de Consulta (7): Listagens e informações
 * - Tools de Operação (2): Controle de jobs
 * - Tools de Monitoramento (6): Status e logs
 *
 * @module mcp-tools-dictionary
 * @version 1.0.0
 * @author Skills IT - MCP Servers
 */

/**
 * Dicionário de ferramentas MCP com schemas JSON Schema completos.
 * Cada tool segue o protocolo MCP 2024-11-05 (Streamable HTTP).
 *
 * Estrutura de cada tool:
 * - name: Identificador único da ferramenta
 * - description: Descrição detalhada em português-BR
 * - inputSchema: JSON Schema completo com validações
 */
export const MCP_TOOLS_DICTIONARY = {
  // ============================================================================
  // CATEGORIA: TOOLS DE CONSULTA (7 ferramentas)
  // Ferramentas para listar recursos e obter informações do servidor VBR
  // ============================================================================

  "get-backup-jobs": {
    name: "get-backup-jobs",
    description: "Lista todos os backup jobs configurados no servidor Veeam Backup & Replication (VBR) com filtros avançados. Permite filtrar por tipo de job (Backup, Replica, BackupCopy), estado (Started, Stopped, Paused) e nome. Suporta paginação para grandes volumes de jobs.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Número máximo de backup jobs a retornar na resposta (paginação). Padrão: 100",
          default: 100,
          minimum: 1,
          maximum: 1000
        },
        skip: {
          type: "number",
          description: "Número de registros a pular (offset para paginação). Útil para percorrer grandes listas. Padrão: 0",
          default: 0,
          minimum: 0
        },
        typeFilter: {
          type: "string",
          description: "Filtro por tipo de job. Valores aceitos: 'Backup' (backup padrão), 'Replica' (replicação de VMs), 'BackupCopy' (cópia de backup), 'BackupSync' (sincronização), ou 'All' para todos. Padrão: 'Backup'",
          default: "Backup"
        },
        stateFilter: {
          type: "string",
          description: "Filtro por estado do job. Valores aceitos: 'Started' (em execução), 'Stopped' (parado), 'Paused' (pausado), 'Working' (processando), ou deixar vazio para todos os estados"
        },
        nameFilter: {
          type: "string",
          description: "Filtro por nome do job (busca parcial, case-insensitive). Exemplo: 'VM-Prod' retorna jobs cujo nome contém 'VM-Prod'"
        }
      },
      required: []
    }
  },

  "get-backup-sessions": {
    name: "get-backup-sessions",
    description: "Lista o histórico de execuções (sessions) de backup jobs com suporte a filtros e paginação. Retorna informações detalhadas sobre cada execução incluindo status (Success, Warning, Failed), horários de início/fim, duração e estatísticas de dados processados.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Número máximo de sessions a retornar. Padrão: 100",
          default: 100,
          minimum: 1,
          maximum: 1000
        },
        skip: {
          type: "number",
          description: "Número de registros a pular (offset para paginação). Padrão: 0",
          default: 0,
          minimum: 0
        },
        jobId: {
          type: "string",
          description: "UUID do backup job para filtrar sessions. Se fornecido, retorna apenas sessions deste job específico. Formato: '00000000-0000-0000-0000-000000000000'"
        },
        statusFilter: {
          type: "string",
          description: "Filtro por status da session. Valores aceitos: 'Success' (concluído com sucesso), 'Warning' (concluído com avisos), 'Failed' (falhou), 'Running' (em execução), ou deixar vazio para todos"
        }
      },
      required: []
    }
  },

  "get-job-details": {
    name: "get-job-details",
    description: "Obtém detalhes completos de um backup job específico incluindo configurações, VMs incluídas, schedule, repositório de destino, proxy utilizado, tipo de backup (incremental/full), retenção e estatísticas de execução. Essencial para auditoria e troubleshooting.",
    inputSchema: {
      type: "object",
      properties: {
        jobId: {
          type: "string",
          description: "UUID obrigatório do backup job a consultar. Obtido via 'get-backup-jobs'. Formato: '00000000-0000-0000-0000-000000000000'"
        }
      },
      required: ["jobId"]
    }
  },

  "get-backup-proxies": {
    name: "get-backup-proxies",
    description: "Lista todos os backup proxies configurados no servidor VBR. Proxies são componentes responsáveis por processar dados durante backups. Retorna informações sobre nome, tipo (VMware, Hyper-V), host, status (Online/Offline), tarefas concorrentes e utilização.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Número máximo de proxies a retornar. Padrão: 100",
          default: 100,
          minimum: 1,
          maximum: 1000
        }
      },
      required: []
    }
  },

  "get-backup-repositories": {
    name: "get-backup-repositories",
    description: "Lista todos os repositórios de backup configurados (locais de armazenamento de backups). Retorna informações sobre nome, tipo (Local, Network, Cloud), capacidade total, espaço livre, status e jobs associados. Essencial para planejamento de capacidade.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Número máximo de repositórios a retornar. Padrão: 100",
          default: 100,
          minimum: 1,
          maximum: 1000
        }
      },
      required: []
    }
  },

  "get-license-info": {
    name: "get-license-info",
    description: "Obtém informações completas sobre licenciamento Veeam Backup & Replication. Retorna tipo de licença (Community, Standard, Enterprise, Enterprise Plus), status (válida/expirada), data de expiração, número de VMs/workloads licenciados e features habilitadas. Crítico para compliance.",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },

  "get-server-info": {
    name: "get-server-info",
    description: "Obtém informações gerais do servidor Veeam Backup & Replication incluindo versão do VBR, build number, nome do servidor, sistema operacional, uptime, status geral e configurações principais. Útil para diagnóstico e inventário.",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  },

  // ============================================================================
  // CATEGORIA: TOOLS DE OPERAÇÃO (2 ferramentas)
  // Ferramentas para controle de execução de backup jobs
  // ============================================================================

  "start-backup-job": {
    name: "start-backup-job",
    description: "Inicia a execução de um backup job sob demanda (fora do schedule configurado). Permite escolher entre backup incremental ou full. Retorna UUID da session criada. Requer permissões de operador ou superior. Útil para backups emergenciais ou testes.",
    inputSchema: {
      type: "object",
      properties: {
        jobId: {
          type: "string",
          description: "UUID obrigatório do backup job a iniciar. Obtido via 'get-backup-jobs'. Formato: '00000000-0000-0000-0000-000000000000'"
        },
        fullBackup: {
          type: "boolean",
          description: "Se true, força backup full (cópia completa). Se false, executa backup incremental conforme configuração do job. Padrão: false",
          default: false
        }
      },
      required: ["jobId"]
    }
  },

  "stop-backup-job": {
    name: "stop-backup-job",
    description: "Para a execução de um backup job em andamento. Interrompe graciosamente o processamento (aguarda conclusão da VM atual antes de parar). Pode levar alguns minutos para efetivar. Requer permissões de operador ou superior. Útil para manutenções emergenciais.",
    inputSchema: {
      type: "object",
      properties: {
        jobId: {
          type: "string",
          description: "UUID obrigatório do backup job a parar. Deve estar em execução (estado 'Starting' ou 'Working'). Formato: '00000000-0000-0000-0000-000000000000'"
        }
      },
      required: ["jobId"]
    }
  },

  // ============================================================================
  // CATEGORIA: TOOLS DE MONITORAMENTO (6 ferramentas)
  // Ferramentas para acompanhar status, logs e saúde do sistema de backup
  // ============================================================================

  "get-running-sessions": {
    name: "get-running-sessions",
    description: "Lista todas as sessions de backup atualmente em execução (estado 'Starting' ou 'Working'). Retorna informações sobre job associado, progresso (%), VMs sendo processadas, velocidade de transferência, tempo estimado de conclusão e estatísticas em tempo real.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Número máximo de sessions ativas a retornar. Padrão: 100",
          default: 100,
          minimum: 1,
          maximum: 1000
        }
      },
      required: []
    }
  },

  "get-failed-sessions": {
    name: "get-failed-sessions",
    description: "Lista todas as sessions de backup que falharam (status 'Failed'). Essencial para troubleshooting e análise de problemas. Retorna informações detalhadas sobre erros, job afetado, horário da falha e mensagens de erro. Permite filtrar por janela de tempo.",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Número máximo de sessions com falha a retornar. Padrão: 100",
          default: 100,
          minimum: 1,
          maximum: 1000
        },
        hours: {
          type: "number",
          description: "Janela de tempo em horas para buscar falhas. Se fornecido, retorna apenas falhas ocorridas nas últimas N horas. Exemplo: 24 retorna falhas do último dia. Mínimo: 1 hora, Máximo: 168 horas (7 dias)",
          minimum: 1,
          maximum: 168
        }
      },
      required: []
    }
  },

  "get-backup-copy-jobs": {
    name: "get-backup-copy-jobs",
    description: "Lista todos os backup copy jobs configurados. Backup Copy Jobs são usados para criar cópias secundárias de backups (regra 3-2-1). Retorna configurações, repositório de origem/destino, schedule, retenção e status de sincronização. Importante para DR (Disaster Recovery).",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Número máximo de backup copy jobs a retornar. Padrão: 100",
          default: 100,
          minimum: 1,
          maximum: 1000
        }
      },
      required: []
    }
  },

  "get-restore-points": {
    name: "get-restore-points",
    description: "Lista todos os restore points (pontos de restauração) disponíveis para VMs. Cada restore point representa um estado de backup da VM em um momento específico. Permite filtrar por nome ou UUID da VM. Retorna data/hora do ponto, tipo (full/incremental), tamanho e localização no repositório.",
    inputSchema: {
      type: "object",
      properties: {
        vmName: {
          type: "string",
          description: "Nome da VM para filtrar restore points (busca parcial, case-insensitive). Exemplo: 'SQL-Server-01'. Mutuamente exclusivo com 'vmId'"
        },
        vmId: {
          type: "string",
          description: "UUID da VM para filtrar restore points. Formato: '00000000-0000-0000-0000-000000000000'. Mutuamente exclusivo com 'vmName'"
        },
        limit: {
          type: "number",
          description: "Número máximo de restore points a retornar. Padrão: 100",
          default: 100,
          minimum: 1,
          maximum: 1000
        }
      },
      required: []
    }
  },

  "get-job-schedule": {
    name: "get-job-schedule",
    description: "Obtém a configuração de agendamento (schedule) de um backup job específico. Retorna tipo de schedule (Daily, Weekly, Monthly, Continuously), horários programados, dias da semana, retenção, política de backup full periódico e próxima execução prevista. Essencial para planejamento.",
    inputSchema: {
      type: "object",
      properties: {
        jobId: {
          type: "string",
          description: "UUID obrigatório do backup job para consultar schedule. Formato: '00000000-0000-0000-0000-000000000000'"
        }
      },
      required: ["jobId"]
    }
  },

  "get-session-log": {
    name: "get-session-log",
    description: "Obtém o log detalhado de uma session de backup específica. Retorna todas as entradas de log incluindo eventos, mensagens informativas, warnings e erros. Permite filtrar por nível de log. Crítico para troubleshooting de falhas e análise de desempenho. Logs incluem timestamps, componentes e mensagens detalhadas.",
    inputSchema: {
      type: "object",
      properties: {
        sessionId: {
          type: "string",
          description: "UUID obrigatório da session de backup para obter logs. Obtido via 'get-backup-sessions' ou 'get-running-sessions'. Formato: '00000000-0000-0000-0000-000000000000'"
        },
        logLevel: {
          type: "string",
          description: "Nível de log a filtrar. Valores aceitos: 'All' (todos os logs), 'Info' (apenas informações), 'Warning' (avisos e erros), 'Error' (apenas erros), 'Debug' (logs de debug detalhados). Padrão: 'All'",
          enum: ["All", "Info", "Warning", "Error", "Debug"],
          default: "All"
        }
      },
      required: ["sessionId"]
    }
  }
};

/**
 * Retorna lista de ferramentas no formato esperado pelo protocolo MCP.
 * Converte o dicionário de tools em array de objetos compatível com o método 'tools/list'.
 *
 * @returns {Array<Object>} Array de ferramentas MCP com schemas completos
 *
 * @example
 * // Uso no handler MCP
 * async function handleToolsList() {
 *   return {
 *     tools: getMCPToolsList()
 *   };
 * }
 */
export function getMCPToolsList() {
  return Object.values(MCP_TOOLS_DICTIONARY);
}

/**
 * Retorna schema de uma tool específica por nome.
 * Útil para validação de parâmetros antes de executar a tool.
 *
 * @param {string} toolName - Nome da tool a buscar
 * @returns {Object|null} Schema da tool ou null se não encontrada
 *
 * @example
 * const schema = getToolSchema('get-backup-jobs');
 * if (schema) {
 *   // Validar parâmetros contra schema.inputSchema
 * }
 */
export function getToolSchema(toolName) {
  return MCP_TOOLS_DICTIONARY[toolName] || null;
}

/**
 * Valida se um nome de tool existe no dicionário.
 *
 * @param {string} toolName - Nome da tool a verificar
 * @returns {boolean} true se a tool existe, false caso contrário
 *
 * @example
 * if (!isValidTool(toolName)) {
 *   throw new Error(`Tool não encontrada: ${toolName}`);
 * }
 */
export function isValidTool(toolName) {
  return toolName in MCP_TOOLS_DICTIONARY;
}

/**
 * Retorna estatísticas do dicionário de tools.
 * Útil para monitoramento e validação de cobertura.
 *
 * @returns {Object} Estatísticas do dicionário
 *
 * @example
 * const stats = getToolsStatistics();
 * console.log(`Total de tools: ${stats.total}`);
 * console.log(`Categorias: ${stats.categories.join(', ')}`);
 */
export function getToolsStatistics() {
  const tools = Object.values(MCP_TOOLS_DICTIONARY);

  return {
    total: tools.length,
    categories: {
      consulta: 7,
      operacao: 2,
      monitoramento: 6
    },
    tools: tools.map(t => t.name)
  };
}
