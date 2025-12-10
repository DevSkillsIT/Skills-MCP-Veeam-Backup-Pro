import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import process from "process";

console.error('[DIAGNOSTIC] Starting MCP diagnostic test...');

console.error('[DIAGNOSTIC] Creating McpServer...');
const server = new McpServer({
  name: "diagnostic-test",
  version: "1.0.0"
});

console.error('[DIAGNOSTIC] McpServer created successfully');
console.error('[DIAGNOSTIC] server.connect is:', typeof server.connect);

// Register a simple tool
server.tool("test-tool", { type: "object", properties: {} }, async (args) => {
  return { content: [{ type: "text", text: "test response" }] };
});

console.error('[DIAGNOSTIC] Tool registered');

async function runTest() {
  try {
    console.error('[DIAGNOSTIC] Creating StdioServerTransport...');
    const transport = new StdioServerTransport();
    console.error('[DIAGNOSTIC] Transport created');

    console.error('[DIAGNOSTIC] Calling server.connect()...');
    const connectPromise = server.connect(transport);
    console.error('[DIAGNOSTIC] server.connect() returned, type:', typeof connectPromise);

    // Wait with timeout
    console.error('[DIAGNOSTIC] Waiting for connection (with 3s timeout)...');
    await Promise.race([
      connectPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), 3000)
      )
    ]);

    console.error('[DIAGNOSTIC] Successfully connected!');
  } catch (err) {
    console.error('[DIAGNOSTIC] Error during connection:', {
      name: err.name,
      message: err.message,
      stack: err.stack
    });
    process.exit(1);
  }
}

runTest();

// Fallback timeout
setTimeout(() => {
  console.error('[DIAGNOSTIC] Process still running after 5 seconds');
  process.exit(0);
}, 5000);
