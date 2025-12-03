/**
 * @file client/src/features/analytics/api.js
 * @description API client for fetching admin analytics data.
 * * Endpoints:
 * - /api/admin/analytics/revenue/*
 * - /api/admin/analytics/providers/*
 * - /api/admin/analytics/clicks/*
 */

import { apiClient } from '@/lib/api-client';

/**
 * Get top properties by revenue for a specific year.
 * @param {Object} params
 * @param {number} params.year - e.g., 2025
 * @param {number} [params.limit] - Default 10
 */
export function getRevenueTopProperties(params) {
  const query = new URLSearchParams(params).toString();
  return apiClient(`api/admin/analytics/revenue/top-properties?${query}`);
}

/**
 * Get total revenue aggregated by city for a specific year.
 * @param {Object} params
 * @param {number} params.year
 */
export function getRevenueByCity(params) {
  const query = new URLSearchParams(params).toString();
  return apiClient(`api/admin/analytics/revenue/city?${query}`);
}

/**
 * Get top providers (hosts/airlines) by revenue for a specific month.
 * @param {Object} params
 * @param {string} params.month - YYYY-MM
 * @param {number} [params.limit]
 */
export function getTopProviders(params) {
  const query = new URLSearchParams(params).toString();
  return apiClient(`api/admin/analytics/providers/top?${query}`);
}

/**
 * Get page view statistics.
 * @param {Object} params
 * @param {number} [params.sinceDays] - e.g., 30
 * @param {number} [params.limit]
 */
export function getPageClicks(params) {
  const query = new URLSearchParams(params).toString();
  return apiClient(`api/admin/analytics/clicks/pages?${query}`);
}

/**
 * Get listing click statistics.
 * @param {Object} params
 * @param {number} [params.sinceDays]
 * @param {number} [params.limit]
 */
export function getListingClicks(params) {
  const query = new URLSearchParams(params).toString();
  return apiClient(`api/admin/analytics/clicks/listings?${query}`);
}