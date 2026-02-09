// tools/job-details-tool.js
import fetch from "node-fetch";
import https from "https";
import { z } from "zod";
import { ensureAuthenticated } from "../lib/auth-middleware.js";

// Create an HTTPS agent that ignores self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.VEEAM_IGNORE_SSL === 'true'
});

export default function(server) {
  // Add job details tool
  server.tool(
    "veeam_get_backup_job_details",
    {
      jobId: z.string().describe("ID of the backup job to get details for"),
      includeSessions: z.boolean().default(true).describe("Include recent sessions for this job"),
      sessionLimit: z.number().min(1).max(100).default(10).describe("Maximum number of recent sessions to retrieve")
    },
    async (params) => {
      try {
        // Autenticação automática via middleware
        const { host, port, token, apiVersion } = await ensureAuthenticated();
        const { 
          jobId,
          includeSessions = true,
          sessionLimit = 10
        } = params;
        
        if (!jobId) {
          return {
            content: [{ 
              type: "text", 
              text: "Job ID is required. Please provide a valid job ID." 
            }],
            isError: true
          };
        }
        
        // Get job details
        const jobUrl = `https://${host}:${port}/api/v1/jobs/${jobId}`;
        console.log(`Fetching job details from: ${jobUrl}`);
        
        const jobResponse = await fetch(jobUrl, {
          method: 'GET',
          headers: {
            'accept': 'application/json',
            'x-api-version': apiVersion,
            'Authorization': `Bearer ${token}`
          },
          agent: httpsAgent
        });
        
        let jobData;
        let usedFallback = false;

        if (!jobResponse.ok) {
          const errorText = await jobResponse.text();

          // ════════════════════════════════════════════════════════════════════
          // FALLBACK PARA HYPER-V: VBR REST API v1.2-rev0 não suporta Hyper-V
          // via endpoint /api/v1/jobs/{id}. Solução: buscar via sessions.
          // ════════════════════════════════════════════════════════════════════
          if (errorText.includes('supported platform type')) {
            console.log(`⚠️ Endpoint /jobs/{id} não suporta esta plataforma. Tentando fallback via sessions...`);

            // Buscar session mais recente do job para extrair informações
            const fallbackUrl = `https://${host}:${port}/api/v1/sessions?jobIdFilter=${jobId}&limit=1&sortOrder=descending`;
            console.log(`Fallback: buscando via ${fallbackUrl}`);

            const fallbackResponse = await fetch(fallbackUrl, {
              method: 'GET',
              headers: {
                'accept': 'application/json',
                'x-api-version': apiVersion,
                'Authorization': `Bearer ${token}`
              },
              agent: httpsAgent
            });

            if (!fallbackResponse.ok) {
              throw new Error(`Fallback falhou: ${fallbackResponse.status} ${fallbackResponse.statusText}`);
            }

            const sessionsData = await fallbackResponse.json();

            if (!sessionsData.data || sessionsData.data.length === 0) {
              throw new Error(
                `Job ${jobId} não encontrado via fallback. ` +
                `Possíveis causas:\n` +
                `- Job nunca foi executado (sem sessions)\n` +
                `- Job não existe ou foi deletado\n` +
                `- Plataforma não suportada pela API v1.2-rev0`
              );
            }

            // Extrair informações do job a partir da session mais recente
            const latestSession = sessionsData.data[0];
            jobData = {
              id: jobId,
              name: latestSession.name || 'Unknown Job',
              type: latestSession.sessionType || 'Unknown',
              platformName: latestSession.platformName || 'Unknown Platform',
              description: `Job extraído via fallback (plataforma: ${latestSession.platformName})`,
              state: 'Unknown (via fallback)',
              scheduleEnabled: null,
              scheduleType: null,
              lastRun: latestSession.creationTime,
              nextRun: null,
              retryCount: null,
              retryWait: null,
              result: {
                result: latestSession.result?.result || 'Unknown',
                message: latestSession.result?.message || 'No message'
              }
            };

            usedFallback = true;
            console.log(`✅ Fallback bem-sucedido. Dados extraídos da session mais recente.`);
          } else {
            // Erro não relacionado a plataforma - propagar
            throw new Error(`Failed to fetch job details: ${jobResponse.status} ${jobResponse.statusText} - ${errorText}`);
          }
        } else {
          // Sucesso no endpoint padrão
          jobData = await jobResponse.json();
          console.log(`Received job data:`, JSON.stringify(jobData, null, 2));
        }
        
        let result = {
          job: {
            id: jobData.id,
            name: jobData.name,
            type: jobData.type,
            state: jobData.state,
            platformName: jobData.platformName,
            description: jobData.description,
            scheduleEnabled: jobData.scheduleEnabled,
            scheduleType: jobData.scheduleType,
            lastRun: jobData.lastRun,
            nextRun: jobData.nextRun,
            retryCount: jobData.retryCount,
            retryWait: jobData.retryWait,
            result: jobData.result?.result || 'Unknown',
            message: jobData.result?.message || 'No message'
          }
        };

        // Adicionar aviso se fallback foi usado
        if (usedFallback) {
          result._fallback = {
            used: true,
            reason: 'Platform not supported by /api/v1/jobs endpoint (Hyper-V limitation in VBR REST API v1.2-rev0)',
            method: 'Extracted job information from most recent session',
            limitations: [
              'Schedule details (scheduleEnabled, scheduleType, nextRun) not available',
              'Retry configuration (retryCount, retryWait) not available',
              'Current job state not available (only last execution state)'
            ],
            recommendation: 'For complete job configuration, use Veeam Console or PowerShell cmdlets'
          };
        }
        
        // Get recent sessions for this job if requested
        if (includeSessions) {
          const sessionsUrl = `https://${host}:${port}/api/v1/sessions?limit=${sessionLimit}&jobIdFilter=${jobId}`;
          console.log(`Fetching job sessions from: ${sessionsUrl}`);
          
          const sessionsResponse = await fetch(sessionsUrl, {
            method: 'GET',
            headers: {
              'accept': 'application/json',
              'x-api-version': apiVersion,
              'Authorization': `Bearer ${token}`
            },
            agent: httpsAgent
          });
          
          if (sessionsResponse.ok) {
            const sessionsData = await sessionsResponse.json();
            
            result.sessions = {
              summary: `Found ${sessionsData.data?.length || 0} recent sessions for job '${jobData.name}'`,
              sessions: sessionsData.data?.map(session => ({
                id: session.id,
                sessionType: session.sessionType,
                state: session.state,
                creationTime: session.creationTime,
                endTime: session.endTime,
                progressPercent: session.progressPercent,
                result: session.result?.result || 'Unknown',
                message: session.result?.message || 'No message'
              })) || [],
              pagination: sessionsData.pagination
            };
          } else {
            result.sessions = {
              summary: "Failed to retrieve sessions for this job",
              error: `HTTP ${sessionsResponse.status}: ${sessionsResponse.statusText}`,
              sessions: []
            };
          }
        }
        
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify(result, null, 2)
          }]
        };
      } catch (authError) {
        // Erro de autenticação
        if (authError.message.includes('Autenticação Veeam falhou')) {
          console.error('[veeam_get_backup_job_details] Falha na autenticação automática:', authError);
          return {
            content: [{
              type: "text",
              text: `Falha na autenticação automática: ${authError.message}\n\n` +
                    `Verifique:\n` +
                    `1. Credenciais no arquivo .env (VEEAM_HOST, VEEAM_USERNAME, VEEAM_PASSWORD)\n` +
                    `2. Conectividade com o servidor VBR\n` +
                    `3. Porta 9419 acessível\n` +
                    `4. Credenciais válidas no VBR`
            }],
            isError: true
          };
        }

        // Erro genérico
        console.error('Error in veeam_get_backup_job_details:', authError);
        return {
          content: [{
            type: "text",
            text: `Error fetching job details: ${authError.message}\n\n` +
                  `Debugging tips:\n` +
                  `1. Verify the job ID is correct\n` +
                  `2. Check your user permissions\n` +
                  `3. Use veeam_list_backup_jobs to find valid job IDs`
          }],
          isError: true
        };
      }
    }
  );
} 