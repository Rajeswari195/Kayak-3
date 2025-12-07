#!/bin/bash
# Regenerate token with correct 'sub' claim
TOKEN=$(node services/core-api/src/scripts/generate-token.js 1bb01aa7-b6a4-44d0-8d54-e6dad0cd88d0)
BASE_URL="http://localhost:4000/api"

echo "1. Testing Flights Search (Public)..."
curl -v "$BASE_URL/search/flights?origin=DEL&destination=BOM&date=2024-12-25"

echo "\n2. Testing Hotels Search (Public)..."
curl -v "$BASE_URL/search/hotels?city=Mumbai&checkIn=2024-12-25&checkOut=2024-12-28"

echo "\n3. Testing Protected Booking Endpoint (Simulated)..."
curl -v -X POST "$BASE_URL/bookings/flight" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
