#!/bin/bash
# Bash script to start Kafka using Docker Compose
# This script checks if Kafka is running and starts it if needed

echo "🔍 Checking if Kafka is running..."

# Check if Kafka container is running
if docker ps --filter "name=kafka" --format "{{.Names}}" | grep -q kafka; then
    echo "✅ Kafka is already running"
    exit 0
fi

echo "🚀 Starting Kafka with Docker Compose..."

# Navigate to project root (where docker-compose.kafka.yml is)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

# Start Kafka using docker-compose
if docker-compose -f docker-compose.kafka.yml up -d; then
    echo "⏳ Waiting for Kafka to be ready..."
    sleep 5
    
    # Check if Kafka is now running
    if docker ps --filter "name=kafka" --format "{{.Names}}" | grep -q kafka; then
        echo "✅ Kafka started successfully!"
        echo "   Kafka broker: localhost:9092"
        exit 0
    else
        echo "⚠️  Kafka container started but may not be ready yet"
        echo "   The backend will retry connection..."
        exit 0
    fi
else
    echo "❌ Failed to start Kafka"
    echo "   Make sure Docker is running and docker-compose is available"
    echo "   You can start Kafka manually with:"
    echo "   docker-compose -f docker-compose.kafka.yml up -d"
    exit 1
fi
