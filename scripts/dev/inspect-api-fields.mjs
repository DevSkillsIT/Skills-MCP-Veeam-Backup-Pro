// scripts/inspect-api-fields.mjs
// One-off diagnostic: dumps the FIELD NAMES the VBR API returns per endpoint so we can
// compare against what the tools actually map (find wasted/ignored fields).
// Reuses ensureAuthenticated() — does not read or print credentials.
import fetch from "node-fetch";
import https from "https";
import { ensureAuthenticated } from "../../lib/auth-middleware.js";

const agent = new https.Agent({ rejectUnauthorized: process.env.VEEAM_IGNORE_SSL === "true" });

const { host, port, token, apiVersion } = await ensureAuthenticated();
const headers = { accept: "application/json", "x-api-version": apiVersion, Authorization: `Bearer ${token}` };

async function get(path) {
  const r = await fetch(`https://${host}:${port}/api/v1/${path}`, { headers, agent });
  if (!r.ok) return { __error: `HTTP ${r.status}` };
  return r.json();
}
const keys = (o) => (o && typeof o === "object" ? Object.keys(o) : []);
function show(label, obj) {
  console.log(`\n=== ${label} ===`);
  if (!obj || obj.__error) return console.log("  ", obj?.__error || "no data");
  const sample = Array.isArray(obj?.data) ? obj.data[0] : obj;
  console.log("top keys:", keys(obj).join(", "));
  console.log("item keys:", keys(sample).join(", "));
  // one level deep for nested objects
  for (const k of keys(sample)) {
    const v = sample[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      console.log(`  .${k}:`, keys(v).join(", "));
    }
  }
}

show("SESSIONS (generic)", await get("sessions?limit=2"));

// A FAILED session in full (look for size/transfer/restore-point fields)
const failed = await get("sessions?limit=1&resultFilter=Failed");
const fid = failed?.data?.[0]?.id;
if (fid) {
  show("SESSION DETAIL (failed)", await get(`sessions/${fid}`));
}

show("JOBS/STATES", await get("jobs/states?limit=2"));
const jid = (await get("jobs/states?limit=1"))?.data?.[0]?.id;
if (jid) show("JOB CONFIG DETAIL", await get(`jobs/${jid}`));

show("REPOSITORIES/STATES", await get("backupInfrastructure/repositories/states?limit=2"));
show("PROXIES", await get("backupInfrastructure/proxies?limit=2"));
show("BACKUP OBJECTS", await get("backupObjects?limit=2"));
show("LICENSE", await get("license"));
show("LICENSE/WORKLOADS", await get("license/workloads"));
show("SERVER INFO", await get("serverInfo"));

process.exit(0);
