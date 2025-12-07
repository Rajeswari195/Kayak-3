
import asyncio
import websockets
import jwt
import json
import time

# Config
USER_ID = "388fd5e4-1cf0-4bd2-85fe-c1e121278bd9"
EMAIL = "rahul.pillai@ca.com"
SECRET = "replace-with-a-long-random-secret-value"
WS_URL = f"ws://localhost:8001/ws/concierge/{EMAIL}"

def generate_token():
    payload = {
        "id": USER_ID,
        "email": EMAIL,
        "role": "USER",
        "exp": time.time() + 3600
    }
    return jwt.encode(payload, SECRET, algorithm="HS256")

async def test_booking():
    token = generate_token()
    uri = f"{WS_URL}?token={token}"
    print(f"Connecting to {uri}")
    
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected!")
            
            # 0. Send Auth Token
            auth_msg = f"AUTH_TOKEN:{token}"
            print(f"> {auth_msg}")
            await websocket.send(auth_msg)
            
            # 1. Send Context
            msg1 = "Plan a trip to Mumbai for Jan 10 2026"
            print(f"> {msg1}")
            await websocket.send(msg1)
            
            # Read responses
            while True:
                try:
                    resp = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                    print(f"< {resp}")
                    data = json.loads(resp)
                    if "chips" in data and "2 Adults" in str(data):
                        # Trigger Bundle
                        break
                except asyncio.TimeoutError:
                    print("Timeout waiting for response 1")
                    break

            # 2. Book Bundle
            # Note: In the real flow, user clicks a chip or types.
            # I will send "Book Bundle 2" directly as previous context allows it?
            # Wait, I need to send "Origin: New York" first perhaps?
            # The agent might need origin.
            
            # 2. Origin
            msg2 = "Origin: New York"
            print(f"> {msg2}")
            await websocket.send(msg2)
             # Read responses
            while True:
                try:
                    resp = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                    print(f"< {resp}")
                    if "How many people" in str(resp):
                        break
                except asyncio.TimeoutError:
                     break
            
            # 3. Answer "2 Adults"
            msg3 = "2 Adults"
            print(f"> {msg3}")
            await websocket.send(msg3)
            
            # Wait for Results
            while True:
                try:
                    resp = await asyncio.wait_for(websocket.recv(), timeout=20.0)
                    print(f"< {resp}")
                    # Look for "Here are the top deals" or option list
                    if "Here are the top deals" in str(resp) or "1." in str(resp):
                        print("Results received!")
                        break
                except asyncio.TimeoutError:
                    print("Timeout waiting for results")
                    break

            # 4. Book Bundle 2
            msg4 = "Book Bundle 2"
            print(f"> {msg4}")
            await websocket.send(msg4)
            
            # Read confirmation
            while True:
                try:
                    resp = await asyncio.wait_for(websocket.recv(), timeout=20.0)
                    print(f"< {resp}")
                    if "confirmed" in resp.lower() or "booked" in resp.lower():
                        print("SUCCESS: Booking confirmed message received!")
                        return
                except asyncio.TimeoutError:
                    print("Timeout waiting for booking confirmation")
                    break
                    
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_booking())
