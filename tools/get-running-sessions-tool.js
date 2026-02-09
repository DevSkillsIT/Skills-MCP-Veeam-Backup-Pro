// tools/get-running-sessions-tool.js
// Tool para listar apenas sessions em execução (real-time monitoring)
// Útil para morning checks MSP e monitoramento em tempo real

import fetch from "node-fetch";
import https from "https";
import { z } from "zod";
import { ensureAuthenticated } from "../lib/auth-middleware.js";
import {
  enrichSessionData,
  calculateSessionStats,
  formatProgress,
  categorizeSessionType,
  isBackupJob,
  isSystemTask,
  formatSessionType
} from "../lib/format-helpers.js";
import { enrichListResponse, createMCPResponse, addPerformanceMetrics } from "../lib/response-enricher.js";

// HTTPS agent com suporte a certificados self-signed
const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.VEEAM_IGNORE_SSL === 'true'
});

export default function(server) {
  server.tool(
    "veeam_list_running_sessions",
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
        console.log(`[veeam_list_running_sessions] Buscando sessions em execução: ${apiUrl}`);

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
        console.log(`[veeam_list_running_sessions] Recebido: ${sessionsData.data?.length || 0} sessions`);

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
                "Use veeam_list_backup_sessions para ver histórico completo",
                "Use veeam_list_backup_jobs para verificar configuração de jobs",
                "Verifique schedules dos jobs com veeam_get_backup_job_schedule"
              ]
            }
          };

          const enrichedResponse = enrichListResponse(
            [],
            "veeam_list_running_sessions",
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

        // ═══════════════════════════════════════════════════════════════
        // CATEGORIZAÇÃO: Separar Backup Jobs de System Tasks
        // ═══════════════════════════════════════════════════════════════
        const backupJobs = [];
        const systemTasks = [];

        enrichedSessions.forEach(session => {
          const categorization = categorizeSessionType(session.sessionType);

          // Enriquecer session com categorização
          const categorizedSession = {
            id: session.id,
            jobId: session.jobId || null, // ← NOVO: ID do job (configuração)
            name: session.name,
            sessionType: session.sessionType,
            sessionTypeFormatted: formatSessionType(session.sessionType),
            category: categorization.category,
            categoryFormatted: categorization.categoryFormatted,
            isBackupJob: categorization.isBackupJob,
            isSystemTask: categorization.isSystemTask,
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
            message: session.result?.message || "Em execução...",
            icon: categorization.icon
          };

          // Adicionar no array correto
          if (categorization.isBackupJob) {
            backupJobs.push(categorizedSession);
          } else {
            systemTasks.push(categorizedSession);
          }
        });

        // Agrupar por tipo de job (para estatísticas)
        const sessionsByType = {};
        enrichedSessions.forEach(session => {
          const type = session.sessionType || 'Unknown';
          if (!sessionsByType[type]) {
            sessionsByType[type] = [];
          }
          sessionsByType[type].push(session);
        });

        // Construir resposta enriquecida com categorização
        const responseData = {
          summary: {
            message: `${backupJobs.length} backup job(s) e ${systemTasks.length} system task(s) em execução`,
            total: enrichedSessions.length,
            backupJobsCount: backupJobs.length,
            systemTasksCount: systemTasks.length,
            averageProgress: `${averageProgress.toFixed(2)}%`,
            averageProgressFormatted: formatProgress(averageProgress),
            estimatedTimeRemaining: estimatedTimeRemaining,
            timestamp: new Date().toISOString(),
            // Explicação clara para usuário
            explanation: {
              backupJobs: "Backups reais (BackupJob, ReplicaJob, BackupCopyJob) - são trabalhos de backup/replicação",
              systemTasks: "Tarefas de sistema (MalwareDetection, SureBackup, etc) - manutenção e segurança, NÃO são backups"
            }
          },
          // Separar categorias na raiz da resposta
          backupJobs: backupJobs,
          systemTasks: systemTasks,
          statistics: {
            totalSessions: enrichedSessions.length,
            byCategory: {
              backupJobs: backupJobs.length,
              systemTasks: systemTasks.length
            },
            byType: Object.keys(sessionsByType).map(type => ({
              type,
              typeFormatted: formatSessionType(type),
              count: sessionsByType[type].length,
              sessions: sessionsByType[type].map(s => s.name)
            })),
            ...stats
          },
          // Lista completa (para compatibilidade com código existente)
          sessions: enrichedSessions.map(session => {
            const categorization = categorizeSessionType(session.sessionType);
            return {
              id: session.id,
              jobId: session.jobId || null, // ← NOVO: ID do job (configuração)
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
              duration: session.durationFormatted,
              result: session.result?.result,
              resultFormatted: session.resultFormatted,
              message: session.result?.message || "Em execução..."
            };
          })
        };

        // Aplicar enriquecimento de lista
        const enrichedResponse = enrichListResponse(
          responseData.sessions,
          "veeam_list_running_sessions",
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
        console.error('[veeam_list_running_sessions] Erro:', error);

        const errorResponse = {
          error: true,
          message: error.message,
          tool: "veeam_list_running_sessions",
          timestamp: new Date().toISOString(),
          troubleshooting: {
            tips: [
              "Verifique conectividade com o VBR server",
              "Confirme que credenciais estão corretas no .env",
              "Use veeam_list_backup_sessions para debug (sem filtros)"
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
