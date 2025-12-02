/**
 * @file client/src/features/auth/api.js
 * @description API service functions for Authentication and User Registration.
 * * Endpoints:
 * - POST /api/auth/login
 * - POST /api/users (Registration)
 * - GET /api/auth/me (Current User Profile)
 * * @dependencies
 * - client/src/lib/api-client.js: Core HTTP client.
 */

import { apiClient } from '@/lib/api-client';

/**
 * Logs in a user.
 * @param {Object} credentials
 * @param {string} credentials.email
 * @param {string} credentials.password
 * @returns {Promise<{ accessToken: string, user: Object }>}
 */
export function loginWithEmailAndPassword(credentials) {
  // Spec: POST /api/auth/login
  return apiClient('api/auth/login', {
    method: 'POST',
    data: credentials,
  });
}

/**
 * Registers a new user.
 * @param {Object} data - Full user profile payload.
 * @param {string} data.userId - SSN formatted ID.
 * @param {string} data.email
 * @param {string} data.password
 * @param {string} data.firstName
 * @param {string} data.lastName
 * @param {string} data.address
 * @param {string} data.city
 * @param {string} data.state
 * @param {string} data.zip
 * @param {string} data.phone
 * @returns {Promise<{ user: Object }>}
 */
export function registerUser(data) {
  // Spec: POST /api/users
  return apiClient('api/users', {
    method: 'POST',
    data,
  });
}

/**
 * Fetches the currently authenticated user's profile.
 * @returns {Promise<{ user: Object }>}
 */
export function getProfile() {
  // Spec: GET /api/auth/me
  // Note: Backend might also expose this at /api/users/me; using auth/me per spec section 3.2
  return apiClient('api/auth/me');
}

/**
 * Optional: Logs out via API if backend requires invalidating tokens server-side.
 * (JWTs are stateless, so usually client-side removal is enough, but some setups use blacklists)
 */
export function logoutUser() {
  // Not strictly required by spec, but good practice if using refresh tokens or server-side sessions.
  // return apiClient('api/auth/logout', { method: 'POST' });
  return Promise.resolve();
}