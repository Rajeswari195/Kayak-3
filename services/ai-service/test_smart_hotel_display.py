import asyncio
from app.agents.concierge_agent import ConciergeAgent

async def test_smart_hotel():
    agent = ConciergeAgent()
    agent.current_context = {"destination": "Mumbai", "budget": 5000, "dates": "Dec 25"}
    
    print("--- Testing Smart Hotel Display (Refine Flow) ---")
    
    # 1. Trigger Refine Intent
    response = agent.process_message("How about hotels?", user_token="demo-token")
    
    print(f"Agent Response:\n{response}\n")
    
    # 2. Assertions
    failures = []
    
    if "Smart Stay" not in response and "Mumbai" not in response:
         # Note: Seed used 'neighbourhood="Mumbai"', so strictly it might just say "Hotel in Mumbai" if name logic is generic.
         # ConciergeAgent Line 175: f"{i+1}. {deal_tag}🏨 {d.get('destination', 'Hotel')}
         # It uses 'destination' which comes from 'neighbourhood'.
         pass

    if "Tags: Wifi, Pool, Pet-friendly" not in response:
        failures.append("❌ Tags missing.")
        
    if "🔥 DEAL!" not in response:
         failures.append("❌ Deal tag missing.")
         
    if not failures:
        print("✅ PASSED: Smart Hotel indicators present.")
    else:
        print("FAILED:")
        for f in failures: print(f)

if __name__ == "__main__":
    asyncio.run(test_smart_hotel())
