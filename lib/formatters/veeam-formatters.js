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

  // Transparent VM-name match: the search term matched a VM inside these job(s).
  if (data?.matchedByVm) {
    const note = `**${jobs.length} job(s) contendo VM que casa "${esc(data.searchTerm)}"**\n` +
      `_Busca resolvida por NOME DE VM (a VM esta dentro do job). Use o nome do job para ver detalhes._`;
    const rows = jobs.map(j =>
      `| ${esc(j.vmName)} | ${esc(j.jobName)} | ${j.restorePointsCount ?? 'N/A'} |`
    ).join('\n');
    return [
      note, '',
      '| VM (match) | Job | Restore Points |',
      '|---|---|---|',
      rows
    ].join('\n');
  }

  // Hybrid coverage: jobs derived from session history (not in the /jobs inventory).
  if (data?.derivedFromSessions) {
    const note = `**${jobs.length} job(s) detectado(s) via HISTORICO DE SESSOES** para "${esc(data.searchTerm)}"\n` +
      `_Estes jobs NAO estao no inventario /jobs (provavelmente Agent/Replica/Copy ou site remoto). Dados = ultimos 7 dias de execucao._`;
    const rows = jobs.map(j =>
      `| ${esc(j.name)} | ${esc(j.type)} | ${resolveResult(j.result)} | ${j.attemptsLast7d ?? '?'} | ${j.failuresLast7d ?? '?'} | ${formatDateTime(j.lastRun)} |`
    ).join('\n');
    return [
      note, '',
      '| Nome | Tipo | Ultimo Resultado | Tentativas (7d) | Falhas (7d) | Ultima Execucao |',
      '|---|---|---|---|---|---|',
      rows
    ].join('\n');
  }

  // RC4: jobs found via STORED BACKUPS (/api/v1/backups) — Veeam Agent (physical) and Backup
  // Copy jobs, invisible to /jobs inventory and to name-matched sessions.
  if (data?.matchedFromBackups) {
    const note = `**${jobs.length} job(s) detectado(s) via BACKUPS ARMAZENADOS** para "${esc(data.searchTerm)}"\n` +
      `_NAO estao no inventario /jobs nem nas sessoes recentes — tipicamente Veeam Agent (servidor fisico) ou Backup Copy/offsite. Dados do chain de backup armazenado (use o console do VBR para status de execucao do Agent)._`;
    const rows = jobs.map(j =>
      `| ${esc(j.name)} | ${esc(j.kind)} | ${esc(j.repositoryName || (j.repositoryId ? '(externo/cloud)' : 'N/A'))} | ${formatDateTime(j.creationTime)} |`
    ).join('\n');
    return [
      note, '',
      '| Backup / Job | Tipo | Repositorio | Chain criado |',
      '|---|---|---|---|',
      rows
    ].join('\n');
  }

  const pagination = data?.pagination;
  const header = pageInfo(
    jobs.length,
    args?.limit ?? pagination?.limit ?? 35,
    args?.skip || 0,
    pagination?.total
  );

  const rows = jobs.map(j => {
    const resultVal = typeof j.result === 'object' ? j.result?.result : j.result;
    const resultStr = resolveResult(resultVal);
    const vms = j.objectsCount != null ? j.objectsCount : 'N/A';
    return `| ${esc(j.name)} | ${esc(j.type)} | ${formatJobState(j.state)} | ${resultStr} | ${vms} | ${formatDateTime(j.lastRun)} |`;
  }).join('\n');

  // @MX:NOTE: N1 — this list shows ONLY the /jobs inventory. Agent/Copy/replica/remote-site
  // jobs (which may be FAILING, e.g. the AC-* sites) are derived from session history and do
  // NOT appear here. Without this hint an LLM could answer "no jobs failing" from a partial
  // inventory view. Steer it to groupByJob, which aggregates ALL jobs from session history.
  const derivedHint =
    '_Mostra apenas os jobs do inventario /jobs. Jobs Agent/Copy/replica ou de site remoto ' +
    '(que podem estar FALHANDO) NAO aparecem aqui. Para a visao completa de saude, incluindo ' +
    'jobs derivados de sessoes, use veeam_search_backup_sessions(groupByJob=true)._';

  return [
    header,
    '',
    '| Nome | Tipo | Estado | Resultado | VMs | Ultima Execucao |',
    '|---|---|---|---|---|---|',
    rows,
    '',
    derivedHint
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
    `| Schedule | ${job.scheduleEnabled ? 'Ativo' : 'Desabilitado'}${job.scheduleType ? ` (${esc(job.scheduleType)})` : ''} |`,
    `| Ultima Execucao | ${formatDateTime(job.lastRun)} |`,
    `| Proxima Execucao | ${formatDateTime(job.nextRun)} |`,
    `| Resultado | ${resolveResult(typeof job.result === 'object' ? job.result?.result : job.result)} |`,
    `| Mensagem | ${truncate((typeof job.result === 'object' ? job.result?.message : job.message) || '', 300)} |`,
    `| Retentativa | ${job.retryEnabled ? `Sim (${job.retryCount || 0}x, espera ${job.retryWait || 0}min)` : 'Nao'} |`,
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

  // Protected VMs + restore-point coverage (console-like expand view).
  const pv = input?.protectedVms;
  if (pv && Array.isArray(pv.vms) && pv.vms.length) {
    lines.push('', `## VMs Protegidas / Restore Points (${pv.shown}${pv.total > pv.shown ? ' de ' + pv.total : ''})`, '');
    lines.push('| VM | Restore Points | Primeiro RP | Ultimo RP |');
    lines.push('|---|---|---|---|');
    let hasApprox = false;
    pv.vms.forEach(v => {
      if (v.restorePointSpanUnavailable) {
        const count = v.restorePointsCount != null ? String(v.restorePointsCount) : '?';
        lines.push(`| ${esc(v.name)} | ${count} | indisponivel | indisponivel |`);
        return;
      }
      if (v.approxOldest) hasApprox = true;
      const count = v.restorePointsCount != null ? `${v.restorePointsCount}${v.approxOldest ? '+' : ''}` : 'N/A';
      lines.push(`| ${esc(v.name)} | ${count} | ${formatDateTime(v.oldestRestorePoint)} | ${formatDateTime(v.newestRestorePoint)} |`);
    });
    const notes = [];
    if (pv.total > pv.shown) notes.push(`Exibindo ${pv.shown} de ${pv.total} VMs.`);
    if (hasApprox) notes.push('"+" = existem mais pontos do que os lidos; o "Primeiro RP" e um limite inferior.');
    if (pv.vms.some(v => v.restorePointSpanUnavailable)) notes.push('"indisponivel" = host/repositorio offline no momento da consulta.');
    if (notes.length) lines.push('', `_${notes.join(' ')}_`);
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
  // groupByJob mode: one row per job (deduplicated from the session stream)
  if (data?.groupedByJob) {
    return formatSessionsGroupedByJob(data);
  }

  // Suporta: { data: [...] } (API raw) OU { sessions: [...] } (tool formatada) OU [...]
  const sessions = data?.data || data?.sessions || (Array.isArray(data) ? data : []);
  if (!sessions.length) return 'Nenhuma session encontrada.';

  const pagination = data?.pagination;
  const header = pageInfo(
    sessions.length,
    args?.limit ?? pagination?.limit ?? 35,
    args?.skip || 0,
    pagination?.total
  );

  // Tally results for an at-a-glance summary line (user-requested).
  const tally = {};
  const rows = sessions.map(s => {
    const duration = formatDuration(s.creationTime, s.endTime);
    // result pode ser: numero (API raw), string "Success"/"Failed" (tool formatada), ou objeto { result: N }
    const resultVal = typeof s.result === 'object' ? s.result?.result : s.result;
    const resultStr = resolveResult(resultVal);
    tally[resultStr] = (tally[resultStr] || 0) + 1;
    return `| ${esc(s.id)} | ${esc(s.name)} | ${esc(s.sessionType)} | ${resultStr} | ${formatDateTime(s.creationTime)} | ${duration} | ${s.progressPercent != null ? s.progressPercent + '%' : 'N/A'} |`;
  }).join('\n');

  const summaryParts = [];
  if (tally['Falhou']) summaryParts.push(`${tally['Falhou']} falha(s)`);
  if (tally['Aviso']) summaryParts.push(`${tally['Aviso']} aviso(s)`);
  if (tally['Sucesso']) summaryParts.push(`${tally['Sucesso']} sucesso(s)`);
  if (tally['Em Execucao']) summaryParts.push(`${tally['Em Execucao']} em execucao`);
  const summaryLine = summaryParts.length
    ? `**Resumo:** ${summaryParts.join(', ')} _(nesta pagina; use groupByJob=true para 1 linha por job sem retries)_`
    : '';

  return [
    header,
    summaryLine,
    '',
    '| ID | Nome | Tipo | Resultado | Inicio | Duracao | Progresso |',
    '|---|---|---|---|---|---|---|',
    rows
  ].join('\n');
}

/**
 * Formata sessions agrupadas por job (modo groupByJob) — uma linha por job.
 * @param {object} data - { groupedByJob, summary, jobs:[...] }
 * @returns {string} Tabela Markdown
 */
function formatSessionsGroupedByJob(data) {
  const jobs = data?.jobs || [];
  const s = data?.summary || {};
  const windowLabel = s.windowLabel || (s.windowHours ? `ultimas ${s.windowHours}h` : 'ultimas 24h');
  if (!jobs.length) {
    return `Nenhum job com sessions na janela (${windowLabel}).`;
  }

  const icon = (label) => {
    switch (label) {
      case 'Success': return 'OK';
      case 'Failed': return 'FALHA';
      case 'Warning': return 'AVISO';
      case 'Running': return 'EM EXEC';
      default: return label || 'N/A';
    }
  };

  const rows = jobs.map(j => {
    const last = j.last || {};
    return `| ${esc(j.name)} | ${icon(last.label)} | ${formatDateTime(last.creationTime)} | ${j.attempts} | ${j.failed} | ${j.success} | ${j.warning} |`;
  }).join('\n');

  const header =
    `**${jobs.length} job(s)** na janela (${windowLabel}) ` +
    `(${s.jobsWithFailures || 0} com falha, ${s.jobsRunning || 0} em execucao) ` +
    `| ${s.totalSessionsScanned || 0} sessions agregadas` +
    (s.truncated ? ' _(janela truncada — reduza a janela para precisao total)_' : '');

  return [
    header,
    '',
    '| Job | Ultimo Resultado | Ultima Execucao | Tentativas | Falhas | Sucessos | Avisos |',
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
  // @MX:NOTE: The tool delivers enriched entries under `logs` (fields: timestamp/
  // timestampFormatted, level, message/messageFormatted). Earlier this formatter read
  // `data.data` with raw API fields (creationTime/status/title) — a contract mismatch that
  // made EVERY get_log render "Nenhum log encontrado". Accept both shapes.
  const entries = data?.logs || data?.data || (Array.isArray(data) ? data : []);

  const out = [];

  // Header block: session identity + result (so the failure cause shows even with no log lines)
  const info = data?.sessionInfo;
  if (info) {
    out.push(`# Log da Session: ${esc(info.name || data?.summary?.sessionName || 'N/A')}`);
    out.push('');
    out.push(`| Campo | Valor |`);
    out.push(`|---|---|`);
    if (info.sessionType) out.push(`| Tipo | ${esc(info.sessionType)} |`);
    if (info.state) out.push(`| Estado | ${esc(info.state)} |`);
    out.push(`| Resultado | ${resolveResult(info.result)} |`);
    if (info.resultMessage && info.resultMessage !== 'N/A') {
      out.push(`| Mensagem | ${esc(truncate(info.resultMessage, 300))} |`);
    }
    if (info.creationTimeFormatted) out.push(`| Início | ${esc(info.creationTimeFormatted)} |`);
    if (info.endTimeFormatted) out.push(`| Fim | ${esc(info.endTimeFormatted)} |`);
    out.push('');
  }

  // Troubleshooting summary when errors exist
  const ts = data?.troubleshooting;
  if (ts && ts.errorCount > 0) {
    out.push(`## Diagnóstico (${ts.errorCount} erro(s))`);
    (ts.recommendations || []).forEach(r => out.push(`- ${esc(r)}`));
    out.push('');
  }

  // Per-VM results (console "Statistics"). Show ONLY problem VMs in detail (with the error
  // message) + a count of OK ones, so a multi-VM job doesn't flood the output.
  const vmr = data?.vmResults;
  if (Array.isArray(vmr) && vmr.length) {
    const isProblem = (r) => ['failed', 'warning', '2', '1'].includes(String(r ?? '').toLowerCase());
    const problems = vmr.filter(v => isProblem(v.result));
    const okCount = vmr.length - problems.length;
    if (problems.length) {
      // @MX:NOTE: Group VMs by identical (normalized) error message. A systemic failure
      // (repo/host offline) makes dozens of VMs fail with the SAME message — collapse them
      // into one "N VMs: <causa>" row instead of N identical lines (root-cause at a glance).
      const byMsg = new Map();
      for (const v of problems) {
        const msg = (v.message || '(sem mensagem)').replace(/\s*[\r\n]+\s*/g, ' ').trim();
        if (!byMsg.has(msg)) byMsg.set(msg, { label: v.result, vms: [], msg });
        byMsg.get(msg).vms.push(v.vmName);
      }
      const groups = [...byMsg.values()].sort((a, b) => b.vms.length - a.vms.length);
      const distinct = groups.length;
      out.push(`## Resultado por VM — ${problems.length} com problema de ${vmr.length} (${distinct} causa(s) distinta(s))`, '');
      out.push('| VM(s) | Resultado | Mensagem (causa) |');
      out.push('|---|---|---|');
      groups.slice(0, 50).forEach(g => {
        const shown = g.vms.slice(0, 4).join(', ');
        const cell = g.vms.length > 1
          ? `${g.vms.length} VMs: ${shown}${g.vms.length > 4 ? ` +${g.vms.length - 4}` : ''}`
          : esc(g.vms[0]);
        out.push(`| ${cell} | ${resolveResult(g.label)} | ${truncate(esc(g.msg), 240)} |`);
      });
      if (okCount > 0) out.push('', `_+${okCount} VM(s) com sucesso._`);
      out.push('');
    } else {
      out.push(`_Resultado por VM: ${vmr.length} VM(s), todas com sucesso._`, '');
    }
  }

  if (!entries.length) {
    // No detailed log lines, but we may still have shown the result message above.
    if (out.length) {
      out.push('_Sem entradas de log detalhadas no VBR para esta session (a causa, se houver, está em "Mensagem" acima)._');
      return out.join('\n');
    }
    return 'Nenhum log encontrado para esta session.';
  }

  const maxEntries = 50;
  const displayed = entries.slice(0, maxEntries);
  out.push(entries.length > maxEntries
    ? `## ${maxEntries} de ${entries.length} entradas de log (use logLevel para filtrar)`
    : `## ${entries.length} entrada(s) de log`);
  out.push('');
  out.push('| Data | Nivel | Mensagem |');
  out.push('|---|---|---|');
  displayed.forEach(e => {
    const ts2 = e.timestampFormatted || formatDateTime(e.timestamp || e.creationTime);
    const lvl = e.level || e.status || 'Info';
    const msg = e.message || e.messageFormatted || e.title || '';
    out.push(`| ${ts2} | ${esc(lvl)} | ${truncate(esc(msg), 200)} |`);
  });

  return out.join('\n');
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
    args?.limit ?? pagination?.limit ?? 35,
    args?.skip || 0,
    pagination?.total
  );

  // Context line: VM, owning job, and retention span (oldest→newest) when available.
  const sm = data?.summary;
  const ctxParts = [];
  if (sm?.vmName && sm.vmName !== 'N/A') ctxParts.push(`VM: ${esc(sm.vmName)}`);
  if (sm?.jobName && sm.jobName !== 'N/A') ctxParts.push(`Job: ${esc(sm.jobName)}`);
  if (sm?.oldest && sm?.mostRecent) ctxParts.push(`span: ${esc(sm.oldest)} → ${esc(sm.mostRecent)}`);
  const ctxLine = ctxParts.length ? `**${ctxParts.join(' | ')}**` : '';

  // @MX:NOTE: This VBR's /restorePoints payload has no per-point size; only name/type/date.
  // Show Tamanho only when present, else N/A — avoids the misleading "0 B" on every row.
  const rows = points.map(p => {
    const vm = p.vmName || p.name || p.vmId || '';
    const sz = p.backupSize ?? p.size;
    return `| ${esc(p.id)} | ${esc(vm)} | ${formatDateTime(p.creationTime)} | ${esc(p.type)} | ${sz ? formatBytes(sz) : 'N/A'} |`;
  }).join('\n');

  return [
    header,
    ctxLine,
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

  // Compute usage% and a status flag; sort fullest-first so risks surface at the top.
  const enriched = repos.map(r => {
    const usedPctNum = (r.capacityGB && r.freeGB)
      ? Math.round(((r.capacityGB - r.freeGB) / r.capacityGB) * 100)
      : null;
    let status = 'OK';
    if (r.isOnline === false) status = 'OFFLINE';
    else if (usedPctNum != null && usedPctNum >= 90) status = 'CRITICO';
    else if (usedPctNum != null && usedPctNum >= 80) status = 'ATENCAO';
    return { ...r, usedPctNum, status };
  }).sort((a, b) => (b.usedPctNum ?? -1) - (a.usedPctNum ?? -1));

  const rows = enriched.map(r => {
    const capacity = r.capacityGB ? formatBytes(r.capacityGB * 1073741824) : 'N/A';
    const free = r.freeGB ? formatBytes(r.freeGB * 1073741824) : 'N/A';
    const usedPct = r.usedPctNum != null ? r.usedPctNum + '%' : 'N/A';
    return `| ${r.status} | ${esc(r.name)} | ${esc(r.type)} | ${capacity} | ${free} | ${usedPct} |`;
  }).join('\n');

  const critico = enriched.filter(r => r.status === 'CRITICO').length;
  const atencao = enriched.filter(r => r.status === 'ATENCAO').length;
  const offline = enriched.filter(r => r.status === 'OFFLINE').length;
  const summaryParts = [`${enriched.length} repositorio(s)`];
  if (critico) summaryParts.push(`${critico} CRITICO (>=90%)`);
  if (atencao) summaryParts.push(`${atencao} em ATENCAO (>=80%)`);
  if (offline) summaryParts.push(`${offline} OFFLINE`);

  return [
    `**${summaryParts.join(' | ')}**`,
    '',
    '| Status | Nome | Tipo | Capacidade | Livre | Uso |',
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

  // @MX:NOTE: VBR /api/v1/license returns instance counts under instanceLicenseSummary
  // (licensedInstancesNumber/usedInstancesNumber), NOT at the root. The old code read
  // data.licensedInstancesCount (never present) -> always "N/A". Read the real fields.
  const inst = data.instanceLicenseSummary || {};
  const cap = data.capacityLicenseSummary || {};
  const licensed = inst.licensedInstancesNumber ?? data.licensedInstancesCount ?? 'N/A';
  const used = inst.usedInstancesNumber ?? data.usedInstancesCount ?? 'N/A';

  const lines = [
    '# Licenca Veeam Backup & Replication',
    '',
    '| Campo | Valor |',
    '|---|---|',
    `| Status | ${esc(data.status)} |`,
    `| Edicao | ${esc(data.edition || data.type)} |`,
    `| Licenciado para | ${esc(data.licensedTo || 'N/A')} |`,
    `| Expiracao da Licenca | ${formatDateTime(data.expirationDate)} |`,
    `| Expiracao do Suporte | ${formatDateTime(data.supportExpirationDate)} |`,
    `| Instancias Licenciadas | ${licensed} |`,
    `| Instancias Usadas | ${used} |`,
  ];

  if (inst.rentalInstancesNumber != null) {
    lines.push(`| Instancias (rental) | ${inst.rentalInstancesNumber} |`);
  }
  if (cap.licensedCapacityTb != null || cap.usedCapacityTb != null) {
    lines.push(`| Capacidade (TB) | ${cap.usedCapacityTb ?? '?'} usados / ${cap.licensedCapacityTb ?? '?'} licenciados |`);
  }

  // Workloads protegidos por tipo (vem em instanceLicenseSummary.objects)
  const objects = inst.objects || data.workloads;
  if (Array.isArray(objects) && objects.length) {
    lines.push('', '## Workloads Protegidos', '', '| Tipo | Usados |', '|---|---|');
    objects.forEach(o => {
      lines.push(`| ${esc(o.type || o.workload || 'N/A')} | ${o.count ?? o.usedCount ?? 0} |`);
    });
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
  const dbType = data.databaseType ?? data.databaseEdition ?? data.databaseProductName ?? data.sqlServerEdition;
  if (dbVendor || dbType) {
    lines.push(`| Banco de Dados | ${esc([dbVendor, dbType].filter(Boolean).join(' '))} |`);
  }
  if (data.sqlServerVersion) lines.push(`| Versao SQL | ${esc(data.sqlServerVersion)} |`);
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

// @MX:NOTE: N3 — VBR returns weekday names in English (often lowercase, e.g. "monday").
// conversation_language=pt-BR, so translate for display while leaving unknown values untouched.
const WEEKDAY_PT = {
  sunday: 'Domingo', monday: 'Segunda', tuesday: 'Terca', wednesday: 'Quarta',
  thursday: 'Quinta', friday: 'Sexta', saturday: 'Sabado'
};
function translateWeekday(day) {
  if (!day) return day;
  return WEEKDAY_PT[String(day).toLowerCase()] || day;
}
function translateWeekdays(days) {
  return days.map(translateWeekday).join(', ');
}

/**
 * Formata schedule de um backup job como Markdown.
 */
export function formatJobSchedule(data) {
  if (!data) return 'Schedule nao encontrado.';

  // Accept the wrapped tool response ({schedule, execution}) or a raw schedule object.
  const sch = data.schedule || data;
  const exec = data.execution;

  // @MX:NOTE: derive the ACTIVE schedule mode from the real VBR structure (daily/monthly/
  // periodically/continuously/afterThisJob). Earlier this read non-existent top-level fields
  // and always rendered Manual/N/A, contradicting get_details.
  let tipo = 'Manual (sem agendamento automatico)';
  let frequencia = null;
  let horario = null;
  if (sch.runAutomatically) {
    if (sch.daily?.isEnabled) {
      tipo = 'Diario';
      horario = sch.daily.localTime || null;
      frequencia = sch.daily.dailyKind === 'Everyday' ? 'Todos os dias'
        : (Array.isArray(sch.daily.days) ? translateWeekdays(sch.daily.days) : sch.daily.dailyKind);
    } else if (sch.monthly?.isEnabled) {
      tipo = 'Mensal';
      horario = sch.monthly.localTime || null;
      frequencia = `${sch.monthly.dayNumberInMonth || ''} ${translateWeekday(sch.monthly.dayOfWeek) || ''}`.trim();
    } else if (sch.periodically?.isEnabled) {
      tipo = 'Periodico';
      frequencia = `a cada ${sch.periodically.frequency} ${sch.periodically.periodicallyKind}`;
    } else if (sch.continuously?.isEnabled) {
      tipo = 'Continuo';
    } else if (sch.afterThisJob?.isEnabled) {
      tipo = 'Apos outro job';
      frequencia = sch.afterThisJob.jobName || null;
    } else {
      tipo = 'Automatico';
    }
  }

  const lines = [
    '# Schedule do Backup Job',
    '',
    '| Campo | Valor |',
    '|---|---|',
    `| Tipo | ${esc(tipo)} |`,
  ];
  if (frequencia) lines.push(`| Frequencia | ${esc(frequencia)} |`);
  if (horario) lines.push(`| Horario | ${esc(horario)} |`);
  lines.push(`| Retentativa | ${sch.retry?.isEnabled ? `Sim (${sch.retry.retryCount}x, espera ${sch.retry.awaitMinutes || 0}min)` : 'Nao'} |`);
  if (exec) {
    lines.push(`| Ultima Execucao | ${esc(exec.lastRunFormatted || formatDateTime(exec.lastRun))} |`);
    lines.push(`| Proxima Execucao | ${esc(exec.nextRunFormatted || formatDateTime(exec.nextRun))} |`);
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
