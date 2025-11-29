import express from "express";
import usersRouter from "./users-routes.js";
import adminRouter from "./admin-routes.js";
import listingsRouter from "./listings-routes.js";
import adminListingsRouter from "./admin-listings-routes.js";

const router = express.Router();

// User-facing auth & profile routes
router.use(usersRouter);

// Admin-only routes are mounted under /admin
router.use("/admin", adminRouter);

// Public search endpoints
router.use(listingsRouter);

// Admin listing management
router.use(adminListingsRouter);

export default router;
