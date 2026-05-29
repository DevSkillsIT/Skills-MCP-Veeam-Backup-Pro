// tools/manage-backup-sessions.js
// Consolidated tool: replaces veeam_get_session_log
// SPEC-VEEAM-ENHANCE-001 / F04 — Tool Consolidation
//
// Session management with action parameter (currently: get_log).

import https from "https";
import { z } from "zod";
import { ensureAuthenticated } from "../lib/auth-middleware.js";
import { vbrFetch } from "../lib/veeam-fetch.js";
import { getTaskSessionResults } from "../lib/backup-coverage.js";
import { validateSessionExists, validateVeeamId, validateUUID } from "../lib/validation-helpers.js";
import { formatDateTime, formatLogMessage, deriveLogLevel } from "../lib/format-helpers.js";
import { enrichResponse, createMCPResponse, addPerformanceMetrics } from "../lib/response-enricher.js";

const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.VEEAM_IGNORE_SSL === 'true'
});

export default function(server) {
  server.tool(
    "veeam_manage_backup_sessions",
    {
      action: z.enum(["get_log"]).describe("Action to perform on the session"),
      sessionId: z.string().describe("UUID of the backup session"),
      logLevel: z.enum(["All", "Info", "Warning", "Error", "Debug"]).default("All").describe("Filter by log level (default: All)")
    },
    async (params) => {
      const startTime = Date.now();
      const { action, sessionId, logLevel = "All" } = params;

      // Validate UUID format
      const uuidCheck = validateUUID(sessionId, 'sessionId');
      if (!uuidCheck.valid) {
        return {
          content: [{ type: "text", text: `Erro: ${uuidCheck.error}` }],
          isError: true
        };
      }

      try {
        switch (action) {
          case 'get_log':
            return await handleGetLog(sessionId, logLevel, startTime);
          default:
            return {
              content: [{ type: "text", text: `Erro: acao desconhecida "${action}". Acoes validas: get_log` }],
              isError: true
            };
        }
      } catch (error) {
        console.error(`[veeam_manage_backup_sessions] Error (${action}):`, error);
        return {
          content: [{ type: "text", text: `Erro: ${error.message}` }],
          isError: true
        };
      }
    }
  );
}

// ============================================================================
// ACTION: get_log
// ============================================================================
async function handleGetLog(sessionId, logLevel, startTime) {
  validateVeeamId(sessionId, "session");

  // Validate session exists
  const session = await validateSessionExists(sessionId);
  console.log(`[manage_backup_sessions:get_log] Session "${session.name}" validated`);

  const { host, port, token, apiVersion } = await ensureAuthenticated();

  // Try /log endpoint first
  let logUrl = `https://${host}:${port}/api/v1/sessions/${sessionId}/log`;
  console.log(`[manage_backup_sessions:get_log] Trying: ${logUrl}`);

  let response = await vbrFetch(logUrl, {
    method: 'GET',
    headers: {
      'accept': 'application/json',
      'x-api-version': apiVersion,
      'Authorization': `Bearer ${token}`
    },
    agent: httpsAgent
  });

  let logEntries = [];
  let logSource = "endpoint-log";

  // Fallback to session details if /log returns 404
  if (!response.ok && response.status === 404) {
    console.log(`[manage_backup_sessions:get_log] /log not available. Fallback to session details`);
    logSource = "session-messages";

    const sessionUrl = `https://${host}:${port}/api/v1/sessions/${sessionId}`;
    response = await vbrFetch(sessionUrl, {
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
      throw new Error(`Failed to fetch session details (HTTP ${response.status}): ${errorText}`);
    }

    const sessionDetails = await response.json();
    logEntries = extractLogEntriesFromSession(sessionDetails);
  } else if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch session logs (HTTP ${response.status}): ${errorText}`);
  } else {
    const logData = await response.json();
    logEntries = logData.data || logData.logs || [];
  }

  console.log(`[manage_backup_sessions:get_log] Received ${logEntries.length} log entries`);

  // @MX:NOTE: Error masking fix — the VBR /log endpoint often returns HTTP 200 with an
  // empty list (not 404), so the 404 fallback above never fires and the failure reason is
  // silently dropped. When we have no log lines but the session carries a result message,
  // synthesize one entry from session.result so the cause of a failure is never hidden.
  if (logEntries.length === 0) {
    const resultMsg = session?.result?.message;
    const resultName = session?.result?.result;
    if (resultMsg || (resultName && String(resultName).toLowerCase() !== 'success')) {
      const isFailure = String(resultName ?? '').toLowerCase() === 'failed' || String(resultName) === '2';
      logEntries = [{
        timestamp: session.endTime || session.creationTime,
        level: isFailure ? 'Error' : (String(resultName ?? '').toLowerCase() === 'warning' ? 'Warning' : 'Info'),
        message: resultMsg || `Session result: ${resultName}`,
        component: 'session.result'
      }];
      logSource = 'session-result-fallback';
      console.log(`[manage_backup_sessions:get_log] /log empty; synthesized entry from session.result (${resultName})`);
    }
  }

  // @MX:NOTE: V2 — reclassify each entry's level from its message before filtering/analysis.
  // VBR logs error text at level "Info", which made logLevel=Error/Warning return empty on
  // failed sessions and undercounted errorCount. deriveLogLevel upgrades Error:/Warning: text.
  logEntries = logEntries.map(entry => ({ ...entry, level: deriveLogLevel(entry) }));

  // Filter by logLevel
  if (logLevel !== "All") {
    const originalCount = logEntries.length;
    logEntries = logEntries.filter(entry => entry.level === logLevel);
    console.log(`[manage_backup_sessions:get_log] Filtered: ${logEntries.length}/${originalCount} (level: ${logLevel})`);
  }

  // No logs
  if (logEntries.length === 0) {
    const noLogsResponse = {
      summary: {
        message: logLevel === "All"
          ? "No logs available for this session"
          : `No logs with level "${logLevel}" found`,
        sessionId,
        sessionName: session.name,
        logLevel,
        count: 0,
        timestamp: new Date().toISOString()
      },
      info: {
        logSource,
        suggestions: [
          "Try logLevel='All' to see all logs",
          "Use veeam_search_backup_sessions to verify session state",
          "Check VBR console for complete logs"
        ]
      }
    };

    return createMCPResponse(addPerformanceMetrics(noLogsResponse, startTime));
  }

  // Process and enrich log entries
  const enrichedLogs = logEntries.map(entry => ({
    ...entry,
    timestampFormatted: entry.timestamp ? formatDateTime(entry.timestamp) : "N/A",
    messageFormatted: formatLogMessage(entry.message || entry.text, entry.level),
    severity: getLogSeverity(entry.level)
  }));

  // Analyze logs
  const analysis = analyzeLogEntries(enrichedLogs);

  // Build response
  const responseData = {
    summary: {
      message: `${enrichedLogs.length} log entry(ies)`,
      sessionId,
      sessionName: session.name,
      sessionType: session.sessionType,
      logLevel,
      count: enrichedLogs.length,
      logSource,
      timestamp: new Date().toISOString()
    },
    sessionInfo: {
      id: session.id,
      name: session.name,
      sessionType: session.sessionType,
      state: session.state,
      result: session.result?.result,
      resultMessage: session.result?.message || "N/A",
      creationTime: session.creationTime,
      creationTimeFormatted: formatDateTime(session.creationTime),
      endTime: session.endTime,
      endTimeFormatted: formatDateTime(session.endTime)
    },
    analysis,
    logs: enrichedLogs.map(entry => ({
      timestamp: entry.timestamp,
      timestampFormatted: entry.timestampFormatted,
      level: entry.level,
      severity: entry.severity,
      message: entry.message || entry.text,
      messageFormatted: entry.messageFormatted,
      component: entry.component || "N/A",
      code: entry.code || null
    }))
  };

  // Add troubleshooting if errors exist
  if (analysis.errorCount > 0) {
    responseData.troubleshooting = {
      errorCount: analysis.errorCount,
      topErrors: analysis.topErrors,
      recommendations: generateTroubleshootingRecommendations(analysis)
    };
  }

  // @MX:NOTE: Per-VM results (console "Statistics"). A job session has one task session per
  // VM, each with its own result + error message — this is how a multi-VM job surfaces a
  // distinct cause per VM (e.g. CRC on one vhdx). Best-effort: omitted if unavailable.
  try {
    const { host, port, token, apiVersion } = await ensureAuthenticated();
    const taskResults = await getTaskSessionResults({ host, port, token, apiVersion }, sessionId);
    if (taskResults && taskResults.length) {
      responseData.vmResults = taskResults;
    }
  } catch (trErr) {
    console.warn('[manage_backup_sessions:get_log] taskSessions enrichment failed:', trErr.message);
  }

  const enrichedResponse = enrichResponse(
    responseData,
    "veeam_manage_backup_sessions",
    { sessionId, logLevel, logSource, action: "get_log" }
  );

  return createMCPResponse(addPerformanceMetrics(enrichedResponse, startTime));
}

// ============================================================================
// Helper functions
// ============================================================================

function extractLogEntriesFromSession(sessionDetails) {
  const logFields = ['messages', 'logs', 'logEntries', 'events'];
  for (const field of logFields) {
    if (sessionDetails[field] && Array.isArray(sessionDetails[field])) {
      return sessionDetails[field];
    }
  }

  // Fallback: create basic entry from session result
  return [{
    timestamp: sessionDetails.endTime || sessionDetails.creationTime,
    level: sessionDetails.result?.result === 3 ? "Error" : "Info",
    message: sessionDetails.result?.message || "No log details available"
  }];
}

function getLogSeverity(level) {
  const severities = { "Debug": 0, "Info": 1, "Warning": 2, "Error": 3 };
  return severities[level] || 1;
}

function analyzeLogEntries(logs) {
  const analysis = {
    totalLogs: logs.length,
    byLevel: { Debug: 0, Info: 0, Warning: 0, Error: 0 },
    errorCount: 0,
    warningCount: 0,
    topErrors: []
  };

  const errorMessages = {};

  logs.forEach(entry => {
    const level = entry.level || "Info";
    if (Object.prototype.hasOwnProperty.call(analysis.byLevel, level)) {
      analysis.byLevel[level]++;
    }
    if (level === "Error") {
      analysis.errorCount++;
      const msg = entry.message || entry.text || "Unknown error";
      errorMessages[msg] = (errorMessages[msg] || 0) + 1;
    }
    if (level === "Warning") {
      analysis.warningCount++;
    }
  });

  analysis.topErrors = Object.entries(errorMessages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([message, count]) => ({ message, count }));

  return analysis;
}

function generateTroubleshootingRecommendations(analysis) {
  const recommendations = [];
  if (analysis.errorCount > 10) {
    recommendations.push("High error count detected. Investigate root causes.");
  }
  if (analysis.warningCount > 20) {
    recommendations.push("Many warnings. Review job configurations.");
  }
  if (analysis.topErrors.length > 0) {
    recommendations.push(`Most common error: "${analysis.topErrors[0].message}" (${analysis.topErrors[0].count}x)`);
  }
  if (recommendations.length === 0) {
    recommendations.push("Logs appear normal. Analyze specific messages for details.");
  }
  return recommendations;
}
