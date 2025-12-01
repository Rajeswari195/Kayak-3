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
export async function createFlightListing(req, res, next) {
  try {
    const errors = [];
    const body = req.body || {};

    const flightNumber = body.flightNumber
      ? String(body.flightNumber).trim()
      : "";
    const airline = body.airline ? String(body.airline).trim() : "";

    if (!flightNumber) {
      errors.push('"flightNumber" is required.');
    }
    if (!airline) {
      errors.push('"airline" is required.');
    }

    const departureTime = parseDateTime(
      body.departureTime,
      "departureTime",
      errors
    );
    const arrivalTime = parseDateTime(
      body.arrivalTime,
      "arrivalTime",
      errors
    );

    // Cabin class
    const allowedCabinClasses = [
      "ECONOMY",
      "PREMIUM_ECONOMY",
      "BUSINESS",
      "FIRST",
    ];
    let cabinClass = "ECONOMY";
    if (body.cabinClass) {
      const normalized = String(body.cabinClass).toUpperCase();
      if (!allowedCabinClasses.includes(normalized)) {
        errors.push(
          `"cabinClass" must be one of ${allowedCabinClasses.join(", ")}.`
        );
      } else {
        cabinClass = normalized;
      }
    }

    const basePrice = parsePrice(body.basePrice, "basePrice", errors);
    const currency =
      body.currency && String(body.currency).trim()
        ? String(body.currency).trim().toUpperCase()
        : "USD";

    const stops =
      body.stops === undefined || body.stops === null
        ? 0
        : Number.parseInt(String(body.stops), 10);
    if (Number.isNaN(stops) || stops < 0 || stops > 3) {
      errors.push('"stops" must be an integer between 0 and 3.');
    }

    const seatsTotal = parseNonNegativeInt(
      body.seatsTotal,
      "seatsTotal",
      errors
    );
    const seatsAvailable = parseNonNegativeInt(
      body.seatsAvailable,
      "seatsAvailable",
      errors
    );

    if (
      seatsTotal != null &&
      seatsAvailable != null &&
      seatsAvailable > seatsTotal
    ) {
      errors.push('"seatsAvailable" cannot exceed "seatsTotal".');
    }

    // Resolve airports
    const originAirportId = await resolveAirportIdForAdmin(
      body.originAirportId,
      body.originIata,
      "origin",
      errors
    );
    const destinationAirportId = await resolveAirportIdForAdmin(
      body.destinationAirportId,
      body.destinationIata,
      "destination",
      errors
    );

    // Validate time ordering
    if (departureTime && arrivalTime) {
      const departTs = Date.parse(departureTime);
      const arriveTs = Date.parse(arrivalTime);
      if (!Number.isNaN(departTs) && !Number.isNaN(arriveTs)) {
        if (arriveTs <= departTs) {
          errors.push(
            '"arrivalTime" must be after "departureTime".'
          );
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        code: "validation_error",
        message: "Invalid flight listing payload.",
        details: errors,
      });
    }

    // Compute duration in minutes if not provided explicitly.
    let totalDurationMinutes;
    if (body.totalDurationMinutes != null) {
      const d = Number.parseInt(String(body.totalDurationMinutes), 10);
      totalDurationMinutes = Number.isNaN(d) || d <= 0 ? null : d;
    } else if (departureTime && arrivalTime) {
      const departTs = Date.parse(departureTime);
      const arriveTs = Date.parse(arrivalTime);
      totalDurationMinutes = Math.round((arriveTs - departTs) / 60000);
    } else {
      totalDurationMinutes = null;
    }
    if (totalDurationMinutes == null || totalDurationMinutes <= 0) {
      return res.status(400).json({
        code: "validation_error",
        message:
          '"totalDurationMinutes" could not be determined; please provide a positive duration or valid times.',
      });
    }

    const id = randomUUID();

    const created = await createFlight({
      id,
      flightNumber,
      airline,
      originAirportId,
      destinationAirportId,
      departureTime,
      arrivalTime,
      totalDurationMinutes,
      stops,
      cabinClass,
      basePrice,
      currency,
      seatsTotal,
      seatsAvailable,
    });

    return res.status(201).json({ flight: created });
  } catch (err) {
    return next(err);
  }
}

/**
 * Controller: PUT /admin/flights/:id
 *
 * Allows partial update of a flight listing.
 */
export async function updateFlightListing(req, res, next) {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const errors = [];

    if (!id) {
      return res.status(400).json({
        code: "validation_error",
        message: "Path parameter :id is required.",
      });
    }

    const fieldsToUpdate = { id };

    if (body.flightNumber !== undefined) {
      const v = String(body.flightNumber).trim();
      if (!v) {
        errors.push('"flightNumber" cannot be empty.');
      } else {
        fieldsToUpdate.flightNumber = v;
      }
    }

    if (body.airline !== undefined) {
      const v = String(body.airline).trim();
      if (!v) {
        errors.push('"airline" cannot be empty.');
      } else {
        fieldsToUpdate.airline = v;
      }
    }

    if (body.departureTime !== undefined) {
      const departureTime = parseDateTime(
        body.departureTime,
        "departureTime",
        errors
      );
      if (departureTime) {
        fieldsToUpdate.departureTime = departureTime;
      }
    }

    if (body.arrivalTime !== undefined) {
      const arrivalTime = parseDateTime(
        body.arrivalTime,
        "arrivalTime",
        errors
      );
      if (arrivalTime) {
        fieldsToUpdate.arrivalTime = arrivalTime;
      }
    }

    // Cabin class
    if (body.cabinClass !== undefined) {
      const allowedCabinClasses = [
        "ECONOMY",
        "PREMIUM_ECONOMY",
        "BUSINESS",
        "FIRST",
      ];
      const normalized = String(body.cabinClass).toUpperCase();
      if (!allowedCabinClasses.includes(normalized)) {
        errors.push(
          `"cabinClass" must be one of ${allowedCabinClasses.join(", ")}.`
        );
      } else {
        fieldsToUpdate.cabinClass = normalized;
      }
    }

    if (body.basePrice !== undefined) {
      const parsed = parsePrice(body.basePrice, "basePrice", errors);
      if (parsed != null) {
        fieldsToUpdate.basePrice = parsed;
      }
    }

    if (body.currency !== undefined) {
      const cur = String(body.currency).trim().toUpperCase();
      if (!cur) {
        errors.push('"currency" cannot be empty.');
      } else {
        fieldsToUpdate.currency = cur;
      }
    }

    if (body.stops !== undefined) {
      const stops = Number.parseInt(String(body.stops), 10);
      if (Number.isNaN(stops) || stops < 0 || stops > 3) {
        errors.push('"stops" must be an integer between 0 and 3.');
      } else {
        fieldsToUpdate.stops = stops;
      }
    }

    if (body.seatsTotal !== undefined) {
      const seatsTotal = parseNonNegativeInt(
        body.seatsTotal,
        "seatsTotal",
        errors
      );
      if (seatsTotal != null) {
        fieldsToUpdate.seatsTotal = seatsTotal;
      }
    }

    if (body.seatsAvailable !== undefined) {
      const seatsAvailable = parseNonNegativeInt(
        body.seatsAvailable,
        "seatsAvailable",
        errors
      );
      if (seatsAvailable != null) {
        fieldsToUpdate.seatsAvailable = seatsAvailable;
      }
    }

    // Airports
    if (
      body.originAirportId !== undefined ||
      body.originIata !== undefined
    ) {
      const originAirportId = await resolveAirportIdForAdmin(
        body.originAirportId,
        body.originIata,
        "origin",
        errors
      );
      if (originAirportId) {
        fieldsToUpdate.originAirportId = originAirportId;
      }
    }

    if (
      body.destinationAirportId !== undefined ||
      body.destinationIata !== undefined
    ) {
      const destinationAirportId = await resolveAirportIdForAdmin(
        body.destinationAirportId,
        body.destinationIata,
        "destination",
        errors
      );
      if (destinationAirportId) {
        fieldsToUpdate.destinationAirportId = destinationAirportId;
      }
    }

    if (body.isActive !== undefined) {
      fieldsToUpdate.isActive = Boolean(body.isActive);
    }

    if (errors.length > 0) {
      return res.status(400).json({
        code: "validation_error",
        message: "Invalid flight listing update payload.",
        details: errors,
      });
    }

    const updated = await updateFlight(fieldsToUpdate);

    if (!updated) {
      return res.status(404).json({
        code: "not_found",
        message: `Flight with id "${id}" not found.`,
      });
    }

    // Optional: ensure seat availability <= total
    if (
      updated.seatsAvailable != null &&
      updated.seatsTotal != null &&
      updated.seatsAvailable > updated.seatsTotal
    ) {
      // This should never happen if validation is correct; log for diagnosis.
      // We do not fail the request retroactively.
      // eslint-disable-next-line no-console
      console.error(
        "[admin-listings-controller] Updated flight has seatsAvailable > seatsTotal",
        { id }
      );
    }

    return res.status(200).json({ flight: updated });
  } catch (err) {
    return next(err);
  }
}

/**
 * Controller: POST /admin/hotels
 */
export async function createHotelListing(req, res, next) {
  try {
    const body = req.body || {};
    const errors = [];

    const name = body.name ? String(body.name).trim() : "";
    if (!name) {
      errors.push('"name" is required.');
    }

    const addressLine1 = body.addressLine1
      ? String(body.addressLine1).trim()
      : "";
    if (!addressLine1) {
      errors.push('"addressLine1" is required.');
    }

    const city = body.city ? String(body.city).trim() : "";
    if (!city) {
      errors.push('"city" is required.');
    }

    const state = body.state ? String(body.state).trim() : "";
    if (!state) {
      errors.push('"state" is required.');
    } else if (!isValidUsState(state)) {
      return res.status(400).json({
        code: "malformed_state",
        message: "Invalid US state value for hotel listing.",
      });
    }

    const zip = body.zip ? String(body.zip).trim() : "";
    if (!zip) {
      errors.push('"zip" is required.');
    } else if (!isValidZip(zip)) {
      return res.status(400).json({
        code: "malformed_zip",
        message: "Invalid ZIP code for hotel listing.",
      });
    }

    const country =
      body.country && String(body.country).trim()
        ? String(body.country).trim()
        : "United States";

    const basePricePerNight = parsePrice(
      body.basePricePerNight,
      "basePricePerNight",
      errors
    );

    let starRating = null;
    if (body.starRating !== undefined && body.starRating !== null) {
      const sr = Number.parseFloat(String(body.starRating));
      if (Number.isNaN(sr) || sr < 0 || sr > 5) {
        errors.push('"starRating" must be between 0 and 5.');
      } else {
        starRating = sr;
      }
    }

    const currency =
      body.currency && String(body.currency).trim()
        ? String(body.currency).trim().toUpperCase()
        : "USD";

    if (errors.length > 0) {
      return res.status(400).json({
        code: "validation_error",
        message: "Invalid hotel listing payload.",
        details: errors,
      });
    }

    const id = randomUUID();

    const created = await createHotel({
      id,
      name,
      description: body.description ?? null,
      addressLine1,
      addressLine2: body.addressLine2 ?? null,
      city,
      state,
      zip,
      country,
      starRating,
      basePricePerNight,
      currency,
      checkInTime: body.checkInTime ?? null,
      checkOutTime: body.checkOutTime ?? null,
    });

    return res.status(201).json({ hotel: created });
  } catch (err) {
    return next(err);
  }
}

/**
 * Controller: PUT /admin/hotels/:id
 */
export async function updateHotelListing(req, res, next) {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const errors = [];

    if (!id) {
      return res.status(400).json({
        code: "validation_error",
        message: "Path parameter :id is required.",
      });
    }

    const fieldsToUpdate = { id };

    if (body.name !== undefined) {
      const v = String(body.name).trim();
      if (!v) {
        errors.push('"name" cannot be empty.');
      } else {
        fieldsToUpdate.name = v;
      }
    }

    if (body.description !== undefined) {
      fieldsToUpdate.description =
        body.description === null ? null : String(body.description);
    }

    if (body.addressLine1 !== undefined) {
      const v = String(body.addressLine1).trim();
      if (!v) {
        errors.push('"addressLine1" cannot be empty.');
      } else {
        fieldsToUpdate.addressLine1 = v;
      }
    }

    if (body.addressLine2 !== undefined) {
      fieldsToUpdate.addressLine2 =
        body.addressLine2 === null ? null : String(body.addressLine2);
    }

    if (body.city !== undefined) {
      const v = String(body.city).trim();
      if (!v) {
        errors.push('"city" cannot be empty.');
      } else {
        fieldsToUpdate.city = v;
      }
    }

    if (body.state !== undefined) {
      const v = String(body.state).trim();
      if (!isValidUsState(v)) {
        return res.status(400).json({
          code: "malformed_state",
          message: "Invalid US state value for hotel listing.",
        });
      }
      fieldsToUpdate.state = v;
    }

    if (body.zip !== undefined) {
      const v = String(body.zip).trim();
      if (!isValidZip(v)) {
        return res.status(400).json({
          code: "malformed_zip",
          message: "Invalid ZIP code for hotel listing.",
        });
      }
      fieldsToUpdate.zip = v;
    }

    if (body.country !== undefined) {
      const v = String(body.country).trim();
      if (!v) {
        errors.push('"country" cannot be empty.');
      } else {
        fieldsToUpdate.country = v;
      }
    }

    if (body.basePricePerNight !== undefined) {
      const p = parsePrice(
        body.basePricePerNight,
        "basePricePerNight",
        errors
      );
      if (p != null) {
        fieldsToUpdate.basePricePerNight = p;
      }
    }

    if (body.starRating !== undefined) {
      const sr = Number.parseFloat(String(body.starRating));
      if (Number.isNaN(sr) || sr < 0 || sr > 5) {
        errors.push('"starRating" must be between 0 and 5.');
      } else {
        fieldsToUpdate.starRating = sr;
      }
    }

    if (body.currency !== undefined) {
      const v = String(body.currency).trim().toUpperCase();
      if (!v) {
        errors.push('"currency" cannot be empty.');
      } else {
        fieldsToUpdate.currency = v;
      }
    }

    if (body.checkInTime !== undefined) {
      fieldsToUpdate.checkInTime =
        body.checkInTime === null ? null : String(body.checkInTime);
    }

    if (body.checkOutTime !== undefined) {
      fieldsToUpdate.checkOutTime =
        body.checkOutTime === null ? null : String(body.checkOutTime);
    }

    if (body.isActive !== undefined) {
      fieldsToUpdate.isActive = Boolean(body.isActive);
    }

    if (errors.length > 0) {
      return res.status(400).json({
        code: "validation_error",
        message: "Invalid hotel listing update payload.",
        details: errors,
      });
    }

    const updated = await updateHotel(fieldsToUpdate);

    if (!updated) {
      return res.status(404).json({
        code: "not_found",
        message: `Hotel with id "${id}" not found.`,
      });
    }

    return res.status(200).json({ hotel: updated });
  } catch (err) {
    return next(err);
  }
}

/**
 * Controller: POST /admin/cars
 */
export async function createCarListing(req, res, next) {
  try {
    const body = req.body || {};
    const errors = [];

    const providerName = body.providerName
      ? String(body.providerName).trim()
      : "";
    if (!providerName) {
      errors.push('"providerName" is required.');
    }

    const carType = body.carType ? String(body.carType).trim() : "";
    if (!carType) {
      errors.push('"carType" is required.');
    }

    const make = body.make ? String(body.make).trim() : "";
    if (!make) {
      errors.push('"make" is required.');
    }

    const model = body.model ? String(body.model).trim() : "";
    if (!model) {
      errors.push('"model" is required.');
    }

    const modelYear = parseNonNegativeInt(body.modelYear, "modelYear", errors);

    const transmissionRaw = body.transmission
      ? String(body.transmission).trim().toUpperCase()
      : "AUTOMATIC";
    if (!["AUTOMATIC", "MANUAL"].includes(transmissionRaw)) {
      errors.push('"transmission" must be "AUTOMATIC" or "MANUAL".');
    }

    const seats = parseNonNegativeInt(body.seats, "seats", errors);
    const dailyPrice = parsePrice(body.dailyPrice, "dailyPrice", errors);

    const pickupCity = body.pickupCity ? String(body.pickupCity).trim() : "";
    if (!pickupCity) {
      errors.push('"pickupCity" is required.');
    }

    const pickupState = body.pickupState
      ? String(body.pickupState).trim()
      : "";
    if (!pickupState) {
      errors.push('"pickupState" is required.');
    } else if (!isValidUsState(pickupState)) {
      return res.status(400).json({
        code: "malformed_state",
        message: "Invalid US state value for car pickupState.",
      });
    }

    const pickupCountry =
      body.pickupCountry && String(body.pickupCountry).trim()
        ? String(body.pickupCountry).trim()
        : "United States";

    const dropoffCity =
      body.dropoffCity && String(body.dropoffCity).trim()
        ? String(body.dropoffCity).trim()
        : null;
    const dropoffState =
      body.dropoffState && String(body.dropoffState).trim()
        ? String(body.dropoffState).trim()
        : null;
    if (dropoffState && !isValidUsState(dropoffState)) {
      return res.status(400).json({
        code: "malformed_state",
        message: "Invalid US state value for car dropoffState.",
      });
    }
    const dropoffCountry =
      body.dropoffCountry && String(body.dropoffCountry).trim()
        ? String(body.dropoffCountry).trim()
        : null;

    const pickupAirportId =
      body.pickupAirportId && String(body.pickupAirportId).trim()
        ? String(body.pickupAirportId).trim()
        : null;
    const dropoffAirportId =
      body.dropoffAirportId && String(body.dropoffAirportId).trim()
        ? String(body.dropoffAirportId).trim()
        : null;

    const currency =
      body.currency && String(body.currency).trim()
        ? String(body.currency).trim().toUpperCase()
        : "USD";

    if (errors.length > 0) {
      return res.status(400).json({
        code: "validation_error",
        message: "Invalid car listing payload.",
        details: errors,
      });
    }

    const id = randomUUID();

    const created = await createCar({
      id,
      providerName,
      carType,
      make,
      model,
      modelYear,
      transmission: transmissionRaw,
      seats,
      dailyPrice,
      currency,
      pickupCity,
      pickupState,
      pickupCountry,
      dropoffCity,
      dropoffState,
      dropoffCountry,
      pickupAirportId,
      dropoffAirportId,
    });

    return res.status(201).json({ car: created });
  } catch (err) {
    return next(err);
  }
}

/**
 * Controller: PUT /admin/cars/:id
 */
export async function updateCarListing(req, res, next) {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const errors = [];

    if (!id) {
      return res.status(400).json({
        code: "validation_error",
        message: "Path parameter :id is required.",
      });
    }

    const fieldsToUpdate = { id };

    if (body.providerName !== undefined) {
      const v = String(body.providerName).trim();
      if (!v) {
        errors.push('"providerName" cannot be empty.');
      } else {
        fieldsToUpdate.providerName = v;
      }
    }

    if (body.carType !== undefined) {
      const v = String(body.carType).trim();
      if (!v) {
        errors.push('"carType" cannot be empty.');
      } else {
        fieldsToUpdate.carType = v;
      }
    }

    if (body.make !== undefined) {
      const v = String(body.make).trim();
      if (!v) {
        errors.push('"make" cannot be empty.');
      } else {
        fieldsToUpdate.make = v;
      }
    }

    if (body.model !== undefined) {
      const v = String(body.model).trim();
      if (!v) {
        errors.push('"model" cannot be empty.');
      } else {
        fieldsToUpdate.model = v;
      }
    }

    if (body.modelYear !== undefined) {
      const v = parseNonNegativeInt(body.modelYear, "modelYear", errors);
      if (v != null) {
        fieldsToUpdate.modelYear = v;
      }
    }

    if (body.transmission !== undefined) {
      const v = String(body.transmission).trim().toUpperCase();
      if (!["AUTOMATIC", "MANUAL"].includes(v)) {
        errors.push('"transmission" must be "AUTOMATIC" or "MANUAL".');
      } else {
        fieldsToUpdate.transmission = v;
      }
    }

    if (body.seats !== undefined) {
      const v = parseNonNegativeInt(body.seats, "seats", errors);
      if (v != null) {
        fieldsToUpdate.seats = v;
      }
    }

    if (body.dailyPrice !== undefined) {
      const v = parsePrice(body.dailyPrice, "dailyPrice", errors);
      if (v != null) {
        fieldsToUpdate.dailyPrice = v;
      }
    }

    if (body.currency !== undefined) {
      const v = String(body.currency).trim().toUpperCase();
      if (!v) {
        errors.push('"currency" cannot be empty.');
      } else {
        fieldsToUpdate.currency = v;
      }
    }

    if (body.pickupCity !== undefined) {
      const v = String(body.pickupCity).trim();
      if (!v) {
        errors.push('"pickupCity" cannot be empty.');
      } else {
        fieldsToUpdate.pickupCity = v;
      }
    }

    if (body.pickupState !== undefined) {
      const v = String(body.pickupState).trim();
      if (!isValidUsState(v)) {
        return res.status(400).json({
          code: "malformed_state",
          message: "Invalid US state value for car pickupState.",
        });
      }
      fieldsToUpdate.pickupState = v;
    }

    if (body.pickupCountry !== undefined) {
      const v = String(body.pickupCountry).trim();
      if (!v) {
        errors.push('"pickupCountry" cannot be empty.');
      } else {
        fieldsToUpdate.pickupCountry = v;
      }
    }

    if (body.dropoffCity !== undefined) {
      fieldsToUpdate.dropoffCity =
        body.dropoffCity === null ? null : String(body.dropoffCity).trim();
    }

    if (body.dropoffState !== undefined) {
      if (body.dropoffState === null) {
        fieldsToUpdate.dropoffState = null;
      } else {
        const v = String(body.dropoffState).trim();
        if (!isValidUsState(v)) {
          return res.status(400).json({
            code: "malformed_state",
            message: "Invalid US state value for car dropoffState.",
          });
        }
        fieldsToUpdate.dropoffState = v;
      }
    }

    if (body.dropoffCountry !== undefined) {
      fieldsToUpdate.dropoffCountry =
        body.dropoffCountry === null
          ? null
          : String(body.dropoffCountry).trim();
    }

    if (body.pickupAirportId !== undefined) {
      fieldsToUpdate.pickupAirportId =
        body.pickupAirportId === null
          ? null
          : String(body.pickupAirportId).trim();
    }

    if (body.dropoffAirportId !== undefined) {
      fieldsToUpdate.dropoffAirportId =
        body.dropoffAirportId === null
          ? null
          : String(body.dropoffAirportId).trim();
    }

    if (body.isActive !== undefined) {
      fieldsToUpdate.isActive = Boolean(body.isActive);
    }

    if (errors.length > 0) {
      return res.status(400).json({
        code: "validation_error",
        message: "Invalid car listing update payload.",
        details: errors,
      });
    }

    const updated = await updateCar(fieldsToUpdate);

    if (!updated) {
      return res.status(404).json({
        code: "not_found",
        message: `Car with id "${id}" not found.`,
      });
    }

    return res.status(200).json({ car: updated });
  } catch (err) {
    return next(err);
  }
}
