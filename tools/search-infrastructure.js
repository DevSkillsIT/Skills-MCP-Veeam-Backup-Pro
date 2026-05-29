// tools/search-infrastructure.js
// Consolidated tool: replaces veeam_list_backup_proxies + veeam_list_backup_repositories
// SPEC-VEEAM-ENHANCE-001 / F04 — Tool Consolidation
//
// Unified infrastructure search with type parameter (proxies or repositories).

import https from "https";
import { z } from "zod";
import { ensureAuthenticated } from "../lib/auth-middleware.js";
import { vbrFetch } from "../lib/veeam-fetch.js";

const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.VEEAM_IGNORE_SSL === 'true'
});

export default function(server) {
  server.tool(
    "veeam_search_infrastructure",
    {
      type: z.enum(["proxies", "repositories"]).describe("REQUIRED. Which infrastructure to list: 'repositories' (storage targets — capacity, free space, usage %) or 'proxies' (data movers — host, max concurrent tasks). You MUST pass this; there is no default. For 'is there space?' use 'repositories'; for 'why is backup slow/queued?' use 'proxies'."),
      limit: z.number().min(1).max(50).default(35).describe("Max items to return (default 35, hard max 50). Proxies and repositories are usually <35 total per VBR — the default captures almost all environments. Only raise for a large MSP with dozens of repos."),
      skip: z.number().min(0).default(0).describe("Number of items to skip for pagination"),
      threshold: z.number().min(1).max(99).default(20).optional().describe("Warning threshold % for free space (repositories only, default: 20)")
    },
    async (params) => {
      try {
        const { host, port, token, apiVersion } = await ensureAuthenticated();
        const { type, limit = 35, skip = 0, threshold = 20 } = params;

        switch (type) {
          case 'proxies':
            return await handleProxies(host, port, token, apiVersion, limit, skip);
          case 'repositories':
            return await handleRepositories(host, port, token, apiVersion, limit, skip, threshold);
          default:
            // @MX:NOTE: instructive error (mirrors search_restore_points) so an LLM that
            // forgot the required `type` can self-correct instead of looping on a dead-end message.
            return {
              content: [{ type: "text", text: `You must provide "type". Valid values: "repositories" or "proxies".\nExamples:\n  - type: "repositories"  (storage capacity, free space, usage %)\n  - type: "proxies"       (processing proxies, host, max tasks)` }],
              isError: true
            };
        }
      } catch (error) {
        console.error('[veeam_search_infrastructure] Error:', error);
        return {
          content: [{ type: "text", text: `Erro: ${error.message}` }],
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
  // @MX:NOTE: /api/v1/backupInfrastructure/proxies returns only static config (no hostName).
  // /api/v1/backupInfrastructure/proxies/states returns the same list enriched with
  // hostName, isOnline, isDisabled, isOutOfDate — the fields users actually want to see.
  // We fetch /states primarily and fall back to /proxies if /states is unavailable.
  const statesUrl = `https://${host}:${port}/api/v1/backupInfrastructure/proxies/states?limit=${limit}&skip=${skip}`;
  const baseUrl = `https://${host}:${port}/api/v1/backupInfrastructure/proxies?limit=${limit}&skip=${skip}`;
  const headers = {
    'accept': 'application/json',
    'x-api-version': apiVersion,
    'Authorization': `Bearer ${token}`
  };

  console.log(`[search_infrastructure:proxies] GET ${statesUrl}`);
  let response = await vbrFetch(statesUrl, { method: 'GET', headers, agent: httpsAgent });
  let usedFallback = false;

  // @MX:NOTE: /proxies/states may not be available on every VBR version.
  // Observed HTTP 400 on VBR 12.3.2 / REST v1.2-rev0. Fall back to the plain
  // /proxies endpoint on any 4xx so the tool always returns usable data.
  if (!response.ok && response.status >= 400 && response.status < 500) {
    const errText = await response.text().catch(() => '');
    console.log(`[search_infrastructure:proxies] /states returned HTTP ${response.status} (${errText.slice(0,120)}); falling back to /proxies`);
    response = await vbrFetch(baseUrl, { method: 'GET', headers, agent: httpsAgent });
    usedFallback = true;
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Failed to fetch proxies: HTTP ${response.status} ${response.statusText} — ${errText.slice(0,200)}`);
  }

  const proxiesData = await response.json();

  const total = proxiesData.pagination?.total || 0;
  const count = proxiesData.pagination?.count || proxiesData.data?.length || 0;

  // @MX:NOTE: When /states fell back to /proxies, the response has server.hostId (UUID)
  // but no hostName. Build a hostId→hostName map from /managedServers to display a
  // human name. Single round-trip, cached by VBR for subsequent proxies in the batch.
  let hostNameMap = {};
  if (usedFallback && (proxiesData.data || []).some(p => p.server?.hostId)) {
    try {
      const msUrl = `https://${host}:${port}/api/v1/backupInfrastructure/managedServers?limit=500`;
      const msResp = await vbrFetch(msUrl, { method: 'GET', headers, agent: httpsAgent });
      if (msResp.ok) {
        const msData = await msResp.json();
        for (const srv of msData.data || []) {
          if (srv.id) hostNameMap[srv.id] = srv.name;
        }
      }
    } catch (err) {
      console.warn(`[search_infrastructure:proxies] managedServers lookup failed: ${err.message}`);
    }
  }

  const formattedResult = {
    summary: `Retrieved ${count} backup proxies out of ${total} total`,
    proxies: (proxiesData.data || []).map(proxy => ({
      id: proxy.id,
      name: proxy.name,
      description: proxy.description,
      type: proxy.type,
      // /states provides these at the top level; /proxies has only server.hostId (UUID).
      hostName: proxy.hostName ?? proxy.server?.hostName ?? hostNameMap[proxy.server?.hostId] ?? null,
      hostId: proxy.hostId ?? proxy.server?.hostId ?? null,
      isOnline: proxy.isOnline ?? null,
      isDisabled: proxy.isDisabled ?? null,
      isOutOfDate: proxy.isOutOfDate ?? null,
      transportMode: proxy.server?.transportMode ?? null,
      maxTaskCount: proxy.server?.maxTaskCount ?? null,
      failoverToNetwork: proxy.server?.failoverToNetwork ?? null,
      hostToProxyEncryption: proxy.server?.hostToProxyEncryption ?? null,
      autoSelectDatastores: proxy.server?.connectedDatastores?.autoSelectEnabled ?? null
    })),
    pagination: proxiesData.pagination,
    _source: usedFallback ? 'proxies' : 'proxies/states'
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

  const response = await vbrFetch(apiUrl, {
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
