// tools/stop-backup-job-tool.js
// Tool para interromper um backup job em execução (operação POST)
// Inclui validação de estado e audit logging
// OPERAÇÃO CRÍTICA: Protegida por Safety Guard quando MCP_SAFETY_GUARD=true

import fetch from "node-fetch";
import https from "https";
import { z } from "zod";
import { ensureAuthenticated } from "../lib/auth-middleware.js";
import { validateJobOperation, validateVeeamId } from "../lib/validation-helpers.js";
import { logOperation } from "../lib/audit-logger.js";
import { enrichOperationResponse, createMCPResponse, addPerformanceMetrics } from "../lib/response-enricher.js";
import { safetyGuard } from "../lib/safety-guard.js";
import { formatDescriptionForAI, getDescriptionFallback } from "../lib/description-helpers.js";

// HTTPS agent com suporte a certificados self-signed
const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.VEEAM_IGNORE_SSL === 'true'
});

export default function(server) {
  server.tool(
    "veeam_stop_backup_job",
    {
      jobId: z.string().describe("ID do backup job a parar (UUID)"),
      confirmationToken: z.string().optional().describe("Token de confirmação (obrigatório se MCP_SAFETY_GUARD=true)"),
      reason: z.string().optional().describe("Justificativa da operação (min 10 caracteres, obrigatório se MCP_SAFETY_GUARD=true)")
    },
    async (params) => {
      const startTime = Date.now();
      const { jobId, confirmationToken, reason } = params;

      // Log de início da operação
      console.log(`[veeam_stop_backup_job] Parando job: ${jobId}`);

      try {
        // SAFETY GUARD: Validar confirmação para operação crítica
        // Esta verificação DEVE ser a primeira coisa antes de qualquer operação
        await safetyGuard.requireConfirmation(
          'veeam_stop_backup_job',
          confirmationToken,
          reason,
          jobId,
          'Job'
        );

        // 1. Validar formato do ID
        validateVeeamId(jobId, "job");

        // 2. Validar que job existe e pode ser parado
        console.log(`[veeam_stop_backup_job] Validando job...`);
        const job = await validateJobOperation(jobId, 'stop');

        console.log(`[veeam_stop_backup_job] ✅ Job "${job.name}" validado. Parando execução...`);

        // 3. Autenticação
        const { host, port, token, apiVersion } = await ensureAuthenticated();

        // 4. Construir URL do endpoint POST
        // Endpoint: POST /api/v1/jobs/{id}/stop
        const stopUrl = `https://${host}:${port}/api/v1/jobs/${jobId}/stop`;

        console.log(`[veeam_stop_backup_job] POST ${stopUrl}`);

        // 5. Executar POST para parar job
        const response = await fetch(stopUrl, {
          method: 'POST',
          headers: {
            'accept': 'application/json',
            'x-api-version': apiVersion,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({}), // Corpo vazio
          agent: httpsAgent
        });

        // 6. Verificar resposta
        if (!response.ok) {
          const errorText = await response.text();

          // Log de auditoria de falha
          await logOperation('veeam_stop_backup_job', {
            jobId,
            jobName: job.name,
            result: 'failed',
            error: `HTTP ${response.status}: ${errorText}`
          });

          throw new Error(
            `Falha ao parar job (HTTP ${response.status}):\n${errorText}\n\n` +
            `Possíveis causas:\n` +
            `- Job já está parado ou sendo parado\n` +
            `- Permissões insuficientes para parar jobs\n` +
            `- Job está em estado de transição (starting, postprocessing)\n` +
            `- Operação não suportada para este tipo de job`
          );
        }

        // 7. Parsear resposta (se houver corpo)
        let stopResult = {};
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          stopResult = await response.json();
        }

        console.log(`[veeam_stop_backup_job] ✅ Job parado com sucesso`);
        console.log(`[veeam_stop_backup_job] Resultado:`, stopResult);

        // 8. Log de auditoria de sucesso
        await logOperation('veeam_stop_backup_job', {
          jobId,
          jobName: job.name,
          result: 'success',
          metadata: {
            stoppedAt: new Date().toISOString(),
            previousState: job.state
          }
        });

        // 9. Construir resposta enriquecida
        const operationResponse = enrichOperationResponse(
          "veeam_stop_backup_job",
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
            // ════════════════════════════════════════════════════════════════════
            // CAMPO DESCRIPTION: CRÍTICO PARA OPERAÇÕES MSP MULTI-CLIENT
            // ════════════════════════════════════════════════════════════════════
            // Skills IT gerencia backups para MÚLTIPLOS CLIENTES (Ramada, Grupo Wink, etc).
            // O campo description contém metadados do cliente:
            // - Nome do cliente
            // - ID do cliente
            // - Localização
            // - Tipo de contrato
            //
            // Formato esperado: "Cliente: {nome} | ID: {id} | Local: {local} | Contrato: {tipo}"
            // Exemplo: "Cliente: Ramada Hotéis | ID: CLI-001 | Local: Curitiba | Contrato: Premium"
            //
            // Isso permite que AIs identifiquem jobs por informações do cliente,
            // ao invés de apenas por nomes técnicos como "BKP-JOB-LOCAL-OK-PMW-VCENTER-SERVER-SKILLS"
            description: job.description || getDescriptionFallback(job),
            descriptionFormatted: formatDescriptionForAI(job.description)
          }
        );

        // 10. Adicionar informações úteis
        const enrichedResponse = {
          ...operationResponse,
          summary: {
            message: `✅ Job "${job.name}" parado com sucesso`,
            jobId: job.id,
            jobName: job.name,
            jobType: job.type,
            timestamp: new Date().toISOString(),
            // Campo description para identificação do cliente (operações MSP)
            description: job.description || getDescriptionFallback(job),
            descriptionFormatted: formatDescriptionForAI(job.description)
          },
          nextSteps: {
            checkFinalState: `Use veeam_get_backup_job_details com jobId: ${job.id} para verificar estado final`,
            viewLastSession: `Use veeam_list_backup_sessions com jobIdFilter: ${job.id} para ver última execução`,
            checkLogs: `Verifique logs da session para entender motivo da parada`
          },
          warnings: [
            "⚠️ Parar um job pode deixar backup incompleto",
            "⚠️ Session será marcada como 'Failed' ou 'Warning'",
            "⚠️ Você pode precisar executar um full backup após parada forçada",
            "⚠️ VMs podem ter snapshots órfãos (verificar com VMware)"
          ],
          notes: [
            "Job irá para estado 'Stopping' (2) e depois 'Stopped' (0)",
            "Operação é assíncrona - pode demorar alguns segundos",
            "Backup partial será descartado ou retido conforme configuração",
            "Snapshots de VM serão removidos automaticamente"
          ]
        };

        return createMCPResponse(addPerformanceMetrics(enrichedResponse, startTime));

      } catch (error) {
        console.error('[veeam_stop_backup_job] Erro:', error);

        // Log de auditoria de erro
        await logOperation('veeam_stop_backup_job', {
          jobId,
          jobName: jobId, // Usamos jobId porque job pode não ter sido carregado
          result: 'failed',
          error: error.message
        });

        const errorResponse = {
          error: true,
          operation: "veeam_stop_backup_job",
          message: error.message,
          jobId: jobId,
          timestamp: new Date().toISOString(),
          troubleshooting: {
            tips: [
              "Verifique que o jobId está correto (use veeam_list_backup_jobs)",
              "Confirme que o job está em execução (state=3 'Working')",
              "Verifique permissões do usuário no VBR",
              "Use veeam_list_running_sessions para verificar sessions ativas",
              "Se job não parar, verifique VBR console para estado atual"
            ],
            alternatives: [
              "Aguardar job terminar naturalmente",
              "Verificar se há problema de rede causando travamento",
              "Reiniciar serviço Veeam Backup Service (último recurso)"
            ]
          }
        };

        return createMCPResponse(addPerformanceMetrics(errorResponse, startTime), true);
      }
    }
  );
}
