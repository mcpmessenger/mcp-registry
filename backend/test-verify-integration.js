// Test the verify-integration endpoint for Google Maps
const https = require("https");
const backendUrl = "https://mcp-registry-backend-554655392699.us-central1.run.app";
const serverId = "com.google/maps-mcp";

console.log("Testing verify-integration endpoint...");
console.log(`Server ID: ${serverId}`);
console.log(`Backend URL: ${backendUrl}`);
console.log("");

const apiUrl = new URL(`${backendUrl}/v0.1/servers/${encodeURIComponent(serverId)}/verify-integration`);
const postData = JSON.stringify({ discoverTools: true });

const options = {
  hostname: apiUrl.hostname,
  port: 443,
  path: apiUrl.pathname,
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(postData),
    "X-User-Id": "system"
  }
};

const req = https.request(options, (res) => {
  let data = "";

  res.on("data", (chunk) => {
    data += chunk;
  });

  res.on("end", () => {
    console.log(`Status Code: ${res.statusCode}`);
    console.log(`Response Headers:`, res.headers);
    console.log("");
    
    if (res.statusCode === 200) {
      try {
        const result = JSON.parse(data);
        console.log("✅ Successfully verified integration!");
        console.log("");
        console.log("Result:", JSON.stringify(result, null, 2));
      } catch (e) {
        console.log("✅ Response received (parse may have failed)");
        console.log(`Response: ${data}`);
      }
    } else {
      console.error("❌ Failed to verify integration");
      console.error(`HTTP ${res.statusCode}: ${data}`);
      
      try {
        const error = JSON.parse(data);
        console.error("Error details:", JSON.stringify(error, null, 2));
      } catch (e) {
        // Not JSON
      }
      
      process.exit(1);
    }
  });
});

req.on("error", (error) => {
  console.error("❌ Request failed");
  console.error(`Error: ${error.message}`);
  process.exit(1);
});

req.write(postData);
req.end();
