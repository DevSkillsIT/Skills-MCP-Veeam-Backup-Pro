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
    assert.ok(result.includes('| Nome |'));
    assert.ok(result.includes('| VMs |'));
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

  it('lista do inventario inclui rodape orientando para groupByJob (N1)', () => {
    const data = { data: [{ id: 'abc-123', name: 'Test', type: 'Backup', state: 0 }] };
    const result = formatBackupJobsList(data, {});
    assert.ok(result.includes('groupByJob=true'));
    assert.ok(result.toLowerCase().includes('site remoto'));
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

describe('formatBackupJobDetail() — V3 retry/schedule', () => {
  it('retry habilitado mostra "Sim (Nx, espera Mmin)" (antes mostrava 0x)', () => {
    const job = { id: 'u1', name: 'J', scheduleEnabled: true, scheduleType: 'Diario', retryEnabled: true, retryCount: 3, retryWait: 10 };
    const r = formatBackupJobDetail(job);
    assert.ok(r.includes('| Retentativa | Sim (3x, espera 10min) |'), r);
    assert.ok(r.includes('| Schedule | Ativo (Diario) |'), r);
  });
  it('REPRO V3: sem scheduleType NAO gera "Ativo ()" vazio; retry desabilitado vira "Nao"', () => {
    const job = { id: 'u1', name: 'J', scheduleEnabled: true, scheduleType: null, retryEnabled: false };
    const r = formatBackupJobDetail(job);
    assert.ok(r.includes('| Schedule | Ativo |'), r);
    assert.ok(!r.includes('Ativo ()'), 'nao deve ter parenteses vazios');
    assert.ok(r.includes('| Retentativa | Nao |'), r);
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
    assert.ok(result.includes('2 entrada(s) de log'));
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
    assert.ok(result.includes('50 de 80'));
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

  it('REPRO V6: sem args.limit usa pagination.limit (35), nao o antigo default 25', () => {
    const points = Array.from({ length: 35 }, (_, i) => ({ id: `rp-${i}`, vmName: 'AULABVM010', creationTime: '2026-05-29', type: 'Increment' }));
    const data = { restorePoints: points, pagination: { total: 153, limit: 35, skip: 0 } };
    const result = formatRestorePointsList(data, {}); // args sem limit
    assert.ok(result.includes('limit: 35'), result.split('\n')[0]);
    assert.ok(!result.includes('limit: 25'), 'nao deve usar o default antigo 25');
  });

  it('args.limit explicito tem prioridade no cabecalho', () => {
    const points = Array.from({ length: 10 }, (_, i) => ({ id: `rp-${i}`, vmName: 'X', creationTime: '2026-05-29', type: 'Increment' }));
    const data = { restorePoints: points, pagination: { total: 153, limit: 10, skip: 0 } };
    const result = formatRestorePointsList(data, { limit: 10 });
    assert.ok(result.includes('limit: 10'), result.split('\n')[0]);
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
  it('parseia schedule diario com horario, dias e retry (estrutura real do VBR)', () => {
    const data = {
      schedule: {
        runAutomatically: true,
        daily: { isEnabled: true, dailyKind: 'SelectedDays', localTime: '05:40', days: ['monday', 'friday'] },
        retry: { isEnabled: true, retryCount: 3, awaitMinutes: 10 }
      },
      execution: { nextRunFormatted: '30/05/2026 05:40', lastRunFormatted: '29/05/2026 05:40' }
    };
    const result = formatJobSchedule(data);
    assert.ok(result.includes('Diario'));
    assert.ok(result.includes('05:40'));
    assert.ok(result.includes('3x'));
    assert.ok(result.includes('Segunda, Sexta'));
    assert.ok(result.includes('Proxima Execucao'));
  });

  it('schedule manual quando runAutomatically=false', () => {
    const result = formatJobSchedule({ schedule: { runAutomatically: false, retry: { isEnabled: false } } });
    assert.ok(result.includes('Manual'));
  });

  it('aceita schedule cru (sem wrapper)', () => {
    const result = formatJobSchedule({ runAutomatically: true, periodically: { isEnabled: true, periodicallyKind: 'Hours', frequency: 4 } });
    assert.ok(result.includes('Periodico'));
    assert.ok(result.includes('4'));
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

// === NEW: 2026-05-29 improvements ===

describe('formatSessionsList() — groupByJob', () => {
  it('renderiza 1 linha por job com tentativas/falhas', () => {
    const data = {
      groupedByJob: true,
      summary: { windowHours: 24, jobsWithFailures: 1, jobsRunning: 0, totalSessionsScanned: 25 },
      jobs: [
        { name: 'JOB-A', attempts: 22, failed: 22, success: 0, warning: 0, last: { label: 'Failed', creationTime: '2026-05-29T05:10:00Z' } },
        { name: 'JOB-B', attempts: 2, failed: 0, success: 2, warning: 0, last: { label: 'Success', creationTime: '2026-05-29T06:00:00Z' } }
      ]
    };
    const result = formatSessionsList(data, {});
    assert.ok(result.includes('JOB-A'));
    assert.ok(result.includes('FALHA'));
    assert.ok(result.includes('24h'));
    assert.ok(result.includes('| Job |'));
  });

  it('mensagem amigavel quando nao ha jobs na janela', () => {
    const result = formatSessionsList({ groupedByJob: true, summary: { windowHours: 12 }, jobs: [] }, {});
    assert.ok(result.includes('12h'));
  });
});

describe('formatSessionsList() — resumo', () => {
  it('inclui linha de resumo com falhas e sucessos', () => {
    const data = { data: [
      { id: 's1', name: 'S', sessionType: 'BackupJob', result: { result: 'Failed' }, creationTime: '2026-05-29T01:00:00Z' },
      { id: 's2', name: 'S', sessionType: 'BackupJob', result: { result: 'Success' }, creationTime: '2026-05-29T02:00:00Z' }
    ] };
    const result = formatSessionsList(data, {});
    assert.ok(result.includes('Resumo'));
    assert.ok(result.includes('1 falha'));
    assert.ok(result.includes('1 sucesso'));
  });
});

describe('formatRepositoriesList() — status', () => {
  it('marca CRITICO (>=90%) e OFFLINE e ordena cheio primeiro', () => {
    const data = { data: [
      { id: 'r1', name: 'RepoOK', type: 'WinLocal', capacityGB: 1000, freeGB: 800, isOnline: true },
      { id: 'r2', name: 'RepoCheio', type: 'WinLocal', capacityGB: 1000, freeGB: 50, isOnline: true },
      { id: 'r3', name: 'RepoOff', type: 'WinLocal', capacityGB: 1000, freeGB: 900, isOnline: false }
    ] };
    const result = formatRepositoriesList(data);
    assert.ok(result.includes('CRITICO'));
    assert.ok(result.includes('OFFLINE'));
    // fullest-first: RepoCheio antes de RepoOK
    assert.ok(result.indexOf('RepoCheio') < result.indexOf('RepoOK'));
  });
});

describe('formatLicenseInfo() — instanceLicenseSummary', () => {
  it('le contagens de instanceLicenseSummary (nao do nivel raiz)', () => {
    const data = {
      status: 'Valid', edition: 'EnterprisePlus', licensedTo: 'ACME',
      instanceLicenseSummary: { licensedInstancesNumber: 1500, usedInstancesNumber: 61, objects: [{ type: 'VM', count: 58 }] }
    };
    const result = formatLicenseInfo(data);
    assert.ok(result.includes('1500'));
    assert.ok(result.includes('61'));
    assert.ok(result.includes('VM'));
  });
});

describe('formatBackupJobsList() — VM match e derivacao', () => {
  it('matchedByVm renderiza VM -> Job', () => {
    const data = { matchedByVm: true, searchTerm: 'WEBVM', jobs: [{ vmName: 'WEBVM-01', jobName: 'JOB-WEB-01', restorePointsCount: 20 }] };
    const result = formatBackupJobsList(data, {});
    assert.ok(result.includes('WEBVM-01'));
    assert.ok(result.includes('JOB-WEB-01'));
    assert.ok(result.includes('NOME DE VM'));
  });

  it('derivedFromSessions mostra tentativas/falhas', () => {
    const data = { derivedFromSessions: true, searchTerm: 'ACGYN', jobs: [{ name: 'JOB-AC', type: 'BackupJob', result: 'Failed', attemptsLast7d: 99, failuresLast7d: 99, lastRun: '2026-05-29T05:00:00Z' }] };
    const result = formatBackupJobsList(data, {});
    assert.ok(result.includes('JOB-AC'));
    assert.ok(result.includes('HISTORICO DE SESSOES'));
    assert.ok(result.includes('99'));
  });

  it('REPRO RC4: matchedFromBackups renderiza Agent/Copy via /backups', () => {
    const data = { matchedFromBackups: true, searchTerm: 'ZNV', jobs: [
      { name: 'BKP-JOB-LOCAL-ZN-LAB-ZNV-SR001-FISICO - 203.0.113.237', kind: 'Agent (servidor fisico)', repositoryName: 'ZNV-CLI_RepoLocal-ZNV-BKP-HDExterno', creationTime: '2026-03-30T19:25:50Z' },
      { name: 'BKP-COPY-DTC-ZN-LAB-ZNV-SR001-FISICO', kind: 'Backup Copy (offsite/cloud)', repositoryName: null, repositoryId: '3429c8d0', creationTime: '2026-03-30T21:04:58Z' }
    ] };
    const result = formatBackupJobsList(data, {});
    assert.ok(result.includes('BACKUPS ARMAZENADOS'), result);
    assert.ok(result.includes('Agent (servidor fisico)'));
    assert.ok(result.includes('Backup Copy (offsite/cloud)'));
    assert.ok(result.includes('ZNV-CLI_RepoLocal-ZNV-BKP-HDExterno'));
  });

  it('REPRO RC4b: listagem geral exibe secao de jobs Agent/Copy (externalJobs)', () => {
    const data = {
      data: [{ id: 'j1', name: 'BKP-JOB-LOCAL-SK-PMW-VCENTER-X', type: 'Backup', state: 0, result: { result: 1 }, objectsCount: 1, lastRun: '2026-05-29T05:00:00Z' }],
      externalJobs: [
        { name: 'BKP-JOB-LOCAL-ZN-LAB-ZNV-SR001-FISICO - 203.0.113.237', kind: 'Agent (servidor fisico)', creationTime: '2026-03-30T19:25:50Z' },
        { name: 'BKP-COPY-DTC-ZN-LAB-ZNV-SR001-FISICO', kind: 'Backup Copy (offsite/cloud)', creationTime: '2026-03-30T21:04:58Z' }
      ]
    };
    const result = formatBackupJobsList(data, {});
    assert.ok(result.includes('Jobs de Agent/Copy/offsite'), result);
    assert.ok(result.includes('BKP-JOB-LOCAL-ZN-LAB-ZNV-SR001-FISICO'), 'ZNV agent job deve aparecer na listagem geral');
    assert.ok(result.includes('Agent (servidor fisico)'));
  });

  it('lista normal inclui coluna VMs (objectsCount)', () => {
    const data = { data: [{ id: 'j1', name: 'JOB-X', type: 'Backup', state: 0, result: { result: 1 }, objectsCount: 3, lastRun: '2026-05-29T01:00:00Z' }] };
    const result = formatBackupJobsList(data, {});
    assert.ok(result.includes('| VMs |'));
    assert.ok(result.includes('JOB-X'));
  });
});

describe('formatBackupJobDetail() — protectedVms', () => {
  it('renderiza VMs com restore points (count/primeiro/ultimo)', () => {
    const input = {
      job: { id: 'j1', name: 'JOB-Y', type: 'Backup', state: 0 },
      protectedVms: { total: 1, shown: 1, vms: [
        { name: 'VM-1', restorePointsCount: 12, oldestRestorePoint: '2026-05-16T06:10:00Z', newestRestorePoint: '2026-05-29T06:11:00Z', approxOldest: false }
      ] }
    };
    const result = formatBackupJobDetail(input);
    assert.ok(result.includes('Restore Points'));
    assert.ok(result.includes('VM-1'));
    assert.ok(result.includes('12'));
  });
});

describe('formatSessionLog() — mostra causa da falha', () => {
  it('expoe sessionInfo.resultMessage mesmo sem log detalhado', () => {
    const data = {
      sessionInfo: { name: 'JOB-FAIL', sessionType: 'BackupJob', state: 'Stopped', result: 'Failed', resultMessage: 'RPC failed: GetSvcVersion', creationTimeFormatted: '29/05/2026', endTimeFormatted: '29/05/2026' },
      logs: []
    };
    const result = formatSessionLog(data);
    assert.ok(result.includes('JOB-FAIL'));
    assert.ok(result.includes('RPC failed'));
  });

  it('renderiza entradas enriquecidas (data.logs)', () => {
    const data = { logs: [{ timestamp: '2026-05-29T01:00:00Z', level: 'Error', message: 'disco cheio' }] };
    const result = formatSessionLog(data);
    assert.ok(result.includes('disco cheio'));
  });

  it('Resultado por VM: agrupa VMs com erro identico (falha sistemica)', () => {
    const data = {
      logs: [{ timestamp: '2026-05-29T01:00:00Z', level: 'Error', message: 'x' }],
      vmResults: [
        { vmName: 'VM1', result: 'Failed', message: 'Repository is offline' },
        { vmName: 'VM2', result: 'Failed', message: 'Repository is offline' },
        { vmName: 'VM3', result: 'Failed', message: 'Repository is offline' },
        { vmName: 'VM4', result: 'Failed', message: 'CRC error on disk' },
        { vmName: 'VM5', result: 'Success', message: '' }
      ]
    };
    const result = formatSessionLog(data);
    assert.ok(result.includes('2 causa(s) distinta(s)'), 'agrupa em 2 causas');
    assert.ok(result.includes('3 VMs: VM1, VM2, VM3'), 'colapsa as 3 VMs com mesmo erro');
    assert.ok(result.includes('CRC error on disk'));
    assert.ok(result.includes('+1 VM(s) com sucesso'));
  });

  it('Resultado por VM: todas com sucesso nao polui', () => {
    const data = {
      logs: [{ timestamp: '2026-05-29T01:00:00Z', level: 'Info', message: 'ok' }],
      vmResults: [{ vmName: 'VM1', result: 'Success', message: '' }, { vmName: 'VM2', result: 'Success', message: '' }]
    };
    const result = formatSessionLog(data);
    assert.ok(result.includes('2 VM(s), todas com sucesso'));
    assert.ok(!result.includes('Resultado por VM —'));
  });
});
