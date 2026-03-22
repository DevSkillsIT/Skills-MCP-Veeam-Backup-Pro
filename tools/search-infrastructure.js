// tools/search-infrastructure.js
// Consolidated tool: replaces veeam_list_backup_proxies + veeam_list_backup_repositories
// SPEC-VEEAM-ENHANCE-001 / F04 — Tool Consolidation
//
// Unified infrastructure search with type parameter (proxies or repositories).

import fetch from "node-fetch";
import https from "https";
import { z } from "zod";
import { ensureAuthenticated } from "../lib/auth-middleware.js";

const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.VEEAM_IGNORE_SSL === 'true'
});

export default function(server) {
  server.tool(
    "veeam_search_infrastructure",
    {
      type: z.enum(["proxies", "repositories"]).describe("Infrastructure type to search"),
      limit: z.number().min(1).max(50).default(25).describe("Maximum items to retrieve (default: 25, max: 50)"),
      skip: z.number().min(0).default(0).describe("Number of items to skip for pagination"),
      threshold: z.number().min(1).max(99).default(20).optional().describe("Warning threshold % for free space (repositories only, default: 20)")
    },
    async (params) => {
      try {
        const { host, port, token, apiVersion } = await ensureAuthenticated();
        const { type, limit = 25, skip = 0, threshold = 20 } = params;

        switch (type) {
          case 'proxies':
            return await handleProxies(host, port, token, apiVersion, limit, skip);
          case 'repositories':
            return await handleRepositories(host, port, token, apiVersion, limit, skip, threshold);
          default:
            return {
              content: [{ type: "text", text: `Error: Unknown type "${type}". Valid: proxies, repositories` }],
              isError: true
            };
        }
      } catch (error) {
        console.error('[veeam_search_infrastructure] Error:', error);
        return {
          content: [{ type: "text", text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );
}

// ============================================================================
// TYPE: proxies
// ============================================================================
async function handleProxies(host, port, token, apiVersion, limit, skip) {
  const apiUrl = `https://${host}:${port}/api/v1/backupInfrastructure/proxies?limit=${limit}&skip=${skip}`;
  console.log(`[search_infrastructure:proxies] GET ${apiUrl}`);

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
    throw new Error(`Failed to fetch proxies: ${response.statusText}`);
  }

  const proxiesData = await response.json();

  const total = proxiesData.pagination?.total || 0;
  const count = proxiesData.pagination?.count || proxiesData.data?.length || 0;

  const formattedResult = {
    summary: `Retrieved ${count} backup proxies out of ${total} total`,
    proxies: (proxiesData.data || []).map(proxy => ({
      id: proxy.id,
      name: proxy.name,
      description: proxy.description,
      type: proxy.type,
      transportMode: proxy.server?.transportMode,
      maxTaskCount: proxy.server?.maxTaskCount,
      failoverToNetwork: proxy.server?.failoverToNetwork,
      hostToProxyEncryption: proxy.server?.hostToProxyEncryption,
      autoSelectDatastores: proxy.server?.connectedDatastores?.autoSelectEnabled
    })),
    pagination: proxiesData.pagination
  };

  return {
    content: [{
      type: "text",
      text: JSON.stringify(formattedResult, null, 2)
    }]
  };
}

// ============================================================================
// TYPE: repositories
// ============================================================================
async function handleRepositories(host, port, token, apiVersion, limit, skip, threshold) {
  const apiUrl = `https://${host}:${port}/api/v1/backupInfrastructure/repositories/states?limit=${limit}&skip=${skip}`;
  console.log(`[search_infrastructure:repositories] GET ${apiUrl}`);

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
    throw new Error(`Failed to fetch repositories: ${response.statusText}`);
  }

  const reposData = await response.json();

  // Process and categorize repositories
  const repos = (reposData.data || []).map(repo => {
    let freeSpacePercent = 0;
    let status = "Unknown";
    let statusDetails = "";

    if (repo.capacityGB > 0) {
      freeSpacePercent = Math.round((repo.freeGB / repo.capacityGB) * 100);

      if (!repo.isOnline) {
        status = "Offline";
        statusDetails = "Repository is offline and cannot be accessed";
      } else if (freeSpacePercent <= threshold) {
        status = "Warning";
        statusDetails = `Low free space (${freeSpacePercent}%)`;
      } else {
        status = "Healthy";
        statusDetails = `Good free space (${freeSpacePercent}%)`;
      }
    } else {
      if (!repo.isOnline) {
        status = "Offline";
        statusDetails = "Repository is offline";
      } else if (repo.type?.includes("Cloud")) {
        status = "Cloud";
        statusDetails = "Object storage with unlimited capacity";
      } else {
        status = "Unknown";
        statusDetails = "Unable to determine free space";
      }
    }

    return {
      id: repo.id,
      name: repo.name,
      description: repo.description,
      type: repo.type,
      path: repo.path,
      hostName: repo.hostName || "N/A",
      capacityGB: repo.capacityGB,
      freeGB: repo.freeGB,
      usedSpaceGB: repo.usedSpaceGB,
      isOnline: repo.isOnline,
      freeSpacePercent,
      status,
      statusDetails
    };
  });

  // Group by status
  const healthy = repos.filter(r => r.status === "Healthy");
  const warnings = repos.filter(r => r.status === "Warning");
  const offline = repos.filter(r => r.status === "Offline");
  const cloud = repos.filter(r => r.status === "Cloud");
  const unknown = repos.filter(r => r.status === "Unknown");

  const formattedResult = {
    summary: {
      total: repos.length,
      healthy: healthy.length,
      warnings: warnings.length,
      offline: offline.length,
      cloud: cloud.length,
      unknown: unknown.length
    },
    warnings: warnings.length > 0 ? warnings : [],
    offline: offline.length > 0 ? offline : [],
    healthy: healthy.length > 0 ? healthy : [],
    cloud: cloud.length > 0 ? cloud : [],
    unknown: unknown.length > 0 ? unknown : [],
    pagination: reposData.pagination
  };

  return {
    content: [{
      type: "text",
      text: JSON.stringify(formattedResult, null, 2)
    }]
  };
}
