/**
 * @file client/src/features/admin/listings/api.js
 * @description API client for admin listing management.
 */

import { apiClient } from '@/lib/api-client';

export function getAdminFlights(params) {
  const query = new URLSearchParams(params).toString();
  return apiClient(`api/admin/flights?${query}`);
}

export function createFlight(data) {
  return apiClient('api/admin/flights', { method: 'POST', data });
}

export function updateFlight(id, data) {
  return apiClient(`api/admin/flights/${id}`, { method: 'PUT', data });
}

export function getAdminHotels(params) {
  const query = new URLSearchParams(params).toString();
  return apiClient(`api/admin/hotels?${query}`);
}

export function createHotel(data) {
  return apiClient('api/admin/hotels', { method: 'POST', data });
}

export function updateHotel(id, data) {
  return apiClient(`api/admin/hotels/${id}`, { method: 'PUT', data });
}

export function getAdminCars(params) {
  const query = new URLSearchParams(params).toString();
  return apiClient(`api/admin/cars?${query}`);
}

export function createCar(data) {
  return apiClient('api/admin/cars', { method: 'POST', data });
}

export function updateCar(id, data) {
  return apiClient(`api/admin/cars/${id}`, { method: 'PUT', data });
}

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