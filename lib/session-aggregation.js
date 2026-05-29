// lib/session-aggregation.js
// Pure session-grouping logic shared by search_backup_sessions (groupByJob) and
// search_backup_jobs (deriveJobsFromSessions). Extracted so the dedup/last-run logic is
// unit-testable and the scan constants live in one place (no drift).

// Scan budget for paginating the (10k+) session history newest-first.
export const SESSION_SCAN = Object.freeze({
  pageSize: 500,
  maxPages: 6,            // cap 3000 sessions
  defaultWindowHours: 24, // groupByJob default window
  deriveLookbackHours: 168 // 7 days for VM/job derivation from sessions
});

// Normalize a session's result to a stable label regardless of API shape.
export function sessionResultLabel(session) {
  const raw = typeof session.result === 'object' ? session.result?.result : session.result;
  if (session.state === 'Working' || session.state === 'Starting') return 'Running';
  const v = String(raw ?? '').toLowerCase();
  if (v === 'success' || v === '0') return 'Success';
  if (v === 'warning' || v === '1') return 'Warning';
  if (v === 'failed' || v === '2') return 'Failed';
  if (v === 'none' || v === '') return session.state === 'Stopped' ? 'Success' : 'None';
  return raw ?? 'None';
}

// Collapse a list of sessions into one entry per job (jobId, fallback name).
// Optional nameNeedle filters by substring of session name (case-insensitive).
// Returns [{ jobId, name, sessionType, attempts, success, failed, warning, running, last }].
export function groupSessionsByJob(sessions, { nameNeedle = null } = {}) {
  const needle = nameNeedle ? String(nameNeedle).toLowerCase() : null;
  const groups = new Map();
  for (const s of sessions || []) {
    if (needle && !(s.name || '').toLowerCase().includes(needle)) continue;
    const key = s.jobId || s.name || 'unknown';
    if (!groups.has(key)) {
      groups.set(key, {
        jobId: s.jobId || null,
        name: s.name || '(sem nome)',
        sessionType: s.sessionType,
        attempts: 0, success: 0, failed: 0, warning: 0, running: 0,
        last: null
      });
    }
    const g = groups.get(key);
    g.attempts++;
    const label = sessionResultLabel(s);
    if (label === 'Success') g.success++;
    else if (label === 'Failed') g.failed++;
    else if (label === 'Warning') g.warning++;
    else if (label === 'Running') g.running++;
    if (!g.last || new Date(s.creationTime) > new Date(g.last.creationTime)) {
      g.last = { label, creationTime: s.creationTime, message: s.result?.message || null };
    }
  }
  return [...groups.values()];
}
