// tools/get-license.js
// Consolidated tool: replaces veeam_get_license_info + veeam_get_license_workloads
// SPEC-VEEAM-ENHANCE-001 / F04 — Tool Consolidation
//
// Fetches license info AND workloads in a single API call, returns both in one response.

import fetch from "node-fetch";
import https from "https";
import { ensureAuthenticated } from "../lib/auth-middleware.js";

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

        // Extract workloads
        const workloads = licenseData.instanceLicenseSummary?.workload || [];

        // Group workloads by type
        const workloadsByType = {};
        workloads.forEach(workload => {
          if (!workloadsByType[workload.type]) {
            workloadsByType[workload.type] = [];
          }
          workloadsByType[workload.type].push(workload);
        });

        // Combined response: license info + workloads
        const formattedResult = {
          license: {
            status: licenseData.status,
            edition: licenseData.edition,
            expirationDate: licenseData.expirationDate,
            licensedTo: licenseData.licensedTo,
            supportExpirationDate: licenseData.supportExpirationDate,
            instanceLicenseSummary: {
              package: licenseData.instanceLicenseSummary?.package,
              licensedInstancesNumber: licenseData.instanceLicenseSummary?.licensedInstancesNumber,
              usedInstancesNumber: licenseData.instanceLicenseSummary?.usedInstancesNumber,
              workloadCount: workloads.length
            }
          },
          workloads: workloadsByType
        };

        return {
          content: [{
            type: "text",
            text: JSON.stringify(formattedResult, null, 2)
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
