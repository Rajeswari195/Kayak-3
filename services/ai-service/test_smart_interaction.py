import json
from app.agents.concierge_agent import ConciergeAgent

def test_flow():
    agent = ConciergeAgent()
    print("--- Testing Conversation Flow ---")
    
    # 1. Start Search (Missing everything)
    resp = agent.process_message("Plan a trip")
    print(f"User: Plan a trip\nAgent: {resp}")
    
    data = json.loads(resp)
    if "Where are we going?" in data["text"] and "actions" in data:
        print("✅ Correctly asked for Destination.")
    else:
        print("❌ Failed to ask for destination.")
        
    # 2. Provide Dest (Missing Date)
    resp = agent.process_message("Trip to Paris")
    data = json.loads(resp)
    print(f"User: Trip to Paris\nAgent: {data['text']}")
    
    if "When" in data["text"]:
        print("✅ Correctly asked for Date.")
    else:
         print("❌ Failed to ask for Date.")

    # 3. Provide Date (Missing Origin)
    # Using 'from London' might satisfy origin, so just providing date
    # agent.current_context['dates'] = 'Dec 25' # Manually injecting or via message
    resp = agent.process_message("in December")
    data = json.loads(resp)
    print(f"User: in December\nAgent: {data['text']}")
    
    if "Where will you be flying from" in data["text"]:
        print("✅ Correctly asked for Origin.")
    else:
         print("❌ Failed to ask for Origin (might have skipped or defaulted).")

if __name__ == "__main__":
    test_flow()
