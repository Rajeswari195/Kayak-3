/**
 * @file errors.js
 * @description
 * Central error types and error code constants for the core-api service.
 *
 * Responsibilities:
 * - Provide a base DomainError class that other domain-specific errors extend.
 * - Define a canonical set of error codes used across controllers/services.
 * - Offer simple helper predicates for error handling middleware.
 *
 * Notes:
 * - These error types are intentionally lightweight and dependency-free.
 * - Controllers and services should throw DomainError (or subclasses) rather
 *   than manually constructing HTTP responses.
 */

/**
 * Canonical error codes for the API.
 *
 * These codes should be surfaced to clients as-is, so they can build
 * UI and behavior around them (e.g., "invalid_user_id", "malformed_state").
 */
export const ERROR_CODES = {
  INVALID_USER_ID: "invalid_user_id",
  MALFORMED_STATE: "malformed_state",
  MALFORMED_ZIP: "malformed_zip",
  DUPLICATE_USER: "duplicate_user",

  INVALID_CREDENTIALS: "invalid_credentials",
  ACCOUNT_SUSPENDED: "account_suspended",
  TOKEN_INVALID: "token_invalid",
  TOKEN_EXPIRED: "token_expired",

  UNAUTHORIZED: "unauthorized",
  FORBIDDEN: "forbidden",
  NOT_FOUND: "not_found",

  VALIDATION_ERROR: "validation_error",
  CONFLICT: "conflict",

  NO_INVENTORY: "no_inventory",
  PAYMENT_FAILED: "payment_failed",

  INTERNAL_ERROR: "internal_error"
};

/**
 * Base class for all domain-level errors in the core-api.
 *
 * @extends Error
 */
export class DomainError extends Error {
  /**
   * @param {string} message - Human-readable error message.
   * @param {Object} [options]
   * @param {string} [options.code] - Machine-readable error code (see ERROR_CODES).
   * @param {number} [options.statusCode=400] - HTTP status code to use.
   * @param {any} [options.details] - Optional structured details for debugging/UX.
   */
  constructor(message, { code, statusCode = 400, details } = {}) {
    super(message || "Domain error");
    this.name = this.constructor.name;
    this.code = code || ERROR_CODES.INTERNAL_ERROR;
    this.statusCode = statusCode;
    this.details = details;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Error representing validation failures (e.g., bad payload, SSN/state/ZIP).
 */
export class ValidationError extends DomainError {
  /**
   * @param {string} message
   * @param {any} [details]
   */
  constructor(message, details) {
    super(message || "Validation error", {
      code: ERROR_CODES.VALIDATION_ERROR,
      statusCode: 400,
      details
    });
  }
}

/**
 * Error representing a missing resource (e.g., booking not found).
 */
export class NotFoundError extends DomainError {
  /**
   * @param {string} message
   * @param {any} [details]
   */
  constructor(message, details) {
    super(message || "Resource not found", {
      code: ERROR_CODES.NOT_FOUND,
      statusCode: 404,
      details
    });
  }
}

/**
 * Error representing an authentication failure (no/invalid credentials).
 */
export class UnauthorizedError extends DomainError {
  /**
   * @param {string} message
   * @param {any} [details]
   */
  constructor(message, details) {
    super(message || "Unauthorized", {
      code: ERROR_CODES.UNAUTHORIZED,
      statusCode: 401,
      details
    });
  }
}

/**
 * Error representing a permission issue (user lacks required role).
 */
export class ForbiddenError extends DomainError {
  /**
   * @param {string} message
   * @param {any} [details]
   */
  constructor(message, details) {
    super(message || "Forbidden", {
      code: ERROR_CODES.FORBIDDEN,
      statusCode: 403,
      details
    });
  }
}

/**
 * Error representing a conflict (e.g., duplicate_user).
 */
export class ConflictError extends DomainError {
  /**
   * @param {string} message
   * @param {string} [code]
   * @param {any} [details]
   */
  constructor(message, code = ERROR_CODES.CONFLICT, details) {
    super(message || "Conflict", {
      code,
      statusCode: 409,
      details
    });
  }
}

/**
 * Cheap type guard for DomainError instances.
 *
 * @param {unknown} err
 * @returns {err is DomainError}
 */
export function isDomainError(err) {
  return err instanceof DomainError;
}
