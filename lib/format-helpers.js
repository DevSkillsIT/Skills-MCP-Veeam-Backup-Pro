// lib/format-helpers.js
// Helpers de formatação para enriquecer respostas das tools do MCP Veeam
// Converte códigos numéricos em descrições legíveis e formata dados

import {
  JOB_STATES,
  SESSION_RESULTS,
  SESSION_STATES,
  JOB_TYPES,
  SESSION_TYPES,
  BACKUP_JOB_SESSION_TYPES,
  SYSTEM_TASK_SESSION_TYPES,
  SCHEDULE_TYPES,
  REPOSITORY_TYPES,
  PLATFORM_NAMES,
  LOG_LEVELS
} from './veeam-dictionaries.js';

/**
 * Formata o estado de um Job
 * @param {number|string} stateCode - Código do estado (0-9)
 * @returns {string} Estado formatado com descrição
 */
// @MX:NOTE: VBR REST API /api/v1/jobs/states returns textual status like
// "disabled", "inactive", "running", "stopped". The legacy JOB_STATES dictionary
// is keyed by numeric codes (0-9) from older VBR plumbing. Map the textual
// values here so the Markdown shows readable labels instead of "Unknown State (disabled)".
const STRING_STATUS_MAP = {
  disabled: 'Desabilitado',
  inactive: 'Inativo (aguardando schedule)',
  running: 'Em Execucao',
  stopped: 'Parado',
  idle: 'Ocioso',
  paused: 'Pausado',
  working: 'Trabalhando',
  starting: 'Iniciando',
  stopping: 'Parando',
  postprocessing: 'Pos-processamento',
  waitingtape: 'Aguardando Tape',
  waitingrepository: 'Aguardando Repositorio'
};

export function formatJobState(stateCode) {
  // Guard: null/undefined/empty-string means job never ran — return human placeholder
  if (stateCode === null || stateCode === undefined || stateCode === '') {
    return '—';
  }
  // String statuses from /api/v1/jobs/states (disabled, inactive, running, ...)
  if (typeof stateCode === 'string') {
    const mapped = STRING_STATUS_MAP[stateCode.toLowerCase()];
    if (mapped) return mapped;
  }
  const state = JOB_STATES[stateCode];
  if (!state) {
    return `Unknown State (${stateCode})`;
  }
  return `${state.code} - ${state.description}`;
}

/**
 * Formata o resultado de uma Session
 * @param {number|string} resultCode - Código do resultado (0-3)
 * @returns {string} Resultado formatado com ícone
 */
export function formatSessionResult(resultCode) {
  // Guard: null/undefined/empty-string means session has no result yet — return N/A
  if (resultCode === null || resultCode === undefined || resultCode === '') {
    return 'N/A';
  }
  const result = SESSION_RESULTS[resultCode];
  if (!result) {
    return `Unknown Result (${resultCode})`;
  }
  return `${result.icon} ${result.code} - ${result.description}`;
}

/**
 * Formata o estado de uma Session
 * @param {number|string} stateCode - Código do estado (0-9)
 * @returns {string} Estado formatado com descrição
 */
export function formatSessionState(stateCode) {
  // Guard: null/undefined/empty-string means session never started — return human placeholder
  if (stateCode === null || stateCode === undefined || stateCode === '') {
    return '—';
  }
  const state = SESSION_STATES[stateCode];
  if (!state) {
    return `Unknown State (${stateCode})`;
  }
  return `${state.code} - ${state.description}`;
}

/**
 * Formata tipo de Job com ícone e descrição
 * @param {string} jobType - Tipo do job
 * @returns {string} Tipo formatado
 */
export function formatJobType(jobType) {
  const type = JOB_TYPES[jobType];
  if (!type) {
    return jobType;
  }
  return `${type.icon} ${jobType} - ${type.description}`;
}

/**
 * Calcula duração entre duas datas ISO
 * @param {string} startTime - Data/hora de início (ISO 8601)
 * @param {string} endTime - Data/hora de fim (ISO 8601)
 * @returns {string} Duração formatada
 */
export function formatDuration(startTime, endTime) {
  if (!startTime) {
    return "N/A";
  }

  if (!endTime) {
    return "Em andamento";
  }

  try {
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end - start;

    if (diffMs < 0) {
      return "Dados inválidos";
    }

    // Converter para minutos, horas, dias
    const minutes = Math.floor(diffMs / 60000);

    if (minutes < 1) {
      const seconds = Math.floor(diffMs / 1000);
      return `${seconds} segundo${seconds !== 1 ? 's' : ''}`;
    }

    if (minutes < 60) {
      return `${minutes} minuto${minutes !== 1 ? 's' : ''}`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours < 24) {
      return `${hours}h ${remainingMinutes}m`;
    }

    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;

  } catch (error) {
    return "Erro ao calcular duração";
  }
}

/**
 * Formata bytes em unidades legíveis (KB, MB, GB, TB)
 * @param {number} bytes - Tamanho em bytes
 * @param {number} decimals - Casas decimais (default: 2)
 * @returns {string} Tamanho formatado
 */
export function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) {
    return "0 B";
  }

  if (bytes < 0) {
    return "Tamanho inválido";
  }

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Formata data ISO 8601 em formato brasileiro
 * @param {string} isoDate - Data em formato ISO 8601
 * @returns {string} Data formatada (DD/MM/YYYY HH:MM:SS)
 */
export function formatDateTime(isoDate) {
  if (!isoDate) {
    return "N/A";
  }

  try {
    const date = new Date(isoDate);

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  } catch (error) {
    return isoDate;
  }
}

/**
 * Formata percentual de progresso
 * @param {number} percent - Percentual (0-100)
 * @returns {string} Percentual formatado com barra de progresso
 */
export function formatProgress(percent) {
  if (percent === null || percent === undefined) {
    return "N/A";
  }

  const value = Math.max(0, Math.min(100, percent));
  const filled = Math.floor(value / 10);
  const empty = 10 - filled;

  const bar = '█'.repeat(filled) + '░'.repeat(empty);

  return `${bar} ${value.toFixed(0)}%`;
}

/**
 * Enriquece dados de uma Session com formatação
 * @param {Object} session - Objeto session da API
 * @returns {Object} Session enriquecida com campos formatados
 */
export function enrichSessionData(session) {
  if (!session) {
    return null;
  }

  return {
    ...session,
    // Campos originais mantidos
    // Campos enriquecidos adicionados
    stateFormatted: formatSessionState(session.state),
    resultFormatted: formatSessionResult(session.result?.result),
    durationFormatted: formatDuration(session.creationTime, session.endTime),
    creationTimeFormatted: formatDateTime(session.creationTime),
    endTimeFormatted: formatDateTime(session.endTime),
    progressFormatted: formatProgress(session.progressPercent),
    // Metadados adicionais
    enriched: true,
    enrichedAt: new Date().toISOString()
  };
}

/**
 * Enriquece dados de um Job com formatação
 * @param {Object} job - Objeto job da API
 * @returns {Object} Job enriquecido com campos formatados
 */
export function enrichJobData(job) {
  if (!job) {
    return null;
  }

  return {
    ...job,
    // Campos enriquecidos
    stateFormatted: formatJobState(job.state),
    typeFormatted: formatJobType(job.type),
    scheduleTypeFormatted: SCHEDULE_TYPES[job.scheduleType]?.description || job.scheduleType,
    lastRunFormatted: formatDateTime(job.lastRun),
    nextRunFormatted: formatDateTime(job.nextRun),
    resultFormatted: formatSessionResult(job.result?.result),
    // Metadados
    enriched: true,
    enrichedAt: new Date().toISOString()
  };
}

/**
 * Calcula estatísticas de um array de sessions
 * @param {Array} sessions - Array de sessions
 * @returns {Object} Estatísticas agregadas
 */
export function calculateSessionStats(sessions) {
  if (!sessions || sessions.length === 0) {
    return {
      total: 0,
      running: 0,
      succeeded: 0,
      failed: 0,
      warning: 0,
      averageProgress: 0
    };
  }

  const stats = {
    total: sessions.length,
    running: 0,
    succeeded: 0,
    failed: 0,
    warning: 0,
    totalProgress: 0
  };

  sessions.forEach(session => {
    // Contar por estado
    if (session.state === 3) stats.running++;

    // Contar por resultado
    const result = session.result?.result;
    if (result === 1) stats.succeeded++;
    else if (result === 3) stats.failed++;
    else if (result === 2) stats.warning++;

    // Somar progresso
    if (session.progressPercent) {
      stats.totalProgress += session.progressPercent;
    }
  });

  stats.averageProgress = stats.total > 0
    ? (stats.totalProgress / stats.total).toFixed(2)
    : 0;

  return stats;
}

/**
 * Formata tipo de repositório
 * @param {string} repoType - Tipo do repositório
 * @returns {string} Tipo formatado com ícone
 */
export function formatRepositoryType(repoType) {
  const type = REPOSITORY_TYPES[repoType];
  if (!type) {
    return repoType;
  }
  return `${type.icon} ${repoType} - ${type.description}`;
}

/**
 * Formata platform name
 * @param {string} platformName - Nome da plataforma
 * @returns {string} Platform formatada com ícone
 */
export function formatPlatformName(platformName) {
  const platform = PLATFORM_NAMES[platformName];
  if (!platform) {
    return platformName;
  }
  return `${platform.icon} ${platformName} - ${platform.description}`;
}

/**
 * Formata mensagem de log com severidade
 * @param {string} message - Mensagem do log
 * @param {string} level - Nível do log (Info, Warning, Error)
 * @returns {string} Mensagem formatada
 */
export function formatLogMessage(message, level = "Info") {
  const logLevel = LOG_LEVELS[level];
  const prefix = logLevel
    ? `[${level.toUpperCase()}]`
    : `[${level}]`;

  return `${prefix} ${message}`;
}

/**
 * Derive the effective log level of a session log entry from its message.
 * @MX:NOTE: V2 — VBR frequently records error/warning TEXT at level "Info" (the RPC
 * failure "Error: The remote procedure call failed..." comes through as Info). That made
 * logLevel=Error/Warning return "Nenhum log encontrado" on genuinely failed sessions, and
 * undercounted analysis.errorCount. When the message itself is prefixed with Error:/Warning:
 * (or clearly states a failure) we upgrade the level so the filter and analysis are correct.
 * The API level still wins when it is already as severe or more (Error/Warning are kept).
 * @param {{level?:string, message?:string, text?:string}} entry
 * @returns {string} normalized level: Error | Warning | Info | Debug
 */
export function deriveLogLevel(entry) {
  const apiLevel = entry?.level;
  if (apiLevel === "Error" || apiLevel === "Warning") return apiLevel;
  const msg = String(entry?.message ?? entry?.text ?? "");
  if (/^\s*error\b|\berror:|\bfailed\b|did not execute|rpc function call failed/i.test(msg)) return "Error";
  if (/^\s*warning\b|\bwarning:/i.test(msg)) return "Warning";
  return apiLevel || "Info";
}

/**
 * Derive a human schedule type label from a VBR job schedule object.
 * @MX:NOTE: V3 — get_details read non-existent jobData.schedule.type (always null → "Ativo ()"
 * empty parens). The real shape is schedule.{daily,monthly,periodically,continuously,
 * afterThisJob}.isEnabled gated by schedule.runAutomatically (same fields get_schedule parses).
 * @param {object} schedule - jobData.schedule
 * @returns {string|null} 'Diario'|'Mensal'|'Periodico'|'Continuo'|'Apos outro job'|'Automatico'|null
 */
export function deriveScheduleType(schedule) {
  const sch = schedule || {};
  if (!sch.runAutomatically) return null;
  if (sch.daily?.isEnabled) return "Diario";
  if (sch.monthly?.isEnabled) return "Mensal";
  if (sch.periodically?.isEnabled) return "Periodico";
  if (sch.continuously?.isEnabled) return "Continuo";
  if (sch.afterThisJob?.isEnabled) return "Apos outro job";
  return "Automatico";
}

/**
 * Categoriza tipo de session (backup job vs system task)
 *
 * IMPORTANTE: Esta função diferencia claramente entre:
 * - Backup Jobs: Trabalhos de backup/replicação reais (BackupJob, ReplicaJob, etc)
 * - System Tasks: Tarefas de manutenção/segurança (MalwareDetection, SureBackup, etc)
 *
 * SINÔNIMOS:
 * - Backup Job = backup real, job de backup, trabalho de backup
 * - System Task = tarefa de sistema, manutenção, task administrativa
 *
 * @param {string} sessionType - Tipo da session (BackupJob, MalwareDetection, etc)
 * @returns {Object} Objeto com categorização detalhada
 */
export function categorizeSessionType(sessionType) {
  // Verificar se é tipo conhecido
  const sessionInfo = SESSION_TYPES[sessionType];

  if (!sessionInfo) {
    // Tipo desconhecido - retornar categorização padrão
    return {
      sessionType: sessionType,
      category: "unknown",
      categoryFormatted: "Tipo Desconhecido",
      isBackupJob: false,
      isSystemTask: false,
      description: sessionType,
      icon: "❓",
      humanReadable: `${sessionType} (tipo desconhecido)`
    };
  }

  // Retornar categorização completa
  return {
    sessionType: sessionType,
    category: sessionInfo.category,
    categoryFormatted: formatCategory(sessionInfo.category),
    isBackupJob: sessionInfo.isBackupJob,
    isSystemTask: sessionInfo.isSystemTask,
    description: sessionInfo.description,
    longDescription: sessionInfo.longDescription,
    icon: sessionInfo.icon,
    synonyms: sessionInfo.synonyms,
    humanReadable: `${sessionInfo.icon} ${sessionType} - ${sessionInfo.description}`
  };
}

/**
 * Formata categoria de session para display
 * @private
 * @param {string} category - Categoria (backup_job, system_task, etc)
 * @returns {string} Categoria formatada em português
 */
function formatCategory(category) {
  const categories = {
    'backup_job': 'Backup Job (Backup Real)',
    'system_task': 'System Task (Tarefa de Sistema)',
    'testing': 'Testing (Teste/Validação)',
    'restore': 'Restore (Recuperação)',
    'unknown': 'Tipo Desconhecido'
  };

  return categories[category] || category;
}

/**
 * Verifica se uma session é um backup job (backup real)
 *
 * USO RÁPIDO: Use esta função quando precisar apenas saber se é backup ou não
 *
 * @param {string} sessionType - Tipo da session
 * @returns {boolean} true se for backup job, false se for system task
 */
export function isBackupJob(sessionType) {
  return BACKUP_JOB_SESSION_TYPES.includes(sessionType);
}

/**
 * Verifica se uma session é uma system task (não é backup)
 *
 * USO RÁPIDO: Use esta função quando precisar apenas saber se é system task
 *
 * @param {string} sessionType - Tipo da session
 * @returns {boolean} true se for system task, false se for backup job
 */
export function isSystemTask(sessionType) {
  return SYSTEM_TASK_SESSION_TYPES.includes(sessionType);
}

/**
 * Formata tipo de session com categorização visual
 *
 * EXEMPLOS DE OUTPUT:
 * - "💾 BackupJob (Backup Real)"
 * - "🛡️ MalwareDetection (System Task)"
 * - "🧪 SureBackup (System Task)"
 *
 * @param {string} sessionType - Tipo da session
 * @returns {string} Tipo formatado com ícone e categoria
 */
export function formatSessionType(sessionType) {
  const categorization = categorizeSessionType(sessionType);
  const categoryLabel = categorization.isBackupJob ? "Backup Real" : "System Task";
  return `${categorization.icon} ${sessionType} (${categoryLabel})`;
}
