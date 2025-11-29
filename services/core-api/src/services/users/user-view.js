/**
 * @file user-view.js
 * @description
 * Helpers for converting internal user records (as returned by the MySQL
 * repositories) into safe, public-facing JSON objects suitable for API
 * responses.
 *
 * Responsibilities:
 * - Strip sensitive fields such as password hashes and raw payment tokens.
 * - Normalize field names used by the frontend (e.g., `address` instead of
 *   `addressLine1`).
 * - Attach a derived `role` property ("USER" or "ADMIN") based on `isAdmin`.
 *
 * @notes
 * - This module does not perform any persistence or business logic. It is
 *   deliberately "dumb" and purely focused on shaping data.
 * - Internal `user` objects are expected to match the shape produced by
 *   `users-repository.mapUserRow`.
 */

/**
 * @typedef {Object} InternalUser
 * @property {string} id
 * @property {string} userId
 * @property {string} firstName
 * @property {string} lastName
 * @property {string} addressLine1
 * @property {string|null} [addressLine2]
 * @property {string} city
 * @property {string} state
 * @property {string} zip
 * @property {string} country
 * @property {string} phone
 * @property {string} email
 * @property {string|null} [profileImageUrl]
 * @property {string} passwordHash
 * @property {string|null} [paymentMethodToken]
 * @property {string|null} [paymentBrand]
 * @property {string|null} [paymentLast4]
 * @property {boolean} isAdmin
 * @property {boolean} isActive
 * @property {Date|string} createdAt
 * @property {Date|string} updatedAt
 */

/**
 * @typedef {Object} PublicUser
 * @property {string} id - Internal UUID primary key.
 * @property {string} userId - SSN-style external user identifier.
 * @property {string} role - "USER" or "ADMIN" derived from isAdmin.
 * @property {string} firstName
 * @property {string} lastName
 * @property {string} address
 * @property {string|null} addressLine2
 * @property {string} city
 * @property {string} state
 * @property {string} zip
 * @property {string} country
 * @property {string} phone
 * @property {string} email
 * @property {string|null} profileImageUrl
 * @property {string|null} paymentBrand
 * @property {string|null} paymentLast4
 * @property {boolean} isAdmin
 * @property {boolean} isActive
 * @property {Date|string} createdAt
 * @property {Date|string} updatedAt
 */

/**
 * Convert an internal user record into a safe public representation.
 *
 * @param {InternalUser | null | undefined} user
 * @returns {PublicUser | null}
 */
export function toPublicUser(user) {
  if (!user) return null;

  const role = user.isAdmin ? "ADMIN" : "USER";

  return {
    id: user.id,
    userId: user.userId,
    role,
    firstName: user.firstName,
    lastName: user.lastName,
    address: user.addressLine1,
    addressLine2: user.addressLine2 ?? null,
    city: user.city,
    state: user.state,
    zip: user.zip,
    country: user.country,
    phone: user.phone,
    email: user.email,
    profileImageUrl: user.profileImageUrl ?? null,
    paymentBrand: user.paymentBrand ?? null,
    paymentLast4: user.paymentLast4 ?? null,
    isAdmin: !!user.isAdmin,
    isActive: !!user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

/**
 * Map an array of internal user records into public user representations.
 *
 * @param {InternalUser[]} users
 * @returns {PublicUser[]}
 */
export function toPublicUserList(users) {
  if (!Array.isArray(users) || users.length === 0) {
    return [];
  }
  return users.map((u) => toPublicUser(u)).filter(Boolean);
}
