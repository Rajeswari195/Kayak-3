"""
@file topics.py
@description
Kafka topic name constants for the AI Recommendation Service.

These must stay in sync with the Node.js core-api Kafka topics
(see services/core-api/src/kafka/topics.js).
"""

RAW_SUPPLIER_FEEDS: str = "raw_supplier_feeds"
DEALS_NORMALIZED: str = "deals.normalized"
DEALS_SCORED: str = "deals.scored"
DEALS_TAGGED: str = "deals.tagged"
DEAL_EVENTS: str = "deal.events"

BOOKING_EVENTS: str = "booking.events"
USER_ACTIVITY: str = "user.activity"

ALL_TOPICS = (
    RAW_SUPPLIER_FEEDS,
    DEALS_NORMALIZED,
    DEALS_SCORED,
    DEALS_TAGGED,
    DEAL_EVENTS,
    BOOKING_EVENTS,
    USER_ACTIVITY,
)
