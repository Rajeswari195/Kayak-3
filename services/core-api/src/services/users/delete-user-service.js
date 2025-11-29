import { usersRepository } from "../../repositories/mysql/index.js";
import {
  ERROR_CODES,
  ConflictError,
  DomainError,
  NotFoundError
} from "../../lib/errors.js";
import { mysqlQuery, withMysqlTransaction } from "../../db/mysql.js";
import { toPublicUser } from "./user-view.js";

/**
 * Check if the user has any active bookings (PENDING or CONFIRMED).
 *
 * @param {string} userId - users.id
 * @param {import("mysql2/promise").PoolConnection | null} connection
 * @returns {Promise<string | null>} bookingId or null
 */
async function findActiveBookingIdForUser(userId, connection = null) {
  const rows = await mysqlQuery(
    `
    SELECT id
    FROM bookings
    WHERE user_id = ?
      AND status IN ('PENDING', 'CONFIRMED')
    LIMIT 1
    `,
    [userId],
    connection
  );

  if (!rows || rows.length === 0) return null;
  return rows[0].id;
}

/**
 * Delete or deactivate a user.
 *
 * Default behaviour:
 * - Soft-delete via is_active = 0 (user cannot log in, but data & bookings remain).
 * - Reject if user has active bookings (PENDING/CONFIRMED).
 *
 * Options:
 * - allowDeleteWithActiveBookings: if true, we skip the active-bookings check
 *   (useful for admin-driven account closure where bookings remain valid).
 * - hardDelete: if true, we attempt a full hard-delete including associated
 *   bookings and billing records inside a transaction. This is primarily for
 *   test reset / data seeding scenarios.
 */
export async function deleteUserService(userId, options = {}) {
  const {
    allowDeleteWithActiveBookings = false,
    hardDelete = false
  } = options;

  if (!userId || typeof userId !== "string") {
    throw new DomainError("userId (path parameter) must be a non-empty string.", {
      code: ERROR_CODES.VALIDATION_ERROR,
      statusCode: 400
    });
  }

  const user = await usersRepository.findUserById(userId);

  if (!user) {
    throw new NotFoundError("User not found.", { userId });
  }

  // Safety check: block deletes when there are active bookings unless explicitly allowed.
  if (!allowDeleteWithActiveBookings) {
    const activeBookingId = await findActiveBookingIdForUser(user.id);
    if (activeBookingId) {
      throw new ConflictError(
        "User has active bookings and cannot be deleted.",
        ERROR_CODES.HAS_ACTIVE_BOOKINGS,
        {
          userId: user.id,
          activeBookingId
        }
      );
    }
  }

  // Hard delete (dangerous; mostly for tests or reset scripts).
  if (hardDelete) {
    await withMysqlTransaction(async (connection) => {
      // Delete billing transactions for this user
      await mysqlQuery(
        "DELETE FROM billing_transactions WHERE user_id = ?",
        [user.id],
        connection
      );

      // Delete bookings for this user (FK to users.id is RESTRICT, so we must remove bookings first).
      await mysqlQuery(
        "DELETE FROM bookings WHERE user_id = ?",
        [user.id],
        connection
      );

      // Finally delete the user row
      await mysqlQuery(
        "DELETE FROM users WHERE id = ?",
        [user.id],
        connection
      );
    });

    // After hard-delete, return a minimal tombstone response.
    return {
      id: user.id,
      deleted: true
    };
  }

  // Soft delete: mark is_active = 0, keep all historical data.
  const deactivated = await usersRepository.deactivateUser(user.id);
  return toPublicUser(deactivated);
}
