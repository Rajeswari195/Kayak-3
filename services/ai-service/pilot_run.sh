#!/bin/bash

echo "🚀 STAY KAYAK PILOT RUN - BOOKING VERIFICATION 🚀"
echo "==================================================="

echo "1️⃣  CLEANING UP DATA..."
python3 delete_demo_bookings.py
echo "---------------------------------------------------"

echo "2️⃣  VERIFYING FLIGHT BOOKING DATE FIX..."
python3 test_booking_date.py
echo "---------------------------------------------------"

echo "3️⃣  VERIFYING HOTEL BOOKING DATE FIX..."
python3 test_hotel_booking_date.py
echo "---------------------------------------------------"

echo "🎉 PILOT RUN COMPLETE."
