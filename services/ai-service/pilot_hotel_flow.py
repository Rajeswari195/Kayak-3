from app.agents.concierge_agent import ConciergeAgent
import json
import time

def run_pilot():
    agent = ConciergeAgent()
    print("🚀 STARTED: Pilot Run - Hotel Flow")

    def user_turn(msg):
        print(f"\n👤 User: {msg}")
        resp = agent.process_message(msg)
        try:
            r = json.loads(resp)
            text = r["text"]
            actions = r.get("actions", [])
        except:
            text = resp
            actions = []
            
        print(f"🤖 Agent: {text}")
        if actions:
            print(f"   [Chips]: {actions}")
        
        return {"text": text, "actions": actions}

    # 1. Start Hotel Search
    res = user_turn("Find me a hotel in Goa")
    assert "When are you planning to check in" in res['text']
    
    # 2. Provide Check-in
    res = user_turn("January 10th 2026")
    assert "when will you be checking out" in res['text']
    
    # 3. Provide Nights (Implicit Check-out)
    res = user_turn("3 nights")
    # Should trigger search
    print(f"Final Response: {res['text'][:200]}...")
    
    # Verify Context
    print(f"\nCTX Check-In: {agent.current_context['check_in']}")
    print(f"CTX Check-Out: {agent.current_context['check_out']}")
    print(f"CTX Nights: {agent.current_context['nights']}")
    
    assert agent.current_context['check_in'] == "2026-01-10"
    assert agent.current_context['check_out'] == "2026-01-13" # 10 + 3
    print("\n✅ HOTEL FLOW PILOT PASSED")

if __name__ == "__main__":
    run_pilot()
