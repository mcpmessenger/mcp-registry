// Check which Google Maps server IDs exist in the database
const https = require("https");
const backendUrl = "https://mcp-registry-backend-554655392699.us-central1.run.app";

const serverIds = [
  "com.google/maps-mcp",
  "modelcontextprotocol/google-maps"
];

console.log("Checking Google Maps servers...\n");

function checkServer(serverId) {
  return new Promise((resolve) => {
    const apiUrl = new URL(`${backendUrl}/v0.1/servers/${encodeURIComponent(serverId)}`);
    
    const options = {
      hostname: apiUrl.hostname,
      port: 443,
      path: apiUrl.pathname,
      method: "GET",
      headers: {
        "X-User-Id": "system"
      }
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        if (res.statusCode === 200) {
          try {
            const server = JSON.parse(data);
            resolve({ serverId, exists: true, server });
          } catch (e) {
            resolve({ serverId, exists: false, error: "Parse error", raw: data });
          }
        } else {
          resolve({ serverId, exists: false, statusCode: res.statusCode, raw: data });
        }
      });
    });

    req.on("error", (error) => {
      resolve({ serverId, exists: false, error: error.message });
    });

    req.end();
  });
}

async function checkAll() {
  for (const serverId of serverIds) {
    const result = await checkServer(serverId);
    if (result.exists && result.server) {
      console.log(`✅ Found: ${serverId}`);
      console.log(`   Name: ${result.server.name || "N/A"}`);
      console.log(`   Tools: ${result.server.tools?.length || 0}`);
      if (result.server.tools && result.server.tools.length > 0) {
        console.log(`   Tool names: ${result.server.tools.map(t => t.name).join(", ")}`);
      }
      console.log(`   Server ID in DB: ${result.server.serverId}`);
      console.log("");
    } else {
      console.log(`❌ Not found: ${serverId}`);
      if (result.statusCode) {
        console.log(`   Status: ${result.statusCode}`);
        if (result.raw) {
          console.log(`   Response: ${result.raw.substring(0, 200)}`);
        }
      }
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      console.log("");
    }
  }
}

checkAll().catch(console.error);
