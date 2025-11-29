/**
 * @file regex.js
 * @description
 * Central place for regular expression constants used across the core-api
 * service (SSN-style user ID, ZIP codes, email, phone, etc.).
 *
 * Keeping these regexes in one module:
 * - Avoids duplication and subtle inconsistencies between services/controllers.
 * - Makes it easy to update validation rules in a single place.
 */

/**
 * SSN-style User ID regex.
 *
 * Required format: 3 digits, hyphen, 2 digits, hyphen, 4 digits.
 * Example valid value: "123-45-6789"
 *
 * NOTE: This is purely a syntactic validator for an SSN-like string.
 *       It does NOT attempt to validate real SSNs and all IDs must be
 *       synthetic for educational use only.
 *
 * @type {RegExp}
 */
export const SSN_REGEX = /^[0-9]{3}-[0-9]{2}-[0-9]{4}$/;

/**
 * US ZIP / ZIP+4 regex.
 *
 * Acceptable formats:
 * - "12345"
 * - "12345-6789"
 *
 * @type {RegExp}
 */
export const ZIP_REGEX = /^(?:\d{5}|\d{5}-\d{4})$/;

/**
 * Basic email address regex for application-level validation.
 *
 * This is intentionally simple and pragmatic: it catches common mistakes
 * (missing "@", missing domain, spaces, etc.) without trying to enforce
 * the full RFC 5322 grammar.
 *
 * @type {RegExp}
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Very loose phone number validator.
 *
 * Accepts:
 * - Digits with optional leading "+".
 * - Common separators: space, dash, dot, parentheses.
 *
 * Examples:
 * - "+1-555-123-4567"
 * - "(555) 123-4567"
 * - "5551234567"
 *
 * @type {RegExp}
 */
export const PHONE_REGEX =
  /^\+?[0-9().\-\s]{7,20}$/;
