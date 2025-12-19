import type { MCPAgent } from "@/types/agent"

export const mockAgents: MCPAgent[] = [
  {
    id: "1",
    name: "Vision Agent",
    endpoint: "https://vision.mcp.internal/api",
    status: "online",
    lastActive: new Date(Date.now() - 1000 * 60 * 2),
    capabilities: ["Vision", "Image Analysis", "OCR"],
    manifest: JSON.stringify(
      {
        name: "Vision Agent",
        version: "1.0.0",
        capabilities: ["vision", "ocr"],
      },
      null,
      2,
    ),
    metrics: {
      avgLatency: 245,
      p95Latency: 420,
      uptime: 99.8,
    },
    activityLog: [
      {
        id: "1",
        timestamp: new Date(Date.now() - 1000 * 60 * 5),
        level: "info",
        message: "Successfully processed image analysis request",
      },
      {
        id: "2",
        timestamp: new Date(Date.now() - 1000 * 60 * 15),
        level: "info",
        message: "Agent health check passed",
      },
    ],
  },
  {
    id: "2",
    name: "Data Analysis Agent",
    endpoint: "https://data.mcp.internal/api",
    status: "online",
    lastActive: new Date(Date.now() - 1000 * 60 * 5),
    capabilities: ["Data Analysis", "SQL", "Statistics"],
    manifest: JSON.stringify(
      {
        name: "Data Analysis Agent",
        version: "2.1.0",
        capabilities: ["data-analysis", "sql", "statistics"],
      },
      null,
      2,
    ),
    metrics: {
      avgLatency: 189,
      p95Latency: 305,
      uptime: 99.9,
    },
  },
  {
    id: "3",
    name: "Document Processing",
    endpoint: "https://docs.mcp.internal/api",
    status: "warning",
    lastActive: new Date(Date.now() - 1000 * 60 * 45),
    capabilities: ["Document Analysis", "PDF", "DOCX"],
    manifest: JSON.stringify(
      {
        name: "Document Processing",
        version: "1.5.0",
        capabilities: ["document", "pdf", "docx"],
      },
      null,
      2,
    ),
    metrics: {
      avgLatency: 892,
      p95Latency: 1420,
      uptime: 95.2,
    },
    activityLog: [
      {
        id: "3",
        timestamp: new Date(Date.now() - 1000 * 60 * 30),
        level: "warning",
        message: "High latency detected: 1.2s average",
      },
    ],
  },
  {
    id: "4",
    name: "Code Assistant",
    endpoint: "https://code.mcp.internal/api",
    status: "offline",
    lastActive: new Date(Date.now() - 1000 * 60 * 60 * 2),
    capabilities: ["Code Generation", "Analysis", "Testing"],
    manifest: JSON.stringify(
      {
        name: "Code Assistant",
        version: "3.0.0",
        capabilities: ["code", "analysis", "testing"],
      },
      null,
      2,
    ),
    metrics: {
      avgLatency: 0,
      p95Latency: 0,
      uptime: 0,
    },
    activityLog: [
      {
        id: "4",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
        level: "error",
        message: "Connection timeout - agent unreachable",
      },
    ],
  },
]
