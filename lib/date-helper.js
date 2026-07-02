// lib/date-helper.js
// Flexible date/time parsing so a weak LLM can pass time windows in ANY shape and the MCP
// figures it out (inspired by the GLPI normalize_date helper). Handles dates AND times.
//
// Accepts:
//   - ISO date          2026-05-28            (start-of-day, or end-of-day if endOfDay)
//   - ISO datetime       2026-05-28T05:30:00 / 2026-05-28 05:30
//   - BR date            28/05/2026 / 28-05-2026
//   - BR datetime        28/05/2026 05:30 / 28/05/2026 05:30:00
//   - Natural keywords   hoje/today, ontem/yesterday, anteontem, amanha/tomorrow
//   - Keyword + time     ontem 23:59, hoje 14:30, anteontem 08:00:00 (given time overrides endOfDay)
//   - Relative windows   "6 horas"/"6h"/"last 6 hours", "7 dias"/"7d"/"last 7 days"
//   - Date object        passthrough
// NOTE: the accepted set is CLOSED — anything outside it returns null. Keep the tool
// descriptions in sync with this list (do NOT advertise "any format").
// Returns a Date, or null if it cannot be understood (caller decides how to error).

const DAY_OFFSET = { hoje: 0, today: 0, ontem: -1, yesterday: -1, anteontem: -2, amanha: 1, 'amanhã': 1, tomorrow: 1 };

export function normalizeDateTime(value, { endOfDay = false } = {}) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  let s = String(value).trim();
  if (!s) return null;
  const low = s.toLowerCase();

  // Relative windows -> a point N hours/days in the PAST (for "since")
  let m = low.match(/(\d+)\s*(h|hr|hrs|hora|horas|hour|hours)\b/);
  if (m) return new Date(Date.now() - Number(m[1]) * 3600 * 1000);
  m = low.match(/(\d+)\s*(d|dia|dias|day|days)\b/);
  if (m) return new Date(Date.now() - Number(m[1]) * 86400 * 1000);
  m = low.match(/(\d+)\s*(semana|semanas|week|weeks)\b/);
  if (m) return new Date(Date.now() - Number(m[1]) * 7 * 86400 * 1000);

  // Natural keywords, optionally followed by a time (ontem, hoje 14:30, anteontem 08:00:00).
  // The keyword sets the day; an explicit time overrides the endOfDay default.
  const kw = low.match(/^(hoje|today|ontem|yesterday|anteontem|amanh[aã]|tomorrow)(?:[ tT](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (kw) {
    const [, word, hh, mi, ss] = kw;
    const d = new Date();
    d.setDate(d.getDate() + DAY_OFFSET[word]);
    if (hh !== undefined) {
      d.setHours(Number(hh), Number(mi), ss ? Number(ss) : 0, 0);
    } else if (endOfDay) {
      d.setHours(23, 59, 59, 999);
    } else {
      d.setHours(0, 0, 0, 0);
    }
    return isNaN(d.getTime()) ? null : d;
  }

  // BR: DD/MM/YYYY or DD-MM-YYYY, optional time
  const br = s.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (br) {
    const [, dd, mm, yyyy, hh, mi, ss] = br;
    const hasTime = hh !== undefined;
    const d = new Date(
      Number(yyyy), Number(mm) - 1, Number(dd),
      hasTime ? Number(hh) : (endOfDay ? 23 : 0),
      hasTime ? Number(mi) : (endOfDay ? 59 : 0),
      hasTime ? (ss ? Number(ss) : 0) : (endOfDay ? 59 : 0),
      (!hasTime && endOfDay) ? 999 : 0
    );
    return isNaN(d.getTime()) ? null : d;
  }

  // ISO date only -> start/end of day
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T${endOfDay ? '23:59:59' : '00:00:00'}`);
    return isNaN(d.getTime()) ? null : d;
  }

  // ISO datetime (with or without timezone) — let Date handle it (normalize space->T)
  const d = new Date(s.replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
}

// Resolve a time window from flexible inputs. Precedence: from/to win over hours.
// Returns { since: Date|null, until: Date|null, error: string|null, label: string }.
export function resolveTimeWindow({ from, to, hours } = {}) {
  if (from !== undefined && from !== null && from !== '') {
    const since = normalizeDateTime(from);
    if (!since) {
      return { since: null, until: null, error: `Nao entendi "from"="${from}". Formatos aceitos: ISO (2026-05-28 ou 2026-05-28T05:30), BR (28/05/2026 ou 28/05/2026 05:30), palavra 'ontem'/'hoje'/'anteontem' (hora opcional, ex: 'ontem 23:59') ou relativo ('ultimas 6 horas', '7 dias'). Para o dia inteiro de ontem use from='ontem' e to='ontem'.`, label: '' };
    }
    let until = new Date();
    if (to !== undefined && to !== null && to !== '') {
      const u = normalizeDateTime(to, { endOfDay: true });
      if (!u) {
        return { since: null, until: null, error: `Nao entendi "to"="${to}". Mesmos formatos de "from" (ISO, BR, 'ontem'/'hoje' com hora opcional, relativo). Dica: to='ontem' ja cobre ate 23:59:59 daquele dia.`, label: '' };
      }
      until = u;
    }
    return { since, until, error: null, label: `${since.toISOString()} -> ${until.toISOString()}` };
  }
  if (hours !== undefined && hours !== null) {
    const since = new Date(Date.now() - Number(hours) * 3600 * 1000);
    return { since, until: new Date(), error: null, label: `ultimas ${hours}h` };
  }
  return { since: null, until: null, error: null, label: 'sem janela' };
}
