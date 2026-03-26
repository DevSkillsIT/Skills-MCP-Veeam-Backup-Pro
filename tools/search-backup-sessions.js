// tools/search-backup-sessions.js
// Consolidated tool: replaces veeam_list_backup_sessions + veeam_list_running_sessions
//                    + veeam_list_running_backup_jobs + veeam_list_failed_sessions
// SPEC-VEEAM-ENHANCE-001 / F04 — Tool Consolidation
//
// Unified session search with scope (all vs backup_only), statusFilter, and hours window.

import fetch from "node-fetch";
import https from "https";
import { z } from "zod";
import { ensureAuthenticated } from "../lib/auth-middleware.js";
import {
  enrichSessionData,
  calculateSessionStats,
  formatProgress,
  categorizeSessionType,
  formatSessionType,
  formatDateTime
} from "../lib/format-helpers.js";
import { BACKUP_JOB_SESSION_TYPES } from "../lib/veeam-dictionaries.js";
import { enrichListResponse, createMCPResponse, addPerformanceMetrics } from "../lib/response-enricher.js";

const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.VEEAM_IGNORE_SSL === 'true'
});

export default function(server) {
  server.tool(
    "veeam_search_backup_sessions",
    {
      limit: z.number().min(1).max(50).default(25).describe("Maximum sessions to retrieve (default: 25)"),
      skip: z.number().min(0).default(0).describe("Number of sessions to skip for pagination"),
      scope: z.enum(["all", "backup_only"]).default("all").describe("'all' includes system tasks; 'backup_only' excludes MalwareDetection, SureBackup, etc."),
      statusFilter: z.enum(["All", "Running", "Failed", "Success", "Warning"]).default("All").describe("Filter by session status"),
      hours: z.number().min(1).max(168).optional().describe("Time window in hours (max 168 = 7 days). Filters sessions from last N hours"),
      jobIdFilter: z.string().optional().describe("Filter sessions by specific job UUID"),
      typeFilter: z.string().optional().describe("Session type filter (e.g., BackupJob, ReplicaJob, BackupCopyJob)")
    },
    async (params) => {
      const startTime = Date.now();

      try {
        const { host, port, token, apiVersion } = await ensureAuthenticated();
        const {
          limit = 25,
          skip = 0,
          scope = "all",
          statusFilter = "All",
          hours,
          jobIdFilter,
          typeFilter
        } = params;

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

        if (jobIdFilter) {
          queryParams.append('jobIdFilter', jobIdFilter);
        }

        const apiUrl = `https://${host}:${port}/api/v1/sessions?${queryParams.toString()}`;
        console.log(`[veeam_search_backup_sessions] Fetching sessions from: ${apiUrl}`);

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

        // Time window filter
        if (hours && hours > 0 && filteredSessions.length > 0) {
          const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
          const beforeCount = filteredSessions.length;
          filteredSessions = filteredSessions.filter(session => {
            if (!session.creationTime) return false;
            return new Date(session.creationTime) >= cutoffTime;
          });
          console.log(`[veeam_search_backup_sessions] hours=${hours}: ${filteredSessions.length}/${beforeCount}`);
        }

        // Apply limit after manual filtering (for backup_only scope)
        if (scope === "backup_only") {
          filteredSessions = filteredSessions.slice(0, limit);
        }

        // No results
        if (filteredSessions.length === 0) {
          const timeRangeMsg = hours ? ` in the last ${hours} hours` : "";
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
        const total = sessionsData.pagination?.total || filteredSessions.length;

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
          pagination: sessionsData.pagination || { total, count: filteredSessions.length },
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
          sessionsData.pagination
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
          content: [{ type: "text", text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );
}
