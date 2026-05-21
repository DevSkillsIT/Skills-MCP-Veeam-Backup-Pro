// tools/get-server-info.js
// Tool: veeam_get_server_info
// SPEC-VEEAM-ENHANCE-001 / F04 — Tool Consolidation
//
// Fetches server information from the Veeam Backup & Replication REST API.
// Mirrors the structure of tools/get-license.js; the response interceptor
// in vbr-mcp-server.js handles Markdown conversion.

import fetch from "node-fetch";
import https from "https";
import { ensureAuthenticated } from "../lib/auth-middleware.js";

const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.VEEAM_IGNORE_SSL === 'true'
});

export default function(server) {
  server.tool(
    "veeam_get_server_info",
    {},
    async () => {
      try {
        const { host, port, token, apiVersion } = await ensureAuthenticated();

        const apiUrl = `https://${host}:${port}/api/v1/serverInfo`;
        console.log(`[veeam_get_server_info] GET ${apiUrl}`);

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
          throw new Error(`Failed to fetch server info: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        return {
          content: [{
            type: "text",
            text: JSON.stringify(data, null, 2)
          }]
        };

      } catch (error) {
        console.error('[veeam_get_server_info] Error:', error);
        return {
          content: [{
            type: "text",
            text: `Error: ${error.message}`
          }],
          isError: true
        };
      }
    }
  );
}
