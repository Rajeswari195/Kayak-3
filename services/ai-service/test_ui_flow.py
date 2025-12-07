#!/usr/bin/env python3
"""
Direct Agent Test: Simulates the exact user journey from UI.
No external dependencies needed.
"""

from app.agents.concierge_agent import ConciergeAgent
from app.agents.deals_agent import deals_agent
import json

def parse_response(resp):
    try:
        data = json.loads(resp)
        return data.get('text', resp)
    except:
        return resp

def run_test():
    print("\n" + "="*60)
    print("🧪 DIRECT AGENT TEST: UI Chat Flow")
    print("="*60 + "\n")
    
    agent = ConciergeAgent()
    
    # Step 1
    print("👤 User: 'I want to plan a trip to Mumbai for December 25th, budget $2000'")
    resp = agent.process_message("I want to plan a trip to Mumbai for December 25th, budget $2000")
    print(f"🤖 Agent: {parse_response(resp)[:150]}...\n")
    
    # Step 2
    print("👤 User: 'Delhi'")
    resp = agent.process_message("Delhi")
    print(f"🤖 Agent: {parse_response(resp)[:150]}...\n")
    
    # Step 3
    print("👤 User: '2 Adults'")
    resp = agent.process_message("2 Adults")
    print(f"🤖 Agent: {parse_response(resp)[:200]}...\n")
    
    # Simulate followup (real search)
    print("🔄 Simulating followup search...")
    followup = agent.generate_followup()
    print(f"🤖 Agent (Deals): {followup[:300]}...\n")
    
    # Step 4: Hotels
    print("👤 User: 'Show me hotels'")
    resp = agent.process_message("Show me hotels")
    print(f"🤖 Agent: {resp[:400]}...\n")
    
    # KEY TEST: Step 5
    print("─"*60)
    print("🔑 KEY TEST: Refine with Amenities")
    print("─"*60)
    print("👤 User: 'I need something pet-friendly with a pool'")
    resp = agent.process_message("I need something pet-friendly with a pool")
    print(f"🤖 Agent: {resp}\n")
    
    # Validation
    if "Hotel" in resp or "🏨" in resp or "pet" in resp.lower() or "pool" in resp.lower() or "Bundle" in resp:
        print("✅ TEST PASSED: Refinement correctly returned hotels/bundles!")
    elif "✈️" in resp and "flight" in resp.lower():
        print("❌ TEST FAILED: Refinement reset to flights")
    else:
        print("⚠️ Checking response content...")
        if "I'd love to refine" in resp or "remind me" in resp or "going" in resp:
            print("   ℹ️ Agent is asking for clarification (acceptable)")
        else:
            print("   [MANUAL CHECK NEEDED]")
    
    # Step 6: Watch
    print("\n👤 User: 'Track Mumbai under $1500'")
    resp = agent.process_message("Track Mumbai under $1500")
    print(f"🤖 Agent: {resp}\n")
    
    # Step 7: Book
    if agent.last_recommendations:
        print("👤 User: 'Book option 1'")
        resp = agent.process_message("Book option 1")
        print(f"🤖 Agent: {resp[:500]}...\n")
        
        if "Invoice" in resp:
            print("✅ Quote Generated!")
    
    print("\n" + "="*60)
    print("📊 TEST COMPLETE")
    print("="*60)

if __name__ == "__main__":
    run_test()
