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
// Agora: AIs podem buscar por informações do cliente (ex: "jobs do cliente Aurora em Curitiba")
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
 *   raw: "Cliente: Aurora Hotéis | ID: CLI-001 | Local: Curitiba | Contrato: Premium",
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
 * Normaliza string removendo acentos e caracteres especiais.
 *
 * OBJETIVO:
 * Permitir busca que ignora acentos (Gráfica = Grafica).
 *
 * TRANSFORMAÇÕES:
 * - Remove acentos: á→a, é→e, ç→c, ã→a, etc.
 * - Converte para lowercase
 * - Remove caracteres especiais (mantém apenas letras, números e espaços)
 *
 * @param {string} text - Texto a normalizar
 * @returns {string} Texto normalizado
 *
 * @example
 * normalizeText("Gráfica São José LTDA")
 * // Retorna: "grafica sao jose ltda"
 */
function normalizeText(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    .toLowerCase()
    .normalize('NFD') // Decompor caracteres Unicode (á → a + ́)
    .replace(/[\u0300-\u036f]/g, '') // Remover marcas diacríticas
    .replace(/[^a-z0-9\s]/g, ' ') // Remover caracteres especiais (manter letras, números, espaços)
    .replace(/\s+/g, ' ') // Normalizar múltiplos espaços em um só
    .trim();
}

/**
 * Filtra jobs por termo de busca no campo description COM BUSCA SEMÂNTICA.
 *
 * BUSCA SEMÂNTICA INTELIGENTE:
 * - Tokenização: Quebra termo em palavras individuais
 * - Normalização: Remove acentos (Gráfica → grafica)
 * - Busca flexível: Encontra jobs que contenham QUALQUER palavra do termo
 * - Relevância: Ordena por número de palavras encontradas
 *
 * EXEMPLO PRÁTICO:
 * Termo: "Grafica Boreal Atlantica"
 * Palavras extraídas: ["grafica", "boreal", "atlantica"]
 * Jobs encontrados:
 *   ✅ "Gráfica Boreal Atlantica LTDA" (3 palavras = 100% relevância)
 *   ✅ "Cliente: GRAFICA BOREAL ATLANTICA | ID: CLI-003" (3 palavras)
 *   ✅ "Boreal Atlantica Gráfica e Editora" (3 palavras, ordem diferente)
 *   ✅ "Gráfica Atlantica Comunicação" (2 palavras = 66% relevância)
 *   ❌ "TechCo Solutions" (0 palavras = sem match)
 *
 * FUNCIONALIDADE:
 * - Busca case-insensitive
 * - Busca sem acentos (Gráfica = Grafica)
 * - Busca em TODOS os campos extraídos do description:
 *   * Nome do cliente
 *   * ID do cliente
 *   * Localização
 *   * Tipo de contrato
 *   * Description raw (completo)
 *
 * CASOS DE USO:
 * - "Grafica Boreal Atlantica" → encontra "Gráfica Boreal Atlantica LTDA"
 * - "Aurora Curitiba" → encontra jobs com "Aurora" E/OU "Curitiba"
 * - "CLI-001" → busca exata por ID do cliente
 * - "Premium" → encontra todos contratos Premium
 *
 * PERFORMANCE:
 * - Complexidade: O(n × m) onde n = número de jobs, m = número de palavras
 * - Ordenação adicional por relevância
 *
 * @param {Array<Object>} jobs - Array de jobs Veeam
 * @param {string} searchTerm - Termo a buscar no description
 * @returns {Array<Object>} Jobs que correspondem ao termo de busca (ordenados por relevância)
 *
 * @example
 * // Buscar jobs do cliente "Grafica Boreal Atlantica"
 * const jobs = [
 *   { name: "BKP-1", description: "Cliente: Gráfica Boreal Atlantica LTDA | ID: CLI-003 | Local: Curitiba" },
 *   { name: "BKP-2", description: "Cliente: TechCo Solutions | ID: CLI-015 | Local: São Paulo" },
 *   { name: "BKP-3", description: "Cliente: Gráfica Atlantica | ID: CLI-020 | Local: Curitiba" }
 * ];
 * searchByDescription(jobs, "Grafica Boreal Atlantica")
 * // Retorna (ordenado por relevância):
 * // [
 * //   { name: "BKP-1", ... }, // 3 palavras (grafica, boreal, atlantica)
 * //   { name: "BKP-3", ... }  // 2 palavras (grafica, atlantica)
 * // ]
 *
 * @example
 * // Buscar jobs em "Curitiba" ou do cliente "Aurora"
 * searchByDescription(jobs, "Aurora Curitiba")
 * // Retorna: Jobs que contenham "aurora" OU "curitiba"
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

  // ══════════════════════════════════════════════════════════════
  // TOKENIZAÇÃO SEMÂNTICA
  // ══════════════════════════════════════════════════════════════
  // Normalizar termo de busca e quebrar em palavras individuais
  const normalizedSearchTerm = normalizeText(searchTerm);
  const searchWords = normalizedSearchTerm
    .split(/\s+/) // Quebrar por espaços
    .filter(word => word.length > 0); // Remover strings vazias

  // Log para debugging
  console.log(`[searchByDescription] 🔍 Busca semântica:`);
  console.log(`[searchByDescription]    Termo original: "${searchTerm}"`);
  console.log(`[searchByDescription]    Termo normalizado: "${normalizedSearchTerm}"`);
  console.log(`[searchByDescription]    Palavras extraídas: [${searchWords.map(w => `"${w}"`).join(', ')}]`);
  console.log(`[searchByDescription]    Total de palavras: ${searchWords.length}`);

  // Se não houver palavras válidas, retornar todos os jobs
  if (searchWords.length === 0) {
    console.warn('[searchByDescription] No valid words extracted from search term');
    return jobs;
  }

  // ══════════════════════════════════════════════════════════════
  // FILTRAGEM COM SCORE DE RELEVÂNCIA
  // ══════════════════════════════════════════════════════════════
  const jobsWithScore = jobs
    .map(job => {
      // Validar que job tem campo description
      if (!job || !job.description) {
        return { job, score: 0, matchedWords: [] };
      }

      // Parsear description para extrair metadados
      const parsed = parseJobDescription(job.description);

      // Criar string de busca com todos os campos relevantes
      const searchableText = [
        parsed.raw || '',
        parsed.clientName || '',
        parsed.clientId || '',
        parsed.location || '',
        parsed.contractType || ''
      ].join(' ');

      // Normalizar texto onde vamos buscar
      const normalizedSearchableText = normalizeText(searchableText);

      // Contar quantas palavras do termo foram encontradas
      let score = 0;
      const matchedWords = [];

      searchWords.forEach(word => {
        if (normalizedSearchableText.includes(word)) {
          score++;
          matchedWords.push(word);
        }
      });

      return { job, score, matchedWords };
    })
    .filter(item => item.score > 0) // Manter apenas jobs com pelo menos 1 palavra encontrada
    .sort((a, b) => b.score - a.score); // Ordenar por relevância (mais palavras = mais relevante)

  // Log de resultados
  console.log(`[searchByDescription] 📊 Resultados:`);
  console.log(`[searchByDescription]    Jobs analisados: ${jobs.length}`);
  console.log(`[searchByDescription]    Jobs encontrados: ${jobsWithScore.length}`);

  if (jobsWithScore.length > 0) {
    console.log(`[searchByDescription] 🎯 Top 3 matches:`);
    jobsWithScore.slice(0, 3).forEach((item, index) => {
      const relevancePercent = Math.round((item.score / searchWords.length) * 100);
      console.log(`[searchByDescription]    ${index + 1}. "${item.job.name}" - ${item.score}/${searchWords.length} palavras (${relevancePercent}%) - [${item.matchedWords.join(', ')}]`);
    });
  }

  // Retornar apenas os jobs (sem score)
  return jobsWithScore.map(item => item.job);
}

/**
 * Filtra objetos por termo de busca no campo NAME COM BUSCA SEMÂNTICA.
 *
 * BUSCA SEMÂNTICA INTELIGENTE:
 * - Tokenização: Quebra termo em palavras individuais
 * - Normalização: Remove acentos (Gráfica → grafica)
 * - Busca flexível: Encontra objetos cujo nome contenha QUALQUER palavra do termo
 * - Relevância: Ordena por número de palavras encontradas
 *
 * EXEMPLO PRÁTICO:
 * Termo: "Grafica Boreal Atlantica"
 * Palavras extraídas: ["grafica", "boreal", "atlantica"]
 * Jobs encontrados:
 *   ✅ "BKP-GRAFICA-BOREAL-ATLANTICA-VM" (3 palavras = 100% relevância)
 *   ✅ "BKP-GB-ATLANTICA-LOCAL" (2 palavras = 66% relevância)
 *   ✅ "REPLICA-BOREAL-VCENTER" (1 palavra = 33% relevância)
 *   ❌ "BKP-TECHCO-SOLUTIONS" (0 palavras = sem match)
 *
 * CASOS DE USO:
 * - Buscar job por nome parcial (ex: "Aurora" encontra "BKP-AURORA-VCENTER")
 * - Buscar VM por nome parcial (ex: "SQL Server" encontra "VM-SQL-SERVER-PROD")
 * - Buscar siglas (ex: "GS" encontra jobs com "GS" no nome)
 * - Buscar multi-palavra (ex: "Grafica Boreal" encontra nomes com ambas palavras)
 *
 * @param {Array<Object>} objects - Array de objetos com campo 'name'
 * @param {string} searchTerm - Termo a buscar no campo name
 * @param {string} fieldName - Nome do campo a buscar (default: 'name')
 * @returns {Array<Object>} Objetos que correspondem ao termo de busca (ordenados por relevância)
 *
 * @example
 * // Buscar jobs por nome
 * const jobs = [
 *   { name: "BKP-GRAFICA-BOREAL-ATLANTICA-VM", id: "1" },
 *   { name: "BKP-TECHCO-SOLUTIONS", id: "2" },
 *   { name: "BKP-GB-ATLANTICA-LOCAL", id: "3" }
 * ];
 * searchByName(jobs, "Grafica Boreal Atlantica")
 * // Retorna (ordenado por relevância):
 * // [
 * //   { name: "BKP-GRAFICA-BOREAL-ATLANTICA-VM", ... }, // 3 palavras
 * //   { name: "BKP-GB-ATLANTICA-LOCAL", ... }           // 2 palavras
 * // ]
 */
export function searchByName(objects, searchTerm, fieldName = 'name') {
  // ══════════════════════════════════════════════════════════════
  // VALIDAÇÕES DE ENTRADA
  // ══════════════════════════════════════════════════════════════
  if (!Array.isArray(objects)) {
    console.warn(`[searchByName] Objects parameter is not an array`);
    return [];
  }

  if (!searchTerm || typeof searchTerm !== 'string') {
    console.warn(`[searchByName] SearchTerm is empty or not a string`);
    return objects; // Sem filtro, retorna todos
  }

  // ══════════════════════════════════════════════════════════════
  // TOKENIZAÇÃO SEMÂNTICA
  // ══════════════════════════════════════════════════════════════
  const normalizedSearchTerm = normalizeText(searchTerm);
  const searchWords = normalizedSearchTerm
    .split(/\s+/)
    .filter(word => word.length > 0);

  // Log para debugging
  console.log(`[searchByName] 🔍 Busca semântica:`);
  console.log(`[searchByName]    Campo: "${fieldName}"`);
  console.log(`[searchByName]    Termo original: "${searchTerm}"`);
  console.log(`[searchByName]    Termo normalizado: "${normalizedSearchTerm}"`);
  console.log(`[searchByName]    Palavras extraídas: [${searchWords.map(w => `"${w}"`).join(', ')}]`);

  if (searchWords.length === 0) {
    console.warn('[searchByName] No valid words extracted from search term');
    return objects;
  }

  // ══════════════════════════════════════════════════════════════
  // FILTRAGEM COM SCORE DE RELEVÂNCIA
  // ══════════════════════════════════════════════════════════════
  const objectsWithScore = objects
    .map(obj => {
      // Validar que objeto tem campo name
      const nameValue = obj[fieldName];
      if (!nameValue || typeof nameValue !== 'string') {
        return { obj, score: 0, matchedWords: [] };
      }

      // Normalizar nome
      const normalizedName = normalizeText(nameValue);

      // Contar quantas palavras do termo foram encontradas
      let score = 0;
      const matchedWords = [];

      searchWords.forEach(word => {
        if (normalizedName.includes(word)) {
          score++;
          matchedWords.push(word);
        }
      });

      return { obj, score, matchedWords };
    })
    .filter(item => item.score > 0) // Apenas objetos com pelo menos 1 palavra
    .sort((a, b) => b.score - a.score); // Ordenar por relevância

  // Log de resultados
  console.log(`[searchByName] 📊 Resultados:`);
  console.log(`[searchByName]    Objetos analisados: ${objects.length}`);
  console.log(`[searchByName]    Objetos encontrados: ${objectsWithScore.length}`);

  if (objectsWithScore.length > 0) {
    console.log(`[searchByName] 🎯 Top 3 matches:`);
    objectsWithScore.slice(0, 3).forEach((item, index) => {
      const relevancePercent = Math.round((item.score / searchWords.length) * 100);
      console.log(`[searchByName]    ${index + 1}. "${item.obj[fieldName]}" - ${item.score}/${searchWords.length} palavras (${relevancePercent}%) - [${item.matchedWords.join(', ')}]`);
    });
  }

  // Retornar apenas os objetos (sem score)
  return objectsWithScore.map(item => item.obj);
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
 *   name: "BKP-LOCAL-AURORA",
 *   description: "Cliente: Aurora Hotéis | ID: CLI-001 | Local: Curitiba | Contrato: Premium"
 * };
 *
 * enrichJobWithDescription(job)
 * // Retorna:
 * {
 *   id: "abc-123",
 *   name: "BKP-LOCAL-AURORA",
 *   description: "Cliente: Aurora Hotéis | ID: CLI-001 | Local: Curitiba | Contrato: Premium",
 *   descriptionParsed: {
 *     clientName: "ACME Corp",
 *     clientId: "CLI-001",
 *     location: "Curitiba",
 *     contractType: "Premium",
 *     isValid: true,
 *     isParsed: true
 *   },
 *   descriptionFormatted: "Backup job para cliente Aurora Hotéis (ID: CLI-001) em Curitiba com contrato Premium",
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
