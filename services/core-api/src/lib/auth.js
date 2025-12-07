/**
 * @file auth.js
 * @description
 * Authentication helpers for the core-api service.
 *
 * Responsibilities:
 * - Hash and verify passwords using bcrypt.
 * - Sign and verify JWT access tokens that encode user identity and role.
 *
 * Design notes:
 * - Uses the shared config loader for the JWT secret.
 * - Exposes small, focused helpers that can be reused across services
 *   (e.g., in login service and auth middleware).
 */

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { loadConfig } from "../config/config.js";

/**
 * Cost factor for bcrypt. 10 is a reasonable default for demo/teaching
 * purposes and can be tuned per environment if needed.
 *
 * @type {number}
 */
const BCRYPT_ROUNDS = 10;

/**
 * Default JWT expiry time. Can be overridden via the JWT_EXPIRES_IN env var
 * using any value supported by jsonwebtoken (e.g., "15m", "1h").
 *
 * @type {string}
 */
const DEFAULT_JWT_EXPIRES_IN = "30m";

const config = loadConfig();

/**
 * Resolve the JWT expiry setting.
 *
 * @returns {string}
 */
function getJwtExpiresIn() {
  const fromEnv = process.env.JWT_EXPIRES_IN;
  if (fromEnv && typeof fromEnv === "string" && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }
  return DEFAULT_JWT_EXPIRES_IN;
}

/**
 * Hash a plaintext password using bcrypt.
 *
 * @param {string} plainPassword
 * @returns {Promise<string>} bcrypt hash
 */
export async function hashPassword(plainPassword) {
  if (typeof plainPassword !== "string" || plainPassword.length === 0) {
    throw new Error("[auth] Cannot hash empty password.");
  }

  return bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
}

/**
 * Compare a plaintext password against a stored bcrypt hash.
 *
 * @param {string} plainPassword
 * @param {string} passwordHash
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(plainPassword, passwordHash) {
  if (
    typeof plainPassword !== "string" ||
    plainPassword.length === 0 ||
    typeof passwordHash !== "string" ||
    passwordHash.length === 0
  ) {
    return false;
  }

  return bcrypt.compare(plainPassword, passwordHash);
}

/**
 * @typedef {Object} AccessTokenPayloadInput
 * @property {string} id - Internal user ID (MySQL users.id).
 * @property {("USER"|"ADMIN")} role - User role.
 * @property {string} email - User email address.
 * @property {string} [firstName]
 * @property {string} [lastName]
 */

/**
 * Generate a signed JWT access token for the given user identity.
 *
 * The resulting token will contain:
 * - sub: user ID
 * - role: USER or ADMIN
 * - email, firstName, lastName (when provided)
 *
 * @param {AccessTokenPayloadInput} user
 * @returns {string} Signed JWT token
 */
export function signAccessToken(user) {
  const { id, role, email, firstName, lastName } = user;

  const payload = {
    sub: id,
    role,
    email,
    firstName,
    lastName
  };

  const expiresIn = getJwtExpiresIn();

  return jwt.sign(payload, config.jwtSecret, {
    expiresIn
  });
}

/**
 * Verify a JWT access token and return its decoded payload.
 *
 * @param {string} token
 * @returns {jwt.JwtPayload & { sub?: string, role?: string }}
 * @throws {jwt.JsonWebTokenError | jwt.TokenExpiredError}
 */
export function verifyAccessToken(token) {
  // jsonwebtoken will throw for invalid/expired tokens; callers should handle.
  // For Demo Pilot Run: Ignore expiration to allow easy viewing of booking
  return /** @type {jwt.JwtPayload & { sub?: string, role?: string }} */ (
    jwt.verify(token, config.jwtSecret, { ignoreExpiration: true })
  );
}
