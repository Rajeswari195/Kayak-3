/**
 * @file create-user-service.js
 * @description
 * Service-level logic for creating users (travelers/admins) in the system.
 *
 * Responsibilities:
 * - Validate user registration payloads using domain validators.
 * - Enforce SSN-style userId format, state and ZIP rules, and basic email/phone
 *   constraints.
 * - Check for duplicates based on userId and/or email.
 * - Hash the user's password and persist a new row to the `users` table.
 * - Return a safe, public-facing user representation without sensitive fields.
 *
 * @notes
 * - This module does not know anything about HTTP or Express. Controllers
 *   should call `createUserService` and handle the returned value / thrown
 *   errors.
 * - Sensitive fields such as `passwordHash` and `paymentMethodToken` are
 *   never returned.
 */

import { usersRepository } from "../../repositories/mysql/index.js";
import { hashPassword } from "../../lib/auth.js";
import {
  ERROR_CODES,
  ConflictError,
  DomainError,
  ValidationError
} from "../../lib/errors.js";
import { validateUserPayload } from "../../validators/user-validators.js";
import { toPublicUser } from "./user-view.js";

/**
 * Map a validation error code from the user validators into a concrete error.
 *
 * @param {string|null} validationCode
 * @throws {DomainError|ValidationError}
 */
function throwForValidationCode(validationCode) {
  if (!validationCode) return;

  switch (validationCode) {
    case ERROR_CODES.INVALID_USER_ID:
    case "invalid_user_id":
      throw new DomainError("User ID must match SSN pattern XXX-XX-XXXX.", {
        code: ERROR_CODES.INVALID_USER_ID,
        statusCode: 400
      });

    case ERROR_CODES.MALFORMED_STATE:
    case "malformed_state":
      throw new DomainError("State must be a valid US state name or abbreviation.", {
        code: ERROR_CODES.MALFORMED_STATE,
        statusCode: 400
      });

    case ERROR_CODES.MALFORMED_ZIP:
    case "malformed_zip":
      throw new DomainError("ZIP must be in ##### or #####-#### format.", {
        code: ERROR_CODES.MALFORMED_ZIP,
        statusCode: 400
      });

    case ERROR_CODES.VALIDATION_ERROR:
    case "validation_error":
    default:
      // Generic validation failure (e.g., missing required fields, weak password)
      throw new ValidationError("Invalid user registration payload.", {
        validationCode
      });
  }
}

/**
 * Normalize the raw payload from the caller into the shape expected by
 * the MySQL repository.
 *
 * @param {Record<string, any>} payload
 * @returns {Record<string, any>}
 */
function buildInsertPayload(payload) {
  const addressLine1 =
    typeof payload.address === "string" && payload.address.trim().length > 0
      ? payload.address.trim()
      : typeof payload.addressLine1 === "string"
        ? payload.addressLine1.trim()
        : "";

  return {
    userId: String(payload.userId).trim(),
    firstName: String(payload.firstName).trim(),
    lastName: String(payload.lastName).trim(),
    addressLine1,
    addressLine2:
      typeof payload.addressLine2 === "string" && payload.addressLine2.trim().length > 0
        ? payload.addressLine2.trim()
        : null,
    city: String(payload.city).trim(),
    state: String(payload.state).trim(),
    zip: String(payload.zip).trim(),
    country:
      typeof payload.country === "string" && payload.country.trim().length > 0
        ? payload.country.trim()
        : "United States",
    phone: String(payload.phone).trim(),
    email: String(payload.email).trim().toLowerCase(),
    profileImageUrl:
      typeof payload.profileImageUrl === "string" && payload.profileImageUrl.trim().length
        ? payload.profileImageUrl.trim()
        : null,
    paymentMethodToken:
      typeof payload.paymentMethodToken === "string" &&
      payload.paymentMethodToken.trim().length
        ? payload.paymentMethodToken.trim()
        : null,
    paymentBrand:
      typeof payload.paymentBrand === "string" && payload.paymentBrand.trim().length
        ? payload.paymentBrand.trim()
        : null,
    paymentLast4:
      payload.paymentLast4 != null && String(payload.paymentLast4).trim().length
        ? String(payload.paymentLast4).trim()
        : null
  };
}

/**
 * Create a new user record.
 *
 * @param {Record<string, any>} payload - Raw registration data from controller.
 * @returns {Promise<import("./user-view.js").PublicUser>}
 *
 * @throws {ValidationError} For malformed payloads.
 * @throws {DomainError} For domain-specific validation (SSN/state/ZIP).
 * @throws {ConflictError} If a user with the same userId/email already exists.
 */
export async function createUserService(payload) {
  if (!payload || typeof payload !== "object") {
    throw new ValidationError("Request body must be an object.");
  }

  // First, run high-level validation (presence of key fields, format checks).
  const validationCode = validateUserPayload(payload);
  throwForValidationCode(validationCode);

  const normalized = buildInsertPayload(payload);

  // Check for duplicates based on userId OR email.
  const existing = await usersRepository.findUserByUserIdOrEmail(
    normalized.userId,
    normalized.email
  );

  if (existing) {
    throw new ConflictError("User already exists (duplicate userId or email).", {
      code: ERROR_CODES.DUPLICATE_USER,
      existingUserId: existing.id,
      existingUserIdValue: existing.userId,
      existingEmail: existing.email
    });
  }

  // Hash password securely before persisting.
  const passwordHash = await hashPassword(String(payload.password));

  // Compose final insert payload for the repository.
  const insertPayload = {
    ...normalized,
    passwordHash
  };

  // Insert user, mapping any low-level duplicate-key errors to a domain error.
  let createdUser;
  try {
    createdUser = await usersRepository.insertUser(insertPayload);
  } catch (err) {
    // Guard against race-conditions where two requests slip between duplicate checks.
    if (err && typeof err === "object" && err.code === "ER_DUP_ENTRY") {
      throw new ConflictError("User already exists (duplicate userId or email).", {
        code: ERROR_CODES.DUPLICATE_USER
      });
    }
    throw err;
  }

  const publicUser = toPublicUser(createdUser);
  // At this point, publicUser is guaranteed non-null.
  return /** @type {import("./user-view.js").PublicUser} */ (publicUser);
}
