// tools/backup-jobs-tool.js
import fetch from "node-fetch";
import https from "https";
import { z } from "zod";
import { ensureAuthenticated } from "../lib/auth-middleware.js";
import { searchByDescription, formatDescriptionForAI } from "../lib/description-helpers.js";

// Create an HTTPS agent that ignores self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.VEEAM_IGNORE_SSL === 'true'
});

export default function(server) {
  // Add backup jobs tool (not sessions!)
  server.tool(
    "get-backup-jobs",
    {
      limit: z.number().min(1).max(1000).default(100).describe("Maximum number of jobs to retrieve"),
      skip: z.number().min(0).default(0).describe("Number of jobs to skip (for pagination)"),
      typeFilter: z.string().default("Backup").describe("Job type filter (e.g., Backup, Replica, BackupCopy)"),
      stateFilter: z.string().optional().describe("Job state filter (e.g., Running, Stopped, Disabled)"),
      nameFilter: z.string().optional().describe("Job name pattern filter (use * for wildcards)"),
      // ════════════════════════════════════════════════════════════════════
      // CAMPO DESCRIPTION FILTER: BUSCA POR INFORMAÇÕES DO CLIENTE (MSP)
      // ════════════════════════════════════════════════════════════════════
      // Skills IT gerencia backups para MÚLTIPLOS CLIENTES (Ramada, Grupo Wink, etc).
      // O filtro descriptionFilter permite buscar jobs por:
      // - Nome do cliente (ex: "Ramada", "Grupo Wink")
      // - ID do cliente (ex: "CLI-001", "CLI-015")
      // - Localização (ex: "Curitiba", "São Paulo")
      // - Tipo de contrato (ex: "Premium", "Enterprise")
      //
      // Formato esperado no campo description:
      // "Cliente: {nome} | ID: {id} | Local: {local} | Contrato: {tipo}"
      //
      // Exemplo de uso:
      // - descriptionFilter: "Ramada" → Retorna jobs do cliente Ramada
      // - descriptionFilter: "Curitiba" → Retorna jobs em Curitiba
      // - descriptionFilter: "CLI-001" → Retorna jobs do cliente CLI-001
      //
      // NOTA: Filtro é aplicado APÓS busca na API (VBR API não suporta filtro nativo por description)
      descriptionFilter: z.string().optional().describe("Filter jobs by client information in description field (name, ID, location, contract)")
    },
    async (params) => {
      try {
        // Autenticação automática via middleware
        const { host, port, token, apiVersion } = await ensureAuthenticated();
        const {
          limit = 100,
          skip = 0,
          typeFilter = "Backup",
          stateFilter,
          nameFilter,
          descriptionFilter
        } = params;
        
        // Build query parameters for JOBS API (not sessions!)
        const queryParams = new URLSearchParams({
          limit: limit.toString(),
          skip: skip.toString(),
          typeFilter: typeFilter
        });
        
        if (stateFilter) {
          queryParams.append('stateFilter', stateFilter);
        }
        
        if (nameFilter) {
          queryParams.append('nameFilter', nameFilter);
        }
        
        const apiUrl = `https://${host}:${port}/api/v1/jobs?${queryParams.toString()}`;
        console.log(`Fetching backup jobs from: ${apiUrl}`);
        
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
          throw new Error(`Failed to fetch backup jobs: ${response.status} ${response.statusText} - ${errorText}`);
        }
        
        const jobsData = await response.json();
        console.log(`Received jobs data:`, JSON.stringify(jobsData, null, 2));

        // ════════════════════════════════════════════════════════════════════
        // APLICAR FILTRO POR DESCRIPTION (pós-fetch, API VBR não suporta nativo)
        // ════════════════════════════════════════════════════════════════════
        // Se descriptionFilter foi fornecido, filtrar jobs por conteúdo do campo description.
        // Busca case-insensitive em: clientName, clientId, location, contractType, raw description.
        let filteredJobs = jobsData.data || [];

        if (descriptionFilter && filteredJobs.length > 0) {
          const beforeCount = filteredJobs.length;
          filteredJobs = searchByDescription(filteredJobs, descriptionFilter);
          const afterCount = filteredJobs.length;

          console.log(`[get-backup-jobs] ✅ Applied descriptionFilter: "${descriptionFilter}"`);
          console.log(`[get-backup-jobs] 📊 Results: ${afterCount} jobs match (from ${beforeCount} total)`);

          // Atualizar jobsData.data com jobs filtrados
          jobsData.data = filteredJobs;
        }

        // Check if we have any jobs
        if (!jobsData.data || jobsData.data.length === 0) {
          return {
            content: [{ 
              type: "text", 
              text: `No backup jobs found with type filter: ${typeFilter}. This could mean:\n` +
                    `1. No backup jobs are configured on this VBR server\n` +
                    `2. The type filter '${typeFilter}' is too restrictive\n` +
                    `3. You don't have permission to view these jobs\n` +
                    `4. The VBR server is new and has no jobs yet\n\n` +
                    `Try:\n` +
                    `- Removing the typeFilter parameter to see all job types\n` +
                    `- Checking the VBR console for configured jobs\n` +
                    `- Verifying your user permissions on the VBR server\n\n` +
                    `Available job types: Backup, Replica, BackupCopy, EntraIDTenantBackup, etc.`
            }],
            isError: false
          };
        }
        
        // Add a summary message at the beginning
        const total = jobsData.pagination?.total || jobsData.data.length;
        const count = jobsData.pagination?.count || jobsData.data.length;
        const summary = `Retrieved ${count} backup jobs out of ${total} total jobs`;
        
        // Format the data for better readability
        const formattedResult = {
          summary,
          jobs: jobsData.data.map(job => ({
            id: job.id,
            name: job.name,
            type: job.type,
            state: job.state,
            platformName: job.platformName,
            description: job.description,
            scheduleEnabled: job.scheduleEnabled,
            scheduleType: job.scheduleType,
            lastRun: job.lastRun,
            nextRun: job.nextRun,
            retryCount: job.retryCount,
            retryWait: job.retryWait,
            result: job.result?.result || 'Unknown',
            message: job.result?.message || 'No message'
          })),
          pagination: jobsData.pagination || { total, count },
          filters: {
            typeFilter,
            stateFilter,
            nameFilter,
            descriptionFilter
          }
        };
        
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify(formattedResult, null, 2)
          }]
        };
      } catch (authError) {
        // Erro de autenticação
        if (authError.message.includes('Autenticação Veeam falhou')) {
          console.error('[get-backup-jobs] Falha na autenticação automática:', authError);
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
        console.error('Error in get-backup-jobs:', authError);
        return {
          content: [{
            type: "text",
            text: `Error fetching backup jobs: ${authError.message}\n\n` +
                  `Debugging tips:\n` +
                  `1. Verify the VBR server is accessible\n` +
                  `2. Check your user permissions\n` +
                  `3. Try different typeFilter values (Backup, Replica, BackupCopy, etc.)\n` +
                  `4. This tool fetches JOBS (not sessions) - use get-backup-sessions for execution history`
          }],
          isError: true
        };
      }
    }
  );
} 