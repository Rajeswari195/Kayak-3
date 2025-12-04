import express from "express";
import { requireAuth } from "../middlewares/auth-middleware.js";
import { requireAdmin } from "../middlewares/role-middleware.js";

import {
  adminListUsersController,
  adminGetUserDetailController,
  adminDeactivateUserController
} from "../controllers/admin-users-controller.js";

import {
  getAdminBillingReportsController
} from "../controllers/admin-billing-controller.js";

const router = express.Router();

// All /admin routes require authenticated ADMIN users.
router.use(requireAuth);
router.use(requireAdmin);

// User management
router.get("/users", adminListUsersController);
router.get("/users/:id", adminGetUserDetailController);
router.patch("/users/:id/deactivate", adminDeactivateUserController);

// Billing management
router.get("/billing", getAdminBillingReportsController);

export default router;