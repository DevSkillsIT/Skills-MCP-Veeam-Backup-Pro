// tools/get-backup-copy-jobs-tool.js
// Tool para listar apenas Backup Copy jobs (off-site backups, 3-2-1 rule)
// Útil para verificar estratégia de DR e compliance com 3-2-1 rule

import fetch from "node-fetch";
import https from "https";
import { z } from "zod";
import { ensureAuthenticated } from "../lib/auth-middleware.js";
import { enrichJobData, formatJobType } from "../lib/format-helpers.js";
import { enrichListResponse, createMCPResponse, addPerformanceMetrics } from "../lib/response-enricher.js";
import { searchByDescription, formatDescriptionForAI } from "../lib/description-helpers.js";

// HTTPS agent com suporte a certificados self-signed
const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.VEEAM_IGNORE_SSL === 'true'
});

export default function(server) {
  server.tool(
    "veeam_list_backup_copy_jobs",
    {
      limit: z.number().min(1).max(1000).default(100).describe("Máximo de jobs a retornar (padrão: 100)"),
      // ════════════════════════════════════════════════════════════════════
      // CAMPO DESCRIPTION FILTER: BUSCA POR INFORMAÇÕES DO CLIENTE (MSP)
      // ════════════════════════════════════════════════════════════════════
      // Skills IT gerencia Backup Copy jobs para MÚLTIPLOS CLIENTES (operações MSP).
      // O filtro descriptionFilter permite buscar jobs por:
      // - Nome do cliente (ex: "ACME", "TechCo")
      // - ID do cliente (ex: "CLI-001", "CLI-015")
      // - Localização (ex: "Curitiba", "São Paulo")
      // - Tipo de contrato (ex: "Premium", "Enterprise")
      //
      // Formato esperado no campo description:
      // "Cliente: {nome} | ID: {id} | Local: {local} | Contrato: {tipo}"
      //
      // Exemplo de uso:
      // - descriptionFilter: "ACME" → Retorna copy jobs do cliente ACME
      // - descriptionFilter: "Curitiba" → Retorna copy jobs em Curitiba
      // - descriptionFilter: "CLI-001" → Retorna copy jobs do cliente CLI-001
      //
      // NOTA: Filtro é aplicado APÓS busca na API (VBR API não suporta filtro nativo por description)
      // CRÍTICO PARA DR: Backup Copy jobs são essenciais para 3-2-1 rule e disaster recovery
      descriptionFilter: z.string().optional().describe("Filter jobs by client information in description field (name, ID, location, contract)")
    },
    async (params) => {
      const startTime = Date.now();

      try {
        // Autenticação automática via middleware
        const { host, port, token, apiVersion } = await ensureAuthenticated();
        const { limit = 100, descriptionFilter } = params;

        // Endpoint: GET /api/v1/jobs com filtro typeFilter=BackupCopy
        const queryParams = new URLSearchParams({
          limit: limit.toString(),
          skip: '0',
          typeFilter: 'BackupCopy' // Apenas Backup Copy jobs (3-2-1 rule)
        });

        const apiUrl = `https://${host}:${port}/api/v1/jobs?${queryParams.toString()}`;
        console.log(`[veeam_list_backup_copy_jobs] Buscando Backup Copy jobs: ${apiUrl}`);

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
            `Falha ao buscar Backup Copy jobs (HTTP ${response.status}): ${errorText}`
          );
        }

        const jobsData = await response.json();
        console.log(`[veeam_list_backup_copy_jobs] Recebido: ${jobsData.data?.length || 0} jobs`);

        // ════════════════════════════════════════════════════════════════════
        // APLICAR FILTRO POR DESCRIPTION (pós-fetch, API VBR não suporta nativo)
        // ════════════════════════════════════════════════════════════════════
        // Se descriptionFilter foi fornecido, filtrar Backup Copy jobs por conteúdo do campo description.
        // Busca case-insensitive em: clientName, clientId, location, contractType, raw description.
        // CRÍTICO PARA DR: Backup Copy jobs são essenciais para estratégia 3-2-1 e disaster recovery.
        let filteredJobs = jobsData.data || [];

        if (descriptionFilter && filteredJobs.length > 0) {
          const beforeCount = filteredJobs.length;
          filteredJobs = searchByDescription(filteredJobs, descriptionFilter);
          const afterCount = filteredJobs.length;

          console.log(`[veeam_list_backup_copy_jobs] ✅ Applied descriptionFilter: "${descriptionFilter}"`);
          console.log(`[veeam_list_backup_copy_jobs] 📊 Results: ${afterCount} copy jobs match (from ${beforeCount} total)`);

          // Atualizar jobsData.data com jobs filtrados
          jobsData.data = filteredJobs;
        }

        // Verificar se há Backup Copy jobs
        if (!jobsData.data || jobsData.data.length === 0) {
          const noJobsResponse = {
            summary: {
              message: "⚠️ Nenhum Backup Copy job encontrado",
              count: 0,
              total: 0,
              timestamp: new Date().toISOString()
            },
            warning: {
              severity: "ALTO",
              message: "Ausência de Backup Copy jobs pode indicar falta de estratégia 3-2-1",
              explanation: {
                "3-2-1 Rule": "3 cópias, 2 tipos de mídia, 1 off-site",
                "Backup Copy Role": "Move backups para segundo repositório (off-site ou cloud)"
              },
              impact: [
                "Sem proteção contra falha do repositório primário",
                "Sem cópia off-site para disaster recovery",
                "Não compliance com melhores práticas de backup"
              ],
              recommendations: [
                "Crie Backup Copy jobs para replicar backups para segundo repositório",
                "Configure destino off-site (branch office, cloud, tape)",
                "Defina retention adequado para cópias (mínimo 7 dias)",
                "Teste restore a partir de cópias off-site regularmente"
              ]
            },
            info: {
              whatAreBackupCopyJobs: "Jobs que copiam backups do repositório primário para secundário",
              useCases: [
                "Proteção contra falha de storage primário",
                "Cópia off-site para DR (disaster recovery)",
                "Compliance com regulamentações (LGPD, GDPR, etc)",
                "Air-gapped backups (proteção contra ransomware)"
              ],
              howToCreate: "Veeam Console → Backup Copy → New Backup Copy Job"
            }
          };

          const enrichedResponse = enrichListResponse(
            [],
            "veeam_list_backup_copy_jobs",
            { typeFilter: "BackupCopy", descriptionFilter },
            { limit, skip: 0, total: 0 }
          );

          const finalResponse = {
            ...noJobsResponse,
            ...enrichedResponse
          };

          return createMCPResponse(addPerformanceMetrics(finalResponse, startTime));
        }

        // Enriquecer cada job
        const enrichedJobs = jobsData.data.map(job => enrichJobData(job));

        // Analisar configuração dos jobs
        const analysis = analyzeBackupCopyJobs(enrichedJobs);

        // Agrupar por estado
        const jobsByState = {};
        enrichedJobs.forEach(job => {
          const state = job.stateFormatted || `State ${job.state}`;
          if (!jobsByState[state]) {
            jobsByState[state] = {
              count: 0,
              jobs: []
            };
          }
          jobsByState[state].count++;
          jobsByState[state].jobs.push(job.name);
        });

        // Verificar compliance com 3-2-1 rule
        const compliance = check321Compliance(enrichedJobs);

        // Construir resposta enriquecida
        const responseData = {
          summary: {
            message: `📦 ${enrichedJobs.length} Backup Copy job(s) encontrado(s)`,
            count: enrichedJobs.length,
            total: jobsData.pagination?.total || enrichedJobs.length,
            timestamp: new Date().toISOString()
          },
          compliance321: compliance,
          analysis: {
            byState: jobsByState,
            ...analysis
          },
          jobs: enrichedJobs.map(job => ({
            id: job.id,
            name: job.name,
            type: job.type,
            typeFormatted: job.typeFormatted,
            state: job.state,
            stateFormatted: job.stateFormatted,
            platformName: job.platformName,
            description: job.description,
            // Schedule info
            scheduleEnabled: job.scheduleEnabled,
            scheduleType: job.scheduleType,
            scheduleTypeFormatted: job.scheduleTypeFormatted,
            // Execution info
            lastRun: job.lastRun,
            lastRunFormatted: job.lastRunFormatted,
            nextRun: job.nextRun,
            nextRunFormatted: job.nextRunFormatted,
            // Result info
            result: job.result?.result,
            resultFormatted: job.resultFormatted,
            message: job.result?.message || "Sem mensagem",
            // Retry config
            retryCount: job.retryCount,
            retryWait: job.retryWait
          }))
        };

        // Aplicar enriquecimento de lista
        const enrichedResponse = enrichListResponse(
          responseData.jobs,
          "veeam_list_backup_copy_jobs",
          { typeFilter: "BackupCopy", descriptionFilter },
          jobsData.pagination
        );

        const finalResponse = {
          ...responseData,
          pagination: enrichedResponse.pagination,
          _metadata: enrichedResponse._metadata
        };

        return createMCPResponse(addPerformanceMetrics(finalResponse, startTime));

      } catch (error) {
        console.error('[veeam_list_backup_copy_jobs] Erro:', error);

        const errorResponse = {
          error: true,
          message: error.message,
          tool: "veeam_list_backup_copy_jobs",
          timestamp: new Date().toISOString(),
          troubleshooting: {
            tips: [
              "Verifique conectividade com o VBR server",
              "Confirme que credenciais estão corretas no .env",
              "Use veeam_list_backup_jobs sem filtros para debug"
            ]
          }
        };

        return createMCPResponse(addPerformanceMetrics(errorResponse, startTime), true);
      }
    }
  );
}

/**
 * Analisa configuração dos Backup Copy jobs
 * @param {Array} jobs - Array de Backup Copy jobs
 * @returns {Object} Análise detalhada
 */
function analyzeBackupCopyJobs(jobs) {
  const analysis = {
    totalJobs: jobs.length,
    enabled: jobs.filter(j => j.scheduleEnabled).length,
    disabled: jobs.filter(j => !j.scheduleEnabled).length,
    lastSuccessful: 0,
    lastFailed: 0,
    lastWarning: 0,
    neverRun: 0
  };

  jobs.forEach(job => {
    const result = job.result?.result;

    if (!job.lastRun) {
      analysis.neverRun++;
    } else if (result === 1) {
      analysis.lastSuccessful++;
    } else if (result === 3) {
      analysis.lastFailed++;
    } else if (result === 2) {
      analysis.lastWarning++;
    }
  });

  return analysis;
}

/**
 * Verifica compliance com 3-2-1 rule
 * @param {Array} jobs - Array de Backup Copy jobs
 * @returns {Object} Status de compliance
 */
function check321Compliance(jobs) {
  const hasBackupCopyJobs = jobs.length > 0;
  const hasEnabledJobs = jobs.some(j => j.scheduleEnabled);
  const hasRecentSuccess = jobs.some(j => {
    if (!j.lastRun) return false;
    const lastRun = new Date(j.lastRun);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return lastRun > oneDayAgo && j.result?.result === 1;
  });

  let complianceLevel = "NONE";
  let complianceScore = 0;

  if (hasBackupCopyJobs) complianceScore += 33;
  if (hasEnabledJobs) complianceScore += 33;
  if (hasRecentSuccess) complianceScore += 34;

  if (complianceScore >= 90) {
    complianceLevel = "COMPLIANT";
  } else if (complianceScore >= 60) {
    complianceLevel = "PARTIAL";
  } else if (complianceScore > 0) {
    complianceLevel = "MINIMAL";
  }

  return {
    level: complianceLevel,
    score: `${complianceScore}%`,
    checks: {
      hasBackupCopyJobs: hasBackupCopyJobs ? "✅ Sim" : "❌ Não",
      hasEnabledJobs: hasEnabledJobs ? "✅ Sim" : "❌ Não",
      hasRecentSuccess: hasRecentSuccess ? "✅ Sim" : "❌ Não"
    },
    recommendation: complianceLevel === "COMPLIANT"
      ? "Excelente! Continue monitorando execuções regulares."
      : "Configure ou habilite Backup Copy jobs para compliance com 3-2-1 rule."
  };
}
