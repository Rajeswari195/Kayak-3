/**
 * @file booking-producer.js
 * @description
 * Kafka producer helpers for booking-related events.
 *
 * Responsibilities:
 * - Provide small, focused helpers to publish JSON messages to the
 *   `booking.events` topic.
 * - Standardize the event payload shape so downstream consumers
 *   (analytics, AI service, monitoring) can rely on it.
 */

import { sendKafkaJsonMessage } from "./kafka-client.js";
import { BOOKING_EVENTS } from "./topics.js";
import { loadConfig } from "../config/config.js";

const config = loadConfig();

/**
 * Build a normalized booking event payload.
 *
 * @param {Object} params
 * @param {string} params.eventType
 * @param {Object|null} [params.booking]
 * @param {Object[]|null} [params.items]
 * @param {Object|null} [params.billing]
 * @param {string|null} [params.userId]
 * @param {string} [params.source]
 * @returns {Object}
 */
function buildBookingEventPayload({
  eventType,
  booking = null,
  items = null,
  billing = null,
  userId = null,
  source = "core-api",
}) {
  const nowIso = new Date().toISOString();

  const bookingId = booking?.id ?? null;
  const bookingReference =
    booking?.booking_reference ?? booking?.bookingReference ?? null;
  const status = booking?.status ?? null;

  const totalAmount =
    booking?.total_amount ??
    booking?.totalAmount ??
    billing?.amount ??
    null;

  const currency =
    booking?.currency ?? billing?.currency ?? "USD";

  const itemTypes = Array.isArray(items)
    ? Array.from(
        new Set(
          items.map((it) => it.item_type ?? it.itemType).filter(Boolean)
        )
      )
    : [];

  return {
    eventType,
    bookingId,
    bookingReference,
    userId,
    status,
    totalAmount,
    currency,
    itemTypes,
    billingStatus: billing?.status ?? null,
    billingErrorCode: billing?.error_code ?? billing?.errorCode ?? null,
    createdAt: nowIso,
    metadata: {
      source,
      service: "bookings",
      env: config.env,
    },
  };
}

/**
 * Publish a "booking confirmed" event to Kafka.
 *
 * @param {Object} booking
 * @param {Object[]} items
 * @param {Object} billing
 * @param {string} userId
 * @param {string} [source]
 * @returns {Promise<void>}
 */
export async function publishBookingConfirmed(
  booking,
  items,
  billing,
  userId,
  source = "createBookingService"
) {
  const payload = buildBookingEventPayload({
    eventType: "BOOKING_CONFIRMED",
    booking,
    items,
    billing,
    userId,
    source,
  });

  await sendKafkaJsonMessage(
    BOOKING_EVENTS,
    payload,
    booking?.id ?? userId ?? null,
    { "event-type": "BOOKING_CONFIRMED" }
  );
}

/**
 * Publish a "booking failed" event to Kafka.
 *
 * @param {Object|null} bookingLike - May be null if booking never persisted.
 * @param {string|null} userId
 * @param {string} failureCode
 * @param {string} [source]
 * @returns {Promise<void>}
 */
export async function publishBookingFailed(
  bookingLike,
  userId,
  failureCode,
  source = "createBookingService"
) {
  const nowIso = new Date().toISOString();

  const bookingId = bookingLike?.id ?? null;
  const bookingReference =
    bookingLike?.booking_reference ?? bookingLike?.bookingReference ?? null;

  const payload = {
    eventType: "BOOKING_FAILED",
    bookingId,
    bookingReference,
    userId,
    status: bookingLike?.status ?? "FAILED",
    failureCode,
    createdAt: nowIso,
    metadata: {
      source,
      service: "bookings",
      env: config.env,
    },
  };

  await sendKafkaJsonMessage(
    BOOKING_EVENTS,
    payload,
    bookingId ?? userId ?? null,
    { "event-type": "BOOKING_FAILED" }
  );
}
