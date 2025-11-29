/**
 * @file update-user-service.js
 * @description
 * Service-level logic for updating a user's own profile.
 *
 * Responsibilities:
 * - Fetch the existing user record.
 * - Enforce that SSN-style `userId` is immutable.
 * - Validate optional fields (state, ZIP, email, phone, password).
 * - Ensure email uniqueness across users when changed.
 * - Hash new password if provided.
 * - Persist changes via the MySQL repository and return a safe public view.
 *
 * @notes
 * - This module is intended for "self-service" profile updates (e.g., the
 *   `/users/me` endpoint). Admin-oriented updates should use the separate
 *   admin user management service which has additional capabilities
 *   (isAdmin toggling, suspension, etc.).
 */

import { usersRepository } from "../../repositories/mysql/index.js";
import {
  ERROR_CODES,
  ConflictError,
  DomainError,
  NotFoundError,
  ValidationError
} from "../../lib/errors.js";
import {
  validateState,
  validateZip,
  isValidEmail,
  isValidPhone
} from "../../validators/user-validators.js";
import { hashPassword } from "../../lib/auth.js";
import { toPublicUser } from "./user-view.js";

/**
 * Build a partial update object suitable for the users repository based on
 * the provided payload. This function assumes that basic type checks have
 * been performed at the controller level.
 *
 * @param {Record<string, any>} payload
 * @param {import("./user-view.js").PublicUser} existingUserPublic
 * @returns {Promise<Record<string, any>>}
 */
async function buildUserUpdates(payload, existingUserPublic) {
  const updates = {};

  // Disallow changes to SSN-style userId (immutable).
  if (Object.prototype.hasOwnProperty.call(payload, "userId")) {
    const newUserId =
      payload.userId != null ? String(payload.userId).trim() : existingUserPublic.userId;
    if (newUserId !== existingUserPublic.userId) {
      throw new DomainError("userId is immutable once created.", {
        code: ERROR_CODES.IMMUTABLE_FIELD,
        statusCode: 400,
        details: { field: "userId" }
      });
    }
  }

  // Name fields
  if (Object.prototype.hasOwnProperty.call(payload, "firstName")) {
    const firstName = String(payload.firstName || "").trim();
    if (!firstName) {
      throw new ValidationError("firstName cannot be empty.");
    }
    updates.firstName = firstName;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "lastName")) {
    const lastName = String(payload.lastName || "").trim();
    if (!lastName) {
      throw new ValidationError("lastName cannot be empty.");
    }
    updates.lastName = lastName;
  }

  // Address fields
  if (Object.prototype.hasOwnProperty.call(payload, "address")) {
    const addressLine1 = String(payload.address || "").trim();
    if (!addressLine1) {
      throw new ValidationError("address cannot be empty.");
    }
    updates.addressLine1 = addressLine1;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "addressLine1")) {
    const addressLine1 = String(payload.addressLine1 || "").trim();
    if (!addressLine1) {
      throw new ValidationError("addressLine1 cannot be empty.");
    }
    updates.addressLine1 = addressLine1;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "addressLine2")) {
    updates.addressLine2 =
      payload.addressLine2 != null && String(payload.addressLine2).trim().length
        ? String(payload.addressLine2).trim()
        : null;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "city")) {
    const city = String(payload.city || "").trim();
    if (!city) {
      throw new ValidationError("city cannot be empty.");
    }
    updates.city = city;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "state")) {
    const state = String(payload.state || "").trim();
    const stateError = validateState(state);
    if (stateError) {
      throw new DomainError("Invalid US state.", {
        code: ERROR_CODES.MALFORMED_STATE,
        statusCode: 400
      });
    }
    updates.state = state;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "zip")) {
    const zip = String(payload.zip || "").trim();
    const zipError = validateZip(zip);
    if (zipError) {
      throw new DomainError("Invalid ZIP code.", {
        code: ERROR_CODES.MALFORMED_ZIP,
        statusCode: 400
      });
    }
    updates.zip = zip;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "country")) {
    const country = String(payload.country || "").trim();
    if (!country) {
      throw new ValidationError("country cannot be empty.");
    }
    updates.country = country;
  }

  // Contact info
  if (Object.prototype.hasOwnProperty.call(payload, "phone")) {
    const phone = String(payload.phone || "").trim();
    if (!isValidPhone(phone)) {
      throw new ValidationError("Invalid phone number.");
    }
    updates.phone = phone;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "email")) {
    const email = String(payload.email || "").trim().toLowerCase();
    if (!isValidEmail(email)) {
      throw new ValidationError("Invalid email address.");
    }
    updates.email = email;
  }

  // Profile image
  if (Object.prototype.hasOwnProperty.call(payload, "profileImageUrl")) {
    updates.profileImageUrl =
      payload.profileImageUrl != null &&
      String(payload.profileImageUrl).trim().length > 0
        ? String(payload.profileImageUrl).trim()
        : null;
  }

  // Payment metadata (non-sensitive)
  if (Object.prototype.hasOwnProperty.call(payload, "paymentBrand")) {
    updates.paymentBrand =
      payload.paymentBrand != null && String(payload.paymentBrand).trim().length > 0
        ? String(payload.paymentBrand).trim()
        : null;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "paymentLast4")) {
    const last4 = payload.paymentLast4 != null ? String(payload.paymentLast4).trim() : null;
    if (last4 && !/^\d{4}$/.test(last4)) {
      throw new ValidationError("paymentLast4 must be exactly 4 digits if provided.");
    }
    updates.paymentLast4 = last4;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "paymentMethodToken")) {
    updates.paymentMethodToken =
      payload.paymentMethodToken != null &&
      String(payload.paymentMethodToken).trim().length > 0
        ? String(payload.paymentMethodToken).trim()
        : null;
  }

  // Password change (optional)
  if (Object.prototype.hasOwnProperty.call(payload, "password")) {
    const newPassword = String(payload.password || "");
    if (newPassword.trim().length < 8) {
      throw new ValidationError("Password must be at least 8 characters long.");
    }
    updates.passwordHash = await hashPassword(newPassword);
  }

  return updates;
}

/**
 * Update a user's profile (self-service).
 *
 * @param {string} userId - Internal user ID (UUID, not SSN userId).
 * @param {Record<string, any>} payload - Partial update payload.
 * @returns {Promise<import("./user-view.js").PublicUser>}
 *
 * @throws {NotFoundError} If user does not exist.
 * @throws {DomainError|ValidationError|ConflictError} For domain violations.
 */
export async function updateUserProfileService(userId, payload) {
  if (!userId || typeof userId !== "string") {
    throw new ValidationError("userId (path parameter) must be a non-empty string.");
  }

  if (!payload || typeof payload !== "object") {
    throw new ValidationError("Request body must be an object.");
  }

  const existingUser = await usersRepository.findUserById(userId);

  if (!existingUser) {
    throw new NotFoundError("User not found.", { userId });
  }

  const existingPublic = toPublicUser(existingUser);
  const updates = await buildUserUpdates(payload, existingPublic);

  // If no fields changed, simply return the current public representation.
  if (!Object.keys(updates).length) {
    return existingPublic;
  }

  // If the email is changing, enforce uniqueness vs other users.
  if (Object.prototype.hasOwnProperty.call(updates, "email")) {
    const candidate = await usersRepository.findUserByUserIdOrEmail(
      existingUser.userId,
      updates.email
    );

    if (candidate && candidate.id !== existingUser.id) {
      throw new ConflictError("Another user already uses this email.", ERROR_CODES.DUPLICATE_USER, {
        existingUserId: candidate.id,
        existingEmail: candidate.email
      });
    }
  }

  let updatedUser;
  try {
    updatedUser = await usersRepository.updateUser(existingUser.id, updates);
  } catch (err) {
    // Catch low-level duplicate key issues as a safety net.
    if (err && typeof err === "object" && err.code === "ER_DUP_ENTRY") {
      throw new ConflictError("Another user already uses this email or userId.", {
        code: ERROR_CODES.DUPLICATE_USER
      });
    }
    throw err;
  }

  return /** @type {import("./user-view.js").PublicUser} */ (toPublicUser(updatedUser));
}
