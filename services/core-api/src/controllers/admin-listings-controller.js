/**
 * @file admin-listings-controller.js
 * @description
 * Express HTTP controllers for admin management of listings.
 * * Responsibilities:
 * - Handle HTTP requests for listing search, creation, and updates.
 * - Delegate to the admin-listings-service for business logic (validation, IATA resolution).
 * - Handle pagination parameters.
 * *
 * * Notes:
 * - All complex validation (IATA codes, state codes) is now handled in the Service layer.
 */

import { normalizePaginationParams } from "../validators/common-validators.js";
import {
  searchAdminFlights,
  searchAdminHotels,
  searchAdminCars,
  createFlightListing as createFlightService,
  updateFlightListing as updateFlightService,
  createHotelListing as createHotelService,
  updateHotelListing as updateHotelService,
  createCarListing as createCarService,
  updateCarListing as updateCarService,
} from "../services/listings/admin-listings-service.js";

// --- FLIGHTS ---

export async function getAdminFlightsController(req, res, next) {
  try {
    const { page, pageSize } = normalizePaginationParams(req.query);
    const result = await searchAdminFlights(req.query, { page, pageSize });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

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

// --- HOTELS ---

export async function getAdminHotelsController(req, res, next) {
  try {
    const { page, pageSize } = normalizePaginationParams(req.query);
    const result = await searchAdminHotels(req.query, { page, pageSize });
    res.json(result);
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

// --- CARS ---

export async function getAdminCarsController(req, res, next) {
  try {
    const { page, pageSize } = normalizePaginationParams(req.query);
    const result = await searchAdminCars(req.query, { page, pageSize });
    res.json(result);
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