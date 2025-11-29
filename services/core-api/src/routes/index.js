import express from "express";
import usersRouter from "./users-routes.js";
import adminRouter from "./admin-routes.js";

const router = express.Router();

// User-facing auth & profile routes
router.use(usersRouter);

// Admin-only routes are mounted under /admin
router.use("/admin", adminRouter);

export default router;
