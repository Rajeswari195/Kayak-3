/**
 * @file admin-listings-routes.js
 * @description
 * Express router for admin-only listing management endpoints:
 *   - POST /admin/flights
 *   - PUT  /admin/flights/:id
 *   - POST /admin/hotels
 *   - PUT  /admin/hotels/:id
 *   - POST /admin/cars
 *   - PUT  /admin/cars/:id
 *
 * Responsibilities:
 * - Apply authentication and admin role middlewares.
 * - Map HTTP paths to admin controller functions.
 *
 * Notes:
 * - This router should be mounted from `routes/index.js` under a common
 *   prefix such as `/api`, e.g., `/api/admin/flights`.
 * - It assumes that `auth-middleware.js` exposes `requireAuth` and
 *   `role-middleware.js` exposes `requireAdmin`, as established in Step 10.
 */



import { Router } from "express";
import { requireAuth } from "../middlewares/auth-middleware.js";
import { requireAdmin } from "../middlewares/role-middleware.js";

import {
  createFlightListing,
  updateFlightListing,
  createHotelListing,
  updateHotelListing,
  createCarListing,
  updateCarListing,
} from "../controllers/admin-listings-controller.js";

const router = Router();

// ---------------------------------------------------------------------------
// Flights
// ---------------------------------------------------------------------------

// Create a new flight listing.
router.post(
  "/admin/flights",
  requireAuth,
  requireAdmin,
  createFlightListing
);

// Update an existing flight listing.
router.put(
  "/admin/flights/:id",
  requireAuth,
  requireAdmin,
  updateFlightListing
);

// ---------------------------------------------------------------------------
// Hotels
// ---------------------------------------------------------------------------

// Create a new hotel listing.
router.post(
  "/admin/hotels",
  requireAuth,
  requireAdmin,
  createHotelListing
);

// Update an existing hotel listing.
router.put(
  "/admin/hotels/:id",
  requireAuth,
  requireAdmin,
  updateHotelListing
);

// ---------------------------------------------------------------------------
// Cars
// ---------------------------------------------------------------------------

// Create a new car listing.
router.post(
  "/admin/cars",
  requireAuth,
  requireAdmin,
  createCarListing
);

// Update an existing car listing.
router.put(
  "/admin/cars/:id",
  requireAuth,
  requireAdmin,
  updateCarListing
);

export default router;
