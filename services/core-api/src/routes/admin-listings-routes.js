/**
 * @file admin-listings-routes.js
 * @description Admin routes for listings.
 * * Updates:
 * - Paths are now relative (e.g., "/flights" instead of "/admin/flights").
 * - This allows the router to be mounted under "/admin" in index.js, preventing
 * middleware leakage to non-admin routes.
 */

import { Router } from "express";
import { requireAuth } from "../middlewares/auth-middleware.js";
import { requireAdmin } from "../middlewares/role-middleware.js";

import {
  getAdminFlightsController,
  createFlightListing,
  updateFlightListing,
  getAdminHotelsController,
  createHotelListing,
  updateHotelListing,
  getAdminCarsController,
  createCarListing,
  updateCarListing,
} from "../controllers/admin-listings-controller.js";

const router = Router();

// Middleware for all routes in this file
// This is safe now because this router will be mounted under "/admin"
router.use(requireAuth, requireAdmin);

// FLIGHTS
router.get("/flights", getAdminFlightsController);
router.post("/flights", createFlightListing);
router.put("/flights/:id", updateFlightListing);

// HOTELS
router.get("/hotels", getAdminHotelsController);
router.post("/hotels", createHotelListing);
router.put("/hotels/:id", updateHotelListing);

// CARS
router.get("/cars", getAdminCarsController);
router.post("/cars", createCarListing);
router.put("/cars/:id", updateCarListing);

export default router;