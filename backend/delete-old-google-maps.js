// Delete the old Google Maps server (modelcontextprotocol/google-maps)
const https = require("https");
const backendUrl = "https://mcp-registry-backend-554655392699.us-central1.run.app";
const serverId = "modelcontextprotocol/google-maps";

console.log("Deleting old Google Maps server...");
console.log(`Server ID: ${serverId}`);
console.log(`Backend URL: ${backendUrl}`);
console.log("");

const apiUrl = new URL(`${backendUrl}/v0.1/servers/${encodeURIComponent(serverId)}`);

const options = {
  hostname: apiUrl.hostname,
  port: 443,
  path: apiUrl.pathname,
  method: "DELETE",
  headers: {
    "X-User-Id": "system"
  }
};

const req = https.request(options, (res) => {
  let data = "";

  res.on("data", (chunk) => {
    data += chunk;
  });

  res.on("end", () => {
    if (res.statusCode === 200 || res.statusCode === 204) {
      console.log("✅ Successfully deleted old Google Maps server!");
      console.log("");
    } else if (res.statusCode === 404) {
      console.log("ℹ️  Server not found (may have already been deleted)");
      console.log("");
    } else {
      console.error("❌ Failed to delete server");
      console.error(`HTTP ${res.statusCode}: ${data}`);
      process.exit(1);
    }
  });
});

req.on("error", (error) => {
  console.error("❌ Failed to delete server");
  console.error(`Error: ${error.message}`);
  process.exit(1);
});

req.end();
