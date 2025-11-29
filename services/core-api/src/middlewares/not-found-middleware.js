/**
 * @file not-found-middleware.js
 * @description
 * Express middleware to handle unmatched routes (404 Not Found).
 *
 * Responsibilities:
 * - Return a consistent JSON error payload when no route matches.
 * - Include the HTTP method, original URL, and requestId for debugging.
 */

import { ERROR_CODES } from "../lib/errors.js";

/**
 * 404 handler for unmatched routes.
 *
 * This should be registered *after* all route handlers, but *before* the
 * error-handling middleware.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} _next
 */
// eslint-disable-next-line no-unused-vars
export function notFoundMiddleware(req, res, _next) {
  // @ts-ignore
  const requestId = req.requestId || null;
  const path = req.originalUrl || req.url;

  res.status(404).json({
    code: ERROR_CODES.NOT_FOUND,
    message: `Route ${req.method} ${path} not found`,
    requestId
  });
}

export default notFoundMiddleware;
