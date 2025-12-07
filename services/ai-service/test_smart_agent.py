#!/usr/bin/env python3
"""
Test: Smarter Agent Flow - Bundle and Combine
"""

from app.agents.concierge_agent import ConciergeAgent
from app.agents.deals_agent import deals_agent

def run_test():
    print("\n" + "="*60)
    print("🧪 TEST: Smarter Agent - Bundles & Custom Combine")
    print("="*60 + "\n")
    
    agent = ConciergeAgent()
    
    # Set context
    agent.current_context["destination"] = "Mumbai"
    agent.current_context["dates"] = "december 25th"
    agent.current_context["budget"] = 2000
    agent.current_context["travelers"] = 2
    
    # TEST 1: Show Bundle (Rich Format)
    print("─"*60)
    print("TEST 1: 'Show me bundles'")
    print("─"*60)
    resp = agent.process_message("Show me bundles")
    print(f"🤖 Agent:\n{resp[:800]}...\n")
    
    if "Fit Score" in resp and "Policies" in resp:
        print("✅ Rich Bundle Format Works!")
    else:
        print("❌ Missing rich details")
    
    # TEST 2: Show Hotels (should NOT reset)
    print("─"*60)
    print("TEST 2: 'Show me hotels' (should NOT reset to flights)")
    print("─"*60)
    resp = agent.process_message("Show me hotels")
    print(f"🤖 Agent:\n{resp[:400]}...\n")
    
    if "Hotel" in resp or "🏨" in resp:
        print("✅ Hotels shown correctly!")
    else:
        print("❌ Flow reset issue")
    
    # TEST 3: Show Bundle AGAIN (should show bundles, not search)
    print("─"*60)
    print("TEST 3: 'Show bundles again' (should show bundles)")
    print("─"*60)
    resp = agent.process_message("Show bundles again")
    print(f"🤖 Agent:\n{resp[:800]}...\n")
    
    if "Bundle" in resp:
        print("✅ Bundle re-shown correctly!")
    else:
        print("❌ Bundle flow broken")
    
    # TEST 4: Combine (Custom Bundle)
    print("─"*60)
    print("TEST 4: 'Combine flight 1 with hotel 2'")
    print("─"*60)
    
    # First load flights and hotels into recommendations
    flights = deals_agent.get_recommendations(destination="Mumbai", category="Flight")
    hotels = deals_agent.get_recommendations(destination="Mumbai", category="Hotel")
    agent.last_recommendations = flights[:5] + hotels[:5]
    
    resp = agent.process_message("Combine flight 1 with hotel 2")
    print(f"🤖 Agent:\n{resp}\n")
    
    if "Custom Bundle" in resp:
        print("✅ Custom Bundle Created!")
    else:
        print("❌ Combine failed")
    
    print("\n" + "="*60)
    print("📊 TEST COMPLETE")
    print("="*60)

if __name__ == "__main__":
    run_test()
