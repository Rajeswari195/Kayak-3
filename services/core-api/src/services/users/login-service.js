/**
 * @file login-service.js
 * @description
 * Service-level login logic for email+password authentication.
 *
 * Responsibilities:
 * - Validate the login payload.
 * - Look up the user by email.
 * - Verify password using bcrypt.
 * - Enforce account status (`isActive`).
 * - Issue a JWT access token with the correct `role` claim.
 * - Return a safe, public user representation along with the token.
 */

import { usersRepository } from "../../repositories/mysql/index.js";
import { verifyPassword, signAccessToken } from "../../lib/auth.js";
import { ERROR_CODES, DomainError, ValidationError } from "../../lib/errors.js";
import { toPublicUser } from "./user-view.js";

/**
 * Validate the shape of a login payload.
 *
 * @param {Record<string, any>} payload
 * @throws {ValidationError}
 */
function validateLoginPayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw new ValidationError("Request body must be an object.");
  }

  const { email, password } = payload;

  if (typeof email !== "string" || !email.trim()) {
    throw new ValidationError("Email is required.");
  }

  if (typeof password !== "string" || !password.trim()) {
    throw new ValidationError("Password is required.");
  }
}

/**
 * Perform an email+password login and issue an access token.
 *
 * @param {Record<string, any>} payload - Raw login credentials.
 * @returns {Promise<{ accessToken: string, user: import("./user-view.js").PublicUser }>}
 *
 * @throws {ValidationError} If payload is malformed.
 * @throws {DomainError} With code `invalid_credentials` or `account_suspended`.
 */
export async function loginUserService(payload) {
  validateLoginPayload(payload);

  const email = String(payload.email).trim().toLowerCase();
  const password = String(payload.password);

  const user = await usersRepository.findUserByEmail(email);

  if (!user) {
    // Intentionally vague to avoid leaking which part is wrong.
    throw new DomainError("Invalid credentials.", {
      code: ERROR_CODES.INVALID_CREDENTIALS,
      statusCode: 401
    });
  }

  if (!user.isActive) {
    throw new DomainError("Account is suspended.", {
      code: ERROR_CODES.ACCOUNT_SUSPENDED,
      statusCode: 403
    });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    throw new DomainError("Invalid credentials.", {
      code: ERROR_CODES.INVALID_CREDENTIALS,
      statusCode: 401
    });
  }

  const role = user.isAdmin ? "ADMIN" : "USER";

  const token = signAccessToken({
    id: user.id,
    role,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName
  });

  const publicUser = toPublicUser(user);

  return {
    accessToken: token,
    user: /** @type {import("./user-view.js").PublicUser} */ (publicUser)
  };
}
