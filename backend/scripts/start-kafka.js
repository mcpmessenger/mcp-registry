#!/usr/bin/env node
/**
 * Cross-platform script to start Kafka using Docker Compose
 * Works on Windows, macOS, and Linux
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🔍 Checking if Kafka is running...');

function checkKafkaRunning() {
  try {
    const output = execSync('docker ps --filter "name=kafka" --format "{{.Names}}"', { encoding: 'utf-8' });
    return output.trim().includes('kafka');
  } catch (error) {
    return false;
  }
}

function startKafka() {
  try {
    // Navigate to project root (where docker-compose.kafka.yml is)
    const scriptDir = __dirname;
    const projectRoot = path.resolve(scriptDir, '../..');
    process.chdir(projectRoot);

    console.log('🚀 Starting Kafka with Docker Compose...');
    execSync('docker-compose -f docker-compose.kafka.yml up -d', { stdio: 'inherit' });

    console.log('⏳ Waiting for Kafka to be ready...');
    // Wait 5 seconds for Kafka to start
    const startTime = Date.now();
    while (Date.now() - startTime < 5000) {
      // Busy wait
    }

    if (checkKafkaRunning()) {
      console.log('✅ Kafka started successfully!');
      console.log('   Kafka broker: localhost:9092');
      return true;
    } else {
      console.log('⚠️  Kafka container started but may not be ready yet');
      console.log('   The backend will retry connection...');
      return true; // Still return success, backend will handle retries
    }
  } catch (error) {
    console.error('❌ Failed to start Kafka:', error.message);
    console.error('   Make sure Docker is running and docker-compose is available');
    console.error('   You can start Kafka manually with:');
    console.error('   docker-compose -f docker-compose.kafka.yml up -d');
    return false;
  }
}

// Main execution
if (checkKafkaRunning()) {
  console.log('✅ Kafka is already running');
  process.exit(0);
} else {
  const success = startKafka();
  process.exit(success ? 0 : 1);
}
