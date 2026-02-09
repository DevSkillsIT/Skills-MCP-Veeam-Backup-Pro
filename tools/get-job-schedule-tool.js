// tools/get-job-schedule-tool.js
// Tool para obter detalhes de scheduling de um job
// Útil para verificar quando jobs irão executar e como estão configurados

import fetch from "node-fetch";
import https from "https";
import { z } from "zod";
import { ensureAuthenticated } from "../lib/auth-middleware.js";
import { validateVeeamId } from "../lib/validation-helpers.js";
import { formatDateTime } from "../lib/format-helpers.js";
import { enrichResponse, createMCPResponse, addPerformanceMetrics } from "../lib/response-enricher.js";

// HTTPS agent com suporte a certificados self-signed
const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.VEEAM_IGNORE_SSL === 'true'
});

export default function(server) {
  server.tool(
    "veeam_get_backup_job_schedule",
    {
      jobId: z.string().describe("ID do job para obter schedule (UUID)")
    },
    async (params) => {
      const startTime = Date.now();
      const { jobId } = params;

      try {
        // Validar formato do ID
        validateVeeamId(jobId, "job");

        // Autenticação
        const { host, port, token, apiVersion } = await ensureAuthenticated();

        console.log(`[veeam_get_backup_job_schedule] Buscando detalhes do job: ${jobId}`);

        // Endpoint: GET /api/v1/jobs/{id}
        const apiUrl = `https://${host}:${port}/api/v1/jobs/${jobId}`;

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
            throw new Error(
              `Job com ID "${jobId}" não encontrado.\n` +
              `Verifique:\n` +
              `- Se o ID está correto (use veeam_list_backup_jobs)\n` +
              `- Se você tem permissão para visualizar este job\n` +
              `- Se o job não foi excluído recentemente`
            );
          }

          const errorText = await response.text();
          throw new Error(`Falha ao buscar job (HTTP ${response.status}): ${errorText}`);
        }

        const jobData = await response.json();
        console.log(`[veeam_get_backup_job_schedule] Job encontrado: "${jobData.name}"`);

        // Extrair informações de scheduling
        const scheduleInfo = extractScheduleInfo(jobData);

        // Construir resposta enriquecida
        const responseData = {
          summary: {
            message: `📅 Schedule do job "${jobData.name}"`,
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

        // Adicionar recomendações baseadas no schedule
        responseData.recommendations = generateScheduleRecommendations(jobData, scheduleInfo);

        // Enriquecer resposta
        const enrichedResponse = enrichResponse(
          responseData,
          "veeam_get_backup_job_schedule",
          {
            jobId: jobData.id,
            scheduleType: jobData.scheduleType
          }
        );

        return createMCPResponse(addPerformanceMetrics(enrichedResponse, startTime));

      } catch (error) {
        console.error('[veeam_get_backup_job_schedule] Erro:', error);

        const errorResponse = {
          error: true,
          message: error.message,
          tool: "veeam_get_backup_job_schedule",
          jobId: jobId,
          timestamp: new Date().toISOString(),
          troubleshooting: {
            tips: [
              "Verifique que o jobId está correto (use veeam_list_backup_jobs)",
              "Confirme que você tem permissão para visualizar o job",
              "Use veeam_list_backup_jobs para listar todos os jobs disponíveis"
            ]
          }
        };

        return createMCPResponse(addPerformanceMetrics(errorResponse, startTime), true);
      }
    }
  );
}

/**
 * Extrai informações de scheduling do job
 */
function extractScheduleInfo(jobData) {
  const scheduleInfo = {
    enabled: jobData.scheduleEnabled || false,
    type: jobData.scheduleType || "None",
    typeDescription: getScheduleTypeDescription(jobData.scheduleType)
  };

  // Se scheduling não está habilitado
  if (!jobData.scheduleEnabled) {
    scheduleInfo.note = "Schedule desabilitado. Job só pode ser executado manualmente.";
    return scheduleInfo;
  }

  // Parsing específico por tipo de schedule
  switch (jobData.scheduleType) {
    case "Daily":
      scheduleInfo.pattern = parseDailySchedule(jobData);
      break;

    case "Monthly":
      scheduleInfo.pattern = parseMonthlySchedule(jobData);
      break;

    case "Periodically":
      scheduleInfo.pattern = parsePeriodicallySchedule(jobData);
      break;

    case "Continuously":
      scheduleInfo.pattern = parseContinuouslySchedule(jobData);
      break;

    case "AfterJob":
      scheduleInfo.pattern = parseAfterJobSchedule(jobData);
      break;

    case "AfterNewSnapshot":
      scheduleInfo.pattern = parseAfterSnapshotSchedule(jobData);
      break;

    default:
      scheduleInfo.pattern = "Schedule pattern não disponível para este tipo";
  }

  // Retry configuration
  scheduleInfo.retry = {
    enabled: jobData.retryCount > 0,
    count: jobData.retryCount || 0,
    waitMinutes: jobData.retryWait || 0,
    description: jobData.retryCount > 0
      ? `${jobData.retryCount} tentativa(s), aguardar ${jobData.retryWait || 0} minutos entre tentativas`
      : "Sem retry configurado"
  };

  return scheduleInfo;
}

/**
 * Retorna descrição do tipo de schedule
 */
function getScheduleTypeDescription(scheduleType) {
  const descriptions = {
    "None": "Sem agendamento (execução manual apenas)",
    "Daily": "Agendamento diário em horários específicos",
    "Monthly": "Agendamento mensal em dias específicos",
    "Periodically": "Agendamento periódico (a cada X horas)",
    "Continuously": "Modo contínuo (CDP-like, executa constantemente)",
    "AfterJob": "Executar após conclusão de outro job",
    "AfterNewSnapshot": "Executar após novo snapshot ser detectado"
  };

  return descriptions[scheduleType] || "Tipo de schedule desconhecido";
}

/**
 * Parse de Daily schedule
 */
function parseDailySchedule(jobData) {
  // Nota: Estrutura exata depende da API do VBR
  // Aqui é uma aproximação baseada em documentação comum

  return {
    frequency: "Diário",
    time: jobData.scheduleOptions?.dailyTime || "Não especificado",
    days: jobData.scheduleOptions?.days || "Todos os dias",
    note: "Executa todos os dias no horário configurado"
  };
}

/**
 * Parse de Monthly schedule
 */
function parseMonthlySchedule(jobData) {
  return {
    frequency: "Mensal",
    dayOfMonth: jobData.scheduleOptions?.dayOfMonth || "Não especificado",
    time: jobData.scheduleOptions?.time || "Não especificado",
    note: "Executa uma vez por mês no dia configurado"
  };
}

/**
 * Parse de Periodically schedule
 */
function parsePeriodicallySchedule(jobData) {
  const intervalHours = jobData.scheduleOptions?.periodicallyMinutes
    ? jobData.scheduleOptions.periodicallyMinutes / 60
    : null;

  return {
    frequency: "Periódico",
    interval: intervalHours ? `${intervalHours} hora(s)` : "Não especificado",
    note: `Executa a cada ${intervalHours || 'X'} horas continuamente`
  };
}

/**
 * Parse de Continuously schedule
 */
function parseContinuouslySchedule(jobData) {
  return {
    frequency: "Contínuo",
    note: "Modo CDP-like: executa continuamente após cada alteração detectada"
  };
}

/**
 * Parse de AfterJob schedule
 */
function parseAfterJobSchedule(jobData) {
  return {
    frequency: "Após outro job",
    parentJobId: jobData.scheduleOptions?.afterJobId || "Não especificado",
    note: "Executa automaticamente após conclusão do job pai"
  };
}

/**
 * Parse de AfterNewSnapshot schedule
 */
function parseAfterSnapshotSchedule(jobData) {
  return {
    frequency: "Após novo snapshot",
    note: "Executa quando novo snapshot de VM é detectado"
  };
}

/**
 * Gera recomendações baseadas no schedule
 */
function generateScheduleRecommendations(jobData, scheduleInfo) {
  const recommendations = [];

  // Schedule desabilitado
  if (!jobData.scheduleEnabled) {
    recommendations.push({
      severity: "WARNING",
      message: "Schedule desabilitado. Job só executa manualmente.",
      action: "Considere habilitar schedule para automação"
    });
  }

  // Sem retry configurado
  if (jobData.retryCount === 0) {
    recommendations.push({
      severity: "INFO",
      message: "Sem retry configurado. Job não tentará novamente se falhar.",
      action: "Configure retry (recomendado: 3 tentativas com 10 min de espera)"
    });
  }

  // nextRun muito distante
  if (jobData.nextRun) {
    const nextRunDate = new Date(jobData.nextRun);
    const now = new Date();
    const hoursUntilRun = (nextRunDate - now) / (1000 * 60 * 60);

    if (hoursUntilRun > 168) { // Mais de 7 dias
      recommendations.push({
        severity: "WARNING",
        message: `Próxima execução é em ${Math.floor(hoursUntilRun / 24)} dias.`,
        action: "Verifique se este intervalo é intencional"
      });
    }
  }

  // Nunca executou
  if (!jobData.lastRun) {
    recommendations.push({
      severity: "WARNING",
      message: "Job nunca foi executado.",
      action: "Execute manualmente para validar configuração (use veeam_start_backup_job)"
    });
  }

  // Última execução falhou
  if (jobData.result?.result === 3) { // Failed
    recommendations.push({
      severity: "ERROR",
      message: `Última execução FALHOU: ${jobData.result.message}`,
      action: "Investigue o erro antes da próxima execução agendada"
    });
  }

  // Se não houver recomendações, adicionar uma positiva
  if (recommendations.length === 0) {
    recommendations.push({
      severity: "SUCCESS",
      message: "Schedule configurado adequadamente.",
      action: "Continue monitorando execuções regulares"
    });
  }

  return recommendations;
}
