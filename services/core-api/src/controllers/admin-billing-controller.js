/**
 * @file admin-billing-controller.js
 * @description Controller for Admin Billing & Revenue reports.
 */

import { listBillingTransactionsForMonth } from "../repositories/mysql/billing-repository.js";
import { ValidationError } from "../lib/errors.js";

/**
 * GET /api/admin/billing
 * Query Params:
 * - month: "YYYY-MM" (required)
 */
export async function getAdminBillingReportsController(req, res, next) {
  try {
    const { month } = req.query;

    if (!month || typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month)) {
      // Default to current month if invalid or missing, or throw error.
      // For admin tools, explicit errors are often better.
      throw new ValidationError("Query parameter 'month' is required in YYYY-MM format.");
    }

    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const m = parseInt(monthStr, 10);

    if (m < 1 || m > 12) {
      throw new ValidationError("Month must be between 01 and 12.");
    }

    const results = await listBillingTransactionsForMonth(year, m);

    res.json({ results });
  } catch (err) {
    next(err);
  }
}