// tools/search-restore-points.js
// Consolidated tool: replaces veeam_list_restore_points
// SPEC-VEEAM-ENHANCE-001 / F04 — Tool Consolidation
//
// Renamed for consistency. Same parameters, same API logic.

import fetch from "node-fetch";
import https from "https";
import { z } from "zod";
import { ensureAuthenticated } from "../lib/auth-middleware.js";
import { formatDateTime, formatBytes } from "../lib/format-helpers.js";
import { enrichListResponse, createMCPResponse, addPerformanceMetrics } from "../lib/response-enricher.js";
import { searchByName } from "../lib/description-helpers.js";

const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.VEEAM_IGNORE_SSL === 'true'
});

export default function(server) {
  server.tool(
    "veeam_search_restore_points",
    {
      vmName: z.string().optional().describe("VM name with semantic search (partial, accent-insensitive). Use vmName OR vmId"),
      vmId: z.string().optional().describe("VM UUID. Use vmName OR vmId"),
      limit: z.number().min(1).max(50).default(25).describe("Maximum restore points to retrieve (default: 25, max: 50)")
    },
    async (params) => {
      const startTime = Date.now();
      const { vmName, vmId, limit = 25 } = params;

      try {
        // Validate at least one parameter
        if (!vmName && !vmId) {
          throw new Error(
            "You must provide vmName OR vmId.\n" +
            'Examples: vmName: "VM-Production-01" or vmId: "3fa85f64-5717-4562-b3fc-2c963f66afa6"'
          );
        }

        const { host, port, token, apiVersion } = await ensureAuthenticated();
        let finalVmId = vmId;

        // If only vmName provided, search for vmId
        if (!vmId && vmName) {
          console.log(`[veeam_search_restore_points] Searching vmId for vmName: "${vmName}"`);
          finalVmId = await findVmIdByName(vmName, host, port, token, apiVersion);
        }

        console.log(`[veeam_search_restore_points] Fetching restore points for VM ID: ${finalVmId}`);

        const queryParams = new URLSearchParams({
          limit: limit.toString(),
          skip: '0',
          vmIdFilter: finalVmId
        });

        const apiUrl = `https://${host}:${port}/api/v1/vmRestorePoints?${queryParams.toString()}`;
        console.log(`[veeam_search_restore_points] GET ${apiUrl}`);

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

        // Analyze
        const analysis = analyzeRestorePoints(enrichedPoints);

        // Build response
        const responseData = {
          summary: {
            message: `${enrichedPoints.length} restore point(s) available`,
            vmName: vmName || enrichedPoints[0]?.vmName || "N/A",
            vmId: finalVmId,
            count: enrichedPoints.length,
            mostRecent: enrichedPoints[0]?.creationTimeFormatted || "N/A",
            oldest: enrichedPoints[enrichedPoints.length - 1]?.creationTimeFormatted || "N/A",
            timestamp: new Date().toISOString()
          },
          analysis,
          restorePoints: enrichedPoints.map(point => ({
            id: point.id,
            vmName: point.vmName,
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
          restorePointsData.pagination
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
          content: [{ type: "text", text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );
}

// ============================================================================
// Helper functions
// ============================================================================

async function findVmIdByName(vmName, host, port, token, apiVersion) {
  console.log(`[findVmIdByName] Searching VM: "${vmName}"`);

  const queryParams = new URLSearchParams({ limit: '1000', skip: '0' });
  const apiUrl = `https://${host}:${port}/api/v1/vmRestorePoints?${queryParams.toString()}`;

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
    throw new Error(`Failed to fetch VMs (HTTP ${response.status}): ${errorText}`);
  }

  const allPoints = await response.json();

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
      `No VM found matching "${vmName}".\n` +
      `Available VMs (first 10): ${availableVMs}\n` +
      `Tips: search is accent-insensitive and case-insensitive.`
    );
  }

  const foundVM = matchedVMs[0];
  console.log(`[findVmIdByName] Found VM: "${foundVM.vmName}" (ID: ${foundVM.vmId})`);
  return foundVM.vmId;
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
