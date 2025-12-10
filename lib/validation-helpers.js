// lib/validation-helpers.js
// Validadores para operações POST/PATCH/DELETE (start/stop jobs, etc)
// Valida existência de recursos e estados antes de executar operações

import { ensureAuthenticated } from './auth-middleware.js';
import https from "https";
import fetch from "node-fetch";
import { JOB_STATES } from './veeam-dictionaries.js';

// HTTPS agent com suporte a certificados self-signed
const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.VEEAM_IGNORE_SSL === 'true'
});

/**
 * Valida se um job existe e está no estado correto para a operação
 *
 * @param {string} jobId - ID do job a validar
 * @param {string} operation - Operação a executar ("start" ou "stop")
 * @returns {Promise<Object>} Dados do job se válido
 * @throws {Error} Se job não existir ou estado for inválido
 */
export async function validateJobOperation(jobId, operation) {
  const { host, port, token, apiVersion } = await ensureAuthenticated();

  // 1. Verificar se job existe
  console.log(`[VALIDATION] Verificando existência do job: ${jobId}`);

  const jobUrl = `https://${host}:${port}/api/v1/jobs/${jobId}`;

  try {
    const jobResponse = await fetch(jobUrl, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'x-api-version': apiVersion,
        'Authorization': `Bearer ${token}`
      },
      agent: httpsAgent
    });

    if (!jobResponse.ok) {
      if (jobResponse.status === 404) {
        throw new Error(
          `Job com ID "${jobId}" não foi encontrado no VBR server.\n` +
          `Verifique:\n` +
          `1. Se o ID está correto (use get-backup-jobs para listar jobs)\n` +
          `2. Se você tem permissão para visualizar este job\n` +
          `3. Se o job não foi excluído recentemente`
        );
      }

      const errorText = await jobResponse.text();
      throw new Error(
        `Erro ao verificar job (HTTP ${jobResponse.status}): ${errorText}`
      );
    }

    const job = await jobResponse.json();

    console.log(`[VALIDATION] Job encontrado: "${job.name}" (tipo: ${job.type}, estado: ${job.state})`);

    // 2. Validar estado para a operação solicitada
    if (operation === 'start') {
      return validateJobCanStart(job);
    }

    if (operation === 'stop') {
      return validateJobCanStop(job);
    }

    // Operação desconhecida
    throw new Error(`Operação desconhecida: "${operation}". Use "start" ou "stop".`);

  } catch (error) {
    // Re-throw com contexto adicional
    if (error.message.includes('Job com ID')) {
      throw error; // Já é uma mensagem formatada
    }

    throw new Error(`Falha na validação do job: ${error.message}`);
  }
}

/**
 * Valida se job pode ser iniciado
 *
 * @param {Object} job - Objeto job da API
 * @returns {Object} Job se válido
 * @throws {Error} Se job não puder ser iniciado
 */
function validateJobCanStart(job) {
  const stateName = JOB_STATES[job.state]?.code || `Unknown (${job.state})`;

  // Job pode ser iniciado se:
  // - Estado é "Stopped" (0)
  // - Schedule está desabilitado (jobs manuais)

  if (job.state === 0) {
    // Estado "Stopped" - pode iniciar
    console.log(`[VALIDATION] ✅ Job pode ser iniciado (estado: ${stateName})`);
    return job;
  }

  // Job em qualquer outro estado não pode ser iniciado manualmente
  throw new Error(
    `Job "${job.name}" não pode ser iniciado no estado atual.\n\n` +
    `Estado atual: ${stateName}\n` +
    `Tipo: ${job.type}\n` +
    `Schedule habilitado: ${job.scheduleEnabled ? 'Sim' : 'Não'}\n\n` +
    `Apenas jobs no estado "Stopped" (0) podem ser iniciados manualmente.\n\n` +
    `Possíveis causas:\n` +
    `- Job já está em execução (state=3)\n` +
    `- Job está iniciando (state=1)\n` +
    `- Job está em pós-processamento (state=8)\n` +
    `- Job aguarda repositório/tape (state=6 ou 9)\n\n` +
    `Aguarde o job terminar ou pare-o antes de tentar iniciar novamente.`
  );
}

/**
 * Valida se job pode ser parado
 *
 * @param {Object} job - Objeto job da API
 * @returns {Object} Job se válido
 * @throws {Error} Se job não puder ser parado
 */
function validateJobCanStop(job) {
  const stateName = JOB_STATES[job.state]?.code || `Unknown (${job.state})`;

  // Job pode ser parado se:
  // - Estado é "Working" (3)
  // - Estado é "Starting" (1)
  // - Estado é "Postprocessing" (8)

  const stoppableStates = [1, 3, 8];

  if (stoppableStates.includes(job.state)) {
    console.log(`[VALIDATION] ✅ Job pode ser parado (estado: ${stateName})`);
    return job;
  }

  // Job não está em execução
  throw new Error(
    `Job "${job.name}" não pode ser parado no estado atual.\n\n` +
    `Estado atual: ${stateName}\n` +
    `Tipo: ${job.type}\n\n` +
    `Apenas jobs em execução ou iniciando podem ser parados.\n` +
    `Estados válidos para stop: Working (3), Starting (1), Postprocessing (8)\n\n` +
    `Possíveis causas:\n` +
    `- Job já está parado (state=0)\n` +
    `- Job já está sendo parado (state=2)\n` +
    `- Job está em pausa (state=4 ou 7)\n\n` +
    `Se o job já está parado, não há necessidade de pará-lo novamente.`
  );
}

/**
 * Valida se uma session existe
 *
 * @param {string} sessionId - ID da session
 * @returns {Promise<Object>} Dados da session se existir
 * @throws {Error} Se session não existir
 */
export async function validateSessionExists(sessionId) {
  const { host, port, token, apiVersion } = await ensureAuthenticated();

  console.log(`[VALIDATION] Verificando existência da session: ${sessionId}`);

  const sessionUrl = `https://${host}:${port}/api/v1/sessions/${sessionId}`;

  try {
    const sessionResponse = await fetch(sessionUrl, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'x-api-version': apiVersion,
        'Authorization': `Bearer ${token}`
      },
      agent: httpsAgent
    });

    if (!sessionResponse.ok) {
      if (sessionResponse.status === 404) {
        throw new Error(
          `Session com ID "${sessionId}" não foi encontrada.\n` +
          `Verifique:\n` +
          `1. Se o ID está correto (use get-backup-sessions para listar sessions)\n` +
          `2. Se você tem permissão para visualizar esta session\n` +
          `3. Se a session não foi deletada automaticamente (retention policy)`
        );
      }

      const errorText = await sessionResponse.text();
      throw new Error(
        `Erro ao verificar session (HTTP ${sessionResponse.status}): ${errorText}`
      );
    }

    const session = await sessionResponse.json();

    console.log(`[VALIDATION] ✅ Session encontrada: "${session.name}"`);

    return session;

  } catch (error) {
    if (error.message.includes('Session com ID')) {
      throw error;
    }

    throw new Error(`Falha na validação da session: ${error.message}`);
  }
}

/**
 * Valida ID do Veeam (UUID v4 format)
 *
 * @param {string} id - ID a validar
 * @param {string} resourceType - Tipo de recurso (job, session, etc)
 * @throws {Error} Se ID for inválido
 */
export function validateVeeamId(id, resourceType = "recurso") {
  if (!id || typeof id !== 'string') {
    throw new Error(`ID do ${resourceType} é obrigatório e deve ser uma string`);
  }

  // IDs do Veeam geralmente são UUIDs v4
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(id)) {
    throw new Error(
      `ID do ${resourceType} inválido: "${id}"\n` +
      `Esperado: UUID v4 (formato: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)\n` +
      `Exemplo: 3fa85f64-5717-4562-b3fc-2c963f66afa6`
    );
  }
}

/**
 * Valida parâmetros comuns de paginação
 *
 * @param {number} limit - Limite de resultados
 * @param {number} skip - Número de resultados a pular
 * @throws {Error} Se parâmetros forem inválidos
 */
export function validatePaginationParams(limit, skip) {
  if (limit !== undefined && limit !== null) {
    if (typeof limit !== 'number' || limit < 1 || limit > 1000) {
      throw new Error(
        `Parâmetro "limit" inválido: ${limit}\n` +
        `Deve ser um número entre 1 e 1000`
      );
    }
  }

  if (skip !== undefined && skip !== null) {
    if (typeof skip !== 'number' || skip < 0) {
      throw new Error(
        `Parâmetro "skip" inválido: ${skip}\n` +
        `Deve ser um número >= 0`
      );
    }
  }
}
