/**
 * @file cache-keys.js
 * @description
 * Helpers for generating consistent, versioned Redis cache keys used by the
 * core-api service, primarily for listings/search results and other
 * frequently-read entities.
 *
 * Responsibilities:
 * - Provide a stable, centralized strategy for naming cache keys.
 * - Avoid key collisions by using namespaces and a version prefix.
 * - Normalize and serialize filter/option objects so that logically equivalent
 *   searches map to the same cache key.
 *
 * Key features:
 * - Namespaces for flight, hotel, and car search results.
 * - Helpers for user-centric cache keys (e.g., user profiles).
 * - Stable serialization using sorted keys and URI-safe encoding.
 *
 * @notes
 * - Keys are intentionally human-readable (no hashing) for easier debugging.
 *   If we later decide to hash the payload portion, we can bump the key
 *   version (e.g., from v1 to v2) without affecting existing callers.
 * - Empty filters are treated as a special "all" token rather than an empty
 *   string to avoid ambiguous keys.
 * - These helpers *only* generate keys; they do not talk to Redis.
 */

/**
 * Namespace constants for cache keys. Keeping these in one place makes it
 * easier to inspect Redis and avoids stringly-typed mistakes.
 */
export const CACHE_NAMESPACES = Object.freeze({
  FLIGHT_SEARCH: "flight_search",
  HOTEL_SEARCH: "hotel_search",
  CAR_SEARCH: "car_search",
  USER_PROFILE: "user_profile",
});

/**
 * Key version. Increment this if the structure of payload serialization
 * changes in a way that would make old keys incompatible with new callers.
 *
 * @type {string}
 */
const KEY_VERSION = "v1";

/**
 * Normalize a primitive or structured value into a string suitable for use
 * inside a cache key.
 *
 * @param {any} value
 * @returns {string}
 */
function normalizeValueForKey(value) {
  if (value === null || value === undefined) {
    return "";
  }

  const t = typeof value;

  if (t === "string") {
    return value;
  }

  if (t === "number" || t === "boolean") {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    // Arrays are serialized as comma-separated normalized elements.
    return value.map((v) => normalizeValueForKey(v)).join(",");
  }

  if (t === "object") {
    // For nested objects, we serialize as key1=value1&key2=value2... with
    // sorted keys to maintain determinism.
    const entries = Object.keys(value)
      .sort()
      .map((k) => {
        const v = normalizeValueForKey(value[k]);
        if (v === "") return null;
        return `${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
      })
      .filter(Boolean);

    return entries.join("&");
  }

  // Fallback: best-effort stringification.
  return String(value);
}

/**
 * Serialize a flat object payload to a deterministic string suitable for use
 * in a Redis key. Keys are sorted alphabetically and both keys and values
 * are URI-encoded to avoid delimiter collisions.
 *
 * @param {Record<string, any>} payload
 * @returns {string}
 */
function serializePayload(payload) {
  const keys = Object.keys(payload || {}).sort();

  if (keys.length === 0) {
    return "all"; // special token for "no filters"
  }

  const parts = [];

  for (const key of keys) {
    const raw = payload[key];
    const normalized = normalizeValueForKey(raw);

    // Skip undefined/null/empty string to avoid noise in keys.
    if (normalized === "") continue;

    parts.push(
      `${encodeURIComponent(key)}=${encodeURIComponent(normalized)}`
    );
  }

  if (parts.length === 0) {
    return "all";
  }

  return parts.join("|");
}

/**
 * Generic helper to build a namespaced, versioned cache key from a payload.
 *
 * Result format:
 *   <namespace>:<version>:<serialized-payload>
 *
 * Example:
 *   makeCacheKey("hotel_search", { city: "NYC", page: 1 })
 *   => "hotel_search:v1:city=NYC|page=1"
 *
 * @param {string} namespace - Logical namespace (see CACHE_NAMESPACES).
 * @param {Record<string, any>} payload - Filters/options relevant to the key.
 * @returns {string}
 */
export function makeCacheKey(namespace, payload) {
  const serialized = serializePayload(payload || {});
  return `${namespace}:${KEY_VERSION}:${serialized}`;
}

/**
 * Build a cache key for flight search results.
 *
 * The payload is intentionally generic; callers should pass whatever search
 * filters and options actually affect the results (origin, destination,
 * dates, price ranges, pagination, sorting, etc.).
 *
 * @param {Object} [filters={}]
 * @param {string} [filters.originAirportId]
 * @param {string} [filters.destinationAirportId]
 * @param {string} [filters.departureDateFrom]
 * @param {string} [filters.departureDateTo]
 * @param {number} [filters.minPrice]
 * @param {number} [filters.maxPrice]
 * @param {number} [filters.minStops]
 * @param {number} [filters.maxStops]
 * @param {string} [filters.cabinClass]
 * @param {boolean} [filters.onlyActive]
 * @param {Object} [options={}]
 * @param {number} [options.page]
 * @param {number} [options.pageSize]
 * @param {string} [options.sortBy]
 * @param {string} [options.sortOrder]
 * @returns {string}
 */
export function buildFlightSearchCacheKey(filters = {}, options = {}) {
  const payload = {
    // filters
    originAirportId: filters.originAirportId,
    destinationAirportId: filters.destinationAirportId,
    departureDateFrom: filters.departureDateFrom,
    departureDateTo: filters.departureDateTo,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    minStops: filters.minStops,
    maxStops: filters.maxStops,
    cabinClass: filters.cabinClass,
    onlyActive:
      typeof filters.onlyActive === "boolean" ? filters.onlyActive : true,
    // options
    page: options.page ?? 1,
    pageSize: options.pageSize ?? 20,
    sortBy: options.sortBy ?? "price",
    sortOrder: options.sortOrder ?? "asc",
  };

  return makeCacheKey(CACHE_NAMESPACES.FLIGHT_SEARCH, payload);
}

/**
 * Build a cache key for hotel search results.
 *
 * This helper is designed to support city/date-based searches with optional
 * price and star-rating filters, plus pagination and sorting.
 *
 * @param {Object} [filters={}]
 * @param {string} [filters.city]
 * @param {string} [filters.state]
 * @param {string} [filters.checkInDate]
 * @param {string} [filters.checkOutDate]
 * @param {number} [filters.minPrice]
 * @param {number} [filters.maxPrice]
 * @param {number} [filters.minStars]
 * @param {number} [filters.maxStars]
 * @param {string} [filters.nameContains]
 * @param {boolean} [filters.onlyActive]
 * @param {Object} [options={}]
 * @param {number} [options.page]
 * @param {number} [options.pageSize]
 * @param {string} [options.sortBy]
 * @param {string} [options.sortOrder]
 * @returns {string}
 */
export function buildHotelSearchCacheKey(filters = {}, options = {}) {
  const payload = {
    city: filters.city,
    state: filters.state,
    checkInDate: filters.checkInDate,
    checkOutDate: filters.checkOutDate,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    minStars: filters.minStars,
    maxStars: filters.maxStars,
    nameContains: filters.nameContains,
    onlyActive:
      typeof filters.onlyActive === "boolean" ? filters.onlyActive : true,
    page: options.page ?? 1,
    pageSize: options.pageSize ?? 20,
    sortBy: options.sortBy ?? "price",
    sortOrder: options.sortOrder ?? "asc",
  };

  return makeCacheKey(CACHE_NAMESPACES.HOTEL_SEARCH, payload);
}

/**
 * Build a cache key for rental car search results.
 *
 * Includes pickup/dropoff locations, price range, car type, and pagination /
 * sorting options.
 *
 * @param {Object} [filters={}]
 * @param {string} [filters.pickupCity]
 * @param {string} [filters.pickupState]
 * @param {string} [filters.pickupCountry]
 * @param {string} [filters.dropoffCity]
 * @param {string} [filters.dropoffState]
 * @param {string} [filters.dropoffCountry]
 * @param {string} [filters.carType]
 * @param {number} [filters.minPrice]
 * @param {number} [filters.maxPrice]
 * @param {boolean} [filters.onlyActive]
 * @param {Object} [options={}]
 * @param {number} [options.page]
 * @param {number} [options.pageSize]
 * @param {string} [options.sortBy]
 * @param {string} [options.sortOrder]
 * @returns {string}
 */
export function buildCarSearchCacheKey(filters = {}, options = {}) {
  const payload = {
    pickupCity: filters.pickupCity,
    pickupState: filters.pickupState,
    pickupCountry: filters.pickupCountry,
    dropoffCity: filters.dropoffCity,
    dropoffState: filters.dropoffState,
    dropoffCountry: filters.dropoffCountry,
    carType: filters.carType,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    onlyActive:
      typeof filters.onlyActive === "boolean" ? filters.onlyActive : true,
    page: options.page ?? 1,
    pageSize: options.pageSize ?? 20,
    sortBy: options.sortBy ?? "price",
    sortOrder: options.sortOrder ?? "asc",
  };

  return makeCacheKey(CACHE_NAMESPACES.CAR_SEARCH, payload);
}

/**
 * Build a cache key for a single user profile lookup. This is useful for
 * caching expensive user+stats queries (e.g., profile + booking summary).
 *
 * @param {string} userId - The relational user ID (users.id).
 * @returns {string}
 */
export function buildUserProfileCacheKey(userId) {
  return makeCacheKey(CACHE_NAMESPACES.USER_PROFILE, { userId });
}
