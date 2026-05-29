# Deployment Guide - Veeam VBR MCP Server

**Guia completo de deployment para ambientes de desenvolvimento, staging e produção**

**Atualizado em:** 2025-12-10
**Versão do Protocolo:** MCP 2024-11-05 (HTTP Streamable com Bearer Token)

---

Este guia cobre o deployment do servidor MCP Veeam com suporte ao protocolo HTTP Streamable (2024-11-05), compatível com Claude Code e Gemini CLI.

## 🏗️ Architecture Overview

The hybrid server operates in three modes:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Claude Desktop│    │  Copilot Studio  │    │   Open WebUI    │
│   (MCP Client)  │    │  (OpenAPI Client)│    │  (OpenAPI Client)│
└─────────┬───────┘    └──────────┬───────┘    └─────────┬───────┘
          │                        │                        │
          │                        │                        │
          ▼                        ▼                        ▼
┌─────────────────────────────────────────────────────────────────┐
│              Veeam VBR MCP Hybrid Server                       │
│                                                                 │
│  ┌─────────────┐    ┌─────────────────────────────────────────┐ │
│  │   MCP Mode  │    │           HTTP/OpenAPI Mode             │ │
│  │             │    │                                         │ │
│  │ • stdio     │    │ • Express.js HTTP server                │ │
│  │ • MCP SDK   │    │ • Auto-generated OpenAPI schemas        │ │
│  │ • Tools     │    │ • Swagger UI documentation              │ │
│  │             │    │ • RESTful endpoints                     │ │
│  └─────────────┘    └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
          │                        │
          │                        │
          ▼                        ▼
┌─────────────────┐    ┌─────────────────────────────────────────┐
│   Veeam VBR     │    │           Veeam VBR                     │
│   REST API      │    │           REST API                      │
│   (Port 9419)   │    │           (Port 9419)                  │
└─────────────────┘    └─────────────────────────────────────────┘
```

## 🚀 Quick Start

### 1. Local Development

```bash
# Clone and setup
git clone https://github.com/jorgedlcruz/modelcontextprotocol_veeam.git
cd modelcontextprotocol_veeam/veeam-backup-and-replication-mcp

# Install dependencies
npm install

# Start in hybrid mode (both MCP and HTTP)
npm start

# Or use the startup script
./start.sh
```

### 2. Docker Deployment

```bash
# Build and run
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs -f
```

## 🎯 Deployment Modes

### Mode 1: MCP HTTP Streamable (Recomendado) ⭐

Para Claude Code, Gemini CLI e clientes modernos MCP:

```bash
# Command line (porta padrão 8825)
node vbr-mcp-server.js --port=8825

# Startup script
./start.sh

# Docker
docker run -d -p 8825:8825 veeam-mcp:latest node vbr-mcp-server.js --port=8825
```

**Configuration for Claude Code:**

```json
{
  "mcpServers": {
    "veeam-backup": {
      "type": "streamable-http",
      "url": "http://localhost:8825/mcp",
      "headers": {
        "Authorization": "Bearer SEU_TOKEN_AQUI"
      }
    }
  }
}
```

**Configuration for Gemini CLI:**

```json
{
  "mcpServers": {
    "veeam-backup": {
      "httpUrl": "http://localhost:8825/mcp",
      "headers": {
        "Authorization": "Bearer SEU_TOKEN_AQUI"
      },
      "timeout": 30000
    }
  }
}
```

**Recursos Disponíveis:**
- ✅ Endpoints JSON-RPC 2.0 (POST /mcp)
- ✅ Server-Sent Events (GET /mcp)
- ✅ Session Management (DELETE /mcp)
- ✅ Autenticação Bearer Token
- ✅ Health Check (GET /health)
- ✅ 15 ferramentas Veeam

---

### Mode 2: Traditional MCP stdio (Legacy)

For Claude Desktop and other stdio-based MCP clients:

```bash
# Command line
node vbr-mcp-server.js --mcp

# Startup script
./start.sh --mcp

# Docker
docker run -it --rm veeam-mcp:latest node vbr-mcp-server.js --mcp
```

**Configuration for Claude Desktop:**

#### **Option A: Local Server (Recommended)**
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

#### **Option B: Remote Server (Advanced)**
```json
{
  "mcpServers": {
    "Veeam VBR": {
      "command": "ssh",
      "args": ["user@server", "cd /path/to/server && node vbr-mcp-server.js --mcp"]
    }
  }
}
```

#### **Option C: Docker Container**
```json
{
  "mcpServers": {
    "Veeam VBR": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "veeam-mcp-hybrid:latest", "node", "vbr-mcp-server.js", "--mcp"]
    }
  }
}
```

**Important Notes:**
- **Use `--mcp` flag**: This runs the server in MCP mode only (recommended for Claude Desktop)
- **Use absolute paths**: Replace `/full/path/to/` with the actual path to your server
- **Alternative**: Use no flags for hybrid mode (both MCP and HTTP simultaneously)
- **Restart Claude Desktop**: After changing config, restart Claude Desktop
- **Check logs**: If tools don't appear, check server logs for errors

### Mode 3: HTTP/OpenAPI (REST API)

For Copilot Studio, APIs web e outros clientes HTTP:

```bash
# Command line
node vbr-mcp-server.js --http --port=8000

# Startup script
./start.sh --http --port=8000

# Docker
docker run -d -p 8000:8000 veeam-mcp-hybrid:latest node vbr-mcp-server.js --http
```

**Configuration for Copilot Studio:**
- Base URL: `http://your-server:8000`
- Tool URLs:
  - `http://your-server:8000/auth`
  - `http://your-server:8000/server-info`
  - `http://your-server:8000/backup-proxies`
  - `http://your-server:8000/backup-repositories`
  - `http://your-server:8000/backup-sessions`
  - `http://your-server:8000/license-tools`

### Mode 4: Hybrid (MCP Streamable + stdio + REST)

Execute todos os protocolos simultaneamente (máxima compatibilidade):

```bash
# Command line
node vbr-mcp-server.js --port=8825

# Startup script
./start.sh

# Docker (default)
docker-compose up -d
```

**Suporta:**
- ✅ Claude Code (MCP HTTP Streamable)
- ✅ Gemini CLI (MCP HTTP Streamable)
- ✅ Claude Desktop (MCP stdio)
- ✅ Copilot Studio (REST API)
- ✅ APIs Web (REST API)

## 🐳 Docker Deployment

### Development Environment

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  veeam-mcp-dev:
    build: .
    ports:
      - "8000:8000"
    environment:
      - NODE_ENV=development
      - DEBUG=*
    volumes:
      - .:/app
      - /app/node_modules
    command: ["npm", "run", "dev"]
```

### Production Environment

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  veeam-mcp-prod:
    build: .
    ports:
      - "8000:8000"
    environment:
      - NODE_ENV=production
      - VEEAM_HOST=${VEEAM_HOST}
      - VEEAM_USERNAME=${VEEAM_USERNAME}
      - VEEAM_PASSWORD=${VEEAM_PASSWORD}
    volumes:
      - ./config.json:/app/config.json:ro
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Multi-Environment Setup

```bash
# Development
docker-compose -f docker-compose.dev.yml up -d

# Production
docker-compose -f docker-compose.prod.yml up -d

# Staging
docker-compose -f docker-compose.staging.yml up -d
```

## 🔒 Security Configuration

### 1. MCP Bearer Token Authentication

**Configuração obrigatória** para endpoints MCP HTTP Streamable.

**Arquivo .env:**
```bash
# MCP HTTP Streamable Authentication
AUTH_TOKEN=SEU_TOKEN_AQUI
```

**Gerar Token Seguro:**
```bash
# Gerar token aleatório de 64 caracteres
openssl rand -hex 32
# ou
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Validação:**
```bash
# Testar autenticação
curl -X POST http://localhost:8825/mcp \
  -H 'Authorization: Bearer SEU_TOKEN_AQUI' \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"initialize","id":1}'
```

**Endpoints Protegidos:**
- `POST /mcp` - JSON-RPC handler
- `GET /mcp` - SSE endpoint
- `DELETE /mcp` - Session termination

**Endpoints Públicos:**
- `GET /health` - Health check (sem autenticação)
- `GET /` - Root (informações básicas)

### 2. CORS Configuration

```json
{
  "modes": {
    "http": {
      "cors": {
        "enabled": true,
        "origins": ["https://your-domain.com", "http://localhost:3000"]
      }
    }
  }
}
```

### 3. Reverse Proxy with HTTPS

Using nginx:
```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 🌐 Network Configuration

### Firewall Rules

```bash
# Allow HTTP access
sudo ufw allow 8000/tcp

# Allow Veeam API access
sudo ufw allow 9419/tcp

# Restrict to specific networks
sudo ufw allow from 203.0.113.0/24 to any port 8000
```

### Load Balancer Configuration

For high availability:
```yaml
# docker-compose.ha.yml
version: '3.8'

services:
  veeam-mcp-1:
    build: .
    ports:
      - "8001:8000"
    environment:
      - NODE_ENV=production
    restart: unless-stopped

  veeam-mcp-2:
    build: .
    ports:
      - "8002:8000"
    environment:
      - NODE_ENV=production
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - veeam-mcp-1
      - veeam-mcp-2
```

## 📊 Monitoring and Logging

### Health Checks

```bash
# Manual health check
curl http://localhost:8000/health

# Automated monitoring
watch -n 30 'curl -s http://localhost:8000/health | jq .'
```

### Log Aggregation

```yaml
# docker-compose.logging.yml
version: '3.8'

services:
  veeam-mcp:
    build: .
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info

  # Optional: ELK stack for log aggregation
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:7.17.0
    environment:
      - discovery.type=single-node
    volumes:
      - elasticsearch-data:/usr/share/elasticsearch/data

  logstash:
    image: docker.elastic.co/logstash/logstash:7.17.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf:ro

  kibana:
    image: docker.elastic.co/kibana/kibana:7.17.0
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200

volumes:
  elasticsearch-data:
```

## 🔧 Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Check what's using the port
   lsof -i :8000
   
   # Kill the process
   kill -9 <PID>
   
   # Or use a different port
   ./start.sh --http --port=9000
   ```

2. **Veeam Connection Issues**
   ```bash
   # Test Veeam connectivity
   curl -k https://your-veeam-server:9419/api/v1/serverInfo
   
   # Check SSL certificates
   openssl s_client -connect your-veeam-server:9419
   ```

3. **Tool Loading Errors**
   ```bash
   # Check tool files
   ls -la tools/
   
   # Validate JavaScript syntax
   node -c tools/*.js
   
   # Check for missing dependencies
   npm list
   ```

### Debug Mode

```bash
# Enable debug logging
DEBUG=* node vbr-mcp-server.js --http

# Docker debug
docker-compose logs -f veeam-mcp-server
docker exec -it veeam-mcp-hybrid sh
```

## 📈 Performance Tuning

### Node.js Optimization

```bash
# Increase memory limit
node --max-old-space-size=4096 vbr-mcp-server.js

# Enable clustering
NODE_CLUSTER=4 node vbr-mcp-server.js
```

### Docker Optimization

```yaml
# docker-compose.optimized.yml
version: '3.8'

services:
  veeam-mcp:
    build: .
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 1G
    environment:
      - NODE_ENV=production
      - UV_THREADPOOL_SIZE=64
```

## 🚀 Production Checklist

- [ ] Environment variables configured
- [ ] SSL/TLS certificates installed
- [ ] Firewall rules configured
- [ ] Monitoring and alerting setup
- [ ] Backup and recovery procedures
- [ ] Security audit completed
- [ ] Performance testing completed
- [ ] Documentation updated
- [ ] Team training completed

## 📚 Additional Resources

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Veeam REST API Documentation](https://helpcenter.veeam.com/docs/backup/vsphere/rest/overview.html)
- [OpenAPI Specification](https://swagger.io/specification/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)

---

<div align="center">

**Made with ❤️ by [Skills IT - Soluções em TI](https://skillsit.com.br) - BRAZIL 🇧🇷**

*Deploying AI-Infrastructure Integration at Scale*

</div> 