// lib/formatters/markdown-helpers.js
// Helpers utilitarios para formatacao Markdown das respostas MCP Veeam
// SPEC-VEEAM-ENHANCE-001 / F01
//
// REGRA: NAO recriar funcoes que ja existem em format-helpers.js.
// Este arquivo cria APENAS helpers novos e re-exporta os existentes.

import {
  formatDateTime,
  formatBytes,
  formatDuration,
  formatJobState,
  formatSessionResult,
  formatJobType,
  formatRepositoryType,
  formatSessionType,
  formatProgress,
  isBackupJob,
  isSystemTask
} from '../format-helpers.js';

/**
 * Escapa caracteres pipe que quebram tabelas Markdown.
 * @param {*} value - Valor a escapar (qualquer tipo)
 * @returns {string} Valor como string com pipes escapados
 */
export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\|/g, '\\|');
}

/**
 * Trunca texto para tamanho maximo com sufixo "...".
 * Aplica esc() apos truncamento para seguranca em tabelas Markdown.
 * @param {*} text - Texto a truncar
 * @param {number} maxLen - Tamanho maximo (default: 300)
 * @returns {string} Texto truncado e escapado
 */
export function truncate(text, maxLen = 300) {
  if (!text) return '';
  const str = String(text);
  if (str.length <= maxLen) return esc(str);
  return esc(str.slice(0, maxLen)) + '...';
}

/**
 * Formata informacao de paginacao para primeira linha de listas Markdown.
 *
 * NOTA: Assinatura difere do Hudu (que usa HuduPagedResponse<T>)
 * porque a API Veeam retorna paginacao com skip/limit, nao page/pageSize.
 *
 * @param {number} count - Numero de resultados retornados
 * @param {number} limit - Limite por pagina
 * @param {number} skip - Offset de registros pulados
 * @param {number} [total] - Total de registros disponiveis (opcional)
 * @returns {string} Info de paginacao formatada (ex: "**25 resultados** | Pagina 1")
 */
export function pageInfo(count, limit, skip, total) {
  const parts = [`**${count} resultados**`];
  if (total && total > count) {
    const page = Math.floor(skip / limit) + 1;
    parts.push(`Pagina ${page} (total: ${total}, limit: ${limit})`);
  } else {
    parts.push('Mostrando todos');
  }
  return parts.join(' | ');
}

/**
 * Verifica se tamanho da resposta excede limite de seguranca.
 *
 * @MX:NOTE: Ceiling lowered from 400KB to 50KB on 2026-04-23 audit.
 * Empirically, all tools deliver <8KB of Markdown via the MCP interceptor even
 * at max limits. 50KB is ~12.5K tokens — generous headroom (~6% of a 200K
 * context window) while still catching regressions early. Override via
 * MCP_MAX_RESPONSE_BYTES env var if an operator legitimately needs larger
 * responses (rare — prefer pagination and filters instead).
 *
 * @param {string} text - Texto da resposta
 * @param {number} maxBytes - Limite em bytes (default: 50KB, env override supported)
 * @returns {{ exceeded: boolean, size: number, message?: string }}
 */
export function checkResponseSize(text, maxBytes) {
  const envOverride = Number(process.env.MCP_MAX_RESPONSE_BYTES);
  const effectiveMax = Number.isFinite(maxBytes) ? maxBytes
    : (Number.isFinite(envOverride) && envOverride > 0 ? envOverride : 50 * 1024);
  const size = Buffer.byteLength(text, 'utf8');
  if (size > effectiveMax) {
    return {
      exceeded: true,
      size,
      message: `Resposta excede ${Math.round(effectiveMax / 1024)}KB (${Math.round(size / 1024)}KB). ` +
               `Use filtros mais restritivos, reduza o limit, ou estreite a janela (hours). ` +
               `Para casos legítimos de payload maior, defina MCP_MAX_RESPONSE_BYTES.`
    };
  }
  return { exceeded: false, size };
}

// Re-exportar funcoes existentes de format-helpers.js
// para que os formatters importem tudo de um unico modulo.
export {
  formatDateTime,
  formatBytes,
  formatDuration,
  formatJobState,
  formatSessionResult,
  formatJobType,
  formatRepositoryType,
  formatSessionType,
  formatProgress,
  isBackupJob,
  isSystemTask
};
