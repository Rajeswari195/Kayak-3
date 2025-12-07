from app.agents.concierge_agent import ConciergeAgent
import json
import pymysql

# 1. Instantiate Agent
agent = ConciergeAgent()
print("🤖 Agent Instantiated (Local Mode)")

# 2. Simulate User Flow
# Step A: Intent
resp1 = agent.process_message("Plan a trip to Mumbai")
print(f"\nUser: Plan a trip to Mumbai\nAgent: {resp1}")

# Step B: Dates
# This should trigger the [WAIT] delay logic, but we just want to set context
resp2 = agent.process_message("December 25th")
print(f"\nUser: December 25th\nAgent: {resp2}")

# Step C: Populate Recommendations (Simulate what Main.py does after [WAIT])
print("\n... Simulating Search Delay ...")
# Need to manually populate last_recommendations since we aren't waiting for the async task
# Force a search call
from app.agents.deals_agent import deals_agent
flight = {
    "type": "Flight", 
    "destination": "Mumbai", 
    "price": 500, 
    "airline": "Vistara", 
    "id": "flight_test_123",
    "origin": "JFK"
}
agent.last_recommendations = [flight]
print("DEBUG: Injected Vistara flight into agent memory")

# Step D: Select / Book
print("\nUser: Lets go with Vistara")
resp3 = agent.process_message("Lets go with Vistara")
print(f"Agent: {resp3}")

# 3. Verify in DB
try:
    conn = pymysql.connect(
        host='localhost',
        user='kayak_user',
        password='kayak_pass',
        database='kayak_core',
        port=3306,
        cursorclass=pymysql.cursors.DictCursor
    )
    with conn.cursor() as cursor:
        cursor.execute("""
            SELECT b.id, b.booking_reference, b.total_amount, u.email 
            FROM bookings b 
            JOIN users u ON b.user_id = u.id 
            WHERE u.email = 'akshay.menon@usa.com' 
            ORDER BY b.created_at DESC LIMIT 1
        """)
        rec = cursor.fetchone()
        if rec:
            print(f"\n✅ VERIFICATION SUCCESS: Booking Found!\nRef: {rec['booking_reference']} | Amount: ${rec['total_amount']}")
        else:
             print("\n❌ VERIFICATION FAILED: No booking found for user.")
    conn.close()
except Exception as e:
    print(f"Verification Error: {e}")
