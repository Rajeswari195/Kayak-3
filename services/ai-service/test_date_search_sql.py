from app.agents.deals_agent import deals_agent
from datetime import datetime

def test_search():
    print("--- Testing Deals Agent Date Search ---")
    
    # 1. Test Seed Date (Should Find Result)
    # Assuming Dec 25 seed exists or fallsback to Dec flights
    print("\nTest 1: Search for '2025-12-07' (Known Date)")
    res1 = deals_agent.get_recommendations(destination="Mumbai", date="2025-12-07")
    if res1:
        print(f"✅ Found {len(res1)} flights.")
        print(f"   Date: {res1[0]['departure_time']}")
    else:
        print("⚠️ No flights found for seed date.")

    # 2. Test Future Date (Should Find 0 or Fallback)
    print("\nTest 2: Search for '2026-01-03'")
    res2 = deals_agent.get_recommendations(destination="Mumbai", date="2026-01-03")
    if not res2:
        print("✅ Correctly found 0 flights (as 2026 data shouldn't exist).")
    else:
        # If it found something, check if it's the fallback
        print(f"⚠️ Found {len(res2)} flights via Fallback?")
        print(f"   Date: {res2[0]['departure_time']}")

if __name__ == "__main__":
    test_search()
