// test-hybrid.js - Test script for the hybrid Veeam MCP server
import fetch from "node-fetch";

const BASE_URL = "http://localhost:8000";

async function testEndpoint(endpoint, description) {
  try {
    console.log(`\n🧪 Testing ${description}...`);
    const response = await fetch(`${BASE_URL}${endpoint}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ ${description} - Status: ${response.status}`);
      console.log(`   Response:`, JSON.stringify(data, null, 2));
    } else {
      console.log(`❌ ${description} - Status: ${response.status}`);
      console.log(`   Error: ${response.statusText}`);
    }
  } catch (error) {
    console.log(`❌ ${description} - Error: ${error.message}`);
  }
}

async function testToolExecution(toolName, description) {
  try {
    console.log(`\n🧪 Testing ${description}...`);
    const response = await fetch(`${BASE_URL}/${toolName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ ${description} - Status: ${response.status}`);
      console.log(`   Response:`, JSON.stringify(data, null, 2));
    } else {
      console.log(`❌ ${description} - Status: ${response.status}`);
      console.log(`   Error: ${response.statusText}`);
    }
  } catch (error) {
    console.log(`❌ ${description} - Error: ${error.message}`);
  }
}

async function runTests() {
  console.log("🚀 Veeam VBR MCP Server - Hybrid Edition Test Suite");
  console.log("====================================================");
  console.log(`Base URL: ${BASE_URL}`);
  console.log("");
  
  // Test basic endpoints
  await testEndpoint("/", "Root endpoint");
  await testEndpoint("/health", "Health check");
  await testEndpoint("/openapi.json", "OpenAPI specification");
  await testEndpoint("/docs", "Swagger UI (should redirect)");
  
  // Test tool execution
  console.log("\n🔧 Testing Tool Execution:");
  await testToolExecution("server-info", "Server info tool");
  await testToolExecution("auth", "Auth tool");
  await testToolExecution("backup-proxies", "Backup proxies tool");
  await testToolExecution("backup-repositories", "Backup repositories tool");
  await testToolExecution("backup-sessions", "Backup sessions tool");
  await testToolExecution("license-tools", "License tools");
  
  console.log("\n✨ Test suite completed!");
}

// Check if server is running
async function checkServerHealth() {
  try {
    const response = await fetch(`${BASE_URL}/health`);
    if (response.ok) {
      console.log("✅ Server is running and healthy!");
      return true;
    }
  } catch (error) {
    console.log("❌ Server is not running or not accessible");
    console.log("   Please start the server first with: npm start");
    return false;
  }
}

// Main execution
async function main() {
  const isHealthy = await checkServerHealth();
  if (isHealthy) {
    await runTests();
  } else {
    process.exit(1);
  }
}

main().catch(error => {
  console.error("❌ Test suite failed:", error);
  process.exit(1);
}); 