// tools/get-running-backup-jobs-tool.js
// Tool para listar APENAS backup jobs em execução (exclui system tasks)
// Filtra automaticamente para mostrar apenas BackupJob, ReplicaJob, BackupCopyJob
//
// DIFERENÇA com veeam_list_running_sessions:
// - veeam_list_running_sessions: Retorna TUDO (backup jobs + system tasks)
// - veeam_list_running_backup_jobs: Retorna APENAS backup jobs (exclui MalwareDetection, SureBackup, etc)

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
  formatSessionType
} from "../lib/format-helpers.js";
import { BACKUP_JOB_SESSION_TYPES } from "../lib/veeam-dictionaries.js";
import { enrichListResponse, createMCPResponse, addPerformanceMetrics } from "../lib/response-enricher.js";

// HTTPS agent com suporte a certificados self-signed
const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.VEEAM_IGNORE_SSL === 'true'
});

export default function(server) {
  server.tool(
    "veeam_list_running_backup_jobs",
    {
      limit: z.number().min(1).max(1000).default(100).describe("Máximo de backup jobs a retornar (padrão: 100)")
    },
    async (params) => {
      const startTime = Date.now();

      try {
        // Autenticação automática via middleware
        const { host, port, token, apiVersion } = await ensureAuthenticated();
        const { limit = 100 } = params;

        // Endpoint: GET /api/v1/sessions com filtro stateFilter=Working
        // NOTA: Buscar todas as sessions e filtrar manualmente, pois a API Veeam
        // não suporta múltiplos valores no typeFilter separados por vírgula
        const queryParams = new URLSearchParams({
          limit: (limit * 2).toString(),  // Buscar mais para compensar filtro manual
          skip: '0',
          stateFilter: 'Working'
          // Sem typeFilter - filtrar manualmente após busca
        });

        const apiUrl = `https://${host}:${port}/api/v1/sessions?${queryParams.toString()}`;
        console.log(`[veeam_list_running_backup_jobs] Buscando backup jobs em execução: ${apiUrl}`);

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
            `Falha ao buscar backup jobs em execução (HTTP ${response.status}): ${errorText}`
          );
        }

        const sessionsData = await response.json();
        console.log(`[veeam_list_running_backup_jobs] Recebido ${sessionsData.data?.length || 0} sessions da API`);

        // ═══════════════════════════════════════════════════════════════
        // FILTRO MANUAL: Remover system tasks, manter apenas backup jobs
        // ═══════════════════════════════════════════════════════════════
        const allSessions = sessionsData.data || [];
        const backupJobsSessions = allSessions.filter(session =>
          BACKUP_JOB_SESSION_TYPES.includes(session.sessionType)
        );

        console.log(`[veeam_list_running_backup_jobs] Filtrado: ${backupJobsSessions.length} backup jobs de ${allSessions.length} sessions totais`);

        // Substituir array original com apenas backup jobs
        sessionsData.data = backupJobsSessions;

        // Verificar se há backup jobs em execução
        if (!sessionsData.data || sessionsData.data.length === 0) {
          const noBackupJobsResponse = {
            summary: {
              message: "Nenhum backup job em execução no momento",
              count: 0,
              total: 0,
              timestamp: new Date().toISOString()
            },
            info: {
              stateFilter: "Working (state=3)",
              typeFilter: `Apenas backup jobs: ${BACKUP_JOB_SESSION_TYPES.join(', ')}`,
              meaning: "Nenhum backup real está rodando agora",
              note: "System tasks (MalwareDetection, SureBackup, etc) não aparecem aqui - use veeam_list_running_sessions para ver tudo",
              possibleReasons: [
                "Todos os backups foram concluídos",
                "Backups estão agendados para horários futuros",
                "Nenhum backup foi iniciado manualmente",
                "Backups podem estar parados ou desabilitados",
                "Pode haver apenas system tasks rodando (use veeam_list_running_sessions para ver)"
              ],
              nextSteps: [
                "Use veeam_list_running_sessions para ver se há system tasks rodando",
                "Use veeam_list_backup_sessions para ver histórico completo",
                "Use veeam_list_backup_jobs para verificar configuração de jobs",
                "Verifique schedules dos jobs com veeam_get_backup_job_schedule"
              ]
            }
          };

          const enrichedResponse = enrichListResponse(
            [],
            "veeam_list_running_backup_jobs",
            { stateFilter: "Working", typeFilter: `Manual filter: ${BACKUP_JOB_SESSION_TYPES.join(', ')}` },
            { limit, skip: 0, total: 0 }
          );

          const finalResponse = {
            ...noBackupJobsResponse,
            ...enrichedResponse
          };

          return createMCPResponse(addPerformanceMetrics(finalResponse, startTime));
        }

        // Enriquecer cada backup job com formatação e categorização
        const enrichedBackupJobs = sessionsData.data.map(session => {
          const enriched = enrichSessionData(session);
          const categorization = categorizeSessionType(session.sessionType);

          return {
            ...enriched,
            sessionTypeFormatted: formatSessionType(session.sessionType),
            category: categorization.category,
            categoryFormatted: categorization.categoryFormatted,
            isBackupJob: true,  // Sempre true nesta tool
            isSystemTask: false,  // Sempre false nesta tool
            icon: categorization.icon
          };
        });

        // Calcular estatísticas agregadas
        const stats = calculateSessionStats(enrichedBackupJobs);

        // Calcular progresso médio estimado
        const totalProgress = enrichedBackupJobs.reduce((sum, s) => sum + (s.progressPercent || 0), 0);
        const averageProgress = enrichedBackupJobs.length > 0
          ? totalProgress / enrichedBackupJobs.length
          : 0;

        // Calcular tempo estimado restante
        const estimatedTimeRemaining = calculateEstimatedTime(enrichedBackupJobs);

        // Agrupar por tipo específico
        const jobsByType = {};
        enrichedBackupJobs.forEach(job => {
          const type = job.sessionType || 'Unknown';
          if (!jobsByType[type]) {
            jobsByType[type] = [];
          }
          jobsByType[type].push(job);
        });

        // Construir resposta enriquecida
        const responseData = {
          summary: {
            message: `${enrichedBackupJobs.length} backup job(s) em execução no momento`,
            count: enrichedBackupJobs.length,
            averageProgress: `${averageProgress.toFixed(2)}%`,
            averageProgressFormatted: formatProgress(averageProgress),
            estimatedTimeRemaining: estimatedTimeRemaining,
            timestamp: new Date().toISOString(),
            note: "Esta tool mostra APENAS backup jobs. System tasks (MalwareDetection, SureBackup) não aparecem aqui."
          },
          statistics: {
            totalBackupJobs: enrichedBackupJobs.length,
            byType: Object.keys(jobsByType).map(type => ({
              type,
              typeFormatted: formatSessionType(type),
              count: jobsByType[type].length,
              jobs: jobsByType[type].map(j => j.name)
            })),
            ...stats
          },
          backupJobs: enrichedBackupJobs.map(job => ({
            id: job.id,
            name: job.name,
            sessionType: job.sessionType,
            sessionTypeFormatted: job.sessionTypeFormatted,
            category: job.category,
            categoryFormatted: job.categoryFormatted,
            platformName: job.platformName,
            state: job.state,
            stateFormatted: job.stateFormatted,
            progressPercent: job.progressPercent,
            progressFormatted: job.progressFormatted,
            creationTime: job.creationTime,
            creationTimeFormatted: job.creationTimeFormatted,
            duration: job.durationFormatted,
            result: job.result?.result,
            resultFormatted: job.resultFormatted,
            message: job.result?.message || "Em execução...",
            icon: job.icon
          }))
        };

        // Aplicar enriquecimento de lista
        const enrichedResponse = enrichListResponse(
          responseData.backupJobs,
          "veeam_list_running_backup_jobs",
          { stateFilter: "Working", typeFilter: typeFilter },
          sessionsData.pagination
        );

        const finalResponse = {
          ...responseData,
          pagination: enrichedResponse.pagination,
          _metadata: enrichedResponse._metadata
        };

        return createMCPResponse(addPerformanceMetrics(finalResponse, startTime));

      } catch (error) {
        console.error('[veeam_list_running_backup_jobs] Erro:', error);

        const errorResponse = {
          error: true,
          message: error.message,
          tool: "veeam_list_running_backup_jobs",
          timestamp: new Date().toISOString(),
          troubleshooting: {
            tips: [
              "Verifique conectividade com o VBR server",
              "Confirme que credenciais estão corretas no .env",
              "Use veeam_list_running_sessions para ver todas as sessions (incluindo system tasks)"
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
 * @param {Array} jobs - Array de backup jobs
 * @returns {string} Tempo estimado formatado
 */
function calculateEstimatedTime(jobs) {
  // Filtrar apenas jobs com progresso > 0
  const jobsWithProgress = jobs.filter(j => j.progressPercent > 0);

  if (jobsWithProgress.length === 0) {
    return "Calculando... (progresso inicial)";
  }

  // Calcular tempo médio decorrido por %
  let totalTimePerPercent = 0;
  let validJobs = 0;

  jobsWithProgress.forEach(job => {
    if (job.creationTime && job.progressPercent > 0) {
      const elapsed = Date.now() - new Date(job.creationTime).getTime();
      const timePerPercent = elapsed / job.progressPercent;
      totalTimePerPercent += timePerPercent;
      validJobs++;
    }
  });

  if (validJobs === 0) {
    return "N/A";
  }

  const avgTimePerPercent = totalTimePerPercent / validJobs;

  // Calcular tempo restante médio
  const avgProgress = jobsWithProgress.reduce((sum, j) => sum + j.progressPercent, 0) / jobsWithProgress.length;
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
