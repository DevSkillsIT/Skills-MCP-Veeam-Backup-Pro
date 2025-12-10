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
    "get-job-details",
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
        
        if (!jobResponse.ok) {
          const errorText = await jobResponse.text();
          throw new Error(`Failed to fetch job details: ${jobResponse.status} ${jobResponse.statusText} - ${errorText}`);
        }
        
        const jobData = await jobResponse.json();
        console.log(`Received job data:`, JSON.stringify(jobData, null, 2));
        
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
          console.error('[get-job-details] Falha na autenticação automática:', authError);
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
        console.error('Error in get-job-details:', authError);
        return {
          content: [{
            type: "text",
            text: `Error fetching job details: ${authError.message}\n\n` +
                  `Debugging tips:\n` +
                  `1. Verify the job ID is correct\n` +
                  `2. Check your user permissions\n` +
                  `3. Use get-backup-jobs to find valid job IDs`
          }],
          isError: true
        };
      }
    }
  );
} 