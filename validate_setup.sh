#!/bin/bash

# validate_setup.sh
# Pilot run validation script for Kayak Project

echo "==================================================="
echo "   KAYAK PROJECT - PILOT RUN VALIDATION"
echo "==================================================="

# 1. Check Tools
echo "\n[1] Checking Environment Tools..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is NOT installed."
else
    echo "✅ Docker is installed."
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm is NOT installed."
else
    echo "✅ npm is installed."
fi

# 2. Check Docker Containers
echo "\n[2] Checking Docker Containers..."
REQUIRED_CONTAINERS=("kayak_mysql" "kayak_mongo" "kayak_kafka" "kayak_redis")
ALL_UP=true

for container in "${REQUIRED_CONTAINERS[@]}"; do
    if docker ps | grep -q "$container"; then
        echo "✅ Container '$container' is RUNNING."
    else
        echo "❌ Container '$container' is NOT running."
        ALL_UP=false
    fi
done

# 3. Check Ports
echo "\n[3] Checking Service Ports..."
if lsof -i :4000 >/dev/null; then
    echo "✅ Backend API (Port 4000) is LISTENING."
else
    echo "❌ Backend API (Port 4000) is NOT listening. Did you run 'npm run dev' in services/core-api?"
fi

if lsof -i :5173 >/dev/null; then
    echo "✅ Frontend (Port 5173) is LISTENING."
else
    echo "❌ Frontend (Port 5173) is NOT listening. Did you run 'npm run dev' in client?"
fi

# 4. Backend Health Check
echo "\n[4] Testing Backend Health..."
HEALTH_RESPONSE=$(curl -s http://localhost:4000/health)
if [[ $HEALTH_RESPONSE == *"ok"* ]]; then
    echo "✅ Backend Health Check PASSED: $HEALTH_RESPONSE"
else
    echo "❌ Backend Health Check FAILED. Response: $HEALTH_RESPONSE"
fi

# 5. Simulate Registration (to capture INTERNAL_ERROR details)
echo "\n[5] Simulating Registration (Pilot Test)..."
# Generating a random user ID to avoid duplicate errors
RANDOM_ID=$((100 + $RANDOM % 899))
USER_ID="$RANDOM_ID-00-0000"
EMAIL="pilot_$RANDOM_ID@test.com"

echo "Attempting to register user: $USER_ID / $EMAIL"

RESPONSE=$(curl -s -X POST http://localhost:4000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "'"$USER_ID"'",
    "firstName": "Pilot",
    "lastName": "User",
    "email": "'"$EMAIL"'",
    "password": "PilotPassword123!",
    "address": "123 Pilot Lane",
    "city": "Test City",
    "state": "NY",
    "zip": "10001",
    "phone": "5551234567"
  }')

echo "Response Body:"
echo "$RESPONSE"

if [[ $RESPONSE == *"INTERNAL_ERROR"* ]]; then
    echo "\n❌ DETECTED INTERNAL_ERROR"
    echo "👉 If you see 'stack', please share it."
elif [[ $RESPONSE == *"userId"* ]]; then
    echo "\n✅ Registration SUCCESSFUL!"
else
    echo "\n⚠️ Unknown response."
fi

echo "\n==================================================="
echo "   VALIDATION COMPLETE"
echo "==================================================="
