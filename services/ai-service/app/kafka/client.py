"""
@file client.py
@description
Kafka client utilities for the FastAPI-based AI Recommendation Service.

Responsibilities:
- Provide lazily initialized, shared Kafka producer and consumer instances
  using aiokafka.
- Hide bootstrap configuration details (brokers, client ID) behind a
  small, typed helper layer.
- Offer JSON-centric helpers for sending and consuming messages.

Notes:
- Install aiokafka in the Python environment:
    pip install aiokafka
- These utilities are designed to be wired into FastAPI startup/shutdown
  events, e.g.:

    from fastapi import FastAPI
    from app.kafka.client import shutdown_kafka

    app = FastAPI()

    @app.on_event("shutdown")
    async def on_shutdown():
        await shutdown_kafka()
"""

from __future__ import annotations

import json
import logging
from typing import Dict, List, Optional

from aiokafka import AIOKafkaConsumer, AIOKafkaProducer

from app.config.settings import get_settings

logger = logging.getLogger(__name__)

_settings = get_settings()

# Shared producer and consumer registry
_producer: Optional[AIOKafkaProducer] = None
_consumers: Dict[str, AIOKafkaConsumer] = {}


def _consumer_key(group_id: str, topics: List[str]) -> str:
  """
  Build a stable key for identifying a consumer by its group and topics.
  """
  return f"{group_id}::" + ",".join(sorted(topics))


async def get_kafka_producer() -> AIOKafkaProducer:
  """
  Get (and lazily initialize) a shared aiokafka producer.

  Returns:
      AIOKafkaProducer: Connected producer instance.
  """
  global _producer

  if _producer is not None:
    return _producer

  logger.info("Creating Kafka producer for AI service (brokers=%s)", _settings.kafka_brokers)

  _producer = AIOKafkaProducer(
      bootstrap_servers=_settings.kafka_brokers,
      # Using json value serializer manually via helper below for transparency.
  )
  await _producer.start()
  return _producer


async def get_kafka_consumer(group_id: str, topics: List[str]) -> AIOKafkaConsumer:
  """
  Get (or create) a Kafka consumer for the given group and topics.

  Args:
      group_id: Consumer group ID.
      topics: List of topic names to subscribe to.

  Returns:
      AIOKafkaConsumer: Connected consumer subscribed to the given topics.
  """
  global _consumers

  key = _consumer_key(group_id, topics)
  if key in _consumers:
    return _consumers[key]

  logger.info(
      "Creating Kafka consumer (group_id=%s, topics=%s, brokers=%s)",
      group_id,
      topics,
      _settings.kafka_brokers,
  )

  consumer = AIOKafkaConsumer(
      *topics,
      bootstrap_servers=_settings.kafka_brokers,
      group_id=group_id,
      enable_auto_commit=True,
      auto_offset_reset="latest",
  )
  await consumer.start()
  _consumers[key] = consumer
  return consumer


async def send_json(
    topic: str,
    payload: dict,
    key: Optional[str] = None,
    headers: Optional[dict] = None,
) -> None:
  """
  Helper to send a JSON payload to a Kafka topic.

  Args:
      topic: Topic name.
      payload: JSON-serializable dict.
      key: Optional message key for partitioning.
      headers: Optional dict of string headers.
  """
  producer = await get_kafka_producer()

  kafka_headers = None
  if headers:
    # aiokafka expects headers as a list of (key, bytes) pairs
    kafka_headers = [(str(k), str(v).encode("utf-8")) for k, v in headers.items()]

  value_bytes = json.dumps(payload).encode("utf-8")
  key_bytes = key.encode("utf-8") if key is not None else None

  await producer.send_and_wait(topic, value=value_bytes, key=key_bytes, headers=kafka_headers)


async def shutdown_kafka() -> None:
  """
  Gracefully stop the shared Kafka producer and all consumers.

  This should be called from FastAPI's shutdown event hook.
  """
  global _producer, _consumers

  if _producer is not None:
    try:
      await _producer.stop()
    except Exception:  # pragma: no cover - defensive
      logger.exception("Error stopping Kafka producer")
    finally:
      _producer = None

  for key, consumer in list(_consumers.items()):
    try:
      await consumer.stop()
    except Exception:  # pragma: no cover - defensive
      logger.exception("Error stopping Kafka consumer %s", key)
    finally:
      _consumers.pop(key, None)
