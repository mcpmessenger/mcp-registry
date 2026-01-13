// Update Google Maps MCP server with tools via backend API
const backendUrl = "https://mcp-registry-backend-554655392699.us-central1.run.app";
const serverId = "com.google/maps-mcp";

const updateData = {
  serverId: "com.google/maps-mcp",
  name: "Google Maps MCP (Grounding Lite)",
  description: "Google Maps Platform MCP server (Grounding Lite). Requires X-Goog-Api-Key header configured in the registry HTTP headers.",
  version: "0.1.0",
  env: {},
  tools: [
    {
      name: "search_places",
      description: "Search places by text query",
      inputSchema: {
        type: "object",
        properties: {
          textQuery: {
            type: "string",
            description: "Primary search text, e.g., tacos in des moines"
          },
          locationBias: {
            type: "object",
            description: "Optional bias region (see Maps Grounding Lite docs)"
          }
        },
        required: ["textQuery"]
      }
    },
    {
      name: "lookup_weather",
      description: "Get weather data for a location",
      inputSchema: {
        type: "object",
        properties: {
          location: {
            type: "object",
            properties: {
              address: {
                type: "string",
                description: "Address or location name, e.g., Des Moines, IA"
              }
            },
            required: ["address"]
          }
        },
        required: ["location"]
      }
    },
    {
      name: "compute_routes",
      description: "Compute travel routes between origins and destinations",
      inputSchema: {
        type: "object",
        properties: {
          origin: {
            type: "object",
            properties: {
              address: {
                type: "string",
                description: "Origin address or location"
              }
            },
            required: ["address"]
          },
          destination: {
            type: "object",
            properties: {
              address: {
                type: "string",
                description: "Destination address or location"
              }
            },
            required: ["address"]
          },
          travelMode: {
            type: "string",
            enum: ["DRIVE", "WALK", "BICYCLE", "TRANSIT"],
            description: "Travel mode for the route"
          }
        },
        required: ["origin", "destination"]
      }
    }
  ],
  capabilities: ["tools"],
  manifest: {
    name: "Google Maps MCP",
    version: "0.1.0",
    endpoint: "https://mapstools.googleapis.com/mcp",
    tools: [
      {
        name: "search_places",
        description: "Search places by text query",
        inputSchema: {
          type: "object",
          properties: {
            textQuery: {
              type: "string",
              description: "Primary search text, e.g., tacos in des moines"
            },
            locationBias: {
              type: "object",
              description: "Optional bias region (see Maps Grounding Lite docs)"
            }
          },
          required: ["textQuery"]
        }
      },
      {
        name: "lookup_weather",
        description: "Get weather data for a location",
        inputSchema: {
          type: "object",
          properties: {
            location: {
              type: "object",
              properties: {
                address: {
                  type: "string",
                  description: "Address or location name, e.g., Des Moines, IA"
                }
              },
              required: ["address"]
            }
          },
          required: ["location"]
        }
      },
      {
        name: "compute_routes",
        description: "Compute travel routes between origins and destinations",
        inputSchema: {
          type: "object",
          properties: {
            origin: {
              type: "object",
              properties: {
                address: {
                  type: "string",
                  description: "Origin address or location"
                }
              },
              required: ["address"]
            },
            destination: {
              type: "object",
              properties: {
                address: {
                  type: "string",
                  description: "Destination address or location"
                }
              },
              required: ["address"]
            },
            travelMode: {
              type: "string",
              enum: ["DRIVE", "WALK", "BICYCLE", "TRANSIT"],
              description: "Travel mode for the route"
            }
          },
          required: ["origin", "destination"]
        }
      }
    ],
    capabilities: ["tools"]
  },
  metadata: {
    source: "official",
    publisher: "Google",
    documentation: "https://developers.google.com/maps/ai/grounding-lite",
    endpoint: "https://mapstools.googleapis.com/mcp",
    notes: "Set HTTP Headers in registry to {\"X-Goog-Api-Key\":\"YOUR_KEY\"}"
  }
};

const https = require("https");
const url = require("url");

const apiUrl = new URL(`${backendUrl}/v0.1/publish`);
const postData = JSON.stringify(updateData);

console.log("Updating Google Maps MCP server...");
console.log(`Server ID: ${serverId}`);
console.log(`Backend URL: ${backendUrl}`);
console.log("");

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
    if (res.statusCode >= 200 && res.statusCode < 300) {
      try {
        const result = JSON.parse(data);
        console.log("✅ Successfully updated Google Maps MCP server!");
        console.log("");
        console.log("Server details:");
        console.log(`  Name: ${result.server.name}`);
        console.log(`  Tools: ${result.server.tools?.length || 0}`);
        if (result.server.tools && result.server.tools.length > 0) {
          console.log(`  Tool names: ${result.server.tools.map(t => t.name).join(", ")}`);
        }
      } catch (e) {
        console.error("❌ Failed to parse response");
        console.error(`Response: ${data}`);
        process.exit(1);
      }
    } else {
      console.error("❌ Failed to update server");
      console.error(`HTTP ${res.statusCode}: ${data}`);
      process.exit(1);
    }
  });
});

req.on("error", (error) => {
  console.error("❌ Failed to update server");
  console.error(`Error: ${error.message}`);
  process.exit(1);
});

req.write(postData);
req.end();
