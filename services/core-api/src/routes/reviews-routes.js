/**
 * @file reviews-routes.js
 * @description
 * Routes for review management.
 */

import { Router } from "express";
import { optionalAuth, requireAuth } from "../middlewares/auth-middleware.js";
import {
  createReviewController,
  getReviewsController
} from "../controllers/reviews-controller.js";

const router = Router();

// GET /reviews
// Supports ?my=true (auth required) or ?listingType=... (public)
// We use optionalAuth so the controller can check req.user if 'my=true' is requested
router.get("/reviews", optionalAuth, getReviewsController);

// POST /reviews
// Must be authenticated to leave a review
router.post("/reviews", requireAuth, createReviewController);

export default router;