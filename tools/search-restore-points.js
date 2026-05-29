// tools/search-restore-points.js
// Consolidated tool: replaces veeam_list_restore_points
// SPEC-VEEAM-ENHANCE-001 / F04 — Tool Consolidation
//
// Renamed for consistency. Same parameters, same API logic.

import https from "https";
import { z } from "zod";
import { ensureAuthenticated } from "../lib/auth-middleware.js";
import { vbrFetch, vbrTryGet } from "../lib/veeam-fetch.js";
import { resolveTimeWindow } from "../lib/date-helper.js";
import { formatDateTime, formatBytes } from "../lib/format-helpers.js";
import { enrichListResponse, createMCPResponse, addPerformanceMetrics } from "../lib/response-enricher.js";
import { searchByName } from "../lib/description-helpers.js";
import { selectVmMatch } from "../lib/backup-coverage.js";

const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.VEEAM_IGNORE_SSL === 'true'
});

export default function(server) {
  server.tool(
    "veeam_search_restore_points",
    {
      vmName: z.string().optional().describe("VM name with semantic search (partial, accent-insensitive). Use vmName OR vmId"),
      vmId: z.string().optional().describe("VM UUID. Use vmName OR vmId"),
      limit: z.number().min(1).max(50).default(35).describe("Max restore points LISTED (default 35, hard max 50) — enforced. Points are newest-first. The retention span (first/last) is always computed over ALL points regardless of this limit. Use from/to to scope by date."),
      from: z.string().optional().describe("Filtra pontos a partir desta data/hora. Aceita QUALQUER formato: ISO (2026-05-20), BR (20/05/2026 05:00), ou natural ('ontem', 'ultimas 48 horas', '7 dias'). Opcional — sem from/to retorna os mais recentes ate o limite."),
      to: z.string().optional().describe("Filtra pontos ate esta data/hora (mesmos formatos de from). Opcional — padrao: agora.")
    },
    async (params) => {
      const startTime = Date.now();
      const { vmName, vmId, limit = 35, from, to } = params;
      const win = resolveTimeWindow({ from, to });
      if (win.error) {
        return { content: [{ type: "text", text: win.error }], isError: true };
      }

      try {
        // Validate at least one parameter
        if (!vmName && !vmId) {
          throw new Error(
            "Voce deve informar vmName OU vmId.\n" +
            'Exemplos: vmName: "GEPMWVM010" ou vmId: "3fa85f64-5717-4562-b3fc-2c963f66afa6"'
          );
        }

        const { host, port, token, apiVersion } = await ensureAuthenticated();
        let finalVmId = vmId;

        // If only vmName provided, search for vmId
        if (!vmId && vmName) {
          console.log(`[veeam_search_restore_points] Searching vmId for vmName: "${vmName}"`);
          finalVmId = await findVmIdByName(vmName, host, port, token, apiVersion);
        }

        console.log(`[veeam_search_restore_points] Fetching restore points for backupObjectId: ${finalVmId}`);

        // @MX:NOTE: Path-based endpoint /api/v1/backupObjects/{id}/restorePoints is the
        // canonical route in VBR REST API v1.2-rev0. The old query-style endpoint
        // /api/v1/vmRestorePoints?vmIdFilter= returns HTTP 404 on 12.3.x — not available.
        const queryParams = new URLSearchParams({
          limit: limit.toString(),
          skip: '0'
        });

        const apiUrl = `https://${host}:${port}/api/v1/backupObjects/${encodeURIComponent(finalVmId)}/restorePoints?${queryParams.toString()}`;
        console.log(`[veeam_search_restore_points] GET ${apiUrl}`);

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
          const errorText = await response.text();
          throw new Error(`Failed to fetch restore points (HTTP ${response.status}): ${errorText}`);
        }

        const restorePointsData = await response.json();
        console.log(`[veeam_search_restore_points] Received: ${restorePointsData.data?.length || 0} restore points`);

        // No results
        if (!restorePointsData.data || restorePointsData.data.length === 0) {
          const noPointsResponse = {
            summary: {
              message: "No restore points found for this VM",
              vmName: vmName || "N/A",
              vmId: finalVmId,
              count: 0,
              timestamp: new Date().toISOString()
            },
            warning: {
              severity: "HIGH",
              message: "VM without restore points cannot be restored",
              possibleReasons: [
                "VM never included in a backup job",
                "All restore points expired (retention policy)",
                "Backups were deleted manually",
                "VM was recently removed from backup jobs"
              ],
              recommendations: [
                "Check if VM is in a backup job (use veeam_search_backup_jobs)",
                "Review retention policy of jobs",
                "Run manual backup (use veeam_manage_backup_jobs action=start)"
              ]
            }
          };

          const enrichedResponse = enrichListResponse(
            [], "veeam_search_restore_points",
            { vmName: vmName || null, vmId: finalVmId },
            { limit, skip: 0, total: 0 }
          );

          return createMCPResponse(addPerformanceMetrics({ ...noPointsResponse, ...enrichedResponse }, startTime));
        }

        // Enrich and sort restore points
        const enrichedPoints = restorePointsData.data.map(point => ({
          ...point,
          creationTimeFormatted: formatDateTime(point.creationTime),
          sizeFormatted: formatBytes(point.size),
          typeFormatted: formatRestorePointType(point.type),
          ageInDays: calculateAgeInDays(point.creationTime)
        }));

        enrichedPoints.sort((a, b) => new Date(b.creationTime) - new Date(a.creationTime));

        // @MX:NOTE: optional date window (from/to, any format). When given, scope the points to
        // it; otherwise use all. The span/analysis below reflect the scoped set.
        const scoped = win.since
          ? enrichedPoints.filter(p => { const t = new Date(p.creationTime); return t >= win.since && (!win.until || t <= win.until); })
          : enrichedPoints;

        // Analyze over the scoped points (retention span stays accurate for the window)...
        const analysis = analyzeRestorePoints(scoped);
        // @MX:NOTE: ...but cap the rendered LIST at `limit`. The VBR endpoint sometimes ignores
        // the limit query param and returns the whole chain (dozens of rows) — slicing here
        // guarantees the cap so a weak LLM doesn't get a context-blowing dump.
        const displayed = scoped.slice(0, limit);

        // @MX:NOTE: surface the owning job (user wants RP info tied to its job). Best-effort:
        // restore points carry backupId; /backups/{id} carries the job name. Never blocks.
        let jobName = null;
        const backupId = scoped[0]?.backupId;
        if (backupId) {
          const bRes = await vbrTryGet(`https://${host}:${port}/api/v1/backups/${backupId}`, {
            headers: { 'accept': 'application/json', 'x-api-version': apiVersion, 'Authorization': `Bearer ${token}` }
          });
          jobName = bRes.data?.name ?? null;
        }

        // Build response
        const responseData = {
          summary: {
            message: `${scoped.length} restore point(s)${win.since ? ` na janela (${win.label})` : ' available'}`,
            vmName: vmName || scoped[0]?.vmName || "N/A",
            vmId: finalVmId,
            jobName: jobName || "N/A",
            count: scoped.length,
            mostRecent: scoped[0]?.creationTimeFormatted || "N/A",
            oldest: scoped[scoped.length - 1]?.creationTimeFormatted || "N/A",
            timestamp: new Date().toISOString()
          },
          analysis,
          restorePoints: displayed.map(point => ({
            id: point.id,
            vmName: point.vmName || point.name || vmName || null,
            vmId: point.vmId,
            creationTime: point.creationTime,
            creationTimeFormatted: point.creationTimeFormatted,
            type: point.type,
            typeFormatted: point.typeFormatted,
            size: point.size,
            sizeFormatted: point.sizeFormatted,
            platformName: point.platformName,
            repositoryName: point.repositoryName || "N/A",
            isConsistent: point.isConsistent,
            ageInDays: point.ageInDays
          }))
        };

        const enrichedResponse = enrichListResponse(
          responseData.restorePoints,
          "veeam_search_restore_points",
          { vmName: vmName || null, vmId: finalVmId },
          { total: scoped.length, count: displayed.length, limit }
        );

        const finalResponse = {
          ...responseData,
          pagination: enrichedResponse.pagination,
          _metadata: enrichedResponse._metadata
        };

        return createMCPResponse(addPerformanceMetrics(finalResponse, startTime));

      } catch (error) {
        console.error('[veeam_search_restore_points] Error:', error);
        return {
          content: [{ type: "text", text: `Erro: ${error.message}` }],
          isError: true
        };
      }
    }
  );
}

// ============================================================================
// Helper functions
// ============================================================================

// @MX:NOTE: VM lookup uses a two-path fallback strategy.
// Primary path:  GET /api/v1/backupObjects?nameFilter=<name>  (canonical in VBR REST v1.2-rev0)
// Fallback path: GET /api/v1/vmRestorePoints?limit=1000       (original approach, kept for older builds)
// The fallback is triggered only when the primary endpoint returns HTTP 404.
async function findVmIdByName(vmName, host, port, token, apiVersion) {
  console.log(`[findVmIdByName] Searching VM: "${vmName}"`);

  const headers = {
    'accept': 'application/json',
    'x-api-version': apiVersion,
    'Authorization': `Bearer ${token}`
  };

  // ── Primary path: /api/v1/backupObjects (VBR REST API v1.2-rev0) ──────────
  // @MX:NOTE: nameFilter needs explicit wildcards for partial/substring matches, otherwise
  // "GWPMWVM010" won't match the object "GWPMWVM010-AD". Wrap with * (user wants partial search).
  const wildName = vmName.includes('*') ? vmName : `*${vmName}*`;
  const backupObjectsUrl = `https://${host}:${port}/api/v1/backupObjects?nameFilter=${encodeURIComponent(wildName)}&limit=50&skip=0`;
  console.log(`[findVmIdByName] Trying primary path: ${backupObjectsUrl}`);

  const primaryResponse = await vbrFetch(backupObjectsUrl, { method: 'GET', headers, agent: httpsAgent });

  if (primaryResponse.ok) {
    const objectsData = await primaryResponse.json();
    const objects = objectsData.data || [];
    console.log(`[findVmIdByName] backupObjects returned ${objects.length} result(s)`);

    if (objects.length > 0) {
      const matched = searchByName(objects, vmName, 'name');
      if (matched.length > 0) {
        // @MX:NOTE: backupObjects exposes two IDs:
        //   - "id"       = Veeam UUID (accepted by /api/v1/backupObjects/{id}/restorePoints)
        //   - "objectId" = vSphere managed object reference (e.g. "vm-154058"), NOT valid here.
        // selectVmMatch prefers "id" and dedupes by distinct VM name (see V1 below).
        const pick = selectVmMatch(matched);
        // @MX:NOTE: V1 — a partial term hitting several DISTINCT VMs used to pick matched[0]
        // silently, hiding the other VMs' points. Surface candidates so the answer is never
        // silently incomplete; the caller re-queries with a specific VM name.
        if (pick.ambiguous) {
          throw new Error(
            `"${vmName}" casa ${pick.candidates.length} VMs distintas: ${pick.candidates.slice(0, 12).join(', ')}.\n` +
            `Especifique o nome completo da VM (ex: "${pick.candidates[0]}") para ver seus restore points.`
          );
        }
        console.log(`[findVmIdByName] [primary] Found: "${pick.name}" (backupObjectId: ${pick.id})`);
        return pick.id;
      }
    }

    // @MX:NOTE: RC3 — endpoint reachable but no object matches. Frame as an informative
    // FINDING (the target simply has no restore points indexed), not a bare failure, and
    // point to the next step — Agent/physical backups may not appear as backupObjects.
    const suggestions = objects.slice(0, 10).map(o => o.name).join(', ');
    throw new Error(
      `Nenhuma VM/objeto de backup casa "${vmName}" — esse alvo nao tem pontos de restauracao indexados.\n` +
      `Pode nao estar em nenhum job de backup de VM, OU ser um backup de Agent/servidor fisico (que nao aparece como backupObject).\n` +
      `Proximo passo: veeam_search_backup_jobs(nameFilter="${vmName}") localiza jobs de VM, Agent e Copy.\n` +
      (suggestions ? `Objetos parecidos: ${suggestions}\n` : '') +
      `Busca e parcial, sem acento e sem distinguir maiusculas.`
    );
  }

  if (primaryResponse.status !== 404) {
    // Non-404 error on primary path — surface it directly
    const errorText = await primaryResponse.text();
    throw new Error(`Failed to look up VM via backupObjects (HTTP ${primaryResponse.status}): ${errorText}`);
  }

  // ── Fallback path: /api/v1/vmRestorePoints (original approach) ────────────
  console.log(`[findVmIdByName] Primary path returned 404; falling back to /api/v1/vmRestorePoints`);

  const fallbackUrl = `https://${host}:${port}/api/v1/vmRestorePoints?limit=1000&skip=0`;
  const fallbackResponse = await vbrFetch(fallbackUrl, { method: 'GET', headers, agent: httpsAgent });

  if (!fallbackResponse.ok) {
    const errorText = await fallbackResponse.text();
    throw new Error(
      `Both VM lookup paths failed.\n` +
      `backupObjects: HTTP 404 (endpoint not available on this server)\n` +
      `vmRestorePoints: HTTP ${fallbackResponse.status} — ${errorText}`
    );
  }

  const allPoints = await fallbackResponse.json();

  if (!allPoints.data || allPoints.data.length === 0) {
    throw new Error("No restore points found on this server. No VMs have backups.");
  }

  // Group by unique VM
  const vmMap = new Map();
  allPoints.data.forEach(point => {
    if (!vmMap.has(point.vmId)) {
      vmMap.set(point.vmId, {
        vmId: point.vmId,
        vmName: point.vmName,
        platformName: point.platformName
      });
    }
  });

  const uniqueVMs = Array.from(vmMap.values());
  const matchedVMs = searchByName(uniqueVMs, vmName, 'vmName');

  if (matchedVMs.length === 0) {
    const availableVMs = uniqueVMs.slice(0, 10).map(vm => vm.vmName).join(', ');
    throw new Error(
      `Nenhuma VM casa "${vmName}" — esse alvo nao tem pontos de restauracao indexados.\n` +
      `Proximo passo: veeam_search_backup_jobs(nameFilter="${vmName}") localiza jobs de VM, Agent e Copy.\n` +
      `VMs disponiveis (primeiras 10): ${availableVMs}\n` +
      `Busca e parcial, sem acento e sem distinguir maiusculas.`
    );
  }

  // @MX:NOTE: V1 — same distinct-VM disambiguation as the primary path (was matchedVMs[0]).
  const pickFb = selectVmMatch(matchedVMs);
  if (pickFb.ambiguous) {
    throw new Error(
      `"${vmName}" casa ${pickFb.candidates.length} VMs distintas: ${pickFb.candidates.slice(0, 12).join(', ')}.\n` +
      `Especifique o nome completo da VM (ex: "${pickFb.candidates[0]}") para ver seus restore points.`
    );
  }
  console.log(`[findVmIdByName] [fallback] Found VM: "${pickFb.name}" (ID: ${pickFb.id})`);
  return pickFb.id;
}

function formatRestorePointType(type) {
  const types = {
    "Full": "Full Backup",
    "Incremental": "Incremental Backup",
    "Differential": "Differential Backup",
    "Replica": "Replication Point",
    "BackupCopy": "Backup Copy"
  };
  return types[type] || type;
}

function calculateAgeInDays(creationTime) {
  if (!creationTime) return 0;
  const diffMs = Date.now() - new Date(creationTime).getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function analyzeRestorePoints(points) {
  const analysis = { totalPoints: points.length, byType: {}, totalSize: 0, averageSize: 0, retentionRange: {} };

  points.forEach(point => {
    const type = point.type || "Unknown";
    analysis.byType[type] = (analysis.byType[type] || 0) + 1;
    if (point.size) analysis.totalSize += point.size;
  });

  analysis.averageSize = points.length > 0 ? analysis.totalSize / points.length : 0;
  analysis.totalSizeFormatted = formatBytes(analysis.totalSize);
  analysis.averageSizeFormatted = formatBytes(analysis.averageSize);

  if (points.length > 0) {
    analysis.retentionRange = {
      oldestDays: calculateAgeInDays(points[points.length - 1].creationTime),
      newestDays: calculateAgeInDays(points[0].creationTime)
    };
  }

  return analysis;
}
