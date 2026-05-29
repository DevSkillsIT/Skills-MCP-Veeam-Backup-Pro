// tests/unit/lib/date-helper.test.js
// Cobertura abrangente do helper de data/hora flexivel (todos os formatos e ramos).
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDateTime, resolveTimeWindow } from '../../../lib/date-helper.js';

describe('normalizeDateTime() — entradas vazias/invalidas', () => {
  it('null/undefined/string vazia -> null', () => {
    assert.equal(normalizeDateTime(null), null);
    assert.equal(normalizeDateTime(undefined), null);
    assert.equal(normalizeDateTime(''), null);
    assert.equal(normalizeDateTime('   '), null);
  });
  it('string sem sentido -> null', () => {
    assert.equal(normalizeDateTime('qualquer coisa'), null);
    assert.equal(normalizeDateTime('xyz'), null);
  });
  it('Date valida passa direto; Date invalida -> null', () => {
    const d = new Date('2026-05-28T10:00:00Z');
    assert.equal(normalizeDateTime(d).getTime(), d.getTime());
    assert.equal(normalizeDateTime(new Date('invalid')), null);
  });
});

describe('normalizeDateTime() — relativos', () => {
  const approx = (date, ms) => Math.abs(Date.now() - date.getTime() - ms) < 2000;
  it('horas: variantes h/hr/hrs/hora/horas/hour/hours', () => {
    for (const s of ['6h', '6 h', '6hr', '6 hrs', '6 hora', '6 horas', '6 hour', '6 hours']) {
      assert.ok(approx(normalizeDateTime(s), 6 * 3600000), `falhou: ${s}`);
    }
  });
  it('dias: d/dia/dias/day/days', () => {
    for (const s of ['7d', '7 dias', '7 dia', '7 days', '7 day']) {
      assert.ok(approx(normalizeDateTime(s), 7 * 86400000), `falhou: ${s}`);
    }
  });
  it('semanas: semana/semanas/week/weeks', () => {
    for (const s of ['2 semanas', '2 weeks', '1 week', '1 semana']) {
      assert.ok(normalizeDateTime(s) instanceof Date, `falhou: ${s}`);
    }
    assert.ok(approx(normalizeDateTime('2 semanas'), 14 * 86400000));
  });
});

describe('normalizeDateTime() — naturais (keywords)', () => {
  const dayOf = (d) => { const x = new Date(); x.setHours(0, 0, 0, 0); return Math.round((d.getTime() - x.getTime()) / 86400000); };
  it('hoje/today = 0', () => { assert.equal(dayOf(normalizeDateTime('hoje')), 0); assert.equal(dayOf(normalizeDateTime('TODAY')), 0); });
  it('ontem/yesterday = -1', () => { assert.equal(dayOf(normalizeDateTime('ontem')), -1); assert.equal(dayOf(normalizeDateTime('yesterday')), -1); });
  it('anteontem = -2', () => { assert.equal(dayOf(normalizeDateTime('anteontem')), -2); });
  it('amanha/amanhã/tomorrow = +1', () => {
    assert.equal(dayOf(normalizeDateTime('amanha')), 1);
    assert.equal(dayOf(normalizeDateTime('amanhã')), 1);
    assert.equal(dayOf(normalizeDateTime('tomorrow')), 1);
  });
  it('keyword com endOfDay -> 23:59:59', () => {
    const d = normalizeDateTime('hoje', { endOfDay: true });
    assert.equal(d.getHours(), 23); assert.equal(d.getMinutes(), 59); assert.equal(d.getSeconds(), 59);
  });
  it('keyword sem endOfDay -> 00:00:00', () => {
    const d = normalizeDateTime('hoje');
    assert.equal(d.getHours(), 0); assert.equal(d.getMinutes(), 0);
  });
});

describe('normalizeDateTime() — formato BR', () => {
  it('DD/MM/YYYY (dayfirst)', () => {
    const d = normalizeDateTime('28/05/2026');
    assert.equal(d.getFullYear(), 2026); assert.equal(d.getMonth(), 4); assert.equal(d.getDate(), 28);
    assert.equal(d.getHours(), 0);
  });
  it('DD-MM-YYYY (separador traco)', () => {
    const d = normalizeDateTime('28-05-2026');
    assert.equal(d.getDate(), 28); assert.equal(d.getMonth(), 4);
  });
  it('DD/MM/YYYY HH:MM', () => {
    const d = normalizeDateTime('28/05/2026 05:40');
    assert.equal(d.getHours(), 5); assert.equal(d.getMinutes(), 40);
  });
  it('DD/MM/YYYY HH:MM:SS', () => {
    const d = normalizeDateTime('28/05/2026 05:40:30');
    assert.equal(d.getSeconds(), 30);
  });
  it('BR date-only com endOfDay -> 23:59:59', () => {
    const d = normalizeDateTime('28/05/2026', { endOfDay: true });
    assert.equal(d.getHours(), 23); assert.equal(d.getMinutes(), 59); assert.equal(d.getSeconds(), 59);
  });
  it('BR com hora ignora endOfDay (usa a hora dada)', () => {
    const d = normalizeDateTime('28/05/2026 05:40', { endOfDay: true });
    assert.equal(d.getHours(), 5);
  });
  it('dia/mes de 1 digito', () => {
    const d = normalizeDateTime('1/2/2026');
    assert.equal(d.getDate(), 1); assert.equal(d.getMonth(), 1);
  });
});

describe('normalizeDateTime() — formato ISO', () => {
  it('ISO date-only inicio do dia', () => {
    const d = normalizeDateTime('2026-05-28');
    assert.equal(d.getFullYear(), 2026); assert.equal(d.getHours(), 0);
  });
  it('ISO date-only endOfDay', () => {
    const d = normalizeDateTime('2026-05-28', { endOfDay: true });
    assert.equal(d.getHours(), 23); assert.equal(d.getMinutes(), 59);
  });
  it('ISO datetime com T', () => {
    const d = normalizeDateTime('2026-05-28T05:30:00');
    assert.equal(d.getMonth(), 4); assert.equal(d.getDate(), 28);
  });
  it('ISO datetime com espaco (normaliza para T)', () => {
    const d = normalizeDateTime('2026-05-28 05:30');
    assert.ok(d instanceof Date && !isNaN(d.getTime()));
  });
  it('ISO com timezone -03:00', () => {
    const d = normalizeDateTime('2026-05-28T05:30:00-03:00');
    assert.equal(d.getTime(), new Date('2026-05-28T08:30:00Z').getTime());
  });
});

describe('resolveTimeWindow()', () => {
  it('from/to define janela e vence hours', () => {
    const w = resolveTimeWindow({ from: '2026-05-01', to: '2026-05-10', hours: 24 });
    assert.equal(w.error, null);
    assert.equal(w.since.getMonth(), 4); assert.equal(w.since.getDate(), 1);
    assert.equal(w.until.getDate(), 10); assert.equal(w.until.getHours(), 23);
  });
  it('from sozinho -> until = agora', () => {
    const w = resolveTimeWindow({ from: 'ontem' });
    assert.equal(w.error, null);
    assert.ok(w.until instanceof Date);
    assert.ok((Date.now() - w.until.getTime()) < 2000);
  });
  it('hours sozinho', () => {
    const w = resolveTimeWindow({ hours: 12 });
    const diff = (w.until - w.since) / 3600000;
    assert.ok(diff >= 11.9 && diff <= 12.1);
    assert.match(w.label, /12h/);
  });
  it('from invalido -> error instrutivo mencionando from', () => {
    const w = resolveTimeWindow({ from: '???' });
    assert.ok(w.error); assert.match(w.error, /from/);
    assert.equal(w.since, null);
  });
  it('to invalido -> error instrutivo mencionando to', () => {
    const w = resolveTimeWindow({ from: '2026-05-01', to: '???' });
    assert.ok(w.error); assert.match(w.error, /to/);
  });
  it('sem nada -> sem janela, sem erro', () => {
    const w = resolveTimeWindow({});
    assert.equal(w.since, null); assert.equal(w.until, null); assert.equal(w.error, null);
  });
  it('label legivel para from/to', () => {
    const w = resolveTimeWindow({ from: '2026-05-01' });
    assert.match(w.label, /->/);
  });
  it('from string vazia cai para hours', () => {
    const w = resolveTimeWindow({ from: '', hours: 6 });
    assert.equal(w.error, null);
    assert.match(w.label, /6h/);
  });
  it('to string vazia com from valido -> until = agora', () => {
    const w = resolveTimeWindow({ from: '2026-05-01', to: '' });
    assert.equal(w.error, null);
    assert.ok((Date.now() - w.until.getTime()) < 2000);
  });
  it('hours null explicito -> sem janela', () => {
    const w = resolveTimeWindow({ hours: null });
    assert.equal(w.since, null);
  });
});
