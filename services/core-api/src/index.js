/**
 * @file index.js
 * @description
 * Entry point for the core-api Express application.
 *
 * Responsibilities (current step):
 * - Bootstrap an Express server using ECMAScript modules.
 * - Load configuration via the centralized config module.
 * - Configure JSON parsing, CORS, basic logging, and health endpoints.
 * - Register a 404 handler and centralized error-handling middleware.
 *
 * Responsibilities (future steps):
 * - Register domain routes (auth, users, listings, bookings, billing, analytics).
 * - Initialize MySQL, MongoDB, Redis, and Kafka clients.
 * - Add auth/role middlewares and OpenAPI/Swagger docs.
 */

import express from "express";
import cors from "cors";

import { loadConfig } from "./config/config.js";
import { loggingMiddleware } from "./middlewares/logging-middleware.js";
import { notFoundMiddleware } from "./middlewares/not-found-middleware.js";
import { errorMiddleware } from "./middlewares/error-middleware.js";

// ---------------------------------------------------------------------------
// Load configuration
// ---------------------------------------------------------------------------

const config = loadConfig();

// ---------------------------------------------------------------------------
// Create and configure Express app
// ---------------------------------------------------------------------------

const app = express();

// Basic security/infra options can be tuned later as needed.
app.disable("x-powered-by");

// JSON body parsing
app.use(express.json());
// Support URL-encoded payloads (forms) if needed later (e.g., webhooks).
app.use(express.urlencoded({ extended: true }));

// CORS configuration using allowed origins from config
app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser or same-origin requests (no Origin header).
      if (!origin) {
        return callback(null, true);
      }

      if (config.corsOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    credentials: true
  })
);

// Request logging (with simple requestId support)
app.use(loggingMiddleware);

// ---------------------------------------------------------------------------
// Core routes (to be extended in later steps)
// ---------------------------------------------------------------------------

/**
 * Root route handler.
 *
 * @route GET /
 */
app.get("/", (req, res) => {
  res.json({
    service: "core-api",
    status: "ok",
    message:
      "Kayak-like travel metasearch core API is running. See /health for a basic health check."
  });
});

/**
 * Basic health-check route handler.
 *
 * @route GET /health
 * @notes
 * - This currently only validates that the HTTP server is responsive.
 *   In later steps, this endpoint (or a sibling) can be extended to check
 *   DB connections, Kafka, Redis, etc.
 */
app.get("/health", (req, res) => {
  res.json({
    service: "core-api",
    status: "ok",
    env: config.env,
    uptimeSeconds: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// TODO (future steps):
// app.use("/api", apiRouter); // where apiRouter aggregates domain routes

// ---------------------------------------------------------------------------
// 404 and error handling
// ---------------------------------------------------------------------------

// Handle unmatched routes
app.use(notFoundMiddleware);

// Centralized error handler
app.use(errorMiddleware);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

app.listen(config.port, () => {
  console.log(
    `[core-api] Server listening on http://localhost:${config.port} (env=${config.env})`
  );
});

// Export app instance for testing (e.g., Supertest).
export default app;
