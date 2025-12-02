/**
 * @file client/src/features/users/api.js
 * @description API service functions for User management.
 * * Functions:
 * - updateUserProfile: Updates user details.
 * - getUserBookings: Fetches bookings for the current user.
 * - getUserReviews: Fetches reviews written by the current user.
 * * @dependencies
 * - client/src/lib/api-client.js
 */

import { apiClient } from '@/lib/api-client';

/**
 * Updates the current user's profile.
 * @param {string} userId - The user's ID (UUID).
 * @param {Object} data - The fields to update.
 * @returns {Promise<{ user: Object }>}
 */
export function updateUserProfile(userId, data) {
  // Spec: PATCH /api/users/:id or /api/users/me
  // We'll use /api/users/me for safety if supported, or /api/users/:id
  // Assuming the core-api routes/controllers support PATCH /users/:id
  return apiClient(`api/users/${userId}`, {
    method: 'PATCH',
    data,
  });
}

/**
 * Fetches the current user's bookings.
 * @param {Object} params
 * @param {'past'|'current'|'future'} [params.scope] - Optional scope filter.
 * @returns {Promise<Array>} List of bookings.
 */
export function getUserBookings({ scope } = {}) {
  // Spec: GET /api/bookings/my?scope=...
  const query = scope ? `?scope=${scope}` : '';
  return apiClient(`api/bookings/my${query}`);
}

/**
 * Fetches reviews written by the current user.
 * @returns {Promise<Array>} List of reviews.
 */
export function getUserReviews() {
  // Spec: GET /api/reviews/my (implied requirement for profile view)
  // If not explicitly defined in spec section 3.7, we assume a standard query capability
  // or we filter by userId if a generic list endpoint exists.
  // Let's assume GET /api/reviews?userId=... or /api/users/:id/reviews
  // We'll try the specific endpoint pattern:
  return apiClient('api/reviews?my=true');
}