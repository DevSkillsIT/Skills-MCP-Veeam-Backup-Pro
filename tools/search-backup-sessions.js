// tools/search-backup-sessions.js
// Consolidated tool: replaces veeam_list_backup_sessions + veeam_list_running_sessions
//                    + veeam_list_running_backup_jobs + veeam_list_failed_sessions
// SPEC-VEEAM-ENHANCE-001 / F04 — Tool Consolidation
//
// Unified session search with scope (all vs backup_only), statusFilter, and hours window.

import https from "https";
import { z } from "zod";
import { ensureAuthenticated } from "../lib/auth-middleware.js";
import { vbrFetch } from "../lib/veeam-fetch.js";
import {
  enrichSessionData,
  calculateSessionStats,
  formatProgress,
  categorizeSessionType,
  formatSessionType,
  formatDateTime
} from "../lib/format-helpers.js";
import { BACKUP_JOB_SESSION_TYPES } from "../lib/veeam-dictionaries.js";
import { groupSessionsByJob, SESSION_SCAN } from "../lib/session-aggregation.js";
import { resolveTimeWindow } from "../lib/date-helper.js";
import { enrichListResponse, createMCPResponse, addPerformanceMetrics } from "../lib/response-enricher.js";

const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.VEEAM_IGNORE_SSL === 'true'
});

export default function(server) {
  server.tool(
    "veeam_search_backup_sessions",
    {
      limit: z.number().min(1).max(50).default(35).describe("Max sessions to return (default 35, hard max 50). This VBR accumulates 10,000+ sessions — never request max without a narrow window/statusFilter, or the result is just the newest page and buries signal. Troubleshoot one job: jobIdFilter + limit=10. Failure sweep: statusFilter='Failed' + hours=24. Use groupByJob=true for a deduped per-job view."),
      skip: z.number().min(0).default(0).describe("Pagination offset (default 0 = newest). Increase by 'limit' to fetch older pages. Usually not needed — sessions are returned newest-first so skip=0 already has what you want."),
      scope: z.enum(["all", "backup_only"]).default("all").describe("'all' includes system tasks (MalwareDetection, SureBackup, ConfigBackup, ...); 'backup_only' excludes them. Use 'backup_only' for customer-facing reports, 'all' for internal audit."),
      statusFilter: z.enum(["All", "Running", "Failed", "Success", "Warning"]).default("All").describe("Filter by result. 'Running' shows in-progress only (good for 'what's happening now'). 'Failed' or 'Warning' for triage. 'Success' for SLA proof. 'All' when the user needs the raw picture."),
      hours: z.number().min(1).max(168).optional().describe("Time window in hours (max 168 = 7 days). Always set this unless you genuinely need ancient history — without it, the tool scans ALL sessions. Typical values: hours=24 (daily check), hours=168 (weekly report), hours=4 (recent failures)."),
      from: z.string().optional().describe("Inicio da janela. Formatos aceitos (nao invente outros): ISO ('2026-05-28' ou '2026-05-28T05:30'), BR ('28/05/2026' ou '28/05/2026 05:30'), palavra 'ontem'/'hoje'/'anteontem' com hora opcional (ex 'ontem 23:59'), ou relativo ('ultimas 6 horas', '7 dias'). Dia inteiro de ontem: from='ontem'. Se informado, tem prioridade sobre hours."),
      to: z.string().optional().describe("Fim da janela (mesmos formatos de from). Opcional — padrao: agora. So tem efeito junto com from. Sem hora, 'to' ja inclui ate 23:59:59 do dia — dia inteiro de ontem: from='ontem', to='ontem'."),
      jobIdFilter: z.string().optional().describe("UUID of a specific backup job to filter by. Get it from search_backup_jobs first. Combine with limit=10 to see just the recent runs of one job — most efficient query shape."),
      typeFilter: z.string().optional().describe("Session type (case-sensitive): 'BackupJob' (standard backups), 'ReplicaJob' (replicas), 'BackupCopyJob' (3-2-1 copy), 'ConfigurationBackup', 'MalwareDetection', 'SureBackup'. Leave empty to include all types."),
      groupByJob: z.boolean().default(false).describe("When true, collapse the many session rows into ONE row per job — last result, last run, and attempt/failure counts in the window. USE THIS for 'how are my backups doing?' / 'which jobs failed today?'. It removes retry-storm noise (one failing job can generate dozens of identical session rows). Pairs with hours (default 24 in this mode). Jobs with failures are listed first.")
    },
    async (params) => {
      const startTime = Date.now();

      try {
        const { host, port, token, apiVersion } = await ensureAuthenticated();
        const {
          limit = 35,
          skip = 0,
          scope = "all",
          statusFilter = "All",
          hours,
          from,
          to,
          jobIdFilter,
          typeFilter,
          groupByJob = false
        } = params;

        // @MX:NOTE: Flexible time window — from/to accept a CLOSED set of formats (ISO, BR,
        // keyword+optional-time, relative) parsed by normalizeDateTime, so a weak LLM doesn't
        // have to compute `hours`. from/to win over hours. Keep descriptions in sync with the parser.
        const win = resolveTimeWindow({ from, to, hours });
        if (win.error) {
          return { content: [{ type: "text", text: win.error }], isError: true };
        }

        // @MX:NOTE: jobIdFilter accepts a job NAME (not just UUID) for ergonomics.
        // RC2: in groupByJob mode, a NAME is filtered post-aggregation by substring
        // (groupSessionsByJob nameNeedle) — so Agent/Copy/remote-site jobs that are NOT in the
        // /jobs inventory can still be isolated by name (previously this errored with the
        // contradictory advice "use groupByJob=true" while groupByJob was ALREADY true).
        // Only the non-grouped path needs a real UUID (VBR /sessions jobIdFilter demands one).
        let resolvedJobId = jobIdFilter;
        let nameNeedle = null;
        if (jobIdFilter && !isUUID(jobIdFilter)) {
          if (groupByJob) {
            nameNeedle = jobIdFilter;   // filter aggregated groups by name; do NOT send to API
            resolvedJobId = null;
          } else {
            const r = await resolveJobIdentifier({ host, port, token, apiVersion, value: jobIdFilter });
            if (r.error) {
              return { content: [{ type: "text", text: r.error }], isError: true };
            }
            resolvedJobId = r.id;
          }
        }

        // @MX:NOTE: groupByJob collapses the per-attempt session rows into one row per job.
        // A single failing job can emit dozens of identical "Failed" sessions (retry storm),
        // burying the rest of the environment. This mode answers "how are my jobs doing?".
        if (groupByJob) {
          return await handleGroupByJob({
            host, port, token, apiVersion, httpsAgent,
            scope, statusFilter, win, jobIdFilter: resolvedJobId, nameNeedle, typeFilter, limit, startTime
          });
        }

        // Build query parameters
        const queryParams = new URLSearchParams({
          limit: (scope === "backup_only" ? (limit * 2).toString() : limit.toString()),
          skip: skip.toString()
        });

        // Map statusFilter to VBR API parameters
        if (statusFilter === "Running") {
          queryParams.append('stateFilter', 'Working');
        } else if (statusFilter === "Failed") {
          queryParams.append('resultFilter', 'Failed');
        } else if (statusFilter === "Success") {
          queryParams.append('resultFilter', 'Success');
        } else if (statusFilter === "Warning") {
          queryParams.append('resultFilter', 'Warning');
        }
        // "All" = no filter

        if (typeFilter) {
          queryParams.append('typeFilter', typeFilter);
        }

        if (resolvedJobId) {
          queryParams.append('jobIdFilter', resolvedJobId);
        }

        const apiUrl = `https://${host}:${port}/api/v1/sessions?${queryParams.toString()}`;
        console.log(`[veeam_search_backup_sessions] Fetching sessions from: ${apiUrl}`);

        const response = await vbrFetch(apiUrl, {
          method: 'GET',
          headers: {
            'accept': 'application/json',
            'x-api-version': apiVersion,
            'Authorization': `Bearer ${token}`
          },
          agent: httpsAgent
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch sessions (HTTP ${response.status}): ${errorText}`);
        }

        const sessionsData = await response.json();
        console.log(`[veeam_search_backup_sessions] Received ${sessionsData?.data?.length || 0} sessions`);

        let filteredSessions = sessionsData.data || [];

        // Scope filter: exclude system tasks if backup_only
        if (scope === "backup_only" && filteredSessions.length > 0) {
          const beforeCount = filteredSessions.length;
          filteredSessions = filteredSessions.filter(session =>
            BACKUP_JOB_SESSION_TYPES.includes(session.sessionType)
          );
          console.log(`[veeam_search_backup_sessions] scope=backup_only: ${filteredSessions.length}/${beforeCount}`);
        }

        // Time window filter (flexible: from/to or hours, resolved into win.since/win.until)
        if (win.since && filteredSessions.length > 0) {
          const beforeCount = filteredSessions.length;
          filteredSessions = filteredSessions.filter(session => {
            if (!session.creationTime) return false;
            const t = new Date(session.creationTime);
            return t >= win.since && (!win.until || t <= win.until);
          });
          console.log(`[veeam_search_backup_sessions] window=${win.label}: ${filteredSessions.length}/${beforeCount}`);
        }

        // Apply limit after manual filtering (for backup_only scope)
        if (scope === "backup_only") {
          filteredSessions = filteredSessions.slice(0, limit);
        }

        // No results
        if (filteredSessions.length === 0) {
          const timeRangeMsg = win.since ? ` na janela (${win.label})` : "";
          const scopeMsg = scope === "backup_only" ? " (backup jobs only)" : "";

          const noResultsResponse = {
            summary: {
              message: `No sessions found${timeRangeMsg}${scopeMsg} with status: ${statusFilter}`,
              count: 0,
              timestamp: new Date().toISOString()
            },
            info: {
              filters: { scope, statusFilter, hours: hours || null, jobIdFilter: jobIdFilter || null },
              suggestions: [
                "Try statusFilter='All' to see all sessions",
                "Try scope='all' to include system tasks",
                "Remove hours filter to see older sessions",
                "Use veeam_search_backup_jobs to check configured jobs"
              ]
            }
          };

          return createMCPResponse(addPerformanceMetrics(noResultsResponse, startTime));
        }

        // Enrich sessions
        const enrichedSessions = filteredSessions.map(session => enrichSessionData(session));

        // Categorize sessions
        const backupJobs = [];
        const systemTasks = [];

        enrichedSessions.forEach(session => {
          const categorization = categorizeSessionType(session.sessionType);
          const categorizedSession = {
            id: session.id,
            jobId: session.jobId || null,
            name: session.name,
            sessionType: session.sessionType,
            sessionTypeFormatted: formatSessionType(session.sessionType),
            category: categorization.category,
            isBackupJob: categorization.isBackupJob,
            isSystemTask: categorization.isSystemTask,
            platformName: session.platformName,
            state: session.state,
            stateFormatted: session.stateFormatted,
            progressPercent: session.progressPercent,
            progressFormatted: session.progressFormatted,
            creationTime: session.creationTime,
            creationTimeFormatted: session.creationTimeFormatted,
            endTime: session.endTime,
            endTimeFormatted: session.endTimeFormatted,
            duration: session.durationFormatted,
            result: session.result?.result,
            resultFormatted: session.resultFormatted,
            message: session.result?.message || "N/A"
          };

          if (categorization.isBackupJob) {
            backupJobs.push(categorizedSession);
          } else {
            systemTasks.push(categorizedSession);
          }
        });

        // Build response
        // @MX:NOTE: hours/scope are filtered CLIENT-SIDE, so the API's pagination.total
        // (server-side, ignores these) would be misleading — an LLM paginating by it would
        // scan rows that don't match the filter. When client-side filtering applied, report
        // the filtered count as the total.
        const clientFiltered = !!win.since || scope === "backup_only";
        const reportedPagination = clientFiltered
          ? { total: filteredSessions.length, count: filteredSessions.length, clientFiltered: true }
          : (sessionsData.pagination || { total: filteredSessions.length, count: filteredSessions.length });

        const responseData = {
          summary: {
            message: `${filteredSessions.length} session(s) found`,
            total: filteredSessions.length,
            backupJobsCount: backupJobs.length,
            systemTasksCount: systemTasks.length,
            timestamp: new Date().toISOString()
          },
          backupJobs: scope === "backup_only" ? backupJobs : undefined,
          systemTasks: scope === "all" ? systemTasks : undefined,
          sessions: enrichedSessions.map(session => {
            const categorization = categorizeSessionType(session.sessionType);
            return {
              id: session.id,
              jobId: session.jobId || null,
              name: session.name,
              sessionType: session.sessionType,
              sessionTypeFormatted: formatSessionType(session.sessionType),
              category: categorization.category,
              isBackupJob: categorization.isBackupJob,
              platformName: session.platformName,
              state: session.state,
              stateFormatted: session.stateFormatted,
              progressPercent: session.progressPercent,
              creationTime: session.creationTime,
              creationTimeFormatted: session.creationTimeFormatted,
              endTime: session.endTime,
              endTimeFormatted: session.endTimeFormatted,
              duration: session.durationFormatted,
              result: session.result?.result,
              resultFormatted: session.resultFormatted,
              message: session.result?.message || "N/A"
            };
          }),
          pagination: reportedPagination,
          filters: {
            scope,
            statusFilter,
            hours: hours || null,
            jobIdFilter: jobIdFilter || null,
            typeFilter: typeFilter || null
          }
        };

        // Clean undefined keys
        if (!responseData.backupJobs) delete responseData.backupJobs;
        if (!responseData.systemTasks) delete responseData.systemTasks;

        const enrichedResponse = enrichListResponse(
          responseData.sessions,
          "veeam_search_backup_sessions",
          responseData.filters,
          reportedPagination
        );

        const finalResponse = {
          ...responseData,
          pagination: enrichedResponse.pagination,
          _metadata: enrichedResponse._metadata
        };

        return createMCPResponse(addPerformanceMetrics(finalResponse, startTime));

      } catch (error) {
        console.error('[veeam_search_backup_sessions] Error:', error);
        return {
          content: [{ type: "text", text: `Erro: ${error.message}` }],
          isError: true
        };
      }
    }
  );
}

// ============================================================================
// Job identifier resolution (name -> UUID) for jobIdFilter
// ============================================================================

function isUUID(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || ''));
}

// Resolve a job name to its UUID via /api/v1/jobs/states. Returns { id } | { error }.
async function resolveJobIdentifier({ host, port, token, apiVersion, value }) {
  const qp = new URLSearchParams({ limit: '50' });
  qp.append('nameFilter', value.includes('*') ? value : `*${value}*`);
  const url = `https://${host}:${port}/api/v1/jobs/states?${qp.toString()}`;
  const headers = { 'accept': 'application/json', 'x-api-version': apiVersion, 'Authorization': `Bearer ${token}` };

  let resp;
  try {
    resp = await vbrFetch(url, { method: 'GET', headers, agent: httpsAgent });
  } catch (e) {
    // @MX:NOTE: V5 — error_messages=pt-BR; alinhado ao texto de manage_backup_jobs.
    return { error: `Nao foi possivel resolver o nome do job "${value}": ${e.message}. Passe o UUID do job, ou use groupByJob=true.` };
  }
  if (!resp.ok) {
    return { error: `Nao foi possivel resolver o nome do job "${value}" (HTTP ${resp.status}). Passe o UUID do job em jobIdFilter, ou use groupByJob=true para listar todos os jobs por nome.` };
  }
  const d = await resp.json();
  const jobs = d.data || [];
  if (jobs.length === 0) {
    return { error: `Nenhum job do inventario casa "${value}". Jobs Agent/replica/copy/site remoto NAO estao no inventario /jobs — use groupByJob=true, que agrega TODOS os jobs do historico de sessoes por nome.` };
  }
  if (jobs.length === 1) return { id: jobs[0].id };
  const list = jobs.slice(0, 10).map(j => `  - ${j.name} (${j.id})`).join('\n');
  return { error: `"${value}" casou ${jobs.length} jobs. Refine o nome ou passe o UUID:\n${list}` };
}

// ============================================================================
// groupByJob — one row per job, deduplicated from the session stream
// ============================================================================

// @MX:NOTE: Maps the user-facing statusFilter to the VBR /sessions query params.
// 'Running' -> stateFilter=Working; result statuses -> resultFilter; 'All' -> no filter.
function applyStatusQuery(qp, statusFilter) {
  if (statusFilter === "Running") qp.append('stateFilter', 'Working');
  else if (statusFilter === "Failed") qp.append('resultFilter', 'Failed');
  else if (statusFilter === "Success") qp.append('resultFilter', 'Success');
  else if (statusFilter === "Warning") qp.append('resultFilter', 'Warning');
}

async function handleGroupByJob(ctx) {
  const {
    host, port, token, apiVersion, httpsAgent,
    scope, statusFilter, win, jobIdFilter, nameNeedle, typeFilter, limit, startTime
  } = ctx;

  // Window: from/to (win.since/until) wins; else default to last 24h for the health view.
  const cutoff = win?.since || new Date(Date.now() - SESSION_SCAN.defaultWindowHours * 60 * 60 * 1000);
  const until = win?.until || null;
  const windowLabel = win?.label && win.label !== 'sem janela' ? win.label : `ultimas ${SESSION_SCAN.defaultWindowHours}h`;
  const headers = {
    'accept': 'application/json',
    'x-api-version': apiVersion,
    'Authorization': `Bearer ${token}`
  };

  // @MX:NOTE: This VBR accumulates 10k+ sessions. To aggregate a time window we page
  // newest-first and stop as soon as a page reaches past the cutoff or runs dry.
  // Capped (SESSION_SCAN) so a huge window can't run away.
  const pageSize = SESSION_SCAN.pageSize;
  const maxPages = SESSION_SCAN.maxPages;
  let collected = [];
  let truncated = false;

  for (let page = 0; page < maxPages; page++) {
    const qp = new URLSearchParams({ limit: String(pageSize), skip: String(page * pageSize) });
    applyStatusQuery(qp, statusFilter);
    if (typeFilter) qp.append('typeFilter', typeFilter);
    if (jobIdFilter) qp.append('jobIdFilter', jobIdFilter);

    const url = `https://${host}:${port}/api/v1/sessions?${qp.toString()}`;
    const resp = await vbrFetch(url, { method: 'GET', headers, agent: httpsAgent });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`Failed to fetch sessions (HTTP ${resp.status}): ${errText}`);
    }
    const json = await resp.json();
    const batch = json.data || [];
    collected.push(...batch);

    if (batch.length < pageSize) break; // no more pages
    const oldest = batch[batch.length - 1]?.creationTime;
    if (oldest && new Date(oldest) < cutoff) break; // window covered
    if (page === maxPages - 1) truncated = true;
  }

  // Window + scope filtering
  let inWindow = collected.filter(s => {
    if (!s.creationTime) return false;
    const t = new Date(s.creationTime);
    return t >= cutoff && (!until || t <= until);
  });
  if (scope === "backup_only") {
    inWindow = inWindow.filter(s => BACKUP_JOB_SESSION_TYPES.includes(s.sessionType));
  }

  // Group by jobId (fallback name) — shared pure helper. RC2: nameNeedle filters by job name
  // substring so a non-inventory job (Agent/Copy/remote-site) can be isolated by name here.
  const allGroups = groupSessionsByJob(inWindow, { nameNeedle });

  // Sort: failing first, then running, then most recent run
  const jobs = allGroups.sort((a, b) => {
    if ((b.failed > 0) !== (a.failed > 0)) return (b.failed > 0 ? 1 : 0) - (a.failed > 0 ? 1 : 0);
    if (b.running !== a.running) return b.running - a.running;
    return new Date(b.last?.creationTime || 0) - new Date(a.last?.creationTime || 0);
  }).slice(0, limit);

  const responseData = {
    groupedByJob: true,
    summary: {
      windowLabel,
      jobsWithFailures: jobs.filter(j => j.failed > 0).length,
      jobsRunning: jobs.filter(j => j.running > 0).length,
      totalJobs: allGroups.length,
      totalSessionsScanned: inWindow.length,
      truncated
    },
    jobs,
    filters: { scope, statusFilter, window: windowLabel, jobIdFilter: jobIdFilter || null, jobNameFilter: nameNeedle || null, typeFilter: typeFilter || null }
  };

  return createMCPResponse(addPerformanceMetrics(responseData, startTime));
}
