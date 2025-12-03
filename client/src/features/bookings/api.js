/**
 * @file client/src/features/bookings/api.js
 * @description API service functions for creating Bookings.
 * * Endpoints:
 * - POST /api/bookings/flight
 * - POST /api/bookings/hotel
 * - POST /api/bookings/car
 * - GET /api/bookings (Existing in user api, but can be here too)
 * * @dependencies
 * - client/src/lib/api-client.js
 */

import { apiClient } from '@/lib/api-client';

/**
 * Creates a flight booking.
 * @param {Object} payload
 * @param {string} payload.flightId
 * @param {string} payload.departureDate
 * @param {string} [payload.returnDate]
 * @param {string} payload.class
 * @param {number} payload.seats
 * @param {number} payload.price - Total or per-seat price (Validation requires 'price')
 * @param {string} payload.paymentMethodToken
 * @returns {Promise<Object>}
 */
export function bookFlight(payload) {
  return apiClient('api/bookings/flight', {
    method: 'POST',
    data: payload,
  });
}

/**
 * Creates a hotel booking.
 * @param {Object} payload
 * @param {string} payload.hotelId
 * @param {string} payload.roomType
 * @param {string} payload.checkInDate
 * @param {string} payload.checkOutDate
 * @param {number} payload.pricePerNight
 * @param {string} payload.paymentMethodToken
 * @param {number} [payload.rooms]
 * @returns {Promise<Object>}
 */
export function bookHotel(payload) {
  return apiClient('api/bookings/hotel', {
    method: 'POST',
    data: payload,
  });
}

/**
 * Creates a car booking.
 * @param {Object} payload
 * @param {string} payload.carId
 * @param {string} payload.pickupLocation
 * @param {string} payload.dropoffLocation
 * @param {string} payload.pickupDate
 * @param {string} payload.dropoffDate
 * @param {number} payload.pricePerDay
 * @param {string} payload.paymentMethodToken
 * @returns {Promise<Object>}
 */
export function bookCar(payload) {
  return apiClient('api/bookings/car', {
    method: 'POST',
    data: payload,
  });
}