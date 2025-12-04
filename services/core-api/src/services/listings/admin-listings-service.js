/**
 * @file admin-listings-service.js
 * @description
 * Service-layer utilities for ADMIN listing management:
 * - Create, update, and deactivate flights, hotels, and cars.
 * - Enforce basic validation/business rules (non-negative prices, capacity,
 * temporal consistency for flights, etc.).
 * - Coordinate with MySQL repositories and Redis cache invalidation.
 *
 * Design notes:
 * - This module is intended to be used from admin controllers that already
 * enforce ADMIN role via middleware.
 * - The services here are synchronous from the perspective of the caller:
 * they do not themselves emit Kafka events or perform analytics writes.
 * That orchestration can be layered on top in controllers or dedicated
 * workers if needed.
 */

import { randomUUID } from "node:crypto";

import {
  createFlight,
  updateFlight,
  deactivateFlight,
  findFlightById,
  searchFlights,
} from "../../repositories/mysql/flights-repository.js";
import {
  createHotel,
  updateHotel,
  deactivateHotel,
  findHotelById,
  searchHotels,
} from "../../repositories/mysql/hotels-repository.js";
import {
  createCar,
  updateCar,
  deactivateCar,
  findCarById,
  searchCars,
} from "../../repositories/mysql/cars-repository.js";
import {
  findAirportByIata
} from "../../repositories/mysql/airports-repository.js";

import {
  invalidateFlightSearchCache,
  invalidateHotelSearchCache,
  invalidateCarSearchCache,
} from "../../redis/cache-helpers.js";

import { DomainError } from "../../lib/errors.js";

/**
 * @typedef {Object} CreateFlightInput
 * @property {string} [id]
 * @property {string} flightNumber
 * @property {string} airline
 * @property {string} originAirportId
 * @property {string} destinationAirportId
 * @property {string} departureTime ISO timestamp string.
 * @property {string} arrivalTime ISO timestamp string.
 * @property {number} [totalDurationMinutes] Optional; if omitted, computed from departure/arrival times.
 * @property {number} [stops]
 * @property {"ECONOMY"|"PREMIUM_ECONOMY"|"BUSINESS"|"FIRST"} cabinClass
 * @property {number} basePrice
 * @property {string} [currency]
 * @property {number} seatsTotal
 * @property {number} [seatsAvailable]
 */

/**
 * Utility to assert that a value is a finite number >= 0.
 *
 * @param {number} value
 * @param {string} fieldName
 */
function assertNonNegativeNumber(value, fieldName) {
  if (!Number.isFinite(value) || value < 0) {
    throw new DomainError("validation_error", `"${fieldName}" must be a non-negative number.`);
  }
}

/**
 * Utility to assert that a value is a finite number > 0.
 *
 * @param {number} value
 * @param {string} fieldName
 */
function assertPositiveNumber(value, fieldName) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new DomainError("validation_error", `"${fieldName}" must be a positive number.`);
  }
}

/**
 * Compute total duration in minutes based on ISO departure/arrival times.
 *
 * @param {string} departureTime
 * @param {string} arrivalTime
 * @returns {number}
 */
function computeDurationMinutes(departureTime, arrivalTime) {
  const dep = new Date(departureTime);
  const arr = new Date(arrivalTime);
  if (Number.isNaN(dep.getTime()) || Number.isNaN(arr.getTime())) {
    throw new DomainError("invalid_datetime", "departureTime and arrivalTime must be valid ISO date-time strings.");
  }
  const diffMs = arr.getTime() - dep.getTime();
  const diffMinutes = diffMs / 60000;
  if (!Number.isFinite(diffMinutes) || diffMinutes <= 0) {
    throw new DomainError("invalid_date_range", "arrivalTime must be after departureTime.");
  }
  return Math.round(diffMinutes);
}

// --- SEARCH / LIST ---

export async function searchAdminFlights(query, { page, pageSize }) {
  // For admins, we typically want to see everything, including inactive listings.
  const filters = {
    onlyActive: false
  };
  
  const options = {
    limit: pageSize,
    offset: (page - 1) * pageSize,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  };

  const { items, total } = await searchFlights(filters, options);
  return { items, total, page, pageSize };
}

export async function searchAdminHotels(query, { page, pageSize }) {
  const filters = {
    onlyActive: false
  };
  const options = {
    limit: pageSize,
    offset: (page - 1) * pageSize,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  };
  const { items, total } = await searchHotels(filters, options);
  return { items, total, page, pageSize };
}

export async function searchAdminCars(query, { page, pageSize }) {
  const filters = {
    onlyActive: false
  };
  const options = {
    limit: pageSize,
    offset: (page - 1) * pageSize,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  };
  const { items, total } = await searchCars(filters, options);
  return { items, total, page, pageSize };
}

// --- FLIGHTS ---

/**
 * Create a new flight listing.
 * Resolves 3-letter IATA codes to internal UUIDs if necessary.
 *
 * @param {CreateFlightInput} payload
 * @returns {Promise<Object>} Flight DTO from the repository.
 */
export async function createFlightListing(payload) {
  const id = payload.id || randomUUID();

  if (!payload.flightNumber || !payload.airline) {
    throw new DomainError("validation_error", "flightNumber and airline are required.");
  }
  
  let originAirportId = payload.originAirportId;
  let destinationAirportId = payload.destinationAirportId;

  if (!originAirportId || !destinationAirportId) {
    throw new DomainError("validation_error", "originAirportId and destinationAirportId are required.");
  }

  // --- IATA Resolution Logic ---
  // If the input is exactly 3 uppercase letters, assume it's an IATA code and try to look it up.
  // This is a heuristic; UUIDs are much longer.
  if (originAirportId.length === 3) {
    const airport = await findAirportByIata(originAirportId);
    if (!airport) {
      throw new DomainError("validation_error", `Unknown Origin IATA code: ${originAirportId}. Make sure airports are seeded.`);
    }
    originAirportId = airport.id;
  }

  if (destinationAirportId.length === 3) {
    const airport = await findAirportByIata(destinationAirportId);
    if (!airport) {
      throw new DomainError("validation_error", `Unknown Destination IATA code: ${destinationAirportId}. Make sure airports are seeded.`);
    }
    destinationAirportId = airport.id;
  }
  // -----------------------------

  const basePrice = Number(payload.basePrice);
  assertNonNegativeNumber(basePrice, "basePrice");

  const seatsTotal = Number(payload.seatsTotal);
  assertPositiveNumber(seatsTotal, "seatsTotal");

  const seatsAvailable = payload.seatsAvailable != null ? Number(payload.seatsAvailable) : seatsTotal;
  assertNonNegativeNumber(seatsAvailable, "seatsAvailable");
  if (seatsAvailable > seatsTotal) {
    throw new DomainError("validation_error", "seatsAvailable cannot exceed seatsTotal.");
  }

  const stops = payload.stops != null ? Number(payload.stops) : 0;
  if (!Number.isInteger(stops) || stops < 0) {
    throw new DomainError("validation_error", '"stops" must be an integer >= 0.');
  }

  const allowedCabinClasses = ["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"];
  const cabinClass = String(payload.cabinClass || "ECONOMY").toUpperCase();
  if (!allowedCabinClasses.includes(cabinClass)) {
    throw new DomainError("invalid_cabin_class", `cabinClass must be one of: ${allowedCabinClasses.join(", ")}.`);
  }

  const departureTime = String(payload.departureTime);
  const arrivalTime = String(payload.arrivalTime);
  const totalDurationMinutes = payload.totalDurationMinutes != null 
    ? Number(payload.totalDurationMinutes) 
    : computeDurationMinutes(departureTime, arrivalTime);

  assertPositiveNumber(totalDurationMinutes, "totalDurationMinutes");

  const currency = (payload.currency || "USD").toUpperCase();

  const inputForRepo = {
    id,
    flightNumber: payload.flightNumber,
    airline: payload.airline,
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
  };

  const created = await createFlight(inputForRepo);
  await invalidateFlightSearchCache();
  return created;
}

export async function updateFlightListing(payload) {
  if (!payload.id) throw new DomainError("validation_error", '"id" is required to update a flight listing.');

  // Validate numeric fields when present.
  if (payload.basePrice != null) {
    assertNonNegativeNumber(Number(payload.basePrice), "basePrice");
  }
  if (payload.seatsTotal != null) {
    assertPositiveNumber(Number(payload.seatsTotal), "seatsTotal");
  }
  if (payload.seatsAvailable != null) {
    assertNonNegativeNumber(Number(payload.seatsAvailable), "seatsAvailable");
  }
  if (
    payload.seatsTotal != null &&
    payload.seatsAvailable != null &&
    Number(payload.seatsAvailable) > Number(payload.seatsTotal)
  ) {
    throw new DomainError("validation_error", "seatsAvailable cannot exceed seatsTotal.");
  }

  const updateFields = { ...payload };

  // Recompute duration if times changed
  if (payload.departureTime != null && payload.arrivalTime != null && payload.totalDurationMinutes == null) {
    updateFields.totalDurationMinutes = computeDurationMinutes(String(payload.departureTime), String(payload.arrivalTime));
  }

  const updated = await updateFlight(updateFields);
  if (!updated) {
    throw new DomainError("listing_not_found", `Flight listing with id "${payload.id}" was not found.`);
  }

  await invalidateFlightSearchCache();
  return updated;
}

export async function deactivateFlightListing(id) {
  if (!id) throw new DomainError("validation_error", '"id" is required to deactivate a flight listing.');
  const success = await deactivateFlight(id);
  await invalidateFlightSearchCache();
  return { id, deactivated: !!success };
}

// --- HOTELS ---

export async function createHotelListing(payload) {
  const id = payload.id || randomUUID();

  if (!payload.name) {
    throw new DomainError("validation_error", '"name" is required for a hotel listing.');
  }
  // Basic address validation
  if (!payload.addressLine1 || !payload.city || !payload.state || !payload.zip) {
    throw new DomainError("validation_error", "addressLine1, city, state, and zip are required for a hotel listing.");
  }

  const basePricePerNight = Number(payload.basePricePerNight);
  assertNonNegativeNumber(basePricePerNight, "basePricePerNight");

  if (payload.starRating != null) {
    const stars = Number(payload.starRating);
    if (!Number.isFinite(stars) || stars < 0 || stars > 5) {
      throw new DomainError("validation_error", '"starRating" must be between 0 and 5.');
    }
  }

  const currency = (payload.currency || "USD").toUpperCase();

  const inputForRepo = {
    id,
    name: payload.name,
    description: payload.description ?? null,
    addressLine1: payload.addressLine1,
    addressLine2: payload.addressLine2 ?? null,
    city: payload.city,
    state: payload.state,
    zip: payload.zip,
    country: payload.country || "United States",
    starRating: payload.starRating != null ? Number(payload.starRating) : null,
    basePricePerNight,
    currency,
    checkInTime: payload.checkInTime ?? null,
    checkOutTime: payload.checkOutTime ?? null,
  };

  const created = await createHotel(inputForRepo);
  await invalidateHotelSearchCache();
  return created;
}

export async function updateHotelListing(payload) {
  if (!payload.id) throw new DomainError("validation_error", '"id" is required to update a hotel listing.');

  if (payload.basePricePerNight != null) {
    assertNonNegativeNumber(Number(payload.basePricePerNight), "basePricePerNight");
  }

  if (payload.starRating != null) {
    const stars = Number(payload.starRating);
    if (!Number.isFinite(stars) || stars < 0 || stars > 5) {
      throw new DomainError("validation_error", '"starRating" must be between 0 and 5.');
    }
  }

  const updated = await updateHotel({ ...payload });
  if (!updated) {
    throw new DomainError("listing_not_found", `Hotel listing with id "${payload.id}" was not found.`);
  }

  await invalidateHotelSearchCache();
  return updated;
}

export async function deactivateHotelListing(id) {
  if (!id) throw new DomainError("validation_error", '"id" is required to deactivate a hotel listing.');
  const success = await deactivateHotel(id);
  await invalidateHotelSearchCache();
  return { id, deactivated: !!success };
}

// --- CARS ---

export async function createCarListing(payload) {
  const id = payload.id || randomUUID();

  if (!payload.providerName) {
    throw new DomainError("validation_error", '"providerName" is required for a car listing.');
  }
  if (!payload.carType || !payload.make || !payload.model) {
    throw new DomainError("validation_error", '"carType", "make", and "model" are required for a car listing.');
  }
  if (!payload.pickupCity || !payload.pickupState) {
    throw new DomainError("validation_error", '"pickupCity" and "pickupState" are required for a car listing.');
  }

  const modelYear = Number(payload.modelYear);
  if (!Number.isInteger(modelYear) || modelYear < 1900) {
    throw new DomainError("validation_error", '"modelYear" must be a reasonable integer year (>= 1900).');
  }

  const seats = Number(payload.seats);
  assertPositiveNumber(seats, "seats");

  const dailyPrice = Number(payload.dailyPrice);
  assertNonNegativeNumber(dailyPrice, "dailyPrice");

  const transmission = String(payload.transmission || "AUTOMATIC").toUpperCase();
  if (transmission !== "AUTOMATIC" && transmission !== "MANUAL") {
    throw new DomainError("validation_error", '"transmission" must be either "AUTOMATIC" or "MANUAL".');
  }

  const currency = (payload.currency || "USD").toUpperCase();

  const inputForRepo = {
    id,
    providerName: payload.providerName,
    carType: payload.carType,
    make: payload.make,
    model: payload.model,
    modelYear,
    transmission,
    seats,
    dailyPrice,
    currency,
    pickupCity: payload.pickupCity,
    pickupState: payload.pickupState,
    pickupCountry: payload.pickupCountry || "United States",
    dropoffCity: payload.dropoffCity ?? null,
    dropoffState: payload.dropoffState ?? null,
    dropoffCountry: payload.dropoffCountry ?? null,
    pickupAirportId: payload.pickupAirportId ?? null,
    dropoffAirportId: payload.dropoffAirportId ?? null,
  };

  const created = await createCar(inputForRepo);
  await invalidateCarSearchCache();
  return created;
}

export async function updateCarListing(payload) {
  if (!payload.id) throw new DomainError("validation_error", '"id" is required to update a car listing.');

  if (payload.modelYear != null) {
    const modelYear = Number(payload.modelYear);
    if (!Number.isInteger(modelYear) || modelYear < 1900) {
      throw new DomainError("validation_error", '"modelYear" must be a reasonable integer year (>= 1900).');
    }
  }

  if (payload.seats != null) {
    assertPositiveNumber(Number(payload.seats), "seats");
  }

  if (payload.dailyPrice != null) {
    assertNonNegativeNumber(Number(payload.dailyPrice), "dailyPrice");
  }

  if (payload.transmission != null) {
    const transmission = String(payload.transmission).toUpperCase();
    if (transmission !== "AUTOMATIC" && transmission !== "MANUAL") {
      throw new DomainError("validation_error", '"transmission" must be either "AUTOMATIC" or "MANUAL".');
    }
  }

  const updated = await updateCar({ ...payload });
  if (!updated) {
    throw new DomainError("listing_not_found", `Car listing with id "${payload.id}" was not found.`);
  }

  await invalidateCarSearchCache();
  return updated;
}

export async function deactivateCarListing(id) {
  if (!id) throw new DomainError("validation_error", '"id" is required to deactivate a car listing.');
  const success = await deactivateCar(id);
  await invalidateCarSearchCache();
  return { id, deactivated: !!success };
}

// --- CONVENIENCE GETTERS (Used by admin controllers for single-item lookups) ---

export async function getFlightListingById(id, { includeInactive = true } = {}) {
  if (!id) throw new DomainError("validation_error", '"id" is required to fetch a flight listing.');
  const flight = await findFlightById(id, { includeInactive });
  if (!flight) throw new DomainError("listing_not_found", `Flight listing with id "${id}" was not found.`);
  return flight;
}

export async function getHotelListingById(id, { includeInactive = true } = {}) {
  if (!id) throw new DomainError("validation_error", '"id" is required to fetch a hotel listing.');
  const hotel = await findHotelById(id, { includeInactive });
  if (!hotel) throw new DomainError("listing_not_found", `Hotel listing with id "${id}" was not found.`);
  return hotel;
}

export async function getCarListingById(id, { includeInactive = true } = {}) {
  if (!id) throw new DomainError("validation_error", '"id" is required to fetch a car listing.');
  const car = await findCarById(id, { includeInactive });
  if (!car) throw new DomainError("listing_not_found", `Car listing with id "${id}" was not found.`);
  return car;
}