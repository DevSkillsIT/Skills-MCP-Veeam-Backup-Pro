// debug-sessions.js - Debug script for backup sessions
import fetch from "node-fetch";
import https from "https";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const httpsAgent = new https.Agent({
  rejectUnauthorized: process.env.VEEAM_IGNORE_SSL === 'true'
});

async function testVeeamConnection() {
  const host = process.env.VEEAM_HOST || "localhost";
  const port = process.env.VEEAM_PORT || "9419";
  const username = process.env.VEEAM_USERNAME || ".\\Administrator";
  const password = process.env.VEEAM_PASSWORD || "";
  const apiVersion = process.env.VEEAM_API_VERSION || "1.2-rev0";
  
  console.log("🔍 Veeam VBR Connection Debug");
  console.log("==============================");
  console.log(`Host: ${host}`);
  console.log(`Port: ${port}`);
  console.log(`Username: ${username}`);
  console.log(`API Version: ${apiVersion}`);
  console.log(`Ignore SSL: ${process.env.VEEAM_IGNORE_SSL}`);
  console.log("");
  
  if (!host || host === "YOURIIPORFQDN") {
    console.log("❌ Host not configured. Please set VEEAM_HOST in .env file");
    return;
  }
  
  if (!username || username === ".\\YOURLOCALUSER") {
    console.log("❌ Username not configured. Please set VEEAM_USERNAME in .env file");
    return;
  }
  
  if (!password || password === "YOURPASS") {
    console.log("❌ Password not configured. Please set VEEAM_PASSWORD in .env file");
    return;
  }
  
  try {
    // Test 1: Basic connectivity
    console.log("🧪 Test 1: Basic connectivity...");
    const connectivityUrl = `https://${host}:${port}/api/v1/serverInfo`;
    console.log(`Testing: ${connectivityUrl}`);
    
    const connectivityResponse = await fetch(connectivityUrl, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'x-api-version': apiVersion
      },
      agent: httpsAgent
    });
    
    if (connectivityResponse.ok) {
      console.log("✅ Server is reachable (no auth required)");
    } else {
      console.log(`❌ Server connectivity issue: ${connectivityResponse.status} ${connectivityResponse.statusText}`);
    }
    
    // Test 2: Authentication
    console.log("\n🧪 Test 2: Authentication...");
    const authUrl = `https://${host}:${port}/api/oauth2/token`;
    console.log(`Testing: ${authUrl}`);
    
    const authResponse = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'x-api-version': apiVersion,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `grant_type=password&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&refresh_token=&code=&use_short_term_refresh=&vbr_token=`,
      agent: httpsAgent
    });
    
    if (authResponse.ok) {
      const authData = await authResponse.json();
      if (authData.access_token) {
        console.log("✅ Authentication successful");
        console.log(`Token received: ${authData.access_token.substring(0, 20)}...`);
        
        // Test 3: Sessions API
        console.log("\n🧪 Test 3: Sessions API...");
        const sessionsUrl = `https://${host}:${port}/api/v1/sessions?limit=10&typeFilter=BackupJob`;
        console.log(`Testing: ${sessionsUrl}`);
        
        const sessionsResponse = await fetch(sessionsUrl, {
          method: 'GET',
          headers: {
            'accept': 'application/json',
            'x-api-version': apiVersion,
            'Authorization': `Bearer ${authData.access_token}`
          },
          agent: httpsAgent
        });
        
        if (sessionsResponse.ok) {
          const sessionsData = await sessionsResponse.json();
          console.log("✅ Sessions API call successful");
          console.log(`Response status: ${sessionsResponse.status}`);
          console.log(`Data structure:`, Object.keys(sessionsData));
          
          if (sessionsData.data) {
            console.log(`Number of sessions: ${sessionsData.data.length}`);
            if (sessionsData.data.length > 0) {
              console.log("Sample session:", JSON.stringify(sessionsData.data[0], null, 2));
            }
          }
          
          if (sessionsData.pagination) {
            console.log(`Pagination: total=${sessionsData.pagination.total}, count=${sessionsData.pagination.count}`);
          }
          
          // Test 4: Different session types
          console.log("\n🧪 Test 4: Different session types...");
          const allSessionsUrl = `https://${host}:${port}/api/v1/sessions?limit=5`;
          console.log(`Testing: ${allSessionsUrl}`);
          
          const allSessionsResponse = await fetch(allSessionsUrl, {
            method: 'GET',
            headers: {
              'accept': 'application/json',
              'x-api-version': apiVersion,
              'Authorization': `Bearer ${authData.access_token}`
            },
            agent: httpsAgent
          });
          
          if (allSessionsResponse.ok) {
            const allSessionsData = await allSessionsResponse.json();
            if (allSessionsData.data && allSessionsData.data.length > 0) {
              console.log("✅ All sessions API call successful");
              console.log("Session types found:");
              const sessionTypes = [...new Set(allSessionsData.data.map(s => s.sessionType))];
              sessionTypes.forEach(type => {
                const count = allSessionsData.data.filter(s => s.sessionType === type).length;
                console.log(`  - ${type}: ${count} sessions`);
              });
            } else {
              console.log("⚠️  No sessions found at all (this might be normal for a new VBR server)");
            }
          } else {
            console.log(`❌ All sessions API call failed: ${allSessionsResponse.status} ${allSessionsResponse.statusText}`);
          }
          
        } else {
          const errorText = await sessionsResponse.text();
          console.log(`❌ Sessions API call failed: ${sessionsResponse.status} ${sessionsResponse.statusText}`);
          console.log(`Error details: ${errorText}`);
        }
        
      } else {
        console.log("❌ Authentication failed: No access token received");
        console.log("Response:", authData);
      }
    } else {
      const errorText = await authResponse.text();
      console.log(`❌ Authentication failed: ${authResponse.status} ${authResponse.statusText}`);
      console.log(`Error details: ${errorText}`);
    }
    
  } catch (error) {
    console.error("❌ Error during testing:", error.message);
    if (error.code === 'ENOTFOUND') {
      console.log("💡 Tip: Check if the hostname/IP is correct and the server is reachable");
    } else if (error.code === 'ECONNREFUSED') {
      console.log("💡 Tip: Check if the port is correct and the VBR service is running");
    } else if (error.code === 'CERT_HAS_EXPIRED' || error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
      console.log("💡 Tip: Set VEEAM_IGNORE_SSL=true in your .env file to ignore SSL certificate issues");
    }
  }
}

// Run the debug script
testVeeamConnection().catch(error => {
  console.error("❌ Debug script failed:", error);
}); 