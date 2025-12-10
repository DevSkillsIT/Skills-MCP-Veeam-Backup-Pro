// tools/get-failed-sessions-tool.js
// Tool para listar sessions que falharam (para morning checklist MSP)
// Permite filtrar por período (últimas X horas)

import fetch from "node-fetch";
import https from "https";
import { z } from "zod";
import { ensureAuthenticated } from "../lib/auth-middleware.js";
import { enrichSessionData, formatDateTime } from "../lib/format-helpers.js";
import { enrichListResponse, createMCPResponse, addPerformanceMetrics, addTroubleshootingTips } from "../lib/response-enricher.js";

// HTTPS agent com suporte a certificados self-signed
const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.VEEAM_IGNORE_SSL === 'true'
});

export default function(server) {
  server.tool(
    "get-failed-sessions",
    {
      limit: z.number().min(1).max(1000).default(100).describe("Máximo de sessions a retornar (padrão: 100)"),
      hours: z.number().min(1).max(168).optional().describe("Filtrar por últimas X horas (opcional, max: 168h = 7 dias)")
    },
    async (params) => {
      const startTime = Date.now();

      try {
        // Autenticação automática via middleware
        const { host, port, token, apiVersion } = await ensureAuthenticated();
        const { limit = 100, hours } = params;

        // Endpoint: GET /api/v1/sessions com filtro resultFilter=Failed (result=3)
        const queryParams = new URLSearchParams({
          limit: limit.toString(),
          skip: '0',
          resultFilter: 'Failed' // Apenas sessions que falharam (result=3)
        });

        const apiUrl = `https://${host}:${port}/api/v1/sessions?${queryParams.toString()}`;
        console.log(`[get-failed-sessions] Buscando sessions falhadas: ${apiUrl}`);

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
            `Falha ao buscar sessions falhadas (HTTP ${response.status}): ${errorText}`
          );
        }

        const sessionsData = await response.json();
        console.log(`[get-failed-sessions] Recebido: ${sessionsData.data?.length || 0} sessions`);

        // Enriquecer cada session
        let enrichedSessions = sessionsData.data ? sessionsData.data.map(session => enrichSessionData(session)) : [];

        // Filtrar por período se especificado
        if (hours && hours > 0) {
          const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
          console.log(`[get-failed-sessions] Filtrando por últimas ${hours}h (desde ${formatDateTime(cutoffTime.toISOString())})`);

          enrichedSessions = enrichedSessions.filter(session => {
            if (!session.creationTime) {
              return false;
            }
            const sessionTime = new Date(session.creationTime);
            return sessionTime >= cutoffTime;
          });

          console.log(`[get-failed-sessions] Após filtro de tempo: ${enrichedSessions.length} sessions`);
        }

        // Verificar se há sessions falhadas
        if (enrichedSessions.length === 0) {
          const timeRangeMsg = hours
            ? ` nas últimas ${hours} horas`
            : "";

          const noFailuresResponse = {
            summary: {
              message: `✅ Nenhuma session falhada${timeRangeMsg}`,
              count: 0,
              total: sessionsData.pagination?.total || 0,
              timeRange: hours ? `Últimas ${hours} horas` : "Sem filtro de tempo",
              timestamp: new Date().toISOString()
            },
            info: {
              resultFilter: "Failed (result=3)",
              meaning: "Isso é uma boa notícia! Não há falhas recentes.",
              possibleReasons: [
                "Todos os backups estão funcionando corretamente",
                "Problemas anteriores foram resolvidos",
                "Jobs estão configurados corretamente"
              ],
              nextSteps: [
                "Verifique sessions com warnings: get-backup-sessions com resultFilter=Warning",
                "Monitore sessions em execução: get-running-sessions",
                "Revise configuração de jobs: get-backup-jobs"
              ]
            }
          };

          const enrichedResponse = enrichListResponse(
            [],
            "get-failed-sessions",
            { resultFilter: "Failed", hours: hours || null },
            { limit, skip: 0, total: 0 }
          );

          const finalResponse = {
            ...noFailuresResponse,
            ...enrichedResponse
          };

          return createMCPResponse(addPerformanceMetrics(finalResponse, startTime));
        }

        // Agrupar por tipo de job
        const sessionsByType = {};
        enrichedSessions.forEach(session => {
          const type = session.sessionType || 'Unknown';
          if (!sessionsByType[type]) {
            sessionsByType[type] = {
              count: 0,
              sessions: []
            };
          }
          sessionsByType[type].count++;
          sessionsByType[type].sessions.push({
            name: session.name,
            creationTime: session.creationTimeFormatted,
            message: session.result?.message || "Sem detalhes"
          });
        });

        // Agrupar por mensagem de erro (top 5 erros)
        const errorMessages = {};
        enrichedSessions.forEach(session => {
          const msg = session.result?.message || "Erro desconhecido";
          if (!errorMessages[msg]) {
            errorMessages[msg] = {
              count: 0,
              sessions: []
            };
          }
          errorMessages[msg].count++;
          errorMessages[msg].sessions.push(session.name);
        });

        const topErrors = Object.entries(errorMessages)
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 5)
          .map(([message, data]) => ({
            message,
            count: data.count,
            affectedSessions: data.sessions.slice(0, 3), // Primeiras 3 sessions
            hasMore: data.sessions.length > 3
          }));

        // Construir resposta enriquecida
        const responseData = {
          summary: {
            message: `❌ ${enrichedSessions.length} session(s) falhada(s) encontrada(s)`,
            count: enrichedSessions.length,
            total: sessionsData.pagination?.total || enrichedSessions.length,
            timeRange: hours ? `Últimas ${hours} horas` : "Sem filtro de tempo",
            severity: enrichedSessions.length > 10 ? "CRÍTICO" : (enrichedSessions.length > 5 ? "ALTO" : "MÉDIO"),
            timestamp: new Date().toISOString()
          },
          analysis: {
            byType: sessionsByType,
            topErrors: topErrors,
            oldestFailure: enrichedSessions.length > 0
              ? enrichedSessions.reduce((oldest, s) => {
                  const sTime = new Date(s.creationTime);
                  const oTime = new Date(oldest.creationTime);
                  return sTime < oTime ? s : oldest;
                }).creationTimeFormatted
              : "N/A",
            newestFailure: enrichedSessions.length > 0
              ? enrichedSessions.reduce((newest, s) => {
                  const sTime = new Date(s.creationTime);
                  const nTime = new Date(newest.creationTime);
                  return sTime > nTime ? s : newest;
                }).creationTimeFormatted
              : "N/A"
          },
          sessions: enrichedSessions.map(session => ({
            id: session.id,
            name: session.name,
            sessionType: session.sessionType,
            platformName: session.platformName,
            creationTime: session.creationTime,
            creationTimeFormatted: session.creationTimeFormatted,
            endTime: session.endTime,
            endTimeFormatted: session.endTimeFormatted,
            duration: session.durationFormatted,
            result: session.result?.result,
            resultFormatted: session.resultFormatted,
            errorMessage: session.result?.message || "Sem detalhes de erro",
            // Campos úteis para troubleshooting
            state: session.state,
            stateFormatted: session.stateFormatted
          }))
        };

        // Aplicar enriquecimento de lista
        const enrichedResponse = enrichListResponse(
          responseData.sessions,
          "get-failed-sessions",
          { resultFilter: "Failed", hours: hours || null },
          sessionsData.pagination
        );

        // Adicionar dicas de troubleshooting
        const troubleshootingTips = [
          "Verifique logs detalhados de cada session com get-session-log",
          "Analise padrões nos top erros para identificar problemas comuns",
          "Confirme que repositórios têm espaço suficiente",
          "Verifique conectividade de rede com VMs/hosts de origem",
          "Revise configurações de jobs que falharam repetidamente",
          "Para erros de snapshot: verifique VMware Tools nas VMs"
        ];

        const finalResponse = addTroubleshootingTips(
          {
            ...responseData,
            pagination: enrichedResponse.pagination,
            _metadata: enrichedResponse._metadata
          },
          troubleshootingTips
        );

        return createMCPResponse(addPerformanceMetrics(finalResponse, startTime));

      } catch (error) {
        console.error('[get-failed-sessions] Erro:', error);

        const errorResponse = {
          error: true,
          message: error.message,
          tool: "get-failed-sessions",
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
