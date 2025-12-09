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

// Default to both modes if no specific mode is specified
const runHttpMode = isHttpMode || (!isMcpMode && !isHttpMode);
const runMcpMode = isMcpMode || (!isMcpMode && !isHttpMode);

// Create an MCP server
const server = new McpServer({
  name: "veeam-backup",
  version: "1.0.0"
});

// Define the tools directory path
const toolsDir = path.join(__dirname, "tools");

// Store loaded tools for HTTP mode
const loadedTools = new Map();

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
    res.json({
      status: 'healthy',
      mode: 'http',
      tools: Array.from(loadedTools.keys()),
      timestamp: new Date().toISOString(),
      authentication: authStatus
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