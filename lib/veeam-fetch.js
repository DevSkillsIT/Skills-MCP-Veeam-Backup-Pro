// lib/veeam-fetch.js
// Centralized fetch wrapper for the VBR REST API with a SHORT timeout and no retries.
// @MX:NOTE: Offline hosts/components are normal in an MSP fleet. A bare node-fetch with no
// timeout can hang when VBR waits on an unreachable host. vbrFetch aborts quickly so a tool
// degrades gracefully instead of blocking. vbrTryGet never throws — callers use it for
// best-effort enrichment that must not break the surrounding tool.
import fetch from "node-fetch";
import https from "https";

const httpsAgent = new https.Agent({ rejectUnauthorized: process.env.VEEAM_IGNORE_SSL === "true" });

// Short default; override via env if an operator legitimately needs longer.
export const DEFAULT_TIMEOUT_MS = Number(process.env.VEEAM_HTTP_TIMEOUT_MS) || 8000;

export function authHeaders(token, apiVersion) {
  return { accept: "application/json", "x-api-version": apiVersion, Authorization: `Bearer ${token}` };
}

// @MX:NOTE: vbrFetch injects timeout + the shared TLS agent. It forwards a caller-supplied
// `agent` if present (legacy call sites still pass `agent: httpsAgent`), else uses its own.
// It does NOT inject Content-Type — POST callers (start/stop job) must set it in `headers`.
export async function vbrFetch(url, { headers, method = "GET", body, agent, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { method, headers, body, agent: agent || httpsAgent, signal: controller.signal });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`Veeam API timeout apos ${timeoutMs}ms (host/componente pode estar offline): ${url.split("?")[0]}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Best-effort GET: returns { ok, status, data, error } and NEVER throws.
// Use for enrichment that should fail soft (e.g. an offline host's repository state).
export async function vbrTryGet(url, { headers, timeoutMs } = {}) {
  try {
    const r = await vbrFetch(url, { headers, timeoutMs });
    if (!r.ok) return { ok: false, status: r.status, data: null };
    return { ok: true, status: r.status, data: await r.json() };
  } catch (err) {
    return { ok: false, status: 0, data: null, error: err.message };
  }
}
