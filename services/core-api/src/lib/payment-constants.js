/**
 * @file payment-constants.js
 * @description
 * Shared payment-related status codes and failure reasons for the core API.
 *
 * These constants are used by the payment simulator and can also be reused
 * by billing services, controllers, and UI layers when mapping payment
 * outcomes to user-facing messages.
 */

/**
 * High-level payment / billing statuses.
 *
 * These intentionally mirror the billing transaction statuses used in
 * the database layer so that services can map them directly.
 */
export const PAYMENT_STATUS = {
  PENDING: "PENDING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED"
};

/**
 * Machine-readable failure reason codes for simulated payments.
 *
 * These are suitable for storing in `billing_transactions.error_code`,
 * emitting in logs, and mapping to user-friendly messages at the edge
 * (e.g., frontend or API response formatter).
 */
export const PAYMENT_FAILURE_CODES = {
  INSUFFICIENT_FUNDS: "insufficient_funds",
  CARD_DECLINED: "card_declined",
  EXPIRED_CARD: "expired_card",
  INVALID_CVV: "invalid_cvv",
  INVALID_CARD_NUMBER: "invalid_card_number",
  ACCOUNT_LIMIT_EXCEEDED: "account_limit_exceeded",
  NETWORK_ERROR: "network_error",
  PROVIDER_UNAVAILABLE: "provider_unavailable",
  PAYPAL_ACCOUNT_ISSUE: "paypal_account_issue",
  FRAUD_SUSPECTED: "fraud_suspected",
  INVALID_AMOUNT: "invalid_amount",
  UNKNOWN_ERROR: "unknown_error"
};

/**
 * Optional short, user-facing messages keyed by failure code.
 *
 * These are deliberately generic; controllers or frontends can choose
 * to override or localize them.
 */
export const PAYMENT_FAILURE_MESSAGES = {
  [PAYMENT_FAILURE_CODES.INSUFFICIENT_FUNDS]:
    "Payment declined due to insufficient funds.",
  [PAYMENT_FAILURE_CODES.CARD_DECLINED]:
    "The card was declined by the issuer.",
  [PAYMENT_FAILURE_CODES.EXPIRED_CARD]:
    "The card has expired.",
  [PAYMENT_FAILURE_CODES.INVALID_CVV]:
    "The security code (CVV) is invalid.",
  [PAYMENT_FAILURE_CODES.INVALID_CARD_NUMBER]:
    "The card number appears to be invalid.",
  [PAYMENT_FAILURE_CODES.ACCOUNT_LIMIT_EXCEEDED]:
    "This payment would exceed the account’s limit.",
  [PAYMENT_FAILURE_CODES.NETWORK_ERROR]:
    "A temporary network error occurred while processing the payment.",
  [PAYMENT_FAILURE_CODES.PROVIDER_UNAVAILABLE]:
    "The payment provider is temporarily unavailable.",
  [PAYMENT_FAILURE_CODES.PAYPAL_ACCOUNT_ISSUE]:
    "There is an issue with the PayPal account.",
  [PAYMENT_FAILURE_CODES.FRAUD_SUSPECTED]:
    "The payment was flagged as potential fraud.",
  [PAYMENT_FAILURE_CODES.INVALID_AMOUNT]:
    "The requested amount is invalid.",
  [PAYMENT_FAILURE_CODES.UNKNOWN_ERROR]:
    "An unknown error occurred while processing the payment."
};
