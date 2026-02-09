// lib/response-enricher.js
// Enriquecedor de respostas do MCP Veeam
// Adiciona metadados consistentes a todas as respostas das tools

/**
 * Enriquece resposta com metadados padronizados
 *
 * IMPORTANTE: Todas as tools devem usar este helper para manter
 * consistência nas respostas e facilitar debugging.
 *
 * @param {Object|Array} data - Dados da resposta (objeto ou array)
 * @param {string} toolName - Nome da tool que gerou a resposta
 * @param {Object} additionalMetadata - Metadados adicionais opcionais
 * @returns {Object} Resposta enriquecida com metadados
 */
export function enrichResponse(data, toolName, additionalMetadata = {}) {
  // Garantir que data não seja null/undefined
  if (!data) {
    data = {};
  }

  // Timestamp da resposta
  const timestamp = new Date().toISOString();

  // Metadados base (sempre incluídos)
  const baseMetadata = {
    tool: toolName,
    timestamp: timestamp,
    apiVersion: process.env.VEEAM_API_VERSION || "1.2-rev1",
    server: process.env.VEEAM_HOST || "veeam-server",
    mcpVersion: "1.0.0"
  };

  // Merge de metadados adicionais
  const metadata = {
    ...baseMetadata,
    ...additionalMetadata
  };

  // Retornar resposta enriquecida
  return {
    ...data,
    _metadata: metadata
  };
}

/**
 * Enriquece resposta de erro com contexto detalhado
 *
 * @param {Error} error - Objeto de erro
 * @param {string} toolName - Nome da tool que gerou o erro
 * @param {Object} context - Contexto adicional do erro
 * @returns {Object} Resposta de erro enriquecida
 */
export function enrichErrorResponse(error, toolName, context = {}) {
  const timestamp = new Date().toISOString();

  return {
    error: true,
    errorType: error.name || "Error",
    message: error.message,
    context: {
      tool: toolName,
      timestamp: timestamp,
      server: process.env.VEEAM_HOST || "veeam-server",
      apiVersion: process.env.VEEAM_API_VERSION || "1.2-rev1",
      ...context
    },
    // Stack trace apenas em desenvolvimento
    ...(process.env.NODE_ENV === 'development' && {
      stack: error.stack
    })
  };
}

/**
 * Enriquece resposta de sucesso de operação POST/PATCH/DELETE
 *
 * @param {string} operation - Nome da operação (ex: "veeam_start_backup_job")
 * @param {Object} result - Resultado da operação
 * @param {Object} resourceDetails - Detalhes do recurso afetado
 * @returns {Object} Resposta enriquecida
 */
export function enrichOperationResponse(operation, result, resourceDetails = {}) {
  const timestamp = new Date().toISOString();

  return {
    success: true,
    operation: operation,
    timestamp: timestamp,
    result: result,
    resource: resourceDetails,
    _metadata: {
      apiVersion: process.env.VEEAM_API_VERSION || "1.2-rev1",
      server: process.env.VEEAM_HOST || "veeam-server",
      mcpVersion: "1.0.0"
    }
  };
}

/**
 * Enriquece resposta de lista (array) com estatísticas
 *
 * @param {Array} items - Array de itens
 * @param {string} toolName - Nome da tool
 * @param {Object} filters - Filtros aplicados
 * @param {Object} pagination - Dados de paginação
 * @returns {Object} Resposta enriquecida com summary
 */
export function enrichListResponse(items, toolName, filters = {}, pagination = null) {
  const timestamp = new Date().toISOString();

  const summary = {
    count: items.length,
    total: pagination?.total || items.length,
    hasMore: pagination ? (pagination.skip + items.length < pagination.total) : false
  };

  return {
    summary: summary,
    filters: filters,
    pagination: pagination || {
      limit: items.length,
      skip: 0,
      total: items.length
    },
    items: items,
    _metadata: {
      tool: toolName,
      timestamp: timestamp,
      apiVersion: process.env.VEEAM_API_VERSION || "1.2-rev1",
      server: process.env.VEEAM_HOST || "veeam-server",
      mcpVersion: "1.0.0"
    }
  };
}

/**
 * Cria resposta formatada para MCP
 * Converte objeto enriquecido em formato MCP tool response
 *
 * @param {Object} enrichedData - Dados enriquecidos
 * @param {boolean} isError - Se é uma resposta de erro
 * @returns {Object} Resposta formatada para MCP
 */
export function createMCPResponse(enrichedData, isError = false) {
  return {
    content: [{
      type: "text",
      text: JSON.stringify(enrichedData, null, 2)
    }],
    isError: isError
  };
}

/**
 * Enriquece resposta com dicas de troubleshooting
 *
 * @param {Object} data - Dados da resposta
 * @param {Array<string>} tips - Array de dicas
 * @returns {Object} Resposta com dicas
 */
export function addTroubleshootingTips(data, tips = []) {
  return {
    ...data,
    _troubleshooting: {
      tips: tips,
      documentation: "https://helpcenter.veeam.com/docs/backup/rest/",
      support: "Para suporte Skills IT: contato@skillsit.com.br"
    }
  };
}

/**
 * Adiciona informações de performance à resposta
 *
 * @param {Object} data - Dados da resposta
 * @param {number} startTime - Timestamp de início (Date.now())
 * @returns {Object} Resposta com metrics
 */
export function addPerformanceMetrics(data, startTime) {
  const endTime = Date.now();
  const duration = endTime - startTime;

  return {
    ...data,
    _performance: {
      durationMs: duration,
      durationFormatted: duration < 1000
        ? `${duration}ms`
        : `${(duration / 1000).toFixed(2)}s`
    }
  };
}
