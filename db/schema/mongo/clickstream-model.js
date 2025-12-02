/**
 * @file clickstream-model.js
 * @description
 * Mongoose schema and model factory for clickstream and behavior events.
 *
 * Responsibilities:
 * - Represent user and anonymous activity such as page views, clicks,
 *   searches, and booking funnels.
 * - Store flexible metadata for analytics, while keeping core fields indexed
 *   for common queries (by user, session, event type, page).
 * - Provide a model factory bound to a provided Mongoose connection.
 *
 * Key features:
 * - Supports both authenticated and anonymous sessions (userId optional).
 * - Encodes event types with a controlled enum.
 * - Includes listing identifiers where applicable (e.g., clicks on a hotel).
 * - Designed to work with Kafka-driven analytics workers and admin dashboards.
 */

import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * MongoDB collection name for clickstream events.
 *
 * @type {string}
 */
export const CLICKSTREAM_COLLECTION_NAME = "clickstream_events";

/**
 * @typedef {import("mongoose").Document} MongooseDocument
 */

/**
 * @typedef {Object} ClickstreamEventShape
 * @property {string | null} [userId]
 *   Optional user identifier (MySQL users.id) if the user is authenticated.
 * @property {string} sessionId
 *   A client-generated session identifier used to correlate events.
 * @property {string} eventType
 *   One of the supported event type strings (PAGE_VIEW, CLICK, SEARCH, etc.).
 * @property {string} page
 *   Route or path, e.g., "/search/flights".
 * @property {string | null} [referrer]
 *   Optional referrer path or URL.
 * @property {string | null} [elementId]
 *   DOM element ID for click events, if available.
 * @property {string | null} [elementLabel]
 *   Human-readable label for the clicked element.
 * @property {("FLIGHT"|"HOTEL"|"CAR"|null)} [listingType]
 *   Listing type associated with this event, if any.
 * @property {string | null} [listingId]
 *   Listing ID associated with this event, if any.
 * @property {string | null} [ipAddress]
 *   IP address from the request, if captured (for coarse geolocation/abuse).
 * @property {string | null} [userAgent]
 *   User agent string from the client.
 * @property {Record<string, any> | null} [metadata]
 *   Arbitrary structured data, e.g., search params or experiment flags.
 * @property {Date} createdAt
 * @property {Date} updatedAt
 */

/**
 * @typedef {ClickstreamEventShape & MongooseDocument} ClickstreamEventDocument
 */

const ClickstreamEventSchema = new Schema(
  {
    userId: {
      type: String,
      required: false,
      default: null,
      index: true,
      description:
        "Optional user identifier (relational users.id) for authenticated users.",
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
      description:
        "Client-generated session identifier used to correlate related events.",
    },
    eventType: {
      type: String,
      required: true,
      enum: [
        "PAGE_VIEW",
        "CLICK",
        "SEARCH",
        "BOOKING_STARTED",
        "BOOKING_COMPLETED",
        "BOOKING_FAILED",
        "SCROLL",
        "CUSTOM",
      ],
      index: true,
      description: "Type/category of the event.",
    },
    page: {
      type: String,
      required: true,
      trim: true,
      description: "Route or path where the event occurred, e.g., '/search'.",
    },
    referrer: {
      type: String,
      required: false,
      default: null,
      trim: true,
      description:
        "Optional referrer path or URL that led to the current page/event.",
    },
    elementId: {
      type: String,
      required: false,
      default: null,
      trim: true,
      description: "DOM element ID for click events, when available.",
    },
    elementLabel: {
      type: String,
      required: false,
      default: null,
      trim: true,
      description:
        "Human-friendly label for the UI element (e.g., 'Book Now button').",
    },
    listingType: {
      type: String,
      required: false,
      enum: ["FLIGHT", "HOTEL", "CAR", null],
      default: null,
      index: true,
      description:
        "Optional listing type that this event is associated with (if any).",
    },
    listingId: {
      type: String,
      required: false,
      default: null,
      index: true,
      description:
        "Optional listing identifier (flights.id, hotels.id, cars.id) associated with the event.",
    },
    ipAddress: {
      type: String,
      required: false,
      default: null,
      description:
        "Optional IP address of the client; can be used for coarse geography.",
    },
    userAgent: {
      type: String,
      required: false,
      default: null,
      description:
        "Optional user agent string from the client (browser/OS information).",
    },
    metadata: {
      // eslint-disable-next-line no-undef
      type: Schema.Types.Mixed,
      required: false,
      default: null,
      description:
        "Arbitrary structured data (e.g., search filters, experiment ids).",
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Index to efficiently query by page for analytics such as "clicks per page".
 */
ClickstreamEventSchema.index(
  { page: 1, eventType: 1, createdAt: -1 },
  { name: "idx_page_event_created" }
);

/**
 * Index for trace diagrams: quickly fetch events by user or session ordered
 * by time to reconstruct user journeys.
 */
ClickstreamEventSchema.index(
  { userId: 1, sessionId: 1, createdAt: 1 },
  { name: "idx_user_session_path" }
);

/**
 * Factory function to create (or retrieve) the ClickstreamEvent model bound
 * to a specific Mongoose connection.
 *
 * @param {import("mongoose").Connection} connection
 * @returns {import("mongoose").Model<ClickstreamEventDocument>}
 */
export function createClickstreamEventModel(connection) {
  return connection.model(
    "ClickstreamEvent",
    ClickstreamEventSchema,
    CLICKSTREAM_COLLECTION_NAME
  );
}

export default ClickstreamEventSchema;
