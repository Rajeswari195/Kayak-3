/**
 * @file listings-controller.js
 * @description
 * Express HTTP controllers for public listings search:
 *   - GET /search/flights
 *   - GET /search/hotels
 *   - GET /search/cars
 *
 * Responsibilities:
 * - Parse and validate query parameters coming from the client.
 * - Perform light domain validation (dates, price ranges, pagination).
 * - Resolve airport IATA codes to internal airport IDs when needed.
 * - Use Redis-backed caching helpers to cache search results.
 * - Delegate actual data fetching to the MySQL repositories.
 * - Return a consistent paginated response shape.
 *
 * Notes:
 * - These handlers do not require authentication; they represent the
 *   public-facing metasearch functionality.
 * - More advanced business logic (e.g., true availability by date, complex
 *   fare rules) can be layered on top of these controllers in future steps.
 */



import { mysqlQuery } from "../db/mysql.js";
import {
  searchFlights as searchFlightsRepo,
} from "../repositories/mysql/flights-repository.js";
import {
  searchHotels as searchHotelsRepo,
} from "../repositories/mysql/hotels-repository.js";
import {
  searchCars as searchCarsRepo,
} from "../repositories/mysql/cars-repository.js";

import {
  buildFlightSearchCacheKey,
  buildHotelSearchCacheKey,
  buildCarSearchCacheKey,
} from "../redis/cache-keys.js";
import {
  getOrSetSearchResult,
} from "../redis/cache-helpers.js";

/**
 * Helper: parse a positive integer with a default and floor at 1.
 *
 * @param {string | string[] | undefined} raw
 * @param {number} defaultValue
 * @returns {number}
 */
function parsePositiveInt(raw, defaultValue) {
  if (Array.isArray(raw)) raw = raw[0];
  if (raw === undefined || raw === null || raw === "") {
    return defaultValue;
  }
  const parsed = Number.parseInt(String(raw), 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return defaultValue;
  }
  return parsed;
}

/**
 * Helper: parse a float (price or numeric filter) or return null if empty.
 * If invalid and requiredForRange is true, pushes an error message into
 * the provided errors array.
 *
 * @param {string | string[] | undefined} raw
 * @param {string} fieldName
 * @param {string[]} errors
 * @param {boolean} [requiredForRange=false]
 * @returns {number | null}
 */
function parseOptionalNumber(raw, fieldName, errors, requiredForRange = false) {
  if (Array.isArray(raw)) raw = raw[0];
  if (raw === undefined || raw === null || raw === "") {
    return null;
  }
  const parsed = Number.parseFloat(String(raw));
  if (Number.isNaN(parsed)) {
    if (requiredForRange) {
      errors.push(`Field "${fieldName}" must be a number.`);
    }
    return null;
  }
  return parsed;
}

/**
 * Helper: validate a YYYY-MM-DD date string.
 *
 * @param {string | string[] | undefined} raw
 * @returns {{ value: string | null, error: string | null }}
 */
function parseIsoDateString(raw) {
  if (Array.isArray(raw)) raw = raw[0];
  if (!raw) {
    return { value: null, error: null };
  }
  const s = String(raw);
  const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoRegex.test(s)) {
    return {
      value: null,
      error: `Date "${s}" must be in YYYY-MM-DD format.`,
    };
  }
  return { value: s, error: null };
}

/**
 * Helper: compare two YYYY-MM-DD date strings lexicographically, which
 * works because of the fixed format.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number} negative if a < b, 0 if equal, positive if a > b
 */
function compareIsoDates(a, b) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/**
 * Helper: resolve an airport's internal ID (airports.id) by its IATA code.
 *
 * This is used so the public API can accept user-friendly IATA codes
 * (e.g., JFK, SFO) while the underlying schema still keys on airports.id.
 *
 * @param {string} iata
 * @returns {Promise<string | null>}
 */
async function resolveAirportIdByIata(iata) {
  const trimmed = iata.trim().toUpperCase();
  if (!trimmed) return null;

  const sql = `
    SELECT id
    FROM airports
    WHERE iata_code = ?
    LIMIT 1
  `;
  const rows = await mysqlQuery(sql, [trimmed]);
  if (!rows || rows.length === 0) {
    return null;
  }
  return rows[0].id;
}

/**
 * Helper: normalize sortBy/sortOrder query params for the three search
 * endpoints. The allowed values differ slightly by entity but the basic
 * pattern is shared.
 *
 * @param {string | undefined} rawSortBy
 * @param {string[]} allowed
 * @param {string} defaultSortBy
 * @param {string | undefined} rawSortOrder
 * @returns {{ sortBy: string, sortOrder: "asc" | "desc" }}
 */
function normalizeSortParams(rawSortBy, allowed, defaultSortBy, rawSortOrder) {
  const sortBy =
    rawSortBy && allowed.includes(rawSortBy) ? rawSortBy : defaultSortBy;

  let sortOrder = (rawSortOrder || "asc").toLowerCase();
  if (sortOrder !== "asc" && sortOrder !== "desc") {
    sortOrder = "asc";
  }

  return { sortBy, sortOrder };
}

/**
 * Controller: GET /search/flights
 *
 * Query params (all strings):
 * - originIata, destinationIata OR originAirportId, destinationAirportId
 * - departureDate (YYYY-MM-DD, required)
 * - priceMin, priceMax (optional numbers)
 * - minStops, maxStops (optional integers)
 * - cabinClass (optional enum: ECONOMY, PREMIUM_ECONOMY, BUSINESS, FIRST)
 * - page, pageSize (pagination)
 * - sortBy: price | duration | departureTime | rating
 * - sortOrder: asc | desc
 *
 * Response: 200 JSON
 * {
 *   items: [...],
 *   total: number,
 *   page: number,
 *   pageSize: number
 * }
 *
 * Error responses:
 * - 400 validation errors with { code: "validation_error", message, details? }
 */
export async function searchFlights(req, res, next) {
  try {
    const errors = [];

    // Pagination
    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = parsePositiveInt(req.query.pageSize, 20);

    // Dates
    const { value: departureDate, error: departureError } = parseIsoDateString(
      req.query.departureDate
    );
    if (!departureDate) {
      errors.push(
        departureError ||
        'Query parameter "departureDate" is required and must be YYYY-MM-DD.'
      );
    }

    const { value: returnDate, error: returnError } = parseIsoDateString(
      req.query.returnDate
    );
    if (returnError) {
      errors.push(returnError);
    }
    if (departureDate && returnDate) {
      if (compareIsoDates(returnDate, departureDate) < 0) {
        errors.push(
          '"returnDate" must not be earlier than "departureDate".'
        );
      }
    }

    // Price filters
    const minPrice = parseOptionalNumber(
      req.query.priceMin,
      "priceMin",
      errors
    );
    const maxPrice = parseOptionalNumber(
      req.query.priceMax,
      "priceMax",
      errors
    );
    if (
      minPrice != null &&
      maxPrice != null &&
      Number(minPrice) > Number(maxPrice)
    ) {
      errors.push('"priceMin" must be less than or equal to "priceMax".');
    }

    // Stops filters
    const minStopsRaw = Array.isArray(req.query.minStops)
      ? req.query.minStops[0]
      : req.query.minStops;
    const maxStopsRaw = Array.isArray(req.query.maxStops)
      ? req.query.maxStops[0]
      : req.query.maxStops;

    const minStops =
      minStopsRaw !== undefined && minStopsRaw !== null && minStopsRaw !== ""
        ? Number.parseInt(String(minStopsRaw), 10)
        : null;
    const maxStops =
      maxStopsRaw !== undefined && maxStopsRaw !== null && maxStopsRaw !== ""
        ? Number.parseInt(String(maxStopsRaw), 10)
        : null;

    if (
      minStops !== null &&
      (Number.isNaN(minStops) || minStops < 0 || minStops > 3)
    ) {
      errors.push(
        '"minStops" must be an integer between 0 and 3 (inclusive) if provided.'
      );
    }
    if (
      maxStops !== null &&
      (Number.isNaN(maxStops) || maxStops < 0 || maxStops > 3)
    ) {
      errors.push(
        '"maxStops" must be an integer between 0 and 3 (inclusive) if provided.'
      );
    }
    if (
      minStops !== null &&
      maxStops !== null &&
      minStops > maxStops
    ) {
      errors.push('"minStops" must be <= "maxStops".');
    }

    // Cabin class
    const allowedCabinClasses = [
      "ECONOMY",
      "PREMIUM_ECONOMY",
      "BUSINESS",
      "FIRST",
    ];
    const rawCabin =
      Array.isArray(req.query.class) && req.query.class.length > 0
        ? req.query.class[0]
        : req.query.class || req.query.cabinClass;

    let cabinClass = null;
    if (rawCabin) {
      const normalized = String(rawCabin).toUpperCase();
      if (!allowedCabinClasses.includes(normalized)) {
        errors.push(
          `"class" must be one of ${allowedCabinClasses.join(", ")}.`
        );
      } else {
        cabinClass = normalized;
      }
    }

    // Sort params
    const { sortBy, sortOrder } = normalizeSortParams(
      typeof req.query.sortBy === "string" ? req.query.sortBy : undefined,
      ["price", "duration", "departureTime", "rating"],
      "price",
      typeof req.query.sortOrder === "string"
        ? req.query.sortOrder
        : undefined
    );

    // If any validation errors so far, bail out.
    if (errors.length > 0) {
      return res.status(400).json({
        code: "validation_error",
        message: "Invalid query parameters for flight search.",
        details: errors,
      });
    }

    // Resolve airports: support both IATA and raw airport IDs.
    let originAirportId =
      (Array.isArray(req.query.originAirportId)
        ? req.query.originAirportId[0]
        : req.query.originAirportId) || null;
    let destinationAirportId =
      (Array.isArray(req.query.destinationAirportId)
        ? req.query.destinationAirportId[0]
        : req.query.destinationAirportId) || null;

    const originIata = Array.isArray(req.query.originIata)
      ? req.query.originIata[0]
      : req.query.originIata;
    const destinationIata = Array.isArray(req.query.destinationIata)
      ? req.query.destinationIata[0]
      : req.query.destinationIata;

    if (!originAirportId && originIata) {
      const resolved = await resolveAirportIdByIata(originIata);
      if (!resolved) {
        return res.status(400).json({
          code: "invalid_airport_code",
          message: `Unknown origin airport IATA code "${originIata}".`,
        });
      }
      originAirportId = resolved;
    }

    if (!destinationAirportId && destinationIata) {
      const resolved = await resolveAirportIdByIata(destinationIata);
      if (!resolved) {
        return res.status(400).json({
          code: "invalid_airport_code",
          message: `Unknown destination airport IATA code "${destinationIata}".`,
        });
      }
      destinationAirportId = resolved;
    }

    if (!originAirportId || !destinationAirportId) {
      return res.status(400).json({
        code: "validation_error",
        message:
          'Both origin and destination must be provided as either "originIata"/"destinationIata" or "originAirportId"/"destinationAirportId".',
      });
    }

    const filters = {
      originAirportId,
      destinationAirportId,
      departureDateFrom: departureDate,
      departureDateTo: departureDate,
      minPrice,
      maxPrice,
      minStops: minStops !== null ? minStops : undefined,
      maxStops: maxStops !== null ? maxStops : undefined,
      cabinClass,
      onlyActive: true,
    };

    const options = {
      limit: pageSize,
      offset: (page - 1) * pageSize,
      sortBy: sortBy === "duration" ? "duration" : sortBy, // maps to repository's sortKey
      sortOrder,
    };

    const cacheKey = buildFlightSearchCacheKey(filters, {
      page,
      pageSize,
      sortBy: options.sortBy,
      sortOrder,
    });

    const result = await getOrSetSearchResult(cacheKey, () =>
      searchFlightsRepo(filters, options)
    );

    return res.status(200).json({
      ...result,
      page,
      pageSize,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Controller: GET /search/hotels
 *
 * Query params:
 * - city (optional but typically provided)
 * - state (optional; useful for disambiguation)
 * - checkInDate, checkOutDate (YYYY-MM-DD; validated but not yet used to
 *   compute true inventory availability at the room level in this step)
 * - priceMin, priceMax
 * - starsMin, starsMax
 * - nameContains
 * - page, pageSize
 * - sortBy: price | rating | stars
 * - sortOrder: asc | desc
 *
 * Response: 200 JSON with { items, total, page, pageSize }
 */
export async function searchHotels(req, res, next) {
  try {
    const errors = [];

    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = parsePositiveInt(req.query.pageSize, 20);

    const { value: checkInDate, error: checkInError } = parseIsoDateString(
      req.query.checkInDate
    );
    const { value: checkOutDate, error: checkOutError } = parseIsoDateString(
      req.query.checkOutDate
    );

    if (checkInError) errors.push(checkInError);
    if (checkOutError) errors.push(checkOutError);

    if (checkInDate && checkOutDate) {
      if (compareIsoDates(checkOutDate, checkInDate) <= 0) {
        errors.push(
          '"checkOutDate" must be after "checkInDate".'
        );
      }
    }

    const minPrice = parseOptionalNumber(
      req.query.priceMin,
      "priceMin",
      errors
    );
    const maxPrice = parseOptionalNumber(
      req.query.priceMax,
      "priceMax",
      errors
    );
    if (
      minPrice != null &&
      maxPrice != null &&
      Number(minPrice) > Number(maxPrice)
    ) {
      errors.push('"priceMin" must be <= "priceMax".');
    }

    const minStars = parseOptionalNumber(
      req.query.starsMin,
      "starsMin",
      errors
    );
    const maxStars = parseOptionalNumber(
      req.query.starsMax,
      "starsMax",
      errors
    );
    if (
      minStars != null &&
      maxStars != null &&
      Number(minStars) > Number(maxStars)
    ) {
      errors.push('"starsMin" must be <= "starsMax".');
    }

    const { sortBy, sortOrder } = normalizeSortParams(
      typeof req.query.sortBy === "string" ? req.query.sortBy : undefined,
      ["price", "rating", "stars"],
      "price",
      typeof req.query.sortOrder === "string"
        ? req.query.sortOrder
        : undefined
    );

    if (errors.length > 0) {
      return res.status(400).json({
        code: "validation_error",
        message: "Invalid query parameters for hotel search.",
        details: errors,
      });
    }

    const city =
      (Array.isArray(req.query.city) ? req.query.city[0] : req.query.city) ||
      null;
    const state =
      (Array.isArray(req.query.state) ? req.query.state[0] : req.query.state) ||
      null;
    const nameContains = Array.isArray(req.query.nameContains)
      ? req.query.nameContains[0]
      : req.query.nameContains;

    const filters = {
      city: city || undefined,
      state: state || undefined,
      checkInDate: checkInDate || undefined,
      checkOutDate: checkOutDate || undefined,
      minPrice,
      maxPrice,
      minStars,
      maxStars,
      nameContains: nameContains || undefined,
      onlyActive: true,
    };

    const options = {
      limit: pageSize,
      offset: (page - 1) * pageSize,
      sortBy:
        sortBy === "stars"
          ? "stars"
          : sortBy === "rating"
            ? "rating"
            : "price",
      sortOrder,
    };

    const cacheKey = buildHotelSearchCacheKey(filters, {
      page,
      pageSize,
      sortBy: options.sortBy,
      sortOrder,
    });

    const result = await getOrSetSearchResult(cacheKey, () =>
      searchHotelsRepo(filters, options)
    );

    return res.status(200).json({
      ...result,
      page,
      pageSize,
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * Controller: GET /search/cars
 *
 * Query params:
 * - pickupCity, pickupState, pickupCountry
 * - dropoffCity, dropoffState, dropoffCountry
 * - carType
 * - priceMin, priceMax
 * - page, pageSize
 * - sortBy: price | rating
 * - sortOrder: asc | desc
 *
 * Response: 200 JSON with { items, total, page, pageSize }
 */
export async function searchCars(req, res, next) {
  try {
    const errors = [];

    const page = parsePositiveInt(req.query.page, 1);
    const pageSize = parsePositiveInt(req.query.pageSize, 20);

    const minPrice = parseOptionalNumber(
      req.query.priceMin,
      "priceMin",
      errors
    );
    const maxPrice = parseOptionalNumber(
      req.query.priceMax,
      "priceMax",
      errors
    );
    if (
      minPrice != null &&
      maxPrice != null &&
      Number(minPrice) > Number(maxPrice)
    ) {
      errors.push('"priceMin" must be <= "priceMax".');
    }

    const { sortBy, sortOrder } = normalizeSortParams(
      typeof req.query.sortBy === "string" ? req.query.sortBy : undefined,
      ["price", "rating"],
      "price",
      typeof req.query.sortOrder === "string"
        ? req.query.sortOrder
        : undefined
    );

    if (errors.length > 0) {
      return res.status(400).json({
        code: "validation_error",
        message: "Invalid query parameters for car search.",
        details: errors,
      });
    }

    const pickupCity = Array.isArray(req.query.pickupCity)
      ? req.query.pickupCity[0]
      : req.query.pickupCity;
    const pickupState = Array.isArray(req.query.pickupState)
      ? req.query.pickupState[0]
      : req.query.pickupState;
    const pickupCountry = Array.isArray(req.query.pickupCountry)
      ? req.query.pickupCountry[0]
      : req.query.pickupCountry;

    const dropoffCity = Array.isArray(req.query.dropoffCity)
      ? req.query.dropoffCity[0]
      : req.query.dropoffCity;
    const dropoffState = Array.isArray(req.query.dropoffState)
      ? req.query.dropoffState[0]
      : req.query.dropoffState;
    const dropoffCountry = Array.isArray(req.query.dropoffCountry)
      ? req.query.dropoffCountry[0]
      : req.query.dropoffCountry;

    const carType = Array.isArray(req.query.carType)
      ? req.query.carType[0]
      : req.query.carType;

    const filters = {
      pickupCity: pickupCity || undefined,
      pickupState: pickupState || undefined,
      pickupCountry: pickupCountry || undefined,
      dropoffCity: dropoffCity || undefined,
      dropoffState: dropoffState || undefined,
      dropoffCountry: dropoffCountry || undefined,
      carType: carType || undefined,
      minPrice,
      maxPrice,
      onlyActive: true,
    };

    const options = {
      limit: pageSize,
      offset: (page - 1) * pageSize,
      sortBy: sortBy === "rating" ? "rating" : "price",
      sortOrder,
    };

    const cacheKey = buildCarSearchCacheKey(filters, {
      page,
      pageSize,
      sortBy: options.sortBy,
      sortOrder,
    });

    const result = await getOrSetSearchResult(cacheKey, () =>
      searchCarsRepo(filters, options)
    );

    return res.status(200).json({
      ...result,
      page,
      pageSize,
    });
  } catch (err) {
    return next(err);
  }
}
