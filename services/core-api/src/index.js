/**
 * @file index.js
 * @description
 * Entry point for the core-api Express application.
 *
 * Responsibilities (at this step):
 * - Bootstrap a minimal Express server using ECMAScript modules.
 * - Expose a simple root endpoint (`/`) and a basic health-check endpoint (`/health`)
 *   to quickly verify that the service starts and responds correctly.
 *
 * Responsibilities (future steps):
 * - Wire up configuration loading from environment variables.
 * - Register routes for auth, users, listings, bookings, billing, analytics, reviews,
 *   and clickstream ingestion.
 * - Plug in middlewares for logging, error handling, authentication, and role-based access.
 * - Connect to MySQL, MongoDB, Redis, and Kafka.
 *
 * @assumptions
 * - A `.env` file or environment variables will be set up in a later step.
 * - This file is run via `npm run dev` (with nodemon) or `npm start` from
 *   the `services/core-api` directory.
 *
 * @notes
 * - The server uses a default port of 4000 if `PORT` is not provided.
 * - The minimal implementation here intentionally avoids domain logic or DB usage.
 */

// BEGIN WRITING FILE CODE

import express from "express";

/**
 * Create the Express application instance.
 * Express is used here with minimal configuration; JSON parsing and routing
 * will be extended in later steps.
 */
const app = express();

/**
 * Enable basic JSON body parsing so that when we start adding routes,
 * they can immediately consume JSON payloads.
 */
app.use(express.json());

/**
 * Determine the port to listen on.
 * In later steps, this will be moved into a centralized config module.
 */
const PORT = process.env.PORT || 4000;

/**
 * Root route handler.
 *
 * @route GET /
 * @returns {Object} A simple JSON payload describing the service and
 *                   pointing to the health-check endpoint.
 */
app.get("/", (req, res) => {
  res.json({
    service: "core-api",
    status: "ok",
    message:
      "Kayak-like travel metasearch core API is running. See /health for a basic health check.",
  });
});

/**
 * Health-check route handler.
 *
 * @route GET /health
 * @returns {Object}
 *   - status: "ok" when the HTTP server is responding.
 *   - uptime: server process uptime in seconds.
 *   - timestamp: ISO string of the current server time.
 *
 * @notes
 * - This endpoint does NOT check downstream dependencies (DBs, Kafka, etc.)
 *   yet. Those checks will be added in a more advanced health endpoint later.
 */
app.get("/health", (req, res) => {
  res.json({
    service: "core-api",
    status: "ok",
    uptimeSeconds: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

/**
 * Start the HTTP server.
 *
 * @function listen
 * Binds the Express app to the configured port and logs a simple startup message.
 */
app.listen(PORT, () => {
  // For now, use a simple console.log; a structured logger will be introduced later.
  console.log(`[core-api] Server listening on http://localhost:${PORT}`);
});

/**
 * Export the app instance.
 * This can be useful for integration testing (e.g., Supertest)
 * where we want to start/stop the app programmatically.
 */
export default app;
