// tests/unit/lib/veeam-fetch.test.js
// Unit tests for the fetch wrapper: auth headers + fail-soft behavior on unreachable hosts.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { authHeaders, vbrFetch, vbrTryGet, DEFAULT_TIMEOUT_MS } from '../../../lib/veeam-fetch.js';

describe('authHeaders()', () => {
  it('monta headers de autenticacao do Veeam', () => {
    const h = authHeaders('tok123', '1.2-rev0');
    assert.equal(h.Authorization, 'Bearer tok123');
    assert.equal(h['x-api-version'], '1.2-rev0');
    assert.equal(h.accept, 'application/json');
  });
});

describe('DEFAULT_TIMEOUT_MS', () => {
  it('tem timeout curto por padrao (<= 8s)', () => {
    assert.ok(DEFAULT_TIMEOUT_MS <= 8000);
    assert.ok(DEFAULT_TIMEOUT_MS > 0);
  });
});

describe('vbrTryGet() — fail-soft', () => {
  it('NUNCA lanca; retorna ok:false para host inalcancavel (timeout curto)', async () => {
    // 203.0.113.0/24 is TEST-NET-3 (RFC 5737) — guaranteed unroutable.
    const res = await vbrTryGet('https://203.0.113.1:9419/api/v1/sessions', {
      headers: authHeaders('x', '1.2-rev0'),
      timeoutMs: 500
    });
    assert.equal(res.ok, false);
    assert.equal(res.data, null);
    assert.ok('status' in res);
  });
});

describe('vbrFetch() — preserva method/headers/body (ponto Codex)', () => {
  it('encaminha method, headers e body para a requisicao', async () => {
    // Echo server local: devolve o que recebeu, para provar a preservacao.
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({
          method: req.method,
          contentType: req.headers['content-type'],
          xApiVersion: req.headers['x-api-version'],
          auth: req.headers['authorization'],
          body
        }));
      });
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;
    // http.Agent passado explicitamente — prova tambem o forward do agent (item P1 do audit).
    const agent = new http.Agent();
    try {
      const payload = JSON.stringify({ grant_type: 'password' });
      const resp = await vbrFetch(`http://127.0.0.1:${port}/api/oauth2/token`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-version': '1.2-rev0', 'Authorization': 'Bearer tok' },
        body: payload,
        agent,
        timeoutMs: 3000
      });
      const echo = await resp.json();
      assert.equal(echo.method, 'POST');
      assert.equal(echo.contentType, 'application/json');
      assert.equal(echo.xApiVersion, '1.2-rev0');
      assert.equal(echo.auth, 'Bearer tok');
      assert.deepEqual(JSON.parse(echo.body), { grant_type: 'password' });
    } finally {
      agent.destroy();
      await new Promise((r) => server.close(r));
    }
  });

  it('aborta com timeout curto sem travar', async () => {
    // Server que nunca responde -> deve abortar via timeout.
    const server = http.createServer(() => { /* never responds */ });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;
    const agent = new http.Agent();
    try {
      await assert.rejects(
        vbrFetch(`http://127.0.0.1:${port}/hang`, { headers: {}, agent, timeoutMs: 300 }),
        /timeout/i
      );
    } finally {
      agent.destroy();
      await new Promise((r) => server.close(r));
    }
  });
});
