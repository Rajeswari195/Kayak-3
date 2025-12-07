from app.agents.concierge_agent import ConciergeAgent
import asyncio

async def test_refine():
    agent = ConciergeAgent()
    print("🤖 Agent Instantiated")
    
    # 1. Simulate Search State
    agent.current_context = {"destination": "Mumbai", "budget": 2000, "dates": "Dec 25"}
    # Manually populate recommendations with mixed Types based on real seeded data logic
    agent.last_recommendations = [
        {"type": "Flight", "airline": "SpiceJet", "price": 500, "destination": "Mumbai"},
        {"type": "Flight", "airline": "AirAsia", "price": 550, "destination": "Mumbai"},
        {"type": "Hotel", "destination": "Mumbai", "price": 250, "id": "TEST_H_1"}
    ]
    
    print("\n--- Step 1: User says 'How about hotels?' ---")
    resp = agent.process_message("How about hotels?")
    print(f"Agent: {resp}")
    
    if "🏨" in resp and "SpiceJet" not in resp:
        print("✅ PASSED: Filtered to Hotels only.")
    else:
        print("❌ FAIL: Did not filter correctly.")

    print("\n--- Step 2: Check Deal Tags ---")
    # Force generate_followup with a cheap item
    agent.last_recommendations.append({"type": "Hotel", "destination": "Cheap Stay", "price": 100, "id": "DEAL_1"})
    followup = agent.generate_followup()
    print(f"Followup Output:\n{followup}")
    
    if "🔥 DEAL!" in followup:
         print("✅ PASSED: Deal Tag visible for < $300 item.")
    else:
         print("❌ FAIL: Deal Tag missing.")

if __name__ == "__main__":
    asyncio.run(test_refine())
