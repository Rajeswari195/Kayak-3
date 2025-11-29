/**
 * @file mongo.js
 * @description
 * MongoDB connection helper for the core-api service using Mongoose.
 *
 * Responsibilities:
 * - Lazily establish a single shared Mongoose connection using the URL
 *   from configuration.
 * - Expose `connectMongo` and `getMongoConnection` helpers so repositories
 *   can ensure the connection exists before using models.
 * - Provide `disconnectMongo` for graceful shutdown.
 *
 * Notes:
 * - This module does NOT define schemas or models; those live under
 *   `db/schema/mongo/*`. They should import Mongoose or use the default
 *   connection exposed here.
 */

import mongoose from "mongoose";
import { getMongoConnectionConfig } from "../config/db-config.js";

let connectPromise = null;

/**
 * Establish the Mongoose connection if not already connected.
 *
 * @returns {Promise<typeof mongoose>}
 */
export function connectMongo() {
  if (connectPromise) {
    return connectPromise;
  }

  const { url } = getMongoConnectionConfig();

  mongoose.set("strictQuery", true);

  connectPromise = mongoose
    .connect(url, {
      autoIndex: true,
      maxPoolSize: 10
    })
    .then((m) => {
      console.log("[db:mongo] Connected to MongoDB");
      return m;
    })
    .catch((err) => {
      // If connection fails, clear the cached promise so a retry is possible.
      console.error("[db:mongo] Initial connection error:", err);
      connectPromise = null;
      throw err;
    });

  return connectPromise;
}

/**
 * Convenience helper to get the active Mongoose connection.
 * Ensures that `connectMongo()` has been called first.
 *
 * @returns {Promise<import("mongoose").Connection>}
 */
export async function getMongoConnection() {
  await connectMongo();
  return mongoose.connection;
}

/**
 * Gracefully close the MongoDB connection.
 * Should be invoked during process shutdown.
 *
 * @returns {Promise<void>}
 */
export async function disconnectMongo() {
  if (mongoose.connection.readyState === 0) {
    return;
  }

  try {
    await mongoose.disconnect();
    console.log("[db:mongo] Disconnected from MongoDB");
  } catch (err) {
    console.error("[db:mongo] Error during disconnect:", err);
  } finally {
    connectPromise = null;
  }
}
