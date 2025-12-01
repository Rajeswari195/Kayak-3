/**
 * @description
 * HTTP controllers for clickstream and analytics tracking endpoints.
 * Handles logging of user interactions, page views, and behavior events.
 * 
 * Key endpoints:
 * - POST /analytics/track - Log a single event
 * - POST /analytics/track/batch - Log multiple events
 * - GET /analytics/session/:sessionId - Retrieve session events
 * 
 * @dependencies
 * - clickstreamRepository: MongoDB operations for clickstream
 * - userActivityProducer: Kafka publishing for analytics pipeline
 * 
 * @notes
 * - Events are stored in MongoDB and published to Kafka asynchronously
 * - Supports both authenticated and anonymous tracking
 * - IP and user agent extracted from request headers
 * - Client can send batched events for efficiency
 */

import {
    logEvent,
    logEventsBatch,
    getUserSession
} from '../repositories/mongo/clickstream-repository.js';

import {
    publishUserActivity,
    publishUserActivityBatch
} from '../kafka/user-activity-producer.js';

/**
 * Track a single user activity/clickstream event
 * POST /analytics/track
 * Public endpoint (works for both authenticated and anonymous users)
 * @param {Object} req - Express request
 * @param {Object} req.body - Event data
 * @param {Object} res - Express response
 */
export async function trackEventController(req, res, next) {
    try {
        const {
            eventType,
            path,
            metadata,
            sessionId
        } = req.body;

        // Validate required fields
        if (!eventType || !path) {
            return res.status(400).json({
                success: false,
                message: 'eventType and path are required'
            });
        }

        // Get userId from JWT if authenticated, otherwise null
        const userId = req.user?.id || null;

        // Extract IP and user agent from request
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('user-agent');

        // Prepare event data
        const eventData = {
            userId,
            eventType,
            path,
            metadata: metadata || {},
            sessionId: sessionId || null,
            ipAddress,
            userAgent
        };

        // Log to MongoDB (don't await - fire and forget for performance)
        logEvent(eventData).catch(error => {
            console.error('Error logging event to MongoDB:', error);
        });

        // Publish to Kafka (don't await - fire and forget)
        publishUserActivity(eventData).catch(error => {
            console.error('Error publishing to Kafka:', error);
        });

        // Return immediately to client
        return res.status(202).json({
            success: true,
            message: 'Event tracked successfully'
        });
    } catch (error) {
        console.error('Error in trackEventController:', error);
        next(error);
    }
}

/**
 * Track multiple events in batch
 * POST /analytics/track/batch
 * Public endpoint
 * @param {Object} req - Express request
 * @param {Array} req.body.events - Array of event objects
 * @param {Object} res - Express response
 */
export async function trackEventsBatchController(req, res, next) {
    try {
        const { events } = req.body;

        // Validate input
        if (!Array.isArray(events) || events.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'events array is required and must not be empty'
            });
        }

        if (events.length > 100) {
            return res.status(400).json({
                success: false,
                message: 'Maximum 100 events per batch'
            });
        }

        // Get userId from JWT if authenticated
        const userId = req.user?.id || null;
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('user-agent');

        // Enrich all events with request context
        const enrichedEvents = events.map(event => ({
            userId: event.userId || userId,
            eventType: event.eventType,
            path: event.path,
            metadata: event.metadata || {},
            sessionId: event.sessionId || null,
            ipAddress: event.ipAddress || ipAddress,
            userAgent: event.userAgent || userAgent,
            timestamp: event.timestamp || new Date()
        }));

        // Validate all events have required fields
        const invalidEvents = enrichedEvents.filter(e => !e.eventType || !e.path);
        if (invalidEvents.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'All events must have eventType and path'
            });
        }

        // Log to MongoDB (fire and forget)
        logEventsBatch(enrichedEvents).catch(error => {
            console.error('Error batch logging events to MongoDB:', error);
        });

        // Publish to Kafka (fire and forget)
        publishUserActivityBatch(enrichedEvents).catch(error => {
            console.error('Error batch publishing to Kafka:', error);
        });

        // Return immediately
        return res.status(202).json({
            success: true,
            message: `${events.length} events tracked successfully`
        });
    } catch (error) {
        console.error('Error in trackEventsBatchController:', error);
        next(error);
    }
}

/**
 * Get events for a specific session
 * GET /analytics/session/:sessionId
 * Public endpoint (could be restricted in production)
 * @param {Object} req - Express request
 * @param {Object} req.params - URL parameters
 * @param {Object} res - Express response
 */
export async function getSessionEventsController(req, res, next) {
    try {
        const { sessionId } = req.params;
        const { userId } = req.query;

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: 'sessionId is required'
            });
        }

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'userId is required'
            });
        }

        const sessionData = await getUserSession(userId, sessionId);

        return res.status(200).json({
            success: true,
            data: sessionData
        });
    } catch (error) {
        console.error('Error in getSessionEventsController:', error);
        next(error);
    }
}

/**
 * Health check endpoint for analytics service
 * GET /analytics/health
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 */
export async function analyticsHealthController(req, res) {
    return res.status(200).json({
        success: true,
        service: 'analytics-tracking',
        timestamp: new Date().toISOString()
    });
}
