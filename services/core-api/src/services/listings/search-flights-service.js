/**
 * @file search-flights-service.js
 * @description
 * Service-level logic for searching flight listings.
 *
 * Responsibilities:
 * - Normalize and validate raw flight search filters (from controllers).
 * - Enforce basic domain rules (valid dates, price ranges, page bounds).
 * - Use the MySQL flights repository to execute paginated searches.
 * - Integrate Redis caching via the cache helpers and cache-key builders.
 * - Apply time-of-day filters (departure/arrival windows) on top of DB
 *   results where needed.
 *
 * Design notes:
 * - This service expects controllers to pass normalized IDs for airports
 *   (originAirportId/destinationAirportId). Mapping from IATA codes to
 *   airport IDs belongs in the controller or a dedicated lookup service.
 * - Time-of-day windows (e.g., only morning departures) are implemented
 *   as an in-memory filter on the page of results returned from MySQL.
 *   This is simpler to implement immediately and works well for typical
 *   page sizes, but it means:
 *     - `total` represents the total number of DB matches *before*
 *       applying time-of-day filters.
 *     - The number of items returned in `items` may be less than
 *       `pageSize` for a given page.
 *   A future optimization could push these filters down into SQL.
 */

import { searchFlights } from "../../repositories/mysql/flights-repository.js";
import {
  buildFlightSearchCacheKey,
} from "../../redis/cache-keys.js";
import {
  getOrSetSearchResult,
} from "../../redis/cache-helpers.js";
// DomainError is assumed to be the standard application error type used
// by the central error middleware to map codes to HTTP responses.
import { DomainError } from "../../lib/errors.js";

/**
 * @typedef {Object} RawFlightSearchFilters
 * @property {string} [originAirportId]
 * @property {string} [destinationAirportId]
 * @property {string} [departureDate]
 *   ISO-8601 date string (YYYY-MM-DD) representing the departure date.
 * @property {string} [returnDate]
 *   Optional return date (for validation only; search is one-way at the DB level).
 * @property {string|number} [minPrice]
 * @property {string|number} [maxPrice]
 * @property {string|number} [minStops]
 * @property {string|number} [maxStops]
 * @property {string} [cabinClass]
 *   Must match the DB ENUM: ECONOMY, PREMIUM_ECONOMY, BUSINESS, FIRST.
 * @property {string} [departureTimeFrom]
 *   Optional time-of-day window start for departure, e.g., "06:00".
 * @property {string} [departureTimeTo]
 *   Optional time-of-day window end for departure, e.g., "12:00".
 * @property {string} [arrivalTimeFrom]
 *   Optional time-of-day window start for arrival.
 * @property {string} [arrivalTimeTo]
 *   Optional time-of-day window end for arrival.
 * @property {boolean} [onlyActive]
 */

/**
 * @typedef {Object} RawFlightSearchOptions
 * @property {string} [sortBy]
 *   One of: "price", "duration", "departureTime", "rating".
 * @property {string} [sortOrder]
 *   "asc" or "desc".
 * @property {string|number} [page]
 *   1-based page number.
 * @property {string|number} [pageSize]
 *   Number of results per page (max 100).
 * @property {boolean} [skipCache]
 *   When true, bypass Redis and always hit MySQL.
 * @property {number} [ttlSeconds]
 *   Optional override for cache TTL.
 */

/**
 * @typedef {Object} NormalizedFlightDbFilters
 * @property {string|null} originAirportId
 * @property {string|null} destinationAirportId
 * @property {string|null} departureDateFrom
 * @property {string|null} departureDateTo
 * @property {number|null} minPrice
 * @property {number|null} maxPrice
 * @property {number|null} minStops
 * @property {number|null} maxStops
 * @property {string|null} cabinClass
 * @property {boolean} onlyActive
 */

/**
 * @typedef {Object} TimeWindowFilters
 * @property {number|null} departureTimeFromMinutes
 * @property {number|null} departureTimeToMinutes
 * @property {number|null} arrivalTimeFromMinutes
 * @property {number|null} arrivalTimeToMinutes
 */

/**
 * @typedef {Object} NormalizedFlightSearchOptions
 * @property {"price"|"duration"|"departureTime"|"rating"} sortBy
 * @property {"asc"|"desc"} sortOrder
 * @property {number} page
 * @property {number} pageSize
 * @property {number} limit
 * @property {number} offset
 * @property {boolean} skipCache
 * @property {number|undefined} ttlSeconds
 */

/**
 * @typedef {Object} FlightSearchResult
 * @property {Array<Object>} items
 *   Array of flight DTOs from the repository.
 * @property {number} total
 *   Total number of DB matches (before time-window filtering).
 * @property {number} page
 * @property {number} pageSize
 * @property {number} pageCount
 */

/**
 * Coerce an arbitrary value into a finite positive number or null.
 *
 * @param {unknown} value
 * @returns {number|null}
 */
function coercePositiveNumberOrNull(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    return null;
  }
  return n;
}

/**
 * Parse a time-of-day string into minutes since midnight.
 *
 * Accepted formats:
 * - "HH:mm"
 * - "HH:mm:ss" (seconds are ignored)
 *
 * @param {string|undefined|null} value
 * @param {string} fieldName
 * @returns {number|null}
 * @throws {DomainError} When the value is non-empty but invalid.
 */
function parseTimeOfDayToMinutes(value, fieldName) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const str = String(value).trim();
  const parts = str.split(":");
  if (parts.length < 2 || parts.length > 3) {
    throw new DomainError(
      "invalid_time_window",
      `Field "${fieldName}" must be in HH:mm or HH:mm:ss format.`
    );
  }

  const hours = Number.parseInt(parts[0], 10);
  const minutes = Number.parseInt(parts[1], 10);

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new DomainError(
      "invalid_time_window",
      `Field "${fieldName}" must represent a valid time-of-day.`
    );
  }

  return hours * 60 + minutes;
}

/**
 * Convert an ISO timestamp string into minutes since midnight (local time).
 *
 * @param {string} isoString
 * @returns {number}
 */
function getMinutesSinceMidnight(isoString) {
  const d = new Date(isoString);
  // If date is invalid, treat as 0 to avoid crashing the request.
  if (Number.isNaN(d.getTime())) return 0;
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Normalize and validate flight search filters and options.
 *
 * @param {RawFlightSearchFilters} rawFilters
 * @param {RawFlightSearchOptions} rawOptions
 * @returns {{
 *   dbFilters: NormalizedFlightDbFilters,
 *   timeFilters: TimeWindowFilters,
 *   options: NormalizedFlightSearchOptions
 * }}
 */
function normalizeFlightSearchInput(rawFilters = {}, rawOptions = {}) {
  const originAirportId =
    rawFilters.originAirportId != null && rawFilters.originAirportId !== ""
      ? String(rawFilters.originAirportId)
      : null;
  const destinationAirportId =
    rawFilters.destinationAirportId != null &&
    rawFilters.destinationAirportId !== ""
      ? String(rawFilters.destinationAirportId)
      : null;

  const departureDate =
    rawFilters.departureDate != null && rawFilters.departureDate !== ""
      ? String(rawFilters.departureDate)
      : null;
  const returnDate =
    rawFilters.returnDate != null && rawFilters.returnDate !== ""
      ? String(rawFilters.returnDate)
      : null;

  // Validate date formats (basic check using Date.parse)
  if (departureDate) {
    const t = Date.parse(departureDate);
    if (Number.isNaN(t)) {
      throw new DomainError(
        "invalid_date",
        `Field "departureDate" must be a valid ISO date string (YYYY-MM-DD).`
      );
    }
  }

  if (returnDate) {
    const t = Date.parse(returnDate);
    if (Number.isNaN(t)) {
      throw new DomainError(
        "invalid_date",
        `Field "returnDate" must be a valid ISO date string (YYYY-MM-DD).`
      );
    }
  }

  if (departureDate && returnDate) {
    const dep = new Date(departureDate).getTime();
    const ret = new Date(returnDate).getTime();
    if (ret < dep) {
      throw new DomainError(
        "invalid_date_range",
        "Return date must be on or after departure date."
      );
    }
  }

  // For now, we treat the search as one-way and search only by departureDate.
  const departureDateFrom = departureDate;
  const departureDateTo = departureDate;

  const minPrice = coercePositiveNumberOrNull(rawFilters.minPrice);
  const maxPrice = coercePositiveNumberOrNull(rawFilters.maxPrice);
  if (minPrice !== null && maxPrice !== null && maxPrice < minPrice) {
    throw new DomainError(
      "invalid_price_range",
      "maxPrice must be greater than or equal to minPrice."
    );
  }

  const minStops = coercePositiveNumberOrNull(rawFilters.minStops);
  const maxStops = coercePositiveNumberOrNull(rawFilters.maxStops);
  if (minStops !== null && maxStops !== null && maxStops < minStops) {
    throw new DomainError(
      "invalid_stops_range",
      "maxStops must be greater than or equal to minStops."
    );
  }

  const allowedCabinClasses = [
    "ECONOMY",
    "PREMIUM_ECONOMY",
    "BUSINESS",
    "FIRST",
  ];
  let cabinClass = null;
  if (rawFilters.cabinClass != null && rawFilters.cabinClass !== "") {
    const candidate = String(rawFilters.cabinClass).toUpperCase();
    if (!allowedCabinClasses.includes(candidate)) {
      throw new DomainError(
        "invalid_cabin_class",
        `cabinClass must be one of: ${allowedCabinClasses.join(", ")}.`
      );
    }
    cabinClass = candidate;
  }

  const onlyActive =
    typeof rawFilters.onlyActive === "boolean" ? rawFilters.onlyActive : true;

  /** @type {NormalizedFlightDbFilters} */
  const dbFilters = {
    originAirportId,
    destinationAirportId,
    departureDateFrom,
    departureDateTo,
    minPrice,
    maxPrice,
    minStops,
    maxStops,
    cabinClass,
    onlyActive,
  };

  // Time-of-day windows
  /** @type {TimeWindowFilters} */
  const timeFilters = {
    departureTimeFromMinutes: parseTimeOfDayToMinutes(
      rawFilters.departureTimeFrom,
      "departureTimeFrom"
    ),
    departureTimeToMinutes: parseTimeOfDayToMinutes(
      rawFilters.departureTimeTo,
      "departureTimeTo"
    ),
    arrivalTimeFromMinutes: parseTimeOfDayToMinutes(
      rawFilters.arrivalTimeFrom,
      "arrivalTimeFrom"
    ),
    arrivalTimeToMinutes: parseTimeOfDayToMinutes(
      rawFilters.arrivalTimeTo,
      "arrivalTimeTo"
    ),
  };

  // Sort & pagination
  const allowedSortBy = ["price", "duration", "departureTime", "rating"];
  let sortBy =
    rawOptions.sortBy && allowedSortBy.includes(String(rawOptions.sortBy))
      ? /** @type {"price"|"duration"|"departureTime"|"rating"} */ (
          rawOptions.sortBy
        )
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
  if (pageSize > 100) {
    pageSize = 100;
  }

  const limit = pageSize;
  const offset = (page - 1) * pageSize;

  const skipCache = rawOptions.skipCache === true;
  const ttlSeconds =
    typeof rawOptions.ttlSeconds === "number" && rawOptions.ttlSeconds > 0
      ? rawOptions.ttlSeconds
      : undefined;

  /** @type {NormalizedFlightSearchOptions} */
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

  return { dbFilters, timeFilters, options };
}

/**
 * Filter flights by time-of-day windows on departure/arrival.
 *
 * @param {Array<Object>} items
 * @param {TimeWindowFilters} timeFilters
 * @returns {Array<Object>}
 */
function filterFlightsByTimeWindows(items, timeFilters) {
  const {
    departureTimeFromMinutes,
    departureTimeToMinutes,
    arrivalTimeFromMinutes,
    arrivalTimeToMinutes,
  } = timeFilters;

  const hasDepartureWindow =
    departureTimeFromMinutes != null || departureTimeToMinutes != null;
  const hasArrivalWindow =
    arrivalTimeFromMinutes != null || arrivalTimeToMinutes != null;

  if (!hasDepartureWindow && !hasArrivalWindow) {
    return items;
  }

  return items.filter((flight) => {
    // We assume the repository returns ISO timestamp strings in departureTime and arrivalTime.
    const depMinutes = getMinutesSinceMidnight(flight.departureTime);
    const arrMinutes = getMinutesSinceMidnight(flight.arrivalTime);

    if (hasDepartureWindow) {
      if (
        departureTimeFromMinutes != null &&
        depMinutes < departureTimeFromMinutes
      ) {
        return false;
      }
      if (
        departureTimeToMinutes != null &&
        depMinutes > departureTimeToMinutes
      ) {
        return false;
      }
    }

    if (hasArrivalWindow) {
      if (
        arrivalTimeFromMinutes != null &&
        arrMinutes < arrivalTimeFromMinutes
      ) {
        return false;
      }
      if (
        arrivalTimeToMinutes != null &&
        arrMinutes > arrivalTimeToMinutes
      ) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Perform a flight search with filters, sorting, pagination, and caching.
 *
 * @param {RawFlightSearchFilters} rawFilters
 * @param {RawFlightSearchOptions} rawOptions
 * @returns {Promise<FlightSearchResult>}
 *
 * @throws {DomainError} On invalid filters (date, price, stops, etc.).
 */
export async function searchFlightsService(rawFilters = {}, rawOptions = {}) {
  const { dbFilters, timeFilters, options } = normalizeFlightSearchInput(
    rawFilters,
    rawOptions
  );

  // Build a cache key based on the DB-relevant filters and pagination options.
  // Time-of-day filters are *not* part of the cache key; instead, we reuse
  // the DB results and apply time filtering in memory.
  const cacheKey = buildFlightSearchCacheKey(dbFilters, {
    page: options.page,
    pageSize: options.pageSize,
    sortBy: options.sortBy,
    sortOrder: options.sortOrder,
  });

  const fetchFn = async () =>
    searchFlights(dbFilters, {
      limit: options.limit,
      offset: options.offset,
      sortBy: options.sortBy === "duration" ? "duration" : options.sortBy,
      sortOrder: options.sortOrder,
    });

  const dbResult = await getOrSetSearchResult(cacheKey, fetchFn, {
    skipCache: options.skipCache,
    ttlSeconds: options.ttlSeconds,
  });

  // dbResult is expected to be of shape { items, total } from the repository.
  const filteredItems = filterFlightsByTimeWindows(
    dbResult.items || [],
    timeFilters
  );

  const total = Number.isFinite(dbResult.total)
    ? Number(dbResult.total)
    : filteredItems.length;

  const pageCount =
    options.pageSize > 0 ? Math.ceil(total / options.pageSize) : 0;

  /** @type {FlightSearchResult} */
  const result = {
    items: filteredItems,
    total,
    page: options.page,
    pageSize: options.pageSize,
    pageCount,
  };

  return result;
}
