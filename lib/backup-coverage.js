// lib/backup-coverage.js
// Cross-endpoint helpers that mirror the Veeam console's "job -> VMs -> restore points" view
// and enable transparent search by VM name. All calls are best-effort (vbrTryGet) so an
// offline host never breaks the calling tool.
//
// API relationships (VBR 12.3.2 / v1.2-rev0, verified live):
//   /backups                -> { id, jobId, name }                 (links backup to job)
//   /backups/{id}/objects   -> { id, name, restorePointsCount }    (VMs in the backup)
//   /backupObjects          -> { id, name, restorePointsCount }    (global protected objects)
//   /backupObjects/{id}/restorePoints -> { creationTime, backupId } (the points themselves)
// @MX:NOTE: orderColumn/orderAsc are IGNORED by this server, so we sort restore points
// client-side to derive the oldest/newest dates.
import { vbrTryGet, authHeaders } from "./veeam-fetch.js";

const base = (ctx) => `https://${ctx.host}:${ctx.port}/api/v1`;

// VMs of a job with their restore-point counts (via the job's backups).
export async function getJobObjects(ctx, jobId) {
  const h = authHeaders(ctx.token, ctx.apiVersion);
  const backupsRes = await vbrTryGet(`${base(ctx)}/backups?limit=400`, { headers: h });
  if (!backupsRes.ok) return [];
  const backups = (backupsRes.data?.data || []).filter((b) => b.jobId === jobId);

  const objects = [];
  for (const b of backups) {
    const objRes = await vbrTryGet(`${base(ctx)}/backups/${b.id}/objects?limit=400`, { headers: h });
    if (objRes.ok) {
      for (const o of objRes.data?.data || []) {
        objects.push({ id: o.id, name: o.name, type: o.type, restorePointsCount: o.restorePointsCount ?? null, backupId: b.id });
      }
    }
  }
  return objects;
}

// Pure: derive oldest/newest/count from a list of restore points. Exported for testing.
// @MX:NOTE: orderColumn is ignored by this VBR, so we always sort client-side.
export function computeRestorePointSpan(points, total = null) {
  const pts = (points || []).filter((p) => p && p.creationTime);
  if (!pts.length) return null;
  const sorted = pts.map((p) => new Date(p.creationTime)).sort((a, b) => a - b);
  const fetched = pts.length;
  const totalCount = total ?? fetched;
  return {
    count: totalCount,
    oldest: sorted[0].toISOString(),
    newest: sorted[sorted.length - 1].toISOString(),
    approxOldest: totalCount > fetched, // more points exist than we fetched; oldest is a lower bound
  };
}

// Oldest + newest restore-point dates for one object (detects retention build-up).
// Returns { count, newest, oldest, approxOldest } | { unavailable: true } | null.
// @MX:NOTE: distinguishes a failed fetch (host/repo offline → unavailable, render "indisponivel")
// from a genuinely empty object (null). timeoutMs kept short — this is enrichment, not core.
export async function getRestorePointSpan(ctx, backupObjectId, knownCount = null) {
  const h = authHeaders(ctx.token, ctx.apiVersion);
  const res = await vbrTryGet(
    `${base(ctx)}/backupObjects/${encodeURIComponent(backupObjectId)}/restorePoints?limit=500`,
    { headers: h, timeoutMs: 5000 }
  );
  if (!res.ok) return { unavailable: true };
  return computeRestorePointSpan(res.data?.data, res.data?.pagination?.total ?? knownCount);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s) => UUID_RE.test(String(s || ""));

// Resolve a job NAME to its UUID via /jobs/states. Passes UUIDs through unchanged.
// Returns { id } | { error }. With { exact:true } (use for destructive start/stop), only an
// EXACT, UNIQUE name match is accepted — a partial match must never start/stop the wrong job.
export async function resolveJobId(ctx, value, { exact = false } = {}) {
  if (isUuid(value)) return { id: value };
  const h = authHeaders(ctx.token, ctx.apiVersion);
  const wild = String(value).includes("*") ? value : `*${value}*`;
  const res = await vbrTryGet(`${base(ctx)}/jobs/states?limit=50&nameFilter=${encodeURIComponent(wild)}`, { headers: h });
  if (!res.ok) return { error: `Nao foi possivel resolver o nome do job "${value}" (HTTP ${res.status || "rede"}). Informe o UUID ou liste com veeam_search_backup_jobs.` };
  const jobs = res.data?.data || [];
  if (jobs.length === 0) return { error: `Nenhum job de VM no inventario /jobs casa "${value}". Confirme em veeam_search_backup_jobs(nameFilter="${value}"): se aparecer via "BACKUPS ARMAZENADOS", e um job de Agent (servidor fisico) ou Backup Copy — esses EXISTEM mas NAO tem detalhe/schedule/start/stop por esta API (use o console do VBR). Se nem la aparecer, o job nao existe.` };

  if (exact) {
    // Destructive actions: require an exact (case-insensitive) full-name match, single result.
    const needle = String(value).toLowerCase();
    const exactMatches = jobs.filter((j) => (j.name || "").toLowerCase() === needle);
    if (exactMatches.length === 1) return { id: exactMatches[0].id, name: exactMatches[0].name };
    if (exactMatches.length === 0) {
      const list = jobs.slice(0, 10).map((j) => `  - ${j.name}`).join("\n");
      return { error: `Acao destrutiva (start/stop) exige o NOME EXATO ou o UUID do job — "${value}" nao bateu exatamente. Candidatos parecidos:\n${list}` };
    }
    return { error: `"${value}" casou ${exactMatches.length} jobs exatamente — informe o UUID para evitar ambiguidade.` };
  }

  if (jobs.length === 1) return { id: jobs[0].id, name: jobs[0].name };
  // Prefer an exact match if present, even for read actions (avoids surprises).
  const needle = String(value).toLowerCase();
  const exactMatch = jobs.find((j) => (j.name || "").toLowerCase() === needle);
  if (exactMatch) return { id: exactMatch.id, name: exactMatch.name };
  const list = jobs.slice(0, 10).map((j) => `  - ${j.name}`).join("\n");
  return { error: `"${value}" casou ${jobs.length} jobs. Seja mais especifico:\n${list}` };
}

// Per-VM task results of a job session (the console "Statistics" view). Each backup job
// session has one task session per VM, carrying that VM's own result + error message.
// Returns [{ vmName, result, message, creationTime }] | null (endpoint unavailable / not a job).
// @MX:NOTE: this is how a multi-VM job exposes a distinct error per VM (e.g. CRC on one vhdx).
export async function getTaskSessionResults(ctx, sessionId, { limit = 200 } = {}) {
  const h = authHeaders(ctx.token, ctx.apiVersion);
  const res = await vbrTryGet(
    `${base(ctx)}/sessions/${encodeURIComponent(sessionId)}/taskSessions?limit=${limit}`,
    { headers: h, timeoutMs: 5000 }
  );
  if (!res.ok) return null;
  const tasks = res.data?.data || [];
  return tasks.map((t) => ({
    vmName: t.name || t.objectName || "N/A",
    result: (typeof t.result === "object" ? t.result?.result : t.result) ?? null,
    message: (typeof t.result === "object" ? t.result?.message : null) || null,
    creationTime: t.creationTime || null
  }));
}

// Transparent VM -> job(s) resolution. Returns [{ jobId, jobName, vmName, restorePointsCount }].
export async function findJobsByVmName(ctx, vmName) {
  const h = authHeaders(ctx.token, ctx.apiVersion);
  const needle = String(vmName || "").toLowerCase();
  if (!needle) return [];

  // @MX:NOTE: VBR nameFilter needs explicit wildcards for substring match (same as /jobs).
  const wild = vmName.includes("*") ? vmName : `*${vmName}*`;
  const boRes = await vbrTryGet(`${base(ctx)}/backupObjects?nameFilter=${encodeURIComponent(wild)}&limit=50`, { headers: h });
  // @MX:NOTE: cap matched objects before the per-object (2-GET) lookups to bound the N+1 cost.
  const objs = (boRes.data?.data || []).filter((o) => (o.name || "").toLowerCase().includes(needle)).slice(0, 15);

  const jobs = new Map();
  for (const o of objs) {
    const rpRes = await vbrTryGet(
      `${base(ctx)}/backupObjects/${encodeURIComponent(o.id)}/restorePoints?limit=1`,
      { headers: h }
    );
    const backupId = rpRes.data?.data?.[0]?.backupId;
    if (!backupId) continue;
    const bRes = await vbrTryGet(`${base(ctx)}/backups/${backupId}`, { headers: h });
    const jobId = bRes.data?.jobId;
    const jobName = bRes.data?.name;
    if (jobId && !jobs.has(jobId)) {
      jobs.set(jobId, { jobId, jobName, vmName: o.name, restorePointsCount: o.restorePointsCount ?? null });
    }
  }
  return [...jobs.values()];
}

/**
 * Decide a single VM from a set of name-matched backupObjects/VMs.
 * @MX:NOTE: search_restore_points took matched[0] silently, so a partial term hitting
 * several DISTINCT VMs (e.g. "AULAB" → AULABVM004/007/010/011) returned points for ONE VM
 * and hid the rest (the dropped VM had far more points). Dedupe by distinct VM name:
 * 1 distinct (same VM under several backups) → resolve; >1 distinct → ambiguous, so the
 * caller can surface candidates instead of answering with a silently incomplete result.
 * @param {Array<object>} matched - objects carrying `name`/`vmName` and `id`/`objectId`/`vmId`
 * @returns {{id:string|null, name:string|null, ambiguous:boolean, candidates:string[]}}
 */
export function selectVmMatch(matched) {
  if (!Array.isArray(matched) || matched.length === 0) {
    return { id: null, name: null, ambiguous: false, candidates: [] };
  }
  const byName = new Map();
  for (const o of matched) {
    const label = o.name ?? o.vmName ?? "";
    const key = label.toLowerCase();
    if (!byName.has(key)) byName.set(key, { obj: o, label });
  }
  const distinct = [...byName.values()];
  const candidates = distinct.map((d) => d.label).filter(Boolean);
  if (distinct.length === 1) {
    const o = distinct[0].obj;
    return { id: o.id ?? o.objectId ?? o.vmId ?? null, name: distinct[0].label || null, ambiguous: false, candidates };
  }
  return { id: null, name: null, ambiguous: true, candidates };
}

/**
 * Classify a stored backup into a human "kind" from its name + platformName.
 * @MX:NOTE: RC4 — Veeam Agent (physical) and Backup Copy jobs live ONLY in /api/v1/backups
 * (absent from /jobs, not name-matchable in /sessions). platformName: WindowsPhysical/
 * LinuxPhysical = Agent; CustomPlatform = Copy/SP; VMware/HyperV = VM.
 * @param {string} name @param {string} platformName
 * @returns {string}
 */
export function classifyBackupKind(name, platformName) {
  const n = String(name || "").toUpperCase();
  if (n.includes("BKP-COPY") || n.includes("-COPY") || n.includes("COPY-")) return "Backup Copy (offsite/cloud)";
  const p = String(platformName || "");
  if (/physical/i.test(p)) return "Agent (servidor fisico)";
  if (/vmware|hyperv|vsphere|vm/i.test(p)) return "VM";
  if (p === "CustomPlatform") return "Externo/Copy";
  return p || "Backup armazenado";
}

/**
 * 4th coverage source: find jobs via STORED BACKUPS (/api/v1/backups).
 * @MX:NOTE: RC4 — resolves the Agent/Copy blind spot. /jobs (inventory), VM-name and session
 * history all miss Veeam Agent (physical server) and Backup Copy jobs; they only surface here.
 * Best-effort repo name resolution (cloud/SP copy repos return 404 — tolerated).
 * @returns {Promise<Array<{name,jobId,platformName,kind,repositoryName,repositoryId,creationTime}>>}
 */
export async function findJobsFromBackups(ctx, term) {
  const h = authHeaders(ctx.token, ctx.apiVersion);
  const needle = String(term || "").toLowerCase();
  if (!needle) return [];
  const wild = term.includes("*") ? term : `*${term}*`;
  const res = await vbrTryGet(`${base(ctx)}/backups?nameFilter=${encodeURIComponent(wild)}&limit=50`, { headers: h });
  const backups = (res.data?.data || []).filter((b) => (b.name || "").toLowerCase().includes(needle));

  const repoCache = new Map();
  const out = [];
  for (const b of backups) {
    let repoName = null;
    if (b.repositoryId) {
      if (repoCache.has(b.repositoryId)) repoName = repoCache.get(b.repositoryId);
      else {
        const rr = await vbrTryGet(`${base(ctx)}/backupInfrastructure/repositories/${b.repositoryId}`, { headers: h });
        repoName = rr.ok ? (rr.data?.name ?? null) : null; // 404 on cloud/SP copy repos
        repoCache.set(b.repositoryId, repoName);
      }
    }
    out.push({
      name: b.name,
      jobId: b.jobId ?? null,
      platformName: b.platformName ?? null,
      kind: classifyBackupKind(b.name, b.platformName),
      repositoryName: repoName,
      repositoryId: b.repositoryId ?? null,
      creationTime: b.creationTime ?? null
    });
  }
  return out;
}

/**
 * List jobs that exist as stored backups but are NOT in the /jobs inventory — i.e. Veeam
 * Agent (physical) and Backup Copy/offsite jobs (VM jobs ARE in the inventory and are skipped).
 * @MX:NOTE: RC4b — a BARE search_backup_jobs (no nameFilter) returns only the /jobs inventory,
 * so an LLM that just lists jobs never sees Agent/Copy jobs and wrongly concludes "no job for
 * client X". This surfaces them in the overview so the list is complete by itself (1 extra GET;
 * no per-repo resolution to stay cheap). Dedupe by name.
 * @returns {Promise<Array<{name,jobId,kind,creationTime}>>}
 */
export async function listExternalJobsFromBackups(ctx, { limit = 200 } = {}) {
  const h = authHeaders(ctx.token, ctx.apiVersion);
  const res = await vbrTryGet(`${base(ctx)}/backups?limit=${limit}`, { headers: h });
  const backups = res.data?.data || [];
  const seen = new Set();
  const out = [];
  for (const b of backups) {
    const kind = classifyBackupKind(b.name, b.platformName);
    if (kind === "VM") continue; // VM jobs are already in the /jobs inventory
    const key = String(b.name || "").toLowerCase();
    if (!b.name || seen.has(key)) continue;
    seen.add(key);
    out.push({ name: b.name, jobId: b.jobId ?? null, kind, creationTime: b.creationTime ?? null });
  }
  return out;
}
