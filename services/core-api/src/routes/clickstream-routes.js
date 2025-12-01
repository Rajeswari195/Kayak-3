/**
 * @description
 * Express router for clickstream and analytics tracking endpoints.
 * Defines routes for logging user interactions and behavior events.
 * 
 * Routes:
 * - POST /analytics/track - Log single event
 * - POST /analytics/track/batch - Log multiple events
 * - GET /analytics/session/:sessionId - Get session events
 * - GET /analytics/health - Service health check
 * 
 * @dependencies
 * - express: Web framework
 * - clickstreamController: HTTP handlers
 * - optionalAuth: Middleware that attaches user if JWT present but doesn't require it
 * 
 * @notes
 * - All endpoints are public to support anonymous tracking
 * - Optional authentication middleware attaches user when available
 * - Events are fire-and-forget for performance (202 Accepted status)
 * - Batch endpoint limited to 100 events per request
 */

import express from 'express';
import {
    trackEventController,
    trackEventsBatchController,
    getSessionEventsController,
    analyticsHealthController
} from '../controllers/clickstream-controller.js';
import { optionalAuth } from '../middlewares/auth-middleware.js';

const router = express.Router();

/**
 * @route POST /analytics/track
 * @desc Track a single user activity or clickstream event
 * @access Public (optionally authenticated)
 * @body {string} eventType - Type of event (PAGE_VIEW, CLICK, SEARCH, BOOKING, etc.)
 * @body {string} path - URL path where event occurred
 * @body {Object} [metadata] - Additional event context (listing IDs, search params, etc.)
 * @body {string} [sessionId] - Session identifier
 * @returns {202} Accepted - Event queued for processing
 */
router.post('/track', optionalAuth, trackEventController);

/**
 * @route POST /analytics/track/batch
 * @desc Track multiple events in a single request
 * @access Public (optionally authenticated)
 * @body {Array<Object>} events - Array of event objects (max 100)
 * @body {string} events[].eventType - Event type
 * @body {string} events[].path - Event path
 * @body {Object} [events[].metadata] - Event metadata
 * @body {string} [events[].sessionId] - Session ID
 * @body {string} [events[].timestamp] - Client timestamp (ISO format)
 * @returns {202} Accepted - Events queued for processing
 */
router.post('/track/batch', optionalAuth, trackEventsBatchController);

/**
 * @route GET /analytics/session/:sessionId
 * @desc Retrieve all events for a specific session
 * @access Public
 * @params {string} sessionId - Session identifier
 * @query {string} userId - User identifier (required)
 * @returns {200} Session data with events and statistics
 */
router.get('/session/:sessionId', getSessionEventsController);

/**
 * @route GET /analytics/health
 * @desc Health check for analytics tracking service
 * @access Public
 * @returns {200} Service status
 */
router.get('/health', analyticsHealthController);

export default router;
