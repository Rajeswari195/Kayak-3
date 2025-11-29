"""
@file settings.py
@description
Configuration module for the FastAPI-based AI Recommendation Service.

Responsibilities:
- Define a Pydantic v2 `BaseSettings` subclass that reads configuration from
  environment variables and optional `.env` files.
- Normalize and validate settings such as:
    * Environment / log level
    * HTTP port
    * SQLite connection URL for SQLModel
    * Kafka brokers list
    * Optional tuning knobs (max bundles per request, max watches per user)
- Provide a single cached accessor (`get_settings`) that the rest of the
  application can use without repeatedly parsing environment variables.

Design notes:
- This module is intentionally side-effect free; importing it does NOT start
  the web server or touch external systems.
- Environment variables are documented in `services/ai-service/.env.example`.
- We use `pydantic-settings` (the Pydantic v2 settings integration) for
  convenient `.env` loading.

Usage:
    from app.config.settings import get_settings

    settings = get_settings()
    print(settings.kafka_brokers)

Assumptions:
- Python dependencies `pydantic>=2`, `pydantic-settings`, and `sqlmodel`
  will be installed in the active virtual environment.
"""

# BEGIN WRITING FILE CODE

from __future__ import annotations

from functools import lru_cache
from typing import List, Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Strongly-typed configuration model for the AI service.

    Attributes:
        env: Environment name, e.g., "development", "production", "test".
        log_level: Logging verbosity (e.g., "debug", "info", "warn", "error").
        ai_service_port: Port where the FastAPI app listens for HTTP/WebSocket.
        deals_sqlite_url: SQLAlchemy-style SQLite URL for SQLModel engine.
        kafka_brokers: List of Kafka broker addresses ("host:port").
        core_api_base_url: Optional reference to the core-api HTTP endpoint.
        max_bundles_per_request: Upper bound on bundles returned from /bundles.
        max_watches_per_user: Upper bound on active watches a user can register.

    Notes:
        - Many of these fields are mapped from upper-case env vars via `alias`.
        - Required fields (e.g., DEALS_SQLITE_URL, KAFKA_BROKERS) are defined
          without defaults so that misconfiguration fails fast at startup.
    """

    # Base model configuration:
    # - Read from `.env.local` and `.env` by default when present.
    # - Ignore unknown env variables instead of raising.
    model_config = SettingsConfigDict(
        env_file=(".env.local", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # General environment and logging
    env: str = Field(
        default="development",
        alias="ENV",
        description="Environment name (development, production, test, etc.).",
    )

    log_level: str = Field(
        default="info",
        alias="LOG_LEVEL",
        description="Logging verbosity level.",
    )

    # HTTP server configuration
    ai_service_port: int = Field(
        default=8001,
        alias="AI_SERVICE_PORT",
        description="Port on which the AI FastAPI app will listen.",
    )

    # SQLite / SQLModel connection string (required)
    deals_sqlite_url: str = Field(
        ...,
        alias="DEALS_SQLITE_URL",
        description="SQLAlchemy-style SQLite URL used by SQLModel.",
    )

    # Kafka configuration (required)
    kafka_brokers: List[str] = Field(
        ...,
        alias="KAFKA_BROKERS",
        description="List of Kafka broker addresses (host:port).",
    )

    # Optional pointer back to the core-api (if needed for cross-service calls)
    core_api_base_url: Optional[str] = Field(
        default=None,
        alias="CORE_API_BASE_URL",
        description="Base URL for the core-api service, if needed.",
    )

    # Tuning knobs
    max_bundles_per_request: int = Field(
        default=10,
        alias="MAX_BUNDLES_PER_REQUEST",
        description="Maximum number of bundles returned from /bundles.",
        ge=1,
        le=50,
    )

    max_watches_per_user: int = Field(
        default=50,
        alias="MAX_WATCHES_PER_USER",
        description="Maximum number of active watches per user.",
        ge=1,
        le=500,
    )

    @field_validator("kafka_brokers", mode="before")
    @classmethod
    def _split_kafka_brokers(cls, value) -> List[str]:
        """
        Normalize Kafka brokers into a list of strings.

        Accepts:
            - A comma-separated string: "localhost:9092,localhost:9093"
            - A single string: "localhost:9092"
            - A list/tuple of strings (returned unchanged after trimming)

        Raises:
            ValueError: If the resulting list is empty when a value was provided.
        """
        if value is None:
            # This will be caught by Pydantic as a missing required field later.
            return value

        if isinstance(value, str):
            brokers = [b.strip() for b in value.split(",") if b.strip()]
        elif isinstance(value, (list, tuple)):
            brokers = [str(b).strip() for b in value if str(b).strip()]
        else:
            raise ValueError(
                "KAFKA_BROKERS must be a comma-separated string or list of strings."
            )

        if not brokers:
            raise ValueError("KAFKA_BROKERS must contain at least one broker address.")

        return brokers

    @field_validator("log_level", mode="after")
    @classmethod
    def _normalize_log_level(cls, value: str) -> str:
        """
        Normalize log level to lowercase and perform a basic sanity check.
        """
        normalized = (value or "info").lower()
        allowed = {"debug", "info", "warn", "warning", "error", "critical"}
        if normalized not in allowed:
            # Gracefully default to info but keep original for diagnostics.
            return "info"
        return normalized

    @field_validator("deals_sqlite_url", mode="after")
    @classmethod
    def _validate_sqlite_url(cls, value: str) -> str:
        """
        Perform a lightweight sanity check on the SQLite URL.

        We don't attempt a full SQLAlchemy URL parse here, but we do ensure
        that the scheme starts with 'sqlite'.
        """
        if not value.lower().startswith("sqlite"):
            raise ValueError(
                "DEALS_SQLITE_URL must be a SQLite URL (e.g., sqlite:///./data/deals.sqlite3)."
            )
        return value


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """
    Return a cached instance of `Settings`.

    This function should be used throughout the ai-service codebase instead
    of instantiating `Settings` directly. Caching avoids repeated environment
    parsing and ensures a consistent configuration object per process.

    Example:
        from app.config.settings import get_settings

        settings = get_settings()
        print(settings.deals_sqlite_url)

    Returns:
        Settings: Parsed and validated configuration object.

    Raises:
        pydantic.ValidationError: If required settings are missing or invalid.
    """
    return Settings()
