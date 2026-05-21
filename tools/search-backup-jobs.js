// tools/search-backup-jobs.js
// Consolidated tool: replaces veeam_list_backup_jobs + veeam_list_backup_copy_jobs
// SPEC-VEEAM-ENHANCE-001 / F04 — Tool Consolidation
//
// Supports ALL job types via typeFilter including BackupCopy.
// Returns JSON (interceptor handles Markdown conversion).

import fetch from "node-fetch";
import https from "https";
import { z } from "zod";
import { ensureAuthenticated } from "../lib/auth-middleware.js";
import { searchByDescription, formatDescriptionForAI } from "../lib/description-helpers.js";
import { createMCPResponse, addPerformanceMetrics } from "../lib/response-enricher.js";

const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.VEEAM_IGNORE_SSL === 'true'
});

export default function(server) {
  server.tool(
    "veeam_search_backup_jobs",
    {
      limit: z.number().min(1).max(50).default(25).describe("Max jobs to return (default 25, hard max 50). This VBR has ~21 backup jobs total, so limit=25 already captures everything. Do not set above total job count — it only wastes API bandwidth. Pair with nameFilter='*keyword*' (auto-wildcarded) to narrow results."),
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
          limit = 25,
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

        const response = await fetch(apiUrl, {
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

        // No results
        if (!filteredJobs || filteredJobs.length === 0) {
          const noResultsResponse = {
            summary: {
              message: `No backup jobs found with typeFilter: ${typeFilter}`,
              count: 0,
              timestamp: new Date().toISOString()
            },
            info: {
              possibleReasons: [
                "No jobs configured on this VBR server",
                `TypeFilter '${typeFilter}' is too restrictive`,
                "Insufficient permissions",
                "VBR server is new with no jobs yet"
              ],
              suggestions: [
                "Try typeFilter='All' to see every job returned by the endpoint",
                "Wrap partial names with * (e.g. nameFilter='*prod*')",
                "Check VBR console for configured jobs",
                "Verify user permissions"
              ],
              availableTypes: ["Backup", "All"]
            }
          };

          return createMCPResponse(addPerformanceMetrics(noResultsResponse, startTime));
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
            text: `Error: ${error.message}`
          }],
          isError: true
        };
      }
    }
  );
}
