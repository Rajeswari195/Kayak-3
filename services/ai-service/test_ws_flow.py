#!/usr/bin/env python3
"""
Test Script: Simulates WebSocket interaction as the frontend does.
Run this while the AI service is running (npm run dev in ai-service).
"""

import asyncio
import websockets
import json

async def test_refinement_flow():
    uri = "ws://localhost:8000/ws/999"  # Client ID 999 for test
    
    print("\n" + "="*60)
    print("🧪 CURL-EQUIVALENT TEST: WebSocket Chat Flow")
    print("="*60 + "\n")
    
    async with websockets.connect(uri) as ws:
        
        # Step 1: Initial Search
        print("👤 User: 'I want to plan a trip to Mumbai for December 25th, budget $2000'")
        await ws.send("I want to plan a trip to Mumbai for December 25th, budget $2000")
        resp = await ws.recv()
        print(f"🤖 Agent: {resp[:200]}...\n")
        
        # Step 2: Origin
        print("👤 User: 'Delhi'")
        await ws.send("Delhi")
        resp = await ws.recv()
        print(f"🤖 Agent: {resp[:200]}...\n")
        
        # Step 3: Travelers
        print("👤 User: '2 Adults'")
        await ws.send("2 Adults")
        resp = await ws.recv()
        print(f"🤖 Agent: {resp[:300]}...\n")
        
        # Wait for async followup (Deals)
        try:
            followup = await asyncio.wait_for(ws.recv(), timeout=25)
            print(f"🤖 Agent (Followup): {followup[:400]}...\n")
        except asyncio.TimeoutError:
            print("⏱️ No followup received in 25s\n")
        
        # Step 4: Show Hotels
        print("👤 User: 'Show me hotels'")
        await ws.send("Show me hotels")
        resp = await ws.recv()
        print(f"🤖 Agent: {resp[:500]}...\n")
        
        # KEY TEST: Step 5 - Refine with Amenities
        print("─"*60)
        print("🔑 KEY TEST: Refine with amenities (should NOT reset to flights)")
        print("─"*60)
        print("👤 User: 'I need something pet-friendly with a pool'")
        await ws.send("I need something pet-friendly with a pool")
        resp = await ws.recv()
        print(f"🤖 Agent: {resp}\n")
        
        # Validation
        if "Hotel" in resp or "🏨" in resp or "pet" in resp.lower() or "pool" in resp.lower():
            print("✅ TEST PASSED: Refinement triggered Hotel filter (not flights)")
        elif "✈️" in resp or "flight" in resp.lower():
            print("❌ TEST FAILED: Refinement reset to flights instead of filtering hotels")
        else:
            print("⚠️ UNCLEAR: Check response manually")
        
        # Step 6: Watch
        print("\n👤 User: 'Track Mumbai under $1500'")
        await ws.send("Track Mumbai under $1500")
        resp = await ws.recv()
        print(f"🤖 Agent: {resp}\n")
        
        if "Watch" in resp or "👀" in resp:
            print("✅ Watch Set!")
        else:
            print("⚠️ Watch may not have triggered")
        
        # Step 7: Book
        print("\n👤 User: 'Book option 1'")
        await ws.send("Book option 1")
        resp = await ws.recv()
        print(f"🤖 Agent: {resp}\n")
        
        if "Invoice" in resp or "Confirmed" in resp:
            print("✅ Booking Quote Generated!")
        else:
            print("⚠️ Quote may be missing")

    print("\n" + "="*60)
    print("📊 TEST COMPLETE")
    print("="*60)

if __name__ == "__main__":
    asyncio.run(test_refinement_flow())
