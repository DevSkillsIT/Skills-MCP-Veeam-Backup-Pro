// scripts/inspect-job-vm-rp.mjs
// Investigates how the VBR API links JOB -> VM -> restore points, so we can surface
// restore-point counts per VM and enable search by VM name. Read-only.
import fetch from "node-fetch";
import https from "https";
import { ensureAuthenticated } from "../../lib/auth-middleware.js";

const agent = new https.Agent({ rejectUnauthorized: process.env.VEEAM_IGNORE_SSL === "true" });
const { host, port, token, apiVersion } = await ensureAuthenticated();
const headers = { accept: "application/json", "x-api-version": apiVersion, Authorization: `Bearer ${token}` };

async function get(path) {
  try {
    const r = await fetch(`https://${host}:${port}/api/v1/${path}`, { headers, agent });
    if (!r.ok) return { __error: `HTTP ${r.status}` };
    return r.json();
  } catch (e) { return { __error: e.message }; }
}
const keys = (o) => (o && typeof o === "object" ? Object.keys(o) : []);
function show(label, obj, deep = true) {
  console.log(`\n=== ${label} ===`);
  if (!obj || obj.__error) return console.log("  ", obj?.__error || "no data");
  const sample = Array.isArray(obj?.data) ? obj.data[0] : obj;
  if (Array.isArray(obj?.data)) console.log(`count=${obj.data.length} total=${obj.pagination?.total}`);
  console.log("item keys:", keys(sample).join(", "));
  if (deep) for (const k of keys(sample)) {
    const v = sample[k];
    if (Array.isArray(v) && v[0] && typeof v[0] === "object") console.log(`  .${k}[0]:`, keys(v[0]).join(", "));
    else if (v && typeof v === "object") console.log(`  .${k}:`, keys(v).join(", "));
  }
  return sample;
}

// 1. backups (logical backup containers)
const backups = await get("backups?limit=3");
const b = show("BACKUPS", backups);

// 2. objects inside a backup (VM-level, should carry restorePointsCount)
if (b?.id) {
  const objs = await get(`backups/${b.id}/objects?limit=3`);
  show("BACKUP/{id}/OBJECTS", objs);
}

// 3. backupObjects (global protected objects)
const bo = show("BACKUP OBJECTS", await get("backupObjects?limit=3"));

// 4. restore points for one object
if (bo?.id) {
  const rps = await get(`backupObjects/${encodeURIComponent(bo.id)}/restorePoints?limit=2`);
  show("BACKUPOBJECT/{id}/RESTOREPOINTS", rps);
}

// 5. job config: how VMs are listed inside a job (includes[])
const jid = (await get("jobs/states?limit=1"))?.data?.[0]?.id;
if (jid) {
  const job = await get(`jobs/${jid}`);
  const vms = job?.virtualMachines;
  console.log("\n=== JOB.virtualMachines ===");
  console.log("keys:", keys(vms).join(", "));
  if (vms?.includes?.[0]) console.log("includes[0] keys:", keys(vms.includes[0]).join(", "), "\nsample:", JSON.stringify(vms.includes[0]));
}

// 6. is there a vmRestorePoints endpoint?
show("vmRestorePoints", await get("vmRestorePoints?limit=2"), false);

process.exit(0);
