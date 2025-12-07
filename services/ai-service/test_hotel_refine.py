from app.agents.concierge_agent import ConciergeAgent
from app.agents.deals_agent import deals_agent
import asyncio

async def test_fresh_search():
    agent = ConciergeAgent()
    print("🤖 Agent Instantiated")
    
    # 1. State: User has already searched for Mumbai
    agent.current_context = {"destination": "Mumbai", "budget": 2000, "dates": "Dec 25"}
    
    # 2. Refine Intent: "How about hotels?"
    print("\n--- Step 1: User says 'How about hotels?' ---")
    
    # We expect this to TRIGGER a fresh search via DealsAgent
    # To verify, we'll check if the output includes our Seeded hotel
    # (Since DealsAgent reads from DB, it should find 'Mumbai' hotel)
    
    resp = agent.process_message("How about hotels?")
    print(f"Agent: {resp}")
    
    if "🏨" in resp and "$" in resp:
        print("✅ PASSED: Returned Hotel Results.")
    else:
        print("❌ FAIL: No hotels returned.")
        
    # verify last_recommendations are only hotels
    if all(r['type'] == 'Hotel' for r in agent.last_recommendations):
         print("✅ PASSED: Context updated with ONLY hotels.")
    else:
         print("❌ FAIL: Context contains non-hotels.")

if __name__ == "__main__":
    asyncio.run(test_fresh_search())
