// tests/unit/lib/session-aggregation.test.js
// Unit tests for the pure session grouping/labeling shared by groupByJob and deriveJobsFromSessions.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { groupSessionsByJob, sessionResultLabel, SESSION_SCAN } from '../../../lib/session-aggregation.js';

describe('sessionResultLabel()', () => {
  it('mapeia strings e numeros de result', () => {
    assert.equal(sessionResultLabel({ result: { result: 'Success' } }), 'Success');
    assert.equal(sessionResultLabel({ result: { result: 'Failed' } }), 'Failed');
    assert.equal(sessionResultLabel({ result: 'Warning' }), 'Warning');
    assert.equal(sessionResultLabel({ result: 2 }), 'Failed');
    assert.equal(sessionResultLabel({ result: 0 }), 'Success');
  });
  it('detecta Running pelo state', () => {
    assert.equal(sessionResultLabel({ state: 'Working', result: { result: 'None' } }), 'Running');
  });
  it('None com state Stopped vira Success', () => {
    assert.equal(sessionResultLabel({ state: 'Stopped', result: { result: 'None' } }), 'Success');
  });
});

describe('groupSessionsByJob()', () => {
  const sessions = [
    { jobId: 'a', name: 'JOB-A', sessionType: 'BackupJob', creationTime: '2026-05-29T05:00:00Z', result: { result: 'Failed' } },
    { jobId: 'a', name: 'JOB-A', sessionType: 'BackupJob', creationTime: '2026-05-29T04:00:00Z', result: { result: 'Failed' } },
    { jobId: 'a', name: 'JOB-A', sessionType: 'BackupJob', creationTime: '2026-05-29T03:00:00Z', result: { result: 'Failed' } },
    { jobId: 'b', name: 'JOB-B', sessionType: 'BackupJob', creationTime: '2026-05-29T06:00:00Z', result: { result: 'Success' } }
  ];

  it('colapsa N tentativas em 1 entrada por job', () => {
    const groups = groupSessionsByJob(sessions);
    assert.equal(groups.length, 2);
    const a = groups.find(g => g.jobId === 'a');
    assert.equal(a.attempts, 3);
    assert.equal(a.failed, 3);
    assert.equal(a.success, 0);
  });

  it('last aponta para a execucao mais recente', () => {
    const a = groupSessionsByJob(sessions).find(g => g.jobId === 'a');
    assert.equal(a.last.creationTime, '2026-05-29T05:00:00Z');
    assert.equal(a.last.label, 'Failed');
  });

  it('filtra por nameNeedle (substring, case-insensitive)', () => {
    const groups = groupSessionsByJob(sessions, { nameNeedle: 'job-b' });
    assert.equal(groups.length, 1);
    assert.equal(groups[0].name, 'JOB-B');
    assert.equal(groups[0].success, 1);
  });

  it('agrupa por name quando jobId ausente', () => {
    const noId = [
      { name: 'X', creationTime: '2026-05-29T01:00:00Z', result: { result: 'Success' } },
      { name: 'X', creationTime: '2026-05-29T02:00:00Z', result: { result: 'Success' } }
    ];
    const groups = groupSessionsByJob(noId);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].attempts, 2);
  });

  it('lista vazia/nula retorna []', () => {
    assert.deepEqual(groupSessionsByJob([]), []);
    assert.deepEqual(groupSessionsByJob(null), []);
  });
});

describe('SESSION_SCAN', () => {
  it('expoe constantes de varredura congeladas', () => {
    assert.ok(SESSION_SCAN.pageSize > 0);
    assert.ok(SESSION_SCAN.maxPages > 0);
    assert.equal(Object.isFrozen(SESSION_SCAN), true);
  });
});
