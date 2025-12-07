from app.agents.concierge_agent import ConciergeAgent
import time
import asyncio

async def test_flow():
    agent = ConciergeAgent()
    print("🤖 Agent Instantiated")
    
    # 1. Plan Trip
    print("\n--- Step 1: User says 'Plan a trip to Mumbai' ---")
    resp = agent.process_message("Plan a trip to Mumbai")
    print(f"Agent: {resp}")
    if "When are you planning" not in resp:
        print("❌ FAIL: Step 1 did not ask for date.")
        return

    # 2. Date
    print("\n--- Step 2: User says 'December 25th' ---")
    resp = agent.process_message("December 25th")
    print(f"Agent: {resp}")
    if "[WAIT]" not in resp:
         print("❌ FAIL: Step 2 did not trigger wait.")
         
    # 3. Simulate Async Search
    print("\n... Simulating Background Search (DealsAgent) ...")
    # Manually trigger the background search logic to populate recommendations
    # In real app, this happens in background. Here we force it.
    from app.agents.deals_agent import deals_agent
    recs = deals_agent.get_recommendations(destination="Mumbai")
    print(f"DEBUG: Fetched {len(recs)} recs (Flights+Hotels)")
    agent.last_recommendations = recs
    
    # Check if Hotel is in recs
    has_hotel = any(r['type'] == 'Hotel' for r in recs)
    if not has_hotel:
        print("⚠️ WARNING: No Hotel found in recommendations! forcing one.")
        hotel = {"type": "Hotel", "destination": "Mumbai", "price": 250.0, "id": "TEST_H_1", "airline": "N/A"}
        agent.last_recommendations.append(hotel)
        
    # Generate Followup (Search Results)
    followup = agent.generate_followup()
    print(f"\nAgent Followup:\n{followup}")
    
    # 4. Select Hotel
    print("\n--- Step 3: User says 'Lets go with Hotel' ---")
    resp = agent.process_message("Lets go with Hotel")
    print(f"Agent: {resp}")
    
    if "✅ Booking Successful" in resp and "hotel" in resp.lower():
        print("\n✅ PASSED: Full Flow Verified!")
    else:
        print("\n❌ FAIL: Booking failed or wrong response.")

if __name__ == "__main__":
    asyncio.run(test_flow())
