#!/bin/bash
# Simple test script for orchestrator (Git Bash compatible)

curl -X POST http://localhost:3001/api/orchestrator/query \
  -H "Content-Type: application/json" \
  -d @scripts/test-query.json


