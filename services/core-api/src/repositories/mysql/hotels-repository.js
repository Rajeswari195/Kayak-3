/**
 * @file hotels-repository.js
 * @description
 * MySQL repository functions for working with hotel listings in the
 * Kayak-like travel platform.
 *
 * Responsibilities:
 * - Provide low-level CRUD-style functions for the `hotels` table:
 *   - Create new hotel records.
 *   - Update hotel attributes (partial updates).
 *   - Soft-deactivate hotels using `is_active`.
 *   - Fetch hotels by ID.
 *   - Search hotels by city, state, price range, star rating, and name.
 *
 * Design notes:
 * - Availability by date range (check-in/check-out) will be handled at the
 *   service layer using `hotel_rooms` and `booking_items` tables. This
 *   repository only focuses on hotel-level metadata and base pricing.
 * - Filtering and sorting are implemented via parameterized queries with
 *   whitelisted sort columns to avoid injection risks.
 */

import { mysqlQuery } from "../../db/mysql.js";

/**
 * @typedef {Object} HotelRow
 * @property {string} id
 * @property {string} name
 * @property {string|null} description
 * @property {string} address_line1
 * @property {string|null} address_line2
 * @property {string} city
 * @property {string} state
 * @property {string} zip
 * @property {string} country
 * @property {number|null} star_rating
 * @property {number} base_price_per_night
 * @property {string} currency
 * @property {number|null} rating_avg
 * @property {number} rating_count
 * @property {string|null} check_in_time
 * @property {string|null} check_out_time
 * @property {number} is_active
 * @property {Date|string} created_at
 * @property {Date|string} updated_at
 */

/**
 * @typedef {Object} Hotel
 * @property {string} id
 * @property {string} name
 * @property {string|null} description
 * @property {string} addressLine1
 * @property {string|null} addressLine2
 * @property {string} city
 * @property {string} state
 * @property {string} zip
 * @property {string} country
 * @property {number|null} starRating
 * @property {number} basePricePerNight
 * @property {string} currency
 * @property {number|null} ratingAvg
 * @property {number} ratingCount
 * @property {string|null} checkInTime
 * @property {string|null} checkOutTime
 * @property {boolean} isActive
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} CreateHotelInput
 * @property {string} id
 * @property {string} name
 * @property {string|null} [description]
 * @property {string} addressLine1
 * @property {string|null} [addressLine2]
 * @property {string} city
 * @property {string} state
 * @property {string} zip
 * @property {string} [country]
 * @property {number|null} [starRating]
 * @property {number} basePricePerNight
 * @property {string} [currency]
 * @property {string|null} [checkInTime] - HH:MM:SS
 * @property {string|null} [checkOutTime] - HH:MM:SS
 */

/**
 * @typedef {Object} UpdateHotelInput
 * @property {string} id
 * @property {string} [name]
 * @property {string|null} [description]
 * @property {string} [addressLine1]
 * @property {string|null} [addressLine2]
 * @property {string} [city]
 * @property {string} [state]
 * @property {string} [zip]
 * @property {string} [country]
 * @property {number|null} [starRating]
 * @property {number} [basePricePerNight]
 * @property {string} [currency]
 * @property {string|null} [checkInTime]
 * @property {string|null} [checkOutTime]
 * @property {boolean} [isActive]
 */

/**
 * @typedef {Object} HotelSearchFilters
 * @property {string} [city]
 * @property {string} [state]
 * @property {number} [minPrice]
 * @property {number} [maxPrice]
 * @property {number} [minStars]
 * @property {number} [maxStars]
 * @property {string} [nameContains] - case-insensitive substring on name
 * @property {boolean} [onlyActive=true]
 */

/**
 * @typedef {Object} HotelSearchOptions
 * @property {number} [limit=20]
 * @property {number} [offset=0]
 * @property {("price"|"rating"|"stars")} [sortBy="price"]
 * @property {("asc"|"desc")} [sortOrder="asc"]
 */

/**
 * @typedef {Object} HotelSearchResult
 * @property {Hotel[]} items
 * @property {number} total
 */

/**
 * Map a raw DB row to a domain-level Hotel object.
 *
 * @param {HotelRow} row
 * @returns {Hotel}
 */
function mapHotelRowToHotel(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    state: row.state,
    zip: row.zip,
    country: row.country,
    starRating: row.star_rating !== null ? Number(row.star_rating) : null,
    basePricePerNight: Number(row.base_price_per_night),
    currency: row.currency,
    ratingAvg: row.rating_avg !== null ? Number(row.rating_avg) : null,
    ratingCount: Number(row.rating_count),
    checkInTime: row.check_in_time,
    checkOutTime: row.check_out_time,
    isActive: row.is_active === 1 || row.is_active === true,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

/**
 * Build WHERE clause and parameter list for hotel searches.
 *
 * @param {HotelSearchFilters} filters
 * @returns {{ whereSql: string, params: any[] }}
 */
function buildHotelsWhereClause(filters = {}) {
  const clauses = ["1=1"];
  const params = [];

  if (filters.city) {
    clauses.push("city = ?");
    params.push(filters.city);
  }

  if (filters.state) {
    clauses.push("state = ?");
    params.push(filters.state);
  }

  if (typeof filters.minPrice === "number") {
    clauses.push("base_price_per_night >= ?");
    params.push(filters.minPrice);
  }

  if (typeof filters.maxPrice === "number") {
    clauses.push("base_price_per_night <= ?");
    params.push(filters.maxPrice);
  }

  if (typeof filters.minStars === "number") {
    clauses.push("star_rating >= ?");
    params.push(filters.minStars);
  }

  if (typeof filters.maxStars === "number") {
    clauses.push("star_rating <= ?");
    params.push(filters.maxStars);
  }

  if (filters.nameContains) {
    clauses.push("LOWER(name) LIKE ?");
    params.push(`%${filters.nameContains.toLowerCase()}%`);
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
 * Insert a new hotel row.
 *
 * @param {CreateHotelInput} input
 * @param {import("mysql2/promise").PoolConnection | null} [connection]
 * @returns {Promise<Hotel>}
 */
export async function createHotel(input, connection = null) {
  const sql = `
    INSERT INTO hotels (
      id,
      name,
      description,
      address_line1,
      address_line2,
      city,
      state,
      zip,
      country,
      star_rating,
      base_price_per_night,
      currency,
      rating_avg,
      rating_count,
      check_in_time,
      check_out_time,
      is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, ?, ?, 1)
  `;

  const params = [
    input.id,
    input.name,
    input.description ?? null,
    input.addressLine1,
    input.addressLine2 ?? null,
    input.city,
    input.state,
    input.zip,
    input.country || "United States",
    input.starRating ?? null,
    input.basePricePerNight,
    input.currency || "USD",
    input.checkInTime ?? null,
    input.checkOutTime ?? null,
  ];

  await mysqlQuery(sql, params, connection);

  const [row] = await mysqlQuery(
    "SELECT * FROM hotels WHERE id = ?",
    [input.id],
    connection
  );

  if (!row) {
    throw new Error(
      "[hotels-repository] Failed to fetch hotel after INSERT (id=" +
        input.id +
        ")"
    );
  }

  return mapHotelRowToHotel(/** @type {HotelRow} */ (row));
}

/**
 * Update a hotel with a partial set of fields.
 *
 * Returns null if the hotel does not exist.
 *
 * @param {UpdateHotelInput} fieldsToUpdate
 * @param {import("mysql2/promise").PoolConnection | null} [connection]
 * @returns {Promise<Hotel | null>}
 */
export async function updateHotel(fieldsToUpdate, connection = null) {
  const { id, ...rest } = fieldsToUpdate;

  const setFragments = [];
  const params = [];

  if (rest.name !== undefined) {
    setFragments.push("name = ?");
    params.push(rest.name);
  }
  if (rest.description !== undefined) {
    setFragments.push("description = ?");
    params.push(rest.description);
  }
  if (rest.addressLine1 !== undefined) {
    setFragments.push("address_line1 = ?");
    params.push(rest.addressLine1);
  }
  if (rest.addressLine2 !== undefined) {
    setFragments.push("address_line2 = ?");
    params.push(rest.addressLine2);
  }
  if (rest.city !== undefined) {
    setFragments.push("city = ?");
    params.push(rest.city);
  }
  if (rest.state !== undefined) {
    setFragments.push("state = ?");
    params.push(rest.state);
  }
  if (rest.zip !== undefined) {
    setFragments.push("zip = ?");
    params.push(rest.zip);
  }
  if (rest.country !== undefined) {
    setFragments.push("country = ?");
    params.push(rest.country);
  }
  if (rest.starRating !== undefined) {
    setFragments.push("star_rating = ?");
    params.push(rest.starRating);
  }
  if (rest.basePricePerNight !== undefined) {
    setFragments.push("base_price_per_night = ?");
    params.push(rest.basePricePerNight);
  }
  if (rest.currency !== undefined) {
    setFragments.push("currency = ?");
    params.push(rest.currency);
  }
  if (rest.checkInTime !== undefined) {
    setFragments.push("check_in_time = ?");
    params.push(rest.checkInTime);
  }
  if (rest.checkOutTime !== undefined) {
    setFragments.push("check_out_time = ?");
    params.push(rest.checkOutTime);
  }
  if (rest.isActive !== undefined) {
    setFragments.push("is_active = ?");
    params.push(rest.isActive ? 1 : 0);
  }

  if (setFragments.length === 0) {
    return findHotelById(id, { includeInactive: true }, connection);
  }

  const sql = `
    UPDATE hotels
    SET ${setFragments.join(", ")}
    WHERE id = ?
  `;
  params.push(id);

  await mysqlQuery(sql, params, connection);

  const [row] = await mysqlQuery(
    "SELECT * FROM hotels WHERE id = ?",
    [id],
    connection
  );

  if (!row) {
    return null;
  }

  return mapHotelRowToHotel(/** @type {HotelRow} */ (row));
}

/**
 * Soft-deactivate a hotel listing.
 *
 * @param {string} id
 * @param {import("mysql2/promise").PoolConnection | null} [connection]
 * @returns {Promise<boolean>} true if successfully deactivated
 */
export async function deactivateHotel(id, connection = null) {
  const sql = `
    UPDATE hotels
    SET is_active = 0
    WHERE id = ? AND is_active = 1
  `;
  await mysqlQuery(sql, [id], connection);

  const [row] = await mysqlQuery(
    "SELECT is_active FROM hotels WHERE id = ?",
    [id],
    connection
  );

  if (!row) {
    return false;
  }

  return row.is_active === 0;
}

/**
 * Fetch a single hotel by ID.
 *
 * @param {string} id
 * @param {{ includeInactive?: boolean }} [options]
 * @param {import("mysql2/promise").PoolConnection | null} [connection]
 * @returns {Promise<Hotel | null>}
 */
export async function findHotelById(
  id,
  options = {},
  connection = null
) {
  const includeInactive =
    typeof options.includeInactive === "boolean"
      ? options.includeInactive
      : false;

  let sql = "SELECT * FROM hotels WHERE id = ?";
  const params = [id];

  if (!includeInactive) {
    sql += " AND is_active = 1";
  }

  const [row] = await mysqlQuery(sql, params, connection);
  if (!row) {
    return null;
  }

  return mapHotelRowToHotel(/** @type {HotelRow} */ (row));
}

/**
 * Search hotels with filters and pagination.
 *
 * Sorting:
 * - sortBy:
 *   - "price"  → base_price_per_night
 *   - "rating" → rating_avg
 *   - "stars"  → star_rating
 *
 * @param {HotelSearchFilters} filters
 * @param {HotelSearchOptions} [options]
 * @param {import("mysql2/promise").PoolConnection | null} [connection]
 * @returns {Promise<HotelSearchResult>}
 */
export async function searchHotels(
  filters,
  options = {},
  connection = null
) {
  const { whereSql, params } = buildHotelsWhereClause(filters || {});

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
    price: "base_price_per_night",
    rating: "rating_avg",
    stars: "star_rating",
  };

  const sortByKey = options.sortBy || "price";
  const sortColumn = sortColumnMap[sortByKey] || "base_price_per_night";

  let sortOrder = (options.sortOrder || "asc").toLowerCase();
  if (sortOrder !== "asc" && sortOrder !== "desc") {
    sortOrder = "asc";
  }

  const countSql = `
    SELECT COUNT(*) AS cnt
    FROM hotels
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
    sortColumn === "rating_avg" || sortColumn === "star_rating"
      ? `COALESCE(${sortColumn}, 0)`
      : sortColumn;

  const itemsSql = `
    SELECT *
    FROM hotels
    ${whereSql}
    ORDER BY ${orderExpr} ${sortOrder}, id ASC
    LIMIT ? OFFSET ?
  `;
  const itemsParams = [...params, limit, offset];
  const rows = await mysqlQuery(itemsSql, itemsParams, connection);

  const items = rows.map((r) =>
    mapHotelRowToHotel(/** @type {HotelRow} */ (r))
  );

  return { items, total };
}
