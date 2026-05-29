// tests/integration/tools-registry.test.js
// Testes de integracao para registro de tools, annotations e limites
// SPEC-VEEAM-ENHANCE-001 / F10

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getMCPToolsList, isValidTool, getToolsStatistics } from '../../lib/mcp-tools-dictionary.js';

const tools = getMCPToolsList();

describe('Tools Registry', () => {

  it('registra 12 tools (4 search + 2 manage + 2 get + 4 bridge)', () => {
    assert.equal(tools.length, 12);
  });

  it('todas as tools tem name, description e inputSchema', () => {
    for (const tool of tools) {
      assert.ok(tool.name, `Tool sem name`);
      assert.ok(tool.description, `Tool ${tool.name} sem description`);
      assert.ok(tool.inputSchema, `Tool ${tool.name} sem inputSchema`);
    }
  });

  it('todas as tools usam prefixo veeam_', () => {
    for (const tool of tools) {
      assert.ok(tool.name.startsWith('veeam_'), `Tool ${tool.name} sem prefixo veeam_`);
    }
  });

  it('tools consolidadas estao registradas', () => {
    assert.ok(isValidTool('veeam_search_backup_jobs'));
    assert.ok(isValidTool('veeam_manage_backup_jobs'));
    assert.ok(isValidTool('veeam_search_backup_sessions'));
    assert.ok(isValidTool('veeam_manage_backup_sessions'));
    assert.ok(isValidTool('veeam_search_restore_points'));
    assert.ok(isValidTool('veeam_search_infrastructure'));
    assert.ok(isValidTool('veeam_get_license_compliance'));
    assert.ok(isValidTool('veeam_get_server_info'));
  });

  it('bridge tools estao registradas', () => {
    assert.ok(isValidTool('veeam_list_mcp_resources'));
    assert.ok(isValidTool('veeam_read_mcp_resource'));
    assert.ok(isValidTool('veeam_list_mcp_prompts'));
    assert.ok(isValidTool('veeam_get_mcp_prompt'));
  });

  it('tools antigas NAO existem mais', () => {
    assert.equal(isValidTool('veeam_list_backup_jobs'), false);
    assert.equal(isValidTool('veeam_start_backup_job'), false);
    assert.equal(isValidTool('veeam_list_failed_sessions'), false);
    assert.equal(isValidTool('veeam_get_license_info'), false);
    // Renamed tools — old names must not exist
    assert.equal(isValidTool('veeam_get_license'), false);
    assert.equal(isValidTool('veeam_read_resource'), false);
    assert.equal(isValidTool('veeam_list_prompts'), false);
    assert.equal(isValidTool('veeam_get_prompt'), false);
    assert.equal(isValidTool('veeam_list_resources'), false);
  });

  it('isValidTool retorna false para tool inexistente', () => {
    assert.equal(isValidTool('nonexistent_tool'), false);
  });

  it('getToolsStatistics retorna contagem correta', () => {
    const stats = getToolsStatistics();
    assert.equal(stats.total, 12);
    assert.equal(stats.categories.search, 4);
    assert.equal(stats.categories.manage, 2);
    assert.equal(stats.categories.get, 2);
    assert.equal(stats.categories.bridge, 4);
  });
});

describe('Tool Annotations (ALL tools)', () => {

  it('TODAS as 12 tools possuem annotations', () => {
    for (const tool of tools) {
      assert.ok(tool.annotations, `Tool ${tool.name} sem annotations`);
    }
  });

  it('TODAS as annotations tem 4 propriedades', () => {
    for (const tool of tools) {
      assert.notEqual(tool.annotations?.readOnlyHint, undefined, `${tool.name}: readOnlyHint ausente`);
      assert.notEqual(tool.annotations?.destructiveHint, undefined, `${tool.name}: destructiveHint ausente`);
      assert.notEqual(tool.annotations?.openWorldHint, undefined, `${tool.name}: openWorldHint ausente`);
      assert.notEqual(tool.annotations?.idempotentHint, undefined, `${tool.name}: idempotentHint ausente`);
    }
  });

  it('manage_backup_jobs e destructiveHint=true', () => {
    const tool = tools.find(t => t.name === 'veeam_manage_backup_jobs');
    assert.ok(tool);
    assert.equal(tool.annotations.destructiveHint, true);
    assert.equal(tool.annotations.readOnlyHint, false);
  });

  it('search/get tools sao readOnly=true', () => {
    const readOnlyTools = tools.filter(t =>
      t.name.includes('search_') ||
      t.name.includes('list_') ||
      (t.name.includes('get_') && !t.name.includes('manage_'))
    );
    for (const tool of readOnlyTools) {
      assert.equal(tool.annotations.readOnlyHint, true, `${tool.name} deveria ser readOnly`);
    }
  });

  it('bridge tools locais tem openWorldHint=false', () => {
    for (const name of ['veeam_list_mcp_resources', 'veeam_list_mcp_prompts']) {
      const tool = tools.find(t => t.name === name);
      assert.equal(tool.annotations.openWorldHint, false, `${name} deveria ter openWorldHint=false`);
    }
  });
});

describe('Token Control — Limits', () => {

  it('TODAS as tools com limit usam default=35', () => {
    // @MX:NOTE: default raised 25→35 in the dictionary (SPEC part 8); this stale assertion
    // still expected 25. Aligned to the real default.
    for (const tool of tools) {
      const limitProp = tool.inputSchema?.properties?.limit;
      if (limitProp) {
        assert.equal(limitProp.default, 35, `${tool.name}: limit default=${limitProp.default}`);
      }
    }
  });

  it('TODAS as tools com limit usam maximum=50', () => {
    for (const tool of tools) {
      const limitProp = tool.inputSchema?.properties?.limit;
      if (limitProp) {
        assert.equal(limitProp.maximum, 50, `${tool.name}: limit max=${limitProp.maximum}`);
      }
    }
  });
});

describe('Nomenclature Compliance', () => {

  it('TODOS os nomes tem 20-48 caracteres', () => {
    for (const tool of tools) {
      const len = tool.name.length;
      assert.ok(len >= 20, `${tool.name}: nome muito curto (${len} chars, min 20)`);
      assert.ok(len <= 48, `${tool.name}: nome muito longo (${len} chars, max 48)`);
    }
  });

  it('TODAS as descricoes tem 200-400 caracteres', () => {
    for (const tool of tools) {
      const len = tool.description.length;
      assert.ok(len >= 200, `${tool.name}: descricao curta (${len} chars, min 200)`);
      assert.ok(len <= 400, `${tool.name}: descricao longa (${len} chars, max 400)`);
    }
  });

  it('TODAS as descricoes mencionam Veeam pelo menos 2x', () => {
    for (const tool of tools) {
      const count = (tool.description.match(/Veeam/gi) || []).length;
      assert.ok(count >= 2, `${tool.name}: menciona Veeam apenas ${count}x (min 2)`);
    }
  });

  it('TODAS as descricoes mencionam Markdown', () => {
    for (const tool of tools) {
      assert.ok(tool.description.toLowerCase().includes('markdown'), `${tool.name}: sem Markdown`);
    }
  });

  it('NENHUMA descricao comeca com verbo', () => {
    const verbStarts = ['Busca ', 'Gerenciamento ', 'Leitura ', 'Execucao ', 'Catalogo '];
    for (const tool of tools) {
      for (const verb of verbStarts) {
        assert.ok(
          !tool.description.startsWith(verb),
          `${tool.name}: descricao comeca com verbo "${verb.trim()}"`
        );
      }
    }
  });
});
