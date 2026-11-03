// tools/bridge-tools.js
// Bridge tools para expor Resources e Prompts via MCPHub
// SPEC-VEEAM-ENHANCE-001 / F07
//
// MCPHub faz bridge de tools entre servidores MCP e clientes,
// mas NEM SEMPRE faz bridge de resources e prompts.
// Estas tools espelham os primitivos nativos como tools acessiveis.

import { z } from 'zod';
import { VEEAM_RESOURCES, readResource } from '../lib/resources.js';
import { VEEAM_PROMPTS, handleGetPrompt } from '../lib/prompts.js';
import { authManager } from '../lib/auth-middleware.js';
import { esc } from '../lib/formatters/markdown-helpers.js';

export default function(server) {

  // ============================================================================
  // veeam_list_mcp_resources — Lista URIs de resources disponiveis
  // ============================================================================
  server.tool(
    "veeam_list_mcp_resources",
    {
      // Sem parametros — lista todos os resources
    },
    async () => {
      try {
        const rows = VEEAM_RESOURCES.map(r =>
          `| ${esc(r.uri)} | ${esc(r.name)} | ${esc(r.description)} | ${r.annotations?.priority || 'N/A'} |`
        ).join('\n');

        const markdown = [
          `**${VEEAM_RESOURCES.length} resources disponiveis**`,
          '',
          '| URI | Nome | Descricao | Prioridade |',
          '|---|---|---|---|',
          rows,
          '',
          '_Use veeam_read_mcp_resource com a URI para ler o conteudo._'
        ].join('\n');

        return {
          content: [{ type: "text", text: markdown }]
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Erro ao listar resources: ${error.message}` }],
          isError: true
        };
      }
    }
  );

  // ============================================================================
  // veeam_read_mcp_resource — Le um resource por URI
  // ============================================================================
  server.tool(
    "veeam_read_mcp_resource",
    {
      // Zod raw shape: SDK >= 1.32 refuses a plain JSON-schema object here (it used to be
      // read as annotations, leaving the stdio tool with no input schema at all).
      uri: z.enum(VEEAM_RESOURCES.map(r => r.uri)).describe("URI do resource a ler")
    },
    async ({ uri }) => {
      try {
        const result = await readResource(uri);
        return {
          content: [{ type: "text", text: result.contents[0].text }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Erro ao ler resource "${uri}": ${error.message}. ` +
                  `URIs disponiveis: ${VEEAM_RESOURCES.map(r => r.uri).join(', ')}.`
          }],
          isError: true
        };
      }
    }
  );

  // ============================================================================
  // veeam_list_mcp_prompts — Lista prompts disponiveis
  // ============================================================================
  server.tool(
    "veeam_list_mcp_prompts",
    {
      // Sem parametros
    },
    async () => {
      try {
        const rows = VEEAM_PROMPTS.map(p => {
          const args = (p.arguments || [])
            .map(a => `${a.name}${a.required ? ' (obrig.)' : ''}`)
            .join(', ') || 'Nenhum';
          return `| ${esc(p.name)} | ${esc(p.description)} | ${args} |`;
        }).join('\n');

        const markdown = [
          `**${VEEAM_PROMPTS.length} prompts disponiveis**`,
          '',
          '| Nome | Descricao | Argumentos |',
          '|---|---|---|',
          rows,
          '',
          '_Use veeam_get_mcp_prompt com o nome do prompt para executa-lo._'
        ].join('\n');

        return {
          content: [{ type: "text", text: markdown }]
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `Erro ao listar prompts: ${error.message}` }],
          isError: true
        };
      }
    }
  );

  // ============================================================================
  // veeam_get_mcp_prompt — Executa um prompt especifico
  // ============================================================================
  server.tool(
    "veeam_get_mcp_prompt",
    {
      name: z.enum(VEEAM_PROMPTS.map(p => p.name)).describe("Nome do prompt a executar"),
      arguments: z.record(z.string(), z.unknown()).optional()
        .describe("Argumentos do prompt (use veeam_list_prompts para ver detalhes)")
    },
    async ({ name, arguments: promptArgs }) => {
      try {
        const veeamClient = await authManager.ensureAuthenticated();
        const result = await handleGetPrompt(name, promptArgs || {}, veeamClient);

        // Extrair texto das mensagens do prompt
        const text = result.messages
          .map(m => {
            if (m.content?.text) return m.content.text;
            if (typeof m.content === 'string') return m.content;
            return JSON.stringify(m.content);
          })
          .join('\n\n');

        return {
          content: [{ type: "text", text }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Erro ao executar prompt "${name}": ${error.message}. ` +
                  `Use veeam_list_mcp_prompts para ver prompts disponiveis.`
          }],
          isError: true
        };
      }
    }
  );
}
