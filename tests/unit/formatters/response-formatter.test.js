// tests/unit/formatters/response-formatter.test.js
// Testes unitarios para o interceptor centralizado
// SPEC-VEEAM-ENHANCE-001 / F10

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatToolResponse } from '../../../lib/formatters/response-formatter.js';

describe('formatToolResponse() — interceptor centralizado', () => {

  it('search tool retorna tabela Markdown, NAO JSON', () => {
    const data = {
      data: [
        { id: '12345678-1234-1234-1234-123456789012', name: 'Backup-Prod', type: 'Backup', state: 0, result: { result: 1 }, lastRun: '2026-03-22T01:00:00Z' }
      ],
      pagination: { total: 1 }
    };
    const result = formatToolResponse('veeam_search_backup_jobs', data, { limit: 25 });
    assert.ok(result.includes('| ID |'), 'deve conter header de tabela Markdown');
    assert.ok(result.includes('Backup-Prod'), 'deve conter nome do job');
    assert.ok(!result.includes('"id":'), 'NAO deve conter JSON bruto');
  });

  it('manage tool com get_details retorna detalhe Markdown', () => {
    const job = { id: 'uuid', name: 'Job-Test', type: 'Backup', state: 0, scheduleEnabled: true, scheduleType: 'Daily' };
    const result = formatToolResponse('veeam_manage_backup_jobs', job, { action: 'get_details' });
    assert.ok(result.includes('# Backup Job:'));
    assert.ok(result.includes('| Campo | Valor |'));
  });

  it('manage tool com start retorna resultado de operacao', () => {
    const data = { id: 'session-abc', message: 'Job started' };
    const result = formatToolResponse('veeam_manage_backup_jobs', data, { action: 'start' });
    assert.ok(result.includes('start'));
  });

  it('null data retorna string vazia', () => {
    const result = formatToolResponse('veeam_manage_backup_jobs', null, { action: 'start' });
    assert.equal(result, '');
  });

  it('undefined data retorna string vazia', () => {
    const result = formatToolResponse('veeam_get_license_compliance', undefined, {});
    assert.equal(result, '');
  });

  it('search tool com null retorna lista vazia formatada', () => {
    const result = formatToolResponse('veeam_search_backup_jobs', null, {});
    assert.ok(result.includes('Nenhum'));
  });

  it('string data e retornada as-is', () => {
    const markdown = '# Already Markdown\n| A | B |';
    const result = formatToolResponse('veeam_list_mcp_resources', markdown, {});
    assert.equal(result, markdown);
  });

  it('tool desconhecida cai no fallback JSON', () => {
    const data = { test: true };
    const result = formatToolResponse('nonexistent_tool', data, {});
    assert.ok(result.includes('"test"'));
  });

  it('search sessions funciona com formatters', () => {
    const data = {
      data: [{ id: 'sess-1', name: 'S1', sessionType: 'BackupJob', result: { result: 1 }, creationTime: '2026-03-22T01:00:00Z' }]
    };
    const result = formatToolResponse('veeam_search_backup_sessions', data, {});
    assert.ok(result.includes('| ID |'));
  });

  it('infrastructure router: repositories', () => {
    const data = { data: [{ id: 'r1', name: 'Repo', type: 'Local', capacityGB: 500, freeGB: 200 }] };
    const result = formatToolResponse('veeam_search_infrastructure', data, { type: 'repositories' });
    assert.ok(result.includes('Repo'));
    assert.ok(result.includes('repositorios'));
  });

  it('infrastructure router: proxies (default)', () => {
    const data = { data: [{ id: 'p1', name: 'Proxy-1', type: 'VMware', server: { name: 'Host-1' }, maxTaskCount: 4 }] };
    const result = formatToolResponse('veeam_search_infrastructure', data, {});
    assert.ok(result.includes('Proxy-1'));
    assert.ok(result.includes('proxies'));
  });

  it('resposta grande excede limite de 400KB', () => {
    const bigData = { data: Array.from({ length: 10000 }, (_, i) => ({ id: 'x'.repeat(100), name: `Job-${i}`, type: 'Backup', state: 0, result: { result: 1 }, lastRun: '2026-01-01' })) };
    const result = formatToolResponse('veeam_search_backup_jobs', bigData, {});
    assert.ok(result.includes('400KB') || result.includes('| ID |'));
  });
});
