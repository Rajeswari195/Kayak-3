/**
 * @file common-validators.js
 * @description
 * Reusable validation and normalization helpers for query params and
 * generic payloads (pagination, dates, numeric ranges, etc.).
 *
 * These helpers are intentionally framework-agnostic and can be used in:
 * - Express controllers (for parsing req.query / req.body)
 * - Service layer entrypoints (for validating filters/options)
 *
 * They do not throw; instead they return normalized values plus optional
 * error codes which higher layers can map to HTTP responses.
 */

/**
 * Normalize pagination parameters from a query-like object.
 *
 * @param {Object} source - Typically `req.query` from Express.
 * @param {Object} [options]
 * @param {number} [options.defaultPage=1]
 * @param {number} [options.defaultPageSize=20]
 * @param {number} [options.maxPageSize=100]
 * @returns {{ page: number, pageSize: number, errorCode: string | null }}
 *
 * errorCode:
 *   - null if OK
 *   - "invalid_pagination" if page/pageSize were non-numeric or <= 0 and
 *     had to be clamped to defaults.
 */
export function normalizePaginationParams(
  source,
  options = {}
) {
  const {
    defaultPage = 1,
    defaultPageSize = 20,
    maxPageSize = 100
  } = options;

  let rawPage = source?.page;
  let rawPageSize = source?.pageSize;

  let page = Number.parseInt(rawPage, 10);
  let pageSize = Number.parseInt(rawPageSize, 10);

  let errorCode = null;

  if (!Number.isFinite(page) || page <= 0) {
    page = defaultPage;
    if (rawPage !== undefined) {
      errorCode = "invalid_pagination";
    }
  }

  if (!Number.isFinite(pageSize) || pageSize <= 0) {
    pageSize = defaultPageSize;
    if (rawPageSize !== undefined) {
      errorCode = "invalid_pagination";
    }
  }

  if (pageSize > maxPageSize) {
    pageSize = maxPageSize;
    errorCode = "invalid_pagination";
  }

  return { page, pageSize, errorCode };
}

/**
 * Check whether a string looks like an ISO-8601 date (YYYY-MM-DD).
 *
 * NOTE: This only validates the *shape* and then relies on Date parsing
 *       for basic sanity. It does not fully guard against invalid dates
 *       like 2025-02-30, but rejects clearly malformed strings.
 *
 * @param {string} value
 * @returns {boolean}
 */
export function isIsoDateString(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return false;
  }
  const date = new Date(trimmed);
  return !Number.isNaN(date.getTime());
}

/**
 * Validate and normalize a date range.
 *
 * @param {Object} params
 * @param {string | null | undefined} params.startDate - ISO-like date string.
 * @param {string | null | undefined} params.endDate - ISO-like date string.
 * @param {Object} [options]
 * @param {boolean} [options.allowEqual=true] - Whether start and end can be equal.
 * @returns {{
 *   startDate: string | null,
 *   endDate: string | null,
 *   errorCode: string | null
 * }}
 *
 * errorCode:
 *   - null if OK or both dates absent
 *   - "invalid_date" if a single date is malformed
 *   - "invalid_date_range" if end < start or equality not allowed
 */
export function validateDateRange(
  { startDate, endDate },
  options = {}
) {
  const { allowEqual = true } = options;

  let normalizedStart = startDate ? String(startDate).trim() : null;
  let normalizedEnd = endDate ? String(endDate).trim() : null;

  if (normalizedStart && !isIsoDateString(normalizedStart)) {
    return {
      startDate: null,
      endDate: null,
      errorCode: "invalid_date"
    };
  }

  if (normalizedEnd && !isIsoDateString(normalizedEnd)) {
    return {
      startDate: null,
      endDate: null,
      errorCode: "invalid_date"
    };
  }

  if (!normalizedStart && !normalizedEnd) {
    return { startDate: null, endDate: null, errorCode: null };
  }

  const startTime = normalizedStart ? new Date(normalizedStart).getTime() : null;
  const endTime = normalizedEnd ? new Date(normalizedEnd).getTime() : null;

  if (startTime !== null && endTime !== null) {
    if (endTime < startTime) {
      return {
        startDate: normalizedStart,
        endDate: normalizedEnd,
        errorCode: "invalid_date_range"
      };
    }
    if (!allowEqual && endTime === startTime) {
      return {
        startDate: normalizedStart,
        endDate: normalizedEnd,
        errorCode: "invalid_date_range"
      };
    }
  }

  return {
    startDate: normalizedStart,
    endDate: normalizedEnd,
    errorCode: null
  };
}

/**
 * Validate a numeric range with optional min/max constraints.
 *
 * @param {Object} params
 * @param {number | string | null | undefined} params.min
 * @param {number | string | null | undefined} params.max
 * @returns {{
 *   min: number | null,
 *   max: number | null,
 *   errorCode: string | null
 * }}
 *
 * errorCode:
 *   - null if OK
 *   - "invalid_range" if min/max are non-numeric or min > max.
 */
export function validateNumericRange({ min, max }) {
  const numericMin =
    min !== undefined && min !== null && min !== ""
      ? Number(min)
      : null;
  const numericMax =
    max !== undefined && max !== null && max !== ""
      ? Number(max)
      : null;

  if (
    (numericMin !== null && !Number.isFinite(numericMin)) ||
    (numericMax !== null && !Number.isFinite(numericMax))
  ) {
    return {
      min: null,
      max: null,
      errorCode: "invalid_range"
    };
  }

  if (
    numericMin !== null &&
    numericMax !== null &&
    numericMax < numericMin
  ) {
    return {
      min: numericMin,
      max: numericMax,
      errorCode: "invalid_range"
    };
  }

  return {
    min: numericMin,
    max: numericMax,
    errorCode: null
  };
}
