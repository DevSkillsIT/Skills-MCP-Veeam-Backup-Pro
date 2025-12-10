// test-skills-it.js - Script de teste para Veeam MCP da Skills IT
import fetch from "node-fetch";

const BASE_URL = "http://localhost:8825";

async function testEndpoint(endpoint, description) {
  try {
    console.log(`\n🧪 Testando ${description}...`);
    const response = await fetch(`${BASE_URL}${endpoint}`);

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ ${description} - Status: ${response.status}`);
      console.log(`   Resposta:`, JSON.stringify(data, null, 2).substring(0, 200) + "...");
    } else {
      console.log(`❌ ${description} - Status: ${response.status}`);
      console.log(`   Erro: ${response.statusText}`);
    }
  } catch (error) {
    console.log(`❌ ${description} - Erro: ${error.message}`);
  }
}

async function testToolExecution(toolName, description, inputArgs = {}) {
  try {
    console.log(`\n🧪 Testando ${description}...`);
    const response = await fetch(`${BASE_URL}/${toolName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(inputArgs)
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ ${description} - Status: ${response.status}`);

      // Truncar resposta para exibição
      const dataStr = JSON.stringify(data, null, 2);
      if (dataStr.length > 500) {
        console.log(`   Resposta (primeiros 500 chars):`, dataStr.substring(0, 500) + "...");
      } else {
        console.log(`   Resposta:`, dataStr);
      }
    } else {
      const errorText = await response.text();
      console.log(`❌ ${description} - Status: ${response.status}`);
      console.log(`   Erro: ${errorText.substring(0, 200)}`);
    }
  } catch (error) {
    console.log(`❌ ${description} - Erro: ${error.message}`);
  }
}

async function runTests() {
  console.log("🚀 Veeam VBR MCP Server - Skills IT Test Suite");
  console.log("=================================================");
  console.log(`URL Base: ${BASE_URL}`);
  console.log(`Servidor Veeam: SKPMWVM006.ad.skillsit.com.br:9398`);
  console.log("");

  // Test basic endpoints
  console.log("\n📋 TESTES DE ENDPOINTS BÁSICOS:");
  await testEndpoint("/health", "Health check");

  // Test tool execution
  console.log("\n\n🔧 TESTES DE FERRAMENTAS:");

  console.log("\n--- 1. Server Info ---");
  await testToolExecution("server-info", "Informações do Servidor Veeam");

  console.log("\n--- 2. Authentication ---");
  await testToolExecution("auth", "Autenticação com Veeam");

  console.log("\n--- 3. Backup Jobs ---");
  await testToolExecution("backup-jobs", "Lista de Jobs de Backup");

  console.log("\n--- 4. Backup Proxies ---");
  await testToolExecution("backup-proxies", "Lista de Proxies de Backup");

  console.log("\n--- 5. Backup Repositories ---");
  await testToolExecution("backup-repositories", "Lista de Repositórios de Backup");

  console.log("\n--- 6. Backup Sessions ---");
  await testToolExecution("backup-sessions", "Histórico de Sessões de Backup");

  console.log("\n--- 7. Licenses ---");
  await testToolExecution("licenses", "Informações de Licenças Veeam");

  console.log("\n\n✨ Suite de testes concluída!");
}

// Check if server is running
async function checkServerHealth() {
  try {
    const response = await fetch(`${BASE_URL}/health`);
    if (response.ok) {
      console.log("✅ Servidor está rodando e saudável!");
      return true;
    }
  } catch (error) {
    console.log("❌ Servidor não está acessível");
    console.log("   Verifique se o processo PM2 está rodando: pm2 list");
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
  console.error("❌ Suite de testes falhou:", error);
  process.exit(1);
});
