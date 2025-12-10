# Scripts de Inicialização - Veeam MCP

Scripts utilitários para iniciar o servidor Veeam MCP.

---

## 📜 Scripts Disponíveis

### 🔵 `start.sh` - **Produção/Desenvolvimento Formal**

Script robusto com validações completas e múltiplos modos de operação.

**Funcionalidades:**
- ✅ Valida Node.js v20+ instalado
- ✅ Verifica existência do `.env`
- ✅ Detecta porta automaticamente
- ✅ Verifica porta em uso
- ✅ Instala dependências se necessário
- ✅ Suporta 3 modos: `--mcp`, `--http`, híbrido (padrão)

**Uso:**
```bash
# Modo híbrido (MCP + HTTP) - Recomendado
./start.sh

# Modo MCP stdio apenas (Claude Desktop)
./start.sh --mcp

# Modo HTTP REST em porta customizada
./start.sh --http --port 9000

# Ajuda
./start.sh --help
```

**Casos de Uso:**
- Deploy em produção
- Integração com PM2
- Containers Docker
- Desenvolvimento com validações

---

### 🟢 `start-server.sh` - **Desenvolvimento Rápido**

Script simples para testes manuais e debug rápido.

**Funcionalidades:**
- ✅ Mata processos antigos (porta 8825)
- ✅ Inicia servidor em background
- ✅ Logs salvos em `/tmp/veeam-mcp.log`
- ✅ Testa health check automaticamente
- ⚠️ Porta hardcoded: 8825
- ⚠️ Sem validações

**Uso:**
```bash
# Iniciar servidor
./start-server.sh

# Ver logs em tempo real
tail -f /tmp/veeam-mcp.log

# Parar servidor
lsof -ti:8825 | xargs kill
```

**Casos de Uso:**
- Testes manuais rápidos
- Debug de problemas
- Verificação de logs

---

## 🎯 Qual Script Usar?

| Cenário | Script |
|---------|--------|
| Produção via PM2 | `start.sh` |
| Deploy Docker | `start.sh` |
| Desenvolvimento formal | `start.sh` |
| Teste rápido manual | `start-server.sh` |
| Debug com logs | `start-server.sh` |
| Trocar porta | `start.sh --http --port XXXX` |

---

**Skills IT** - Dezembro 2025
