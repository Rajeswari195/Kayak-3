/**
 * @file transaction-helper.js
 * @description
 * Booking-specific transaction helper for MySQL operations.
 *
 * Responsibilities:
 * - Provide a thin, domain-aware wrapper around the lower-level
 *   `withMysqlTransaction` helper defined in `src/db/mysql.js`.
 * - Centralize basic logging and error decoration for booking-related
 *   transactions (booking + billing + inventory changes).
 *
 * Design notes:
 * - This module does **not** know about HTTP or Express; it is purely
 *   concerned with database transactions at the service layer.
 * - Higher-level booking services should use `runInBookingTransaction`
 *   for multi-step flows instead of calling `withMysqlTransaction`
 *   directly. This allows us to evolve booking-specific error handling
 *   without touching every call site.
 */



import { withMysqlTransaction } from "../../db/mysql.js";

/**
 * Error codes for known transactional failures that may occur when running
 * booking flows. These are *internal* codes; the HTTP layer can map them
 * to user-facing error responses as needed.
 *
 * @typedef {("db_transaction_conflict"|"db_transaction_failed")} BookingTransactionErrorCode
 */

/**
 * @typedef {Object} BookingTransactionErrorShape
 * @property {string} name
 * @property {BookingTransactionErrorCode} code
 * @property {string} message
 * @property {Error} [cause]
 */

/**
 * Create a standardized error object for booking transaction failures.
 *
 * @param {BookingTransactionErrorCode} code
 * @param {string} message
 * @param {Error} [cause]
 * @returns {Error & BookingTransactionErrorShape}
 */
function createBookingTransactionError(code, message, cause) {
    const err = new Error(message);
    err.name = "BookingTransactionError";
    // @ts-ignore - augmenting error with custom fields in JS
    err.code = code;
    if (cause) {
        // @ts-ignore
        err.cause = cause;
    }
    return /** @type {Error & BookingTransactionErrorShape} */ (err);
}

/**
 * Determine whether a MySQL error code should be treated as a transient
 * transaction conflict (e.g., deadlock, lock wait timeout).
 *
 * @param {any} error
 * @returns {boolean}
 */
function isTransactionConflictError(error) {
    if (!error || typeof error !== "object") return false;

    // mysql2 uses string `code` identifiers for error types.
    const code = /** @type {any} */ (error).code;
    return code === "ER_LOCK_DEADLOCK" || code === "ER_LOCK_WAIT_TIMEOUT";
}

/**
 * Run a function inside a MySQL transaction in the context of booking flows.
 *
 * Usage pattern:
 *
 * ```js
 * const result = await runInBookingTransaction("createBookingWithPayment", async (conn) => {
 *   const booking = await insertBooking(..., conn);
 *   const items = await Promise.all(payload.items.map(item => insertBookingItem(..., conn)));
 *   const billing = await insertBillingTransaction(..., conn);
 *   return { booking, items, billing };
 * });
 * ```
 *
 * @template T
 * @param {string} operationName
 *   Human-readable name for the operation (used for logging).
 * @param {(conn: import("mysql2/promise").PoolConnection) => Promise<T>} fn
 *   Function that performs the transactional work using the provided connection.
 * @returns {Promise<T>}
 * @throws {Error & BookingTransactionErrorShape}
 *   - code "db_transaction_conflict" for deadlocks/lock timeouts.
 *   - code "db_transaction_failed" for any other error.
 */
export async function runInBookingTransaction(operationName, fn) {
    try {
        // Delegate to the lower-level DB helper; this will begin, commit,
        // and rollback as needed.
        return await withMysqlTransaction(fn);
    } catch (error) {
        // Use a simple console logger for now; a structured logger can be wired in later.
        console.error(
            `[booking-transaction] Error during transactional operation "${operationName}":`,
            error
        );

        if (isTransactionConflictError(error)) {
            throw createBookingTransactionError(
                "db_transaction_conflict",
                `Booking transaction "${operationName}" failed due to a database conflict (deadlock or lock timeout).`,
        /** @type {Error} */(error)
            );
        }

        throw createBookingTransactionError(
            "db_transaction_failed",
            `Booking transaction "${operationName}" failed unexpectedly.`,
      /** @type {Error} */(error)
        );
    }
}
