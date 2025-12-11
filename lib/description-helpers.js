// lib/description-helpers.js
// ════════════════════════════════════════════════════════════════════════════
// BIBLIOTECA DE HELPERS PARA CAMPO DESCRIPTION - MSP MULTI-CLIENT OPERATIONS
// ════════════════════════════════════════════════════════════════════════════
//
// CONTEXTO MSP (Managed Service Provider):
// ----------------------------------------
// Skills IT gerencia backups para MÚLTIPLOS CLIENTES (diversos clientes MSP).
// O campo DESCRIPTION nos jobs do Veeam é CRÍTICO porque contém metadados do cliente:
// - Nome do cliente
// - ID do cliente
// - Localização
// - Tipo de contrato
//
// PROBLEMA RESOLVIDO:
// -------------------
// Antes: AIs tentavam buscar jobs apenas pelo nome técnico (ex: "BKP-JOB-LOCAL-OK-PMW-VCENTER-SERVER-SKILLS")
// Agora: AIs podem buscar por informações do cliente (ex: "jobs do cliente Ramada em Curitiba")
//
// FORMATO PADRÃO DE DESCRIPTION:
// ------------------------------
// "Cliente: {nome} | ID: {id} | Local: {local} | Contrato: {tipo}"
//
// Exemplos reais:
// - "Cliente: ACME Corp | ID: CLI-001 | Local: Curitiba | Contrato: Premium"
// - "Cliente: TechCo Solutions | ID: CLI-015 | Local: São Paulo | Contrato: Enterprise"
// - "Cliente: Skills IT | ID: CLI-INTERNO | Local: Curitiba | Contrato: Interno"
//
// USO PELAS FERRAMENTAS MCP:
// --------------------------
// - parseJobDescription(): Extrai metadados estruturados do campo description
// - formatDescriptionForAI(): Formata description para consumo por AIs (linguagem natural)
// - getDescriptionFallback(): Retorna placeholder quando description está vazio
// - isDescriptionValid(): Valida se description tem conteúdo útil
// - searchByDescription(): Filtra jobs por qualquer termo no description (cliente, ID, local)
//
// ════════════════════════════════════════════════════════════════════════════

/**
 * Extrai metadados estruturados do campo description de um job Veeam.
 *
 * FORMATO ESPERADO:
 * "Cliente: {nome} | ID: {id} | Local: {local} | Contrato: {tipo}"
 *
 * COMPORTAMENTO:
 * - Se description segue o padrão → retorna objeto estruturado
 * - Se description não segue padrão → retorna raw description + flags de validação
 * - Se description vazio/null → retorna objeto com valores null
 *
 * @param {string} description - Campo description do job Veeam
 * @returns {Object} Metadados estruturados do cliente
 *
 * @example
 * // Description bem formatado
 * parseJobDescription("Cliente: ACME Corp | ID: CLI-001 | Local: Curitiba | Contrato: Premium")
 * // Retorna:
 * {
 *   clientName: "ACME Corp",
 *   clientId: "CLI-001",
 *   location: "Curitiba",
 *   contractType: "Premium",
 *   raw: "Cliente: Ramada Hotéis | ID: CLI-001 | Local: Curitiba | Contrato: Premium",
 *   isValid: true,
 *   isParsed: true
 * }
 *
 * @example
 * // Description mal formatado ou genérico
 * parseJobDescription("Backup job for VMware")
 * // Retorna:
 * {
 *   clientName: null,
 *   clientId: null,
 *   location: null,
 *   contractType: null,
 *   raw: "Backup job for VMware",
 *   isValid: true,
 *   isParsed: false
 * }
 *
 * @example
 * // Description vazio
 * parseJobDescription("")
 * // Retorna:
 * {
 *   clientName: null,
 *   clientId: null,
 *   location: null,
 *   contractType: null,
 *   raw: "",
 *   isValid: false,
 *   isParsed: false
 * }
 */
export function parseJobDescription(description) {
  // ══════════════════════════════════════════════════════════════
  // FALLBACK 1: Description nulo ou undefined
  // ══════════════════════════════════════════════════════════════
  if (!description || typeof description !== 'string') {
    return {
      clientName: null,
      clientId: null,
      location: null,
      contractType: null,
      raw: "",
      isValid: false,
      isParsed: false,
      parseError: "Description is null, undefined, or not a string"
    };
  }

  // ══════════════════════════════════════════════════════════════
  // FALLBACK 2: Description vazio ou só whitespace
  // ══════════════════════════════════════════════════════════════
  const trimmed = description.trim();
  if (trimmed.length === 0) {
    return {
      clientName: null,
      clientId: null,
      location: null,
      contractType: null,
      raw: description,
      isValid: false,
      isParsed: false,
      parseError: "Description is empty or whitespace only"
    };
  }

  // ══════════════════════════════════════════════════════════════
  // PARSING: Tentar extrair campos estruturados
  // ══════════════════════════════════════════════════════════════
  // Regex para capturar formato: "Cliente: X | ID: Y | Local: Z | Contrato: W"
  // Permite variações (case-insensitive, espaços extras)
  const regex = /Cliente:\s*([^|]+)\s*\|\s*ID:\s*([^|]+)\s*\|\s*Local:\s*([^|]+)\s*\|\s*Contrato:\s*(.+)/i;
  const match = trimmed.match(regex);

  // ══════════════════════════════════════════════════════════════
  // RESULTADO: Description segue padrão estruturado
  // ══════════════════════════════════════════════════════════════
  if (match) {
    return {
      clientName: match[1].trim(),
      clientId: match[2].trim(),
      location: match[3].trim(),
      contractType: match[4].trim(),
      raw: description,
      isValid: true,
      isParsed: true
    };
  }

  // ══════════════════════════════════════════════════════════════
  // FALLBACK 3: Description não segue padrão (genérico/livre)
  // ══════════════════════════════════════════════════════════════
  // Ainda é válido (tem conteúdo), mas não foi possível parsear
  return {
    clientName: null,
    clientId: null,
    location: null,
    contractType: null,
    raw: description,
    isValid: true,
    isParsed: false,
    parseError: "Description does not match expected format 'Cliente: X | ID: Y | Local: Z | Contrato: W'"
  };
}

/**
 * Formata description para consumo por AIs (linguagem natural).
 *
 * OBJETIVO:
 * Transformar metadados estruturados em texto natural que AIs entendam facilmente.
 *
 * CASOS DE USO:
 * - Listar jobs de forma amigável para humanos/AIs
 * - Contexto para AIs entenderem qual cliente está sendo backupado
 * - Respostas de ferramentas MCP mais descritivas
 *
 * @param {string} description - Campo description do job
 * @returns {string} Description formatado para linguagem natural
 *
 * @example
 * formatDescriptionForAI("Cliente: ACME Corp | ID: CLI-001 | Local: Curitiba | Contrato: Premium")
 * // Retorna: "Backup job para cliente ACME Corp (ID: CLI-001) em Curitiba com contrato Premium"
 *
 * @example
 * formatDescriptionForAI("Backup job for VMware")
 * // Retorna: "Backup job for VMware"
 *
 * @example
 * formatDescriptionForAI("")
 * // Retorna: "[Sem informações de cliente]"
 */
export function formatDescriptionForAI(description) {
  // Parsear description para extrair metadados
  const parsed = parseJobDescription(description);

  // ══════════════════════════════════════════════════════════════
  // CASO 1: Description vazio ou inválido
  // ══════════════════════════════════════════════════════════════
  if (!parsed.isValid) {
    return "[Sem informações de cliente]";
  }

  // ══════════════════════════════════════════════════════════════
  // CASO 2: Description estruturado (padrão MSP)
  // ══════════════════════════════════════════════════════════════
  if (parsed.isParsed) {
    return `Backup job para cliente ${parsed.clientName} (ID: ${parsed.clientId}) em ${parsed.location} com contrato ${parsed.contractType}`;
  }

  // ══════════════════════════════════════════════════════════════
  // CASO 3: Description livre (não estruturado)
  // ══════════════════════════════════════════════════════════════
  // Retornar como está (pode ser um description genérico válido)
  return parsed.raw;
}

/**
 * Retorna fallback quando description está vazio.
 *
 * OBJETIVO:
 * Garantir que ferramentas MCP sempre retornem algo útil,
 * mesmo quando o campo description não foi preenchido.
 *
 * COMPORTAMENTO:
 * - Se job tem description válido → retorna description
 * - Se job não tem description → retorna placeholder com nome do job
 *
 * @param {Object} job - Objeto job do Veeam
 * @param {string} job.name - Nome técnico do job
 * @param {string} job.description - Campo description (pode ser vazio)
 * @returns {string} Description ou fallback
 *
 * @example
 * getDescriptionFallback({ name: "BKP-LOCAL-ACME", description: "" })
 * // Retorna: "[Sem informações de cliente] - Job: BKP-LOCAL-ACME"
 *
 * @example
 * getDescriptionFallback({
 *   name: "BKP-LOCAL-ACME",
 *   description: "Cliente: ACME Corp | ID: CLI-001 | Local: Curitiba | Contrato: Premium"
 * })
 * // Retorna: "Cliente: ACME Corp | ID: CLI-001 | Local: Curitiba | Contrato: Premium"
 */
export function getDescriptionFallback(job) {
  // Validar que job é um objeto válido
  if (!job || typeof job !== 'object') {
    return "[Sem informações de cliente] - Job: Unknown";
  }

  // Validar se description existe e não está vazio
  const parsed = parseJobDescription(job.description);

  if (parsed.isValid) {
    // Description existe e tem conteúdo → retornar como está
    return job.description;
  }

  // Description vazio → retornar placeholder com nome do job
  const jobName = job.name || "Unknown";
  return `[Sem informações de cliente] - Job: ${jobName}`;
}

/**
 * Valida se description tem conteúdo útil.
 *
 * CRITÉRIOS DE VALIDAÇÃO:
 * ✅ Não é null/undefined
 * ✅ Não é string vazia
 * ✅ Não é só whitespace
 * ✅ Tem pelo menos 3 caracteres (evita descriptions triviais)
 *
 * USO:
 * - Antes de processar description (evitar processamento inútil)
 * - Logs/warnings quando description inválido
 * - Filtros que exigem description válido
 *
 * @param {string} description - Campo description a validar
 * @returns {boolean} true se description é válido, false caso contrário
 *
 * @example
 * isDescriptionValid("Cliente: ACME Corp | ID: CLI-001 | Local: Curitiba | Contrato: Premium")
 * // Retorna: true
 *
 * @example
 * isDescriptionValid("")
 * // Retorna: false
 *
 * @example
 * isDescriptionValid("   ")
 * // Retorna: false
 *
 * @example
 * isDescriptionValid("AB")
 * // Retorna: false (menos de 3 caracteres)
 */
export function isDescriptionValid(description) {
  // Verificar tipo e existência
  if (!description || typeof description !== 'string') {
    return false;
  }

  // Remover whitespace e verificar tamanho mínimo
  const trimmed = description.trim();
  if (trimmed.length < 3) {
    return false;
  }

  return true;
}

/**
 * Filtra jobs por termo de busca no campo description.
 *
 * FUNCIONALIDADE:
 * - Busca case-insensitive
 * - Busca em TODOS os campos extraídos do description:
 *   * Nome do cliente
 *   * ID do cliente
 *   * Localização
 *   * Tipo de contrato
 *   * Description raw (completo)
 *
 * CASOS DE USO:
 * - "Listar jobs do cliente Ramada" → busca por "Ramada"
 * - "Listar jobs em Curitiba" → busca por "Curitiba"
 * - "Listar jobs CLI-001" → busca por "CLI-001"
 * - "Listar contratos Premium" → busca por "Premium"
 *
 * PERFORMANCE:
 * - Evita regex complexos (usa includes simples)
 * - Cache de parsing não implementado (pode ser adicionado se necessário)
 * - Complexidade: O(n) onde n = número de jobs
 *
 * @param {Array<Object>} jobs - Array de jobs Veeam
 * @param {string} searchTerm - Termo a buscar no description
 * @returns {Array<Object>} Jobs que correspondem ao termo de busca
 *
 * @example
 * // Buscar jobs do cliente ACME
 * const jobs = [
 *   { name: "BKP-1", description: "Cliente: ACME Corp | ID: CLI-001 | Local: Curitiba | Contrato: Premium" },
 *   { name: "BKP-2", description: "Cliente: TechCo Solutions | ID: CLI-015 | Local: São Paulo | Contrato: Enterprise" }
 * ];
 * searchByDescription(jobs, "ACME")
 * // Retorna: [{ name: "BKP-1", description: "Cliente: ACME Corp..." }]
 *
 * @example
 * // Buscar jobs em Curitiba
 * searchByDescription(jobs, "Curitiba")
 * // Retorna: [{ name: "BKP-1", description: "Cliente: Ramada Hotéis..." }]
 *
 * @example
 * // Buscar por ID do cliente
 * searchByDescription(jobs, "CLI-015")
 * // Retorna: [{ name: "BKP-2", description: "Cliente: TechCo Solutions..." }]
 */
export function searchByDescription(jobs, searchTerm) {
  // ══════════════════════════════════════════════════════════════
  // VALIDAÇÕES DE ENTRADA
  // ══════════════════════════════════════════════════════════════
  if (!Array.isArray(jobs)) {
    console.warn('[searchByDescription] Jobs parameter is not an array');
    return [];
  }

  if (!searchTerm || typeof searchTerm !== 'string') {
    console.warn('[searchByDescription] SearchTerm is empty or not a string');
    return jobs; // Sem filtro, retorna todos
  }

  const normalizedSearch = searchTerm.toLowerCase().trim();

  // ══════════════════════════════════════════════════════════════
  // FILTRAGEM
  // ══════════════════════════════════════════════════════════════
  return jobs.filter(job => {
    // Validar que job tem campo description
    if (!job || !job.description) {
      return false;
    }

    // Parsear description para extrair metadados
    const parsed = parseJobDescription(job.description);

    // Buscar em description raw (completo)
    if (parsed.raw.toLowerCase().includes(normalizedSearch)) {
      return true;
    }

    // Se foi parseado com sucesso, buscar em campos estruturados
    if (parsed.isParsed) {
      // Buscar em nome do cliente
      if (parsed.clientName && parsed.clientName.toLowerCase().includes(normalizedSearch)) {
        return true;
      }

      // Buscar em ID do cliente
      if (parsed.clientId && parsed.clientId.toLowerCase().includes(normalizedSearch)) {
        return true;
      }

      // Buscar em localização
      if (parsed.location && parsed.location.toLowerCase().includes(normalizedSearch)) {
        return true;
      }

      // Buscar em tipo de contrato
      if (parsed.contractType && parsed.contractType.toLowerCase().includes(normalizedSearch)) {
        return true;
      }
    }

    return false;
  });
}

/**
 * Enriquece objeto job com metadados de description parseados.
 *
 * OBJETIVO:
 * Adicionar campos extras ao objeto job para facilitar consumo por AIs.
 *
 * CAMPOS ADICIONADOS:
 * - descriptionParsed: Metadados estruturados (clientName, clientId, location, contractType)
 * - descriptionFormatted: Description formatado para linguagem natural
 * - descriptionValid: Boolean indicando se description é válido
 *
 * USO:
 * - Respostas de ferramentas MCP (adicionar metadados extras)
 * - Facilitar busca/filtro por AIs
 * - Evitar re-parsing múltiplo do mesmo description
 *
 * @param {Object} job - Objeto job Veeam
 * @returns {Object} Job enriquecido com metadados de description
 *
 * @example
 * const job = {
 *   id: "abc-123",
 *   name: "BKP-LOCAL-RAMADA",
 *   description: "Cliente: Ramada Hotéis | ID: CLI-001 | Local: Curitiba | Contrato: Premium"
 * };
 *
 * enrichJobWithDescription(job)
 * // Retorna:
 * {
 *   id: "abc-123",
 *   name: "BKP-LOCAL-RAMADA",
 *   description: "Cliente: Ramada Hotéis | ID: CLI-001 | Local: Curitiba | Contrato: Premium",
 *   descriptionParsed: {
 *     clientName: "ACME Corp",
 *     clientId: "CLI-001",
 *     location: "Curitiba",
 *     contractType: "Premium",
 *     isValid: true,
 *     isParsed: true
 *   },
 *   descriptionFormatted: "Backup job para cliente Ramada Hotéis (ID: CLI-001) em Curitiba com contrato Premium",
 *   descriptionValid: true
 * }
 */
export function enrichJobWithDescription(job) {
  if (!job || typeof job !== 'object') {
    return job;
  }

  // Parsear description
  const parsed = parseJobDescription(job.description);

  // Formatar para AI
  const formatted = formatDescriptionForAI(job.description);

  // Retornar job enriquecido (não modificar original)
  return {
    ...job,
    descriptionParsed: {
      clientName: parsed.clientName,
      clientId: parsed.clientId,
      location: parsed.location,
      contractType: parsed.contractType,
      isValid: parsed.isValid,
      isParsed: parsed.isParsed
    },
    descriptionFormatted: formatted,
    descriptionValid: parsed.isValid
  };
}

// ════════════════════════════════════════════════════════════════════════════
// EXPORT DEFAULT (para compatibilidade CommonJS se necessário)
// ════════════════════════════════════════════════════════════════════════════
export default {
  parseJobDescription,
  formatDescriptionForAI,
  getDescriptionFallback,
  isDescriptionValid,
  searchByDescription,
  enrichJobWithDescription
};
