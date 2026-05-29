// tools/manage-backup-jobs.js
// Consolidated tool: replaces veeam_get_backup_job_details + veeam_get_backup_job_schedule
//                    + veeam_start_backup_job + veeam_stop_backup_job
// SPEC-VEEAM-ENHANCE-001 / F04 — Tool Consolidation
//
// Unified job management via action parameter.

import https from "https";
import { z } from "zod";
import { ensureAuthenticated } from "../lib/auth-middleware.js";
import { validateJobOperation, validateVeeamId, validateUUID } from "../lib/validation-helpers.js";
import { logOperation } from "../lib/audit-logger.js";
import { formatDateTime, deriveScheduleType } from "../lib/format-helpers.js";
import { enrichResponse, enrichOperationResponse, createMCPResponse, addPerformanceMetrics } from "../lib/response-enricher.js";
import { safetyGuard } from "../lib/safety-guard.js";
import { formatDescriptionForAI, getDescriptionFallback } from "../lib/description-helpers.js";
import { getJobObjects, getRestorePointSpan, resolveJobId, isUuid } from "../lib/backup-coverage.js";
import { vbrFetch } from "../lib/veeam-fetch.js";

const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.VEEAM_IGNORE_SSL === 'true'
});

export default function(server) {
  server.tool(
    "veeam_manage_backup_jobs",
    {
      action: z.enum(["get_details", "get_schedule", "start", "stop"]).describe("Action to perform on the job"),
      jobId: z.string().describe("Nome (parcial) OU UUID do backup job. O nome exibido por search_backup_jobs e resolvido para UUID automaticamente; se casar varios jobs, retorna os candidatos."),
      fullBackup: z.boolean().default(false).optional().describe("Force full backup instead of incremental (only for 'start' action)"),
      includeSessions: z.boolean().default(true).optional().describe("If true, fetches recent sessions for this job and renders them in the 'Sessões Recentes' table. Keep true for audit context; set false to skip the extra API round-trip when you only need static job config."),
      sessionLimit: z.number().min(1).max(100).default(10).optional().describe("Max recent sessions to fetch when includeSessions=true. Default 10 is enough for most checks (spot last run, see recent failure). Use 25 for weekly audit; values above 25 are rarely useful — the Markdown caps render at 25 rows regardless. Do not default to max (100) unless explicitly asked for deep history."),
      confirmationToken: z.string().optional().describe("Confirmation token (required if MCP_SAFETY_GUARD=true, for 'start'/'stop')"),
      reason: z.string().optional().describe("Operation justification (required if MCP_SAFETY_GUARD=true, for 'start'/'stop')")
    },
    async (params) => {
      const startTime = Date.now();
      const { action, jobId, fullBackup = false, includeSessions = true, sessionLimit = 10, confirmationToken, reason } = params;

      // @MX:NOTE: jobId accepts a job NAME (partial) or a UUID. search_backup_jobs shows names,
      // not UUIDs, so requiring a UUID here was a dead-end for LLMs. Resolve name->UUID first.
      let resolvedJobId = jobId;
      if (!isUuid(jobId)) {
        const ctx = await ensureAuthenticated();
        // Destructive actions require an exact, unique name match (Codex safety point).
        const exact = action === 'start' || action === 'stop';
        const r = await resolveJobId(ctx, jobId, { exact });
        if (r.error) {
          return { content: [{ type: "text", text: `Erro: ${r.error}` }], isError: true };
        }
        resolvedJobId = r.id;
      } else {
        const uuidCheck = validateUUID(jobId, 'jobId');
        if (!uuidCheck.valid) {
          return { content: [{ type: "text", text: `Erro: ${uuidCheck.error}` }], isError: true };
        }
      }

      try {
        switch (action) {
          case 'get_details':
            return await handleGetDetails(resolvedJobId, includeSessions, sessionLimit, startTime);
          case 'get_schedule':
            return await handleGetSchedule(resolvedJobId, startTime);
          case 'start':
            return await handleStartJob(resolvedJobId, fullBackup, confirmationToken, reason, startTime);
          case 'stop':
            return await handleStopJob(resolvedJobId, confirmationToken, reason, startTime);
          default:
            return {
              content: [{ type: "text", text: `Erro: acao desconhecida "${action}". Acoes validas: get_details, get_schedule, start, stop` }],
              isError: true
            };
        }
      } catch (error) {
        console.error(`[veeam_manage_backup_jobs] Error (${action}):`, error);
        return {
          content: [{ type: "text", text: `Erro: ${error.message}` }],
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

  const jobResponse = await vbrFetch(jobUrl, {
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
      const fallbackResponse = await vbrFetch(fallbackUrl, {
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
    console.log('[manage_backup_jobs:get_details] raw payload keys:', Object.keys(jobData || {}));

    // Unwrap paginated shape { data: { id, name, ... } } if present
    if (jobData && jobData.data && !jobData.id) {
      jobData = jobData.data;
    }

    // @MX:NOTE: /api/v1/jobs/{id} returns static configuration only (no runtime state).
    // /api/v1/jobs/states carries status, lastResult, lastRun, nextRun, workload, sessionId.
    // We enrich jobData with those fields so the detail view is complete. Errors here are
    // non-fatal — the main config is already loaded.
    try {
      const stateUrl = `https://${host}:${port}/api/v1/jobs/states?idFilter=${encodeURIComponent(jobId)}&limit=1`;
      const stateResp = await vbrFetch(stateUrl, {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'x-api-version': apiVersion,
          'Authorization': `Bearer ${token}`
        },
        agent: httpsAgent
      });
      if (stateResp.ok) {
        const stateData = await stateResp.json();
        const s = stateData?.data?.[0];
        if (s) {
          jobData.state = s.status ?? jobData.state ?? null;
          jobData.lastRun = s.lastRun ?? jobData.lastRun ?? null;
          jobData.nextRun = s.nextRun ?? jobData.nextRun ?? null;
          jobData.platformName = s.workload ?? jobData.platformName ?? null;
          if (!jobData.result && s.lastResult) {
            jobData.result = { result: s.lastResult, message: null };
          }
          jobData.repositoryId = s.repositoryId ?? null;
          jobData.repositoryName = s.repositoryName ?? null;
          jobData.progressPercent = s.progressPercent ?? null;
          jobData.sessionId = s.sessionId ?? null;
        }
      } else {
        console.warn(`[manage_backup_jobs:get_details] state enrichment returned HTTP ${stateResp.status}`);
      }
    } catch (enrichErr) {
      console.warn('[manage_backup_jobs:get_details] state enrichment failed:', enrichErr.message);
    }
  }

  let result = {
    job: {
      id: jobData.id ?? null,
      name: jobData.name ?? jobData.displayName ?? null,
      type: jobData.type ?? null,
      state: jobData.state ?? null,
      platformName: jobData.platformName ?? null,
      description: jobData.description ?? null,
      // @MX:NOTE: V3 — derive schedule/retry from the REAL schedule object so get_details
      // agrees with get_schedule (was reading non-existent type/retryTimes/retryTimeout → 0x).
      scheduleEnabled: jobData.scheduleEnabled ?? (jobData.isDisabled === false) ?? !!jobData.schedule?.runAutomatically,
      scheduleType: jobData.scheduleType ?? deriveScheduleType(jobData.schedule),
      lastRun: jobData.lastRun ?? null,
      nextRun: jobData.nextRun ?? null,
      retryEnabled: jobData.schedule?.retry?.isEnabled ?? (jobData.retryCount != null ? true : false),
      retryCount: jobData.retryCount ?? jobData.schedule?.retry?.retryCount ?? 0,
      retryWait: jobData.retryWait ?? jobData.schedule?.retry?.awaitMinutes ?? 0,
      result: jobData.result?.result ?? null,
      message: jobData.result?.message ?? null,
      sessionId: jobData.sessionId ?? null,
      progressPercent: jobData.progressPercent ?? null,
      repositoryId: jobData.repositoryId ?? null,
      repositoryName: jobData.repositoryName ?? null
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
    const sessionsResponse = await vbrFetch(sessionsUrl, {
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

  // @MX:NOTE: Protected VMs + restore-point coverage — mirrors the Veeam console's
  // expand-job view (VMs and their restore-point counts). Best-effort: an offline host or
  // slow component is caught and the section is simply omitted, never breaking get_details.
  try {
    const ctx = { host, port, token, apiVersion };
    const objects = await getJobObjects(ctx, jobId);
    if (objects.length) {
      const capped = objects.slice(0, 30);
      // @MX:NOTE: run span lookups with bounded concurrency (5) so 30 VMs with an offline
      // repo can't serialize into minutes. Each span fetch is short-timeout + best-effort;
      // a failed one is marked unavailable rather than indistinguishable from "no points".
      const concurrency = 5;
      const vms = [];
      for (let i = 0; i < capped.length; i += concurrency) {
        const chunk = capped.slice(i, i + concurrency);
        const spans = await Promise.all(chunk.map(o => getRestorePointSpan(ctx, o.id, o.restorePointsCount)));
        chunk.forEach((o, idx) => {
          const span = spans[idx];
          const unavailable = span?.unavailable === true;
          vms.push({
            name: o.name,
            restorePointsCount: unavailable ? (o.restorePointsCount ?? null) : (span?.count ?? o.restorePointsCount ?? null),
            oldestRestorePoint: unavailable ? null : (span?.oldest ?? null),
            newestRestorePoint: unavailable ? null : (span?.newest ?? null),
            approxOldest: span?.approxOldest ?? false,
            restorePointSpanUnavailable: unavailable
          });
        });
      }
      result.protectedVms = { total: objects.length, shown: vms.length, vms };
    }
  } catch (covErr) {
    console.warn('[manage_backup_jobs:get_details] VM coverage enrichment failed:', covErr.message);
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
    if (response.status === 404) {
      throw new Error(`Job "${jobId}" not found. Use veeam_search_backup_jobs to find valid IDs.`);
    }
    const errorText = await response.text();
    throw new Error(`Failed to fetch job (HTTP ${response.status}): ${errorText}`);
  }

  const jobData = await response.json();

  // @MX:NOTE: the real schedule lives in jobData.schedule (daily/monthly/periodically/...),
  // NOT in non-existent scheduleEnabled/scheduleType. Pass the RAW schedule to the formatter.
  // /jobs/{id} has no lastRun/nextRun — enrich from /jobs/states (best-effort) so the schedule
  // view agrees with get_details.
  let lastRun = null, nextRun = null, lastResult = null;
  try {
    const stateResp = await vbrFetch(`https://${host}:${port}/api/v1/jobs/states?idFilter=${encodeURIComponent(jobId)}&limit=1`, {
      headers: { 'accept': 'application/json', 'x-api-version': apiVersion, 'Authorization': `Bearer ${token}` }
    });
    if (stateResp.ok) {
      const s = (await stateResp.json())?.data?.[0];
      if (s) { lastRun = s.lastRun ?? null; nextRun = s.nextRun ?? null; lastResult = s.lastResult ?? null; }
    }
  } catch (e) { console.warn('[get_schedule] states enrichment failed:', e.message); }

  const responseData = {
    summary: {
      message: `Schedule for job "${jobData.name}"`,
      jobId: jobData.id,
      jobName: jobData.name,
      jobType: jobData.type,
      timestamp: new Date().toISOString()
    },
    schedule: jobData.schedule || {},
    execution: {
      lastRun,
      lastRunFormatted: formatDateTime(lastRun),
      nextRun,
      nextRunFormatted: formatDateTime(nextRun),
      lastResult,
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

  const response = await vbrFetch(startUrl, {
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

  const response = await vbrFetch(stopUrl, {
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
