#!/bin/bash

# Veeam VBR MCP Server - Hybrid Edition Startup Script

echo "🚀 Veeam VBR MCP Server - Hybrid Edition"
echo "=========================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Parse command line arguments
MODE="hybrid"
PORT=8000

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
            echo "  --mcp          Run in MCP mode only (for Claude Desktop)"
            echo "  --http         Run in HTTP mode only (for Copilot Studio)"
            echo "  --port PORT    Set HTTP port (default: 8000)"
            echo "  --help         Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                    # Run in hybrid mode (both MCP and HTTP)"
            echo "  $0 --mcp             # Run in MCP mode only"
            echo "  $0 --http --port 9000 # Run in HTTP mode on port 9000"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Set the command based on mode
case $MODE in
    "mcp")
        echo "🎯 Starting in MCP mode only..."
        CMD="node vbr-mcp-server.js --mcp"
        ;;
    "http")
        echo "🌐 Starting in HTTP mode only on port $PORT..."
        CMD="node vbr-mcp-server.js --http --port=$PORT"
        ;;
    "hybrid")
        echo "🔄 Starting in hybrid mode (MCP + HTTP on port $PORT)..."
        CMD="node vbr-mcp-server.js --port=$PORT"
        ;;
esac

echo ""
echo "📋 Configuration:"
echo "  Mode: $MODE"
if [ "$MODE" != "mcp" ]; then
    echo "  HTTP Port: $PORT"
    echo "  API Docs: http://localhost:$PORT/docs"
    echo "  Health Check: http://localhost:$PORT/health"
fi
echo ""

# Start the server
echo "🚀 Starting server..."
echo "Command: $CMD"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

eval $CMD 