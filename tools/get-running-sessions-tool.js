// tools/get-running-sessions-tool.js
// Tool para listar apenas sessions em execução (real-time monitoring)
// Útil para morning checks MSP e monitoramento em tempo real

import fetch from "node-fetch";
import https from "https";
import { z } from "zod";
import { ensureAuthenticated } from "../lib/auth-middleware.js";
import { enrichSessionData, calculateSessionStats, formatProgress } from "../lib/format-helpers.js";
import { enrichListResponse, createMCPResponse, addPerformanceMetrics } from "../lib/response-enricher.js";

// HTTPS agent com suporte a certificados self-signed
const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.VEEAM_IGNORE_SSL === 'true'
});

export default function(server) {
  server.tool(
    "get-running-sessions",
    {
      limit: z.number().min(1).max(1000).default(100).describe("Máximo de sessions a retornar (padrão: 100)")
    },
    async (params) => {
      const startTime = Date.now();

      try {
        // Autenticação automática via middleware
        const { host, port, token, apiVersion } = await ensureAuthenticated();
        const { limit = 100 } = params;

        // Endpoint: GET /api/v1/sessions com filtro stateFilter=Working (state=3)
        const queryParams = new URLSearchParams({
          limit: limit.toString(),
          skip: '0',
          stateFilter: 'Working' // Apenas sessions em execução (state=3)
        });

        const apiUrl = `https://${host}:${port}/api/v1/sessions?${queryParams.toString()}`;
        console.log(`[get-running-sessions] Buscando sessions em execução: ${apiUrl}`);

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
          throw new Error(
            `Falha ao buscar sessions em execução (HTTP ${response.status}): ${errorText}`
          );
        }

        const sessionsData = await response.json();
        console.log(`[get-running-sessions] Recebido: ${sessionsData.data?.length || 0} sessions`);

        // Verificar se há sessions em execução
        if (!sessionsData.data || sessionsData.data.length === 0) {
          const noSessionsResponse = {
            summary: {
              message: "Nenhuma session em execução no momento",
              count: 0,
              total: 0,
              timestamp: new Date().toISOString()
            },
            info: {
              stateFilter: "Working (state=3)",
              meaning: "Isso significa que nenhum backup está rodando agora",
              possibleReasons: [
                "Todos os jobs foram concluídos",
                "Jobs estão agendados para horários futuros",
                "Nenhum job foi iniciado manualmente",
                "Jobs podem estar parados ou desabilitados"
              ],
              nextSteps: [
                "Use get-backup-sessions para ver histórico completo",
                "Use get-backup-jobs para verificar configuração de jobs",
                "Verifique schedules dos jobs com get-job-schedule"
              ]
            }
          };

          const enrichedResponse = enrichListResponse(
            [],
            "get-running-sessions",
            { stateFilter: "Working" },
            { limit, skip: 0, total: 0 }
          );

          const finalResponse = {
            ...noSessionsResponse,
            ...enrichedResponse
          };

          return createMCPResponse(addPerformanceMetrics(finalResponse, startTime));
        }

        // Enriquecer cada session com formatação
        const enrichedSessions = sessionsData.data.map(session => enrichSessionData(session));

        // Calcular estatísticas agregadas
        const stats = calculateSessionStats(enrichedSessions);

        // Calcular progresso médio estimado
        const totalProgress = enrichedSessions.reduce((sum, s) => sum + (s.progressPercent || 0), 0);
        const averageProgress = enrichedSessions.length > 0
          ? totalProgress / enrichedSessions.length
          : 0;

        // Calcular tempo estimado restante (heurística simples)
        // Assumindo que sessions progridem linearmente (simplificação)
        const estimatedTimeRemaining = calculateEstimatedTime(enrichedSessions);

        // Agrupar por tipo de job
        const sessionsByType = {};
        enrichedSessions.forEach(session => {
          const type = session.sessionType || 'Unknown';
          if (!sessionsByType[type]) {
            sessionsByType[type] = [];
          }
          sessionsByType[type].push(session);
        });

        // Construir resposta enriquecida
        const responseData = {
          summary: {
            message: `${enrichedSessions.length} session(s) em execução no momento`,
            count: enrichedSessions.length,
            averageProgress: `${averageProgress.toFixed(2)}%`,
            averageProgressFormatted: formatProgress(averageProgress),
            estimatedTimeRemaining: estimatedTimeRemaining,
            timestamp: new Date().toISOString()
          },
          statistics: {
            totalSessions: enrichedSessions.length,
            byType: Object.keys(sessionsByType).map(type => ({
              type,
              count: sessionsByType[type].length,
              sessions: sessionsByType[type].map(s => s.name)
            })),
            ...stats
          },
          sessions: enrichedSessions.map(session => ({
            id: session.id,
            name: session.name,
            sessionType: session.sessionType,
            platformName: session.platformName,
            state: session.state,
            stateFormatted: session.stateFormatted,
            progressPercent: session.progressPercent,
            progressFormatted: session.progressFormatted,
            creationTime: session.creationTime,
            creationTimeFormatted: session.creationTimeFormatted,
            duration: session.durationFormatted,
            result: session.result?.result,
            resultFormatted: session.resultFormatted,
            message: session.result?.message || "Em execução..."
          }))
        };

        // Aplicar enriquecimento de lista
        const enrichedResponse = enrichListResponse(
          responseData.sessions,
          "get-running-sessions",
          { stateFilter: "Working" },
          sessionsData.pagination
        );

        const finalResponse = {
          ...responseData,
          pagination: enrichedResponse.pagination,
          _metadata: enrichedResponse._metadata
        };

        return createMCPResponse(addPerformanceMetrics(finalResponse, startTime));

      } catch (error) {
        console.error('[get-running-sessions] Erro:', error);

        const errorResponse = {
          error: true,
          message: error.message,
          tool: "get-running-sessions",
          timestamp: new Date().toISOString(),
          troubleshooting: {
            tips: [
              "Verifique conectividade com o VBR server",
              "Confirme que credenciais estão corretas no .env",
              "Use get-backup-sessions para debug (sem filtros)"
            ]
          }
        };

        return createMCPResponse(addPerformanceMetrics(errorResponse, startTime), true);
      }
    }
  );
}

/**
 * Calcula tempo estimado restante (heurística simplificada)
 * @param {Array} sessions - Array de sessions
 * @returns {string} Tempo estimado formatado
 */
function calculateEstimatedTime(sessions) {
  // Filtrar apenas sessions com progresso > 0
  const sessionsWithProgress = sessions.filter(s => s.progressPercent > 0);

  if (sessionsWithProgress.length === 0) {
    return "Calculando... (progresso inicial)";
  }

  // Calcular tempo médio decorrido por %
  let totalTimePerPercent = 0;
  let validSessions = 0;

  sessionsWithProgress.forEach(session => {
    if (session.creationTime && session.progressPercent > 0) {
      const elapsed = Date.now() - new Date(session.creationTime).getTime();
      const timePerPercent = elapsed / session.progressPercent;
      totalTimePerPercent += timePerPercent;
      validSessions++;
    }
  });

  if (validSessions === 0) {
    return "N/A";
  }

  const avgTimePerPercent = totalTimePerPercent / validSessions;

  // Calcular tempo restante médio
  const avgProgress = sessionsWithProgress.reduce((sum, s) => sum + s.progressPercent, 0) / sessionsWithProgress.length;
  const remainingPercent = 100 - avgProgress;
  const estimatedMs = remainingPercent * avgTimePerPercent;

  // Formatar
  const minutes = Math.floor(estimatedMs / 60000);
  if (minutes < 60) {
    return `~${minutes} minutos`;
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `~${hours}h ${mins}m`;
}
