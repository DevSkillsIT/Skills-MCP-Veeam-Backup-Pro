# Troubleshooting Guide - Backup Sessions Issue

## 🚨 **Problem: "No Sessions" in Claude Desktop**

If you're getting "no sessions" when using the `/backup-sessions` tool in Claude Desktop, this guide will help you diagnose and fix the issue.

## 🔍 **Root Causes**

The "no sessions" issue typically occurs due to one of these reasons:

1. **Authentication Failure** - Invalid or missing credentials
2. **Network Connectivity** - VBR server unreachable
3. **Permission Issues** - User lacks required permissions
4. **No Backup Jobs** - VBR server has no backup jobs configured
5. **Filter Too Restrictive** - Session type filter excludes all sessions

## 🛠️ **Step-by-Step Diagnosis**

### **Step 1: Check Environment Configuration**

First, ensure you have a proper `.env` file:

```bash
# Copy the example file
cp env.example .env

# Edit with your actual values
nano .env
```

Your `.env` file should contain:

```env
VEEAM_HOST=your-actual-veeam-server.com
VEEAM_PORT=9419
VEEAM_API_VERSION=1.2-rev0
VEEAM_USERNAME=.\\your-actual-username
VEEAM_PASSWORD=your-actual-password
VEEAM_IGNORE_SSL=true
```

**⚠️ Important**: Replace the placeholder values with your actual Veeam server details!

### **Step 2: Run the Debug Script**

Use the debug script to test connectivity and authentication:

```bash
node debug-sessions.js
```

This will test:
- ✅ Server connectivity
- ✅ Authentication
- ✅ Sessions API access
- ✅ Available session types

### **Step 3: Test Authentication Manually**

Test the authentication tool directly:

```bash
# Start the server
./start.sh --http

# In another terminal, test auth
curl -X POST http://localhost:8000/auth \
  -H "Content-Type: application/json" \
  -d '{
    "host": "your-veeam-server.com",
    "username": ".\\your-username",
    "password": "your-password"
  }'
```

### **Step 4: Test Sessions API Directly**

Once authenticated, test the sessions endpoint:

```bash
curl -X POST http://localhost:8000/backup-sessions \
  -H "Content-Type: application/json" \
  -d '{
    "limit": 10,
    "typeFilter": "BackupJob"
  }'
```

## 🔧 **Common Fixes**

### **Fix 1: Authentication Issues**

**Problem**: "Authentication failed" errors

**Solutions**:
- ✅ Verify credentials in `.env` file
- ✅ Check username format (use `.\\username` for local accounts)
- ✅ Ensure password is correct
- ✅ Verify user has VBR access permissions

**Example**:
```env
# Correct format for local Windows account
VEEAM_USERNAME=.\\Administrator

# Correct format for domain account
VEEAM_USERNAME=domain\\username
```

### **Fix 2: Network Connectivity**

**Problem**: "Connection refused" or "ENOTFOUND" errors

**Solutions**:
- ✅ Verify VBR server hostname/IP is correct
- ✅ Check if port 9419 is accessible
- ✅ Test with `ping` and `telnet`
- ✅ Verify firewall rules allow access

**Test connectivity**:
```bash
# Test basic connectivity
ping your-veeam-server.com

# Test port accessibility
telnet your-veeam-server.com 9419
```

### **Fix 3: SSL Certificate Issues**

**Problem**: SSL/TLS errors

**Solutions**:
- ✅ Set `VEEAM_IGNORE_SSL=true` in `.env`
- ✅ Update SSL certificates on VBR server
- ✅ Use proper hostname (not IP) if using certificates

### **Fix 4: Permission Issues**

**Problem**: "Forbidden" or "Unauthorized" errors

**Solutions**:
- ✅ Ensure user has "ViewSessions" permission
- ✅ Check VBR user role (Administrator, Operator, etc.)
- ✅ Verify user can access VBR console

**Required permissions**:
- `ViewSessions` - To view backup sessions
- `ViewJobs` - To view backup jobs
- `ViewRepositories` - To view repositories

### **Fix 5: No Backup Jobs**

**Problem**: No sessions found even with correct authentication

**Solutions**:
- ✅ Check if backup jobs exist in VBR console
- ✅ Verify jobs have run at least once
- ✅ Check job schedules and last run times
- ✅ Look for different session types

**Try different filters**:
```bash
# Get all session types (no filter)
curl -X POST http://localhost:8000/backup-sessions \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'

# Try different session types
curl -X POST http://localhost:8000/backup-sessions \
  -H "Content-Type: application/json" \
  -d '{"typeFilter": "ReplicaJob"}'

curl -X POST http://localhost:8000/backup-sessions \
  -H "Content-Type: application/json" \
  -d '{"typeFilter": "BackupCopyJob"}'
```

## 🧪 **Testing in Claude Desktop**

### **1. Authenticate First**
```
auth-vbr({
  "host": "your-veeam-server.com",
  "username": ".\\your-username", 
  "password": "your-password"
})
```

**Expected response**:
```
Authentication successful. Connected to your-veeam-server.com:9419. Token received and stored for subsequent API calls.
```

### **2. Test Sessions**
```
veeam_list_backup_sessions({
  "limit": 10,
  "typeFilter": "BackupJob"
})
```

**Expected response**:
```
Retrieved X backup job sessions out of Y total sessions
{
  "summary": "Retrieved X backup job sessions out of Y total sessions",
  "sessions": [...],
  "pagination": {...}
}
```

### **3. Test Without Filters**
```
veeam_list_backup_sessions({
  "limit": 5
})
```

This will show all session types, helping identify what's available.

## 📊 **Session Types Reference**

Based on the Veeam API, these session types are available:

- **BackupJob** - VMware vSphere backup jobs
- **ReplicaJob** - VMware vSphere replication jobs
- **BackupCopyJob** - Backup copy jobs
- **ConfigurationBackup** - Configuration database backups
- **RepositoryMaintenance** - Repository maintenance tasks
- **FileLevelRestore** - File-level restore operations
- **InstantRecovery** - Instant VM recovery
- **SureBackup** - SureBackup verification jobs

## 🔍 **Debug Output Analysis**

### **Successful Response**
```json
{
  "summary": "Retrieved 5 backup job sessions out of 25 total sessions",
  "sessions": [
    {
      "id": "uuid",
      "name": "Backup Job Name",
      "sessionType": "BackupJob",
      "state": "Stopped",
      "result": "Success"
    }
  ],
  "pagination": {
    "total": 25,
    "count": 5
  }
}
```

### **No Sessions Response**
```json
{
  "content": [
    {
      "type": "text",
      "text": "No backup sessions found with type filter: BackupJob. This could mean:\n1. No backup jobs have run recently\n2. The type filter 'BackupJob' is too restrictive\n3. You don't have permission to view these sessions\n4. The VBR server has no backup jobs configured"
    }
  ],
  "isError": false
}
```

### **Authentication Error Response**
```json
{
  "content": [
    {
      "type": "text",
      "text": "Not authenticated. Please call auth-vbr tool first."
    }
  ],
  "isError": true
}
```

## 🚀 **Quick Fix Checklist**

- [ ] **Environment file configured** with real credentials
- [ ] **VBR server accessible** from your machine
- [ ] **Authentication successful** (run `auth-vbr` first)
- [ ] **User has permissions** to view sessions
- **Backup jobs exist** and have run at least once
- [ ] **Try different session types** if BackupJob returns nothing
- [ ] **Check VBR console** for job status and history

## 📞 **Still Having Issues?**

If you're still experiencing problems:

1. **Run the debug script**: `node debug-sessions.js`
2. **Check VBR console** for job status
3. **Verify network connectivity** to VBR server
4. **Test with different user credentials**
5. **Check VBR server logs** for authentication issues

## 🔗 **Related Documentation**

- [Veeam REST API Reference](https://helpcenter.veeam.com/docs/backup/vsphere/rest/overview.html)
- [Veeam User Roles and Permissions](https://helpcenter.veeam.com/docs/backup/vsphere/security_roles.html)
- [Veeam Backup Jobs](https://helpcenter.veeam.com/docs/backup/vsphere/backup_jobs.html) 