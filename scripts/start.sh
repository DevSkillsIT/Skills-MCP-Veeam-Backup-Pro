#!/bin/bash

# Veeam VBR MCP Server - Hybrid Edition Startup Script
# Made with ❤️ by Skills IT - Soluções em TI

set -euo pipefail  # Exit on error, undefined variables, and pipe failures

echo "🚀 Veeam VBR MCP Server - Hybrid Edition"
echo "=========================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js 20+ is required. Current version: $(node --version)"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Please create it from .env.example"
    echo "   cp .env.example .env"
    echo "   nano .env"
    exit 1
fi

# Load port from .env if available
if [ -f ".env" ]; then
    # Source .env safely (only HTTP_PORT variable)
    HTTP_PORT_FROM_ENV=$(grep "^HTTP_PORT=" .env | cut -d '=' -f2 | tr -d '"' | tr -d "'" | tr -d ' ')
    if [ -n "$HTTP_PORT_FROM_ENV" ]; then
        DEFAULT_PORT="$HTTP_PORT_FROM_ENV"
    else
        DEFAULT_PORT=8825
    fi
else
    DEFAULT_PORT=8825
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Parse command line arguments
MODE="hybrid"
PORT="$DEFAULT_PORT"

while [[ $# -gt 0 ]]; do
    case $1 in
        --mcp)
            MODE="mcp"
            shift
            ;;
        --http)
            MODE="http"
            shift
            ;;
        --port)
            PORT="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --mcp          Run in MCP mode only (stdio for Claude Desktop)"
            echo "  --http         Run in HTTP mode only (REST for Copilot Studio/Gemini)"
            echo "  --port PORT    Set HTTP port (default: from .env HTTP_PORT or 8825)"
            echo "  --help         Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                    # Run in hybrid mode (recommended)"
            echo "  $0 --mcp             # Run in MCP mode only"
            echo "  $0 --http --port 9000 # Run in HTTP mode on custom port"
            echo ""
            echo "Modes:"
            echo "  hybrid (default): Runs both MCP (stdio) and HTTP simultaneously"
            echo "  mcp:              MCP only via stdio (Claude Desktop, Claude Code)"
            echo "  http:             HTTP only via REST (Copilot Studio, Gemini CLI)"
            exit 0
            ;;
        *)
            echo "❌ Unknown option: $1"
            echo "   Use --help for usage information"
            exit 1
            ;;
    esac
done

# Check if port is available (only for HTTP modes)
if [ "$MODE" != "mcp" ]; then
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "❌ Port $PORT is already in use."
        echo "   Please stop the service using this port or choose another port with --port"
        exit 1
    fi
fi

# Display configuration
echo ""
echo "📋 Configuration:"
echo "  Mode: $MODE"
if [ "$MODE" != "mcp" ]; then
    echo "  HTTP Port: $PORT"
    echo "  API Docs: http://localhost:$PORT/docs"
    echo "  Health Check: http://localhost:$PORT/health"
    echo "  OpenAPI Spec: http://localhost:$PORT/openapi.json"
fi
echo ""

# Build command array based on mode (NO eval - direct execution)
case $MODE in
    "mcp")
        echo "🎯 Starting in MCP mode only..."
        echo "   Compatible with: Claude Desktop, Claude Code"
        exec node vbr-mcp-server.js --mcp
        ;;
    "http")
        echo "🌐 Starting in HTTP mode only on port $PORT..."
        echo "   Compatible with: Copilot Studio, Gemini CLI, APIs"
        exec node vbr-mcp-server.js --http --port="$PORT"
        ;;
    "hybrid")
        echo "🔄 Starting in hybrid mode (MCP + HTTP on port $PORT)..."
        echo "   Compatible with: All clients (Claude, Gemini, Copilot, APIs)"
        exec node vbr-mcp-server.js --port="$PORT"
        ;;
esac

# Note: exec replaces the shell process with Node.js, so these lines won't execute
echo "❌ Failed to start server"
exit 1
