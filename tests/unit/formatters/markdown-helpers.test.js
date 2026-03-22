// tests/unit/formatters/markdown-helpers.test.js
// Testes unitarios para markdown-helpers.js
// SPEC-VEEAM-ENHANCE-001 / F10
//
// Usa Node.js test runner nativo (sem dependencias extras)

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  esc,
  truncate,
  pageInfo,
  checkResponseSize,
  formatDateTime,
  formatBytes
} from '../../../lib/formatters/markdown-helpers.js';

describe('esc()', () => {
  it('escapa pipes para tabelas Markdown', () => {
    assert.equal(esc('valor|com|pipes'), 'valor\\|com\\|pipes');
  });

  it('retorna string vazia para null', () => {
    assert.equal(esc(null), '');
  });

  it('retorna string vazia para undefined', () => {
    assert.equal(esc(undefined), '');
  });

  it('converte numeros para string', () => {
    assert.equal(esc(42), '42');
  });

  it('converte boolean para string', () => {
    assert.equal(esc(true), 'true');
  });

  it('retorna texto sem pipes inalterado', () => {
    assert.equal(esc('texto normal'), 'texto normal');
  });
});

describe('truncate()', () => {
  it('trunca texto longo com "..."', () => {
    const longText = 'A'.repeat(400);
    const result = truncate(longText, 300);
    assert.equal(result.length, 303); // 300 + "..."
    assert.ok(result.endsWith('...'));
  });

  it('nao trunca texto curto', () => {
    assert.equal(truncate('curto', 300), 'curto');
  });

  it('retorna string vazia para null', () => {
    assert.equal(truncate(null), '');
  });

  it('retorna string vazia para undefined', () => {
    assert.equal(truncate(undefined), '');
  });

  it('escapa pipes no texto truncado', () => {
    assert.equal(truncate('a|b', 100), 'a\\|b');
  });

  it('usa default maxLen=300', () => {
    const text = 'X'.repeat(350);
    const result = truncate(text);
    assert.ok(result.length <= 303);
  });
});

describe('pageInfo()', () => {
  it('mostra contagem e paginacao quando total > count', () => {
    const result = pageInfo(25, 25, 0, 100);
    assert.ok(result.includes('**25 resultados**'));
    assert.ok(result.includes('Pagina 1'));
    assert.ok(result.includes('total: 100'));
  });

  it('mostra "Mostrando todos" quando total = count', () => {
    const result = pageInfo(10, 25, 0, 10);
    assert.ok(result.includes('**10 resultados**'));
    assert.ok(result.includes('Mostrando todos'));
  });

  it('calcula pagina corretamente com skip', () => {
    const result = pageInfo(25, 25, 50, 200);
    assert.ok(result.includes('Pagina 3'));
  });

  it('mostra "Mostrando todos" sem total', () => {
    const result = pageInfo(5, 25, 0);
    assert.ok(result.includes('Mostrando todos'));
  });
});

describe('checkResponseSize()', () => {
  it('retorna exceeded=false para texto pequeno', () => {
    const result = checkResponseSize('texto pequeno');
    assert.equal(result.exceeded, false);
    assert.ok(result.size > 0);
  });

  it('retorna exceeded=true para texto > 400KB', () => {
    const bigText = 'X'.repeat(500 * 1024);
    const result = checkResponseSize(bigText);
    assert.equal(result.exceeded, true);
    assert.ok(result.message.includes('400KB'));
  });

  it('aceita limite customizado', () => {
    const text = 'X'.repeat(200);
    const result = checkResponseSize(text, 100);
    assert.equal(result.exceeded, true);
  });
});

describe('re-exports from format-helpers.js', () => {
  it('formatDateTime formata data ISO', () => {
    const result = formatDateTime('2026-03-22T14:30:00Z');
    assert.ok(result.includes('/'));
    assert.ok(result.includes(':'));
  });

  it('formatDateTime retorna N/A para null', () => {
    assert.equal(formatDateTime(null), 'N/A');
  });

  it('formatBytes formata bytes', () => {
    const result = formatBytes(1073741824);
    assert.ok(result.includes('GB'));
  });

  it('formatBytes retorna 0 B para zero', () => {
    assert.equal(formatBytes(0), '0 B');
  });
});
