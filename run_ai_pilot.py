
import asyncio
import websockets
import json
import sys

# Token for akshay.menon
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxYmIwMWFhNy1iNmE0LTQ0ZDAtOGQ1NC1lNmRhZDBjZDg4ZDAiLCJlbWFpbCI6ImFrc2hheS5tZW5vbkB1c2EuY29tIiwicm9sZSI6InVzZXIiLCJpYXQiOjE3NjUwOTk2NTMsImV4cCI6MTc2NTEwMzI1M30.zUiv01JLpPW_vrQNPlnpT1mROhAULcOmmxCZVN8rpD4"

URI = "ws://localhost:8001/ws/123"

async def test_ai_pilot():
    try:
        async with websockets.connect(URI) as websocket:
            print(" Connected to AI Service WebSocket.")

            # 1. Send Auth Token
            print(f" Sending Auth Token...")
            await websocket.send(f"AUTH_TOKEN:{TOKEN}")

            # 2. Send Bundle Request
            msg = "Show me bundles for Mumbai"
            print(f" Sending User Message: '{msg}'")
            await websocket.send(msg)

            # 3. Listen for responses
            print(" Listening for Agent responses...")
            while True:
                try:
                    response = await asyncio.wait_for(websocket.recv(), timeout=20.0)
                    print(f" Agent says: {response}")
                    
                    if "confirmed" in response.lower() or "booked" in response.lower():
                        print(" SUCCESS: Booking seems confirmed by Agent!")
                        break
                    if "clarification" in response.lower() or "which" in response.lower():
                         # Simple slot filling response if needed
                         print(" Providing clarification...")
                         await websocket.send("Any option is fine. Just book it.")
                except asyncio.TimeoutError:
                    print(" Timeout waiting for response.")
                    break
    except Exception as e:
        print(f" WebSocket Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_ai_pilot())
