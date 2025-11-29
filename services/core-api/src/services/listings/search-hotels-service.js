/**
 * @file search-hotels-service.js
 * @description
 * Service-level logic for searching hotel listings.
 *
 * Responsibilities:
 * - Normalize raw hotel search filters and pagination options.
 * - Enforce basic domain rules (valid price ranges, date ranges).
 * - Use the MySQL hotels repository for paginated searches.
 * - Integrate Redis caching via cache helpers and cache-key builders.
 *
 * Notes:
 * - This service currently treats check-in/check-out dates as *search
 *   parameters* (for cache keying and validation), but availability is not
 *   enforced at the SQL layer yet. Inventory-aware search can be added later
 *   using bookings/room inventory tables.
 */

import { searchHotels } from "../../repositories/mysql/hotels-repository.js";
import {
  buildHotelSearchCacheKey,
} from "../../redis/cache-keys.js";
import {
  getOrSetSearchResult,
} from "../../redis/cache-helpers.js";
import { DomainError } from "../../lib/errors.js";

/**
 * @typedef {Object} RawHotelSearchFilters
 * @property {string} [city]
 * @property {string} [state]
 * @property {string} [checkInDate]
 *   ISO-8601 date string (YYYY-MM-DD).
 * @property {string} [checkOutDate]
 *   ISO-8601 date string (YYYY-MM-DD).
 * @property {string|number} [minPrice]
 * @property {string|number} [maxPrice]
 * @property {string|number} [minStars]
 * @property {string|number} [maxStars]
 * @property {string} [nameContains]
 * @property {boolean} [onlyActive]
 */

/**
 * @typedef {Object} RawHotelSearchOptions
 * @property {string} [sortBy]
 *   One of: "price", "rating", "stars".
 * @property {string} [sortOrder]
 *   "asc" or "desc".
 * @property {string|number} [page]
 * @property {string|number} [pageSize]
 * @property {boolean} [skipCache]
 * @property {number} [ttlSeconds]
 */

/**
 * @typedef {Object} NormalizedHotelDbFilters
 * @property {string|null} city
 * @property {string|null} state
 * @property {string|null} checkInDate
 * @property {string|null} checkOutDate
 * @property {number|null} minPrice
 * @property {number|null} maxPrice
 * @property {number|null} minStars
 * @property {number|null} maxStars
 * @property {string|null} nameContains
 * @property {boolean} onlyActive
 */

/**
 * @typedef {Object} NormalizedHotelSearchOptions
 * @property {"price"|"rating"|"stars"} sortBy
 * @property {"asc"|"desc"} sortOrder
 * @property {number} page
 * @property {number} pageSize
 * @property {number} limit
 * @property {number} offset
 * @property {boolean} skipCache
 * @property {number|undefined} ttlSeconds
 */

/**
 * @typedef {Object} HotelSearchResult
 * @property {Array<Object>} items
 * @property {number} total
 * @property {number} page
 * @property {number} pageSize
 * @property {number} pageCount
 */

/**
 * Coerce to non-negative number or null.
 *
 * @param {unknown} value
 * @returns {number|null}
 */
function coerceNonNegativeNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * Normalize and validate hotel search input.
 *
 * @param {RawHotelSearchFilters} rawFilters
 * @param {RawHotelSearchOptions} rawOptions
 * @returns {{
 *   dbFilters: NormalizedHotelDbFilters,
 *   options: NormalizedHotelSearchOptions
 * }}
 */
function normalizeHotelSearchInput(rawFilters = {}, rawOptions = {}) {
  const city =
    rawFilters.city != null && rawFilters.city !== ""
      ? String(rawFilters.city)
      : null;
  const state =
    rawFilters.state != null && rawFilters.state !== ""
      ? String(rawFilters.state)
      : null;

  const checkInDate =
    rawFilters.checkInDate != null && rawFilters.checkInDate !== ""
      ? String(rawFilters.checkInDate)
      : null;
  const checkOutDate =
    rawFilters.checkOutDate != null && rawFilters.checkOutDate !== ""
      ? String(rawFilters.checkOutDate)
      : null;

  if (checkInDate) {
    const t = Date.parse(checkInDate);
    if (Number.isNaN(t)) {
      throw new DomainError(
        "invalid_date",
        `Field "checkInDate" must be a valid ISO date string (YYYY-MM-DD).`
      );
    }
  }
  if (checkOutDate) {
    const t = Date.parse(checkOutDate);
    if (Number.isNaN(t)) {
      throw new DomainError(
        "invalid_date",
        `Field "checkOutDate" must be a valid ISO date string (YYYY-MM-DD).`
      );
    }
  }
  if (checkInDate && checkOutDate) {
    const inTime = new Date(checkInDate).getTime();
    const outTime = new Date(checkOutDate).getTime();
    if (outTime <= inTime) {
      throw new DomainError(
        "invalid_date_range",
        "checkOutDate must be after checkInDate."
      );
    }
  }

  const minPrice = coerceNonNegativeNumberOrNull(rawFilters.minPrice);
  const maxPrice = coerceNonNegativeNumberOrNull(rawFilters.maxPrice);
  if (minPrice !== null && maxPrice !== null && maxPrice < minPrice) {
    throw new DomainError(
      "invalid_price_range",
      "maxPrice must be greater than or equal to minPrice."
    );
  }

  const minStars = coerceNonNegativeNumberOrNull(rawFilters.minStars);
  const maxStars = coerceNonNegativeNumberOrNull(rawFilters.maxStars);
  if (minStars !== null && maxStars !== null && maxStars < minStars) {
    throw new DomainError(
      "invalid_rating_range",
      "maxStars must be greater than or equal to minStars."
    );
  }

  const nameContains =
    rawFilters.nameContains != null && rawFilters.nameContains !== ""
      ? String(rawFilters.nameContains)
      : null;

  const onlyActive =
    typeof rawFilters.onlyActive === "boolean" ? rawFilters.onlyActive : true;

  /** @type {NormalizedHotelDbFilters} */
  const dbFilters = {
    city,
    state,
    checkInDate,
    checkOutDate,
    minPrice,
    maxPrice,
    minStars,
    maxStars,
    nameContains,
    onlyActive,
  };

  const allowedSortBy = ["price", "rating", "stars"];
  let sortBy =
    rawOptions.sortBy && allowedSortBy.includes(String(rawOptions.sortBy))
      ? /** @type {"price"|"rating"|"stars"} */ (rawOptions.sortBy)
      : "price";

  let sortOrder = String(rawOptions.sortOrder || "asc")
    .toLowerCase()
    .trim();
  if (sortOrder !== "asc" && sortOrder !== "desc") {
    sortOrder = "asc";
  }

  let page = Number.parseInt(String(rawOptions.page || "1"), 10);
  if (!Number.isFinite(page) || page <= 0) {
    page = 1;
  }

  let pageSize = Number.parseInt(String(rawOptions.pageSize || "20"), 10);
  if (!Number.isFinite(pageSize) || pageSize <= 0) {
    pageSize = 20;
  }
  if (pageSize > 100) pageSize = 100;

  const limit = pageSize;
  const offset = (page - 1) * pageSize;

  const skipCache = rawOptions.skipCache === true;
  const ttlSeconds =
    typeof rawOptions.ttlSeconds === "number" && rawOptions.ttlSeconds > 0
      ? rawOptions.ttlSeconds
      : undefined;

  /** @type {NormalizedHotelSearchOptions} */
  const options = {
    sortBy,
    sortOrder,
    page,
    pageSize,
    limit,
    offset,
    skipCache,
    ttlSeconds,
  };

  return { dbFilters, options };
}

/**
 * Search hotels with filters, sorting, pagination, and caching.
 *
 * @param {RawHotelSearchFilters} rawFilters
 * @param {RawHotelSearchOptions} rawOptions
 * @returns {Promise<HotelSearchResult>}
 */
export async function searchHotelsService(
  rawFilters = {},
  rawOptions = {}
) {
  const { dbFilters, options } = normalizeHotelSearchInput(
    rawFilters,
    rawOptions
  );

  const cacheKey = buildHotelSearchCacheKey(dbFilters, {
    page: options.page,
    pageSize: options.pageSize,
    sortBy: options.sortBy,
    sortOrder: options.sortOrder,
  });

  const fetchFn = async () =>
    searchHotels(dbFilters, {
      limit: options.limit,
      offset: options.offset,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder,
    });

  const dbResult = await getOrSetSearchResult(cacheKey, fetchFn, {
    skipCache: options.skipCache,
    ttlSeconds: options.ttlSeconds,
  });

  const items = dbResult.items || [];
  const total = Number.isFinite(dbResult.total)
    ? Number(dbResult.total)
    : items.length;

  const pageCount =
    options.pageSize > 0 ? Math.ceil(total / options.pageSize) : 0;

  /** @type {HotelSearchResult} */
  const result = {
    items,
    total,
    page: options.page,
    pageSize: options.pageSize,
    pageCount,
  };

  return result;
}
