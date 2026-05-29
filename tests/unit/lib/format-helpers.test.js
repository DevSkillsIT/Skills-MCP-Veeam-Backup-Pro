// tests/unit/lib/format-helpers.test.js
// Unit tests for log-level derivation (V2): VBR logs error text at level "Info".
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { deriveLogLevel, deriveScheduleType } from '../../../lib/format-helpers.js';

describe('deriveLogLevel() — V2 level reclassification', () => {
  it('mantem Error/Warning da API (mais severo vence)', () => {
    assert.equal(deriveLogLevel({ level: 'Error', message: 'qualquer' }), 'Error');
    assert.equal(deriveLogLevel({ level: 'Warning', message: 'qualquer' }), 'Warning');
  });

  it('REPRO V2: texto "Error:" rotulado como Info pela API vira Error', () => {
    const entry = {
      level: 'Info',
      message: 'Error: The remote procedure call failed and did not execute.\nRPC function call failed. Function name: [GetSvcVersion].'
    };
    assert.equal(deriveLogLevel(entry), 'Error');
  });

  it('detecta "Failed to connect" como Error mesmo vindo como Info', () => {
    assert.equal(deriveLogLevel({ level: 'Info', message: 'Failed to connect to host backup-host-01' }), 'Error');
  });

  it('texto Warning: rotulado Info vira Warning', () => {
    assert.equal(deriveLogLevel({ level: 'Info', message: 'Warning: VM skipped' }), 'Warning');
  });

  it('Info comum permanece Info', () => {
    assert.equal(deriveLogLevel({ level: 'Info', message: 'Backup started' }), 'Info');
    assert.equal(deriveLogLevel({ message: 'no level field' }), 'Info');
  });

  it('usa entry.text quando message ausente', () => {
    assert.equal(deriveLogLevel({ level: 'Info', text: 'error: something broke' }), 'Error');
  });
});

describe('deriveScheduleType() — V3 schedule type label', () => {
  it('schedule diario habilitado → Diario', () => {
    assert.equal(deriveScheduleType({ runAutomatically: true, daily: { isEnabled: true } }), 'Diario');
  });
  it('mensal/periodico/continuo', () => {
    assert.equal(deriveScheduleType({ runAutomatically: true, monthly: { isEnabled: true } }), 'Mensal');
    assert.equal(deriveScheduleType({ runAutomatically: true, periodically: { isEnabled: true } }), 'Periodico');
    assert.equal(deriveScheduleType({ runAutomatically: true, continuously: { isEnabled: true } }), 'Continuo');
  });
  it('REPRO V3: schedule sem type (campo inexistente) NAO vira null vazio quando runAutomatically', () => {
    // antes: jobData.schedule?.type === undefined → "Ativo ()". Agora deriva pelo sub-objeto.
    assert.equal(deriveScheduleType({ runAutomatically: true, daily: { isEnabled: true, localTime: '05:40' } }), 'Diario');
  });
  it('sem runAutomatically → null (sem parenteses vazios no formatter)', () => {
    assert.equal(deriveScheduleType({ daily: { isEnabled: true } }), null);
    assert.equal(deriveScheduleType(null), null);
    assert.equal(deriveScheduleType({}), null);
  });
});
