/**
 * @file client/src/features/search/api.js
 * @description API service functions for searching Listings.
 * * Endpoints:
 * - GET /api/search/flights
 * - GET /api/search/hotels
 * - GET /api/search/cars
 * * @dependencies
 * - client/src/lib/api-client.js
 */

import { apiClient } from '@/lib/api-client';

/**
 * Helper to filter out empty/null/undefined params before sending.
 * @param {Object} params 
 * @returns {URLSearchParams}
 */
function buildQueryString(params) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      searchParams.append(key, String(value));
    }
  });
  return searchParams.toString();
}

/**
 * Searches for flights matching the criteria.
 * @param {Object} params - Search filters (origin, destination, date, etc.)
 * @returns {Promise<Object>} Search results { items: [], total: number }
 */
export function searchFlights(params) {
  const query = buildQueryString(params);
  return apiClient(`api/search/flights?${query}`);
}

/**
 * Searches for hotels matching the criteria.
 * @param {Object} params - Search filters (city, dates, guests, stars, etc.)
 * @returns {Promise<Object>} Search results { items: [], total: number }
 */
export function searchHotels(params) {
  const query = buildQueryString(params);
  return apiClient(`api/search/hotels?${query}`);
}

/**
 * Searches for rental cars matching the criteria.
 * @param {Object} params - Search filters (location, dates, type, etc.)
 * @returns {Promise<Object>} Search results { items: [], total: number }
 */
export function searchCars(params) {
  const query = buildQueryString(params);
  return apiClient(`api/search/cars?${query}`);
}