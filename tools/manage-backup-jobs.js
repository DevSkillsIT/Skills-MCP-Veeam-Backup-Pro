// tools/manage-backup-jobs.js
// Consolidated tool: replaces veeam_get_backup_job_details + veeam_get_backup_job_schedule
//                    + veeam_start_backup_job + veeam_stop_backup_job
// SPEC-VEEAM-ENHANCE-001 / F04 — Tool Consolidation
//
// Unified job management via action parameter.

import fetch from "node-fetch";
import https from "https";
import { z } from "zod";
import { ensureAuthenticated } from "../lib/auth-middleware.js";
import { validateJobOperation, validateVeeamId, validateUUID } from "../lib/validation-helpers.js";
import { logOperation } from "../lib/audit-logger.js";
import { formatDateTime } from "../lib/format-helpers.js";
import { enrichResponse, enrichOperationResponse, createMCPResponse, addPerformanceMetrics } from "../lib/response-enricher.js";
import { safetyGuard } from "../lib/safety-guard.js";
import { formatDescriptionForAI, getDescriptionFallback } from "../lib/description-helpers.js";

const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.VEEAM_IGNORE_SSL === 'true'
});

export default function(server) {
  server.tool(
    "veeam_manage_backup_jobs",
    {
      action: z.enum(["get_details", "get_schedule", "start", "stop"]).describe("Action to perform on the job"),
      jobId: z.string().describe("UUID of the backup job"),
      fullBackup: z.boolean().default(false).optional().describe("Force full backup instead of incremental (only for 'start' action)"),
      includeSessions: z.boolean().default(true).optional().describe("Include recent sessions (only for 'get_details' action)"),
      sessionLimit: z.number().min(1).max(100).default(10).optional().describe("Max recent sessions to include (only for 'get_details' action)"),
      confirmationToken: z.string().optional().describe("Confirmation token (required if MCP_SAFETY_GUARD=true, for 'start'/'stop')"),
      reason: z.string().optional().describe("Operation justification (required if MCP_SAFETY_GUARD=true, for 'start'/'stop')")
    },
    async (params) => {
      const startTime = Date.now();
      const { action, jobId, fullBackup = false, includeSessions = true, sessionLimit = 10, confirmationToken, reason } = params;

      // Validate UUID format
      const uuidCheck = validateUUID(jobId, 'jobId');
      if (!uuidCheck.valid) {
        return {
          content: [{ type: "text", text: `Error: ${uuidCheck.error}` }],
          isError: true
        };
      }

      try {
        switch (action) {
          case 'get_details':
            return await handleGetDetails(jobId, includeSessions, sessionLimit, startTime);
          case 'get_schedule':
            return await handleGetSchedule(jobId, startTime);
          case 'start':
            return await handleStartJob(jobId, fullBackup, confirmationToken, reason, startTime);
          case 'stop':
            return await handleStopJob(jobId, confirmationToken, reason, startTime);
          default:
            return {
              content: [{ type: "text", text: `Error: Unknown action "${action}". Valid: get_details, get_schedule, start, stop` }],
              isError: true
            };
        }
      } catch (error) {
        console.error(`[veeam_manage_backup_jobs] Error (${action}):`, error);
        return {
          content: [{ type: "text", text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );
}

// ============================================================================
// ACTION: get_details
// ============================================================================
async function handleGetDetails(jobId, includeSessions, sessionLimit, startTime) {
  const { host, port, token, apiVersion } = await ensureAuthenticated();

  const jobUrl = `https://${host}:${port}/api/v1/jobs/${jobId}`;
  console.log(`[manage_backup_jobs:get_details] Fetching: ${jobUrl}`);

  const jobResponse = await fetch(jobUrl, {
    method: 'GET',
    headers: {
      'accept': 'application/json',
      'x-api-version': apiVersion,
      'Authorization': `Bearer ${token}`
    },
    agent: httpsAgent
  });

  let jobData;
  let usedFallback = false;

  if (!jobResponse.ok) {
    const errorText = await jobResponse.text();

    // Hyper-V fallback: VBR REST API v1.2-rev0 does not support Hyper-V via /api/v1/jobs/{id}
    if (errorText.includes('supported platform type')) {
      console.log(`[manage_backup_jobs:get_details] Platform not supported. Trying fallback via sessions...`);

      const fallbackUrl = `https://${host}:${port}/api/v1/sessions?jobIdFilter=${jobId}&limit=1&sortOrder=descending`;
      const fallbackResponse = await fetch(fallbackUrl, {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'x-api-version': apiVersion,
          'Authorization': `Bearer ${token}`
        },
        agent: httpsAgent
      });

      if (!fallbackResponse.ok) {
        throw new Error(`Fallback failed: ${fallbackResponse.status} ${fallbackResponse.statusText}`);
      }

      const sessionsData = await fallbackResponse.json();
      if (!sessionsData.data || sessionsData.data.length === 0) {
        throw new Error(`Job ${jobId} not found via fallback. Job may never have been executed.`);
      }

      const latestSession = sessionsData.data[0];
      jobData = {
        id: jobId,
        name: latestSession.name || 'Unknown Job',
        type: latestSession.sessionType || 'Unknown',
        platformName: latestSession.platformName || 'Unknown Platform',
        description: `Job extracted via fallback (platform: ${latestSession.platformName})`,
        state: 'Unknown (via fallback)',
        scheduleEnabled: null,
        scheduleType: null,
        lastRun: latestSession.creationTime,
        nextRun: null,
        retryCount: null,
        retryWait: null,
        result: {
          result: latestSession.result?.result || 'Unknown',
          message: latestSession.result?.message || 'No message'
        }
      };
      usedFallback = true;
    } else {
      throw new Error(`Failed to fetch job details: ${jobResponse.status} ${jobResponse.statusText} - ${errorText}`);
    }
  } else {
    jobData = await jobResponse.json();
  }

  let result = {
    job: {
      id: jobData.id,
      name: jobData.name,
      type: jobData.type,
      state: jobData.state,
      platformName: jobData.platformName,
      description: jobData.description,
      scheduleEnabled: jobData.scheduleEnabled,
      scheduleType: jobData.scheduleType,
      lastRun: jobData.lastRun,
      nextRun: jobData.nextRun,
      retryCount: jobData.retryCount,
      retryWait: jobData.retryWait,
      result: jobData.result?.result || 'Unknown',
      message: jobData.result?.message || 'No message'
    }
  };

  if (usedFallback) {
    result._fallback = {
      used: true,
      reason: 'Platform not supported by /api/v1/jobs endpoint (Hyper-V limitation)',
      limitations: [
        'Schedule details not available',
        'Retry configuration not available',
        'Current job state not available (only last execution state)'
      ]
    };
  }

  // Include recent sessions if requested
  if (includeSessions) {
    const sessionsUrl = `https://${host}:${port}/api/v1/sessions?limit=${sessionLimit}&jobIdFilter=${jobId}`;
    const sessionsResponse = await fetch(sessionsUrl, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'x-api-version': apiVersion,
        'Authorization': `Bearer ${token}`
      },
      agent: httpsAgent
    });

    if (sessionsResponse.ok) {
      const sessionsData = await sessionsResponse.json();
      result.sessions = {
        summary: `Found ${sessionsData.data?.length || 0} recent sessions for job '${jobData.name}'`,
        sessions: sessionsData.data?.map(session => ({
          id: session.id,
          sessionType: session.sessionType,
          state: session.state,
          creationTime: session.creationTime,
          endTime: session.endTime,
          progressPercent: session.progressPercent,
          result: session.result?.result || 'Unknown',
          message: session.result?.message || 'No message'
        })) || [],
        pagination: sessionsData.pagination
      };
    }
  }

  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
  };
}

// ============================================================================
// ACTION: get_schedule
// ============================================================================
async function handleGetSchedule(jobId, startTime) {
  validateVeeamId(jobId, "job");
  const { host, port, token, apiVersion } = await ensureAuthenticated();

  const apiUrl = `https://${host}:${port}/api/v1/jobs/${jobId}`;
  console.log(`[manage_backup_jobs:get_schedule] Fetching: ${apiUrl}`);

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
    if (response.status === 404) {
      throw new Error(`Job "${jobId}" not found. Use veeam_search_backup_jobs to find valid IDs.`);
    }
    const errorText = await response.text();
    throw new Error(`Failed to fetch job (HTTP ${response.status}): ${errorText}`);
  }

  const jobData = await response.json();

  const scheduleInfo = {
    enabled: jobData.scheduleEnabled || false,
    type: jobData.scheduleType || "None",
    retry: {
      enabled: (jobData.retryCount || 0) > 0,
      count: jobData.retryCount || 0,
      waitMinutes: jobData.retryWait || 0
    }
  };

  const responseData = {
    summary: {
      message: `Schedule for job "${jobData.name}"`,
      jobId: jobData.id,
      jobName: jobData.name,
      jobType: jobData.type,
      scheduleEnabled: jobData.scheduleEnabled,
      timestamp: new Date().toISOString()
    },
    schedule: scheduleInfo,
    execution: {
      lastRun: jobData.lastRun,
      lastRunFormatted: formatDateTime(jobData.lastRun),
      nextRun: jobData.nextRun,
      nextRunFormatted: formatDateTime(jobData.nextRun),
      lastResult: jobData.result?.result,
      lastResultMessage: jobData.result?.message || "N/A"
    },
    jobInfo: {
      id: jobData.id,
      name: jobData.name,
      type: jobData.type,
      description: jobData.description,
      platformName: jobData.platformName,
      state: jobData.state
    }
  };

  const enrichedResponse = enrichResponse(
    responseData,
    "veeam_manage_backup_jobs",
    { jobId: jobData.id, action: "get_schedule" }
  );

  return createMCPResponse(addPerformanceMetrics(enrichedResponse, startTime));
}

// ============================================================================
// ACTION: start
// ============================================================================
async function handleStartJob(jobId, fullBackup, confirmationToken, reason, startTime) {
  // Safety guard
  await safetyGuard.requireConfirmation(
    'veeam_manage_backup_jobs:start',
    confirmationToken,
    reason,
    jobId,
    'Job'
  );

  validateVeeamId(jobId, "job");
  const job = await validateJobOperation(jobId, 'start');

  const { host, port, token, apiVersion } = await ensureAuthenticated();

  const startUrl = `https://${host}:${port}/api/v1/jobs/${jobId}/start`;
  const requestBody = { type: fullBackup ? "Full" : "Incremental" };

  console.log(`[manage_backup_jobs:start] POST ${startUrl}`);

  const response = await fetch(startUrl, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'x-api-version': apiVersion,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody),
    agent: httpsAgent
  });

  if (!response.ok) {
    const errorText = await response.text();
    await logOperation('veeam_manage_backup_jobs:start', {
      jobId, jobName: job.name, result: 'failed',
      error: `HTTP ${response.status}: ${errorText}`,
      metadata: { fullBackup }
    });
    throw new Error(`Failed to start job (HTTP ${response.status}): ${errorText}`);
  }

  const startResult = await response.json();
  const sessionId = startResult.sessionId || startResult.id || "N/A";

  await logOperation('veeam_manage_backup_jobs:start', {
    jobId, jobName: job.name, result: 'success',
    metadata: { fullBackup, sessionId, startedAt: new Date().toISOString() }
  });

  const operationResponse = enrichOperationResponse(
    "veeam_manage_backup_jobs",
    {
      status: "started",
      sessionId,
      backupType: fullBackup ? "Full" : "Incremental",
      startedAt: new Date().toISOString(),
      apiResponse: startResult
    },
    {
      jobId: job.id,
      jobName: job.name,
      jobType: job.type,
      platformName: job.platformName,
      description: job.description || getDescriptionFallback(job),
      descriptionFormatted: formatDescriptionForAI(job.description)
    }
  );

  const enrichedResponse = {
    ...operationResponse,
    summary: {
      message: `Job "${job.name}" started successfully`,
      jobId: job.id,
      jobName: job.name,
      backupType: fullBackup ? "Full Backup" : "Incremental Backup",
      sessionId,
      timestamp: new Date().toISOString()
    },
    nextSteps: {
      monitorProgress: "Use veeam_search_backup_sessions with statusFilter='Running'",
      checkLogs: sessionId !== "N/A" ? `Use veeam_manage_backup_sessions with sessionId: ${sessionId}` : "Session ID not yet available"
    }
  };

  return createMCPResponse(addPerformanceMetrics(enrichedResponse, startTime));
}

// ============================================================================
// ACTION: stop
// ============================================================================
async function handleStopJob(jobId, confirmationToken, reason, startTime) {
  // Safety guard
  await safetyGuard.requireConfirmation(
    'veeam_manage_backup_jobs:stop',
    confirmationToken,
    reason,
    jobId,
    'Job'
  );

  validateVeeamId(jobId, "job");
  const job = await validateJobOperation(jobId, 'stop');

  const { host, port, token, apiVersion } = await ensureAuthenticated();

  const stopUrl = `https://${host}:${port}/api/v1/jobs/${jobId}/stop`;
  console.log(`[manage_backup_jobs:stop] POST ${stopUrl}`);

  const response = await fetch(stopUrl, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'x-api-version': apiVersion,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({}),
    agent: httpsAgent
  });

  if (!response.ok) {
    const errorText = await response.text();
    await logOperation('veeam_manage_backup_jobs:stop', {
      jobId, jobName: job.name, result: 'failed',
      error: `HTTP ${response.status}: ${errorText}`
    });
    throw new Error(`Failed to stop job (HTTP ${response.status}): ${errorText}`);
  }

  let stopResult = {};
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    stopResult = await response.json();
  }

  await logOperation('veeam_manage_backup_jobs:stop', {
    jobId, jobName: job.name, result: 'success',
    metadata: { stoppedAt: new Date().toISOString(), previousState: job.state }
  });

  const operationResponse = enrichOperationResponse(
    "veeam_manage_backup_jobs",
    {
      status: "stopped",
      stoppedAt: new Date().toISOString(),
      previousState: job.state,
      apiResponse: stopResult
    },
    {
      jobId: job.id,
      jobName: job.name,
      jobType: job.type,
      platformName: job.platformName,
      description: job.description || getDescriptionFallback(job),
      descriptionFormatted: formatDescriptionForAI(job.description)
    }
  );

  const enrichedResponse = {
    ...operationResponse,
    summary: {
      message: `Job "${job.name}" stopped successfully`,
      jobId: job.id,
      jobName: job.name,
      jobType: job.type,
      timestamp: new Date().toISOString()
    },
    warnings: [
      "Stopping a job may leave backup incomplete",
      "Session will be marked as Failed or Warning",
      "A full backup may be needed after forced stop"
    ]
  };

  return createMCPResponse(addPerformanceMetrics(enrichedResponse, startTime));
}
