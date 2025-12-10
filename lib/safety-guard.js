// lib/safety-guard.js
// Safety Guard - Proteção para operações críticas do MCP Veeam Backup
// Baseado no padrão implementado no MCP GLPI
// Skills IT - Dezembro 2025

import crypto from 'crypto';
import { logOperation } from './audit-logger.js';

/**
 * SafetyGuard - Sistema de confirmação para operações críticas
 *
 * Protege operações destrutivas/críticas exigindo confirmação explícita
 * através de token de segurança e justificativa.
 *
 * Configuração via variáveis de ambiente:
 * - MCP_SAFETY_GUARD: "true" para habilitar proteção
 * - MCP_SAFETY_TOKEN: Token de segurança (min 8 caracteres)
 *
 * @class SafetyGuard
 *
 * @example
 * // Habilitar Safety Guard
 * export MCP_SAFETY_GUARD=true
 * export MCP_SAFETY_TOKEN="meu-token-secreto-aqui"
 *
 * // Usar em tool protegida
 * safetyGuard.requireConfirmation(
 *   'start-backup-job',
 *   confirmationToken,
 *   reason,
 *   jobId,
 *   'Job'
 * );
 */
class SafetyGuard {
  /**
   * Operações protegidas que exigem confirmação
   * @constant {Object}
   */
  static PROTECTED_OPERATIONS = {
    'start-backup-job': 'Iniciar backup job sob demanda (fora do schedule)',
    'stop-backup-job': 'Interromper backup job em execução'
  };

  /**
   * Comprimento mínimo do token de segurança
   * @constant {number}
   */
  static MIN_TOKEN_LENGTH = 8;

  /**
   * Comprimento mínimo da justificativa (reason)
   * @constant {number}
   */
  static MIN_REASON_LENGTH = 10;

  /**
   * Comprimento máximo da justificativa (reason)
   * Previne DoS simples via payloads grandes
   * @constant {number}
   */
  static MAX_REASON_LENGTH = 1000;

  constructor() {
    // Carregar configuração de variáveis de ambiente
    this.guardEnabled = process.env.MCP_SAFETY_GUARD === 'true';
    this.safetyToken = process.env.MCP_SAFETY_TOKEN || '';

    // Validar configuração ao inicializar
    this._validateConfiguration();

    // Log de inicialização
    if (this.guardEnabled) {
      console.log('[SafetyGuard] ✅ HABILITADO - Operações críticas exigem confirmação');
      console.log('[SafetyGuard] Operações protegidas:', Object.keys(SafetyGuard.PROTECTED_OPERATIONS).join(', '));
    } else {
      console.log('[SafetyGuard] ⚠️  DESABILITADO - Operações críticas não exigem confirmação');
    }
  }

  /**
   * Valida configuração do Safety Guard
   * @private
   * @throws {Error} Se configuração inválida e guard habilitado
   */
  _validateConfiguration() {
    if (!this.guardEnabled) {
      return; // Não validar se desabilitado
    }

    if (!this.safetyToken) {
      throw new Error(
        '[SafetyGuard] ERRO DE CONFIGURAÇÃO: MCP_SAFETY_TOKEN não está definido. ' +
        'Defina um token de segurança com pelo menos 8 caracteres.'
      );
    }

    if (this.safetyToken.length < SafetyGuard.MIN_TOKEN_LENGTH) {
      throw new Error(
        `[SafetyGuard] ERRO DE CONFIGURAÇÃO: MCP_SAFETY_TOKEN deve ter pelo menos ${SafetyGuard.MIN_TOKEN_LENGTH} caracteres. ` +
        `Atual: ${this.safetyToken.length} caracteres.`
      );
    }

    // Avisar se token parece fraco (muito curto ou padrão)
    if (this.safetyToken.length < 16) {
      console.warn(
        `[SafetyGuard] ⚠️  AVISO: Token de segurança tem apenas ${this.safetyToken.length} caracteres. ` +
        'Recomendado: pelo menos 16 caracteres para maior segurança.'
      );
    }

    if (this.safetyToken.toLowerCase().includes('token') ||
        this.safetyToken.toLowerCase().includes('password') ||
        this.safetyToken === 'your-safety-token-here-min-8-chars') {
      console.warn(
        '[SafetyGuard] ⚠️  AVISO: Token de segurança parece ser um valor padrão/exemplo. ' +
        'Use um token único e seguro gerado aleatoriamente.'
      );
    }
  }

  /**
   * Verifica se operação está na lista de protegidas
   *
   * @param {string} operation - Nome da operação
   * @returns {boolean} true se operação é protegida
   */
  isProtectedOperation(operation) {
    return operation in SafetyGuard.PROTECTED_OPERATIONS;
  }

  /**
   * Compara tokens de forma segura (timing-safe)
   * Previne timing attacks usando crypto.timingSafeEqual
   *
   * @private
   * @param {string} providedToken - Token fornecido pelo usuário
   * @returns {boolean} true se tokens são idênticos
   */
  _tokensMatch(providedToken) {
    if (!this.safetyToken || !providedToken) {
      return false;
    }

    try {
      const expected = Buffer.from(this.safetyToken, 'utf-8');
      const provided = Buffer.from(providedToken, 'utf-8');

      // Timing-safe comparison (equivalente a hmac.compare_digest do Python)
      return expected.length === provided.length &&
             crypto.timingSafeEqual(expected, provided);
    } catch (error) {
      console.error('[SafetyGuard] Erro ao comparar tokens:', error);
      return false;
    }
  }

  /**
   * Exige confirmação para operação crítica
   *
   * Este método deve ser chamado NO INÍCIO de toda tool protegida,
   * ANTES de qualquer operação ser executada.
   *
   * Validações (em ordem):
   * 1. Se guardEnabled === false → retorna true (bypass)
   * 2. Se operação não é protegida → retorna true
   * 3. Se confirmationToken ausente → lança erro + log auditoria
   * 4. Se token inválido → lança erro + log auditoria
   * 5. Se reason ausente/muito curto → lança erro + log auditoria
   * 6. Se reason muito longo (>1000 chars) → lança erro + log auditoria
   * 7. Log de auditoria da operação autorizada
   * 8. Retorna true (operação autorizada)
   *
   * @param {string} operation - Nome da operação (ex: 'start-backup-job')
   * @param {string|null} confirmationToken - Token de confirmação fornecido
   * @param {string|null} reason - Justificativa da operação (min 10 chars)
   * @param {string} targetId - ID do recurso alvo (ex: UUID do job)
   * @param {string} targetType - Tipo do recurso (ex: 'Job')
   *
   * @returns {boolean} true se operação autorizada
   * @throws {Error} Se confirmação inválida ou ausente
   *
   * @example
   * // Em start-backup-job-tool.js
   * safetyGuard.requireConfirmation(
   *   'start-backup-job',
   *   params.confirmationToken,
   *   params.reason,
   *   params.jobId,
   *   'Job'
   * );
   */
  async requireConfirmation(operation, confirmationToken, reason, targetId, targetType) {
    // 1. Bypass se Safety Guard desabilitado
    if (!this.guardEnabled) {
      return true;
    }

    // 2. Bypass se operação não é protegida
    if (!this.isProtectedOperation(operation)) {
      return true;
    }

    const operationDescription = SafetyGuard.PROTECTED_OPERATIONS[operation];

    // 3. Verificar presença do token de confirmação
    if (!confirmationToken) {
      // Log de auditoria para tentativa sem token
      console.warn(
        `[SafetyGuard] ⚠️  Tentativa de operação ${operation} SEM token de confirmação ` +
        `(target: ${targetType} ${targetId})`
      );

      try {
        await logOperation('safety-guard-rejected-no-token', {
          jobId: targetId,
          jobName: targetType,
          result: 'rejected',
          metadata: {
            operation: operation,
            operationDescription: operationDescription,
            rejectionReason: 'Token de confirmação ausente',
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        console.error('[SafetyGuard] Erro ao registrar log de auditoria (no-token):', error);
      }

      throw new Error(
        `SAFETY GUARD: Operação "${operation}" requer confirmação explícita.\n\n` +
        `Descrição: ${operationDescription}\n` +
        `Alvo: ${targetType} ${targetId}\n\n` +
        `Para executar esta operação, forneça:\n` +
        `- confirmationToken: Token de confirmação (igual ao MCP_SAFETY_TOKEN)\n` +
        `- reason: Justificativa detalhada (mínimo ${SafetyGuard.MIN_REASON_LENGTH} caracteres)\n\n` +
        `Exemplo de uso:\n` +
        `{\n` +
        `  "jobId": "${targetId}",\n` +
        `  "confirmationToken": "seu-token-aqui",\n` +
        `  "reason": "Backup emergencial solicitado pelo cliente para recuperação de dados críticos"\n` +
        `}`
      );
    }

    // 4. Verificar validade do token (timing-safe comparison)
    if (!this._tokensMatch(confirmationToken)) {
      console.warn(
        `[SafetyGuard] ⚠️  Tentativa de operação ${operation} com token INVÁLIDO ` +
        `(target: ${targetType} ${targetId})`
      );

      // Log de auditoria para tentativa de ataque (token inválido)
      try {
        await logOperation('safety-guard-rejected-invalid-token', {
          jobId: targetId,
          jobName: targetType,
          result: 'rejected',
          metadata: {
            operation: operation,
            operationDescription: operationDescription,
            rejectionReason: 'Token de confirmação inválido',
            tokenProvided: confirmationToken ? 'sim' : 'não',
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        console.error('[SafetyGuard] Erro ao registrar log de auditoria (invalid-token):', error);
      }

      throw new Error(
        `SAFETY GUARD: Token de confirmação inválido.\n\n` +
        `O token fornecido não corresponde ao MCP_SAFETY_TOKEN configurado.\n` +
        `Verifique se está usando o token correto.`
      );
    }

    // 5. Verificar presença e comprimento mínimo da justificativa
    if (!reason || reason.trim().length < SafetyGuard.MIN_REASON_LENGTH) {
      // Log de auditoria para tentativa sem justificativa adequada
      console.warn(
        `[SafetyGuard] ⚠️  Tentativa de operação ${operation} com reason INSUFICIENTE ` +
        `(target: ${targetType} ${targetId}, length: ${reason ? reason.trim().length : 0})`
      );

      try {
        await logOperation('safety-guard-rejected-insufficient-reason', {
          jobId: targetId,
          jobName: targetType,
          result: 'rejected',
          metadata: {
            operation: operation,
            operationDescription: operationDescription,
            rejectionReason: 'Justificativa ausente ou muito curta',
            reasonLength: reason ? reason.trim().length : 0,
            minRequired: SafetyGuard.MIN_REASON_LENGTH,
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        console.error('[SafetyGuard] Erro ao registrar log de auditoria (insufficient-reason):', error);
      }

      throw new Error(
        `SAFETY GUARD: Justificativa obrigatória para operação "${operation}".\n\n` +
        `A justificativa (reason) deve ter pelo menos ${SafetyGuard.MIN_REASON_LENGTH} caracteres.\n` +
        `Atual: ${reason ? reason.trim().length : 0} caracteres.\n\n` +
        `Exemplo de justificativa válida:\n` +
        `"Backup emergencial solicitado pelo cliente para recuperação de dados críticos após falha de hardware"`
      );
    }

    // 6. Verificar comprimento máximo da justificativa (proteção contra DoS)
    const trimmedReason = reason.trim();
    if (trimmedReason.length > SafetyGuard.MAX_REASON_LENGTH) {
      // Log de auditoria para tentativa com payload excessivo
      console.warn(
        `[SafetyGuard] ⚠️  Tentativa de operação ${operation} com reason MUITO LONGO ` +
        `(target: ${targetType} ${targetId}, length: ${trimmedReason.length})`
      );

      try {
        await logOperation('safety-guard-rejected-reason-too-long', {
          jobId: targetId,
          jobName: targetType,
          result: 'rejected',
          metadata: {
            operation: operation,
            operationDescription: operationDescription,
            rejectionReason: 'Justificativa excede tamanho máximo permitido',
            reasonLength: trimmedReason.length,
            maxAllowed: SafetyGuard.MAX_REASON_LENGTH,
            timestamp: new Date().toISOString()
          }
        });
      } catch (error) {
        console.error('[SafetyGuard] Erro ao registrar log de auditoria (reason-too-long):', error);
      }

      throw new Error(
        `SAFETY GUARD: Justificativa muito longa.\n\n` +
        `A justificativa (reason) deve ter no máximo ${SafetyGuard.MAX_REASON_LENGTH} caracteres.\n` +
        `Atual: ${trimmedReason.length} caracteres.\n\n` +
        `Reduza o tamanho da justificativa para um resumo objetivo da operação.`
      );
    }

    // 7. Log de auditoria da operação autorizada
    console.log(
      `[SafetyGuard] ✅ Operação AUTORIZADA: ${operation} ` +
      `(${targetType} ${targetId}) - Reason: ${trimmedReason.substring(0, 50)}...`
    );

    try {
      await logOperation('safety-guard-authorized', {
        jobId: targetId,
        jobName: targetType,
        result: 'authorized',
        metadata: {
          operation: operation,
          operationDescription: operationDescription,
          reason: trimmedReason.substring(0, 100), // Primeiros 100 chars
          reasonLength: trimmedReason.length,
          guardEnabled: this.guardEnabled,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('[SafetyGuard] Erro ao registrar log de auditoria:', error);
      // Não falhar a operação por erro de log
    }

    // 8. Operação autorizada
    return true;
  }

  /**
   * Retorna informações sobre configuração do Safety Guard
   * Útil para troubleshooting
   *
   * @returns {Object} Status atual do Safety Guard
   */
  getStatus() {
    return {
      enabled: this.guardEnabled,
      tokenConfigured: !!this.safetyToken,
      tokenLength: this.safetyToken.length,
      protectedOperations: Object.keys(SafetyGuard.PROTECTED_OPERATIONS),
      minTokenLength: SafetyGuard.MIN_TOKEN_LENGTH,
      minReasonLength: SafetyGuard.MIN_REASON_LENGTH,
      maxReasonLength: SafetyGuard.MAX_REASON_LENGTH
    };
  }
}

/**
 * Singleton instance do SafetyGuard
 * Usar esta instância em todas as tools
 *
 * @constant {SafetyGuard}
 */
export const safetyGuard = new SafetyGuard();

/**
 * Export class para testes
 */
export { SafetyGuard };
