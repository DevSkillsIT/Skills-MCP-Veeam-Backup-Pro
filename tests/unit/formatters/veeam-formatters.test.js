// tests/unit/formatters/veeam-formatters.test.js
// Testes unitarios para formatadores Markdown Veeam
// SPEC-VEEAM-ENHANCE-001 / F10

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatBackupJobsList,
  formatBackupJobDetail,
  formatSessionsList,
  formatSessionLog,
  formatRestorePointsList,
  formatProxiesList,
  formatRepositoriesList,
  formatLicenseInfo,
  formatServerInfo,
  formatJobSchedule,
  formatOperationResult
} from '../../../lib/formatters/veeam-formatters.js';

// === BACKUP JOBS ===

describe('formatBackupJobsList()', () => {
  it('retorna tabela Markdown com headers corretos', () => {
    const data = {
      data: [
        { id: '12345678-1234-1234-1234-123456789012', name: 'Backup-VM-Prod', type: 'Backup', state: 1, result: { result: 1 }, lastRun: '2026-03-22T01:00:00Z' }
      ],
      pagination: { total: 1, count: 1 }
    };
    const result = formatBackupJobsList(data, { limit: 25, skip: 0 });
    assert.ok(result.includes('| ID |'));
    assert.ok(result.includes('| Nome |'));
    assert.ok(result.includes('Backup-VM-Prod'));
    assert.ok(result.includes('**1 resultados**'));
  });

  it('retorna mensagem para lista vazia', () => {
    const result = formatBackupJobsList({ data: [] }, {});
    assert.equal(result, 'Nenhum backup job encontrado.');
  });

  it('NAO contem JSON bruto', () => {
    const data = { data: [{ id: 'abc-123', name: 'Test', type: 'Backup', state: 0 }] };
    const result = formatBackupJobsList(data, {});
    assert.ok(!result.includes('"id":'));
    assert.ok(!result.includes('"name":'));
  });
});

describe('formatBackupJobDetail()', () => {
  it('retorna heading e tabela campo/valor', () => {
    const job = { id: 'uuid-123', name: 'Job-Prod', type: 'Backup', state: 0, platformName: 'VMware', scheduleEnabled: true, scheduleType: 'Daily', lastRun: '2026-03-22T01:00:00Z', nextRun: '2026-03-23T01:00:00Z', result: { result: 1 } };
    const result = formatBackupJobDetail(job);
    assert.ok(result.startsWith('# Backup Job:'));
    assert.ok(result.includes('| Campo | Valor |'));
    assert.ok(result.includes('Job-Prod'));
  });

  it('retorna mensagem para null', () => {
    assert.equal(formatBackupJobDetail(null), 'Job nao encontrado.');
  });
});

// === SESSIONS ===

describe('formatSessionsList()', () => {
  it('retorna tabela Markdown com sessions', () => {
    const data = {
      data: [
        { id: 'sess-123', name: 'Session 1', sessionType: 'BackupJob', result: { result: 1 }, creationTime: '2026-03-22T01:00:00Z', endTime: '2026-03-22T02:00:00Z', progressPercent: 100 }
      ]
    };
    const result = formatSessionsList(data, {});
    assert.ok(result.includes('| ID |'));
    assert.ok(result.includes('Session 1'));
    assert.ok(result.includes('100%'));
  });

  it('retorna mensagem para lista vazia', () => {
    assert.equal(formatSessionsList({ data: [] }, {}), 'Nenhuma session encontrada.');
  });
});

describe('formatSessionLog()', () => {
  it('retorna tabela de log entries', () => {
    const data = {
      data: [
        { creationTime: '2026-03-22T01:00:00Z', status: 'Info', title: 'Backup started' },
        { creationTime: '2026-03-22T02:00:00Z', status: 'Warning', title: 'Low disk space' }
      ]
    };
    const result = formatSessionLog(data);
    assert.ok(result.includes('**2 entradas de log**'));
    assert.ok(result.includes('Backup started'));
    assert.ok(result.includes('Low disk space'));
  });

  it('limita a 50 entradas', () => {
    const entries = Array.from({ length: 80 }, (_, i) => ({
      creationTime: '2026-03-22T01:00:00Z',
      status: 'Info',
      title: `Entry ${i}`
    }));
    const result = formatSessionLog({ data: entries });
    assert.ok(result.includes('Mostrando 50 de 80'));
  });

  it('retorna mensagem para log vazio', () => {
    assert.equal(formatSessionLog({ data: [] }), 'Nenhum log encontrado para esta session.');
  });
});

// === RESTORE POINTS ===

describe('formatRestorePointsList()', () => {
  it('retorna tabela com restore points', () => {
    const data = { data: [{ id: 'rp-123', name: 'VM-SQL', creationTime: '2026-03-22', type: 'Full', backupSize: 5368709120 }] };
    const result = formatRestorePointsList(data, {});
    assert.ok(result.includes('VM-SQL'));
    assert.ok(result.includes('| Tamanho |'));
  });
});

// === INFRASTRUCTURE ===

describe('formatProxiesList()', () => {
  it('retorna tabela de proxies', () => {
    const data = { data: [{ id: 'px-1', name: 'Proxy-01', type: 'VMware', server: { name: 'ESXi-01' }, maxTaskCount: 4 }] };
    const result = formatProxiesList(data);
    assert.ok(result.includes('Proxy-01'));
    assert.ok(result.includes('ESXi-01'));
  });
});

describe('formatRepositoriesList()', () => {
  it('retorna tabela de repositorios com uso', () => {
    const data = { data: [{ id: 'repo-1', name: 'Default-Repo', type: 'WinLocal', capacityGB: 1000, freeGB: 400 }] };
    const result = formatRepositoriesList(data);
    assert.ok(result.includes('Default-Repo'));
    assert.ok(result.includes('60%')); // (1000-400)/1000 = 60%
  });
});

// === LICENSE & SERVER ===

describe('formatLicenseInfo()', () => {
  it('retorna Markdown com dados de licenca', () => {
    const data = { status: 'Valid', edition: 'Enterprise Plus', expirationDate: '2027-12-31', licensedInstancesCount: 100, usedInstancesCount: 42 };
    const result = formatLicenseInfo(data);
    assert.ok(result.startsWith('# Licenca'));
    assert.ok(result.includes('Enterprise Plus'));
    assert.ok(result.includes('42'));
  });

  it('retorna mensagem para null', () => {
    assert.equal(formatLicenseInfo(null), 'Informacoes de licenca nao disponiveis.');
  });
});

describe('formatServerInfo()', () => {
  it('retorna Markdown com info do servidor', () => {
    const data = { name: 'VBR-Server', buildVersion: '12.3', buildNumber: '12345', databaseVendor: 'Microsoft', databaseType: 'SQL Express', schemaVersion: '12.3.0' };
    const result = formatServerInfo(data);
    assert.ok(result.startsWith('# Servidor'));
    assert.ok(result.includes('VBR-Server'));
    assert.ok(result.includes('12.3'));
  });
});

describe('formatJobSchedule()', () => {
  it('retorna Markdown com schedule', () => {
    const data = { runAutomatically: true, daily: { isEnabled: true, localTime: '22:00' }, retry: { isEnabled: true, retryCount: 3 } };
    const result = formatJobSchedule(data);
    assert.ok(result.includes('Automatico'));
    assert.ok(result.includes('22:00'));
    assert.ok(result.includes('3x'));
  });
});

describe('formatOperationResult()', () => {
  it('retorna resultado de operacao start', () => {
    const result = formatOperationResult({ id: 'session-123', message: 'Job started' }, 'start');
    assert.ok(result.includes('start'));
    assert.ok(result.includes('session-123'));
  });

  it('retorna mensagem de sucesso para null data', () => {
    const result = formatOperationResult(null, 'stop');
    assert.ok(result.includes('stop'));
    assert.ok(result.includes('sucesso'));
  });
});
