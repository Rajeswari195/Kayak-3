/**
 * @file cars-repository.js
 * @description
 * MySQL repository functions for rental car listings in the Kayak-like
 * travel platform.
 *
 * Responsibilities:
 * - Provide data access helpers for the `cars` table:
 *   - Create new car listings.
 *   - Update existing car listings (partial updates).
 *   - Soft-deactivate cars.
 *   - Fetch cars by ID.
 *   - Search cars by pickup/dropoff location, car type, and price range.
 *
 * Design notes:
 * - The repository focuses on static listing attributes and base pricing.
 *   Date-based availability and booking overlaps will be enforced by the
 *   booking service using `booking_items`.
 * - Query construction uses parameterized SQL with whitelisted sort
 *   columns and simple pagination.
 */

import { mysqlQuery } from "../../db/mysql.js";

/**
 * @typedef {Object} CarRow
 * @property {string} id
 * @property {string} provider_name
 * @property {string} car_type
 * @property {string} make
 * @property {string} model
 * @property {number} model_year
 * @property {string} transmission
 * @property {number} seats
 * @property {number} daily_price
 * @property {string} currency
 * @property {string} pickup_city
 * @property {string} pickup_state
 * @property {string} pickup_country
 * @property {string|null} dropoff_city
 * @property {string|null} dropoff_state
 * @property {string|null} dropoff_country
 * @property {string|null} pickup_airport_id
 * @property {string|null} dropoff_airport_id
 * @property {number|null} rating_avg
 * @property {number} rating_count
 * @property {number} is_active
 * @property {Date|string} created_at
 * @property {Date|string} updated_at
 */

/**
 * @typedef {Object} Car
 * @property {string} id
 * @property {string} providerName
 * @property {string} carType
 * @property {string} make
 * @property {string} model
 * @property {number} modelYear
 * @property {("AUTOMATIC"|"MANUAL")} transmission
 * @property {number} seats
 * @property {number} dailyPrice
 * @property {string} currency
 * @property {string} pickupCity
 * @property {string} pickupState
 * @property {string} pickupCountry
 * @property {string|null} dropoffCity
 * @property {string|null} dropoffState
 * @property {string|null} dropoffCountry
 * @property {string|null} pickupAirportId
 * @property {string|null} dropoffAirportId
 * @property {number|null} ratingAvg
 * @property {number} ratingCount
 * @property {boolean} isActive
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} CreateCarInput
 * @property {string} id
 * @property {string} providerName
 * @property {string} carType
 * @property {string} make
 * @property {string} model
 * @property {number} modelYear
 * @property {("AUTOMATIC"|"MANUAL")} transmission
 * @property {number} seats
 * @property {number} dailyPrice
 * @property {string} [currency]
 * @property {string} pickupCity
 * @property {string} pickupState
 * @property {string} [pickupCountry]
 * @property {string|null} [dropoffCity]
 * @property {string|null} [dropoffState]
 * @property {string|null} [dropoffCountry]
 * @property {string|null} [pickupAirportId]
 * @property {string|null} [dropoffAirportId]
 */

/**
 * @typedef {Object} UpdateCarInput
 * @property {string} id
 * @property {string} [providerName]
 * @property {string} [carType]
 * @property {string} [make]
 * @property {string} [model]
 * @property {number} [modelYear]
 * @property {("AUTOMATIC"|"MANUAL")} [transmission]
 * @property {number} [seats]
 * @property {number} [dailyPrice]
 * @property {string} [currency]
 * @property {string} [pickupCity]
 * @property {string} [pickupState]
 * @property {string} [pickupCountry]
 * @property {string|null} [dropoffCity]
 * @property {string|null} [dropoffState]
 * @property {string|null} [dropoffCountry]
 * @property {string|null} [pickupAirportId]
 * @property {string|null} [dropoffAirportId]
 * @property {boolean} [isActive]
 */

/**
 * @typedef {Object} CarSearchFilters
 * @property {string} [pickupCity]
 * @property {string} [pickupState]
 * @property {string} [pickupCountry]
 * @property {string} [dropoffCity]
 * @property {string} [dropoffState]
 * @property {string} [dropoffCountry]
 * @property {string} [carType]
 * @property {number} [minPrice]
 * @property {number} [maxPrice]
 * @property {boolean} [onlyActive=true]
 */

/**
 * @typedef {Object} CarSearchOptions
 * @property {number} [limit=20]
 * @property {number} [offset=0]
 * @property {("price"|"rating")} [sortBy="price"]
 * @property {("asc"|"desc")} [sortOrder="asc"]
 */

/**
 * @typedef {Object} CarSearchResult
 * @property {Car[]} items
 * @property {number} total
 */

/**
 * Map a raw DB row to a Car domain object.
 *
 * @param {CarRow} row
 * @returns {Car}
 */
function mapCarRowToCar(row) {
  return {
    id: row.id,
    providerName: row.provider_name,
    carType: row.car_type,
    make: row.make,
    model: row.model,
    modelYear: Number(row.model_year),
    transmission: row.transmission,
    seats: Number(row.seats),
    dailyPrice: Number(row.daily_price),
    currency: row.currency,
    pickupCity: row.pickup_city,
    pickupState: row.pickup_state,
    pickupCountry: row.pickup_country,
    dropoffCity: row.dropoff_city,
    dropoffState: row.dropoff_state,
    dropoffCountry: row.dropoff_country,
    pickupAirportId: row.pickup_airport_id,
    dropoffAirportId: row.dropoff_airport_id,
    ratingAvg: row.rating_avg !== null ? Number(row.rating_avg) : null,
    ratingCount: Number(row.rating_count),
    isActive: row.is_active === 1 || row.is_active === true,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

/**
 * Build WHERE clause for car searches.
 *
 * @param {CarSearchFilters} filters
 * @returns {{ whereSql: string, params: any[] }}
 */
function buildCarsWhereClause(filters = {}) {
  const clauses = ["1=1"];
  const params = [];

  if (filters.pickupCity) {
    clauses.push("pickup_city = ?");
    params.push(filters.pickupCity);
  }
  if (filters.pickupState) {
    clauses.push("pickup_state = ?");
    params.push(filters.pickupState);
  }
  if (filters.pickupCountry) {
    clauses.push("pickup_country = ?");
    params.push(filters.pickupCountry);
  }
  if (filters.dropoffCity) {
    clauses.push("dropoff_city = ?");
    params.push(filters.dropoffCity);
  }
  if (filters.dropoffState) {
    clauses.push("dropoff_state = ?");
    params.push(filters.dropoffState);
  }
  if (filters.dropoffCountry) {
    clauses.push("dropoff_country = ?");
    params.push(filters.dropoffCountry);
  }
  if (filters.carType) {
    clauses.push("car_type = ?");
    params.push(filters.carType);
  }
  if (typeof filters.minPrice === "number") {
    clauses.push("daily_price >= ?");
    params.push(filters.minPrice);
  }
  if (typeof filters.maxPrice === "number") {
    clauses.push("daily_price <= ?");
    params.push(filters.maxPrice);
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
 * Create a new car listing.
 *
 * @param {CreateCarInput} input
 * @param {import("mysql2/promise").PoolConnection | null} [connection]
 * @returns {Promise<Car>}
 */
export async function createCar(input, connection = null) {
  const sql = `
    INSERT INTO cars (
      id,
      provider_name,
      car_type,
      make,
      model,
      model_year,
      transmission,
      seats,
      daily_price,
      currency,
      pickup_city,
      pickup_state,
      pickup_country,
      dropoff_city,
      dropoff_state,
      dropoff_country,
      pickup_airport_id,
      dropoff_airport_id,
      rating_avg,
      rating_count,
      is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, 1)
  `;

  const params = [
    input.id,
    input.providerName,
    input.carType,
    input.make,
    input.model,
    input.modelYear,
    input.transmission,
    input.seats,
    input.dailyPrice,
    input.currency || "USD",
    input.pickupCity,
    input.pickupState,
    input.pickupCountry || "United States",
    input.dropoffCity ?? null,
    input.dropoffState ?? null,
    input.dropoffCountry ?? null,
    input.pickupAirportId ?? null,
    input.dropoffAirportId ?? null,
  ];

  await mysqlQuery(sql, params, connection);

  const [row] = await mysqlQuery(
    "SELECT * FROM cars WHERE id = ?",
    [input.id],
    connection
  );

  if (!row) {
    throw new Error(
      "[cars-repository] Failed to fetch car after INSERT (id=" +
        input.id +
        ")"
    );
  }

  return mapCarRowToCar(/** @type {CarRow} */ (row));
}

/**
 * Update a car listing with a partial set of fields.
 *
 * @param {UpdateCarInput} fieldsToUpdate
 * @param {import("mysql2/promise").PoolConnection | null} [connection]
 * @returns {Promise<Car | null>}
 */
export async function updateCar(fieldsToUpdate, connection = null) {
  const { id, ...rest } = fieldsToUpdate;

  const setFragments = [];
  const params = [];

  if (rest.providerName !== undefined) {
    setFragments.push("provider_name = ?");
    params.push(rest.providerName);
  }
  if (rest.carType !== undefined) {
    setFragments.push("car_type = ?");
    params.push(rest.carType);
  }
  if (rest.make !== undefined) {
    setFragments.push("make = ?");
    params.push(rest.make);
  }
  if (rest.model !== undefined) {
    setFragments.push("model = ?");
    params.push(rest.model);
  }
  if (rest.modelYear !== undefined) {
    setFragments.push("model_year = ?");
    params.push(rest.modelYear);
  }
  if (rest.transmission !== undefined) {
    setFragments.push("transmission = ?");
    params.push(rest.transmission);
  }
  if (rest.seats !== undefined) {
    setFragments.push("seats = ?");
    params.push(rest.seats);
  }
  if (rest.dailyPrice !== undefined) {
    setFragments.push("daily_price = ?");
    params.push(rest.dailyPrice);
  }
  if (rest.currency !== undefined) {
    setFragments.push("currency = ?");
    params.push(rest.currency);
  }
  if (rest.pickupCity !== undefined) {
    setFragments.push("pickup_city = ?");
    params.push(rest.pickupCity);
  }
  if (rest.pickupState !== undefined) {
    setFragments.push("pickup_state = ?");
    params.push(rest.pickupState);
  }
  if (rest.pickupCountry !== undefined) {
    setFragments.push("pickup_country = ?");
    params.push(rest.pickupCountry);
  }
  if (rest.dropoffCity !== undefined) {
    setFragments.push("dropoff_city = ?");
    params.push(rest.dropoffCity);
  }
  if (rest.dropoffState !== undefined) {
    setFragments.push("dropoff_state = ?");
    params.push(rest.dropoffState);
  }
  if (rest.dropoffCountry !== undefined) {
    setFragments.push("dropoff_country = ?");
    params.push(rest.dropoffCountry);
  }
  if (rest.pickupAirportId !== undefined) {
    setFragments.push("pickup_airport_id = ?");
    params.push(rest.pickupAirportId);
  }
  if (rest.dropoffAirportId !== undefined) {
    setFragments.push("dropoff_airport_id = ?");
    params.push(rest.dropoffAirportId);
  }
  if (rest.isActive !== undefined) {
    setFragments.push("is_active = ?");
    params.push(rest.isActive ? 1 : 0);
  }

  if (setFragments.length === 0) {
    return findCarById(id, { includeInactive: true }, connection);
  }

  const sql = `
    UPDATE cars
    SET ${setFragments.join(", ")}
    WHERE id = ?
  `;
  params.push(id);

  await mysqlQuery(sql, params, connection);

  const [row] = await mysqlQuery(
    "SELECT * FROM cars WHERE id = ?",
    [id],
    connection
  );

  if (!row) {
    return null;
  }

  return mapCarRowToCar(/** @type {CarRow} */ (row));
}

/**
 * Soft-deactivate a car listing.
 *
 * @param {string} id
 * @param {import("mysql2/promise").PoolConnection | null} [connection]
 * @returns {Promise<boolean>}
 */
export async function deactivateCar(id, connection = null) {
  const sql = `
    UPDATE cars
    SET is_active = 0
    WHERE id = ? AND is_active = 1
  `;
  await mysqlQuery(sql, [id], connection);

  const [row] = await mysqlQuery(
    "SELECT is_active FROM cars WHERE id = ?",
    [id],
    connection
  );

  if (!row) {
    return false;
  }

  return row.is_active === 0;
}

/**
 * Fetch a car listing by ID.
 *
 * @param {string} id
 * @param {{ includeInactive?: boolean }} [options]
 * @param {import("mysql2/promise").PoolConnection | null} [connection]
 * @returns {Promise<Car | null>}
 */
export async function findCarById(
  id,
  options = {},
  connection = null
) {
  const includeInactive =
    typeof options.includeInactive === "boolean"
      ? options.includeInactive
      : false;

  let sql = "SELECT * FROM cars WHERE id = ?";
  const params = [id];

  if (!includeInactive) {
    sql += " AND is_active = 1";
  }

  const [row] = await mysqlQuery(sql, params, connection);
  if (!row) {
    return null;
  }

  return mapCarRowToCar(/** @type {CarRow} */ (row));
}

/**
 * Search cars with filters and pagination.
 *
 * Sorting:
 * - "price"  → daily_price
 * - "rating" → rating_avg
 *
 * @param {CarSearchFilters} filters
 * @param {CarSearchOptions} [options]
 * @param {import("mysql2/promise").PoolConnection | null} [connection]
 * @returns {Promise<CarSearchResult>}
 */
export async function searchCars(
  filters,
  options = {},
  connection = null
) {
  const { whereSql, params } = buildCarsWhereClause(filters || {});

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
    price: "daily_price",
    rating: "rating_avg",
  };

  const sortByKey = options.sortBy || "price";
  const sortColumn = sortColumnMap[sortByKey] || "daily_price";

  let sortOrder = (options.sortOrder || "asc").toLowerCase();
  if (sortOrder !== "asc" && sortOrder !== "desc") {
    sortOrder = "asc";
  }

  const countSql = `
    SELECT COUNT(*) AS cnt
    FROM cars
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

  const orderExpr =
    sortColumn === "rating_avg"
      ? `COALESCE(${sortColumn}, 0)`
      : sortColumn;

  const itemsSql = `
    SELECT *
    FROM cars
    ${whereSql}
    ORDER BY ${orderExpr} ${sortOrder}, id ASC
    LIMIT ? OFFSET ?
  `;
  const itemsParams = [...params, limit, offset];
  const rows = await mysqlQuery(itemsSql, itemsParams, connection);

  const items = rows.map((r) =>
    mapCarRowToCar(/** @type {CarRow} */ (r))
  );

  return { items, total };
}

export async function findCarByIdForUpdate(connection, carId) {
  const sql = `SELECT * FROM cars WHERE id = ? FOR UPDATE`;
  const [rows] = await connection.query(sql, [carId]);
  return rows.length ? rows[0] : null;
}