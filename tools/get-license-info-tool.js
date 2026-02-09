// tools/license-tools.js
import fetch from "node-fetch";
import https from "https";
import { ensureAuthenticated } from "../lib/auth-middleware.js";

// Create an HTTPS agent that ignores self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

export default function(server) {
  // Add licensing information tool
  server.tool(
    "veeam_get_license_info",
    { },
    async () => {
      try {
        // Autenticação automática via middleware
        const { host, token } = await ensureAuthenticated();
        
        const response = await fetch(`https://${host}:9419/api/v1/license`, {
          method: 'GET',
          headers: {
            'accept': 'application/json',
            'x-api-version': '1.2-rev0',
            'Authorization': `Bearer ${token}`
          },
          agent: httpsAgent
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch license info: ${response.statusText}`);
        }
        
        const licenseData = await response.json();
        
        // Format the license data for better readability
        const formattedLicense = {
          status: licenseData.status,
          edition: licenseData.edition,
          expirationDate: licenseData.expirationDate,
          licensedTo: licenseData.licensedTo,
          instanceLicenseSummary: {
            package: licenseData.instanceLicenseSummary?.package,
            licensedInstancesNumber: licenseData.instanceLicenseSummary?.licensedInstancesNumber,
            usedInstancesNumber: licenseData.instanceLicenseSummary?.usedInstancesNumber,
            workloadCount: licenseData.instanceLicenseSummary?.workload?.length || 0
          },
          supportExpirationDate: licenseData.supportExpirationDate
        };
        
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify(formattedLicense, null, 2)
          }]
        };
      } catch (authError) {
        // Erro de autenticação
        if (authError.message.includes('Autenticação Veeam falhou')) {
          console.error('[veeam_get_license_info] Falha na autenticação automática:', authError);
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
        return {
          content: [{
            type: "text",
            text: `Error fetching license info: ${authError.message}`
          }],
          isError: true
        };
      }
    }
  );

  // Add tool to get detailed license workload information
  server.tool(
    "veeam_get_license_workloads",
    { },
    async () => {
      try {
        // Autenticação automática via middleware
        const { host, token } = await ensureAuthenticated();
        
        const response = await fetch(`https://${host}:9419/api/v1/license`, {
          method: 'GET',
          headers: {
            'accept': 'application/json',
            'x-api-version': '1.2-rev0',
            'Authorization': `Bearer ${token}`
          },
          agent: httpsAgent
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch license info: ${response.statusText}`);
        }
        
        const licenseData = await response.json();
        
        // Get the workload data only
        const workloads = licenseData.instanceLicenseSummary?.workload || [];
        
        // Group workloads by type
        const workloadsByType = {};
        workloads.forEach(workload => {
          if (!workloadsByType[workload.type]) {
            workloadsByType[workload.type] = [];
          }
          workloadsByType[workload.type].push(workload);
        });
        
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify(workloadsByType, null, 2)
          }]
        };
      } catch (authError) {
        // Erro de autenticação
        if (authError.message.includes('Autenticação Veeam falhou')) {
          console.error('[veeam_get_license_workloads] Falha na autenticação automática:', authError);
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
        return {
          content: [{
            type: "text",
            text: `Error fetching license workloads: ${authError.message}`
          }],
          isError: true
        };
      }
    }
  );
}