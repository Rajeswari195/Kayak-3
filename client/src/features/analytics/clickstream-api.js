/**
 * @file client/src/features/analytics/clickstream-api.js
 * @description API service functions for client-side analytics tracking.
 * * Endpoints:
 * - POST /api/analytics/track
 * * @dependencies
 * - client/src/lib/api-client.js
 */

import { apiClient } from '@/lib/api-client';

/**
 * Sends a single analytics event to the backend.
 * @param {Object} payload
 * @param {string} payload.eventType - 'PAGE_VIEW', 'CLICK', 'SEARCH', 'BOOKING', etc.
 * @param {string} payload.path - Current URL path.
 * @param {string} [payload.sessionId] - Client-generated session ID.
 * @param {Object} [payload.metadata] - Arbitrary metadata (e.g. search params, listing ID).
 * @returns {Promise<void>}
 */
export function trackEvent(payload) {
  // We use fire-and-forget semantics mostly, but return the promise for callers who care.
  return apiClient('api/analytics/track', {
    method: 'POST',
    data: payload,
  }).catch(err => {
    // Analytics should not break the app, so we catch errors here.
    console.warn('[Analytics] Failed to track event:', err);
  });
}

/**
 * Sends a batch of analytics events.
 * @param {Array<Object>} events
 * @returns {Promise<void>}
 */
export function trackEventsBatch(events) {
  return apiClient('api/analytics/track/batch', {
    method: 'POST',
    data: { events },
  }).catch(err => {
    console.warn('[Analytics] Failed to track batch:', err);
  });
}