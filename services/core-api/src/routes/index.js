import express from "express";
import usersRouter from "./users-routes.js";
import adminRouter from "./admin-routes.js";
import listingsRouter from "./listings-routes.js";
import adminListingsRouter from "./admin-listings-routes.js";
import bookingsRouter from "./bookings-routes.js";
import clickstreamRouter from "./clickstream-routes.js";
import reviewsRouter from "./reviews-routes.js";

const router = express.Router();

// User-facing auth & profile routes
router.use(usersRouter);

// Admin-only routes are mounted under /admin
// This router handles /admin/users, /admin/billing
router.use("/admin", adminRouter);

// Admin listing routes (now mounted under /admin to prevent middleware leakage)
// This router handles /admin/flights, /admin/hotels, /admin/cars
router.use("/admin", adminListingsRouter);

// Public search endpoints (e.g. /search/flights)
router.use(listingsRouter);

// Bookings routes (e.g. /bookings)
router.use(bookingsRouter);

// Analytics and clickstream tracking (e.g. /analytics)
router.use("/analytics", clickstreamRouter);

// Reviews routes (e.g. /reviews)
router.use(reviewsRouter);

export default router;