/**
 * @file admin-listings-controller.js
 * @description
 * Express HTTP controllers for admin management of listings:
 *   - POST /admin/flights
 *   - PUT  /admin/flights/:id
 *   - POST /admin/hotels
 *   - PUT  /admin/hotels/:id
 *   - POST /admin/cars
 *   - PUT  /admin/cars/:id
 *
 * Responsibilities:
 * - Parse and validate admin payloads for creating/updating listings.
 * - Enforce basic business rules (e.g., seat counts, price positivity).
 * - Resolve airport IATA codes to airport IDs for flights.
 * - Validate US addresses (state and ZIP) for hotels and cars.
 * - Delegate persistence to the MySQL repositories.
 *
 * Notes:
 * - These endpoints must be protected by `requireAuth` and `requireAdmin`
 *   at the routing layer; this file assumes `req.user` is an admin.
 * - This step focuses on core CRUD; more advanced concerns like audit
 *   logging and Kafka emissions can be layered later.
 */



import { randomUUID } from "node:crypto";
import { mysqlQuery } from "../db/mysql.js";

import {
  createFlight,
  updateFlight,
  findFlightById,
} from "../repositories/mysql/flights-repository.js";
import {
  createHotel,
  updateHotel,
  findHotelById,
} from "../repositories/mysql/hotels-repository.js";
import {
  createCar,
  updateCar,
  findCarById,
} from "../repositories/mysql/cars-repository.js";

import { normalizePaginationParams } from "../validators/common-validators.js";

export async function getAdminFlightsController(req, res, next) {
  try {
    const { page, pageSize } = normalizePaginationParams(req.query);
    // Pass query params directly; service handles filtering
    const result = await searchAdminFlights(req.query, { page, pageSize });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getAdminHotelsController(req, res, next) {
  try {
    const { page, pageSize } = normalizePaginationParams(req.query);
    const result = await searchAdminHotels(req.query, { page, pageSize });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getAdminCarsController(req, res, next) {
  try {
    const { page, pageSize } = normalizePaginationParams(req.query);
    const result = await searchAdminCars(req.query, { page, pageSize });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// --- CREATE/UPDATE (POST/PUT) ---
// These delegate to the service layer which now handles validation.

export async function createFlightListing(req, res, next) {
  try {
    const created = await createFlightService(req.body);
    res.status(201).json({ flight: created });
  } catch (err) {
    next(err);
  }
}

export async function updateFlightListing(req, res, next) {
  try {
    const { id } = req.params;
    const updated = await updateFlightService({ ...req.body, id });
    res.json({ flight: updated });
  } catch (err) {
    next(err);
  }
}

export async function createHotelListing(req, res, next) {
  try {
    const created = await createHotelService(req.body);
    res.status(201).json({ hotel: created });
  } catch (err) {
    next(err);
  }
}

export async function updateHotelListing(req, res, next) {
  try {
    const { id } = req.params;
    const updated = await updateHotelService({ ...req.body, id });
    res.json({ hotel: updated });
  } catch (err) {
    next(err);
  }
}

export async function createCarListing(req, res, next) {
  try {
    const created = await createCarService(req.body);
    res.status(201).json({ car: created });
  } catch (err) {
    next(err);
  }
}

export async function updateCarListing(req, res, next) {
  try {
    const { id } = req.params;
    const updated = await updateCarService({ ...req.body, id });
    res.json({ car: updated });
  } catch (err) {
    next(err);
  }
}

/**
 * In-memory list of valid US state abbreviations and full names.
 * This duplicates logic typically found in shared validators but keeps
 * this controller self-contained and explicit.
 *
 * All comparisons are performed in uppercase.
 *
 * @type {Set<string>}
 */
const US_STATE_TOKENS = new Set([
  "ALABAMA",
  "AL",
  "ALASKA",
  "AK",
  "ARIZONA",
  "AZ",
  "ARKANSAS",
  "AR",
  "CALIFORNIA",
  "CA",
  "COLORADO",
  "CO",
  "CONNECTICUT",
  "CT",
  "DELAWARE",
  "DE",
  "FLORIDA",
  "FL",
  "GEORGIA",
  "GA",
  "HAWAII",
  "HI",
  "IDAHO",
  "ID",
  "ILLINOIS",
  "IL",
  "INDIANA",
  "IN",
  "IOWA",
  "IA",
  "KANSAS",
  "KS",
  "KENTUCKY",
  "KY",
  "LOUISIANA",
  "LA",
  "MAINE",
  "ME",
  "MARYLAND",
  "MD",
  "MASSACHUSETTS",
  "MA",
  "MICHIGAN",
  "MI",
  "MINNESOTA",
  "MN",
  "MISSISSIPPI",
  "MS",
  "MISSOURI",
  "MO",
  "MONTANA",
  "MT",
  "NEBRASKA",
  "NE",
  "NEVADA",
  "NV",
  "NEW HAMPSHIRE",
  "NH",
  "NEW JERSEY",
  "NJ",
  "NEW MEXICO",
  "NM",
  "NEW YORK",
  "NY",
  "NORTH CAROLINA",
  "NC",
  "NORTH DAKOTA",
  "ND",
  "OHIO",
  "OH",
  "OKLAHOMA",
  "OK",
  "OREGON",
  "OR",
  "PENNSYLVANIA",
  "PA",
  "RHODE ISLAND",
  "RI",
  "SOUTH CAROLINA",
  "SC",
  "SOUTH DAKOTA",
  "SD",
  "TENNESSEE",
  "TN",
  "TEXAS",
  "TX",
  "UTAH",
  "UT",
  "VERMONT",
  "VT",
  "VIRGINIA",
  "VA",
  "WASHINGTON",
  "WA",
  "WEST VIRGINIA",
  "WV",
  "WISCONSIN",
  "WI",
  "WYOMING",
  "WY",
]);

/**
 * Validate a US state token (abbreviation or full name).
 *
 * @param {string} state
 * @returns {boolean}
 */
function isValidUsState(state) {
  if (!state) return false;
  const token = state.trim().toUpperCase();
  return US_STATE_TOKENS.has(token);
}

/**
 * Validate a US ZIP or ZIP+4 code.
 *
 * @param {string} zip
 * @returns {boolean}
 */
function isValidZip(zip) {
  if (!zip) return false;
  const s = zip.trim();
  return /^\d{5}$/.test(s) || /^\d{5}-\d{4}$/.test(s);
}

/**
 * Helper: validate and parse a non-negative monetary amount.
 *
 * @param {any} raw
 * @param {string} fieldName
 * @param {string[]} errors
 * @returns {number | null}
 */
function parsePrice(raw, fieldName, errors) {
  if (raw === undefined || raw === null) {
    errors.push(`"${fieldName}" is required.`);
    return null;
  }
  const value = Number.parseFloat(String(raw));
  if (Number.isNaN(value) || value < 0) {
    errors.push(`"${fieldName}" must be a non-negative number.`);
    return null;
  }
  return value;
}

/**
 * Helper: parse integer field >= 0.
 *
 * @param {any} raw
 * @param {string} fieldName
 * @param {string[]} errors
 * @returns {number | null}
 */
function parseNonNegativeInt(raw, fieldName, errors) {
  if (raw === undefined || raw === null) {
    errors.push(`"${fieldName}" is required.`);
    return null;
  }
  const value = Number.parseInt(String(raw), 10);
  if (Number.isNaN(value) || value < 0) {
    errors.push(`"${fieldName}" must be an integer >= 0.`);
    return null;
  }
  return value;
}

/**
 * Helper: validate a Date-time string is parseable.
 *
 * @param {any} raw
 * @param {string} fieldName
 * @param {string[]} errors
 * @returns {string | null} ISO-like string (original) if valid
 */
function parseDateTime(raw, fieldName, errors) {
  if (!raw) {
    errors.push(`"${fieldName}" is required.`);
    return null;
  }
  const str = String(raw);
  const timestamp = Date.parse(str);
  if (Number.isNaN(timestamp)) {
    errors.push(`"${fieldName}" must be a valid date/time string.`);
    return null;
  }
  return str;
}

/**
 * Helper: resolve airport ID by IATA for admin payloads.
 *
 * @param {string | undefined} id
 * @param {string | undefined} iata
 * @param {string} kind "origin" or "destination" (for error message)
 * @param {string[]} errors
 * @returns {Promise<string | null>}
 */
async function resolveAirportIdForAdmin(id, iata, kind, errors) {
  if (id) {
    return String(id);
  }
  if (!iata) {
    errors.push(
      `Either "${kind}AirportId" or "${kind}Iata" must be provided.`
    );
    return null;
  }

  const sql = `
    SELECT id
    FROM airports
    WHERE iata_code = ?
    LIMIT 1
  `;
  const rows = await mysqlQuery(sql, [String(iata).toUpperCase()]);
  if (!rows || rows.length === 0) {
    errors.push(`Unknown ${kind} airport IATA code "${iata}".`);
    return null;
  }
  return rows[0].id;
}

/**
 * Controller: POST /admin/flights
 *
 * Body example:
 * {
 *   "flightNumber": "UA123",
 *   "airline": "United",
 *   "originAirportId": "...",      // OR originIata
 *   "destinationAirportId": "...", // OR destinationIata
 *   "departureTime": "2025-06-01T10:00:00Z",
 *   "arrivalTime": "2025-06-01T13:30:00Z",
 *   "stops": 0,
 *   "cabinClass": "ECONOMY",
 *   "basePrice": 350.0,
 *   "currency": "USD",
 *   "seatsTotal": 180,
 *   "seatsAvailable": 180
 * }
 */
