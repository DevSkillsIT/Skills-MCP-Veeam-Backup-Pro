// lib/resources.js
// MCP Resources handler para dados estaticos do Veeam VBR
// SPEC-VEEAM-ENHANCE-001 / F06
//
// Resources sao contexto passivo (read-only) que o usuario/aplicacao
// pode carregar. Ideais para dados que nao mudam frequentemente.

import { ensureAuthenticated } from './auth-middleware.js';
import { vbrFetch } from './veeam-fetch.js';
import { formatServerInfo, formatLicenseInfo } from './formatters/veeam-formatters.js';

/**
 * Definicoes dos resources MCP disponiveis.
 */
export const VEEAM_RESOURCES = [
  {
    uri: 'veeam://server-info',
    name: 'Veeam Server Info',
    description: 'Informacoes do servidor VBR (versao, build, banco de dados)',
    mimeType: 'text/markdown',
    annotations: {
      audience: ['assistant'],
      priority: 0.8
    }
  },
  {
    uri: 'veeam://license',
    name: 'Veeam License Info',
    description: 'Licenciamento do servidor VBR (tipo, status, expiracao, workloads)',
    mimeType: 'text/markdown',
    annotations: {
      audience: ['assistant'],
      priority: 0.7
    }
  }
];

/**
 * Lista todos os resources disponiveis.
 * @returns {{ resources: Array }}
 */
export function listResources() {
  return { resources: VEEAM_RESOURCES };
}

/**
 * Le um resource especifico por URI.
 * @param {string} uri - URI do resource (veeam://server-info, veeam://license)
 * @returns {Promise<{ contents: Array }>}
 */
export async function readResource(uri) {
  const { host, port, token, apiVersion } = await ensureAuthenticated();

  const headers = {
    'accept': 'application/json',
    'x-api-version': apiVersion,
    'Authorization': `Bearer ${token}`
  };

  switch (uri) {
    case 'veeam://server-info': {
      const res = await vbrFetch(`https://${host}:${port}/api/v1/serverInfo`, { headers });
      if (!res.ok) throw new Error(`Veeam API error: ${res.status}`);
      const data = await res.json();
      return {
        contents: [{
          uri,
          mimeType: 'text/markdown',
          text: formatServerInfo(data)
        }]
      };
    }

    case 'veeam://license': {
      // @MX:NOTE: /license/workloads is 404 on this VBR; workload breakdown is already in
      // /license under instanceLicenseSummary (formatLicenseInfo reads it). No second call.
      const res = await vbrFetch(`https://${host}:${port}/api/v1/license`, { headers });
      if (!res.ok) throw new Error(`Veeam API error: ${res.status}`);
      const data = await res.json();

      return {
        contents: [{
          uri,
          mimeType: 'text/markdown',
          text: formatLicenseInfo(data)
        }]
      };
    }

    default:
      throw new Error(
        `Resource URI invalida: "${uri}". ` +
        `URIs disponiveis: ${VEEAM_RESOURCES.map(r => r.uri).join(', ')}.`
      );
  }
}
