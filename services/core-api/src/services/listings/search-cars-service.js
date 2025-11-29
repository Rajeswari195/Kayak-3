/**
 * @file search-cars-service.js
 * @description
 * Service-level logic for searching rental car listings.
 *
 * Responsibilities:
 * - Normalize raw car search filters (pickup/dropoff locations, car type,
 *   price range) and pagination options.
 * - Validate basic domain constraints (e.g., price ranges).
 * - Execute paginated searches via the MySQL cars repository.
 * - Use Redis-based SQL result caching for fast repeated queries.
 */

import { searchCars } from "../../repositories/mysql/cars-repository.js";
import {
  buildCarSearchCacheKey,
} from "../../redis/cache-keys.js";
import {
  getOrSetSearchResult,
} from "../../redis/cache-helpers.js";
import { DomainError } from "../../lib/errors.js";

/**
 * @typedef {Object} RawCarSearchFilters
 * @property {string} [pickupCity]
 * @property {string} [pickupState]
 * @property {string} [pickupCountry]
 * @property {string} [dropoffCity]
 * @property {string} [dropoffState]
 * @property {string} [dropoffCountry]
 * @property {string} [carType]
 *   e.g., "ECONOMY", "SUV", etc. (business-defined enum).
 * @property {string|number} [minPrice]
 * @property {string|number} [maxPrice]
 * @property {string} [pickupDate]
 *   ISO date (YYYY-MM-DD), currently used for cache key / validation only.
 * @property {string} [dropoffDate]
 *   ISO date (YYYY-MM-DD), currently used for cache key / validation only.
 * @property {boolean} [onlyActive]
 */

/**
 * @typedef {Object} RawCarSearchOptions
 * @property {string} [sortBy]
 *   One of: "price", "rating".
 * @property {string} [sortOrder]
 *   "asc" or "desc".
 * @property {string|number} [page]
 * @property {string|number} [pageSize]
 * @property {boolean} [skipCache]
 * @property {number} [ttlSeconds]
 */

/**
 * @typedef {Object} NormalizedCarDbFilters
 * @property {string|null} pickupCity
 * @property {string|null} pickupState
 * @property {string|null} pickupCountry
 * @property {string|null} dropoffCity
 * @property {string|null} dropoffState
 * @property {string|null} dropoffCountry
 * @property {string|null} carType
 * @property {number|null} minPrice
 * @property {number|null} maxPrice
 * @property {string|null} pickupDate
 * @property {string|null} dropoffDate
 * @property {boolean} onlyActive
 */

/**
 * @typedef {Object} NormalizedCarSearchOptions
 * @property {"price"|"rating"} sortBy
 * @property {"asc"|"desc"} sortOrder
 * @property {number} page
 * @property {number} pageSize
 * @property {number} limit
 * @property {number} offset
 * @property {boolean} skipCache
 * @property {number|undefined} ttlSeconds
 */

/**
 * @typedef {Object} CarSearchResult
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
 * Normalize and validate car search inputs.
 *
 * @param {RawCarSearchFilters} rawFilters
 * @param {RawCarSearchOptions} rawOptions
 * @returns {{
 *   dbFilters: NormalizedCarDbFilters,
 *   options: NormalizedCarSearchOptions
 * }}
 */
function normalizeCarSearchInput(rawFilters = {}, rawOptions = {}) {
  const pickupCity =
    rawFilters.pickupCity != null && rawFilters.pickupCity !== ""
      ? String(rawFilters.pickupCity)
      : null;
  const pickupState =
    rawFilters.pickupState != null && rawFilters.pickupState !== ""
      ? String(rawFilters.pickupState)
      : null;
  const pickupCountry =
    rawFilters.pickupCountry != null && rawFilters.pickupCountry !== ""
      ? String(rawFilters.pickupCountry)
      : null;

  const dropoffCity =
    rawFilters.dropoffCity != null && rawFilters.dropoffCity !== ""
      ? String(rawFilters.dropoffCity)
      : null;
  const dropoffState =
    rawFilters.dropoffState != null && rawFilters.dropoffState !== ""
      ? String(rawFilters.dropoffState)
      : null;
  const dropoffCountry =
    rawFilters.dropoffCountry != null && rawFilters.dropoffCountry !== ""
      ? String(rawFilters.dropoffCountry)
      : null;

  const pickupDate =
    rawFilters.pickupDate != null && rawFilters.pickupDate !== ""
      ? String(rawFilters.pickupDate)
      : null;
  const dropoffDate =
    rawFilters.dropoffDate != null && rawFilters.dropoffDate !== ""
      ? String(rawFilters.dropoffDate)
      : null;

  if (pickupDate) {
    const t = Date.parse(pickupDate);
    if (Number.isNaN(t)) {
      throw new DomainError(
        "invalid_date",
        `Field "pickupDate" must be a valid ISO date string (YYYY-MM-DD).`
      );
    }
  }

  if (dropoffDate) {
    const t = Date.parse(dropoffDate);
    if (Number.isNaN(t)) {
      throw new DomainError(
        "invalid_date",
        `Field "dropoffDate" must be a valid ISO date string (YYYY-MM-DD).`
      );
    }
  }

  if (pickupDate && dropoffDate) {
    const p = new Date(pickupDate).getTime();
    const d = new Date(dropoffDate).getTime();
    if (d <= p) {
      throw new DomainError(
        "invalid_date_range",
        "dropoffDate must be after pickupDate."
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

  const carType =
    rawFilters.carType != null && rawFilters.carType !== ""
      ? String(rawFilters.carType)
      : null;

  const onlyActive =
    typeof rawFilters.onlyActive === "boolean" ? rawFilters.onlyActive : true;

  /** @type {NormalizedCarDbFilters} */
  const dbFilters = {
    pickupCity,
    pickupState,
    pickupCountry,
    dropoffCity,
    dropoffState,
    dropoffCountry,
    carType,
    minPrice,
    maxPrice,
    pickupDate,
    dropoffDate,
    onlyActive,
  };

  const allowedSortBy = ["price", "rating"];
  let sortBy =
    rawOptions.sortBy && allowedSortBy.includes(String(rawOptions.sortBy))
      ? /** @type {"price"|"rating"} */ (rawOptions.sortBy)
      : "price";

  let sortOrder = String(rawOptions.sortOrder || "asc")
    .toLowerCase()
    .trim();
  if (sortOrder !== "asc" && sortOrder !== "desc") {
    sortOrder = "asc";
  }

  let page = Number.parseInt(String(rawOptions.page || "1"), 10);
  if (!Number.isFinite(page) || page <= 0) page = 1;

  let pageSize = Number.parseInt(String(rawOptions.pageSize || "20"), 10);
  if (!Number.isFinite(pageSize) || pageSize <= 0) pageSize = 20;
  if (pageSize > 100) pageSize = 100;

  const limit = pageSize;
  const offset = (page - 1) * pageSize;

  const skipCache = rawOptions.skipCache === true;
  const ttlSeconds =
    typeof rawOptions.ttlSeconds === "number" && rawOptions.ttlSeconds > 0
      ? rawOptions.ttlSeconds
      : undefined;

  /** @type {NormalizedCarSearchOptions} */
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
 * Search cars with filters, sorting, pagination, and caching.
 *
 * @param {RawCarSearchFilters} rawFilters
 * @param {RawCarSearchOptions} rawOptions
 * @returns {Promise<CarSearchResult>}
 */
export async function searchCarsService(rawFilters = {}, rawOptions = {}) {
  const { dbFilters, options } = normalizeCarSearchInput(
    rawFilters,
    rawOptions
  );

  const cacheKey = buildCarSearchCacheKey(dbFilters, {
    page: options.page,
    pageSize: options.pageSize,
    sortBy: options.sortBy,
    sortOrder: options.sortOrder,
  });

  const fetchFn = async () =>
    searchCars(dbFilters, {
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

  /** @type {CarSearchResult} */
  const result = {
    items,
    total,
    page: options.page,
    pageSize: options.pageSize,
    pageCount,
  };

  return result;
}
