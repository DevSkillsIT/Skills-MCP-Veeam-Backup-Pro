// tools/server-info-tool.js
import fetch from "node-fetch";
import https from "https";
import { ensureAuthenticated } from "../lib/auth-middleware.js";

// Create an HTTPS agent that ignores self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

export default function(server) {
  // Add server info tool
  server.tool(
    "veeam_get_server_info",
    { },
    async () => {
      try {
        // Autenticação automática via middleware
        const { host, token } = await ensureAuthenticated();
        
        const response = await fetch(`https://${host}:9419/api/v1/serverInfo`, {
          method: 'GET',
          headers: {
            'accept': 'application/json',
            'x-api-version': '1.2-rev0',
            'Authorization': `Bearer ${token}`
          },
          agent: httpsAgent
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch server info: ${response.statusText}`);
        }
        
        const serverInfo = await response.json();
        
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify(serverInfo, null, 2)
          }]
        };
      } catch (authError) {
        // Erro de autenticação
        if (authError.message.includes('Autenticação Veeam falhou')) {
          console.error('[veeam_get_server_info] Falha na autenticação automática:', authError);
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
            text: `Error fetching server info: ${authError.message}`
          }],
          isError: true
        };
      }
    }
  );
}