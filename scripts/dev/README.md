# Dev diagnostics (not operational tooling)

One-off, **read-only** scripts used to probe the live VBR REST API while developing the MCP
tools. They reuse `ensureAuthenticated()` (no credentials are read or printed) and only issue
GET requests. They are NOT part of the MCP server runtime.

- `inspect-api-fields.mjs` — dumps the field names each endpoint returns, to compare against
  what the tools map (find wasted/ignored fields).
- `inspect-job-vm-rp.mjs` — investigates how `backups → objects → restorePointsCount` and
  `jobs/{id}.virtualMachines` link, used to design the restore-point coverage + VM search.

Run from the repo root, e.g.: `node scripts/dev/inspect-api-fields.mjs`
