import asyncio
import websockets

async def test_connection():
    uri = "ws://127.0.0.1:8001/ws/concierge/test-client"
    print(f"Connecting to {uri}...")
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected successfully!")
            await websocket.send("Hello AI")
            response = await websocket.recv()
            print(f"Received: {response}")
    except Exception as e:
        print(f"Connection Failed: {e}")

asyncio.run(test_connection())
