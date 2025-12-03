/**
 * @file client/src/features/admin/users/api.js
 * @description API client for admin user management.
 */
import { apiClient } from '@/lib/api-client';

/**
 * Fetch paginated list of users with optional search.
 * @param {Object} params 
 * @param {number} params.page
 * @param {number} params.pageSize
 * @param {string} [params.search]
 */
export function getAdminUsers(params) {
  const query = new URLSearchParams(params).toString();
  return apiClient(`api/admin/users?${query}`);
}

/**
 * Fetch details for a specific user.
 * @param {string} id 
 */
export function getAdminUserDetail(id) {
  return apiClient(`api/admin/users/${id}`);
}

/**
 * Deactivate (suspend) a user account.
 * @param {string} id 
 */
export function deactivateUser(id) {
  return apiClient(`api/admin/users/${id}/deactivate`, { method: 'PATCH' });
}