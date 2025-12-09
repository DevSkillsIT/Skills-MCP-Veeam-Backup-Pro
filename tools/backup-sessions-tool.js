// tools/backup-sessions-tool.js
import fetch from "node-fetch";
import https from "https";
import { z } from "zod";

// Create an HTTPS agent that ignores self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.VEEAM_IGNORE_SSL === 'true'
});

export default function(server) {
  // Add backup job sessions tool
  server.tool(
    "get-backup-sessions",
    {
      limit: z.number().min(1).max(1000).default(100).describe("Maximum number of sessions to retrieve"),
      skip: z.number().min(0).default(0).describe("Number of sessions to skip (for pagination)"),
      typeFilter: z.string().optional().describe("Session type filter (e.g., BackupJob, ReplicaJob, BackupCopyJob). Leave empty to get all session types."),
      stateFilter: z.string().optional().describe("Session state filter (e.g., Working, Stopped, Failed)"),
      resultFilter: z.string().optional().describe("Session result filter (e.g., Success, Failed, Warning)"),
      jobIdFilter: z.string().optional().describe("Filter sessions by specific job ID")
    },
    async (params) => {
      try {
        if (!global.vbrAuth) {
          return {
            content: [{ 
              type: "text", 
              text: "Not authenticated. Please call auth-vbr tool first." 
            }],
            isError: true
          };
        }
        
        const { host, port = 9419, token, apiVersion = "1.2-rev0" } = global.vbrAuth;
        const { 
          limit = 100, 
          skip = 0, 
          typeFilter,
          stateFilter,
          resultFilter,
          jobIdFilter
        } = params;
        
        // Build query parameters
        const queryParams = new URLSearchParams({
          limit: limit.toString(),
          skip: skip.toString()
        });
        
        // Only add typeFilter if specified (no default filter)
        if (typeFilter) {
          queryParams.append('typeFilter', typeFilter);
        }
        
        if (stateFilter) {
          queryParams.append('stateFilter', stateFilter);
        }
        
        if (resultFilter) {
          queryParams.append('resultFilter', resultFilter);
        }
        
        if (jobIdFilter) {
          queryParams.append('jobIdFilter', jobIdFilter);
        }
        
        const apiUrl = `https://${host}:${port}/api/v1/sessions?${queryParams.toString()}`;
        console.log(`Fetching sessions from: ${apiUrl}`);
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'accept': 'application/json',
            'x-api-version': apiVersion,
            'Authorization': `Bearer ${token}`
          },
          agent: httpsAgent
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch sessions: ${response.status} ${response.statusText} - ${errorText}`);
        }
        
        const sessionsData = await response.json();
        console.log(`Received sessions data:`, JSON.stringify(sessionsData, null, 2));
        
        // Check if we have any sessions
        if (!sessionsData.data || sessionsData.data.length === 0) {
          const filterInfo = typeFilter ? ` with type filter: ${typeFilter}` : " (no type filter applied)";
          return {
            content: [{ 
              type: "text", 
              text: `No sessions found${filterInfo}. This could mean:\n` +
                    `1. No sessions exist for the specified criteria\n` +
                    `2. The filters are too restrictive\n` +
                    `3. You don't have permission to view these sessions\n` +
                    `4. The VBR server has no recent activity\n\n` +
                    `Try:\n` +
                    `- Removing filters to see all session types\n` +
                    `- Using different filter values\n` +
                    `- Checking if backup jobs have run recently\n` +
                    `- Verifying your user permissions on the VBR server\n\n` +
                    `Available session types: BackupJob, ReplicaJob, BackupCopyJob, ConfigurationBackup, etc.`
            }],
            isError: false
          };
        }
        
        // Add a summary message at the beginning
        const total = sessionsData.pagination?.total || sessionsData.data.length;
        const count = sessionsData.data.length;
        const filterSummary = typeFilter ? ` (filtered by type: ${typeFilter})` : " (all session types)";
        const summary = `Retrieved ${count} sessions${filterSummary} out of ${total} total sessions`;
        
        // Group sessions by type for better organization
        const sessionsByType = {};
        sessionsData.data.forEach(session => {
          const sessionType = session.sessionType || 'Unknown';
          if (!sessionsByType[sessionType]) {
            sessionsByType[sessionType] = [];
          }
          sessionsByType[sessionType].push(session);
        });
        
        // Format the data for better readability
        const formattedResult = {
          summary,
          sessionsByType,
          sessions: sessionsData.data.map(session => ({
            id: session.id,
            name: session.name,
            sessionType: session.sessionType,
            state: session.state,
            platformName: session.platformName,
            creationTime: session.creationTime,
            endTime: session.endTime,
            progressPercent: session.progressPercent,
            result: session.result?.result || 'Unknown',
            message: session.result?.message || 'No message'
          })),
          pagination: sessionsData.pagination || { total, count },
          filters: {
            typeFilter: typeFilter || 'None (showing all types)',
            stateFilter: stateFilter || 'None',
            resultFilter: resultFilter || 'None',
            jobIdFilter: jobIdFilter || 'None'
          }
        };
        
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify(formattedResult, null, 2)
          }]
        };
      } catch (error) {
        console.error('Error in get-backup-sessions:', error);
        return {
          content: [{ 
            type: "text", 
            text: `Error fetching sessions: ${error.message}\n\n` +
                  `Debugging tips:\n` +
                  `1. Check if you're authenticated: call auth-vbr first\n` +
                  `2. Verify the VBR server is accessible\n` +
                  `3. Check your user permissions\n` +
                  `4. Try removing filters to see all session types\n` +
                  `5. Use get-backup-jobs to see configured backup jobs first`
          }],
          isError: true
        };
      }
    }
  );
}