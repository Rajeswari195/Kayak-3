/**
 * @file client/src/lib/api-client.js
 * @description A wrapper around the native `fetch` API for making HTTP requests to the Core API.
 * * Features:
 * - Automatically prepends `VITE_API_BASE_URL`.
 * - Automatically injects `Authorization: Bearer <token>` if a token exists.
 * - Sets default headers (e.g., `Content-Type: application/json`).
 * - Parses JSON responses automatically.
 * - Unified error handling: throws meaningful errors with backend error codes.
 * * @dependencies
 * - client/src/lib/auth-storage.js: To retrieve the access token.
 */

import { getToken } from './auth-storage';

// Read API base URL from Vite environment variables.
// Fallback to localhost:4000 if not set (development default).
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

/**
 * Core API Client function.
 * * @param {string} endpoint - The relative API endpoint (e.g., 'users/me' or 'auth/login').
 * Should NOT start with a slash if following the join logic strictly,
 * but logic handles leading slashes gracefully.
 * @param {Object} [config] - Fetch options (method, body, headers, etc.).
 * @param {any} [config.data] - JSON body payload (will be stringified).
 * @param {Object} [config.headers] - Custom headers.
 * @returns {Promise<any>} - The parsed JSON response data.
 * @throws {Error} - Throws if the response status is not 2xx.
 */
export async function apiClient(endpoint, { data, headers: customHeaders, ...customConfig } = {}) {
  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...customHeaders,
  };

  const config = {
    method: data ? 'POST' : 'GET',
    body: data ? JSON.stringify(data) : undefined,
    headers,
    ...customConfig,
  };

  // Ensure endpoint does not have double slashes when joining
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  // Ensure base url doesn't end with slash
  const cleanBaseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  
  const url = `${cleanBaseUrl}/${cleanEndpoint}`;

  try {
    const response = await fetch(url, config);
    const result = await response.json().catch(() => ({})); // Handle empty responses gracefully

    if (response.ok) {
      return result;
    } else {
      // Create an error object consistent with the backend error shape
      // Backend error shape: { success: false, code: "error_code", message: "Human readable" }
      const error = new Error(result.message || 'An unexpected error occurred');
      
      // Attach extra properties for downstream handlers
      // @ts-ignore
      error.status = response.status;
      // @ts-ignore
      error.code = result.code || result.errorCode || 'unknown_error';
      // @ts-ignore
      error.data = result;

      return Promise.reject(error);
    }
  } catch (error) {
    // Network errors or JSON parsing errors
    // @ts-ignore
    if (!error.status) {
       // @ts-ignore
      error.message = error.message || 'Network error';
       // @ts-ignore
      error.code = 'network_error';
    }
    return Promise.reject(error);
  }
}