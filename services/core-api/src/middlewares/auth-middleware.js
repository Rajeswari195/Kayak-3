/**
 * @file auth-middleware.js
 * @description
 * Express middleware for JWT-based authentication.
 *
 * Responsibilities:
 * - Parse the Authorization header (Bearer token).
 * - Verify the JWT and attach a `user` object to the request.
 * - Return standardized error responses when authentication fails.
 *
 * Notes:
 * - This middleware does not check roles; see `role-middleware.js` for that.
 * - Routes that require authentication should include `requireAuth` in their
 *   middleware chain.
 */

import { verifyAccessToken } from "../lib/auth.js";

/**
 * Shape of the user object attached to Express Request by this middleware.
 *
 * @typedef {Object} AuthenticatedUser
 * @property {string} id
 * @property {("USER"|"ADMIN")} role
 * @property {string} [email]
 * @property {string} [firstName]
 * @property {string} [lastName]
 */

/**
 * Express middleware that enforces the presence of a valid JWT.
 *
 * On success:
 *   - Attaches `req.user` with fields { id, role, email?, firstName?, lastName? }.
 *   - Calls `next()`.
 *
 * On failure:
 *   - Responds with HTTP 401 and a JSON body:
 *       { code: "token_missing" | "token_invalid" | "token_expired", message: string }
 *
 * @param {import("express").Request & { user?: AuthenticatedUser }} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export function requireAuth(req, res, next) {
  const authHeader =
    req.headers.authorization || /** @type {string | undefined} */ (
      req.headers.Authorization
    );

  if (!authHeader || typeof authHeader !== "string") {
    return res.status(401).json({
      code: "token_missing",
      message:
        "Authorization header missing. Provide a Bearer token to access this resource."
    });
  }

  const [scheme, token] = authHeader.split(" ");

  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
    return res.status(401).json({
      code: "token_missing",
      message:
        "Authorization header must be in the format 'Bearer <token>'."
    });
  }

  try {
    const decoded = verifyAccessToken(token);

    if (!decoded || typeof decoded !== "object" || !decoded.sub) {
      return res.status(401).json({
        code: "token_invalid",
        message: "Invalid access token."
      });
    }

    /** @type {AuthenticatedUser} */
    const user = {
      id: String(decoded.sub),
      role:
        decoded.role === "ADMIN" || decoded.role === "USER"
          ? /** @type {("USER"|"ADMIN")} */ (decoded.role)
          : "USER",
      email: decoded.email ? String(decoded.email) : undefined,
      firstName: decoded.firstName ? String(decoded.firstName) : undefined,
      lastName: decoded.lastName ? String(decoded.lastName) : undefined
    };

    // Attach user to request for downstream handlers.
    // eslint-disable-next-line no-param-reassign
    req.user = user;

    return next();
  } catch (err) {
    // Distinguish between expiration and other JWT errors.
    if (err && typeof err === "object" && err.name === "TokenExpiredError") {
      return res.status(401).json({
        code: "token_expired",
        message: "Access token has expired."
      });
    }

    return res.status(401).json({
      code: "token_invalid",
      message: "Invalid access token."
    });
  }
}

/**
 * Optional authentication middleware.
 * Attaches user if valid JWT is present, but continues even if no token provided.
 * Useful for endpoints that work for both authenticated and anonymous users.
 *
 * On success with token:
 *   - Attaches `req.user` with fields { id, role, email?, firstName?, lastName? }
 *   - Calls `next()`
 *
 * On missing or invalid token:
 *   - Sets `req.user = null`
 *   - Calls `next()` (continues processing)
 *
 * @param {import("express").Request & { user?: AuthenticatedUser | null }} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export function optionalAuth(req, res, next) {
  const authHeader =
    req.headers.authorization || /** @type {string | undefined} */ (
      req.headers.Authorization
    );

  // No auth header provided - continue as anonymous
  if (!authHeader || typeof authHeader !== "string") {
    req.user = null;
    return next();
  }

  const [scheme, token] = authHeader.split(" ");

  // Invalid auth header format - continue as anonymous
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = verifyAccessToken(token);

    if (!decoded || typeof decoded !== "object" || !decoded.sub) {
      // Invalid token - continue as anonymous
      req.user = null;
      return next();
    }

    /** @type {AuthenticatedUser} */
    const user = {
      id: String(decoded.sub),
      role:
        decoded.role === "ADMIN" || decoded.role === "USER"
          ? /** @type {("USER"|"ADMIN")} */ (decoded.role)
          : "USER",
      email: decoded.email ? String(decoded.email) : undefined,
      firstName: decoded.firstName ? String(decoded.firstName) : undefined,
      lastName: decoded.lastName ? String(decoded.lastName) : undefined
    };

    // Attach user to request
    // eslint-disable-next-line no-param-reassign
    req.user = user;

    return next();
  } catch (err) {
    // Any token error - continue as anonymous
    req.user = null;
    return next();
  }
}

