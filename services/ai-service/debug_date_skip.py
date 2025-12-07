from app.agents.concierge_agent import ConciergeAgent, SimpleNLU

def debug_issue():
    print("--- Debugging Date Skip Issue ---")
    
    # 1. Check NLU Extraction
    nlu = SimpleNLU()
    msg = "Plan a trip to Mumbai"
    extracted = nlu.extract(msg)
    print(f"Input: '{msg}'")
    print(f"Extracted: {extracted}")
    
    if extracted.get("dates"):
        print("🚨 ALARM: Dates extracted non-empty! This causes the skip.")
    else:
        print("✅ Dates not extracted by NLU (Correct).")

    # 2. Check Agent Flow
    agent = ConciergeAgent()
    print(f"\nInitial Ctx: {agent.current_context}")
    
    resp = agent.process_message(msg)
    print(f"Agent Resp: {resp[:100]}...")
    
    print(f"Post-Resp Ctx: {agent.current_context}")
    
    if "When" not in resp:
        print("🚨 ALARM: Agent DID NOT ask 'When'.")
        if agent.current_context.get("dates"):
            print(f"Reason: Date already set to '{agent.current_context['dates']}'")
        elif agent.last_recommendations:
            print("Reason: last_recommendations not empty?!")
    else:
        print("✅ Agent correctly asked 'When'.")

if __name__ == "__main__":
    debug_issue()
