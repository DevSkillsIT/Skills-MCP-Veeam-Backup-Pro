// tools/start-backup-job-tool.js
// Tool para iniciar um backup job sob demanda (operação POST)
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

// HTTPS agent com suporte a certificados self-signed
const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.VEEAM_IGNORE_SSL === 'true'
});

export default function(server) {
  server.tool(
    "start-backup-job",
    {
      jobId: z.string().describe("ID do backup job a iniciar (UUID)"),
      fullBackup: z.boolean().default(false).describe("Forçar full backup ao invés de incremental (padrão: false)"),
      confirmationToken: z.string().optional().describe("Token de confirmação (obrigatório se MCP_SAFETY_GUARD=true)"),
      reason: z.string().optional().describe("Justificativa da operação (min 10 caracteres, obrigatório se MCP_SAFETY_GUARD=true)")
    },
    async (params) => {
      const startTime = Date.now();
      const { jobId, fullBackup = false, confirmationToken, reason } = params;

      // Log de início da operação
      console.log(`[start-backup-job] Iniciando job: ${jobId}, fullBackup: ${fullBackup}`);

      try {
        // SAFETY GUARD: Validar confirmação para operação crítica
        // Esta verificação DEVE ser a primeira coisa antes de qualquer operação
        await safetyGuard.requireConfirmation(
          'start-backup-job',
          confirmationToken,
          reason,
          jobId,
          'Job'
        );

        // 1. Validar formato do ID
        validateVeeamId(jobId, "job");

        // 2. Validar que job existe e pode ser iniciado
        console.log(`[start-backup-job] Validando job...`);
        const job = await validateJobOperation(jobId, 'start');

        console.log(`[start-backup-job] ✅ Job "${job.name}" validado. Iniciando...`);

        // 3. Autenticação
        const { host, port, token, apiVersion } = await ensureAuthenticated();

        // 4. Construir URL do endpoint POST
        // Endpoint: POST /api/v1/jobs/{id}/start
        const startUrl = `https://${host}:${port}/api/v1/jobs/${jobId}/start`;

        // 5. Construir corpo da requisição
        const requestBody = {
          type: fullBackup ? "Full" : "Incremental"
        };

        console.log(`[start-backup-job] POST ${startUrl}`);
        console.log(`[start-backup-job] Body:`, requestBody);

        // 6. Executar POST para iniciar job
        const response = await fetch(startUrl, {
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

        // 7. Verificar resposta
        if (!response.ok) {
          const errorText = await response.text();

          // Log de auditoria de falha
          await logOperation('start-backup-job', {
            jobId,
            jobName: job.name,
            result: 'failed',
            error: `HTTP ${response.status}: ${errorText}`,
            metadata: { fullBackup }
          });

          throw new Error(
            `Falha ao iniciar job (HTTP ${response.status}):\n${errorText}\n\n` +
            `Possíveis causas:\n` +
            `- Job já está em execução\n` +
            `- Permissões insuficientes para iniciar jobs\n` +
            `- Repositório de destino indisponível\n` +
            `- Recursos insuficientes no VBR server`
          );
        }

        // 8. Parsear resposta
        const startResult = await response.json();

        console.log(`[start-backup-job] ✅ Job iniciado com sucesso`);
        console.log(`[start-backup-job] Resultado:`, startResult);

        // 9. Extrair session ID criado (se disponível na resposta)
        const sessionId = startResult.sessionId || startResult.id || "N/A";

        // 10. Log de auditoria de sucesso
        await logOperation('start-backup-job', {
          jobId,
          jobName: job.name,
          result: 'success',
          metadata: {
            fullBackup,
            sessionId,
            startedAt: new Date().toISOString()
          }
        });

        // 11. Construir resposta enriquecida
        const operationResponse = enrichOperationResponse(
          "start-backup-job",
          {
            status: "started",
            sessionId: sessionId,
            backupType: fullBackup ? "Full" : "Incremental",
            startedAt: new Date().toISOString(),
            apiResponse: startResult
          },
          {
            jobId: job.id,
            jobName: job.name,
            jobType: job.type,
            platformName: job.platformName
          }
        );

        // 12. Adicionar informações úteis
        const enrichedResponse = {
          ...operationResponse,
          summary: {
            message: `✅ Job "${job.name}" iniciado com sucesso`,
            jobId: job.id,
            jobName: job.name,
            backupType: fullBackup ? "Full Backup" : "Incremental Backup",
            sessionId: sessionId,
            timestamp: new Date().toISOString()
          },
          nextSteps: {
            monitorProgress: `Use get-running-sessions para monitorar progresso`,
            checkLogs: sessionId !== "N/A" ? `Use get-session-log com sessionId: ${sessionId}` : "Session ID não disponível ainda",
            viewAllSessions: `Use get-backup-sessions com jobIdFilter: ${job.id}`
          },
          notes: [
            fullBackup ? "Full backup pode demorar mais que incremental" : "Incremental backup é mais rápido",
            "Job aparecerá em 'Working' state (3) quando iniciar",
            "Verifique repositório tem espaço suficiente",
            "Backup pode falhar se VMs estiverem inacessíveis"
          ]
        };

        return createMCPResponse(addPerformanceMetrics(enrichedResponse, startTime));

      } catch (error) {
        console.error('[start-backup-job] Erro:', error);

        // Log de auditoria de erro
        await logOperation('start-backup-job', {
          jobId,
          jobName: jobId, // Usamos jobId porque job pode não ter sido carregado
          result: 'failed',
          error: error.message,
          metadata: { fullBackup }
        });

        const errorResponse = {
          error: true,
          operation: "start-backup-job",
          message: error.message,
          jobId: jobId,
          timestamp: new Date().toISOString(),
          troubleshooting: {
            tips: [
              "Verifique que o jobId está correto (use get-backup-jobs)",
              "Confirme que o job está no estado 'Stopped' (0)",
              "Verifique permissões do usuário no VBR",
              "Confirme que repositório de destino está disponível",
              "Use get-job-details para verificar configuração do job"
            ]
          }
        };

        return createMCPResponse(addPerformanceMetrics(errorResponse, startTime), true);
      }
    }
  );
}
