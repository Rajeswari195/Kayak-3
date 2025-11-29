/**
 * @file topics.js
 * @description
 * Central definition of Kafka topic names used by the platform.
 *
 * Keeping topic names in one place:
 * - Avoids typos across producers/consumers.
 * - Makes it easy to document and evolve the messaging topology.
 */

export const RAW_SUPPLIER_FEEDS = "raw_supplier_feeds";
export const DEALS_NORMALIZED = "deals.normalized";
export const DEALS_SCORED = "deals.scored";
export const DEALS_TAGGED = "deals.tagged";
export const DEAL_EVENTS = "deal.events";

export const BOOKING_EVENTS = "booking.events";
export const USER_ACTIVITY = "user.activity";

/**
 * Frozen map of all topic names for convenience.
 */
export const KAFKA_TOPICS = Object.freeze({
  RAW_SUPPLIER_FEEDS,
  DEALS_NORMALIZED,
  DEALS_SCORED,
  DEALS_TAGGED,
  DEAL_EVENTS,
  BOOKING_EVENTS,
  USER_ACTIVITY,
});

export default KAFKA_TOPICS;
