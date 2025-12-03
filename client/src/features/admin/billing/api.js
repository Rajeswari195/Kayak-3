/**
 * @file client/src/features/admin/billing/api.js
 * @description API client for admin billing reports.
 */
import { apiClient } from '@/lib/api-client';

/**
 * Fetch billing reports.
 * @param {Object} params
 * @param {string} [params.month] - YYYY-MM
 * @param {string} [params.from] - YYYY-MM-DD
 * @param {string} [params.to] - YYYY-MM-DD
 */
export function getBillingReports(params) {
  const query = new URLSearchParams(params).toString();
  return apiClient(`api/admin/billing?${query}`);
}