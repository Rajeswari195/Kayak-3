/**
 * @file redis-client.js
 * @description
 * Reusable Redis client for the core-api service.
 *
 * Responsibilities:
 * - Initialize a singleton Redis client using the REDIS_URL from config.
 * - Provide small helper functions for get/set/del operations.
 * - Expose a graceful shutdown function for process teardown.
 *
 * Notes:
 * - Uses `ioredis` for robust connection handling and reconnection logic.
 * - Make sure to install the dependency in services/core-api:
 *     npm install ioredis
 */

import Redis from "ioredis";
import { loadConfig } from "../config/config.js";

/**
 * @typedef {import("ioredis").Redis} RedisClient
 */

/** @type {RedisClient | null} */
let redisClient = null;

/**
 * Create a new Redis client instance using configuration from env.
 *
 * @returns {RedisClient}
 * @private
 */
function createRedisClient() {
  const config = loadConfig();
  const client = new Redis(config.redisUrl, {
    // Lazy connect so that we don't attempt connection before it's actually used.
    lazyConnect: true,
  });

  client.on("connect", () => {
    if (config.logLevel === "debug" || config.logLevel === "info") {
      // eslint-disable-next-line no-console
      console.log("[redis] Connected to Redis.");
    }
  });

  client.on("error", (err) => {
    // eslint-disable-next-line no-console
    console.error("[redis] Redis client error:", err);
  });

  return client;
}

/**
 * Get (and lazily initialize) the Redis client singleton.
 *
 * @returns {RedisClient}
 */
export function getRedisClient() {
  if (!redisClient) {
    redisClient = createRedisClient();
  }
  return redisClient;
}

/**
 * Connect the Redis client if not already connected.
 *
 * Safe to call multiple times.
 *
 * @returns {Promise<void>}
 */
export async function connectRedis() {
  const client = getRedisClient();

  // ioredis will no-op if already connected
  await client.connect();
}

/**
 * Retrieve a value from Redis by key.
 *
 * @param {string} key
 * @returns {Promise<string | null>}
 */
export async function redisGet(key) {
  const client = getRedisClient();
  return client.get(key);
}

/**
 * Set a value in Redis with optional TTL.
 *
 * @param {string} key
 * @param {string} value
 * @param {{ ttlSeconds?: number }} [options]
 * @returns {Promise<"OK" | null>}
 */
export async function redisSet(key, value, options = {}) {
  const client = getRedisClient();
  const { ttlSeconds } = options;

  if (typeof ttlSeconds === "number" && Number.isFinite(ttlSeconds) && ttlSeconds > 0) {
    return client.set(key, value, "EX", ttlSeconds);
  }

  return client.set(key, value);
}

/**
 * Delete a key from Redis.
 *
 * @param {string} key
 * @returns {Promise<number>} Number of keys removed (0 or 1).
 */
export async function redisDel(key) {
  const client = getRedisClient();
  return client.del(key);
}

/**
 * Gracefully close the Redis connection.
 *
 * @returns {Promise<void>}
 */
export async function shutdownRedis() {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[redis] Error during shutdown:", err);
      try {
        await redisClient.disconnect();
      } catch (inner) {
        // eslint-disable-next-line no-console
        console.error("[redis] Forced disconnect error:", inner);
      }
    } finally {
      redisClient = null;
    }
  }
}
