import express from "express";
import { requireAuth } from "../middlewares/auth-middleware.js";

import {
  createUserController,
  loginController,
  getCurrentUserController,
  updateCurrentUserController,
  getUserByIdController,
  updateUserByIdController,
  deleteUserByIdController
} from "../controllers/users-controller.js";

const router = express.Router();

// Auth & registration
router.post("/auth/login", loginController);
router.post("/users", createUserController);

// Self-profile endpoints
router.get("/users/me", requireAuth, getCurrentUserController);
router.patch("/users/me", requireAuth, updateCurrentUserController);

// User-by-id endpoints (self or admin, permission-checked in controllers)
router.get("/users/:id", requireAuth, getUserByIdController);
router.put("/users/:id", requireAuth, updateUserByIdController);
router.delete("/users/:id", requireAuth, deleteUserByIdController);

export default router;
