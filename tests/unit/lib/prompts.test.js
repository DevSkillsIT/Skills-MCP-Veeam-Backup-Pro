// tests/unit/lib/prompts.test.js
// Unit tests for prompt required-argument validation (V4).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { handleGetPrompt } from '../../../lib/prompts.js';

describe('handleGetPrompt() — V4 required-arg validation', () => {
  it('REPRO V4: arg obrigatorio ausente (vm_name) lanca erro em vez de renderizar "undefined"', async () => {
    await assert.rejects(
      () => handleGetPrompt('veeam_restore_point_lookup', {}, null),
      /obrigat.rio.*vm_name/i
    );
  });

  it('arg obrigatorio vazio (string em branco) tambem e rejeitado', async () => {
    await assert.rejects(
      () => handleGetPrompt('veeam_failed_job_investigation', { job_id: '   ' }, null),
      /obrigat.rio.*job_id/i
    );
  });

  it('com o arg obrigatorio presente, renderiza e interpola o valor', async () => {
    const res = await handleGetPrompt('veeam_restore_point_lookup', { vm_name: 'GSPMWVM010' }, null);
    const text = res.messages.map(m => m.content?.text ?? '').join('\n');
    assert.ok(text.includes('GSPMWVM010'), 'deve conter a VM informada');
    assert.ok(!text.includes('undefined'), 'nao deve conter "undefined"');
  });

  it('prompt so com args opcionais funciona sem args', async () => {
    const res = await handleGetPrompt('veeam_backup_health_summary', {}, null);
    assert.ok(Array.isArray(res.messages) && res.messages.length > 0);
  });

  it('nome de prompt inexistente continua lancando erro claro', async () => {
    await assert.rejects(
      () => handleGetPrompt('prompt_inexistente_xyz', {}, null),
      /n.o encontrado/i
    );
  });
});
