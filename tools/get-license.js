// tools/get-license.js
// Consolidated tool: replaces veeam_get_license_info + veeam_get_license_workloads
// SPEC-VEEAM-ENHANCE-001 / F04 — Tool Consolidation
//
// Fetches license info AND workloads in a single API call, returns both in one response.

import fetch from "node-fetch";
import https from "https";
import { ensureAuthenticated } from "../lib/auth-middleware.js";
import { formatLicenseInfo } from "../lib/formatters/veeam-formatters.js";

const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.VEEAM_IGNORE_SSL === 'true'
});

export default function(server) {
  server.tool(
    "veeam_get_license_compliance",
    {},
    async () => {
      try {
        const { host, port, token, apiVersion } = await ensureAuthenticated();

        const apiUrl = `https://${host}:${port}/api/v1/license`;
        console.log(`[veeam_get_license_compliance] GET ${apiUrl}`);

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
          throw new Error(`Failed to fetch license info: ${response.statusText}`);
        }

        const licenseData = await response.json();

        // Fetch workloads from dedicated endpoint (mirrors resources.js pattern)
        try {
          const wlRes = await fetch(`https://${host}:${port}/api/v1/license/workloads`, {
            method: 'GET',
            headers: {
              'accept': 'application/json',
              'x-api-version': apiVersion,
              'Authorization': `Bearer ${token}`
            },
            agent: httpsAgent
          });
          if (wlRes.ok) {
            const wlData = await wlRes.json();
            licenseData.workloads = wlData?.data || wlData;
          }
        } catch {
          // workloads are optional — continue without them
        }

        // Return Markdown directly so response-formatter interceptor passes it through
        // (interceptor returns strings as-is at line 98 of response-formatter.js)
        const markdown = formatLicenseInfo(licenseData);

        return {
          content: [{
            type: "text",
            text: markdown
          }]
        };

      } catch (error) {
        console.error('[veeam_get_license_compliance] Error:', error);
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
