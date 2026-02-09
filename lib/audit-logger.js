// lib/audit-logger.js
// Sistema de logging de auditoria para operações POST/PATCH/DELETE no MCP Veeam
// Registra todas as operações de escrita para compliance e troubleshooting

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caminho do arquivo de log de auditoria
const AUDIT_LOG_PATH = path.join(__dirname, '..', 'logs', 'audit.log');

/**
 * Registra operação de auditoria em arquivo de log
 *
 * IMPORTANTE: Este log é crítico para compliance MSP.
 * Não modificar formato sem documentar breaking change.
 *
 * @param {string} operation - Nome da operação (ex: "veeam_start_backup_job", "veeam_stop_backup_job")
 * @param {Object} details - Detalhes da operação
 * @param {string} details.jobId - ID do job afetado
 * @param {string} details.jobName - Nome do job afetado
 * @param {string} details.result - Resultado da operação ("success", "failed")
 * @param {string} details.user - Usuário que executou (opcional)
 * @param {string} details.error - Mensagem de erro (se falhou)
 * @param {Object} details.metadata - Metadados adicionais (opcional)
 * @returns {Promise<void>}
 */
export async function logOperation(operation, details) {
  const timestamp = new Date().toISOString();

  // Construir entrada de log estruturada (JSON)
  const logEntry = {
    timestamp,
    operation,
    jobId: details.jobId || null,
    jobName: details.jobName || null,
    result: details.result || "unknown",
    user: details.user || "mcp-user",
    error: details.error || null,
    metadata: details.metadata || {},
    // Informações de ambiente
    environment: {
      veeamHost: process.env.VEEAM_HOST || "unknown",
      mcpVersion: "1.0.0"
    }
  };

  // Converter para linha de log (JSON compacto por linha)
  const logLine = JSON.stringify(logEntry) + '\n';

  try {
    // Criar diretório de logs se não existir
    await fs.mkdir(path.dirname(AUDIT_LOG_PATH), { recursive: true });

    // Append no arquivo de log (não sobrescrever)
    await fs.appendFile(AUDIT_LOG_PATH, logLine, 'utf8');

    // Log no console para PM2
    console.log(`[AUDIT] ${operation}: ${details.result} - Job: ${details.jobName || details.jobId}`);

  } catch (error) {
    // CRÍTICO: Falha no audit log não deve bloquear operação
    // Mas deve ser registrada no console para PM2
    console.error('[AUDIT LOG ERROR] Falha ao gravar log de auditoria:', error.message);
    console.error('[AUDIT LOG ERROR] Entrada perdida:', logEntry);
  }
}

/**
 * Lê últimas N entradas do audit log
 *
 * @param {number} count - Número de entradas a retornar (default: 100)
 * @returns {Promise<Array>} Array de entradas de log parseadas
 */
export async function readAuditLog(count = 100) {
  try {
    const fileContent = await fs.readFile(AUDIT_LOG_PATH, 'utf8');
    const lines = fileContent.trim().split('\n');

    // Pegar últimas N linhas
    const recentLines = lines.slice(-count);

    // Parsear JSON de cada linha
    const entries = recentLines
      .map(line => {
        try {
          return JSON.parse(line);
        } catch (parseError) {
          console.error('[AUDIT] Linha inválida no log:', line);
          return null;
        }
      })
      .filter(entry => entry !== null);

    return entries;

  } catch (error) {
    if (error.code === 'ENOENT') {
      // Arquivo não existe ainda (primeiro uso)
      return [];
    }

    console.error('[AUDIT] Erro ao ler log de auditoria:', error.message);
    throw error;
  }
}

/**
 * Filtra entradas de audit log por critérios
 *
 * @param {Object} filters - Filtros a aplicar
 * @param {string} filters.operation - Filtrar por operação
 * @param {string} filters.jobId - Filtrar por job ID
 * @param {string} filters.result - Filtrar por resultado (success, failed)
 * @param {string} filters.startDate - Data inicial (ISO 8601)
 * @param {string} filters.endDate - Data final (ISO 8601)
 * @param {number} filters.limit - Limite de resultados (default: 100)
 * @returns {Promise<Array>} Array de entradas filtradas
 */
export async function searchAuditLog(filters = {}) {
  const allEntries = await readAuditLog(filters.limit || 1000);

  let results = allEntries;

  // Filtrar por operação
  if (filters.operation) {
    results = results.filter(entry => entry.operation === filters.operation);
  }

  // Filtrar por job ID
  if (filters.jobId) {
    results = results.filter(entry => entry.jobId === filters.jobId);
  }

  // Filtrar por resultado
  if (filters.result) {
    results = results.filter(entry => entry.result === filters.result);
  }

  // Filtrar por data inicial
  if (filters.startDate) {
    const startTime = new Date(filters.startDate);
    results = results.filter(entry => new Date(entry.timestamp) >= startTime);
  }

  // Filtrar por data final
  if (filters.endDate) {
    const endTime = new Date(filters.endDate);
    results = results.filter(entry => new Date(entry.timestamp) <= endTime);
  }

  // Aplicar limite final
  if (filters.limit) {
    results = results.slice(-filters.limit);
  }

  return results;
}

/**
 * Obtém estatísticas do audit log
 *
 * @returns {Promise<Object>} Estatísticas agregadas
 */
export async function getAuditStats() {
  const entries = await readAuditLog(1000);

  const stats = {
    totalOperations: entries.length,
    operationTypes: {},
    resultCounts: {
      success: 0,
      failed: 0,
      unknown: 0
    },
    lastOperation: entries.length > 0 ? entries[entries.length - 1] : null,
    timeRange: {
      first: entries.length > 0 ? entries[0].timestamp : null,
      last: entries.length > 0 ? entries[entries.length - 1].timestamp : null
    }
  };

  // Contar por tipo de operação
  entries.forEach(entry => {
    // Contar operação
    if (!stats.operationTypes[entry.operation]) {
      stats.operationTypes[entry.operation] = 0;
    }
    stats.operationTypes[entry.operation]++;

    // Contar resultado
    const result = entry.result || 'unknown';
    if (stats.resultCounts.hasOwnProperty(result)) {
      stats.resultCounts[result]++;
    } else {
      stats.resultCounts.unknown++;
    }
  });

  return stats;
}

/**
 * Rotaciona arquivo de audit log (manutenção)
 * Cria backup com timestamp e inicia novo arquivo
 *
 * @returns {Promise<string>} Caminho do arquivo de backup
 */
export async function rotateAuditLog() {
  try {
    // Verificar se arquivo existe
    await fs.access(AUDIT_LOG_PATH);

    // Criar nome do backup com timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = AUDIT_LOG_PATH.replace('.log', `.backup-${timestamp}.log`);

    // Copiar arquivo atual para backup
    await fs.copyFile(AUDIT_LOG_PATH, backupPath);

    // Limpar arquivo atual (iniciar novo)
    await fs.writeFile(AUDIT_LOG_PATH, '', 'utf8');

    console.log(`[AUDIT] Log rotacionado. Backup: ${backupPath}`);

    return backupPath;

  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('[AUDIT] Nenhum arquivo para rotacionar');
      return null;
    }

    console.error('[AUDIT] Erro ao rotacionar log:', error.message);
    throw error;
  }
}
