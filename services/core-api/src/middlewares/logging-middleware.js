/**
 * @file logging-middleware.js
 * @description
 * Simple request/response logging middleware with a per-request ID.
 *
 * Responsibilities:
 * - Attach a lightweight request ID to `req` and the response headers.
 * - Log inbound requests and outbound responses with method, path, status,
 *   and duration in milliseconds.
 *
 * Notes:
 * - This keeps dependencies minimal by using console.log instead of an
 *   external logger. A more sophisticated logger (e.g., pino) can be
 *   plugged in later without breaking the middleware signature.
 */

/**
 * Generate a simple, reasonably unique request ID.
 *
 * @returns {string}
 */
function generateRequestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Express middleware for structured-ish request logging.
 *
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export function loggingMiddleware(req, res, next) {
  const requestId = generateRequestId();
  const startTime = process.hrtime.bigint();

  // Attach requestId to request and response for downstream use (errors, etc.)
  // @ts-ignore - we are in JS, but this is a common pattern.
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  const path = req.originalUrl || req.url;

  console.log(
    `[core-api] --> ${req.method} ${path} [id=${requestId}]`
  );

  res.on("finish", () => {
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1e6;

    console.log(
      `[core-api] <-- ${req.method} ${path} [id=${requestId}] ${res.statusCode} ${durationMs.toFixed(
        1
      )}ms`
    );
  });

  next();
}

export default loggingMiddleware;
