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
    return `| ${esc(j.id?.substring(0, 8))}... | ${esc(j.name)} | ${esc(j.type)} | ${formatJobState(j.state)} | ${resultStr} | ${formatDateTime(j.lastRun)} |`;
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
export function formatBackupJobDetail(job) {
  if (!job) return 'Job nao encontrado.';

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
    `| Resultado | ${formatSessionResult(job.result?.result)} |`,
    `| Mensagem | ${truncate(job.result?.message, 300)} |`,
    `| Retentativa | ${job.retryCount || 0}x (espera: ${job.retryWait || 0}min) |`,
  ];

  if (job.description) {
    lines.push('', '## Descricao', '', truncate(job.description, 500));
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
    return `| ${esc(s.id?.substring(0, 8))}... | ${esc(s.name)} | ${esc(s.sessionType)} | ${resultStr} | ${formatDateTime(s.creationTime)} | ${duration} | ${s.progressPercent != null ? s.progressPercent + '%' : 'N/A'} |`;
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
  const points = data?.data || (Array.isArray(data) ? data : []);
  if (!points.length) return 'Nenhum restore point encontrado.';

  const pagination = data?.pagination;
  const header = pageInfo(
    points.length,
    args?.limit || 25,
    args?.skip || 0,
    pagination?.total
  );

  const rows = points.map(p =>
    `| ${esc(p.id?.substring(0, 8))}... | ${esc(p.name)} | ${formatDateTime(p.creationTime)} | ${esc(p.type)} | ${formatBytes(p.backupSize)} |`
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

  const rows = proxies.map(p =>
    `| ${esc(p.id?.substring(0, 8))}... | ${esc(p.name)} | ${esc(p.type)} | ${esc(p.server?.name)} | ${p.maxTaskCount || 'N/A'} |`
  ).join('\n');

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
    return `| ${esc(r.id?.substring(0, 8))}... | ${esc(r.name)} | ${esc(r.type)} | ${capacity} | ${free} | ${usedPct} |`;
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

  return [
    '# Servidor Veeam Backup & Replication',
    '',
    '| Campo | Valor |',
    '|---|---|',
    `| Nome | ${esc(data.name)} |`,
    `| Versao VBR | ${esc(data.buildVersion)} |`,
    `| Build | ${esc(data.buildNumber)} |`,
    `| Banco de Dados | ${esc(data.databaseVendor)} ${esc(data.databaseType)} |`,
    `| Schema | ${esc(data.schemaVersion)} |`,
  ].join('\n');
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
