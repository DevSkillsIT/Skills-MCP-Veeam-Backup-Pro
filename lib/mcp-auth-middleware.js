// mcp-auth-middleware.js
// Middleware de autenticação Bearer Token para endpoint /mcp HTTP
// Skills IT - Dezembro 2025

/**
 * Middleware de autenticação para proteger endpoint /mcp via Bearer Token
 *
 * Valida header Authorization contra AUTH_TOKEN configurado no .env
 *
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {NextFunction} next - Express next function
 *
 * @returns {void} - Chama next() se autenticado, retorna 401 se falhar
 */
export function mcpAuthMiddleware(req, res, next) {
  console.log(`[MCP-AUTH] 🔍 Request recebido: ${req.method} ${req.path}`);
  const authHeader = req.headers['authorization'];

  // Bypass para endpoints públicos
  const publicPaths = ['/health', '/', '/docs', '/openapi.json'];
  if (publicPaths.includes(req.path)) {
    console.log('[MCP-AUTH] ✅ Endpoint público - bypass');
    return next();
  }

  console.log(`[MCP-AUTH] 🔐 Validando autenticação - Header: ${authHeader ? 'presente' : 'ausente'}`);

  // Validar presença do header Authorization
  if (!authHeader) {
    return res.status(401).json({
      jsonrpc: '2.0',
      id: req.body?.id || null,
      error: {
        code: -32001,
        message: 'Autenticação necessária. Envie header: Authorization: Bearer <TOKEN>',
        data: {
          required_header: 'Authorization',
          format: 'Bearer <TOKEN>',
          example: 'Authorization: Bearer SEU_TOKEN_AQUI'
        }
      }
    });
  }

  // Validar formato Bearer
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      jsonrpc: '2.0',
      id: req.body?.id || null,
      error: {
        code: -32001,
        message: 'Formato de autenticação inválido. Use: Bearer <TOKEN>',
        data: {
          received: authHeader.split(' ')[0],
          expected: 'Bearer',
          example: 'Authorization: Bearer SEU_TOKEN_AQUI'
        }
      }
    });
  }

  // Extrair token
  const token = authHeader.substring(7).trim();

  // Validar configuração do servidor
  const expectedToken = process.env.AUTH_TOKEN;

  if (!expectedToken) {
    console.error('[MCP-AUTH] ❌ AUTH_TOKEN não configurado no .env - SERVIDOR NÃO SEGURO!');
    return res.status(500).json({
      jsonrpc: '2.0',
      id: req.body?.id || null,
      error: {
        code: -32000,
        message: 'Servidor não configurado corretamente (AUTH_TOKEN ausente)',
        data: {
          hint: 'Administrador: configure AUTH_TOKEN no arquivo .env'
        }
      }
    });
  }

  // Validar token
  if (token !== expectedToken) {
    console.warn('[MCP-AUTH] ⚠️  Token inválido recebido de:', req.ip);
    return res.status(401).json({
      jsonrpc: '2.0',
      id: req.body?.id || null,
      error: {
        code: -32001,
        message: 'Token de autenticação inválido',
        data: {
          hint: 'Verifique o token configurado no cliente MCP'
        }
      }
    });
  }

  // Token válido - prosseguir
  console.log('[MCP-AUTH] ✅ Autenticação bem-sucedida para:', req.path);
  next();
}

/**
 * Gera um novo token Bearer aleatório seguro
 * Útil para gerar AUTH_TOKEN inicial
 *
 * @returns {Promise<string>} - Token hexadecimal de 64 caracteres
 */
export async function generateAuthToken() {
  const crypto = await import('crypto');
  return crypto.randomBytes(32).toString('hex');
}

// JSON-RPC Error Codes (Referência)
export const JSON_RPC_ERRORS = {
  PARSE_ERROR: -32700,          // JSON inválido
  INVALID_REQUEST: -32600,      // JSON-RPC inválido
  METHOD_NOT_FOUND: -32601,     // Método desconhecido
  INVALID_PARAMS: -32602,       // Parâmetros inválidos
  INTERNAL_ERROR: -32603,       // Erro interno do servidor
  SERVER_ERROR: -32000,         // Erro genérico do servidor (range -32000 a -32099)
  AUTH_ERROR: -32001,           // Autenticação falhou (custom)
  TOOL_NOT_FOUND: -32002,       // Tool não existe (custom)
  TOOL_EXECUTION_ERROR: -32003  // Erro na execução da tool (custom)
};
