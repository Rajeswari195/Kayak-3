/**
 * @file flights-repository.js
 * @description
 * MySQL repository functions for working with flight listings in the
 * Kayak-like travel platform.
 *
 * Responsibilities:
 * - Provide low-level data access functions for the `flights` table:
 *   - Create new flight rows.
 *   - Update existing flights (partial updates).
 *   - Soft-deactivate flights via `is_active`.
 *   - Fetch individual flights by ID.
 *   - Search flights using common filters and pagination.
 *
 * Design notes:
 * - This layer is intentionally "dumb": it performs SQL queries and basic
 *   mapping between DB rows and JS objects, but does not enforce complex
 *   business rules. Those belong in the service layer.
 * - Filters such as date ranges and price ranges are implemented in a
 *   flexible way to support future extensions (e.g., multi-city searches).
 * - All dynamic SQL is constructed using parameterized queries to avoid
 *   injection vulnerabilities. Sort columns/directions are whitelisted.
 *
 * @dependencies
 * - ../../db/mysql.js: provides `mysqlQuery` and optional transactional
 *   connection handling via PoolConnection.
 */

import { mysqlQuery } from "../../db/mysql.js";

/**
 * @typedef {Object} FlightRow
 * @property {string} id
 * @property {string} flight_number
 * @property {string} airline
 * @property {string} origin_airport_id
 * @property {string} destination_airport_id
 * @property {Date|string} departure_time
 * @property {Date|string} arrival_time
 * @property {number} total_duration_minutes
 * @property {number} stops
 * @property {string} cabin_class
 * @property {number} base_price
 * @property {string} currency
 * @property {number} seats_total
 * @property {number} seats_available
 * @property {number|null} rating_avg
 * @property {number} rating_count
 * @property {number} is_active
 * @property {Date|string} created_at
 * @property {Date|string} updated_at
 */

/**
 * @typedef {Object} Flight
 * @property {string} id
 * @property {string} flightNumber
 * @property {string} airline
 * @property {string} originAirportId
 * @property {string} destinationAirportId
 * @property {string} departureTime ISO string (UTC or app convention)
 * @property {string} arrivalTime ISO string (UTC or app convention)
 * @property {number} totalDurationMinutes
 * @property {number} stops
 * @property {("ECONOMY"|"PREMIUM_ECONOMY"|"BUSINESS"|"FIRST")} cabinClass
 * @property {number} basePrice
 * @property {string} currency
 * @property {number} seatsTotal
 * @property {number} seatsAvailable
 * @property {number|null} ratingAvg
 * @property {number} ratingCount
 * @property {boolean} isActive
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} CreateFlightInput
 * @property {string} id UUID for the new flight.
 * @property {string} flightNumber
 * @property {string} airline
 * @property {string} originAirportId
 * @property {string} destinationAirportId
 * @property {string|Date} departureTime
 * @property {string|Date} arrivalTime
 * @property {number} totalDurationMinutes
 * @property {number} stops
 * @property {("ECONOMY"|"PREMIUM_ECONOMY"|"BUSINESS"|"FIRST")} cabinClass
 * @property {number} basePrice
 * @property {string} currency
 * @property {number} seatsTotal
 * @property {number} seatsAvailable
 */

/**
 * @typedef {Object} UpdateFlightInput
 * @property {string} id
 * @property {string} [flightNumber]
 * @property {string} [airline]
 * @property {string} [originAirportId]
 * @property {string} [destinationAirportId]
 * @property {string|Date} [departureTime]
 * @property {string|Date} [arrivalTime]
 * @property {number} [totalDurationMinutes]
 * @property {number} [stops]
 * @property {("ECONOMY"|"PREMIUM_ECONOMY"|"BUSINESS"|"FIRST")} [cabinClass]
 * @property {number} [basePrice]
 * @property {string} [currency]
 * @property {number} [seatsTotal]
 * @property {number} [seatsAvailable]
 * @property {boolean} [isActive]
 */

/**
 * @typedef {Object} FlightSearchFilters
 * @property {string} [originAirportId]
 * @property {string} [destinationAirportId]
 * @property {string} [departureDateFrom] - ISO date (YYYY-MM-DD)
 * @property {string} [departureDateTo] - ISO date (YYYY-MM-DD)
 * @property {number} [minPrice]
 * @property {number} [maxPrice]
 * @property {number} [minStops]
 * @property {number} [maxStops]
 * @property {("ECONOMY"|"PREMIUM_ECONOMY"|"BUSINESS"|"FIRST")} [cabinClass]
 * @property {boolean} [onlyActive=true]
 */

/**
 * @typedef {Object} FlightSearchOptions
 * @property {number} [limit=20]
 * @property {number} [offset=0]
 * @property {("price"|"duration"|"departureTime"|"rating")} [sortBy="price"]
 * @property {("asc"|"desc")} [sortOrder="asc"]
 */

/**
 * @typedef {Object} FlightSearchResult
 * @property {Flight[]} items
 * @property {number} total
 */

/**
 * Map a raw DB row (snake_case) to a flight domain object (camelCase).
 *
 * @param {FlightRow} row
 * @returns {Flight}
 */
function mapFlightRowToFlight(row) {
  return {
    id: row.id,
    flightNumber: row.flight_number,
    airline: row.airline,
    originAirportId: row.origin_airport_id,
    destinationAirportId: row.destination_airport_id,
    departureTime: new Date(row.departure_time).toISOString(),
    arrivalTime: new Date(row.arrival_time).toISOString(),
    totalDurationMinutes: Number(row.total_duration_minutes),
    stops: Number(row.stops),
    cabinClass: row.cabin_class,
    basePrice: Number(row.base_price),
    currency: row.currency,
    seatsTotal: Number(row.seats_total),
    seatsAvailable: Number(row.seats_available),
    ratingAvg: row.rating_avg !== null ? Number(row.rating_avg) : null,
    ratingCount: Number(row.rating_count),
    isActive: row.is_active === 1 || row.is_active === true,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

/**
 * Helper to build WHERE clause and parameters for flight search queries.
 *
 * Notes:
 * - We keep this private to this module so both the COUNT(*) and SELECT
 *   queries share identical filtering logic.
 *
 * @param {FlightSearchFilters} filters
 * @returns {{ whereSql: string, params: any[] }}
 */
function buildFlightsWhereClause(filters = {}) {
  const clauses = ["1=1"];
  const params = [];

  if (filters.originAirportId) {
    clauses.push("origin_airport_id = ?");
    params.push(filters.originAirportId);
  }

  if (filters.destinationAirportId) {
    clauses.push("destination_airport_id = ?");
    params.push(filters.destinationAirportId);
  }

  if (filters.departureDateFrom) {
    // Assumes departure_time stored as DATETIME; compare by DATE component.
    clauses.push("DATE(departure_time) >= ?");
    params.push(filters.departureDateFrom);
  }

  if (filters.departureDateTo) {
    clauses.push("DATE(departure_time) <= ?");
    params.push(filters.departureDateTo);
  }

  if (typeof filters.minPrice === "number") {
    clauses.push("base_price >= ?");
    params.push(filters.minPrice);
  }

  if (typeof filters.maxPrice === "number") {
    clauses.push("base_price <= ?");
    params.push(filters.maxPrice);
  }

  if (typeof filters.minStops === "number") {
    clauses.push("stops >= ?");
    params.push(filters.minStops);
  }

  if (typeof filters.maxStops === "number") {
    clauses.push("stops <= ?");
    params.push(filters.maxStops);
  }

  if (filters.cabinClass) {
    clauses.push("cabin_class = ?");
    params.push(filters.cabinClass);
  }

  const onlyActive =
    typeof filters.onlyActive === "boolean" ? filters.onlyActive : true;
  if (onlyActive) {
    clauses.push("is_active = 1");
  }

  return {
    whereSql: "WHERE " + clauses.join(" AND "),
    params,
  };
}

/**
 * Insert a new flight row into the database.
 *
 * Edge cases / behavior:
 * - If the ID already exists, MySQL will raise a duplicate-key error.
 *   The service layer should handle and translate that error into an
 *   appropriate domain-level error if desired.
 *
 * @param {CreateFlightInput} input
 * @param {import("mysql2/promise").PoolConnection | null} [connection]
 * @returns {Promise<Flight>}
 */
export async function createFlight(input, connection = null) {
  const sql = `
    INSERT INTO flights (
      id,
      flight_number,
      airline,
      origin_airport_id,
      destination_airport_id,
      departure_time,
      arrival_time,
      total_duration_minutes,
      stops,
      cabin_class,
      base_price,
      currency,
      seats_total,
      seats_available,
      rating_avg,
      rating_count,
      is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, 1)
  `;

  const params = [
    input.id,
    input.flightNumber,
    input.airline,
    input.originAirportId,
    input.destinationAirportId,
    input.departureTime,
    input.arrivalTime,
    input.totalDurationMinutes,
    input.stops,
    input.cabinClass,
    input.basePrice,
    input.currency,
    input.seatsTotal,
    input.seatsAvailable,
  ];

  await mysqlQuery(sql, params, connection);

  const [row] = await mysqlQuery(
    "SELECT * FROM flights WHERE id = ?",
    [input.id],
    connection
  );

  // In practice this should never be undefined immediately after INSERT.
  if (!row) {
    throw new Error(
      "[flights-repository] Failed to fetch flight after INSERT (id=" +
        input.id +
        ")"
    );
  }

  return mapFlightRowToFlight(/** @type {FlightRow} */ (row));
}

/**
 * Update an existing flight with a partial set of fields.
 *
 * Notes:
 * - If the `fieldsToUpdate` object is empty or only contains `id`, this
 *   function is a no-op and simply returns the current record.
 * - Returns `null` if no flight was found with the given ID.
 *
 * @param {UpdateFlightInput} fieldsToUpdate
 * @param {import("mysql2/promise").PoolConnection | null} [connection]
 * @returns {Promise<Flight | null>}
 */
export async function updateFlight(fieldsToUpdate, connection = null) {
  const { id, ...rest } = fieldsToUpdate;

  const setFragments = [];
  const params = [];

  if (rest.flightNumber !== undefined) {
    setFragments.push("flight_number = ?");
    params.push(rest.flightNumber);
  }
  if (rest.airline !== undefined) {
    setFragments.push("airline = ?");
    params.push(rest.airline);
  }
  if (rest.originAirportId !== undefined) {
    setFragments.push("origin_airport_id = ?");
    params.push(rest.originAirportId);
  }
  if (rest.destinationAirportId !== undefined) {
    setFragments.push("destination_airport_id = ?");
    params.push(rest.destinationAirportId);
  }
  if (rest.departureTime !== undefined) {
    setFragments.push("departure_time = ?");
    params.push(rest.departureTime);
  }
  if (rest.arrivalTime !== undefined) {
    setFragments.push("arrival_time = ?");
    params.push(rest.arrivalTime);
  }
  if (rest.totalDurationMinutes !== undefined) {
    setFragments.push("total_duration_minutes = ?");
    params.push(rest.totalDurationMinutes);
  }
  if (rest.stops !== undefined) {
    setFragments.push("stops = ?");
    params.push(rest.stops);
  }
  if (rest.cabinClass !== undefined) {
    setFragments.push("cabin_class = ?");
    params.push(rest.cabinClass);
  }
  if (rest.basePrice !== undefined) {
    setFragments.push("base_price = ?");
    params.push(rest.basePrice);
  }
  if (rest.currency !== undefined) {
    setFragments.push("currency = ?");
    params.push(rest.currency);
  }
  if (rest.seatsTotal !== undefined) {
    setFragments.push("seats_total = ?");
    params.push(rest.seatsTotal);
  }
  if (rest.seatsAvailable !== undefined) {
    setFragments.push("seats_available = ?");
    params.push(rest.seatsAvailable);
  }
  if (rest.isActive !== undefined) {
    setFragments.push("is_active = ?");
    params.push(rest.isActive ? 1 : 0);
  }

  // If nothing to update, just return the current row (or null).
  if (setFragments.length === 0) {
    return findFlightById(id, { includeInactive: true }, connection);
  }

  const sql = `
    UPDATE flights
    SET ${setFragments.join(", ")}
    WHERE id = ?
  `;
  params.push(id);

  const result = await mysqlQuery(sql, params, connection);
  // mysql2 returns an OkPacket; we don't need to examine it here.

  const [row] = await mysqlQuery(
    "SELECT * FROM flights WHERE id = ?",
    [id],
    connection
  );

  if (!row) {
    return null;
  }

  return mapFlightRowToFlight(/** @type {FlightRow} */ (row));
}

/**
 * Soft-deactivate a flight by setting `is_active = 0`.
 *
 * @param {string} id
 * @param {import("mysql2/promise").PoolConnection | null} [connection]
 * @returns {Promise<boolean>} true if a row was updated, false otherwise
 */
export async function deactivateFlight(id, connection = null) {
  const sql = `
    UPDATE flights
    SET is_active = 0
    WHERE id = ? AND is_active = 1
  `;
  const result = await mysqlQuery(sql, [id], connection);
  // mysql2 OkPacket has affectedRows; but mysqlQuery is typed as rows[].
  // To keep things simple, we can re-check the record afterwards.
  const [row] = await mysqlQuery(
    "SELECT is_active FROM flights WHERE id = ?",
    [id],
    connection
  );
  if (!row) {
    return false;
  }
  return row.is_active === 0;
}

/**
 * Fetch a single flight by ID.
 *
 * @param {string} id
 * @param {{ includeInactive?: boolean }} [options]
 * @param {import("mysql2/promise").PoolConnection | null} [connection]
 * @returns {Promise<Flight | null>}
 */
export async function findFlightById(
  id,
  options = {},
  connection = null
) {
  const includeInactive =
    typeof options.includeInactive === "boolean"
      ? options.includeInactive
      : false;

  let sql = "SELECT * FROM flights WHERE id = ?";
  const params = [id];

  if (!includeInactive) {
    sql += " AND is_active = 1";
  }

  const [row] = await mysqlQuery(sql, params, connection);
  if (!row) {
    return null;
  }

  return mapFlightRowToFlight(/** @type {FlightRow} */ (row));
}

/**
 * Search flights with filters, pagination and controlled sorting.
 *
 * This repository method returns both the paginated items and the total
 * count for the given filters, enabling the service layer to implement
 * full-featured pagination in the REST API.
 *
 * Sorting:
 * - sortBy:
 *   - "price"        → base_price
 *   - "duration"     → total_duration_minutes
 *   - "departureTime"→ departure_time
 *   - "rating"       → rating_avg (NULLs last via COALESCE)
 * - sortOrder: "asc" or "desc"; defaults to "asc" except for rating where
 *   "desc" is usually more intuitive (but we still default to "asc" for
 *   simplicity and predictability here).
 *
 * @param {FlightSearchFilters} filters
 * @param {FlightSearchOptions} [options]
 * @param {import("mysql2/promise").PoolConnection | null} [connection]
 * @returns {Promise<FlightSearchResult>}
 */
export async function searchFlights(
  filters,
  options = {},
  connection = null
) {
  const { whereSql, params } = buildFlightsWhereClause(filters || {});

  const limit =
    typeof options.limit === "number" && options.limit > 0
      ? Math.min(options.limit, 100)
      : 20;
  const offset =
    typeof options.offset === "number" && options.offset >= 0
      ? options.offset
      : 0;

  /** @type {Record<string, string>} */
  const sortColumnMap = {
    price: "base_price",
    duration: "total_duration_minutes",
    departureTime: "departure_time",
    rating: "rating_avg",
  };

  const sortByKey = options.sortBy || "price";
  const sortColumn = sortColumnMap[sortByKey] || "base_price";

  let sortOrder = (options.sortOrder || "asc").toLowerCase();
  if (sortOrder !== "asc" && sortOrder !== "desc") {
    sortOrder = "asc";
  }

  // Total count
  const countSql = `
    SELECT COUNT(*) AS cnt
    FROM flights
    ${whereSql}
  `;
  const countRows = await mysqlQuery(countSql, params, connection);
  const total =
    countRows && countRows.length > 0
      ? Number(countRows[0].cnt)
      : 0;

  if (total === 0) {
    return { items: [], total: 0 };
  }

  // Items query
  // For rating, we can use COALESCE so that NULL ratings don't break ordering.
  const orderExpr =
    sortColumn === "rating_avg"
      ? `COALESCE(${sortColumn}, 0)`
      : sortColumn;

  const itemsSql = `
    SELECT *
    FROM flights
    ${whereSql}
    ORDER BY ${orderExpr} ${sortOrder}, id ASC
    LIMIT ? OFFSET ?
  `;
  const itemsParams = [...params, limit, offset];
  const rows = await mysqlQuery(itemsSql, itemsParams, connection);

  const items = rows.map((r) =>
    mapFlightRowToFlight(/** @type {FlightRow} */ (r))
  );

  return { items, total };
}
