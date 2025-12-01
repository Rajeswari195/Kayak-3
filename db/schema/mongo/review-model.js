/**
 * @file review-model.js
 * @description
 * Mongoose schema and model factory for user reviews in the Kayak-like
 * travel platform.
 *
 * Responsibilities:
 * - Define the MongoDB document structure for reviews associated with
 *   flights, hotels, and cars.
 * - Enforce basic validation rules at the schema level (rating range,
 *   required fields, listing type).
 * - Provide a model factory that binds the schema to a specific Mongoose
 *   connection without creating connections on its own.
 *
 * Key features:
 * - Supports reviews for three listing types: FLIGHT, HOTEL, CAR.
 * - Enforces rating between 1 and 5.
 * - Tracks stayDate/usage date for temporal analytics.
 * - Adds indexes for common query patterns (listing, user, createdAt) and
 *   a unique constraint to prevent multiple reviews per user per listing.
 *
 * @notes
 * - This module intentionally avoids calling `mongoose.connect(...)`.
 *   The core-api service is responsible for establishing connections and
 *   passing a connection into the factory function(s).
 * - The same schema can be reused across services if needed by importing
 *   the factory and binding it to the appropriate connection.
 */

// BEGIN WRITING FILE CODE

import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * Name of the underlying MongoDB collection for reviews.
 * Using a constant helps avoid typos and centralizes any future renames.
 *
 * @type {string}
 */
export const REVIEW_COLLECTION_NAME = "reviews";

/**
 * @typedef {import("mongoose").Document} MongooseDocument
 */

/**
 * @typedef {Object} ReviewDocumentShape
 * @property {string} userId
 *   ID of the user who wrote the review (usually matches MySQL users.id).
 * @property {("FLIGHT"|"HOTEL"|"CAR")} listingType
 *   Type of the listing this review refers to.
 * @property {string} listingId
 *   Identifier of the listing (e.g., flights.id, hotels.id, cars.id).
 * @property {string | null} [bookingId]
 *   Optional booking ID (MySQL bookings.id) that this review is associated with.
 * @property {number} rating
 *   Numeric rating between 1 and 5 inclusive.
 * @property {string | null} [title]
 *   Short title/summary of the review.
 * @property {string | null} [comment]
 *   Free-form text describing the user’s experience.
 * @property {Date | null} [stayDate]
 *   Date representing when the stay/flight/rental occurred.
 * @property {Record<string, any> | null} [metadata]
 *   Optional structured metadata for analytics (e.g., trip purpose).
 * @property {Date} createdAt
 * @property {Date} updatedAt
 */

/**
 * @typedef {ReviewDocumentShape & MongooseDocument} ReviewDocument
 */

/**
 * Core Mongoose schema definition for reviews.
 *
 * Timestamps are enabled to automatically manage createdAt/updatedAt fields.
 */
const ReviewSchema = new Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
      description:
        "User identifier (matches relational users.id) that authored the review.",
    },
    listingType: {
      type: String,
      required: true,
      enum: ["FLIGHT", "HOTEL", "CAR"],
      index: true,
      description: "Type of listing being reviewed.",
    },
    listingId: {
      type: String,
      required: true,
      index: true,
      description:
        "Identifier of the listing (e.g., flights.id, hotels.id, cars.id).",
    },
    bookingId: {
      type: String,
      required: false,
      default: null,
      index: true,
      description:
        "Optional booking ID (from MySQL) that this review is tied to.",
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      description: "Integer rating between 1 and 5 (inclusive).",
    },
    title: {
      type: String,
      required: false,
      trim: true,
      maxlength: 255,
      default: null,
      description: "Short, optional title summarizing the review.",
    },
    comment: {
      type: String,
      required: false,
      trim: true,
      maxlength: 4000,
      default: null,
      description: "Optional free-form review text.",
    },
    stayDate: {
      type: Date,
      required: false,
      default: null,
      description:
        "Date of stay/flight/rental; useful for time-bucketed analytics.",
    },
    metadata: {
      // eslint-disable-next-line no-undef
      type: Schema.Types.Mixed,
      required: false,
      default: null,
      description:
        "Optional structured metadata, e.g., trip purpose, companion count.",
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Compound index to prevent a user from leaving more than one review
 * per listing type + listing ID. This keeps analytics simpler and matches
 * a natural business rule.
 *
 * If you ever need to support multiple reviews from the same user for the
 * same listing (e.g., multiple stays), you can drop this index and instead
 * rely on bookingId or stayDate to differentiate.
 */
ReviewSchema.index(
  { userId: 1, listingType: 1, listingId: 1 },
  { unique: true, name: "uq_user_listing_review" }
);

/**
 * Secondary index to speed up analytics / listing display based on rating
 * and creation date (e.g., "most recent 10 reviews for this property").
 */
ReviewSchema.index(
  { listingType: 1, listingId: 1, createdAt: -1 },
  { name: "idx_listing_recent_reviews" }
);

/**
 * Factory function to create (or retrieve) the Review model bound to a
 * specific Mongoose connection.
 *
 * @param {import("mongoose").Connection} connection
 *   An existing Mongoose connection (e.g., from mongoose.createConnection()).
 * @returns {import("mongoose").Model<ReviewDocument>}
 *   The Mongoose model for reviews associated with the given connection.
 *
 * @example
 * import mongoose from "mongoose";
 * import { createReviewModel } from "@/db/schema/mongo/review-model.js";
 *
 * const conn = await mongoose.createConnection(MONGO_URL);
 * const Review = createReviewModel(conn);
 * const docs = await Review.find({ listingType: "HOTEL", listingId: "abc" });
 */
export function createReviewModel(connection) {
  // Using connection.model ensures we do not pollute the global mongoose.models
  // registry, which can cause issues in multi-connection or test environments.
  return connection.model("Review", ReviewSchema, REVIEW_COLLECTION_NAME);
}

export default ReviewSchema;
