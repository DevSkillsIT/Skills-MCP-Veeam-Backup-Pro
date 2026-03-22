// lib/formatters/response-formatter.js
// Interceptor centralizado: converte respostas de tools para Markdown
// SPEC-VEEAM-ENHANCE-001 / F01
//
// Pattern identico ao Hudu (src/formatters/response-formatter.ts).
// Recebe dados como OBJETOS JS, NAO como strings JSON.
// NUNCA fazer JSON.stringify -> JSON.parse round-trip.

import {
  formatBackupJobsList,
  formatBackupJobDetail,
  formatSessionsList,
  formatSessionLog,
  formatRestorePointsList,
  formatProxiesList,
  formatRepositoriesList,
  formatLicenseInfo,
  formatServerInfo,
  formatJobSchedule,
  formatOperationResult
} from './veeam-formatters.js';

import { checkResponseSize } from './markdown-helpers.js';

/**
 * Mapa de formatters por nome de tool.
 * Cada entrada converte dados da resposta em Markdown.
 *
 * Pattern:
 * - search_* tools: recebem { data: [...], pagination: {...} } -> lista Markdown
 * - manage_* tools: roteiam por action -> detalhe ou operacao Markdown
 * - bridge tools: retornam strings direto (type check)
 */
const TOOL_FORMATTERS = {
  // === CORE TOOLS (7) ===

  'veeam_search_backup_jobs': (data, args) =>
    formatBackupJobsList(data, args),

  'veeam_manage_backup_jobs': (data, args) => {
    const action = args?.action;
    if (action === 'get_details') return formatBackupJobDetail(data);
    if (action === 'get_schedule') return formatJobSchedule(data);
    if (action === 'start' || action === 'stop') return formatOperationResult(data, action);
    return formatBackupJobDetail(data);
  },

  'veeam_search_backup_sessions': (data, args) =>
    formatSessionsList(data, args),

  'veeam_manage_backup_sessions': (data) => {
    return formatSessionLog(data);
  },

  'veeam_search_restore_points': (data, args) =>
    formatRestorePointsList(data, args),

  'veeam_search_infrastructure': (data, args) => {
    if (args?.type === 'repositories') return formatRepositoriesList(data);
    return formatProxiesList(data);
  },

  'veeam_get_license_compliance': (data) =>
    formatLicenseInfo(data),

  'veeam_get_server_info': (data) =>
    formatServerInfo(data),

  // === BRIDGE TOOLS (4) ===
  // Bridge tools retornam Markdown direto no executor.
  // Type check garante que objetos nao passem sem formatacao.

  'veeam_list_mcp_resources': (data) =>
    typeof data === 'string' ? data : JSON.stringify(data, null, 2),
  'veeam_read_mcp_resource': (data) =>
    typeof data === 'string' ? data : JSON.stringify(data, null, 2),
  'veeam_list_mcp_prompts': (data) =>
    typeof data === 'string' ? data : JSON.stringify(data, null, 2),
  'veeam_get_mcp_prompt': (data) =>
    typeof data === 'string' ? data : JSON.stringify(data, null, 2),

};

/**
 * Interceptor central: converte resposta de tool para Markdown.
 * Chamado em vbr-mcp-server.js no handler de tools/call.
 *
 * IMPORTANTE: Recebe dados como OBJETOS JS, NAO como strings JSON.
 * Pattern identico ao Hudu (src/formatters/response-formatter.ts).
 *
 * @param {string} toolName - Nome da tool (ex: 'veeam_search_backup_jobs')
 * @param {any} data - Dados da resposta como OBJETO JS (nao string)
 * @param {object} args - Argumentos originais da chamada da tool
 * @returns {string} Resposta formatada em Markdown
 */
export function formatToolResponse(toolName, data, args) {
  // Caso 1: data ja e string (bridge tools ou Markdown pronto)
  if (typeof data === 'string') return data;

  // Caso 2: search tools com null/undefined -> tratar como lista vazia
  if ((data === null || data === undefined) && toolName.includes('search_')) {
    data = { data: [] };
  }

  // Caso 3: null/undefined para outras tools
  if (data === null || data === undefined) return '';

  // Caso 4: buscar formatter
  const formatter = TOOL_FORMATTERS[toolName];
  if (formatter) {
    const markdown = formatter(data, args || {});

    // Caso 5: verificar tamanho
    const sizeCheck = checkResponseSize(markdown);
    if (sizeCheck.exceeded) {
      return sizeCheck.message;
    }

    return markdown;
  }

  // Fallback: JSON.stringify (NAO deve acontecer na entrega final)
  return JSON.stringify(data, null, 2);
}
