import asyncio
import websockets
import json

async def test_websocket():
    uri = "ws://127.0.0.1:8001/ws/concierge/test-client-python"
    print(f"Connecting to {uri}...")
    
    try:
        async with websockets.connect(uri) as websocket:
            print("✅ Connected successfully!")
            
            # Send auth token
            await websocket.send("AUTH_TOKEN:fake-token-for-testing")
            print("📤 Sent AUTH_TOKEN")
            
            # Wait a moment
            await asyncio.sleep(1)
            
            # Send test message
            await websocket.send("Hello from Python!")
            print("📤 Sent test message")
            
            # Try to receive response
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                print(f"📥 Received: {response}")
            except asyncio.TimeoutError:
                print("⏱️ No response received within 5 seconds")
                
    except Exception as e:
        print(f"❌ Connection Failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_websocket())
