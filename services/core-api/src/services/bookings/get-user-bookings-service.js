/**
 * @file get-user-bookings-service.js
 * @description
 * Service function for retrieving bookings for a given user, scoped by
 * time window (past, current, future, or all).
 *
 * Responsibilities:
 * - Validate userId and scope inputs.
 * - Determine the "now" reference time (UTC) for scope calculations.
 * - Delegate data retrieval to the bookings repository.
 * - Wrap results into an ActionState-style object for controllers.
 *
 * Design notes:
 * - This service does not know about HTTP or Express; it is pure domain logic.
 * - Time-window semantics are implemented by the repository using the
 *   provided `scope` and `now` arguments.
 */



import {
    getUserBookingsByScope
} from "../../repositories/mysql/bookings-repository.js";

/**
 * @typedef {Object} BookingRecord
 * @property {string} id
 * @property {string} userId
 * @property {string} status
 * @property {string} [bookingType]
 * @property {string} [startDate]  - ISO 8601 date/time string in UTC
 * @property {string} [endDate]    - ISO 8601 date/time string in UTC
 * @property {number} [totalAmount]
 * @property {string} [currency]
 * @property {string} [createdAt]
 * @property {string} [updatedAt]
 * @property {any} [items]         - Optional nested booking items
 */

/**
 * ActionState success shape.
 *
 * @typedef {Object} ActionStateSuccess
 * @property {true} isSuccess
 * @property {string} message
 * @property {{ bookings: BookingRecord[], scope: "past"|"current"|"future"|"all" }} data
 */

/**
 * ActionState error shape.
 *
 * @typedef {Object} ActionStateError
 * @property {false} isSuccess
 * @property {string} message
 * @property {any} [data]
 */

/**
 * @typedef {ActionStateSuccess | ActionStateError} ActionState
 */

/**
 * Valid scopes for bookings.
 *
 * @type {Array<"past"|"current"|"future"|"all">}
 */
const ALLOWED_SCOPES = ["past", "current", "future", "all"];

/**
 * Normalize a raw scope string into one of the allowed scope values.
 *
 * @param {string | undefined | null} raw
 * @returns {"past"|"current"|"future"|"all" | null}
 */
function normalizeScope(raw) {
    if (!raw || typeof raw !== "string") {
        return "all";
    }
    const lower = raw.toLowerCase();
    if (ALLOWED_SCOPES.includes(/** @type {any} */(lower))) {
        return /** @type {"past"|"current"|"future"|"all"} */ (lower);
    }
    return null;
}

/**
 * Retrieve bookings for a user, optionally filtered by time scope.
 *
 * Scope semantics (to be implemented by the repository using `now`):
 * - "past":   booking end date < now
 * - "current": booking start date <= now <= end date
 * - "future": booking start date > now
 * - "all":   no time filtering, return all bookings for the user
 *
 * Error codes:
 * - "validation_error" for invalid input (e.g., missing userId, bad scope).
 * - "internal_error" for unexpected repository/DB errors without a code.
 * - Any `error.code` string thrown by the repository will be passed through.
 *
 * @param {string} userId - The internal user ID (MySQL users.id).
 * @param {"past"|"current"|"future"|"all"} scope - Requested scope.
 * @returns {Promise<ActionState>}
 */
export async function getUserBookingsService(userId, scope) {
    if (typeof userId !== "string" || userId.trim().length === 0) {
        return {
            isSuccess: false,
            message: "validation_error",
            data: {
                reason: "Missing or empty userId."
            }
        };
    }

    const normalizedScope = normalizeScope(scope);

    if (!normalizedScope) {
        return {
            isSuccess: false,
            message: "validation_error",
            data: {
                reason: `Scope must be one of ${ALLOWED_SCOPES.join(", ")}.`
            }
        };
    }

    // Use current UTC time as the reference point for "past/current/future".
    const now = new Date();

    try {
        /**
         * NOTE: This assumes the following repository contract:
         *
         *   getUserBookingsByScope(userId: string, options: { scope: "past"|"current"|"future"|"all", now: Date }): Promise<BookingRecord[]>
         *
         * The repository is responsible for translating the scope and `now` into
         * appropriate SQL WHERE clauses (e.g., using start_date/end_date columns).
         */
        const bookings = await getUserBookingsByScope(userId, {
            scope: normalizedScope,
            now
        });

        return {
            isSuccess: true,
            message: "ok",
            data: {
                scope: normalizedScope,
                bookings: Array.isArray(bookings) ? bookings : []
            }
        };
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error(
            "[getUserBookingsService] Error while fetching user bookings:",
            error
        );

        // If the repository throws a domain-style error with a code property,
        // surface that code directly so controllers can map it.
        if (error && typeof error === "object" && "code" in error) {
            const codeValue = /** @type {{ code?: unknown }} */ (error).code;
            if (typeof codeValue === "string" && codeValue.trim().length > 0) {
                return {
                    isSuccess: false,
                    message: codeValue
                };
            }
        }

        return {
            isSuccess: false,
            message: "internal_error"
        };
    }
}
