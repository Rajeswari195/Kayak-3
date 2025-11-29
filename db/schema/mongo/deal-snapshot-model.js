/**
 * @file deal-snapshot-model.js
 * @description
 * Mongoose schema and model factory for AI-related deal snapshots and offers.
 *
 * Responsibilities:
 * - Represent snapshots of deals produced by the AI deals pipeline (normalized,
 *   scored, and tagged offers).
 * - Persist enough information for admin analytics, debugging, and audits
 *   without depending on live Kafka topics or the SQLite store.
 * - Provide a model factory that binds the schema to a supplied Mongoose
 *   connection.
 *
 * Key features:
 * - Stores linkage back to underlying listings/routes and external dataset
 *   sources (Inside Airbnb, Expedia, etc.).
 * - Tracks price, baseline/average price, computed discount, deal score,
 *   and tags like "pet_friendly", "near_transit", etc.
 * - Includes flexible rawPayload field for original event content.
 */

BEGIN WRITING FILE CODE

import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * MongoDB collection name for deal snapshots.
 *
 * @type {string}
 */
export const DEAL_SNAPSHOT_COLLECTION_NAME = "deal_snapshots";

/**
 * @typedef {import("mongoose").Document} MongooseDocument
 */

/**
 * @typedef {Object} RouteInfo
 * @property {string | null} [origin]
 * @property {string | null} [destination]
 */

/**
 * @typedef {Object} DealSnapshotShape
 * @property {string} dealId
 *   Identifier of the deal or offer (often from the AI service / Kafka).
 * @property {("FLIGHT"|"HOTEL"|"CAR"|"BUNDLE"|null)} listingType
 *   Type of asset this deal refers to (or BUNDLE for combined offers).
 * @property {string | null} [listingId]
 *   ID of the underlying listing (if any).
 * @property {RouteInfo | null} [route]
 *   Route metadata for flights (origin/destination IATA codes).
 * @property {string | null} [city]
 *   City associated with the listing (hotels/cars).
 * @property {string | null} [neighbourhood]
 *   Neighbourhood info (esp. for Inside Airbnb NYC).
 * @property {("AIRBNB_NYC"|"EXPEDIA_FLIGHTS"|"GLOBAL_AIRPORTS"|"SIMULATED"|"OTHER"|null)} [source]
 *   Upstream dataset/source identifier.
 * @property {number} price
 *   Current deal price.
 * @property {number | null} [basePrice]
 *   Baseline or average price for comparison.
 * @property {number | null} [discountPercent]
 *   Percent discount vs baseline, if known (0-100).
 * @property {number | null} [dealScore]
 *   Integer deal score (e.g., 1-100) computed by the AI pipeline.
 * @property {string[]} tags
 *   List of tags describing the deal (pet_friendly, refundable, etc.).
 * @property {Date} snapshotAt
 *   Timestamp at which this snapshot was captured.
 * @property {Record<string, any> | null} [rawPayload]
 *   Original payload as emitted by the AI pipeline (for debugging/audits).
 * @property {Date} createdAt
 * @property {Date} updatedAt
 */

/**
 * @typedef {DealSnapshotShape & MongooseDocument} DealSnapshotDocument
 */

const DealSnapshotSchema = new Schema(
  {
    dealId: {
      type: String,
      required: true,
      index: true,
      description:
        "Identifier for the deal/offer (matches AI pipeline and Kafka events).",
    },
    listingType: {
      type: String,
      required: false,
      enum: ["FLIGHT", "HOTEL", "CAR", "BUNDLE", null],
      default: null,
      index: true,
      description: "Type of asset for this deal (or BUNDLE for combos).",
    },
    listingId: {
      type: String,
      required: false,
      default: null,
      index: true,
      description:
        "Underlying listing identifier (e.g., flights.id, hotels.id, cars.id).",
    },
    route: {
      type: new Schema(
        {
          origin: { type: String, required: false, default: null },
          destination: { type: String, required: false, default: null },
        },
        { _id: false }
      ),
      required: false,
      default: null,
      description:
        "Route metadata for flight deals (IATA codes for origin/destination).",
    },
    city: {
      type: String,
      required: false,
      default: null,
      index: true,
      description:
        "City associated with the listing (e.g., hotel/city for Airbnb data).",
    },
    neighbourhood: {
      type: String,
      required: false,
      default: null,
      description:
        "Optional neighbourhood info (especially relevant for Inside Airbnb).",
    },
    source: {
      type: String,
      required: false,
      enum: [
        "AIRBNB_NYC",
        "EXPEDIA_FLIGHTS",
        "GLOBAL_AIRPORTS",
        "SIMULATED",
        "OTHER",
        null,
      ],
      default: null,
      index: true,
      description: "Upstream dataset origin for this deal snapshot.",
    },
    price: {
      type: Number,
      required: true,
      description: "Current deal price (normalized to a single currency, e.g., USD).",
    },
    basePrice: {
      type: Number,
      required: false,
      default: null,
      description:
        "Baseline or 30-day rolling average price used for comparison.",
    },
    discountPercent: {
      type: Number,
      required: false,
      default: null,
      description:
        "Computed discount percent vs baseline, if available (0-100).",
    },
    dealScore: {
      type: Number,
      required: false,
      default: null,
      min: 0,
      max: 100,
      description: "Integer deal score (0-100) used for ranking.",
    },
    tags: {
      type: [String],
      required: false,
      default: [],
      index: true,
      description:
        "Tags describing the offer, e.g., 'pet_friendly', 'refundable', 'near_transit'.",
    },
    snapshotAt: {
      type: Date,
      required: true,
      index: true,
      description:
        "Logical timestamp for when this snapshot was taken (e.g., event time).",
    },
    rawPayload: {
      // eslint-disable-next-line no-undef
      type: Schema.Types.Mixed,
      required: false,
      default: null,
      description:
        "Original payload from the AI pipeline / Kafka events, useful for audits.",
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Prevent accidental duplicate records for the same dealId + snapshotAt
 * combination, while still allowing multiple snapshots over time.
 */
DealSnapshotSchema.index(
  { dealId: 1, snapshotAt: 1 },
  { unique: true, name: "uq_deal_snapshot" }
);

/**
 * Index to support queries like "best deals in city X with score >= Y".
 */
DealSnapshotSchema.index(
  { city: 1, dealScore: -1, price: 1 },
  { name: "idx_city_score_price" }
);

/**
 * Factory function to create (or retrieve) the DealSnapshot model bound
 * to a specific Mongoose connection.
 *
 * @param {import("mongoose").Connection} connection
 * @returns {import("mongoose").Model<DealSnapshotDocument>}
 */
export function createDealSnapshotModel(connection) {
  return connection.model(
    "DealSnapshot",
    DealSnapshotSchema,
    DEAL_SNAPSHOT_COLLECTION_NAME
  );
}

export default DealSnapshotSchema;
