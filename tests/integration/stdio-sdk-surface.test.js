/**
 * Characterization of the stdio path (the only path where the MCP SDK and Zod run):
 * every module in tools/ registers on a real McpServer, the client lists the same
 * tools the HTTP dictionary exposes, and Zod enforces bounds and defaults.
 *
 * Written before the SDK 1.25.3 -> 1.32.x and Zod 3 -> 4 upgrade so the majors are
 * verified against the same assertions. No Veeam call is made: only tools/list and
 * calls rejected by schema validation, which never reach a handler.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const toolsDir = path.join(root, 'tools');

const EXPECTED_TOOLS = [
  'veeam_get_license_compliance',
  'veeam_get_mcp_prompt',
  'veeam_get_server_info',
  'veeam_list_mcp_prompts',
  'veeam_list_mcp_resources',
  'veeam_manage_backup_jobs',
  'veeam_manage_backup_sessions',
  'veeam_read_mcp_resource',
  'veeam_search_backup_jobs',
  'veeam_search_backup_sessions',
  'veeam_search_infrastructure',
  'veeam_search_restore_points',
];

let client;

before(async () => {
  const server = new McpServer({ name: 'veeam-backup', version: 'test' });
  for (const file of fs.readdirSync(toolsDir).filter((f) => f.endsWith('.js')).sort()) {
    const mod = await import(`file://${path.join(toolsDir, file)}`);
    if (typeof mod.default === 'function') mod.default(server);
  }
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b);
  client = new Client({ name: 'stdio-surface-test', version: '1' });
  await client.connect(a);
});

after(async () => {
  await client?.close();
});

describe('stdio path: SDK McpServer + Zod', () => {
  it('registers the 12 tools without throwing', async () => {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), EXPECTED_TOOLS);
  });

  it('publishes Zod bounds and defaults as JSON Schema', async () => {
    const { tools } = await client.listTools();
    const jobs = tools.find((t) => t.name === 'veeam_search_backup_jobs');
    assert.equal(jobs.inputSchema.type, 'object');
    assert.equal(jobs.inputSchema.properties.limit.maximum, 50);
    assert.equal(jobs.inputSchema.properties.limit.default, 35);
    const manage = tools.find((t) => t.name === 'veeam_manage_backup_jobs');
    assert.deepEqual(manage.inputSchema.properties.action.enum, ['get_details', 'get_schedule', 'start', 'stop']);
  });

  it('rejects an out-of-range argument before the handler (no Veeam call)', async () => {
    const r = await client.callTool({ name: 'veeam_search_backup_jobs', arguments: { limit: 999 } });
    assert.equal(r.isError, true);
    assert.match(r.content[0].text, /limit/);
  });

  it('rejects an unknown action enum before the handler (no Veeam call)', async () => {
    const r = await client.callTool({ name: 'veeam_manage_backup_jobs', arguments: { action: 'delete', jobId: 'x' } });
    assert.equal(r.isError, true);
    assert.match(r.content[0].text, /action/);
  });
});

describe('package.json dependency pinning', () => {
  it('declares the MCP SDK with a semver range, never "latest"', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const range = pkg.dependencies['@modelcontextprotocol/sdk'];
    assert.notEqual(range, 'latest');
    assert.match(range, /^\^1\.(3[2-9]|[4-9]\d)\.\d+$/, `SDK range must be ^1.32.x or newer, got ${range}`);
  });
});
