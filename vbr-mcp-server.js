// vbr-mcp-server.js - Hybrid MCP/HTTP Server
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { authManager } from "./lib/auth-middleware.js";
import { randomUUID } from 'crypto';
import { mcpAuthMiddleware } from "./lib/mcp-auth-middleware.js";
import { getMCPToolsList, isValidTool, getToolSchema } from "./lib/mcp-tools-dictionary.js";

// Get the directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

// Parse command line arguments
const args = process.argv.slice(2);
const isHttpMode = args.includes('--http');
const isMcpMode = args.includes('--mcp');
const httpPort = parseInt(args.find(arg => arg.startsWith('--port='))?.split('=')[1]) || parseInt(process.env.HTTP_PORT) || 8825;

// Default to HTTP mode only (MCP stdio apenas com flag --mcp)
// Modo padrão: HTTP Streamable na porta 8825
const runHttpMode = !isMcpMode; // Sempre HTTP, exceto se --mcp explícito
const runMcpMode = isMcpMode;   // Apenas com flag --mcp

// Create an MCP server
const server = new McpServer({
  name: "veeam-backup",
  version: "1.0.0"
});

// Define the tools directory path
const toolsDir = path.join(__dirname, "tools");

// Store loaded tools for HTTP mode
const loadedTools = new Map();

// ============================================
// Session Management para MCP HTTP Streamable
// ============================================
const mcpSessions = new Map();

// Cleanup de sessões expiradas a cada 60 segundos
setInterval(() => {
  const now = Date.now();
  for (const [sessionId, session] of mcpSessions.entries()) {
    if (now - session.createdAt > 15 * 60 * 1000) { // 15 minutos
      mcpSessions.delete(sessionId);
      console.log(`[MCP] 🗑️  Session expirada e removida: ${sessionId}`);
    }
  }
}, 60000);

console.log('[MCP] ✅ Session management inicializado (timeout: 15 min)');

// Dynamically load all tools
async function loadTools() {
  try {
    // Check if tools directory exists
    if (!fs.existsSync(toolsDir)) {
      fs.mkdirSync(toolsDir, { recursive: true });
    }

    // Read tool files from the directory
    const files = fs.readdirSync(toolsDir);
    
    // Import and register each tool
    for (const file of files) {
      if (file.endsWith('.js')) {
        // FILTRAR auth-tool.js e auth-helper.js
        // A autenticação agora é automática via middleware
        if (file === 'auth-tool.js' || file === 'auth-helper.js') {
          console.log(`⚠️  Skipping ${file} - autenticação agora é automática via middleware`);
          continue;
        }

        try {
          const toolPath = path.join(toolsDir, file);
          const toolModule = await import(`file://${toolPath}`);

          if (toolModule.default && typeof toolModule.default === 'function') {
            // Register with MCP server
            toolModule.default(server);

            // Store tool info for HTTP mode
            const toolName = file.replace('.js', '').replace('-tool', '');
            loadedTools.set(toolName, toolModule.default);
          }
        } catch (err) {
          process.stderr.write(`Error loading tool ${file}: ${err.message}\n`);
        }
      }
    }
  } catch (error) {
    process.stderr.write(`Error loading tools: ${error.message}\n`);
  }
}

// Generate OpenAPI schema for a tool
function generateOpenAPISchema(toolName, toolFunction) {
  // This is a simplified schema generation
  // In a real implementation, you'd parse the tool's actual schema
  return {
    openapi: "3.0.0",
    info: {
      title: `${toolName} Tool`,
      version: "1.0.0",
      description: `MCP Tool: ${toolName}`
    },
    paths: {
      [`/${toolName}`]: {
        post: {
          summary: `Execute ${toolName}`,
          description: `Executes the ${toolName} MCP tool`,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    // Add properties based on tool schema
                  }
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Successful execution",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      content: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            type: { type: "string" },
                            text: { type: "string" }
                          }
                        }
                      },
                      isError: { type: "boolean" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  };
}

// ============================================
// MCP Protocol Handlers
// ============================================

/**
 * Handler: initialize
 * Handshake obrigatório do protocolo MCP
 */
async function handleMCPInitialize() {
  console.log('[MCP] 🤝 Initialize request recebida');
  return {
    protocolVersion: '2024-11-05',
    capabilities: {
      tools: {}
    },
    serverInfo: {
      name: 'veeam-backup',
      version: '1.0.0'
    }
  };
}

/**
 * Handler: tools/list
 * Retorna lista de 15 ferramentas disponíveis
 */
async function handleMCPToolsList() {
  const tools = getMCPToolsList();
  console.log(`[MCP] 📋 Retornando lista de ${tools.length} ferramentas`);
  return { tools };
}

/**
 * Handler: tools/call
 * Executa uma ferramenta específica
 */
async function handleMCPToolCall(params) {
  const { name, arguments: args } = params;

  console.log(`[MCP] 🔧 Executando tool: ${name}`);

  // Validar se tool existe
  if (!isValidTool(name)) {
    const availableTools = Array.from(loadedTools.keys()).join(', ');
    throw new Error(
      `Tool desconhecida: "${name}". ` +
      `Tools disponíveis: ${availableTools}`
    );
  }

  // Obter função da tool do Map
  const toolFunction = loadedTools.get(name);
  if (!toolFunction) {
    throw new Error(`Tool "${name}" não está carregada no servidor`);
  }

  // Criar mock MCP server context (REUTILIZAR PADRÃO EXISTENTE)
  const mockServer = {
    tool: (toolName, schema, handler) => {
      mockServer.currentHandler = handler;
    }
  };

  // Registrar tool para obter handler
  toolFunction(mockServer);

  if (!mockServer.currentHandler) {
    throw new Error(`Handler não encontrado para tool: ${name}`);
  }

  // Executar tool com argumentos
  const startTime = Date.now();
  const result = await mockServer.currentHandler(args);
  const duration = Date.now() - startTime;

  console.log(`[MCP] ✅ Tool "${name}" executada em ${duration}ms`);

  // Retornar resultado no formato MCP
  return result;
}

// Create HTTP server with OpenAPI endpoints
function createHttpServer() {
  const app = express();
  
  // Enable CORS
  app.use(cors());
  
  // Parse JSON bodies
  app.use(express.json());
  
  // Generate OpenAPI spec for all tools
  const openApiSpec = {
    openapi: "3.0.0",
    info: {
      title: "Veeam VBR MCP Server API",
      version: "1.0.0",
      description: "Hybrid MCP/HTTP server for Veeam Backup & Replication"
    },
    paths: {},
    components: {
      schemas: {}
    }
  };
  
  // Create endpoints for each tool
  for (const [toolName, toolFunction] of loadedTools) {
    const endpoint = `/${toolName}`;
    
    // Add to OpenAPI spec
    openApiSpec.paths[endpoint] = {
      post: {
        summary: `Execute ${toolName}`,
        description: `Executes the ${toolName} MCP tool`,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {}
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Successful execution",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    content: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          type: { type: "string" },
                          text: { type: "string" }
                        }
                      }
                    },
                    isError: { type: "boolean" }
                  }
                }
              }
            }
          }
        }
      }
    };
    
    // Create the endpoint
    app.post(endpoint, async (req, res) => {
      try {
        // Create a mock MCP server context for the tool
        const mockServer = {
          tool: (name, schema, handler) => {
            // Store the handler for execution
            mockServer.currentHandler = handler;
          }
        };
        
        // Register the tool to get its handler
        toolFunction(mockServer);
        
        if (mockServer.currentHandler) {
          // Execute the tool
          const result = await mockServer.currentHandler(req.body);
          res.json(result);
        } else {
          res.status(500).json({ error: "Tool handler not found" });
        }
      } catch (error) {
        res.status(500).json({ 
          error: error.message,
          content: [{ type: "text", text: `Error: ${error.message}` }],
          isError: true
        });
      }
    });
  }
  
  // Serve OpenAPI spec
  app.get('/openapi.json', (req, res) => {
    res.json(openApiSpec);
  });
  
  // Serve Swagger UI
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    const authStatus = authManager.getAuthStatus();
    const httpAuthConfigured = !!process.env.AUTH_TOKEN;

    res.json({
      status: 'healthy',
      mode: runHttpMode && runMcpMode ? 'hybrid' : (runHttpMode ? 'http' : 'mcp'),
      tools: Array.from(loadedTools.keys()),
      toolsCount: loadedTools.size,
      timestamp: new Date().toISOString(),
      veeamAuthentication: authStatus,
      httpAuthentication: {
        configured: httpAuthConfigured,
        type: 'Bearer Token',
        enabled: httpAuthConfigured
      },
      mcpSessions: {
        active: mcpSessions.size,
        total: mcpSessions.size
      },
      endpoints: {
        health: 'GET /health (público)',
        mcpPost: 'POST /mcp (JSON-RPC + autenticação)',
        mcpGet: 'GET /mcp (SSE + autenticação)',
        mcpDelete: 'DELETE /mcp (Session + autenticação)',
        docs: 'GET /docs (Swagger UI)',
        openapi: 'GET /openapi.json'
      },
      mcpProtocol: {
        version: '2024-11-05',
        methods: ['initialize', 'tools/list', 'tools/call'],
        transport: 'HTTP Streamable'
      }
    });
  });
  
  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      name: "Veeam VBR MCP Server",
      version: "1.0.0",
      mode: "http",
      description: "Hybrid MCP/HTTP server for Veeam Backup & Replication",
      endpoints: {
        docs: "/docs",
        openapi: "/openapi.json",
        health: "/health",
        tools: Array.from(loadedTools.keys()).map(tool => `/${tool}`)
      }
    });
  });

  // ============================================
  // MCP HTTP Streamable Endpoints (com autenticação Bearer Token)
  // ============================================

  // GET /mcp - SSE endpoint para notificações server-to-client (Gemini CLI requirement)
  app.get('/mcp', mcpAuthMiddleware, (req, res) => {
    const sessionId = req.headers['mcp-session-id'] || randomUUID();

    console.log(`[MCP] 🔌 SSE connection opened: ${sessionId}`);

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Mcp-Session-Id', sessionId);
    res.flushHeaders();

    // Registrar sessão
    mcpSessions.set(sessionId, { createdAt: Date.now(), res });

    // Enviar evento inicial de endpoint
    res.write('event: endpoint\ndata: /mcp\n\n');

    // Keepalive a cada 30 segundos
    const keepAlive = setInterval(() => {
      if (!res.writableEnded) {
        res.write(':keepalive\n\n');
      }
    }, 30000);

    // Cleanup ao fechar conexão
    req.on('close', () => {
      clearInterval(keepAlive);
      mcpSessions.delete(sessionId);
      console.log(`[MCP] 🔌 SSE connection closed: ${sessionId}`);
    });
  });

  // DELETE /mcp - Terminação de sessão (Gemini CLI requirement)
  app.delete('/mcp', mcpAuthMiddleware, (req, res) => {
    const sessionId = req.headers['mcp-session-id'];

    if (sessionId && mcpSessions.has(sessionId)) {
      mcpSessions.delete(sessionId);
      console.log(`[MCP] 🗑️  Session terminada: ${sessionId}`);
    }

    res.status(200).json({
      status: 'session_terminated',
      sessionId: sessionId || 'none'
    });
  });

  // POST /mcp - JSON-RPC handler principal (Claude Code + Gemini CLI)
  app.post('/mcp', mcpAuthMiddleware, async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] || randomUUID();

    // Retornar session ID no header
    res.setHeader('Mcp-Session-Id', sessionId);

    // Registrar/atualizar sessão
    if (!mcpSessions.has(sessionId)) {
      mcpSessions.set(sessionId, { createdAt: Date.now() });
    }

    console.log(`[MCP] 📥 Request recebida:`, {
      method: req.body?.method,
      id: req.body?.id,
      sessionId,
      tool: req.body?.params?.name || 'N/A'
    });

    try {
      const { method, params, id, jsonrpc } = req.body;
      let result;

      // Router de métodos MCP
      switch (method) {
        case 'initialize':
          result = await handleMCPInitialize();
          break;

        case 'tools/list':
          result = await handleMCPToolsList();
          break;

        case 'tools/call':
          result = await handleMCPToolCall(params);
          break;

        case 'notifications/initialized':
          // Notificação do protocolo MCP - apenas confirmar
          console.log('[MCP] 🔔 Notification: initialized');
          result = {};
          break;

        default:
          throw new Error(`Método não suportado: ${method}`);
      }

      // Retornar resposta JSON-RPC de sucesso
      res.json({
        jsonrpc: jsonrpc || '2.0',
        id: id,
        result: result
      });

    } catch (error) {
      console.error('[MCP] ❌ Erro:', error.message);

      // Retornar erro JSON-RPC
      res.json({
        jsonrpc: req.body?.jsonrpc || '2.0',
        id: req.body?.id || null,
        error: {
          code: -32000,
          message: error.message
        }
      });
    }
  });

  return app;
}

// Main execution function
async function main() {
  // Load all tools first
  await loadTools();
  
  console.log(`Loaded ${loadedTools.size} tools: ${Array.from(loadedTools.keys()).join(', ')}`);
  
  if (runHttpMode) {
    console.log(`Starting HTTP server on port ${httpPort}...`);
    const httpApp = createHttpServer();
    
    httpApp.listen(httpPort, () => {
      console.log(`🚀 HTTP server running on http://localhost:${httpPort}`);
      console.log(`📚 API documentation available at http://localhost:${httpPort}/docs`);
      console.log(`🔧 Available tools: ${Array.from(loadedTools.keys()).map(tool => `http://localhost:${httpPort}/${tool}`).join(', ')}`);
    });
  }
  
  if (runMcpMode) {
    console.log('Starting MCP server...');
    
    // Start receiving messages on stdin and sending messages on stdout
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.log('✅ MCP server started successfully');
  }
  
  if (!runHttpMode && !runMcpMode) {
    console.log('No mode specified. Use --http for HTTP mode, --mcp for MCP mode, or both for hybrid mode.');
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down gracefully...');
  process.exit(0);
});

// Start the server
main().catch(error => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});