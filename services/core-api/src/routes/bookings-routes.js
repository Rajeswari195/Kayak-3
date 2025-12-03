/**
 * @file bookings-routes.js
 * @description
 * Express router for booking-related endpoints in the core-api service.
 *
 * Routes defined here:
 * - POST /bookings/flight   → create a flight booking for the authenticated user
 * - POST /bookings/hotel    → create a hotel booking for the authenticated user
 * - POST /bookings/car      → create a car booking for the authenticated user
 * - GET  /bookings          → list bookings for the authenticated user (past/current/future/all)
 *
 * Usage:
 *   import bookingsRouter from "./bookings-routes.js";
 *   app.use("/api", bookingsRouter);
 *
 * Notes:
 * - All routes require JWT authentication via `requireAuth`.
 * - Role checks are NOT applied here; bookings are user-facing operations.
 *   Admin-specific booking views would belong in a separate admin router.
 */



import { Router } from "express";
import { requireAuth } from "../middlewares/auth-middleware.js";
import {
    createFlightBookingController,
    createHotelBookingController,
    createCarBookingController,
    getUserBookingsController
} from "../controllers/bookings-controller.js";

const router = Router();

/**
 * POST /bookings/flight
 *
 * Create a flight booking for the authenticated user.
 */
router.post(
    "/bookings/flight",
    requireAuth,
    createFlightBookingController
);

/**
 * POST /bookings/hotel
 *
 * Create a hotel booking for the authenticated user.
 */
router.post(
    "/bookings/hotel",
    requireAuth,
    createHotelBookingController
);

/**
 * POST /bookings/car
 *
 * Create a car booking for the authenticated user.
 */
router.post(
    "/bookings/car",
    requireAuth,
    createCarBookingController
);

/**
 * GET /bookings
 *
 * Retrieve bookings for the authenticated user.
 *
 * Optional query parameters:
 * - scope=past|current|future|all (default "all")
 */
router.get(
    "/bookings",
    requireAuth,
    getUserBookingsController
);

/**
 * GET /bookings/my
 *
 * Alias for /bookings to match frontend expectations.
 */
router.get(
    "/bookings/my",
    requireAuth,
    getUserBookingsController
);

export default router;
