/**
 * @file error-middleware.js
 * @description
 * Centralized Express error handler for the core-api service.
 *
 * Responsibilities:
 * - Convert thrown errors (DomainError or generic errors) into consistent
 *   JSON responses.
 * - Avoid leaking internal stack traces in production while still providing
 *   useful details in development.
 * - Ensure unhandled errors do not crash the process without a log entry.
 */

import { DomainError, ERROR_CODES, isDomainError } from "../lib/errors.js";

/**
 * Express error-handling middleware.
 *
 * Signature with 4 arguments is required for Express to recognize it as
 * an error handler.
 *
 * @param {any} err
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
// eslint-disable-next-line no-unused-vars
export function errorMiddleware(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const env = process.env.NODE_ENV || "development";
  // @ts-ignore
  const requestId = req.requestId || null;

  let statusCode = 500;
  let code = ERROR_CODES.INTERNAL_ERROR;
  let message = "An unexpected error occurred.";

  if (isDomainError(err)) {
    statusCode = err.statusCode || 400;
    code = err.code || ERROR_CODES.INTERNAL_ERROR;
    message = err.message || message;
  } else if (err && err.name === "ValidationError") {
    // Generic validation error (e.g., from libraries) fallback.
    statusCode = 400;
    code = ERROR_CODES.VALIDATION_ERROR;
    message = err.message || "Validation error";
  }

  // Log the error server-side with as much context as we can.
  console.error(
    `[core-api] Error [id=${requestId || "n/a"}]`,
    {
      code,
      statusCode,
      message,
      stack: err && err.stack ? err.stack : undefined
    }
  );

  /** @type {Record<string, any>} */
  const payload = {
    code,
    message,
    requestId
  };

  // Optionally include error details and stack traces in non-production envs.
  if (isDomainError(err) && err.details) {
    payload.details = err.details;
  }

  if (env !== "production" && err && err.stack) {
    payload.stack = err.stack;
  }

  res.status(statusCode).json(payload);
}

export default errorMiddleware;
