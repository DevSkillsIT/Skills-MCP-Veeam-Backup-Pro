// tests/unit/lib/backup-coverage.test.js
// Unit tests for the pure restore-point span logic (oldest/newest/approx detection).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeRestorePointSpan, selectVmMatch, classifyBackupKind } from '../../../lib/backup-coverage.js';

describe('computeRestorePointSpan()', () => {
  it('retorna null para lista vazia ou nula', () => {
    assert.equal(computeRestorePointSpan([]), null);
    assert.equal(computeRestorePointSpan(null), null);
    assert.equal(computeRestorePointSpan(undefined), null);
  });

  it('ignora pontos sem creationTime', () => {
    assert.equal(computeRestorePointSpan([{ id: 1 }, { foo: 'bar' }]), null);
  });

  it('deriva oldest e newest independente da ordem de entrada', () => {
    const points = [
      { creationTime: '2026-05-20T10:00:00Z' },
      { creationTime: '2026-05-10T10:00:00Z' }, // oldest
      { creationTime: '2026-05-29T10:00:00Z' }, // newest
      { creationTime: '2026-05-25T10:00:00Z' }
    ];
    const span = computeRestorePointSpan(points);
    assert.equal(span.count, 4);
    assert.equal(span.oldest, '2026-05-10T10:00:00.000Z');
    assert.equal(span.newest, '2026-05-29T10:00:00.000Z');
    assert.equal(span.approxOldest, false);
  });

  it('usa total da API quando informado e marca approxOldest', () => {
    const points = [
      { creationTime: '2026-05-28T10:00:00Z' },
      { creationTime: '2026-05-29T10:00:00Z' }
    ];
    const span = computeRestorePointSpan(points, 50); // 50 total, só 2 buscados
    assert.equal(span.count, 50);
    assert.equal(span.approxOldest, true);
  });

  it('um unico ponto: oldest == newest', () => {
    const span = computeRestorePointSpan([{ creationTime: '2026-05-29T10:00:00Z' }]);
    assert.equal(span.oldest, span.newest);
    assert.equal(span.count, 1);
    assert.equal(span.approxOldest, false);
  });
});

describe('selectVmMatch() — V1 multi-VM disambiguation', () => {
  it('lista vazia/nula → sem id, nao ambiguo', () => {
    assert.deepEqual(selectVmMatch([]), { id: null, name: null, ambiguous: false, candidates: [] });
    assert.equal(selectVmMatch(null).ambiguous, false);
  });

  it('mesma VM em varios backups (nome unico) → resolve sem ambiguidade', () => {
    const r = selectVmMatch([
      { name: 'ZTLABVM010-AD', id: 'uuid-1' },
      { name: 'ZTLABVM010-AD', id: 'uuid-1' }
    ]);
    assert.equal(r.ambiguous, false);
    assert.equal(r.id, 'uuid-1');
    assert.equal(r.name, 'ZTLABVM010-AD');
  });

  it('REPRO V1: parcial casando VARIAS VMs distintas → ambiguo com candidatos (antes pegava matched[0])', () => {
    const r = selectVmMatch([
      { name: 'AULABVM004', id: 'u4' },
      { name: 'AULABVM007', id: 'u7' },
      { name: 'AULABVM010', id: 'u10' },
      { name: 'AULABVM011', id: 'u11' }
    ]);
    assert.equal(r.ambiguous, true);
    assert.equal(r.id, null);
    assert.deepEqual([...r.candidates].sort(), ['AULABVM004', 'AULABVM007', 'AULABVM010', 'AULABVM011']);
  });

  it('prefere id > objectId; fallback usa vmName/vmId', () => {
    assert.equal(selectVmMatch([{ name: 'X', id: 'real', objectId: 'vm-1' }]).id, 'real');
    assert.equal(selectVmMatch([{ name: 'X', objectId: 'vm-1' }]).id, 'vm-1');
    const fb = selectVmMatch([{ vmName: 'GBLABVM010', vmId: 'g10' }]);
    assert.equal(fb.id, 'g10');
    assert.equal(fb.name, 'GBLABVM010');
  });
});

describe('classifyBackupKind() — RC4 Agent/Copy detection', () => {
  it('REPRO RC4: Agent de servidor fisico (WindowsPhysical)', () => {
    assert.equal(classifyBackupKind('BKP-JOB-LOCAL-ZN-LAB-ZNV-SR001-FISICO - 203.0.113.237', 'WindowsPhysical'), 'Agent (servidor fisico)');
    assert.equal(classifyBackupKind('algum-job', 'LinuxPhysical'), 'Agent (servidor fisico)');
  });
  it('Backup Copy detectado pelo nome (offsite)', () => {
    assert.equal(classifyBackupKind('BKP-COPY-DTC-ZN-LAB-ZNV-SR001-FISICO', 'CustomPlatform'), 'Backup Copy (offsite/cloud)');
  });
  it('VM e fallback', () => {
    assert.equal(classifyBackupKind('JOB-VM', 'VmwareVm'), 'VM');
    assert.equal(classifyBackupKind('algo', 'CustomPlatform'), 'Externo/Copy');
    assert.equal(classifyBackupKind('algo', null), 'Backup armazenado');
  });
});
