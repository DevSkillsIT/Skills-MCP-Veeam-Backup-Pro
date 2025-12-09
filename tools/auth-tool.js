// tools/auth-tool.js
import fetch from "node-fetch";
import https from "https";
import { z } from "zod";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Create an HTTPS agent that ignores self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.VEEAM_IGNORE_SSL === 'true'
});

// Get credentials from environment variables with fallbacks
const DEFAULT_HOST = process.env.VEEAM_HOST || "localhost";
const DEFAULT_USERNAME = process.env.VEEAM_USERNAME || ".\\Administrator";
const DEFAULT_PASSWORD = process.env.VEEAM_PASSWORD || "";
const DEFAULT_PORT = process.env.VEEAM_PORT || "9419";
const DEFAULT_API_VERSION = process.env.VEEAM_API_VERSION || "1.2-rev0";

// Authentication function that gets a token from VBR
async function authenticate(host, username, password, port = DEFAULT_PORT, apiVersion = DEFAULT_API_VERSION) {
  try {
    console.log(`Attempting to authenticate to https://${host}:${port}/api/oauth2/token`);
    
    const response = await fetch(`https://${host}:${port}/api/oauth2/token`, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'x-api-version': apiVersion,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `grant_type=password&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&refresh_token=&code=&use_short_term_refresh=&vbr_token=`,
      agent: httpsAgent
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Authentication failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const data = await response.json();
    
    if (!data.access_token) {
      throw new Error('No access token received from VBR server');
    }
    
    return data.access_token;
  } catch (error) {
    console.error('Authentication error:', error);
    throw error;
  }
}

export default function(server) {
  server.tool(
    "auth-vbr",
    {
      // All parameters optional
      host: z.string().describe("VBR server hostname or IP").optional(),
      username: z.string().describe("Username in domain\\user format").optional(),
      password: z.string().describe("Password").optional(),
      port: z.string().describe("VBR server port (default: 9419)").optional(),
      apiVersion: z.string().describe("VBR API version (default: 1.2-rev0)").optional()
    },
    async (params = {}) => {
      try {
        const host = params.host || DEFAULT_HOST;
        const username = params.username || DEFAULT_USERNAME;
        const password = params.password || DEFAULT_PASSWORD;
        const port = params.port || DEFAULT_PORT;
        const apiVersion = params.apiVersion || DEFAULT_API_VERSION;
        
        // Validate required parameters
        if (!host || host === "YOURIIPORFQDN") {
          throw new Error("Host not configured. Please set VEEAM_HOST environment variable or provide host parameter.");
        }
        
        if (!username || username === ".\\YOURLOCALUSER") {
          throw new Error("Username not configured. Please set VEEAM_USERNAME environment variable or provide username parameter.");
        }
        
        if (!password || password === "YOURPASS") {
          throw new Error("Password not configured. Please set VEEAM_PASSWORD environment variable or provide password parameter.");
        }
        
        console.log(`Authenticating to VBR server: ${host}:${port} with user: ${username}`);
        
        const token = await authenticate(host, username, password, port, apiVersion);
        
        // Store the token and host in a global variable for other tools to use
        global.vbrAuth = {
          host,
          port,
          token,
          apiVersion
        };
        
        return {
          content: [{ 
            type: "text", 
            text: `Authentication successful. Connected to ${host}:${port}. Token received and stored for subsequent API calls.` 
          }]
        };
      } catch (error) {
        return {
          content: [{ 
            type: "text", 
            text: `Authentication failed: ${error.message}` 
          }],
          isError: true
        };
      }
    }
  );
}