/**
 * @file client/src/lib/auth-storage.js
 * @description Utilities for managing authentication persistence in LocalStorage.
 * * Responsibilities:
 * - Storing and retrieving the JWT access token.
 * - Storing and retrieving the user profile object (for initial state hydration).
 * - Clearing auth data on logout.
 * * @notes
 * - Keys are prefixed with 'kayak_' to avoid collisions.
 * - Tokens should ideally be stored in HttpOnly cookies for better security in production,
 * but LocalStorage is used here per the project requirements for simplicity.
 */

const STORAGE_PREFIX = 'kayak_';
const TOKEN_KEY = `${STORAGE_PREFIX}access_token`;
const USER_KEY = `${STORAGE_PREFIX}user`;

/**
 * Retrieves the stored access token.
 * @returns {string|null} The JWT string or null if not found.
 */
export function getToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

/**
 * Persists the access token.
 * @param {string} token - The JWT string to store.
 */
export function setToken(token) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Removes the access token.
 */
export function clearToken() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TOKEN_KEY);
}

/**
 * Retrieves the stored user object.
 * @returns {Object|null} The user object or null if parsing fails/not found.
 */
export function getStoredUser() {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error('Error parsing stored user:', error);
    return null;
  }
}

/**
 * Persists the user object.
 * @param {Object} user - The user profile object to store.
 */
export function setStoredUser(user) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Removes the stored user object.
 */
export function clearStoredUser() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(USER_KEY);
}

/**
 * Clears all authentication data (token and user).
 */
export function clearAuth() {
  clearToken();
  clearStoredUser();
}