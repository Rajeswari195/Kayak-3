/**
 * @file client/src/features/reviews/api.js
 * @description API client for Review operations.
 * * Endpoints:
 * - POST /api/reviews: Create a new review.
 * - GET /api/reviews: List reviews (public or user-scoped).
 */

import { apiClient } from '@/lib/api-client';

/**
 * Submit a new review.
 * @param {Object} payload
 * @param {string} payload.listingType - 'FLIGHT' | 'HOTEL' | 'CAR'
 * @param {string} payload.listingId
 * @param {string} payload.bookingId
 * @param {number} payload.rating - 1 to 5
 * @param {string} [payload.comment]
 * @param {string} [payload.title]
 */
export function createReview(payload) {
  return apiClient('api/reviews', {
    method: 'POST',
    data: payload,
  });
}

/**
 * Get reviews.
 * @param {Object} params
 * @param {string} [params.listingType]
 * @param {string} [params.listingId]
 * @param {boolean} [params.my] - If true, fetches current user's reviews.
 * @param {number} [params.limit]
 * @param {number} [params.offset]
 */
export function getReviews(params) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      query.append(key, String(value));
    }
  });
  return apiClient(`api/reviews?${query.toString()}`);
}