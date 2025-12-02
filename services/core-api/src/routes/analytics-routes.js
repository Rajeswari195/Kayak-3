// services/core-api/src/routes/analytics-routes.js

import express from "express";
import {
  getRevenueTopPropertiesController,
  getRevenueByCityController,
  getTopProvidersController,
  getPageClicksController,
  getListingClicksController,
  getReviewDistributionController,
  getUserTraceAnalyticsController,
  getCohortTraceController,
} from "../controllers/analytics-controller.js";
import {
  requireAuth,
  requireAdmin,
} from "../middlewares/auth-middleware.js";

const router = express.Router();

// All analytics routes are ADMIN-only.
router.use(requireAuth, requireAdmin);

// Revenue analytics
router.get(
  "/revenue/top-properties",
  getRevenueTopPropertiesController
);

router.get("/revenue/city", getRevenueByCityController);

router.get("/providers/top", getTopProvidersController);

// Behavior / clickstream
router.get("/clicks/pages", getPageClicksController);

router.get("/clicks/listings", getListingClicksController);

// Review distributions
router.get(
  "/reviews/distribution",
  getReviewDistributionController
);

// Trace diagrams
router.get(
  "/traces/user/:userId",
  getUserTraceAnalyticsController
);

router.get("/traces/cohort", getCohortTraceController);

export default router;
