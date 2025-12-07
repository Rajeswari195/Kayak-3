import json
from app.agents.concierge_agent import ConciergeAgent

def run_pilot():
    print("🚀 STARTED: Pilot Run - Smart Agent (Headless)")
    agent = ConciergeAgent()
    
    # helper to simulate user turn
    def user_turn(msg):
        print(f"\n👤 User: {msg}")
        resp = agent.process_message(msg)
        try:
            data = json.loads(resp)
            print(f"🤖 Agent: {data['text']}")
            if data.get('actions'):
                 print(f"   [Chips]: {data['actions']}")
            return data
        except:
            # Fallback for plain text (Final results usually)
            print(f"🤖 Agent: {resp[:100]}...")
            return {"text": resp}

    # Flow 1: "Plan a trip" (Missing everything)
    res = user_turn("Plan a trip")
    assert "Where are we going?" in res['text']
    # Chips Removed as per user request
    # assert len(res['actions']) > 0
    
    # Flow 2: "Mumbai" (User clicks chip or types)
    res = user_turn("Mumbai")
    assert "When" in res['text']
    
    # Flow 3: "In 2 weeks" (Implicit date, previously failed)
    res = user_turn("In 2 weeks")
    assert "Where will you be flying from" in res['text']

    # Flow 4: "Delhi" (Implicit Origin, previously failed or confused with Dest)
    res = user_turn("Delhi")
    assert "How many people" in res['text']
    
    # Flow 5: "2" (Implicit number)
    res = user_turn("2")
    # Should now trigger search and return results (plain text usually)
    # Result format: "1. ✈️ Vistara..."
    print(f"Final Response: {res['text'][:200]}...")
    assert "✈️" in res['text'] or "Vistara" in res['text'] or "Mumbai" in res['text']
    
    print("\n✅ PILOT PASSED: Full conversational loop completed successfully.")

if __name__ == "__main__":
    run_pilot()
