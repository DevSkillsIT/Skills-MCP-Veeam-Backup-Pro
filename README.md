# Veeam VBR MCP Server - Hybrid Edition

A hybrid Model Context Protocol (MCP) server for Veeam Backup & Replication that supports both traditional MCP and HTTP/OpenAPI modes **simultaneously**.

## 🚀 **What Makes This "Hybrid"?**

This server is **NOT** just a traditional MCP server. It's a **hybrid architecture** that:

1. **Runs both protocols simultaneously** - MCP (stdio) AND HTTP (REST)
2. **Shares the same tool logic** - Tools work identically in both modes
3. **Single deployment** - One server serves both Claude Desktop AND Copilot Studio
4. **No external proxy needed** - Unlike MCPO, this is built directly into the server

## 🎯 **Three Operating Modes**

### **Mode 1: Traditional MCP Only** (Claude Desktop)
```bash
npm run start:mcp
# or
node vbr-mcp-server.js --mcp
```

### **Mode 2: HTTP/OpenAPI Only** (Copilot Studio)
```bash
npm run start:http
# or
node vbr-mcp-server.js --http --port=8000
```

### **Mode 3: Hybrid (Both Modes Simultaneously)** ⭐ **RECOMMENDED**
```bash
npm start
# or
node vbr-mcp-server.js
```

## 🔑 **Key Benefits of Hybrid Mode**

✅ **Single Server**: One application serves both protocols  
✅ **Shared Tools**: Same tool logic for both MCP and HTTP  
✅ **Consistent Behavior**: Tools work identically in both modes  
✅ **Easy Management**: One configuration, one deployment  
✅ **Flexible Clients**: Support any MCP or HTTP client  
✅ **No External Dependencies**: Unlike MCPO, no proxy service needed  

## 🛠️ **Installation & Quick Start**

```bash
# Clone the repository
git clone https://github.com/mritsurgeon/veeam-hybrid-mcp.git
cd veeam-hybrid-mcp

# Install dependencies
npm install

# Start in hybrid mode (both MCP and HTTP)
npm start

# Or use the startup script
./start.sh
```

## 🔧 **Available Tools**

- **backup-jobs-tool**: Get configured backup jobs (not sessions!)
- **job-details-tool**: Get detailed job information with recent sessions
- **backup-sessions-tool**: Monitor backup job execution sessions (history)
- **auth-tool**: Authenticate with Veeam VBR server

## 🌐 **HTTP/OpenAPI Mode**

- **Swagger UI**: `http://localhost:8000/docs`
- **Health Check**: `http://localhost:8000/health`
- **Tool Endpoints**: `POST /{tool-name}`

## 🔌 **Claude Desktop Integration**

```json
{
  "mcpServers": {
    "Veeam VBR": {
      "command": "node",
      "args": ["/full/path/to/vbr-mcp-server.js", "--mcp"]
    }
  }
}
```

## 🐳 **Docker Support**

```bash
# Quick start
docker-compose up -d

# Or build manually
docker build -t veeam-mcp-hybrid .
docker run -p 8000:8000 veeam-mcp-hybrid
```

## 🎯 **Why This Approach is Better Than MCPO**

- **No External Proxy**: Built directly into the server
- **Better Performance**: Direct tool execution without proxy overhead
- **Simpler Architecture**: One server, two protocols, shared tools
- **Easier Deployment**: Single container/service to manage

## 📚 **Documentation**

- **README.md**: This file - explains the hybrid architecture
- **DEPLOYMENT.md**: Detailed deployment instructions
- **HYBRID_APPROACH_SUMMARY.md**: Technical implementation details
- **TROUBLESHOOTING.md**: Common issues and solutions

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 **License**

MIT License - see [LICENSE](LICENSE) file for details.

---

**This is the first true hybrid MCP/HTTP server - solving the Claude Desktop + Copilot Studio integration problem at its source!** ��
