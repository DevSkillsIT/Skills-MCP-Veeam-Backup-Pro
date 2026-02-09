// tools/get-session-log-tool.js
// Tool para obter log detalhado de uma session (troubleshooting)
// Permite filtrar por nível de log (Info, Warning, Error)

import fetch from "node-fetch";
import https from "https";
import { z } from "zod";
import { ensureAuthenticated } from "../lib/auth-middleware.js";
import { validateSessionExists, validateVeeamId } from "../lib/validation-helpers.js";
import { formatDateTime, formatLogMessage } from "../lib/format-helpers.js";
import { enrichResponse, createMCPResponse, addPerformanceMetrics } from "../lib/response-enricher.js";

// HTTPS agent com suporte a certificados self-signed
const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.VEEAM_IGNORE_SSL === 'true'
});

export default function(server) {
  server.tool(
    "veeam_get_session_log",
    {
      sessionId: z.string().describe("ID da session para obter logs (UUID)"),
      logLevel: z.enum(["All", "Info", "Warning", "Error", "Debug"]).default("All").describe("Filtrar por nível de log (padrão: All)")
    },
    async (params) => {
      const startTime = Date.now();
      const { sessionId, logLevel = "All" } = params;

      try {
        // Validar formato do ID
        validateVeeamId(sessionId, "session");

        // Validar que session existe
        console.log(`[veeam_get_session_log] Validando session...`);
        const session = await validateSessionExists(sessionId);

        console.log(`[veeam_get_session_log] ✅ Session "${session.name}" validada`);

        // Autenticação
        const { host, port, token, apiVersion } = await ensureAuthenticated();

        // Tentar endpoint específico de log (se disponível)
        // Endpoint: GET /api/v1/sessions/{id}/log
        let logUrl = `https://${host}:${port}/api/v1/sessions/${sessionId}/log`;

        console.log(`[veeam_get_session_log] Tentando endpoint: ${logUrl}`);

        let response = await fetch(logUrl, {
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

        // Se endpoint /log não existir (404), usar fallback para session details
        if (!response.ok && response.status === 404) {
          console.log(`[veeam_get_session_log] Endpoint /log não disponível. Usando fallback (session details)`);
          logSource = "session-messages";

          // Fallback: GET /api/v1/sessions/{id} e extrair campo 'messages' ou 'logs'
          const sessionUrl = `https://${host}:${port}/api/v1/sessions/${sessionId}`;

          response = await fetch(sessionUrl, {
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
            throw new Error(
              `Falha ao buscar detalhes da session (HTTP ${response.status}): ${errorText}`
            );
          }

          const sessionDetails = await response.json();

          // Extrair mensagens do campo apropriado
          logEntries = extractLogEntriesFromSession(sessionDetails);

        } else if (!response.ok) {
          // Outro erro que não seja 404
          const errorText = await response.text();
          throw new Error(
            `Falha ao buscar logs da session (HTTP ${response.status}): ${errorText}`
          );

        } else {
          // Endpoint /log retornou sucesso
          const logData = await response.json();
          logEntries = logData.data || logData.logs || [];
        }

        console.log(`[veeam_get_session_log] Recebido: ${logEntries.length} entrada(s) de log`);

        // Filtrar por logLevel se especificado
        if (logLevel !== "All") {
          const originalCount = logEntries.length;
          logEntries = logEntries.filter(entry => entry.level === logLevel);
          console.log(`[veeam_get_session_log] Filtrado de ${originalCount} para ${logEntries.length} (level: ${logLevel})`);
        }

        // Verificar se há logs
        if (logEntries.length === 0) {
          const noLogsResponse = {
            summary: {
              message: logLevel === "All"
                ? "Nenhum log disponível para esta session"
                : `Nenhum log de nível "${logLevel}" encontrado`,
              sessionId: sessionId,
              sessionName: session.name,
              logLevel: logLevel,
              count: 0,
              timestamp: new Date().toISOString()
            },
            info: {
              note: logSource === "session-messages"
                ? "Logs extraídos do campo 'messages' da session (endpoint /log não disponível)"
                : "Endpoint /log usado",
              possibleReasons: [
                "Session não gerou logs deste nível",
                "Logs foram rotacionados ou limpos",
                "Session ainda não iniciou execução",
                "Retention de logs expirou"
              ],
              alternatives: [
                "Tente logLevel='All' para ver todos os logs",
                "Use veeam_list_backup_sessions para verificar estado da session",
                "Verifique VBR console para logs completos"
              ]
            }
          };

          return createMCPResponse(addPerformanceMetrics(noLogsResponse, startTime));
        }

        // Processar e enriquecer log entries
        const enrichedLogs = logEntries.map(entry => ({
          ...entry,
          timestampFormatted: entry.timestamp ? formatDateTime(entry.timestamp) : "N/A",
          messageFormatted: formatLogMessage(entry.message || entry.text, entry.level),
          severity: getLogSeverity(entry.level)
        }));

        // Análise de logs
        const analysis = analyzeLogEntries(enrichedLogs);

        // Construir resposta enriquecida
        const responseData = {
          summary: {
            message: `📋 ${enrichedLogs.length} entrada(s) de log`,
            sessionId: sessionId,
            sessionName: session.name,
            sessionType: session.sessionType,
            logLevel: logLevel,
            count: enrichedLogs.length,
            logSource: logSource,
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
          analysis: analysis,
          logs: enrichedLogs.map(entry => ({
            timestamp: entry.timestamp,
            timestampFormatted: entry.timestampFormatted,
            level: entry.level,
            severity: entry.severity,
            message: entry.message || entry.text,
            messageFormatted: entry.messageFormatted,
            // Campos adicionais se disponíveis
            component: entry.component || "N/A",
            code: entry.code || null
          }))
        };

        // Se há erros, adicionar troubleshooting
        if (analysis.errorCount > 0) {
          responseData.troubleshooting = {
            errorCount: analysis.errorCount,
            topErrors: analysis.topErrors,
            recommendations: generateTroubleshootingRecommendations(analysis)
          };
        }

        // Enriquecer resposta
        const enrichedResponse = enrichResponse(
          responseData,
          "veeam_get_session_log",
          {
            sessionId: sessionId,
            logLevel: logLevel,
            logSource: logSource
          }
        );

        return createMCPResponse(addPerformanceMetrics(enrichedResponse, startTime));

      } catch (error) {
        console.error('[veeam_get_session_log] Erro:', error);

        const errorResponse = {
          error: true,
          message: error.message,
          tool: "veeam_get_session_log",
          sessionId: sessionId,
          timestamp: new Date().toISOString(),
          troubleshooting: {
            tips: [
              "Verifique que o sessionId está correto (use veeam_list_backup_sessions)",
              "Confirme que a session existe e não expirou",
              "Use veeam_list_backup_sessions para listar sessions disponíveis",
              "Logs podem ter sido rotacionados (verificar retention)"
            ]
          }
        };

        return createMCPResponse(addPerformanceMetrics(errorResponse, startTime), true);
      }
    }
  );
}

/**
 * Extrai log entries do objeto session (fallback)
 */
function extractLogEntriesFromSession(sessionDetails) {
  // Possíveis campos onde logs podem estar
  const logFields = ['messages', 'logs', 'logEntries', 'events'];

  for (const field of logFields) {
    if (sessionDetails[field] && Array.isArray(sessionDetails[field])) {
      console.log(`[veeam_get_session_log] Logs encontrados no campo: ${field}`);
      return sessionDetails[field];
    }
  }

  // Se nenhum campo de log encontrado, criar entrada básica com resultado
  console.log(`[veeam_get_session_log] Nenhum campo de log encontrado. Usando resultado da session.`);

  return [{
    timestamp: sessionDetails.endTime || sessionDetails.creationTime,
    level: sessionDetails.result?.result === 3 ? "Error" : "Info",
    message: sessionDetails.result?.message || "Sem detalhes de log disponíveis"
  }];
}

/**
 * Obtém severidade numérica do nível de log
 */
function getLogSeverity(level) {
  const severities = {
    "Debug": 0,
    "Info": 1,
    "Warning": 2,
    "Error": 3
  };

  return severities[level] || 1;
}

/**
 * Analisa log entries para fornecer insights
 */
function analyzeLogEntries(logs) {
  const analysis = {
    totalLogs: logs.length,
    byLevel: {
      Debug: 0,
      Info: 0,
      Warning: 0,
      Error: 0
    },
    errorCount: 0,
    warningCount: 0,
    topErrors: []
  };

  const errorMessages = {};

  logs.forEach(entry => {
    const level = entry.level || "Info";

    // Contar por nível
    if (analysis.byLevel.hasOwnProperty(level)) {
      analysis.byLevel[level]++;
    }

    // Contar erros e warnings
    if (level === "Error") {
      analysis.errorCount++;

      // Agrupar erros por mensagem
      const msg = entry.message || entry.text || "Erro desconhecido";
      if (!errorMessages[msg]) {
        errorMessages[msg] = 0;
      }
      errorMessages[msg]++;
    }

    if (level === "Warning") {
      analysis.warningCount++;
    }
  });

  // Top 5 erros mais comuns
  analysis.topErrors = Object.entries(errorMessages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([message, count]) => ({ message, count }));

  return analysis;
}

/**
 * Gera recomendações de troubleshooting baseadas em análise de logs
 */
function generateTroubleshootingRecommendations(analysis) {
  const recommendations = [];

  if (analysis.errorCount > 10) {
    recommendations.push("Alto número de erros detectado. Investigue causas raiz.");
  }

  if (analysis.warningCount > 20) {
    recommendations.push("Muitos warnings. Revise configurações do job.");
  }

  if (analysis.topErrors.length > 0) {
    recommendations.push(`Erro mais comum: "${analysis.topErrors[0].message}" (${analysis.topErrors[0].count}x)`);
  }

  if (recommendations.length === 0) {
    recommendations.push("Logs parecem normais. Analise mensagens específicas para detalhes.");
  }

  return recommendations;
}
