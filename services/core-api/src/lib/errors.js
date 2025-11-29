/**
 * @file errors.js
 * @description
 * Centralized error code constants and domain error classes for the core-api.
 *
 * Responsibilities:
 * - Define a canonical set of error code strings used in JSON responses.
 * - Provide base `DomainError` and more specific subclasses for common cases.
 * - Offer a type guard (`isDomainError`) to distinguish domain errors from
 *   unexpected/unhandled errors.
 *
 * Key error codes (not exhaustive):
 * - invalid_user_id: SSN-style userId failed validation.
 * - malformed_state: State value is not a valid US state name/abbreviation.
 * - malformed_zip: ZIP code is not in ##### or #####-#### format.
 * - duplicate_user: SSN or email already exists.
 * - invalid_credentials: Login failed due to wrong email/password.
 * - account_suspended: User account is disabled.
 * - has_active_bookings: User cannot be deleted due to active bookings.
 * - immutable_field: Attempt to change an immutable field such as userId.
 *
 * @notes
 * - The actual HTTP status code is chosen by the error class/constructor, not
 *   by the error code string itself.
 * - New error codes should be added here so they remain discoverable and
 *   consistent across services and controllers.
 */

export const ERROR_CODES = {
  // User-specific validation/domain codes
  INVALID_USER_ID: "invalid_user_id",
  MALFORMED_STATE: "malformed_state",
  MALFORMED_ZIP: "malformed_zip",
  DUPLICATE_USER: "duplicate_user",
  HAS_ACTIVE_BOOKINGS: "has_active_bookings",
  IMMUTABLE_FIELD: "immutable_field",

  // Auth-related codes
  INVALID_CREDENTIALS: "invalid_credentials",
  ACCOUNT_SUSPENDED: "account_suspended",
  TOKEN_MISSING: "token_missing",
  TOKEN_INVALID: "token_invalid",
  TOKEN_EXPIRED: "token_expired",

  // Generic authorization/resource codes
  UNAUTHORIZED: "unauthorized",
  FORBIDDEN: "forbidden",
  NOT_FOUND: "not_found",

  // Validation / conflict
  VALIDATION_ERROR: "validation_error",
  CONFLICT: "conflict",

  // Booking/payment
  NO_INVENTORY: "no_inventory",
  PAYMENT_FAILED: "payment_failed",

  // Catch-all internal error
  INTERNAL_ERROR: "internal_error"
};

/**
 * @class DomainError
 * @extends Error
 * @description
 * Base class for all domain-level errors that should be translated into
 * structured JSON responses by the error middleware.
 *
 * @property {string} code - Application-level error code (see ERROR_CODES).
 * @property {number} statusCode - HTTP status code to use in responses.
 * @property {any} [details] - Optional domain-specific payload for debugging
 *   or client-side context (e.g., which field failed).
 */
export class DomainError extends Error {
  /**
   * @param {string} message - Human-readable error message.
   * @param {Object} [options]
   * @param {string} [options.code] - Error code from ERROR_CODES.
   * @param {number} [options.statusCode=400] - HTTP status code.
   * @param {any} [options.details] - Optional structured details.
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
 * @class ValidationError
 * @extends DomainError
 * @description
 * Convenience subclass for generic validation failures where a more specific
 * error code is not provided.
 */
export class ValidationError extends DomainError {
  /**
   * @param {string} [message]
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
 * @class NotFoundError
 * @extends DomainError
 * @description
 * Standard error for missing resources (404).
 */
export class NotFoundError extends DomainError {
  /**
   * @param {string} [message]
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
 * @class UnauthorizedError
 * @extends DomainError
 * @description
 * Error representing unauthenticated access attempts (401).
 */
export class UnauthorizedError extends DomainError {
  /**
   * @param {string} [message]
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
 * @class ForbiddenError
 * @extends DomainError
 * @description
 * Error representing authenticated users lacking permission for an action (403).
 */
export class ForbiddenError extends DomainError {
  /**
   * @param {string} [message]
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
 * @class ConflictError
 * @extends DomainError
 * @description
 * Error representing conflicts such as duplicate keys or invalid state (409).
 */
export class ConflictError extends DomainError {
  /**
   * @param {string} [message] - Human-readable message.
   * @param {string} [code] - Specific conflict code (defaults to ERROR_CODES.CONFLICT).
   * @param {any} [details] - Optional details payload.
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
 * Type guard to identify domain errors.
 *
 * @param {unknown} err
 * @returns {err is DomainError}
 */
export function isDomainError(err) {
  return err instanceof DomainError;
}
