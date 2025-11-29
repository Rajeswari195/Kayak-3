/**
 * @file user-validators.js
 * @description
 * Validation helpers for user-related payloads in the core-api service.
 *
 * Responsibilities:
 * - Validate SSN-style user IDs.
 * - Validate US state (abbreviation or full name).
 * - Validate ZIP codes.
 * - Validate and sanity-check full user creation payloads.
 *
 * These functions are designed to be used by:
 * - Service layer (e.g., createUserService)
 * - Controllers (for fine-grained error mapping if needed)
 *
 * Design:
 * - Functions return either `null` (no error) or a string error code that
 *   higher layers can map to HTTP status and messages.
 * - Error codes follow the spec:
 *     - "invalid_user_id"
 *     - "malformed_state"
 *     - "malformed_zip"
 *     - "validation_error" (generic)
 */

import {
  SSN_REGEX,
  ZIP_REGEX,
  EMAIL_REGEX,
  PHONE_REGEX
} from "../lib/regex.js";

/**
 * Canonical list of US states + DC.
 *
 * We accept:
 * - Two-letter abbreviations (case-insensitive), e.g., "NY"
 * - Full names (case-insensitive), e.g., "New York"
 */
const US_STATES = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
  { code: "DC", name: "District of Columbia" }
];

const STATE_CODES_SET = new Set(
  US_STATES.map((s) => s.code)
);

const STATE_NAMES_SET = new Set(
  US_STATES.map((s) => s.name.toUpperCase())
);

/**
 * Check if a given value corresponds to a valid US state
 * either by two-letter code or full name (case-insensitive).
 *
 * @param {string} value
 * @returns {boolean}
 */
export function isValidUsState(value) {
  if (typeof value !== "string") return false;

  const trimmed = value.trim();
  if (!trimmed) return false;

  const upper = trimmed.toUpperCase();

  if (STATE_CODES_SET.has(upper)) return true;
  if (STATE_NAMES_SET.has(upper)) return true;

  return false;
}

/**
 * Validate a user ID string (SSN-style).
 *
 * @param {string} userId
 * @returns {string | null} - null if OK, "invalid_user_id" otherwise.
 */
export function validateUserId(userId) {
  if (typeof userId !== "string") {
    return "invalid_user_id";
  }

  const value = userId.trim();

  if (!SSN_REGEX.test(value)) {
    return "invalid_user_id";
  }

  return null;
}

/**
 * Validate a US state value (abbreviation or full name).
 *
 * @param {string} state
 * @returns {string | null} - null if OK, "malformed_state" otherwise.
 */
export function validateState(state) {
  if (!isValidUsState(state)) {
    return "malformed_state";
  }
  return null;
}

/**
 * Validate a US ZIP code.
 *
 * @param {string} zip
 * @returns {string | null} - null if OK, "malformed_zip" otherwise.
 */
export function validateZip(zip) {
  if (typeof zip !== "string") {
    return "malformed_zip";
  }
  const value = zip.trim();

  if (!ZIP_REGEX.test(value)) {
    return "malformed_zip";
  }

  return null;
}

/**
 * Basic validation for email string using EMAIL_REGEX.
 *
 * @param {string} email
 * @returns {boolean}
 */
export function isValidEmail(email) {
  if (typeof email !== "string") return false;
  return EMAIL_REGEX.test(email.trim());
}

/**
 * Basic validation for phone string using PHONE_REGEX.
 *
 * @param {string} phone
 * @returns {boolean}
 */
export function isValidPhone(phone) {
  if (typeof phone !== "string") return false;
  return PHONE_REGEX.test(phone.trim());
}

/**
 * Validate the full user creation payload at a shallow level.
 *
 * This function focuses on:
 * - Required field presence and basic types.
 * - Domain-specific fields: userId, state, zip, email, phone.
 *
 * It returns the first error code encountered, or null when the payload
 * passes all basic checks. More complex business rules (e.g., duplicate
 * users) are handled at the service/repository level.
 *
 * Expected payload shape (minimum):
 * {
 *   userId: string,
 *   firstName: string,
 *   lastName: string,
 *   address: string,
 *   city: string,
 *   state: string,
 *   zip: string,
 *   phone: string,
 *   email: string,
 *   password: string,
 *   profileImageUrl?: string,
 *   paymentMethodToken?: string,
 *   paymentBrand?: string,
 *   paymentLast4?: string
 * }
 *
 * @param {Record<string, any>} payload
 * @returns {string | null} - null if OK, or an error code string.
 */
export function validateUserPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return "validation_error";
  }

  const {
    userId,
    firstName,
    lastName,
    address,
    city,
    state,
    zip,
    phone,
    email,
    password
  } = payload;

  // Required string fields must exist and not be empty after trimming.
  const requiredStrings = [
    "userId",
    "firstName",
    "lastName",
    "address",
    "city",
    "state",
    "zip",
    "phone",
    "email",
    "password"
  ];

  for (const field of requiredStrings) {
    const value = payload[field];
    if (typeof value !== "string" || !value.trim()) {
      // Generic validation error; controller/service can log the field name
      // if more detail is desired.
      return "validation_error";
    }
  }

  // Domain-specific validators (order matters for error precedence)
  const userIdError = validateUserId(userId);
  if (userIdError) return userIdError;

  const stateError = validateState(state);
  if (stateError) return stateError;

  const zipError = validateZip(zip);
  if (zipError) return zipError;

  if (!isValidEmail(email)) {
    return "validation_error";
  }

  if (!isValidPhone(phone)) {
    return "validation_error";
  }

  // Password: basic length check; stronger rules can be added later.
  if (password.trim().length < 8) {
    return "validation_error";
  }

  // Optional: paymentLast4, if provided, must be 4 digits
  if (payload.paymentLast4 != null) {
    const last4 = String(payload.paymentLast4).trim();
    if (!/^\d{4}$/.test(last4)) {
      return "validation_error";
    }
  }

  return null;
}
