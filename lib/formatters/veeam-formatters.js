// lib/formatters/veeam-formatters.js
// Formatadores Markdown especificos para cada dominio Veeam
// SPEC-VEEAM-ENHANCE-001 / F01
//
// Cada funcao recebe dados da API Veeam (objetos JS) e retorna Markdown.
// Reutiliza helpers existentes de format-helpers.js via markdown-helpers.js.

import {
  esc,
  truncate,
  pageInfo,
  formatDateTime,
  formatBytes,
  formatDuration,
  formatJobState,
  formatSessionResult,
  formatJobType,
  formatRepositoryType
} from './markdown-helpers.js';

// ============================================================================
// HELPER: Resolve result codes e strings para texto legivel
// ============================================================================

// Mapa de strings que tools podem retornar (quando fazem result?.result || 'Unknown')
const STRING_RESULT_MAP = {
  'Success': 'Sucesso',
  'Warning': 'Aviso',
  'Failed': 'Falhou',
  'None': 'N/A',
  'Unknown': 'N/A',
  'Running': 'Em Execucao',
  'No message': ''
};

/**
 * Resolve um valor de result para texto legivel.
 * Suporta: numeros (API raw), strings (tool formatada), undefined/null.
 */
function resolveResult(val) {
  if (val === undefined || val === null || val === 'Unknown') return 'N/A';
  // Se e numero, usar formatSessionResult do dicionario
  if (typeof val === 'number') return formatSessionResult(val);
  // Se e string conhecida, mapear
  if (STRING_RESULT_MAP[val]) return STRING_RESULT_MAP[val];
  // Fallback: retornar como esta
  return esc(String(val));
}

// ============================================================================
// BACKUP JOBS
// ============================================================================

/**
 * Formata lista de backup jobs como tabela Markdown.
 * @param {object} data - Resposta da API Veeam (data.data = array de jobs, data.pagination)
 * @param {object} args - Argumentos da tool (limit, skip)
 * @returns {string} Tabela Markdown
 */
export function formatBackupJobsList(data, args) {
  // Suporta: { data: [...] } (API raw) OU { jobs: [...] } (tool formatada) OU [...]
  const jobs = data?.data || data?.jobs || (Array.isArray(data) ? data : []);
  if (!jobs.length) return 'Nenhum backup job encontrado.';

  const pagination = data?.pagination;
  const header = pageInfo(
    jobs.length,
    args?.limit || 25,
    args?.skip || 0,
    pagination?.total
  );

  const rows = jobs.map(j => {
    const resultVal = typeof j.result === 'object' ? j.result?.result : j.result;
    const resultStr = resolveResult(resultVal);
    return `| ${esc(j.id)} | ${esc(j.name)} | ${esc(j.type)} | ${formatJobState(j.state)} | ${resultStr} | ${formatDateTime(j.lastRun)} |`;
  }).join('\n');

  return [
    header,
    '',
    '| ID | Nome | Tipo | Estado | Resultado | Ultima Execucao |',
    '|---|---|---|---|---|---|',
    rows
  ].join('\n');
}

/**
 * Formata detalhe de um backup job como tabela Campo/Valor.
 * @param {object} job - Objeto job da API Veeam
 * @returns {string} Markdown com heading + tabela
 */
export function formatBackupJobDetail(input) {
  // @MX:NOTE: Tool may return either the flat job object or { job: {...}, sessions: {...} }.
  // Accept both so upstream changes to the response shape do not silently break rendering.
  const job = input?.job ?? input;
  if (!job || !job.id) return 'Job nao encontrado.';

  const lines = [
    `# Backup Job: ${esc(job.name)}`,
    '',
    '| Campo | Valor |',
    '|---|---|',
    `| ID | ${esc(job.id)} |`,
    `| Nome | ${esc(job.name)} |`,
    `| Tipo | ${formatJobType(job.type)} |`,
    `| Estado | ${formatJobState(job.state)} |`,
    `| Plataforma | ${esc(job.platformName)} |`,
    `| Schedule | ${job.scheduleEnabled ? 'Ativo' : 'Desabilitado'} (${esc(job.scheduleType)}) |`,
    `| Ultima Execucao | ${formatDateTime(job.lastRun)} |`,
    `| Proxima Execucao | ${formatDateTime(job.nextRun)} |`,
    `| Resultado | ${resolveResult(typeof job.result === 'object' ? job.result?.result : job.result)} |`,
    `| Mensagem | ${truncate((typeof job.result === 'object' ? job.result?.message : job.message) || '', 300)} |`,
    `| Retentativa | ${job.retryCount || 0}x (espera: ${job.retryWait || 0}min) |`,
  ];

  if (job.description) {
    lines.push('', '## Descricao', '', truncate(job.description, 500));
  }

  // @MX:NOTE: Render recent sessions when the tool fetched them (includeSessions=true).
  // Before this, sessions were fetched from the API and silently discarded by the
  // formatter, making the parameter a dead I/O burn. Now it actually helps audit.
  const sessionsPayload = input?.sessions;
  const sList = sessionsPayload?.sessions;
  if (Array.isArray(sList) && sList.length > 0) {
    const shown = sList.slice(0, 25); // Cap render at 25 rows — avoids huge tables on sessionLimit=100.
    lines.push('', `## Sessões Recentes (${shown.length}${sList.length > shown.length ? ' de ' + sList.length : ''})`, '');
    lines.push('| Início | Fim | Duração | Tipo | Resultado | Progresso |');
    lines.push('|---|---|---|---|---|---|');
    shown.forEach(s => {
      const resultVal = typeof s.result === 'object' ? s.result?.result : s.result;
      lines.push(`| ${formatDateTime(s.creationTime)} | ${formatDateTime(s.endTime)} | ${formatDuration(s.creationTime, s.endTime)} | ${esc(s.sessionType)} | ${resolveResult(resultVal)} | ${s.progressPercent != null ? s.progressPercent + '%' : 'N/A'} |`);
    });
    if (sList.length > shown.length) {
      lines.push('', `_Exibindo as ${shown.length} mais recentes. Use search_backup_sessions(jobIdFilter, limit) para ver mais._`);
    }
  }

  return lines.join('\n');
}

// ============================================================================
// BACKUP SESSIONS
// ============================================================================

/**
 * Formata lista de sessions como tabela Markdown.
 * @param {object} data - Resposta da API Veeam
 * @param {object} args - Argumentos (limit, skip)
 * @returns {string} Tabela Markdown
 */
export function formatSessionsList(data, args) {
  // Suporta: { data: [...] } (API raw) OU { sessions: [...] } (tool formatada) OU [...]
  const sessions = data?.data || data?.sessions || (Array.isArray(data) ? data : []);
  if (!sessions.length) return 'Nenhuma session encontrada.';

  const pagination = data?.pagination;
  const header = pageInfo(
    sessions.length,
    args?.limit || 25,
    args?.skip || 0,
    pagination?.total
  );

  const rows = sessions.map(s => {
    const duration = formatDuration(s.creationTime, s.endTime);
    // result pode ser: numero (API raw), string "Success"/"Failed" (tool formatada), ou objeto { result: N }
    const resultVal = typeof s.result === 'object' ? s.result?.result : s.result;
    const resultStr = resolveResult(resultVal);
    return `| ${esc(s.id)} | ${esc(s.name)} | ${esc(s.sessionType)} | ${resultStr} | ${formatDateTime(s.creationTime)} | ${duration} | ${s.progressPercent != null ? s.progressPercent + '%' : 'N/A'} |`;
  }).join('\n');

  return [
    header,
    '',
    '| ID | Nome | Tipo | Resultado | Inicio | Duracao | Progresso |',
    '|---|---|---|---|---|---|---|',
    rows
  ].join('\n');
}

// ============================================================================
// SESSION LOG
// ============================================================================

/**
 * Formata log de session como tabela Markdown.
 * Limita a 50 entradas para controle de tokens.
 * @param {object} data - Resposta da API Veeam (array de log entries)
 * @returns {string} Tabela Markdown
 */
export function formatSessionLog(data) {
  const entries = data?.data || (Array.isArray(data) ? data : []);
  if (!entries.length) return 'Nenhum log encontrado para esta session.';

  const maxEntries = 50;
  const displayed = entries.slice(0, maxEntries);

  const header = entries.length > maxEntries
    ? `**Mostrando ${maxEntries} de ${entries.length} entradas de log** (use logLevel para filtrar)`
    : `**${entries.length} entradas de log**`;

  const rows = displayed.map(e =>
    `| ${formatDateTime(e.creationTime)} | ${esc(e.status || 'Info')} | ${truncate(e.title, 200)} |`
  ).join('\n');

  return [
    header,
    '',
    '| Data | Nivel | Mensagem |',
    '|---|---|---|',
    rows
  ].join('\n');
}

// ============================================================================
// RESTORE POINTS
// ============================================================================

/**
 * Formata lista de restore points como tabela Markdown.
 */
export function formatRestorePointsList(data, args) {
  // @MX:NOTE: Tool wraps points under "restorePoints" (enriched shape with summary+analysis);
  // raw API payload uses "data". Accept both so the enriched response renders correctly.
  const points = data?.restorePoints || data?.data || (Array.isArray(data) ? data : []);
  if (!points.length) return 'Nenhum restore point encontrado.';

  const pagination = data?.pagination;
  const header = pageInfo(
    points.length,
    args?.limit || 25,
    args?.skip || 0,
    pagination?.total
  );

  const rows = points.map(p =>
    `| ${esc(p.id)} | ${esc(p.name)} | ${formatDateTime(p.creationTime)} | ${esc(p.type)} | ${formatBytes(p.backupSize)} |`
  ).join('\n');

  return [
    header,
    '',
    '| ID | VM | Data | Tipo | Tamanho |',
    '|---|---|---|---|---|',
    rows
  ].join('\n');
}

// ============================================================================
// INFRASTRUCTURE (Proxies + Repositories)
// ============================================================================

/**
 * Formata lista de proxies como tabela Markdown.
 */
export function formatProxiesList(data) {
  // Suporta: { data: [...] } (API raw) OU { proxies: [...] } (tool formatada) OU [...]
  const proxies = data?.data || data?.proxies || (Array.isArray(data) ? data : []);
  if (!proxies.length) return 'Nenhum proxy encontrado.';

  // @MX:NOTE: tools enrich each proxy with hostName (from /proxies/states).
  // Fall back to server.hostName for legacy payload shapes.
  const rows = proxies.map(p => {
    const host = p.hostName ?? p.server?.hostName ?? p.server?.name ?? '';
    const online = p.isOnline === false ? ' ⚠️ offline' : '';
    return `| ${esc(p.id)} | ${esc(p.name)} | ${esc(p.type)} | ${esc(host)}${online} | ${p.maxTaskCount || 'N/A'} |`;
  }).join('\n');

  return [
    `**${proxies.length} proxies**`,
    '',
    '| ID | Nome | Tipo | Host | Tarefas Max |',
    '|---|---|---|---|---|',
    rows
  ].join('\n');
}

/**
 * Formata lista de repositorios como tabela Markdown.
 */
export function formatRepositoriesList(data) {
  // Suporta: { data: [...] } (API raw) OU categorizado { warnings, healthy, cloud, ... } (tool) OU [...]
  let repos = data?.data || (Array.isArray(data) ? data : []);
  // Tool do Veeam categoriza por status — juntar todas as categorias
  if (!repos.length && !Array.isArray(data)) {
    repos = [
      ...(data?.warnings || []),
      ...(data?.healthy || []),
      ...(data?.cloud || []),
      ...(data?.offline || []),
      ...(data?.unknown || [])
    ];
  }
  if (!repos.length) return 'Nenhum repositorio encontrado.';

  const rows = repos.map(r => {
    const capacity = r.capacityGB ? formatBytes(r.capacityGB * 1073741824) : 'N/A';
    const free = r.freeGB ? formatBytes(r.freeGB * 1073741824) : 'N/A';
    const usedPct = (r.capacityGB && r.freeGB)
      ? Math.round(((r.capacityGB - r.freeGB) / r.capacityGB) * 100) + '%'
      : 'N/A';
    return `| ${esc(r.id)} | ${esc(r.name)} | ${esc(r.type)} | ${capacity} | ${free} | ${usedPct} |`;
  }).join('\n');

  return [
    `**${repos.length} repositorios**`,
    '',
    '| ID | Nome | Tipo | Capacidade | Livre | Uso |',
    '|---|---|---|---|---|---|',
    rows
  ].join('\n');
}

// ============================================================================
// LICENSE
// ============================================================================

/**
 * Formata informacoes de licenca como Markdown.
 */
export function formatLicenseInfo(data) {
  if (!data) return 'Informacoes de licenca nao disponiveis.';

  const lines = [
    '# Licenca Veeam Backup & Replication',
    '',
    '| Campo | Valor |',
    '|---|---|',
    `| Status | ${esc(data.status)} |`,
    `| Tipo | ${esc(data.edition)} |`,
    `| Expiracao | ${formatDateTime(data.expirationDate)} |`,
    `| Instancias Licenciadas | ${data.licensedInstancesCount ?? 'N/A'} |`,
    `| Instancias Usadas | ${data.usedInstancesCount ?? 'N/A'} |`,
  ];

  // Adicionar workloads se disponivel
  if (data.workloads) {
    lines.push('', '## Workloads Protegidos', '');
    if (Array.isArray(data.workloads)) {
      lines.push('| Tipo | Usados | Licenciados |', '|---|---|---|');
      data.workloads.forEach(w => {
        lines.push(`| ${esc(w.type)} | ${w.usedCount ?? 0} | ${w.licensedCount ?? 'N/A'} |`);
      });
    }
  }

  return lines.join('\n');
}

// ============================================================================
// SERVER INFO
// ============================================================================

/**
 * Formata informacoes do servidor como Markdown.
 */
export function formatServerInfo(data) {
  if (!data) return 'Informacoes do servidor nao disponiveis.';

  // @MX:NOTE: /api/v1/serverInfo field names vary across VBR versions. The base
  // v1.2-rev0 response includes "name", "buildVersion" and "databaseVendor";
  // "buildNumber" / "schemaVersion" are sometimes absent. We probe multiple
  // candidate fields and only emit a row when the resolved value is non-empty,
  // so the table stays clean instead of showing blank cells.
  const lines = [
    '# Servidor Veeam Backup & Replication',
    '',
    '| Campo | Valor |',
    '|---|---|',
    `| Nome | ${esc(data.name)} |`,
    `| Versao VBR | ${esc(data.buildVersion ?? data.version ?? data.build)} |`
  ];
  const buildNumber = data.buildNumber ?? data.build ?? data.buildNo;
  if (buildNumber) lines.push(`| Build | ${esc(buildNumber)} |`);
  const dbVendor = data.databaseVendor ?? data.databaseEngine;
  const dbType = data.databaseType ?? data.databaseEdition ?? data.databaseProductName;
  if (dbVendor || dbType) {
    lines.push(`| Banco de Dados | ${esc([dbVendor, dbType].filter(Boolean).join(' '))} |`);
  }
  const schemaVersion = data.schemaVersion ?? data.databaseSchemaVersion;
  if (schemaVersion) lines.push(`| Schema | ${esc(schemaVersion)} |`);
  if (Array.isArray(data.patches) && data.patches.length) {
    lines.push(`| Patches | ${data.patches.length} instalado(s) |`);
  }
  if (data.installationId || data.id) {
    lines.push(`| Installation ID | ${esc(data.installationId ?? data.id)} |`);
  }
  return lines.join('\n');
}

// ============================================================================
// JOB SCHEDULE
// ============================================================================

/**
 * Formata schedule de um backup job como Markdown.
 */
export function formatJobSchedule(data) {
  if (!data) return 'Schedule nao encontrado.';

  const lines = [
    '# Schedule do Backup Job',
    '',
    '| Campo | Valor |',
    '|---|---|',
    `| Tipo | ${data.runAutomatically ? 'Automatico' : 'Manual'} |`,
    `| Daily | ${data.daily?.isEnabled ? 'Sim' : 'Nao'} |`,
    `| Horario | ${esc(data.daily?.localTime || 'N/A')} |`,
    `| Retry | ${data.retry?.isEnabled ? `Sim (${data.retry?.retryCount}x)` : 'Nao'} |`,
  ];

  if (data.monthly?.isEnabled) {
    lines.push(`| Monthly | Sim |`);
  }

  return lines.join('\n');
}

// ============================================================================
// OPERACOES (start/stop)
// ============================================================================

/**
 * Formata resultado de operacao start/stop.
 */
export function formatOperationResult(data, action) {
  if (!data) return `Operacao "${action}" realizada com sucesso.`;

  const lines = [
    `## Resultado: ${esc(action)}`,
    '',
  ];

  if (data.id) lines.push(`- **Session ID:** ${esc(data.id)}`);
  if (data.message) lines.push(`- **Mensagem:** ${truncate(data.message, 300)}`);
  if (data.state) lines.push(`- **Estado:** ${formatJobState(data.state)}`);

  return lines.join('\n');
}
