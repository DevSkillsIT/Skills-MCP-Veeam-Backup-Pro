// scripts/dev/inspect-error-enrichment.mjs
// Investigates WHERE the per-VM error message (console "Statistics", e.g. CRC / vhdx read
// error) lives in the REST API, so we can enrich failed jobs with per-VM causes.
// Read-only.
import { ensureAuthenticated } from "../../lib/auth-middleware.js";
import { vbrTryGet, authHeaders } from "../../lib/veeam-fetch.js";

const ctx = await ensureAuthenticated();
const h = authHeaders(ctx.token, ctx.apiVersion);
const base = `https://${ctx.host}:${ctx.port}/api/v1`;
const keys = (o) => (o && typeof o === "object" ? Object.keys(o) : []);

// 1. Find a recent FAILED session for AUBKPVM010 (or any AU failure)
const recent = (await vbrTryGet(`${base}/sessions?limit=200`, { headers: h })).data?.data || [];
const fail = recent.find(s => /AUBKPVM010/i.test(s.name || "") && /failed/i.test(typeof s.result === "object" ? s.result?.result : s.result))
  || recent.find(s => /failed/i.test(typeof s.result === "object" ? s.result?.result : s.result));
if (!fail) { console.log("no failed session found in recent 200"); process.exit(0); }

console.log("=== PARENT SESSION ===");
console.log("name:", fail.name, "| type:", fail.sessionType, "| id:", fail.id);
console.log("parentSessionId:", fail.parentSessionId);
console.log("result:", JSON.stringify(fail.result));

// 2. Look for CHILD sessions referencing this one as parent
const children = recent.filter(s => s.parentSessionId === fail.id);
console.log(`\n=== CHILD sessions in recent batch (parentSessionId == ${fail.id}): ${children.length} ===`);
children.slice(0, 5).forEach(c => console.log(`  - ${c.name} [${c.sessionType}] result=${JSON.stringify(c.result)}`));

// 3. Probe candidate detail endpoints for per-task info
for (const path of [
  `sessions/${fail.id}`,
  `sessions/${fail.id}/taskSessions`,
  `backupSessions/${fail.id}/taskSessions`,
  `sessions/${fail.id}/log`,
]) {
  const r = await vbrTryGet(`${base}/${path}?limit=5`, { headers: h });
  console.log(`\n--- GET ${path} -> ok=${r.ok} status=${r.status}`);
  if (r.ok) {
    const sample = Array.isArray(r.data?.data) ? r.data.data[0] : r.data;
    console.log("   keys:", keys(sample).join(", "));
    if (Array.isArray(r.data?.data)) console.log("   count:", r.data.data.length, "total:", r.data.pagination?.total);
    // print any message-ish fields
    const msg = sample?.result?.message || sample?.message || sample?.title;
    if (msg) console.log("   sample message:", String(msg).slice(0, 200));
  }
}
process.exit(0);
