/**
 * @file billing-repository.js
 * @description
 * Repository functions for interacting with the `billing_transactions` table
 * in MySQL for the Kayak-like travel platform.
 *
 * Responsibilities:
 * - Provide low-level helpers to insert and update billing transaction rows.
 * - Support common query patterns needed for admin billing screens:
 *   - Lookup by booking
 *   - Date-range and month-based searches
 * - Map raw MySQL rows into normalized domain objects.
 *
 * Design notes:
 * - All functions accept an optional transactional connection for use inside
 *   `withMysqlTransaction`.
 * - Sensitive card data is never stored here (only tokens/last4). That policy
 *   is enforced at higher layers and by schema design.
 */



import { mysqlQuery } from "../../db/mysql.js";

/**
 * @typedef {("PENDING"|"SUCCESS"|"FAILED"|"REFUNDED")} BillingStatus
 */

/**
 * @typedef {("CARD"|"PAYPAL"|"OTHER")} BillingPaymentMethod
 */

/**
 * @typedef {Object} BillingInsertParams
 * @property {string} id
 * @property {string} bookingId
 * @property {string} userId
 * @property {string | null} [paymentMethodId]
 * @property {number} amount
 * @property {string} currency
 * @property {BillingPaymentMethod} paymentMethod
 * @property {string | null} [paymentToken]
 * @property {string | null} [providerReference]
 * @property {BillingStatus} status
 * @property {string | null} [errorCode]
 * @property {string | null | Record<string, any>} [rawResponse]
 */

/**
 * @typedef {Object} BillingTransactionRecord
 * @property {string} id
 * @property {string} bookingId
 * @property {string} userId
 * @property {string | null} paymentMethodId
 * @property {number} amount
 * @property {string} currency
 * @property {BillingPaymentMethod} paymentMethod
 * @property {string | null} paymentToken
 * @property {string | null} providerReference
 * @property {BillingStatus} status
 * @property {string | null} errorCode
 * @property {string | null} rawResponse
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * Normalize a DATETIME value to ISO 8601.
 *
 * @param {Date | string | null | undefined} value
 * @returns {string}
 */
function normalizeDateTime(value) {
    if (!value) return new Date(0).toISOString();

    if (value instanceof Date) {
        return value.toISOString();
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return new Date().toISOString();
    }
    return parsed.toISOString();
}

/**
 * Map a raw MySQL row from `billing_transactions` into a BillingTransactionRecord.
 *
 * @param {any} row
 * @returns {BillingTransactionRecord}
 */
function mapBillingRow(row) {
    return {
        id: row.id,
        bookingId: row.booking_id,
        userId: row.user_id,
        paymentMethodId: row.payment_method_id ?? null,
        amount: Number(row.amount),
        currency: row.currency,
        paymentMethod: row.payment_method,
        paymentToken: row.payment_token ?? null,
        providerReference: row.provider_reference ?? null,
        status: row.status,
        errorCode: row.error_code ?? null,
        rawResponse: row.raw_response ?? null,
        createdAt: normalizeDateTime(row.created_at),
        updatedAt: normalizeDateTime(row.updated_at)
    };
}

/**
 * Insert a new billing transaction row.
 *
 * @param {BillingInsertParams} tx
 * @param {import("mysql2/promise").PoolConnection | null} [connection]
 * @returns {Promise<BillingTransactionRecord>}
 */
export async function insertBillingTransaction(tx, connection = null) {
    const sql = `
    INSERT INTO billing_transactions (
      id,
      booking_id,
      user_id,
      payment_method_id,
      amount,
      currency,
      payment_method,
      payment_token,
      provider_reference,
      status,
      error_code,
      raw_response
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

    let rawResponseSerialized = null;
    if (tx.rawResponse != null) {
        if (typeof tx.rawResponse === "string") {
            rawResponseSerialized = tx.rawResponse;
        } else {
            rawResponseSerialized = JSON.stringify(tx.rawResponse);
        }
    }

    const params = [
        tx.id,
        tx.bookingId,
        tx.userId,
        tx.paymentMethodId ?? null,
        tx.amount,
        tx.currency,
        tx.paymentMethod,
        tx.paymentToken ?? null,
        tx.providerReference ?? null,
        tx.status,
        tx.errorCode ?? null,
        rawResponseSerialized
    ];

    await mysqlQuery(sql, params, connection);
    const found = await findBillingTransactionById(tx.id, connection);

    if (!found) {
        throw new Error(
            `[billing-repository] Failed to re-fetch billing transaction after insert (id=${tx.id}).`
        );
    }

    return found;
}

/**
 * Update the status of a billing transaction and optionally attach error/provider
 * information (e.g., when marking as FAILED or SUCCESS).
 *
 * @param {string} id
 * @param {BillingStatus} status
 * @param {{
 *   errorCode?: string | null,
 *   providerReference?: string | null,
 *   rawResponse?: string | Record<string, any> | null
 * }} [patch]
 * @param {import("mysql2/promise").PoolConnection | null} [connection]
 * @returns {Promise<BillingTransactionRecord | null>}
 */
export async function updateBillingTransactionStatus(
    id,
    status,
    patch = {},
    connection = null
) {
    const fields = ["status = ?"];
    /** @type {any[]} */
    const params = [status];

    if ("errorCode" in patch) {
        fields.push("error_code = ?");
        params.push(patch.errorCode ?? null);
    }

    if ("providerReference" in patch) {
        fields.push("provider_reference = ?");
        params.push(patch.providerReference ?? null);
    }

    if ("rawResponse" in patch) {
        let serialized = null;
        if (patch.rawResponse != null) {
            if (typeof patch.rawResponse === "string") {
                serialized = patch.rawResponse;
            } else {
                serialized = JSON.stringify(patch.rawResponse);
            }
        }
        fields.push("raw_response = ?");
        params.push(serialized);
    }

    params.push(id);

    const sql = `
    UPDATE billing_transactions
    SET ${fields.join(", ")}
    WHERE id = ?
  `;

    await mysqlQuery(sql, params, connection);
    return findBillingTransactionById(id, connection);
}

/**
 * Find a billing transaction by primary key.
 *
 * @param {string} id
 * @param {import("mysql2/promise").PoolConnection | null} [connection]
 * @returns {Promise<BillingTransactionRecord | null>}
 */
export async function findBillingTransactionById(id, connection = null) {
    const sql = `
    SELECT *
    FROM billing_transactions
    WHERE id = ?
    LIMIT 1
  `;

    const rows = await mysqlQuery(sql, [id], connection);
    if (!rows || rows.length === 0) {
        return null;
    }

    return mapBillingRow(rows[0]);
}

/**
 * List all billing transactions associated with a given booking.
 *
 * @param {string} bookingId
 * @param {import("mysql2/promise").PoolConnection | null} [connection]
 * @returns {Promise<BillingTransactionRecord[]>}
 */
export async function listBillingTransactionsForBooking(
    bookingId,
    connection = null
) {
    const sql = `
    SELECT *
    FROM billing_transactions
    WHERE booking_id = ?
    ORDER BY created_at ASC
  `;

    const rows = await mysqlQuery(sql, [bookingId], connection);
    return (rows || []).map(mapBillingRow);
}

/**
 * List billing transactions whose `created_at` DATE falls within a closed
 * interval `[fromDate, toDate]` (inclusive).
 *
 * Both dates should be in `YYYY-MM-DD` format.
 *
 * @param {string} fromDate
 * @param {string} toDate
 * @param {import("mysql2/promise").PoolConnection | null} [connection]
 * @returns {Promise<BillingTransactionRecord[]>}
 */
export async function listBillingTransactionsByDateRange(
    fromDate,
    toDate,
    connection = null
) {
    const sql = `
    SELECT *
    FROM billing_transactions
    WHERE DATE(created_at) >= ?
      AND DATE(created_at) <= ?
    ORDER BY created_at DESC
  `;

    const rows = await mysqlQuery(sql, [fromDate, toDate], connection);
    return (rows || []).map(mapBillingRow);
}

/**
 * List billing transactions for a given calendar month.
 *
 * @param {number} year  Four-digit year (e.g., 2025)
 * @param {number} month Month number (1-12)
 * @param {import("mysql2/promise").PoolConnection | null} [connection]
 * @returns {Promise<BillingTransactionRecord[]>}
 */
export async function listBillingTransactionsForMonth(
    year,
    month,
    connection = null
) {
    const sql = `
    SELECT *
    FROM billing_transactions
    WHERE YEAR(created_at) = ?
      AND MONTH(created_at) = ?
    ORDER BY created_at DESC
  `;

    const rows = await mysqlQuery(sql, [year, month], connection);
    return (rows || []).map(mapBillingRow);
}
