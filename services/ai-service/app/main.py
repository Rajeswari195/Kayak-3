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

from fastapi import FastAPI
from datetime import datetime, timezone

# Instantiate the FastAPI app with some basic metadata.
app = FastAPI(
    title="Kayak AI Recommendation Service",
    description=(
        "Agentic AI microservice responsible for deal ingestion, scoring, tagging, "
        "and concierge-style bundle recommendations for the Kayak-like travel platform."
    ),
    version="0.1.0",
)


@app.get("/", tags=["root"])
async def read_root() -> dict:
    """
    Root endpoint.

    Returns:
        dict: A simple JSON response advertising the service and suggesting the
        `/health` endpoint for health checks.

    Behavior:
        - Provides a stable, human-readable message confirming that the service
          is running.
        - Can be used as a smoke test or to quickly confirm routing.
    """
    return {
        "service": "ai-service",
        "status": "ok",
        "message": (
            "Kayak AI Recommendation Service is running. "
            "Use /health to check basic service health."
        ),
    }


@app.get("/health", tags=["health"])
async def health_check() -> dict:
    """
    Health-check endpoint.

    Returns:
        dict: A JSON payload containing:
            - service: name of the service.
            - status: high-level status ("ok" when HTTP is responsive).
            - timestamp: current UTC timestamp in ISO 8601 format.

    Notes:
        - This endpoint currently checks only the FastAPI application itself.
          Future enhancements will extend this to report the status of:
            * SQLite/SQLModel connection
            * Kafka connectivity
            * Internal background workers
    """
    now_utc = datetime.now(timezone.utc).isoformat()
    return {
        "service": "ai-service",
        "status": "ok",
        "timestamp": now_utc,
    }


# The `app` object is what uvicorn will use as the ASGI application.
# Example command from services/ai-service directory:
#   uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
