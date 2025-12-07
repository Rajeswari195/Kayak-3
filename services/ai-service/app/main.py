"""
@file main.py
@description
Entry point for the FastAPI-based Agentic AI Recommendation Service.

Responsibilities (at this step):
- Instantiate a minimal FastAPI application.
- Expose a basic health-check endpoint to verify that the service is up and
  reachable when run via uvicorn (`npm run dev` or `npm start` scripts in
  services/ai-service/package.json).

Responsibilities (future steps):
- Load configuration from environment variables using a Pydantic BaseSettings
  class (to be implemented in a separate config module).
- Initialize a SQLModel engine and create tables in a local SQLite database
  for deals, routes, and watch rules.
- Register HTTP routers for bundle recommendations (`/bundles`) and watch
  management (`/watches`).
- Register a WebSocket endpoint (`/events`) for real-time watched-deal
  notifications.
- Integrate Kafka consumers for the deals pipeline topics
  (raw_supplier_feeds, deals.normalized, deals.scored, deals.tagged, deal.events).

Assumptions:
- This file is executed via uvicorn with the import path `app.main:app`
  from within the `services/ai-service` directory.
- Python dependencies such as fastapi and uvicorn are installed in the
  active environment (e.g., via requirements.txt or pyproject.toml).

Notes:
- The health-check implemented here is intentionally simple: it only confirms
  that the HTTP server is responsive. Deep dependency checks (SQLite, Kafka)
  will be added in later steps.
"""

# BEGIN WRITING FILE CODE



from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.services.data_ingestion import ingest_data
from datetime import datetime, timezone
import asyncio
import json

from app.agents.deals_agent import deals_agent

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run data ingestion on startup
    try:
        ingest_data()
    except Exception as e:
        print(f"Data ingestion failed: {e}")
        
    # Start Deals Agent (Kafka)
    try:
        await deals_agent.start()
        # Start Alert Listener
        asyncio.create_task(consume_and_notify())
    except Exception as e:
        print(f"Failed to start Deals Agent: {e}")

    yield
    
    # Cleanup
    await deals_agent.stop()

app = FastAPI(
    title="Kayak AI Recommendation Service",
    description=(
        "Agentic AI microservice responsible for deal ingestion, scoring, tagging, "
        "and concierge-style bundle recommendations for the Kayak-like travel platform."
    ),
    version="0.1.0",
    lifespan=lifespan
)

async def consume_and_notify():
    """
    Consumes deal.events and notifies users if matches Watch list.
    """
    from aiokafka import AIOKafkaConsumer
    from app.agents.deals_agent import KAFKA_BOOTSTRAP_SERVERS
    from sqlmodel import Session, select
    from app.database import engine
    from app.models import Watch

    consumer = AIOKafkaConsumer(
        "deal.events",
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        group_id="alert_service_group"
    )
    await consumer.start()
    try:
        async for msg in consumer:
            event = json.loads(msg.value.decode('utf-8'))
            print(f"DEBUG: Alert Listener received: {event.get('destination')}")
            
            # Check Watches
            with Session(engine) as session:
                watches = session.exec(select(Watch).where(
                    Watch.destination == event.get('destination'),
                    Watch.is_active == True,
                    Watch.target_price >= float(event.get('price', 0))
                )).all()
                
                for w in watches:
                    alert_msg = f"🔔 **Price Alert!**\nA deal for **{w.destination}** just dropped found: ${event['price']}! (Your target: ${w.target_price})"
                    # Broadcast to all (MVP) - ideally target w.user_id
                    await manager.broadcast(alert_msg)
    except Exception as e:
        print(f"Alert Listener Failed: {e}")
    finally:
        await consumer.stop()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

@app.get("/", tags=["root"])
async def read_root() -> dict:
    return {
        "service": "ai-service",
        "status": "ok",
        "message": "Kayak AI Recommendation Service is running. Use /health to check basic service health."
    }

@app.get("/health", tags=["health"])
async def health_check() -> dict:
    return {
        "service": "ai-service",
        "status": "ok",
        "timestamp": datetime.now(timezone.utc),
    }

@app.get("/debug/stats", tags=["debug"])
async def debug_stats() -> dict:
    from sqlmodel import Session, select, func
    from app.database import engine
    from app.models import Listing, Flight
    
    with Session(engine) as session:
        listing_count = session.exec(select(func.count(Listing.id))).one()
        flight_count = session.exec(select(func.count(Flight.id))).one()
        
    return {
        "listings_count": listing_count,
        "flights_count": flight_count,
        "message": "Data ingestion verified"
    }

@app.get("/bundles", tags=["recommendations"])
async def get_bundles(destination: str, origin: str = None, date: str = None, budget: float = None, amenities: str = None) -> list:
    """
    Get Flight+Hotel bundles with Intelligent Fit Score.
    amenities: Comma-separated list of keywords.
    """
    amt_list = amenities.split(",") if amenities else None
    return deals_agent.create_bundles(destination, origin, date, budget, amt_list)

@app.websocket("/ws/concierge/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket)
    try:
        # Import inside the endpoint to avoid circular import issues if any
        # Import inside the endpoint to avoid circular import issues if any
        from app.agents.concierge_agent import ConciergeAgent
        agent = ConciergeAgent() # New instance per connection for session safety
        
        # Keep track of the idle task
        idle_task = None
        user_token = None # Store JWT for this session

        while True:
            data = await websocket.receive_text()
            
            # Handle Auth Token Handshake
            if data.startswith("AUTH_TOKEN:"):
                user_token = data.split("AUTH_TOKEN:")[1]
                print(f"DEBUG: Received auth token for client {client_id}")
                continue # Skip processing this as a chat message

            # Cancel existing idle task if any
            if idle_task:
                idle_task.cancel()
                
            response = agent.process_message(data, user_token=user_token) # Pass token to agent
            
            # Check for [WAIT] tag
            if "[WAIT]" in response:
                # Remove tag from message sent to user
                clean_response = response.replace("[WAIT]", "").strip()
                await manager.broadcast(clean_response)
                
                # Schedule follow-up (Proactive)
                async def send_followup():
                    await asyncio.sleep(20) # Simulated "Searching" delay as requested (20-30s)
                    followup_msg = agent.generate_followup()
                    await manager.broadcast(followup_msg)
                
                asyncio.create_task(send_followup())
            else:
                await manager.broadcast(response)
                
                # Schedule Nudge (Idle Timer)
                async def send_nudge():
                    try:
                        await asyncio.sleep(90) # Wait 90 seconds for user input
                        nudge_msg = agent.generate_nudge()
                        await manager.broadcast(nudge_msg)
                    except asyncio.CancelledError:
                        pass # Task was cancelled because user replied

                idle_task = asyncio.create_task(send_nudge())
    except WebSocketDisconnect:
        manager.disconnect(websocket)
