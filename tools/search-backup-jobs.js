// tools/search-backup-jobs.js
// Consolidated tool: replaces veeam_list_backup_jobs + veeam_list_backup_copy_jobs
// SPEC-VEEAM-ENHANCE-001 / F04 — Tool Consolidation
//
// Supports ALL job types via typeFilter including BackupCopy.
// Returns JSON (interceptor handles Markdown conversion).

import https from "https";
import { z } from "zod";
import { ensureAuthenticated } from "../lib/auth-middleware.js";
import { searchByDescription, formatDescriptionForAI } from "../lib/description-helpers.js";
import { createMCPResponse, addPerformanceMetrics } from "../lib/response-enricher.js";
import { findJobsByVmName, findJobsFromBackups, listExternalJobsFromBackups } from "../lib/backup-coverage.js";
import { vbrFetch } from "../lib/veeam-fetch.js";
import { groupSessionsByJob, SESSION_SCAN } from "../lib/session-aggregation.js";

const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.VEEAM_IGNORE_SSL === 'true'
});

export default function(server) {
  server.tool(
    "veeam_search_backup_jobs",
    {
      limit: z.number().min(1).max(50).default(35).describe("Max jobs to return (default 35, hard max 50). This VBR has ~21 backup jobs total, so the default already captures everything. Pair with nameFilter='*keyword*' (auto-wildcarded, matches job OR VM name) to narrow results."),
      skip: z.number().min(0).default(0).describe("Number of jobs to skip for pagination"),
      // @MX:NOTE: Empirically verified against VBR 12.3.2.3617 / REST API v1.2-rev0:
      // Only "Backup" is accepted on /api/v1/jobs?typeFilter=. Values VmReplica / BackupSync /
      // Tape / EpPolicy / VSphereBackup all return HTTP 400 "not valid for TypeFilter" on this
      // server. Other job types (replicas, tape) live behind dedicated endpoints not covered here.
      typeFilter: z.enum(["Backup", "All"]).default("Backup").describe("Job type filter (VBR 12.3 / v1.2-rev0 only accepts 'Backup' on this endpoint; 'All' skips the filter)"),
      stateFilter: z.enum(["Started", "Stopped", "Paused", "Working"]).optional().describe("Filter by job state"),
      nameFilter: z.string().optional().describe("Semantic name search (partial, accent-insensitive)"),
      descriptionFilter: z.string().optional().describe("Filter by client info in description (name, ID, location, contract)")
    },
    async (params) => {
      const startTime = Date.now();

      try {
        const { host, port, token, apiVersion } = await ensureAuthenticated();
        const {
          limit = 35,
          skip = 0,
          typeFilter = "Backup",
          stateFilter,
          nameFilter,
          descriptionFilter
        } = params;

        // Build query parameters
        const queryParams = new URLSearchParams({
          limit: limit.toString(),
          skip: skip.toString()
        });

        // typeFilter: "All" means no filter; otherwise set the API filter
        if (typeFilter && typeFilter !== "All") {
          queryParams.append('typeFilter', typeFilter);
        }

        if (stateFilter) {
          queryParams.append('stateFilter', stateFilter);
        }

        // @MX:NOTE: Veeam REST API nameFilter requires explicit asterisk wildcards for
        // substring matches (documented in the "Filter Parameters" section of the VBR REST
        // API reference). A bare value like "prod-vm-01" matches nothing — the API treats
        // it as an exact match attempt. We auto-wrap user input with * so partial matches
        // work as users expect.
        if (nameFilter) {
          const hasWildcard = nameFilter.includes('*');
          const wildcarded = hasWildcard ? nameFilter : `*${nameFilter}*`;
          queryParams.append('nameFilter', wildcarded);
        }

        // @MX:NOTE: /api/v1/jobs returns static job configuration only. /api/v1/jobs/states
        // returns the same list enriched with runtime state (status, lastResult, lastRun,
        // nextRun, workload, sessionId). Using /states lets the Estado/Resultado/Ultima
        // Execucao columns render real values instead of placeholders.
        const apiUrl = `https://${host}:${port}/api/v1/jobs/states?${queryParams.toString()}`;
        console.log(`[veeam_search_backup_jobs] Fetching jobs from: ${apiUrl}`);

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
          throw new Error(`Failed to fetch backup jobs: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const jobsData = await response.json();
        console.log(`[veeam_search_backup_jobs] Received ${jobsData?.data?.length || 0} jobs`);

        let filteredJobs = jobsData.data || [];

        // Post-fetch filter: description (VBR API does not support native description filter)
        if (descriptionFilter && filteredJobs.length > 0) {
          const beforeCount = filteredJobs.length;
          filteredJobs = searchByDescription(filteredJobs, descriptionFilter);
          console.log(`[veeam_search_backup_jobs] descriptionFilter "${descriptionFilter}": ${filteredJobs.length}/${beforeCount}`);
          jobsData.data = filteredJobs;
        }

        // nameFilter is sent to the API as a query param (see above); no client-side filter needed.

        // Transparent VM-name search: the search term may be a VM INSIDE a job, not the job
        // name. Resolve VM -> job(s) so the user can search by either, without knowing which.
        if ((!filteredJobs || filteredJobs.length === 0) && nameFilter) {
          const term = nameFilter.replace(/\*/g, '');
          const byVm = await findJobsByVmName({ host, port, token, apiVersion }, term);
          if (byVm.length) {
            return {
              content: [{
                type: "text",
                text: JSON.stringify({ matchedByVm: true, searchTerm: term, jobs: byVm }, null, 2)
              }]
            };
          }
        }

        // No results in the /jobs inventory. Hybrid coverage: a job may exist as an
        // Agent/Replica/Copy/remote-site job that this endpoint does not return. Derive it
        // from the session history so it is no longer invisible (resolves the ZNV / AU-* gap).
        // @MX:NOTE: derivation matches by session NAME, so only run it for nameFilter — a
        // description-only search would otherwise match names misleadingly.
        if ((!filteredJobs || filteredJobs.length === 0) && nameFilter) {
          const term = nameFilter.replace(/\*/g, '');
          const derived = await deriveJobsFromSessions({ host, port, token, apiVersion, term });
          if (derived.length) {
            return {
              content: [{
                type: "text",
                text: JSON.stringify({ derivedFromSessions: true, searchTerm: term, jobs: derived }, null, 2)
              }]
            };
          }
        }

        // @MX:NOTE: RC4 — 4th and LAST coverage source: stored backups (/api/v1/backups).
        // Veeam Agent (physical server) and Backup Copy jobs are absent from /jobs AND their
        // sessions are not name-matchable in /sessions, so the 3 sources above all miss them.
        // /backups is the only place they surface (resolved the invisible ZNV agent job).
        if ((!filteredJobs || filteredJobs.length === 0) && nameFilter) {
          const term = nameFilter.replace(/\*/g, '');
          const fromBackups = await findJobsFromBackups({ host, port, token, apiVersion }, term);
          if (fromBackups.length) {
            return {
              content: [{
                type: "text",
                text: JSON.stringify({ matchedFromBackups: true, searchTerm: term, jobs: fromBackups }, null, 2)
              }]
            };
          }
        }

        // No results — after checking ALL 4 sources (inventory, VM name, sessions, backups).
        if (!filteredJobs || filteredJobs.length === 0) {
          const searched = nameFilter ? nameFilter.replace(/\*/g, '') : null;
          const noResultsResponse = {
            summary: {
              message: searched
                ? `Nenhum job de backup casa "${searched}" — busca esgotou as 4 fontes: inventario /jobs, nome de VM, historico de sessoes (7d) e backups armazenados (Agent/Copy/offsite).`
                : `Nenhum backup job encontrado (typeFilter: ${typeFilter}).`,
              count: 0,
              timestamp: new Date().toISOString()
            },
            info: {
              conclusion: searched
                ? `Nao ha job (de nenhum tipo) cujo nome case "${searched}". Verifique se ha um REPOSITORIO provisionado para esse cliente com veeam_search_infrastructure(type=repositories) — pode haver storage sem job ativo (orfao).`
                : undefined,
              possibleReasons: [
                "Nenhum job casa o termo em nenhuma das 4 fontes",
                `typeFilter '${typeFilter}' pode estar restritivo (use 'All')`,
                "Permissoes insuficientes",
                "O termo nao corresponde a nenhum job/VM/backup"
              ],
              suggestions: [
                "Use typeFilter='All' para nao filtrar por tipo",
                "Verifique repositorios: veeam_search_infrastructure(type='repositories')",
                "Confira o nome exato no console do VBR"
              ],
              availableTypes: ["Backup", "All"]
            }
          };

          return createMCPResponse(addPerformanceMetrics(noResultsResponse, startTime));
        }

        // @MX:NOTE: RC4b — overview listing (no name/desc/state filter, first page) ALSO surfaces
        // Agent (physical) and Backup Copy jobs from /backups, which are NOT in /jobs inventory.
        // Without this, "liste os jobs" returns only the 21 VM jobs and an LLM concludes a client
        // (e.g. ZNV) has no job. Best-effort: never blocks the main listing.
        let externalJobs = [];
        if (!nameFilter && !descriptionFilter && !stateFilter && (skip === 0)) {
          try {
            externalJobs = await listExternalJobsFromBackups({ host, port, token, apiVersion });
          } catch (e) {
            console.warn('[veeam_search_backup_jobs] external jobs (/backups) lookup failed:', e.message);
          }
        }

        // Format results
        const total = jobsData.pagination?.total || filteredJobs.length;
        const count = filteredJobs.length;

        // @MX:NOTE: /api/v1/jobs/states returns "status" (not "state"), "lastResult"
        // (not result.result), "workload", "lastRun", "nextRun", "sessionId". We map these
        // to the shape the formatter expects so nothing downstream breaks.
        const formattedResult = {
          summary: `Retrieved ${count} backup jobs out of ${total} total`,
          jobs: filteredJobs.map(job => ({
            id: job.id,
            name: job.name,
            type: job.type,
            state: job.status ?? job.state ?? null,
            platformName: job.workload ?? job.platformName ?? null,
            description: job.description,
            descriptionFormatted: formatDescriptionForAI(job.description),
            scheduleEnabled: job.scheduleEnabled,
            scheduleType: job.scheduleType,
            lastRun: job.lastRun,
            nextRun: job.nextRun,
            objectsCount: job.objectsCount ?? null,
            retryCount: job.retryCount,
            retryWait: job.retryWait,
            result: job.lastResult ?? job.result?.result ?? null,
            message: job.result?.message ?? null,
            sessionId: job.sessionId ?? null,
            progressPercent: job.progressPercent ?? null,
            repositoryId: job.repositoryId ?? null,
            repositoryName: job.repositoryName ?? null
          })),
          pagination: jobsData.pagination || { total, count },
          externalJobs,
          filters: {
            typeFilter,
            stateFilter: stateFilter || 'None',
            nameFilter: nameFilter || 'None',
            descriptionFilter: descriptionFilter || 'None'
          }
        };

        return {
          content: [{
            type: "text",
            text: JSON.stringify(formattedResult, null, 2)
          }]
        };

      } catch (error) {
        console.error('[veeam_search_backup_jobs] Error:', error);
        return {
          content: [{
            type: "text",
            text: `Erro: ${error.message}`
          }],
          isError: true
        };
      }
    }
  );
}

// ============================================================================
// Hybrid coverage: derive jobs from session history (for jobs absent from /jobs)
// ============================================================================

// Scans recent sessions (newest-first, capped) for names matching `term`, then collapses
// them into one entry per job — last result + run + attempt count. Returns [] if none.
async function deriveJobsFromSessions({ host, port, token, apiVersion, term }) {
  const headers = { 'accept': 'application/json', 'x-api-version': apiVersion, 'Authorization': `Bearer ${token}` };
  const needle = String(term || '').toLowerCase();
  if (!needle) return [];

  const { pageSize, maxPages, deriveLookbackHours } = SESSION_SCAN;
  const cutoff = new Date(Date.now() - deriveLookbackHours * 60 * 60 * 1000);
  const matched = [];

  for (let page = 0; page < maxPages; page++) {
    const qp = new URLSearchParams({ limit: String(pageSize), skip: String(page * pageSize) });
    const url = `https://${host}:${port}/api/v1/sessions?${qp.toString()}`;
    const resp = await vbrFetch(url, { method: 'GET', headers, agent: httpsAgent });
    if (!resp.ok) break;
    const json = await resp.json();
    const batch = json.data || [];
    matched.push(...batch);
    if (batch.length < pageSize) break;
    const oldest = batch[batch.length - 1]?.creationTime;
    if (oldest && new Date(oldest) < cutoff) break;
  }

  // Group by job via shared helper (filters by name substring).
  return groupSessionsByJob(matched, { nameNeedle: needle }).map(g => ({
    id: g.jobId,
    name: g.name,
    type: g.sessionType,
    state: 'externo (via sessoes)',
    result: g.last?.label ?? null,
    lastRun: g.last?.creationTime ?? null,
    objectsCount: null,
    attemptsLast7d: g.attempts,
    failuresLast7d: g.failed
  }));
}
