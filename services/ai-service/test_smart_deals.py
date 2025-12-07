import asyncio
from app.agents.concierge_agent import ConciergeAgent
from app.agents.deals_agent import deals_agent

async def test_smart_deals():
    agent = ConciergeAgent()
    
    # 1. Setup Context
    agent.current_context = {
        "destination": "Mumbai",
        "budget": 5000,
        "dates": "Dec 25"
    }
    
    print("--- Testing Smart Deals Display ---")
    
    # 2. Call generate_followup (which calls DealsAgent and formats string)
    # We expect "Santa Air" to be returned because we seeded it for Dec 25
    response = agent.generate_followup()
    
    print(f"Agent Response:\n{response}\n")
    
    # 3. Assertions
    failures = []
    
    if "Santa Air" not in response:
        failures.append("❌ Flight 'Santa Air' not found in response.")
    
    if "Only 2 seats left!" not in response:
        failures.append("❌ Scarcity warning ('Only 2 seats left!') missing.")
        
    if "🔥 DEAL!" not in response:
         # Santa Air is 1200, threshold 300? 
         # Wait, is_promo=True should trigger it regardless of price.
         failures.append("❌ Deal tag ('🔥 DEAL!') missing.")
         
    if not failures:
        print("✅ PASSED: All smart deal indicators present.")
    else:
        print("FAILED:")
        for f in failures: print(f)

if __name__ == "__main__":
    asyncio.run(test_smart_deals())
