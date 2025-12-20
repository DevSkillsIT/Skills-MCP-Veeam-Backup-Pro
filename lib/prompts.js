// prompts.js - Prompts profissionais para Veeam Backup MCP Server
// Skills IT Soluções em Tecnologia
// 15 prompts: 7 para gestor, 8 para analista técnico

/**
 * Lista completa de prompts disponíveis no Veeam MCP
 * Formato: compacto + detalhado (WhatsApp/Teams friendly)
 */

export const VEEAM_PROMPTS = [
  // ============================================
  // PROMPTS PARA GESTOR (7)
  // ============================================
  {
    name: 'veeam_backup_health_summary',
    description: 'Resumo executivo de saúde dos backups com taxa de sucesso e alertas críticos',
    arguments: [
      {
        name: 'period_days',
        description: 'Período em dias para análise (padrão: 7)',
        required: false
      }
    ]
  },
  {
    name: 'veeam_storage_growth_forecast',
    description: 'Previsão de crescimento de storage com projeção de capacidade',
    arguments: [
      {
        name: 'forecast_months',
        description: 'Meses para projeção (padrão: 3)',
        required: false
      }
    ]
  },
  {
    name: 'veeam_backup_cost_analysis',
    description: 'Análise de custo de backup por cliente com otimizações recomendadas',
    arguments: [
      {
        name: 'client_name',
        description: 'Nome do cliente para análise específica (opcional)',
        required: false
      }
    ]
  },
  {
    name: 'veeam_recovery_sla_compliance',
    description: 'Compliance de RTO/RPO e aderência aos SLAs de recuperação',
    arguments: [
      {
        name: 'period_days',
        description: 'Período em dias (padrão: 30)',
        required: false
      }
    ]
  },
  {
    name: 'veeam_backup_success_rate',
    description: 'Taxa de sucesso de backups por job com tendências e alertas',
    arguments: [
      {
        name: 'period_days',
        description: 'Período em dias (padrão: 7)',
        required: false
      }
    ]
  },
  {
    name: 'veeam_repository_capacity',
    description: 'Capacidade de repositórios com alertas de espaço e previsão de esgotamento',
    arguments: [
      {
        name: 'threshold_percent',
        description: 'Percentual de alerta (padrão: 80)',
        required: false
      }
    ]
  },
  {
    name: 'veeam_vm_protection_coverage',
    description: 'Cobertura de proteção de VMs com identificação de VMs não protegidas',
    arguments: [
      {
        name: 'client_name',
        description: 'Nome do cliente (opcional)',
        required: false
      }
    ]
  },

  // ============================================
  // PROMPTS PARA ANALISTA (8)
  // ============================================
  {
    name: 'veeam_job_status',
    description: 'Status rápido de jobs de backup com última execução e próxima janela',
    arguments: [
      {
        name: 'job_name',
        description: 'Nome do job (opcional para listar todos)',
        required: false
      }
    ]
  },
  {
    name: 'veeam_failed_job_investigation',
    description: 'Investigação detalhada de job falhado com logs e troubleshooting',
    arguments: [
      {
        name: 'job_id',
        description: 'ID do job falhado',
        required: true
      }
    ]
  },
  {
    name: 'veeam_restore_point_lookup',
    description: 'Busca de restore points disponíveis para VM específica',
    arguments: [
      {
        name: 'vm_name',
        description: 'Nome da VM',
        required: true
      }
    ]
  },
  {
    name: 'veeam_restore_guide',
    description: 'Guia passo-a-passo para restauração de VM/arquivo',
    arguments: [
      {
        name: 'vm_name',
        description: 'Nome da VM',
        required: true
      },
      {
        name: 'restore_type',
        description: 'Tipo: full, file, instant (padrão: full)',
        required: false
      }
    ]
  },
  {
    name: 'veeam_backup_validation',
    description: 'Validação de integridade de backup com teste de restore',
    arguments: [
      {
        name: 'vm_name',
        description: 'Nome da VM para validar',
        required: true
      }
    ]
  },
  {
    name: 'veeam_vm_backup_history',
    description: 'Histórico completo de backups de VM com estatísticas de performance',
    arguments: [
      {
        name: 'vm_name',
        description: 'Nome da VM',
        required: true
      },
      {
        name: 'period_days',
        description: 'Período em dias (padrão: 30)',
        required: false
      }
    ]
  },
  {
    name: 'veeam_repository_space_alert',
    description: 'Alerta de espaço em repositório com análise de crescimento',
    arguments: [
      {
        name: 'repository_name',
        description: 'Nome do repositório',
        required: true
      }
    ]
  },
  {
    name: 'veeam_tape_job_status',
    description: 'Status de jobs de fita com última gravação e mídia utilizada',
    arguments: [
      {
        name: 'tape_job_name',
        description: 'Nome do job de fita (opcional)',
        required: false
      }
    ]
  }
];

/**
 * Obtém o texto do prompt baseado no nome e argumentos
 * Implementa lógica multi-step com passos compactos para WhatsApp/Teams
 */
export async function getPromptText(name, args, veeamClient) {
  const period_days = args?.period_days || 7;
  const forecast_months = args?.forecast_months || 3;
  const threshold_percent = args?.threshold_percent || 80;
  const client_name = args?.client_name || 'todos os clientes';
  const job_name = args?.job_name;
  const job_id = args?.job_id;
  const vm_name = args?.vm_name;
  const restore_type = args?.restore_type || 'full';
  const repository_name = args?.repository_name;
  const tape_job_name = args?.tape_job_name;

  switch (name) {
    // ============================================
    // PROMPTS GESTOR
    // ============================================

    case 'veeam_backup_health_summary':
      return {
        description: `Resumo de saúde de backups (${period_days} dias)`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `📊 **RESUMO EXECUTIVO - SAÚDE DOS BACKUPS (${period_days} dias)**

**Analise os dados de backup dos últimos ${period_days} dias e forneça:**

✅ **Taxa de Sucesso Global:**
- % de jobs bem-sucedidos
- % de jobs com warnings
- % de jobs falhados

🚨 **Alertas Críticos:**
- Jobs falhados consecutivamente
- VMs sem backup recente
- Repositórios com espaço crítico

📈 **Tendências:**
- Comparação com período anterior
- Jobs com degradação de performance

🎯 **Ações Recomendadas:**
- TOP 3 prioridades para resolver
- Jobs que precisam atenção imediata

**Formato:** Compacto para WhatsApp (max 500 caracteres)`
            }
          }
        ]
      };

    case 'veeam_storage_growth_forecast':
      return {
        description: `Previsão de crescimento de storage (${forecast_months} meses)`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `📊 **PREVISÃO DE CRESCIMENTO - STORAGE (${forecast_months} meses)**

**Análise de Capacidade:**

📈 **Crescimento Atual:**
- Taxa de crescimento mensal (GB/mês)
- Tendência de crescimento
- Repositórios mais impactados

⚠️ **Alertas de Capacidade:**
- Repositórios que esgotarão nos próximos ${forecast_months} meses
- Previsão de data de esgotamento
- Capacidade adicional necessária (GB)

💰 **Custo Estimado:**
- Projeção de custo de storage adicional
- ROI de compressão/deduplicação

🎯 **Recomendações:**
- Otimizações imediatas (compressão, retenção)
- Planejamento de compra de storage

**Formato:** Dashboard executivo compacto`
            }
          }
        ]
      };

    case 'veeam_backup_cost_analysis':
      return {
        description: `Análise de custo de backup - ${client_name}`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `💰 **ANÁLISE DE CUSTO DE BACKUP - ${client_name.toUpperCase()}**

**Breakdown de Custos:**

📊 **Uso de Recursos:**
- Storage consumido (GB)
- Custo por GB
- VMs protegidas vs. não protegidas

⚙️ **Eficiência:**
- Taxa de compressão/deduplicação
- Economia com otimização
- Custo por VM protegida

📈 **Comparativo:**
- Custo vs. outros clientes (se aplicável)
- Projeção mensal/anual

🎯 **Otimizações Recomendadas:**
- Ajustes de retenção para reduzir custo
- VMs candidatas para desativação de backup
- ROI de mudanças de política

**Formato:** Relatório executivo financeiro`
            }
          }
        ]
      };

    case 'veeam_recovery_sla_compliance':
      return {
        description: `Compliance RTO/RPO (${period_days} dias)`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `⏱️ **COMPLIANCE RTO/RPO - SLA DE RECUPERAÇÃO (${period_days} dias)**

**Análise de Aderência:**

✅ **RTO (Recovery Time Objective):**
- Tempo médio de restore
- Variação por tipo de VM (crítica/normal)
- Jobs que excedem RTO definido

✅ **RPO (Recovery Point Objective):**
- Frequência de backup atual
- Gaps de backup detectados
- VMs fora do RPO acordado

🚨 **Violações de SLA:**
- Número de violações no período
- VMs/Jobs com maior risco
- Impacto em disponibilidade

📊 **Performance de Restore:**
- Tempo médio de recuperação
- Taxa de sucesso de restore
- Testes de restore executados

🎯 **Ações Corretivas:**
- Ajustes de janela de backup
- VMs que precisam reconfiguração

**Formato:** Dashboard de compliance`
            }
          }
        ]
      };

    case 'veeam_backup_success_rate':
      return {
        description: `Taxa de sucesso de backups (${period_days} dias)`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `📊 **TAXA DE SUCESSO DE BACKUPS (${period_days} dias)**

**Estatísticas de Sucesso:**

✅ **Global:**
- % Sucesso / Warning / Falha
- Total de jobs executados
- Comparação com período anterior

📈 **Por Job:**
- Top 5 jobs mais confiáveis
- Top 5 jobs com problemas
- Jobs com tendência de degradação

⚠️ **Alertas:**
- Jobs com múltiplas falhas consecutivas
- Jobs com aumento de tempo de execução
- Jobs que não executaram no período

🎯 **Tendências:**
- Melhora ou piora geral
- Padrões de falha (dia da semana, horário)

🔧 **Ações Necessárias:**
- Jobs que precisam investigação urgente
- Otimizações recomendadas

**Formato:** Scorecard executivo`
            }
          }
        ]
      };

    case 'veeam_repository_capacity':
      return {
        description: `Capacidade de repositórios (alerta: ${threshold_percent}%)`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `💾 **CAPACIDADE DE REPOSITÓRIOS (Threshold: ${threshold_percent}%)**

**Status de Repositórios:**

📊 **Uso Atual:**
- Repositórios acima de ${threshold_percent}% (CRÍTICO)
- Espaço livre por repositório (GB)
- Taxa de crescimento (GB/dia)

⚠️ **Alertas de Espaço:**
- Repositórios em risco (próximos de esgotar)
- Previsão de esgotamento (dias)
- Ações imediatas necessárias

📈 **Tendências:**
- Crescimento semanal/mensal
- Repositórios com crescimento acelerado
- Eficiência de compressão/dedup

🎯 **Recomendações:**
- Limpeza de restore points antigos
- Redistribuição de jobs entre repositórios
- Planejamento de expansão de storage

💰 **Custo de Expansão:**
- Storage adicional necessário (TB)
- Estimativa de investimento

**Formato:** Dashboard de capacidade`
            }
          }
        ]
      };

    case 'veeam_vm_protection_coverage':
      return {
        description: `Cobertura de proteção de VMs - ${client_name}`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `🛡️ **COBERTURA DE PROTEÇÃO DE VMs - ${client_name.toUpperCase()}**

**Análise de Proteção:**

✅ **VMs Protegidas:**
- Total de VMs com backup ativo
- % de cobertura geral
- Frequência de backup

⚠️ **VMs Não Protegidas:**
- Lista de VMs sem backup configurado
- Criticidade das VMs (prod/dev/teste)
- Risco de perda de dados

📊 **Cobertura por Ambiente:**
- Produção: X VMs protegidas / Y total
- Desenvolvimento: X VMs protegidas / Y total
- Teste: X VMs protegidas / Y total

🚨 **Gaps de Proteção:**
- VMs críticas sem backup
- VMs com backup desatualizado (>7 dias)
- Jobs desabilitados

🎯 **Plano de Ação:**
- VMs prioritárias para inclusão
- Jobs que precisam ser habilitados
- Ajustes de política de backup

**Formato:** Relatório de compliance de proteção`
            }
          }
        ]
      };

    // ============================================
    // PROMPTS ANALISTA
    // ============================================

    case 'veeam_job_status':
      return {
        description: job_name ? `Status do job: ${job_name}` : 'Status de todos os jobs',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `🔍 **STATUS DE JOBS DE BACKUP${job_name ? `: ${job_name}` : ' (TODOS)'}}**

**Informações Necessárias:**

⏱️ **Última Execução:**
- Data/hora do último backup
- Resultado (Success/Warning/Failed)
- Duração do job

📅 **Próxima Execução:**
- Data/hora agendada
- Janela de backup configurada

📊 **Estatísticas:**
- VMs processadas
- Tamanho transferido (GB)
- Taxa de compressão

⚠️ **Alertas:**
- Warnings recentes
- Erros conhecidos

🎯 **Status Atual:**
- Job habilitado/desabilitado
- Última modificação

**Formato:** Status rápido para WhatsApp (max 300 chars)`
            }
          }
        ]
      };

    case 'veeam_failed_job_investigation':
      return {
        description: `Investigação de falha - Job ID: ${job_id}`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `🔧 **INVESTIGAÇÃO DE JOB FALHADO**
**Job ID:** ${job_id}

**Análise Detalhada:**

🚨 **Erro Identificado:**
- Mensagem de erro completa
- Código de erro Veeam
- Timestamp da falha

🔍 **Diagnóstico:**
- Causa raiz provável
- VMs afetadas
- Recursos envolvidos (proxy, repository)

📋 **Logs Relevantes:**
- Últimas 10 linhas do log
- Erros anteriores relacionados

🎯 **Troubleshooting:**
1. Passos para resolver (ordenados por prioridade)
2. Comandos/verificações necessárias
3. Documentação relevante

✅ **Resolução:**
- Ações recomendadas
- Testes de validação
- Prevenção de recorrência

**Formato:** Guia de troubleshooting passo-a-passo`
            }
          }
        ]
      };

    case 'veeam_restore_point_lookup':
      return {
        description: `Restore points disponíveis - VM: ${vm_name}`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `📅 **RESTORE POINTS DISPONÍVEIS**
**VM:** ${vm_name}

**Informações Necessárias:**

📊 **Restore Points:**
- Lista ordenada por data (mais recente primeiro)
- Data/hora de cada restore point
- Tipo (Full/Incremental/Differential)
- Tamanho do backup

⏱️ **Cobertura:**
- Restore point mais antigo disponível
- Restore point mais recente
- Gaps de backup (se houver)

💾 **Localização:**
- Repositório onde está armazenado
- Estado do restore point (válido/corrompido)

🎯 **Recomendações:**
- Melhor restore point para recuperação
- Restore points candidatos para remoção (se aplicável)

**Formato:** Lista compacta e ordenada`
            }
          }
        ]
      };

    case 'veeam_restore_guide':
      return {
        description: `Guia de restore ${restore_type} - VM: ${vm_name}`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `🔄 **GUIA DE RESTORE - ${restore_type.toUpperCase()}**
**VM:** ${vm_name}

**Procedimento Passo-a-Passo:**

📋 **PRÉ-RESTORE:**
1. Verificar restore point disponível mais recente
2. Validar espaço no datastore de destino
3. Confirmar credenciais de acesso

🔧 **EXECUÇÃO - ${restore_type.toUpperCase()}:**
${restore_type === 'full' ? `
1. Abrir Veeam Backup & Replication Console
2. Navegar até Home > Backups
3. Localizar backup da VM ${vm_name}
4. Botão direito > Restore Entire VM
5. Selecionar restore point (listar opções)
6. Escolher destino e configurações de rede
7. Iniciar restore
` : restore_type === 'file' ? `
1. Abrir Veeam Backup & Replication Console
2. Navegar até Home > Backups
3. Localizar backup da VM ${vm_name}
4. Botão direito > Restore guest files
5. Montar restore point como disco
6. Navegar até arquivo/pasta desejado
7. Copiar para destino
` : `
1. Abrir Veeam Backup & Replication Console
2. Navegar até Home > Backups
3. Localizar backup da VM ${vm_name}
4. Botão direito > Instant VM Recovery
5. Selecionar restore point
6. Configurar rede (isolada ou produção)
7. Iniciar VM instantânea
`}

⏱️ **TEMPO ESTIMADO:**
- Restore completo: ${restore_type === 'instant' ? '5-10 min' : restore_type === 'file' ? '2-5 min' : '30-60 min'}

✅ **PÓS-RESTORE:**
1. Validar integridade da VM/arquivo
2. Testar funcionalidade
3. Documentar restore executado

**Formato:** Checklist executável`
            }
          }
        ]
      };

    case 'veeam_backup_validation':
      return {
        description: `Validação de backup - VM: ${vm_name}`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `✅ **VALIDAÇÃO DE INTEGRIDADE DE BACKUP**
**VM:** ${vm_name}

**Testes de Validação:**

🔍 **1. Verificação de Restore Point:**
- Restore point mais recente disponível
- Integridade do arquivo de backup
- Checksum validado

🧪 **2. Teste de Restore (Simulado):**
- SureBackup: VM bootável? (Sim/Não)
- Tempo de boot: X segundos
- Serviços críticos iniciados: Sim/Não

📊 **3. Consistência de Dados:**
- Backup application-aware: Sim/Não
- Truncamento de logs (SQL/Exchange): OK/FALHA
- VSS snapshot: Sucesso/Falha

⚠️ **4. Problemas Identificados:**
- Warnings no último backup
- Erros de snapshot
- Timeouts

🎯 **Resultado da Validação:**
- ✅ APROVADO / ⚠️ APROVADO COM RESSALVAS / ❌ REPROVADO
- Ações corretivas (se necessário)

**Formato:** Relatório de validação técnico`
            }
          }
        ]
      };

    case 'veeam_vm_backup_history':
      return {
        description: `Histórico de backup - VM: ${vm_name} (${period_days} dias)`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `📜 **HISTÓRICO DE BACKUPS - ${period_days} DIAS**
**VM:** ${vm_name}

**Análise de Performance:**

📊 **Estatísticas Gerais:**
- Total de backups executados: X
- Taxa de sucesso: Y%
- Backups com warning: Z

⏱️ **Performance:**
- Tempo médio de backup: X min
- Tendência de tempo (aumentando/estável/diminuindo)
- Tamanho médio transferido: Y GB

📈 **Tendências:**
- Gráfico de tempo de execução (últimos ${period_days} dias)
- Variação de tamanho de backup
- Padrões de falha

🚨 **Problemas Recorrentes:**
- Erros frequentes (se houver)
- VMs com problemas de snapshot
- Timeouts

💾 **Uso de Storage:**
- Espaço total consumido
- Taxa de crescimento
- Eficiência de deduplicação

🎯 **Recomendações:**
- Otimizações sugeridas
- Ajustes de janela de backup (se necessário)

**Formato:** Relatório de histórico com gráficos textuais`
            }
          }
        ]
      };

    case 'veeam_repository_space_alert':
      return {
        description: `Alerta de espaço - Repository: ${repository_name}`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `⚠️ **ALERTA DE ESPAÇO - REPOSITORY**
**Nome:** ${repository_name}

**Status Crítico:**

💾 **Uso Atual:**
- Espaço total: X TB
- Espaço usado: Y TB (Z%)
- Espaço livre: W TB

📈 **Análise de Crescimento:**
- Crescimento diário: X GB/dia
- Crescimento semanal: Y GB/semana
- Taxa de crescimento: +X% vs. semana anterior

⏱️ **Previsão de Esgotamento:**
- Dias até esgotar: X dias
- Data estimada de esgotamento: DD/MM/YYYY
- Nível de urgência: CRÍTICO/ALTO/MÉDIO

🎯 **Ações Imediatas:**
1. Remover restore points antigos (>X dias)
2. Jobs candidatos para limpeza
3. Estimativa de espaço a liberar: Y GB

💰 **Planejamento:**
- Storage adicional necessário: X TB
- Custo estimado de expansão
- Alternativas (migração para outro repo)

**Formato:** Alerta executivo com ações`
            }
          }
        ]
      };

    case 'veeam_tape_job_status':
      return {
        description: tape_job_name ? `Status job de fita: ${tape_job_name}` : 'Status jobs de fita',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `📼 **STATUS DE JOBS DE FITA${tape_job_name ? `: ${tape_job_name}` : ' (TODOS)'}}**

**Informações de Tape:**

⏱️ **Última Gravação:**
- Data/hora da última gravação em fita
- Resultado (Success/Warning/Failed)
- Duração do job

📼 **Mídia Utilizada:**
- Fita atual em uso
- Espaço usado na fita
- Fitas disponíveis no pool

📊 **Estatísticas:**
- Total de dados gravados (GB)
- Taxa de compressão
- Performance de gravação (MB/s)

🔄 **Rotação de Fitas:**
- Próxima fita a ser utilizada
- Fitas que precisam ser exportadas (offsite)
- Fitas expiradas

⚠️ **Alertas:**
- Fitas com erros de leitura/gravação
- Pool de fitas vazio
- Jobs de fita aguardando mídia

🎯 **Ações Necessárias:**
- Inserir novas fitas (se necessário)
- Exportar fitas para offsite
- Verificar integridade de fitas

**Formato:** Status compacto de tape library`
            }
          }
        ]
      };

    default:
      throw new Error(`Prompt desconhecido: ${name}`);
  }
}

/**
 * Handler para listar prompts (MCP protocol)
 */
export async function handleListPrompts() {
  return {
    prompts: VEEAM_PROMPTS
  };
}

/**
 * Handler para obter prompt específico (MCP protocol)
 */
export async function handleGetPrompt(name, args, veeamClient) {
  const prompt = VEEAM_PROMPTS.find(p => p.name === name);

  if (!prompt) {
    throw new Error(`Prompt não encontrado: ${name}`);
  }

  return await getPromptText(name, args, veeamClient);
}
