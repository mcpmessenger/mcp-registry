# Kafka Setup Guide

This guide explains how to set up Kafka locally for the MCP Orchestrator.

**Status: ✅ Fully Operational** - The Kafka orchestrator is implemented and working. This guide will help you set it up.

## Option 1: Docker (Recommended for Windows)

The easiest way to run Kafka on Windows is using Docker.

### Prerequisites
- Docker Desktop installed and running

### Steps

1. **Start Kafka and Zookeeper:**
   ```powershell
   docker-compose -f docker-compose.kafka.yml up -d
   ```

2. **Wait for services to be ready** (about 10-15 seconds), then create the required topics:
   ```powershell
   .\scripts\setup-kafka-topics.ps1
   ```

3. **Verify Kafka is running:**
   ```powershell
   docker ps
   ```
   You should see `zookeeper` and `kafka` containers running.

4. **Configure your backend `.env` file:**
   ```env
   ENABLE_KAFKA=true
   KAFKA_BROKERS=localhost:9092
   KAFKA_CLIENT_ID=mcp-orchestrator-coordinator
   KAFKA_GROUP_ID=mcp-orchestrator-coordinator
   KAFKA_TOPIC_TOOL_SIGNALS=tool-signals
   KAFKA_TOPIC_ORCHESTRATOR_PLANS=orchestrator-plans
   KAFKA_TOPIC_ORCHESTRATOR_RESULTS=orchestrator-results
   ```

5. **Start your backend:**
   ```powershell
   cd backend
   pnpm start
   ```

6. **Stop Kafka when done:**
   ```powershell
   docker-compose -f docker-compose.kafka.yml down
   ```

## Option 2: Native Installation (Advanced)

If you prefer to run Kafka natively on Windows:

1. Download the **binary** bundle (`kafka_2.13-4.1.1.tgz`) from https://kafka.apache.org/downloads
   - ⚠️ **Important**: Download the binary bundle, NOT the source bundle
   
2. Extract it to a folder (e.g., `C:\kafka`)

3. Start Zookeeper in one terminal:
   ```powershell
   cd C:\kafka\kafka_2.13-4.1.1
   .\bin\windows\zookeeper-server-start.bat .\config\zookeeper.properties
   ```

4. Start Kafka in another terminal:
   ```powershell
   cd C:\kafka\kafka_2.13-4.1.1
   .\bin\windows\kafka-server-start.bat .\config\server.properties
   ```

5. Create topics manually using `kafka-topics.bat` (see the Docker script for the exact commands)

## Verifying Setup

You can verify Kafka is working by:

1. **Producing a test message:**
   ```powershell
   docker exec -it kafka kafka-console-producer --topic user-requests --bootstrap-server localhost:9092
   ```
   Type a message and press Enter.

2. **Consuming messages:**
   ```powershell
   docker exec -it kafka kafka-console-consumer --topic orchestrator-results --bootstrap-server localhost:9092 --from-beginning
   ```

## Troubleshooting

- **"Connection refused"**: Make sure Docker containers are running (`docker ps`)
- **"Topic not found"**: Run the setup script to create topics
- **Port conflicts**: If port 9092 is in use, change it in `docker-compose.kafka.yml` and update your `.env`

