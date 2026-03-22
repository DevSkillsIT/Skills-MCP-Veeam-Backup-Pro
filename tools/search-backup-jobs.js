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
import { searchByDescription, searchByName, formatDescriptionForAI } from "../lib/description-helpers.js";
import { enrichJobData, formatJobType } from "../lib/format-helpers.js";
import { enrichListResponse, createMCPResponse, addPerformanceMetrics } from "../lib/response-enricher.js";

const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.VEEAM_IGNORE_SSL === 'true'
});

export default function(server) {
  server.tool(
    "veeam_search_backup_jobs",
    {
      limit: z.number().min(1).max(50).default(25).describe("Maximum number of jobs to retrieve (default: 25, max: 50)"),
      skip: z.number().min(0).default(0).describe("Number of jobs to skip for pagination"),
      typeFilter: z.enum(["Backup", "Replica", "BackupCopy", "BackupSync", "All"]).default("Backup").describe("Job type filter. Use 'BackupCopy' for copy jobs (3-2-1 rule), 'All' for everything"),
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

        const apiUrl = `https://${host}:${port}/api/v1/jobs?${queryParams.toString()}`;
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

        // Post-fetch filter: name (semantic search)
        if (nameFilter && filteredJobs.length > 0) {
          const beforeCount = filteredJobs.length;
          filteredJobs = searchByName(filteredJobs, nameFilter, 'name');
          console.log(`[veeam_search_backup_jobs] nameFilter "${nameFilter}": ${filteredJobs.length}/${beforeCount}`);
          jobsData.data = filteredJobs;
        }

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
                "Try typeFilter='All' to see all job types",
                "Check VBR console for configured jobs",
                "Verify user permissions"
              ],
              availableTypes: ["Backup", "Replica", "BackupCopy", "BackupSync", "All"]
            }
          };

          return createMCPResponse(addPerformanceMetrics(noResultsResponse, startTime));
        }

        // Format results
        const total = jobsData.pagination?.total || filteredJobs.length;
        const count = filteredJobs.length;

        const formattedResult = {
          summary: `Retrieved ${count} backup jobs out of ${total} total`,
          jobs: filteredJobs.map(job => ({
            id: job.id,
            name: job.name,
            type: job.type,
            state: job.state,
            platformName: job.platformName,
            description: job.description,
            descriptionFormatted: formatDescriptionForAI(job.description),
            scheduleEnabled: job.scheduleEnabled,
            scheduleType: job.scheduleType,
            lastRun: job.lastRun,
            nextRun: job.nextRun,
            retryCount: job.retryCount,
            retryWait: job.retryWait,
            result: job.result?.result || 'Unknown',
            message: job.result?.message || 'No message'
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
