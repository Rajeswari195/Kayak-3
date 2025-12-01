/**
 * @file payment-simulator-service.js
 * @description
 * Simulated payments module to "charge" different payment methods.
 *
 * This is intentionally simple and deterministic enough for tests:
 * - By default, it randomly fails some transactions using a configurable
 *   base failure rate.
 * - Callers can optionally override the outcome for deterministic tests.
 *
 * The main exported functions are:
 *   - chargeCard
 *   - chargePaypal
 *
 * Both return a structured result:
 *   {
 *     success: boolean,
 *     failureCode: string | null,
 *     status: PAYMENT_STATUS,
 *     providerReference: string,
 *     rawResponse: object
 *   }
 *
 * Only `success` and `failureCode` are strictly required by the step
 * description; the other fields are provided for convenience and to align
 * with billing transaction fields.
 */



import {
    PAYMENT_STATUS,
    PAYMENT_FAILURE_CODES
} from "../../lib/payment-constants.js";

/**
 * @typedef {import("../../lib/payment-constants.js").PAYMENT_STATUS} PaymentStatusEnum
 */

/**
 * @typedef {Object} PaymentSimulationOverrides
 * @property {"PENDING" | "SUCCESS" | "FAILED" | "REFUNDED" | null} [forceStatus]
 *   Optional forced status for deterministic tests. If provided, the random
 *   simulation is skipped.
 * @property {string | null} [forceFailureCode]
 *   Optional forced failure code when forceStatus === "FAILED".
 */

/**
 * @typedef {Object} PaymentSimulationResult
 * @property {boolean} success
 *   True if the simulated provider accepted the charge.
 * @property {string | null} failureCode
 *   Null on success; otherwise one of PAYMENT_FAILURE_CODES values.
 * @property {"PENDING" | "SUCCESS" | "FAILED" | "REFUNDED"} status
 *   High-level payment status (usually SUCCESS or FAILED here).
 * @property {string} providerReference
 *   Synthetic "provider reference" suitable for storing in billing_transactions.
 * @property {Record<string, any>} rawResponse
 *   Simulated raw provider payload (for debugging / audit purposes).
 */

/**
 * Internal helper: create a fake provider reference string.
 * @param {string} methodSlug
 * @returns {string}
 */
function makeProviderReference(methodSlug) {
    const rand = Math.floor(Math.random() * 1_000_000);
    return `sim-${methodSlug}-${Date.now()}-${rand}`;
}

/**
 * Internal helper: pick a random element from a non-empty array.
 * @template T
 * @param {T[]} arr
 * @returns {T}
 */
function pickRandom(arr) {
    const idx = Math.floor(Math.random() * arr.length);
    return arr[idx];
}

/**
 * Shared core simulation logic for all payment methods.
 *
 * @param {Object} params
 * @param {number} params.amount
 * @param {string} params.currency
 * @param {number} params.baseFailureRate
 *   Probability between 0 and 1 that a charge will fail.
 * @param {string[]} params.allowedFailureCodes
 * @param {PaymentSimulationOverrides} [params.overrides]
 * @param {string} params.method
 * @param {string | null} [params.token]
 * @param {Record<string, any>} [params.extra]
 * @returns {PaymentSimulationResult}
 */
function simulateChargeCore({
    amount,
    currency,
    baseFailureRate,
    allowedFailureCodes,
    overrides,
    method,
    token = null,
    extra = {}
}) {
    let success = true;
    let failureCode = null;

    // Basic sanity check on amount
    if (amount <= 0) {
        success = false;
        failureCode = PAYMENT_FAILURE_CODES.INVALID_AMOUNT;
    }

    // Deterministic override for tests
    if (overrides && overrides.forceStatus) {
        const forced = overrides.forceStatus;

        if (forced === PAYMENT_STATUS.SUCCESS) {
            success = true;
            failureCode = null;
        } else if (forced === PAYMENT_STATUS.FAILED) {
            success = false;
            failureCode =
                overrides.forceFailureCode || pickRandom(allowedFailureCodes);
        } else {
            // PENDING / REFUNDED are not typically produced by the simulator,
            // but we allow them for completeness in tests.
            success = forced === PAYMENT_STATUS.SUCCESS;
            failureCode =
                success ? null : overrides.forceFailureCode || PAYMENT_FAILURE_CODES.UNKNOWN_ERROR;
        }
    } else if (failureCode === null) {
        // Random outcome only if we haven't already failed due to invalid amount
        const shouldFail = Math.random() < baseFailureRate;
        if (shouldFail) {
            success = false;
            failureCode = pickRandom(allowedFailureCodes);
        }
    }

    const status = success ? PAYMENT_STATUS.SUCCESS : PAYMENT_STATUS.FAILED;
    const providerReference = makeProviderReference(method.toLowerCase());

    const rawResponse = {
        provider: "simulated",
        method,
        status,
        success,
        failureCode,
        amount,
        currency,
        tokenPresent: !!token,
        ...extra
    };

    return {
        success,
        failureCode,
        status,
        providerReference,
        rawResponse
    };
}

/**
 * Simulate charging a card.
 *
 * @param {Object} params
 * @param {number} params.amount
 * @param {string} params.currency
 * @param {string} [params.cardToken]
 *   Opaque token representing the stored or transient card reference.
 * @param {PaymentSimulationOverrides} [params.overrides]
 * @returns {Promise<PaymentSimulationResult>}
 */
export async function chargeCard({
    amount,
    currency,
    cardToken,
    overrides
}) {
    const allowedFailureCodes = [
        PAYMENT_FAILURE_CODES.INSUFFICIENT_FUNDS,
        PAYMENT_FAILURE_CODES.CARD_DECLINED,
        PAYMENT_FAILURE_CODES.EXPIRED_CARD,
        PAYMENT_FAILURE_CODES.INVALID_CVV,
        PAYMENT_FAILURE_CODES.INVALID_CARD_NUMBER,
        PAYMENT_FAILURE_CODES.ACCOUNT_LIMIT_EXCEEDED,
        PAYMENT_FAILURE_CODES.FRAUD_SUSPECTED,
        PAYMENT_FAILURE_CODES.NETWORK_ERROR,
        PAYMENT_FAILURE_CODES.PROVIDER_UNAVAILABLE,
        PAYMENT_FAILURE_CODES.UNKNOWN_ERROR
    ];

    // Card charges fail ~15% of the time in the simulator.
    const baseFailureRate = 0.15;

    return simulateChargeCore({
        amount,
        currency,
        baseFailureRate,
        allowedFailureCodes,
        overrides,
        method: "CARD",
        token: cardToken ?? null,
        extra: {
            tokenType: "card",
            // Never include the real token; just note that we had one.
            cardTokenMasked: cardToken ? "***" : null
        }
    });
}

/**
 * Simulate charging a PayPal-like method.
 *
 * @param {Object} params
 * @param {number} params.amount
 * @param {string} params.currency
 * @param {string} [params.paypalToken]
 *   Opaque token representing the PayPal authorization.
 * @param {PaymentSimulationOverrides} [params.overrides]
 * @returns {Promise<PaymentSimulationResult>}
 */
export async function chargePaypal({
    amount,
    currency,
    paypalToken,
    overrides
}) {
    const allowedFailureCodes = [
        PAYMENT_FAILURE_CODES.INSUFFICIENT_FUNDS,
        PAYMENT_FAILURE_CODES.PAYPAL_ACCOUNT_ISSUE,
        PAYMENT_FAILURE_CODES.NETWORK_ERROR,
        PAYMENT_FAILURE_CODES.PROVIDER_UNAVAILABLE,
        PAYMENT_FAILURE_CODES.FRAUD_SUSPECTED,
        PAYMENT_FAILURE_CODES.UNKNOWN_ERROR
    ];

    // Paypal fails a bit less often in this simulator (~10%).
    const baseFailureRate = 0.1;

    return simulateChargeCore({
        amount,
        currency,
        baseFailureRate,
        allowedFailureCodes,
        overrides,
        method: "PAYPAL",
        token: paypalToken ?? null,
        extra: {
            tokenType: "paypal",
            paypalTokenMasked: paypalToken ? "***" : null
        }
    });
}

/**
 * Optionally, you can extend the simulator with other generic methods
 * (e.g., "OTHER") by reusing simulateChargeCore. For now, only card and
 * PayPal are needed by the plan.
 */
