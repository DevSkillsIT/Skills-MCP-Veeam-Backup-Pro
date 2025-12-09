// lib/auth-middleware.js
// VEEAM MCP - Middleware de Autenticação Automática
// Gerencia autenticação OAuth2 Password Grant Flow com Veeam Backup & Replication
// Características:
// - Autenticação automática transparente para todas as tools
// - Token caching com validação de expiração (55 minutos)
// - Promise memoization para prevenir race conditions
// - ZERO exposição de credenciais em logs ou respostas

import fetch from "node-fetch";
import https from "https";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Obter diretório atual do módulo
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar variáveis de ambiente do diretório raiz do projeto
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Constantes de configuração (NUNCA logar PASSWORD ou TOKEN completo)
const VEEAM_HOST = process.env.VEEAM_HOST;
const VEEAM_USERNAME = process.env.VEEAM_USERNAME;
const VEEAM_PASSWORD = process.env.VEEAM_PASSWORD;
const VEEAM_PORT = process.env.VEEAM_PORT || "9419";
const VEEAM_API_VERSION = process.env.VEEAM_API_VERSION || "1.2-rev0";
const TOKEN_EXPIRY_MS = 55 * 60 * 1000; // 55 minutos (token expira em 60 min)

// HTTPS agent com suporte a certificados self-signed
const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.VEEAM_IGNORE_SSL === 'true'
});

/**
 * VeeamAuthManager - Gerenciador de autenticação Singleton
 *
 * IMPORTANTE: Implementa promise memoization para prevenir race conditions.
 * Quando múltiplas tools chamam ensureAuthenticated() simultaneamente,
 * apenas UMA requisição de autenticação é feita.
 */
class VeeamAuthManager {
  constructor() {
    this._authPromise = null; // Promise de autenticação em andamento
    console.log('[Auth] VeeamAuthManager inicializado');
    console.log('[Auth] Configuração:');
    console.log(`[Auth]   - Host: ${VEEAM_HOST}`);
    console.log(`[Auth]   - Port: ${VEEAM_PORT}`);
    console.log(`[Auth]   - Username: ${VEEAM_USERNAME}`);
    console.log(`[Auth]   - API Version: ${VEEAM_API_VERSION}`);
    console.log(`[Auth]   - SSL Ignore: ${process.env.VEEAM_IGNORE_SSL}`);
  }

  /**
   * Valida credenciais obrigatórias antes de autenticar
   * @throws {Error} Se credenciais estiverem faltando ou inválidas
   */
  _validateCredentials() {
    if (!VEEAM_HOST || VEEAM_HOST === "YOURIIPORFQDN") {
      throw new Error("VEEAM_HOST não configurado. Configure no arquivo .env");
    }

    if (!VEEAM_USERNAME || VEEAM_USERNAME === ".\\YOURLOCALUSER") {
      throw new Error("VEEAM_USERNAME não configurado. Configure no arquivo .env");
    }

    if (!VEEAM_PASSWORD || VEEAM_PASSWORD === "YOURPASS") {
      throw new Error("VEEAM_PASSWORD não configurado. Configure no arquivo .env");
    }
  }

  /**
   * Verifica se o token atual é válido
   * Token é considerado válido se existir e não estiver expirado
   * @returns {boolean} true se token válido, false caso contrário
   */
  isTokenValid() {
    if (!global.vbrAuth || !global.vbrAuth.token || !global.vbrAuth.timestamp) {
      return false;
    }

    const now = Date.now();
    const elapsed = now - global.vbrAuth.timestamp;
    const isValid = elapsed < TOKEN_EXPIRY_MS;

    if (!isValid) {
      console.log(`[Auth] Token expirado (idade: ${Math.round(elapsed / 1000)}s)`);
    }

    return isValid;
  }

  /**
   * Autentica no Veeam usando OAuth2 Password Grant Flow
   * IMPORTANTE: NUNCA logar password ou token completo
   * @returns {Promise<Object>} Objeto com { host, port, token, apiVersion }
   * @throws {Error} Se autenticação falhar
   */
  async authenticate() {
    // Validar credenciais antes de tentar autenticar
    this._validateCredentials();

    const authUrl = `https://${VEEAM_HOST}:${VEEAM_PORT}/api/oauth2/token`;
    console.log(`[Auth] Autenticando em: ${authUrl}`);
    console.log(`[Auth] Username: ${VEEAM_USERNAME}`);

    try {
      const response = await fetch(authUrl, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'x-api-version': VEEAM_API_VERSION,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `grant_type=password&username=${encodeURIComponent(VEEAM_USERNAME)}&password=${encodeURIComponent(VEEAM_PASSWORD)}&refresh_token=&code=&use_short_term_refresh=&vbr_token=`,
        agent: httpsAgent
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status} ${response.statusText}: ${errorText}`);
      }

      const data = await response.json();

      if (!data.access_token) {
        throw new Error('Resposta da API não contém access_token');
      }

      // Armazenar token em memória global com timestamp
      global.vbrAuth = {
        host: VEEAM_HOST,
        port: VEEAM_PORT,
        token: data.access_token,
        apiVersion: VEEAM_API_VERSION,
        timestamp: Date.now() // Para validação de expiração
      };

      // SEGURANÇA: Logar apenas os primeiros 10 caracteres do token
      const tokenPreview = data.access_token.substring(0, 10) + '...';
      console.log(`[Auth] ✅ Autenticação bem-sucedida`);
      console.log(`[Auth] Token preview: ${tokenPreview}`);
      console.log(`[Auth] Token expira em: ${Math.round(TOKEN_EXPIRY_MS / 60000)} minutos`);

      return global.vbrAuth;

    } catch (error) {
      console.error(`[Auth] ❌ Falha na autenticação:`, error.message);
      throw new Error(`Autenticação Veeam falhou: ${error.message}`);
    }
  }

  /**
   * Garante que existe um token válido, re-autenticando se necessário
   *
   * IMPORTANTE: Implementa promise memoization para prevenir race conditions.
   * Se múltiplas tools chamarem simultaneamente, apenas UMA requisição é feita.
   *
   * @returns {Promise<Object>} Objeto com { host, port, token, apiVersion }
   * @throws {Error} Se autenticação falhar
   */
  async ensureAuthenticated() {
    // Se token válido, retornar imediatamente
    if (this.isTokenValid()) {
      console.log('[Auth] Token válido reutilizado');
      return global.vbrAuth;
    }

    // Se autenticação já está em andamento, aguardar a promise existente
    // CRÍTICO: Previne múltiplas requisições simultâneas de autenticação
    if (this._authPromise) {
      console.log('[Auth] Aguardando autenticação já em andamento...');
      return await this._authPromise;
    }

    // Iniciar nova autenticação
    console.log('[Auth] Token inválido ou expirado. Re-autenticando...');
    this._authPromise = this.authenticate();

    try {
      const result = await this._authPromise;
      return result;
    } finally {
      // Limpar promise após conclusão (sucesso ou falha)
      this._authPromise = null;
    }
  }

  /**
   * Obtém status de autenticação para health check
   * @returns {Object} Status de autenticação
   */
  getAuthStatus() {
    if (!global.vbrAuth || !global.vbrAuth.timestamp) {
      return {
        status: 'not_authenticated',
        tokenExpiresAt: null
      };
    }

    const expiresAt = new Date(global.vbrAuth.timestamp + TOKEN_EXPIRY_MS);
    const isValid = this.isTokenValid();

    return {
      status: isValid ? 'authenticated' : 'token_expired',
      tokenExpiresAt: expiresAt.toISOString(),
      host: global.vbrAuth.host,
      port: global.vbrAuth.port,
      apiVersion: global.vbrAuth.apiVersion
    };
  }
}

// Singleton instance
const authManager = new VeeamAuthManager();

/**
 * Função exportada para uso em tools
 * USAGE:
 *   import { ensureAuthenticated } from "../lib/auth-middleware.js";
 *   const { host, port, token, apiVersion } = await ensureAuthenticated();
 */
export async function ensureAuthenticated() {
  return await authManager.ensureAuthenticated();
}

/**
 * Exportar instância do manager para health checks
 */
export { authManager };
