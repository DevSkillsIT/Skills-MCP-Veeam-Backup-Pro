// lib/veeam-dictionaries.js
// Dicionários completos de códigos Veeam para enriquecimento de respostas
// Baseado na API REST do Veeam Backup & Replication 12.2

/**
 * Estados de Jobs (Job.State)
 * Referência: VBR REST API Documentation
 */
export const JOB_STATES = {
  0: { code: "Stopped", description: "Job parado, aguardando schedule" },
  1: { code: "Starting", description: "Job iniciando execução" },
  2: { code: "Stopping", description: "Job sendo interrompido pelo usuário" },
  3: { code: "Working", description: "Job em execução ativa" },
  4: { code: "Pausing", description: "Job sendo pausado" },
  5: { code: "Resuming", description: "Job sendo retomado após pausa" },
  6: { code: "WaitingTape", description: "Aguardando tape drive disponível" },
  7: { code: "Idle", description: "Job ocioso" },
  8: { code: "Postprocessing", description: "Executando pós-processamento" },
  9: { code: "WaitingRepository", description: "Aguardando repositório disponível" }
};

/**
 * Resultados de Sessions (Session.Result)
 * Referência: VBR REST API Documentation
 */
export const SESSION_RESULTS = {
  0: { code: "None", description: "Sem resultado (ainda em execução)", icon: "⚪", severity: "info" },
  1: { code: "Success", description: "Sucesso completo sem avisos", icon: "✅", severity: "success" },
  2: { code: "Warning", description: "Sucesso com avisos (verificar logs)", icon: "⚠️", severity: "warning" },
  3: { code: "Failed", description: "Falha total na execução", icon: "❌", severity: "error" }
};

/**
 * Estados de Sessions (Session.State)
 * Referência: VBR REST API Documentation
 */
export const SESSION_STATES = {
  0: { code: "Stopped", description: "Session parada" },
  1: { code: "Starting", description: "Session iniciando" },
  2: { code: "Stopping", description: "Session sendo interrompida" },
  3: { code: "Working", description: "Session em execução" },
  4: { code: "Pausing", description: "Session sendo pausada" },
  5: { code: "Resuming", description: "Session sendo retomada" },
  6: { code: "WaitingTape", description: "Aguardando tape" },
  7: { code: "Idle", description: "Session ociosa" },
  8: { code: "Postprocessing", description: "Pós-processamento" },
  9: { code: "WaitingRepository", description: "Aguardando repositório" }
};

/**
 * Tipos de Jobs (Job.Type)
 * Referência: VBR REST API Documentation + Skills IT field experience
 */
export const JOB_TYPES = {
  "Backup": {
    description: "Job de backup padrão de VMs",
    category: "backup",
    icon: "💾"
  },
  "Replica": {
    description: "Job de replicação de VM (disaster recovery)",
    category: "dr",
    icon: "🔄"
  },
  "BackupCopy": {
    description: "Job de cópia off-site (regra 3-2-1)",
    category: "backup",
    icon: "📦"
  },
  "EpAgentBackup": {
    description: "Backup de agente endpoint (file-level)",
    category: "backup",
    icon: "💻"
  },
  "EpAgentPolicy": {
    description: "Policy de backup de endpoint",
    category: "backup",
    icon: "📋"
  },
  "ConfigurationBackup": {
    description: "Backup de configuração do VBR",
    category: "maintenance",
    icon: "⚙️"
  },
  "VeeamZip": {
    description: "Backup full sob demanda (VeeamZIP)",
    category: "backup",
    icon: "📁"
  },
  "SureBackup": {
    description: "Teste automatizado de recuperação",
    category: "testing",
    icon: "🧪"
  },
  "EntraIDTenantBackup": {
    description: "Backup de tenant Microsoft Entra ID",
    category: "cloud",
    icon: "☁️"
  }
};

/**
 * Tipos de Sessions (Session.SessionType)
 *
 * CATEGORIAS:
 * - backup_job: Trabalhos de backup/replicação de dados (backups reais)
 * - system_task: Tarefas de manutenção/segurança do sistema (não são backups)
 * - testing: Testes e validações
 * - restore: Operações de restore
 *
 * SINÔNIMOS:
 * - backup_job = backup real, job de backup, trabalho de backup
 * - system_task = tarefa de sistema, manutenção, task administrativa
 *
 * Referência: VBR REST API Documentation + Skills IT MSP experience
 */
export const SESSION_TYPES = {
  // ═══════════════════════════════════════════════════════════════
  // BACKUP JOBS (Backups Reais)
  // ═══════════════════════════════════════════════════════════════
  "BackupJob": {
    description: "Job de backup padrão de VMs",
    longDescription: "Backup completo ou incremental de máquinas virtuais",
    category: "backup_job",
    isBackupJob: true,
    isSystemTask: false,
    icon: "💾",
    synonyms: ["backup", "backup job", "job de backup", "VM backup"]
  },
  "ReplicaJob": {
    description: "Job de replicação de VM (disaster recovery)",
    longDescription: "Replicação de VMs para site secundário (DR)",
    category: "backup_job",
    isBackupJob: true,
    isSystemTask: false,
    icon: "🔄",
    synonyms: ["replication", "replica", "DR job", "disaster recovery"]
  },
  "BackupCopyJob": {
    description: "Job de cópia off-site (regra 3-2-1)",
    longDescription: "Cópia de backups para repositório secundário",
    category: "backup_job",
    isBackupJob: true,
    isSystemTask: false,
    icon: "📦",
    synonyms: ["backup copy", "off-site copy", "secondary backup"]
  },
  "EpAgentBackup": {
    description: "Backup de agente endpoint (file-level)",
    longDescription: "Backup em nível de arquivo via agente endpoint",
    category: "backup_job",
    isBackupJob: true,
    isSystemTask: false,
    icon: "💻",
    synonyms: ["endpoint backup", "agent backup", "file backup"]
  },

  // ═══════════════════════════════════════════════════════════════
  // SYSTEM TASKS (Tarefas de Sistema - NÃO são backups)
  // ═══════════════════════════════════════════════════════════════
  "MalwareDetection": {
    description: "Detecção de malware em backups",
    longDescription: "Scan de segurança para detectar malware em restore points",
    category: "system_task",
    isBackupJob: false,
    isSystemTask: true,
    icon: "🛡️",
    synonyms: ["malware scan", "security scan", "antivirus", "AV scan"]
  },
  "ConfigurationBackup": {
    description: "Backup de configuração do VBR",
    longDescription: "Backup das configurações do Veeam Backup & Replication",
    category: "system_task",
    isBackupJob: false,
    isSystemTask: true,
    icon: "⚙️",
    synonyms: ["config backup", "VBR config", "system configuration"]
  },
  "HealthCheck": {
    description: "Verificação de saúde do ambiente",
    longDescription: "Health check automático do ambiente Veeam",
    category: "system_task",
    isBackupJob: false,
    isSystemTask: true,
    icon: "🏥",
    synonyms: ["health check", "system check", "environment check"]
  },
  "DataIntegrityCheck": {
    description: "Verificação de integridade de dados",
    longDescription: "Validação de integridade de backups armazenados",
    category: "system_task",
    isBackupJob: false,
    isSystemTask: true,
    icon: "🔍",
    synonyms: ["integrity check", "data verification", "backup validation"]
  },

  // ═══════════════════════════════════════════════════════════════
  // TESTING (Testes e Validação)
  // ═══════════════════════════════════════════════════════════════
  "SureBackup": {
    description: "Teste automatizado de recuperação",
    longDescription: "Verificação automática de recuperabilidade de backups",
    category: "testing",
    isBackupJob: false,
    isSystemTask: true,
    icon: "🧪",
    synonyms: ["backup testing", "recovery test", "restore verification"]
  },
  "VirtualLab": {
    description: "Laboratório virtual isolado",
    longDescription: "Ambiente virtual isolado para testes de restore",
    category: "testing",
    isBackupJob: false,
    isSystemTask: true,
    icon: "🔬",
    synonyms: ["virtual lab", "isolated environment", "test lab"]
  },

  // ═══════════════════════════════════════════════════════════════
  // RESTORE (Operações de Restore)
  // ═══════════════════════════════════════════════════════════════
  "Restore": {
    description: "Operação de restore de dados",
    longDescription: "Restauração de dados a partir de backup",
    category: "restore",
    isBackupJob: false,
    isSystemTask: true,
    icon: "↩️",
    synonyms: ["restore", "recovery", "data recovery", "file restore"]
  },
  "InstantRecovery": {
    description: "Instant Recovery de VM",
    longDescription: "Recuperação instantânea de VM diretamente do backup",
    category: "restore",
    isBackupJob: false,
    isSystemTask: true,
    icon: "⚡",
    synonyms: ["instant VM recovery", "quick restore", "instant restore"]
  }
};

/**
 * Arrays auxiliares para filtros rápidos
 */
export const BACKUP_JOB_SESSION_TYPES = [
  'BackupJob',
  'ReplicaJob',
  'BackupCopyJob',
  'EpAgentBackup'
];

export const SYSTEM_TASK_SESSION_TYPES = [
  'MalwareDetection',
  'ConfigurationBackup',
  'HealthCheck',
  'DataIntegrityCheck',
  'SureBackup',
  'VirtualLab',
  'Restore',
  'InstantRecovery'
];

/**
 * Tipos de Schedule (Job.ScheduleType)
 */
export const SCHEDULE_TYPES = {
  "None": { description: "Sem agendamento (manual only)" },
  "Daily": { description: "Agendamento diário" },
  "Monthly": { description: "Agendamento mensal" },
  "Periodically": { description: "Agendamento periódico (cada X horas)" },
  "Continuously": { description: "Modo contínuo (CDP-like)" },
  "AfterJob": { description: "Executar após outro job" },
  "AfterNewSnapshot": { description: "Executar após novo snapshot" }
};

/**
 * Tipos de Repositórios (Repository.Type)
 */
export const REPOSITORY_TYPES = {
  "Windows": { description: "Repositório Windows (NTFS)", icon: "🪟" },
  "Linux": { description: "Repositório Linux (XFS/ext4)", icon: "🐧" },
  "ExaGrid": { description: "ExaGrid appliance", icon: "📦" },
  "HPStoreOnce": { description: "HP StoreOnce", icon: "🏢" },
  "DataDomain": { description: "Dell EMC Data Domain", icon: "🏢" },
  "AzureBlob": { description: "Azure Blob Storage", icon: "☁️" },
  "AmazonS3": { description: "Amazon S3", icon: "☁️" },
  "S3Compatible": { description: "S3-compatible storage", icon: "☁️" }
};

/**
 * Platform Names (VM platforms)
 */
export const PLATFORM_NAMES = {
  "VMware": { description: "VMware vSphere", icon: "🖥️" },
  "HyperV": { description: "Microsoft Hyper-V", icon: "🪟" },
  "NutanixAHV": { description: "Nutanix AHV", icon: "🔷" },
  "AWS": { description: "Amazon Web Services", icon: "☁️" },
  "Azure": { description: "Microsoft Azure", icon: "☁️" },
  "GCP": { description: "Google Cloud Platform", icon: "☁️" },
  "Physical": { description: "Servidor físico", icon: "🖥️" }
};

/**
 * Códigos de Retry (Job.RetryCount)
 */
export const RETRY_CONFIGS = {
  0: "Sem retry",
  1: "1 tentativa",
  2: "2 tentativas",
  3: "3 tentativas (recomendado)",
  5: "5 tentativas"
};

/**
 * Níveis de Log (Session.LogLevel)
 */
export const LOG_LEVELS = {
  "Info": { severity: 0, description: "Informações gerais" },
  "Warning": { severity: 1, description: "Avisos (não impedem sucesso)" },
  "Error": { severity: 2, description: "Erros (causam falha)" },
  "Debug": { severity: -1, description: "Informações de debug" }
};

/**
 * Status de Health Check
 */
export const HEALTH_STATUSES = {
  "Healthy": { icon: "✅", description: "Componente saudável" },
  "Warning": { icon: "⚠️", description: "Componente com avisos" },
  "Error": { icon: "❌", description: "Componente com erro" },
  "Unknown": { icon: "❓", description: "Status desconhecido" }
};
