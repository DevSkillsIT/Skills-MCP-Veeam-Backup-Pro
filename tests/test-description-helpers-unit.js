#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
// UNIT TESTS: Description Helpers Library
// ════════════════════════════════════════════════════════════════════════════
//
// Testa as 6 funções principais da biblioteca description-helpers.js
// Foco em validação, parsing, busca e formatação.
//
// ════════════════════════════════════════════════════════════════════════════

import {
  parseJobDescription,
  formatDescriptionForAI,
  getDescriptionFallback,
  isDescriptionValid,
  searchByDescription,
  enrichJobWithDescription
} from '../lib/description-helpers.js';

// ════════════════════════════════════════════════════════════════════════════
// CONFIGURAÇÃO DE TESTES
// ════════════════════════════════════════════════════════════════════════════

const TESTS_PASSED = [];
const TESTS_FAILED = [];

// Cores para output
const colors = {
  green: '\x1b[0;32m',
  red: '\x1b[0;31m',
  yellow: '\x1b[1;33m',
  blue: '\x1b[0;34m',
  reset: '\x1b[0m'
};

// ════════════════════════════════════════════════════════════════════════════
// UTILITÁRIOS
// ════════════════════════════════════════════════════════════════════════════

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Expected ${expected}, but got ${actual}. ${message}`);
  }
}

function assertIncludes(str, substring, message) {
  if (!str.includes(substring)) {
    throw new Error(`Expected string to include "${substring}". ${message}`);
  }
}

function test(name, fn) {
  try {
    fn();
    TESTS_PASSED.push(name);
    console.log(`${colors.green}✅ PASS${colors.reset}: ${name}`);
  } catch (error) {
    TESTS_FAILED.push({ name, error: error.message });
    console.log(`${colors.red}❌ FAIL${colors.reset}: ${name}`);
    console.log(`   ${colors.red}${error.message}${colors.reset}`);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// DADOS DE TESTE
// ════════════════════════════════════════════════════════════════════════════

// Description estruturado válido (padrão MSP)
const descriptionValid = 'Cliente: ACME Corp | ID: CLI-001 | Local: Curitiba | Contrato: Premium';

// Description com espaços extras
const descriptionValidWithSpaces = 'Cliente:  Ramada Hotéis  | ID:  CLI-002  | Local:  São Paulo  | Contrato:  Enterprise';

// Description não estruturado (genérico)
const descriptionGeneric = 'Backup job for VMware infrastructure';

// Description vazio
const descriptionEmpty = '';

// Description null
const descriptionNull = null;

// Description undefined
const descriptionUndefined = undefined;

// Jobs para teste de searchByDescription
const jobsSample = [
  {
    id: '1',
    name: 'BKP-ACME-001',
    description: 'Cliente: ACME Corp | ID: CLI-001 | Local: Curitiba | Contrato: Premium'
  },
  {
    id: '2',
    name: 'BKP-RAMADA-001',
    description: 'Cliente: Ramada Hotéis | ID: CLI-002 | Local: São Paulo | Contrato: Enterprise'
  },
  {
    id: '3',
    name: 'BKP-TECHCO-001',
    description: 'Cliente: TechCo Solutions | ID: CLI-015 | Local: Curitiba | Contrato: Standard'
  },
  {
    id: '4',
    name: 'BKP-GENERIC-001',
    description: 'Backup job for generic infrastructure'
  },
  {
    id: '5',
    name: 'BKP-NO-DESC-001',
    description: ''
  }
];

// ════════════════════════════════════════════════════════════════════════════
// TESTES: parseJobDescription()
// ════════════════════════════════════════════════════════════════════════════

console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
console.log(`${colors.blue}TEST GROUP: parseJobDescription()${colors.reset}`);
console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);

test('Parse valid structured description', () => {
  const result = parseJobDescription(descriptionValid);

  assert(result.isValid, 'Should be valid');
  assert(result.isParsed, 'Should be parsed');
  assertEqual(result.clientName, 'ACME Corp', 'Client name');
  assertEqual(result.clientId, 'CLI-001', 'Client ID');
  assertEqual(result.location, 'Curitiba', 'Location');
  assertEqual(result.contractType, 'Premium', 'Contract type');
});

test('Parse description with extra spaces', () => {
  const result = parseJobDescription(descriptionValidWithSpaces);

  assert(result.isValid, 'Should be valid');
  assert(result.isParsed, 'Should be parsed');
  assertEqual(result.clientName, 'Ramada Hotéis', 'Client name with spaces trimmed');
  assertEqual(result.clientId, 'CLI-002', 'Client ID with spaces trimmed');
  assertEqual(result.location, 'São Paulo', 'Location with spaces trimmed');
  assertEqual(result.contractType, 'Enterprise', 'Contract type with spaces trimmed');
});

test('Parse generic (non-structured) description', () => {
  const result = parseJobDescription(descriptionGeneric);

  assert(result.isValid, 'Should be valid (has content)');
  assert(!result.isParsed, 'Should NOT be parsed (does not match pattern)');
  assert(!result.clientName, 'Client name should be null');
  assert(!result.clientId, 'Client ID should be null');
  assertEqual(result.raw, descriptionGeneric, 'Raw should match input');
});

test('Parse empty description', () => {
  const result = parseJobDescription(descriptionEmpty);

  assert(!result.isValid, 'Should not be valid (empty)');
  assert(!result.isParsed, 'Should not be parsed');
  assertEqual(result.raw, descriptionEmpty, 'Raw should be empty string');
});

test('Parse null description', () => {
  const result = parseJobDescription(descriptionNull);

  assert(!result.isValid, 'Should not be valid (null)');
  assert(!result.isParsed, 'Should not be parsed');
  assertEqual(result.raw, '', 'Raw should be empty string');
});

test('Parse undefined description', () => {
  const result = parseJobDescription(descriptionUndefined);

  assert(!result.isValid, 'Should not be valid (undefined)');
  assert(!result.isParsed, 'Should not be parsed');
  assertEqual(result.raw, '', 'Raw should be empty string');
});

// ════════════════════════════════════════════════════════════════════════════
// TESTES: formatDescriptionForAI()
// ════════════════════════════════════════════════════════════════════════════

console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
console.log(`${colors.blue}TEST GROUP: formatDescriptionForAI()${colors.reset}`);
console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);

test('Format structured description for AI', () => {
  const result = formatDescriptionForAI(descriptionValid);

  assertIncludes(result, 'ACME Corp', 'Should include client name');
  assertIncludes(result, 'CLI-001', 'Should include client ID');
  assertIncludes(result, 'Curitiba', 'Should include location');
  assertIncludes(result, 'Premium', 'Should include contract type');
  assertIncludes(result, 'Backup job para cliente', 'Should use natural language format');
});

test('Format generic description for AI', () => {
  const result = formatDescriptionForAI(descriptionGeneric);

  assertEqual(result, descriptionGeneric, 'Should return generic description as-is');
});

test('Format empty description for AI', () => {
  const result = formatDescriptionForAI(descriptionEmpty);

  assertIncludes(result, 'Sem informações', 'Should return placeholder message');
});

// ════════════════════════════════════════════════════════════════════════════
// TESTES: getDescriptionFallback()
// ════════════════════════════════════════════════════════════════════════════

console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
console.log(`${colors.blue}TEST GROUP: getDescriptionFallback()${colors.reset}`);
console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);

test('Get fallback for job with valid description', () => {
  const job = { name: 'BKP-TEST', description: descriptionValid };
  const result = getDescriptionFallback(job);

  assertEqual(result, descriptionValid, 'Should return job description');
});

test('Get fallback for job with empty description', () => {
  const job = { name: 'BKP-ACME-001', description: '' };
  const result = getDescriptionFallback(job);

  assertIncludes(result, 'BKP-ACME-001', 'Should include job name in fallback');
  assertIncludes(result, 'Sem informações', 'Should include placeholder message');
});

test('Get fallback for invalid job object', () => {
  const result = getDescriptionFallback(null);

  assertIncludes(result, 'Unknown', 'Should handle null gracefully');
});

// ════════════════════════════════════════════════════════════════════════════
// TESTES: isDescriptionValid()
// ════════════════════════════════════════════════════════════════════════════

console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
console.log(`${colors.blue}TEST GROUP: isDescriptionValid()${colors.reset}`);
console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);

test('Validate structured description', () => {
  assert(isDescriptionValid(descriptionValid), 'Structured description should be valid');
});

test('Validate generic description', () => {
  assert(isDescriptionValid(descriptionGeneric), 'Generic description should be valid');
});

test('Reject empty description', () => {
  assert(!isDescriptionValid(descriptionEmpty), 'Empty description should be invalid');
});

test('Reject null description', () => {
  assert(!isDescriptionValid(null), 'Null description should be invalid');
});

test('Reject whitespace-only description', () => {
  assert(!isDescriptionValid('   '), 'Whitespace-only description should be invalid');
});

test('Reject too-short description', () => {
  assert(!isDescriptionValid('AB'), 'Description shorter than 3 chars should be invalid');
});

test('Accept minimum valid length', () => {
  assert(isDescriptionValid('ABC'), 'Description with exactly 3 chars should be valid');
});

// ════════════════════════════════════════════════════════════════════════════
// TESTES: searchByDescription()
// ════════════════════════════════════════════════════════════════════════════

console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
console.log(`${colors.blue}TEST GROUP: searchByDescription()${colors.reset}`);
console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);

test('Search by client name', () => {
  const results = searchByDescription(jobsSample, 'ACME');

  assertEqual(results.length, 1, 'Should find 1 result');
  assertEqual(results[0].id, '1', 'Should find ACME job');
});

test('Search by client ID', () => {
  const results = searchByDescription(jobsSample, 'CLI-002');

  assertEqual(results.length, 1, 'Should find 1 result');
  assertEqual(results[0].id, '2', 'Should find Ramada job');
});

test('Search by location', () => {
  const results = searchByDescription(jobsSample, 'Curitiba');

  assertEqual(results.length, 2, 'Should find 2 results (ACME and TechCo)');
  assert(results.some(j => j.id === '1'), 'Should include ACME job');
  assert(results.some(j => j.id === '3'), 'Should include TechCo job');
});

test('Search by contract type', () => {
  const results = searchByDescription(jobsSample, 'Enterprise');

  assertEqual(results.length, 1, 'Should find 1 result');
  assertEqual(results[0].id, '2', 'Should find Ramada job');
});

test('Case-insensitive search', () => {
  const results = searchByDescription(jobsSample, 'acme');

  assertEqual(results.length, 1, 'Should find ACME case-insensitively');
});

test('Search returns empty array for no matches', () => {
  const results = searchByDescription(jobsSample, 'NonExistent');

  assertEqual(results.length, 0, 'Should return empty array');
});

test('Search with empty jobs array', () => {
  const results = searchByDescription([], 'ACME');

  assertEqual(results.length, 0, 'Should return empty array');
});

test('Search with empty search term', () => {
  const results = searchByDescription(jobsSample, '');

  assertEqual(results.length, jobsSample.length, 'Should return all jobs when search term is empty');
});

// ════════════════════════════════════════════════════════════════════════════
// TESTES: enrichJobWithDescription()
// ════════════════════════════════════════════════════════════════════════════

console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
console.log(`${colors.blue}TEST GROUP: enrichJobWithDescription()${colors.reset}`);
console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);

test('Enrich job with valid description', () => {
  const job = { id: '1', name: 'BKP-TEST', description: descriptionValid };
  const result = enrichJobWithDescription(job);

  // Validar que job original não foi modificado
  assert(job.description === descriptionValid, 'Original job should not be modified');

  // Validar que resultado tem campos extras
  assert(result.descriptionParsed, 'Should have descriptionParsed');
  assert(result.descriptionFormatted, 'Should have descriptionFormatted');
  assert(result.descriptionValid, 'Should have descriptionValid flag');

  // Validar conteúdo
  assertEqual(result.descriptionParsed.clientName, 'ACME Corp', 'Parsed client name');
  assertIncludes(result.descriptionFormatted, 'Backup job para cliente', 'Formatted has natural language');
});

test('Enrich job with empty description', () => {
  const job = { id: '2', name: 'BKP-EMPTY', description: '' };
  const result = enrichJobWithDescription(job);

  assert(result.descriptionParsed, 'Should have descriptionParsed');
  assert(!result.descriptionValid, 'Should mark as invalid');
  assertEqual(result.descriptionFormatted, '[Sem informações de cliente]', 'Formatted has placeholder');
});

test('Enrich job with null description', () => {
  const job = { id: '3', name: 'BKP-NULL', description: null };
  const result = enrichJobWithDescription(job);

  assert(result.descriptionParsed, 'Should have descriptionParsed');
  assert(!result.descriptionValid, 'Should mark as invalid');
});

// ════════════════════════════════════════════════════════════════════════════
// RELATÓRIO FINAL
// ════════════════════════════════════════════════════════════════════════════

console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
console.log(`${colors.blue}TEST RESULTS SUMMARY${colors.reset}`);
console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);

console.log(`\n${colors.green}✅ PASSED: ${TESTS_PASSED.length}${colors.reset}`);
TESTS_PASSED.forEach(name => {
  console.log(`   • ${name}`);
});

if (TESTS_FAILED.length > 0) {
  console.log(`\n${colors.red}❌ FAILED: ${TESTS_FAILED.length}${colors.reset}`);
  TESTS_FAILED.forEach(({ name, error }) => {
    console.log(`   • ${name}`);
    console.log(`     ${colors.red}${error}${colors.reset}`);
  });
}

const total = TESTS_PASSED.length + TESTS_FAILED.length;
const successRate = ((TESTS_PASSED.length / total) * 100).toFixed(1);

console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
console.log(`Total Tests: ${total}`);
console.log(`Success Rate: ${successRate}%`);
console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

// Exit code baseado em sucesso/falha
process.exit(TESTS_FAILED.length > 0 ? 1 : 0);
