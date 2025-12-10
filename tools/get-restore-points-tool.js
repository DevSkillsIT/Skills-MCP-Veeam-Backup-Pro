// tools/get-restore-points-tool.js
// Tool para listar restore points disponíveis para uma VM
// Útil para operações de restore e verificação de retention

import fetch from "node-fetch";
import https from "https";
import { z } from "zod";
import { ensureAuthenticated } from "../lib/auth-middleware.js";
import { formatDateTime, formatBytes } from "../lib/format-helpers.js";
import { enrichListResponse, createMCPResponse, addPerformanceMetrics } from "../lib/response-enricher.js";

// HTTPS agent com suporte a certificados self-signed
const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.VEEAM_IGNORE_SSL === 'true'
});

export default function(server) {
  server.tool(
    "get-restore-points",
    {
      vmName: z.string().optional().describe("Nome da VM (usar OU vmId)"),
      vmId: z.string().optional().describe("ID da VM (usar OU vmName)"),
      limit: z.number().min(1).max(1000).default(100).describe("Máximo de restore points a retornar (padrão: 100)")
    },
    async (params) => {
      const startTime = Date.now();
      const { vmName, vmId, limit = 100 } = params;

      try {
        // Validar que pelo menos um parâmetro foi fornecido
        if (!vmName && !vmId) {
          throw new Error(
            "Você deve fornecer vmName OU vmId.\n" +
            "Exemplos:\n" +
            '  - vmName: "VM-Producao-01"\n' +
            '  - vmId: "3fa85f64-5717-4562-b3fc-2c963f66afa6"'
          );
        }

        // Autenticação
        const { host, port, token, apiVersion } = await ensureAuthenticated();

        let finalVmId = vmId;

        // Se apenas vmName foi fornecido, buscar vmId primeiro
        if (!vmId && vmName) {
          console.log(`[get-restore-points] Buscando vmId para vmName: "${vmName}"`);
          finalVmId = await findVmIdByName(vmName, host, port, token, apiVersion);
        }

        console.log(`[get-restore-points] Buscando restore points para VM ID: ${finalVmId}`);

        // Endpoint: GET /api/v1/vmRestorePoints?vmIdFilter={vmId}
        const queryParams = new URLSearchParams({
          limit: limit.toString(),
          skip: '0',
          vmIdFilter: finalVmId
        });

        const apiUrl = `https://${host}:${port}/api/v1/vmRestorePoints?${queryParams.toString()}`;
        console.log(`[get-restore-points] GET ${apiUrl}`);

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
          throw new Error(
            `Falha ao buscar restore points (HTTP ${response.status}): ${errorText}`
          );
        }

        const restorePointsData = await response.json();
        console.log(`[get-restore-points] Recebido: ${restorePointsData.data?.length || 0} restore points`);

        // Verificar se há restore points
        if (!restorePointsData.data || restorePointsData.data.length === 0) {
          const noPointsResponse = {
            summary: {
              message: "⚠️ Nenhum restore point encontrado para esta VM",
              vmName: vmName || "N/A",
              vmId: finalVmId,
              count: 0,
              timestamp: new Date().toISOString()
            },
            warning: {
              severity: "ALTO",
              message: "VM sem restore points não pode ser restaurada",
              possibleReasons: [
                "VM nunca foi incluída em um backup job",
                "Todos os restore points expiraram (retention policy)",
                "Backups foram deletados manualmente",
                "VM foi removida recentemente de jobs de backup",
                "VM ID incorreto ou VM não existe"
              ],
              recommendations: [
                "Verifique se VM está incluída em algum backup job (use get-backup-jobs)",
                "Configure backup job para esta VM se não houver",
                "Revise retention policy dos jobs",
                "Execute backup manual da VM (use start-backup-job)"
              ]
            }
          };

          const enrichedResponse = enrichListResponse(
            [],
            "get-restore-points",
            { vmName: vmName || null, vmId: finalVmId },
            { limit, skip: 0, total: 0 }
          );

          const finalResponse = {
            ...noPointsResponse,
            ...enrichedResponse
          };

          return createMCPResponse(addPerformanceMetrics(finalResponse, startTime));
        }

        // Processar e enriquecer restore points
        const enrichedPoints = restorePointsData.data.map(point => ({
          ...point,
          creationTimeFormatted: formatDateTime(point.creationTime),
          sizeFormatted: formatBytes(point.size),
          typeFormatted: formatRestorePointType(point.type),
          platformNameFormatted: point.platformName || "N/A"
        }));

        // Ordenar por data de criação (mais recente primeiro)
        enrichedPoints.sort((a, b) => new Date(b.creationTime) - new Date(a.creationTime));

        // Análise dos restore points
        const analysis = analyzeRestorePoints(enrichedPoints);

        // Construir resposta enriquecida
        const responseData = {
          summary: {
            message: `✅ ${enrichedPoints.length} restore point(s) disponível(is)`,
            vmName: vmName || enrichedPoints[0]?.vmName || "N/A",
            vmId: finalVmId,
            count: enrichedPoints.length,
            mostRecent: enrichedPoints.length > 0 ? enrichedPoints[0].creationTimeFormatted : "N/A",
            oldest: enrichedPoints.length > 0 ? enrichedPoints[enrichedPoints.length - 1].creationTimeFormatted : "N/A",
            timestamp: new Date().toISOString()
          },
          analysis: analysis,
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
            // Informações úteis para restore
            canRestore: true, // Assumindo que todos os points listados são restauráveis
            ageInDays: calculateAgeInDays(point.creationTime)
          }))
        };

        // Aplicar enriquecimento de lista
        const enrichedResponse = enrichListResponse(
          responseData.restorePoints,
          "get-restore-points",
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
        console.error('[get-restore-points] Erro:', error);

        const errorResponse = {
          error: true,
          message: error.message,
          tool: "get-restore-points",
          timestamp: new Date().toISOString(),
          troubleshooting: {
            tips: [
              "Verifique que vmName ou vmId está correto",
              "Use get-backup-jobs para verificar VMs incluídas em jobs",
              "Confirme que VM existe no environment virtualizado",
              "Verifique permissões do usuário no VBR"
            ]
          }
        };

        return createMCPResponse(addPerformanceMetrics(errorResponse, startTime), true);
      }
    }
  );
}

/**
 * Busca VM ID pelo nome usando query API
 */
async function findVmIdByName(vmName, host, port, token, apiVersion) {
  // Tentar buscar via query API (endpoint de pesquisa)
  // Nota: Endpoint exato pode variar entre versões do VBR
  // Fallback: retornar erro informativo se não encontrar

  console.log(`[get-restore-points] Buscando VM por nome não implementado ainda.`);
  console.log(`[get-restore-points] Use vmId ao invés de vmName para esta versão.`);

  throw new Error(
    `Busca por vmName não está implementada nesta versão.\n\n` +
    `Alternativas:\n` +
    `1. Use o parâmetro vmId ao invés de vmName\n` +
    `2. Consulte VBR console para obter o UUID da VM\n` +
    `3. Use PowerShell: Get-VBRBackup | Get-VBRRestorePoint | Where {$_.VmName -eq "${vmName}"}\n\n` +
    `Em breve será adicionado suporte para busca por nome.`
  );

  // Implementação futura:
  // const searchUrl = `https://${host}:${port}/api/v1/query?type=VirtualMachine&filter=name==${vmName}`;
  // ... implementar busca e retornar vmId
}

/**
 * Formata tipo de restore point
 */
function formatRestorePointType(type) {
  const types = {
    "Full": "Full Backup",
    "Incremental": "Backup Incremental",
    "Differential": "Backup Diferencial",
    "Replica": "Ponto de Replicação",
    "BackupCopy": "Cópia de Backup"
  };

  return types[type] || type;
}

/**
 * Calcula idade do restore point em dias
 */
function calculateAgeInDays(creationTime) {
  if (!creationTime) return 0;

  const created = new Date(creationTime);
  const now = new Date();
  const diffMs = now - created;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return days;
}

/**
 * Analisa restore points para fornecer insights
 */
function analyzeRestorePoints(points) {
  const analysis = {
    totalPoints: points.length,
    byType: {},
    totalSize: 0,
    averageSize: 0,
    retentionRange: {
      oldestDays: 0,
      newestDays: 0
    }
  };

  // Contar por tipo e calcular tamanho total
  points.forEach(point => {
    const type = point.type || "Unknown";
    if (!analysis.byType[type]) {
      analysis.byType[type] = 0;
    }
    analysis.byType[type]++;

    if (point.size) {
      analysis.totalSize += point.size;
    }
  });

  // Calcular tamanho médio
  analysis.averageSize = points.length > 0
    ? analysis.totalSize / points.length
    : 0;

  // Formatar tamanhos
  analysis.totalSizeFormatted = formatBytes(analysis.totalSize);
  analysis.averageSizeFormatted = formatBytes(analysis.averageSize);

  // Calcular retention range
  if (points.length > 0) {
    analysis.retentionRange.oldestDays = calculateAgeInDays(points[points.length - 1].creationTime);
    analysis.retentionRange.newestDays = calculateAgeInDays(points[0].creationTime);
  }

  return analysis;
}
