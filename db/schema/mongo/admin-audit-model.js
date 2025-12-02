/**
 * @file admin-audit-model.js
 * @description
 * Mongoose schema and model factory for admin audit logs.
 *
 * Responsibilities:
 * - Track changes and important actions performed by admins (e.g., creating,
 *   updating, deactivating listings or users).
 * - Provide a durable audit trail separate from the relational store.
 * - Support analytics and forensic queries based on admin, entity, or action.
 *
 * Key features:
 * - Stores before/after snapshots for the affected entity as JSON.
 * - Encodes entity type and action type using controlled enums.
 * - Records contextual information like IP address and user agent.
 */


import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * MongoDB collection name for admin audit logs.
 *
 * @type {string}
 */
export const ADMIN_AUDIT_COLLECTION_NAME = "admin_audit_logs";

/**
 * @typedef {import("mongoose").Document} MongooseDocument
 */

/**
 * @typedef {Object} AdminAuditLogShape
 * @property {string} adminId
 *   ID of the admin performing the action (MySQL admins.id or users.id).
 * @property {string | null} [adminEmail]
 *   Optional admin email for convenience when reading logs.
 * @property {("USER"|"LISTING_FLIGHT"|"LISTING_HOTEL"|"LISTING_CAR"|"BOOKING"|"BILLING"|"OTHER")} entityType
 *   Type of entity affected by the action.
 * @property {string | null} [entityId]
 *   Identifier of the affected entity (e.g., users.id, flights.id).
 * @property {("CREATE"|"UPDATE"|"DELETE"|"DEACTIVATE"|"REACTIVATE"|"SUSPEND"|"OTHER")} actionType
 *   Type of action performed.
 * @property {Record<string, any> | null} [before]
 *   Partial JSON snapshot of the entity before the change.
 * @property {Record<string, any> | null} [after]
 *   Partial JSON snapshot of the entity after the change.
 * @property {string | null} [reason]
 *   Optional human-readable description of why this change was made.
 * @property {string | null} [ipAddress]
 *   IP address from which the change was initiated.
 * @property {string | null} [userAgent]
 *   User agent string of the admin client.
 * @property {Date} createdAt
 * @property {Date} updatedAt
 */

/**
 * @typedef {AdminAuditLogShape & MongooseDocument} AdminAuditLogDocument
 */

const AdminAuditLogSchema = new Schema(
  {
    adminId: {
      type: String,
      required: true,
      index: true,
      description:
        "Identifier of the admin performing the action (relational admins.id or users.id).",
    },
    adminEmail: {
      type: String,
      required: false,
      default: null,
      description:
        "Optional email of the admin for convenience when inspecting logs.",
    },
    entityType: {
      type: String,
      required: true,
      enum: [
        "USER",
        "LISTING_FLIGHT",
        "LISTING_HOTEL",
        "LISTING_CAR",
        "BOOKING",
        "BILLING",
        "OTHER",
      ],
      index: true,
      description: "Type of entity affected by this admin action.",
    },
    entityId: {
      type: String,
      required: false,
      default: null,
      index: true,
      description:
        "Identifier of the affected entity (e.g., users.id, hotels.id).",
    },
    actionType: {
      type: String,
      required: true,
      enum: [
        "CREATE",
        "UPDATE",
        "DELETE",
        "DEACTIVATE",
        "REACTIVATE",
        "SUSPEND",
        "OTHER",
      ],
      index: true,
      description: "Kind of action performed by the admin.",
    },
    before: {
      // eslint-disable-next-line no-undef
      type: Schema.Types.Mixed,
      required: false,
      default: null,
      description:
        "Partial JSON snapshot of the entity before the change (if available).",
    },
    after: {
      // eslint-disable-next-line no-undef
      type: Schema.Types.Mixed,
      required: false,
      default: null,
      description:
        "Partial JSON snapshot of the entity after the change (if available).",
    },
    reason: {
      type: String,
      required: false,
      default: null,
      maxlength: 1024,
      description:
        "Optional explanation or reason supplied by the admin (e.g., support request id).",
    },
    ipAddress: {
      type: String,
      required: false,
      default: null,
      description:
        "IP address of the admin client, useful for audit/forensics.",
    },
    userAgent: {
      type: String,
      required: false,
      default: null,
      description:
        "User agent string from the admin client, useful for debugging.",
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Index to make it easy to inspect all actions related to a given entity.
 */
AdminAuditLogSchema.index(
  { entityType: 1, entityId: 1, createdAt: -1 },
  { name: "idx_entity_audit_timeline" }
);

/**
 * Index to group and order actions by admin for behavioral analysis.
 */
AdminAuditLogSchema.index(
  { adminId: 1, createdAt: -1 },
  { name: "idx_admin_activity_timeline" }
);

/**
 * Factory function to create (or retrieve) the AdminAuditLog model bound to
 * a specific Mongoose connection.
 *
 * @param {import("mongoose").Connection} connection
 * @returns {import("mongoose").Model<AdminAuditLogDocument>}
 */
export function createAdminAuditLogModel(connection) {
  return connection.model(
    "AdminAuditLog",
    AdminAuditLogSchema,
    ADMIN_AUDIT_COLLECTION_NAME
  );
}

export default AdminAuditLogSchema;
