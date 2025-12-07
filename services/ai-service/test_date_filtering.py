from app.agents.concierge_agent import ConciergeAgent
import asyncio

async def test_date_filter():
    agent = ConciergeAgent()
    print("🤖 Agent Instantiated")
    
    # Test 1: Exact Match (Dec 25)
    print("\n--- Test 1: Search for 'Mumbai' on 'Dec 25' ---")
    agent.current_context = {"destination": "Mumbai", "budget": 5000, "dates": "Dec 25"}
    
    # We force the call that happens inside generate_followup or refine
    # But easier to simulate the NLU -> Search flow
    # We can just check deals_agent directly via the agent's internal logic or call generate_followup
    # Let's populate last_recommendations manually using the same call Concierge would make
    
    from app.agents.deals_agent import deals_agent
    recs = deals_agent.get_recommendations(destination="Mumbai", budget=5000, date="Dec 25")
    
    found_santa = False
    for r in recs:
        print(f"   Shape: {r.get('airline')} - {r.get('departure_time')}")
        if r.get('airline') == "Santa Air" and "12-25" in str(r.get('departure_time')):
             found_santa = True
             
    if found_santa:
        print("✅ PASSED: Found Santa Air on Dec 25.")
    else:
        print("❌ FAIL: Did not find Santa Air.")

    # Test 2: Fallback (Date with no flights)
    print("\n--- Test 2: Search for 'Mumbai' on 'Oct 11' (No flights) ---")
    recs_fallback = deals_agent.get_recommendations(destination="Mumbai", budget=5000, date="Oct 11")
    
    if recs_fallback:
        print(f"✅ PASSED: Fallback returned {len(recs_fallback)} results despite no exact match.")
        print(f"   First result: {recs_fallback[0].get('departure_time')}")
    else:
        print("❌ FAIL: Fallback returned nothing.")

if __name__ == "__main__":
    asyncio.run(test_date_filter())
