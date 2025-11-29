/**
 * @file index.js
 * @description
 * Entry point for MongoDB schema and model helpers used across the monorepo.
 *
 * Responsibilities:
 * - Re-export individual schema modules (reviews, clickstream, deal snapshots,
 *   admin audits) so they can be imported from a single path:
 *     "@/db/schema/mongo"
 * - Provide a convenience function `buildMongoModels(connection)` that
 *   registers all models on a given Mongoose connection and returns them
 *   as a typed object.
 *
 * Design notes:
 * - This module does *not* establish a connection to MongoDB. That is the
 *   responsibility of the core-api (and any other service needing Mongo).
 * - By passing in a `mongoose.Connection`, we avoid polluting the default
 *   connection and make it easier to write tests that use independent
 *   in-memory or temporary databases.
 */

BEGIN WRITING FILE CODE

import {
  REVIEW_COLLECTION_NAME,
  createReviewModel,
} from "./review-model.js";
import {
  CLICKSTREAM_COLLECTION_NAME,
  createClickstreamEventModel,
} from "./clickstream-model.js";
import {
  DEAL_SNAPSHOT_COLLECTION_NAME,
  createDealSnapshotModel,
} from "./deal-snapshot-model.js";
import {
  ADMIN_AUDIT_COLLECTION_NAME,
  createAdminAuditLogModel,
} from "./admin-audit-model.js";

/**
 * @typedef {import("./review-model.js").ReviewDocument} ReviewDocument
 * @typedef {import("./clickstream-model.js").ClickstreamEventDocument} ClickstreamEventDocument
 * @typedef {import("./deal-snapshot-model.js").DealSnapshotDocument} DealSnapshotDocument
 * @typedef {import("./admin-audit-model.js").AdminAuditLogDocument} AdminAuditLogDocument
 */

/**
 * @typedef {Object} MongoModels
 * @property {import("mongoose").Model<ReviewDocument>} Review
 * @property {import("mongoose").Model<ClickstreamEventDocument>} ClickstreamEvent
 * @property {import("mongoose").Model<DealSnapshotDocument>} DealSnapshot
 * @property {import("mongoose").Model<AdminAuditLogDocument>} AdminAuditLog
 */

/**
 * Register all Mongo models used by the platform on the given Mongoose
 * connection and return them as a convenient object.
 *
 * @param {import("mongoose").Connection} connection
 *   Pre-initialized Mongoose connection for the desired database.
 * @returns {MongoModels}
 *
 * @example
 * import mongoose from "mongoose";
 * import { buildMongoModels } from "@/db/schema/mongo/index.js";
 *
 * const conn = await mongoose.createConnection(process.env.MONGO_URL);
 * const mongoModels = buildMongoModels(conn);
 *
 * const recentReviews = await mongoModels.Review
 *   .find({ listingType: "HOTEL", listingId: "abc" })
 *   .sort({ createdAt: -1 })
 *   .limit(10);
 */
export function buildMongoModels(connection) {
  const Review = createReviewModel(connection);
  const ClickstreamEvent = createClickstreamEventModel(connection);
  const DealSnapshot = createDealSnapshotModel(connection);
  const AdminAuditLog = createAdminAuditLogModel(connection);

  return {
    Review,
    ClickstreamEvent,
    DealSnapshot,
    AdminAuditLog,
  };
}

export {
  // Collection name exports for use in analytics workers or migrations.
  REVIEW_COLLECTION_NAME,
  CLICKSTREAM_COLLECTION_NAME,
  DEAL_SNAPSHOT_COLLECTION_NAME,
  ADMIN_AUDIT_COLLECTION_NAME,
  // Underlying factory exports for advanced use cases.
  createReviewModel,
  createClickstreamEventModel,
  createDealSnapshotModel,
  createAdminAuditLogModel,
};
