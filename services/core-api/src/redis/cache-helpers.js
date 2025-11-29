/**
 * @file cache-helpers.js
 * @description
 * High-level Redis caching utilities for the core-api service.
 *
 * Responsibilities:
 * - Provide a cache-aside helper (`getOrSetJson`) for JSON-serializable data.
 * - Implement basic invalidation utilities (by key and by namespace pattern).
 * - Encapsulate Redis error handling so callers can remain simple and focused
 *   on domain logic (e.g., flight/hotel/car search).
 *
 * Key features:
 * - Uses the underlying ioredis client from `redis-client.js`.
 * - Handles Redis connectivity errors gracefully, falling back to the
 *   underlying data source when needed.
 * - Supports TTL-based expiration per key.
 * - Namespace-wide invalidation helpers for listings search caches.
 *
 * @notes
 * - These helpers are intentionally low-level enough to be reused across
 *   different repositories (not just listings) but high-level enough that
 *   most code shouldn't need to interact with the raw Redis client.
 * - All values are stored as JSON strings under the hood; callers should
 *   only pass JSON-serializable values to `getOrSetJson`.
 */

import {
  getRedisClient,
  redisGet,
  redisSet,
  redisDel,
} from "./redis-client.js";

import {
  CACHE_NAMESPACES,
} from "./cache-keys.js";

/**
 * Default TTL for search result caches, in seconds.
 * This is a conservative value; routes and prices can change frequently.
 *
 * @type {number}
 */
const DEFAULT_SEARCH_TTL_SECONDS = 60;

/**
 * Default TTL for user profile caches, in seconds.
 * Profiles change less frequently than search results, so we can cache longer.
 *
 * @type {number}
 */
const DEFAULT_PROFILE_TTL_SECONDS = 300;

/**
 * Options for getOrSetJson.
 *
 * @typedef {Object} GetOrSetOptions
 * @property {number} [ttlSeconds] - Time-to-live for the cache entry.
 * @property {boolean} [skipCache] - If true, bypass Redis and fetch fresh.
 */

/**
 * Cache-aside helper for JSON-serializable values.
 *
 * Behavior:
 * - If `skipCache` is true, calls `fetchFn` and returns its result without
 *   reading or writing Redis.
 * - Otherwise:
 *   1. Attempt to read the key from Redis.
 *   2. If found and parseable, return the cached value.
 *   3. If missing or parse fails, call `fetchFn`, then store and return the
 *      fresh value.
 *
 * Redis errors:
 * - If any Redis operation fails (get, set), the error is logged to stderr
 *   and the function falls back to calling `fetchFn` directly. Failures in
 *   `fetchFn` are *not* swallowed.
 *
 * @template T
 * @param {string} key - Fully-qualified Redis key.
 * @param {() => Promise<T>} fetchFn - Function that fetches the value on cache miss.
 * @param {GetOrSetOptions} [options]
 * @returns {Promise<T>}
 */
export async function getOrSetJson(key, fetchFn, options = {}) {
  const { ttlSeconds, skipCache } = options;

  if (skipCache) {
    // Bypass cache entirely (useful for debugging or forced refresh).
    return fetchFn();
  }

  // 1. Try to read from Redis
  let cachedString = null;
  try {
    cachedString = await redisGet(key);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      `[cache] Error reading key "${key}" from Redis; falling back to fetchFn:`,
      err
    );
  }

  if (cachedString != null) {
    try {
      // Parse and return the cached value if parse succeeds.
      const parsed = JSON.parse(cachedString);
      return /** @type {T} */ (parsed);
    } catch (err) {
      // If parsing fails, treat as cache miss and log once.
      // eslint-disable-next-line no-console
      console.error(
        `[cache] Failed to parse JSON for key "${key}" (will refresh):`,
        err
      );
    }
  }

  // 2. Cache miss: call fetchFn
  const freshValue = await fetchFn();

  // Allow undefined/null to be cached as well, but only if explicitly desired.
  // For now, we store any value except `undefined` (because JSON.stringify
  // drops undefined properties).
  if (freshValue !== undefined) {
    const payload = JSON.stringify(freshValue);

    try {
      await redisSet(key, payload, {
        ttlSeconds: typeof ttlSeconds === "number" ? ttlSeconds : undefined,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        `[cache] Error writing key "${key}" to Redis (non-fatal):`,
        err
      );
    }
  }

  return freshValue;
}

/**
 * Invalidate a single cache key by deleting it from Redis.
 *
 * @param {string} key - Exact Redis key to delete.
 * @returns {Promise<number>} Number of keys deleted (0 or 1).
 */
export async function invalidateCacheKey(key) {
  try {
    const deleted = await redisDel(key);
    return deleted;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      `[cache] Error deleting key "${key}" from Redis (non-fatal):`,
      err
    );
    return 0;
  }
}

/**
 * Invalidate cache entries matching a given pattern by scanning the keyspace
 * and deleting matches. This uses Redis SCAN internally to avoid blocking
 * the server with a KEYS command.
 *
 * WARNING:
 * - Pattern invalidation can be expensive on large keyspaces. For our
 *   educational/demo environment and reasonably scoped namespaces, this is
 *   acceptable, but for production-scale systems we would typically maintain
 *   explicit sets of keys or use versioned prefixes instead.
 *
 * @param {string} pattern - Redis glob-style pattern (e.g., "hotel_search:v1:*").
 * @param {number} [batchSize=100] - Number of keys to inspect per SCAN iteration.
 * @returns {Promise<number>} Total number of keys deleted.
 */
export async function invalidateByPattern(pattern, batchSize = 100) {
  const client = getRedisClient();

  let cursor = "0";
  let totalDeleted = 0;

  try {
    do {
      // SCAN cursor MATCH <pattern> COUNT <batchSize>
      // eslint-disable-next-line no-await-in-loop
      const [nextCursor, keys] = await client.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        batchSize
      );

      if (Array.isArray(keys) && keys.length > 0) {
        // eslint-disable-next-line no-await-in-loop
        const deleted = await client.del(...keys);
        totalDeleted += deleted;
      }

      cursor = nextCursor;
    } while (cursor !== "0");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      `[cache] Error scanning Redis with pattern "${pattern}" (non-fatal):`,
      err
    );
  }

  return totalDeleted;
}

/**
 * Invalidate *all* flight search cache entries. This is a coarse-grained
 * invalidation strategy that is safe and simple: any change to flights
 * (pricing, availability, activation state) can call this to ensure stale
 * search results are not served.
 *
 * @returns {Promise<number>} Number of keys deleted.
 */
export function invalidateFlightSearchCache() {
  const pattern = `${CACHE_NAMESPACES.FLIGHT_SEARCH}:v1:*`;
  return invalidateByPattern(pattern);
}

/**
 * Invalidate *all* hotel search cache entries.
 *
 * This is typically invoked after hotel listing updates or booking flows
 * that materially affect hotel availability/pricing. It's coarse but safe.
 *
 * @returns {Promise<number>} Number of keys deleted.
 */
export function invalidateHotelSearchCache() {
  const pattern = `${CACHE_NAMESPACES.HOTEL_SEARCH}:v1:*`;
  return invalidateByPattern(pattern);
}

/**
 * Invalidate *all* car search cache entries.
 *
 * @returns {Promise<number>} Number of keys deleted.
 */
export function invalidateCarSearchCache() {
  const pattern = `${CACHE_NAMESPACES.CAR_SEARCH}:v1:*`;
  return invalidateByPattern(pattern);
}

/**
 * Invalidate a single user profile cache entry for the given user ID.
 *
 * @param {string} userId - Relational users.id value.
 * @returns {Promise<number>} Number of keys deleted (0 or 1).
 */
export async function invalidateUserProfileCache(userId) {
  const key = `${CACHE_NAMESPACES.USER_PROFILE}:v1:userId=${encodeURIComponent(
    userId
  )}`;
  return invalidateCacheKey(key);
}

/**
 * Convenience wrapper for caching *search* results (flights, hotels, cars).
 * Applies a default TTL suitable for rapidly-changing data.
 *
 * @template T
 * @param {string} cacheKey - Cache key generated via cache-keys helpers.
 * @param {() => Promise<T>} fetchFn - Underlying data fetcher.
 * @param {Partial<GetOrSetOptions>} [options]
 * @returns {Promise<T>}
 */
export function getOrSetSearchResult(cacheKey, fetchFn, options = {}) {
  const ttl =
    typeof options.ttlSeconds === "number"
      ? options.ttlSeconds
      : DEFAULT_SEARCH_TTL_SECONDS;

  return getOrSetJson(cacheKey, fetchFn, {
    ...options,
    ttlSeconds: ttl,
  });
}

/**
 * Convenience wrapper for caching user profile lookups.
 *
 * @template T
 * @param {string} cacheKey - Cache key for the profile (e.g., from buildUserProfileCacheKey).
 * @param {() => Promise<T>} fetchFn - Underlying data fetcher.
 * @param {Partial<GetOrSetOptions>} [options]
 * @returns {Promise<T>}
 */
export function getOrSetUserProfile(cacheKey, fetchFn, options = {}) {
  const ttl =
    typeof options.ttlSeconds === "number"
      ? options.ttlSeconds
      : DEFAULT_PROFILE_TTL_SECONDS;

  return getOrSetJson(cacheKey, fetchFn, {
    ...options,
    ttlSeconds: ttl,
  });
}
