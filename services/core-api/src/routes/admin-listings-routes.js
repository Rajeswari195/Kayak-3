/**
 * @file admin-listings-routes.js
 * @description Admin routes for listings.
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
router.use(requireAuth, requireAdmin);

// FLIGHTS
router.get("/admin/flights", getAdminFlightsController);
router.post("/admin/flights", createFlightListing);
router.put("/admin/flights/:id", updateFlightListing);

// HOTELS
router.get("/admin/hotels", getAdminHotelsController);
router.post("/admin/hotels", createHotelListing);
router.put("/admin/hotels/:id", updateHotelListing);

// CARS
router.get("/admin/cars", getAdminCarsController);
router.post("/admin/cars", createCarListing);
router.put("/admin/cars/:id", updateCarListing);

export default router;