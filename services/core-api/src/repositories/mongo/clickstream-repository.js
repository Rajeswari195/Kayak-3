/**
 * @description
 * MongoDB repository for managing clickstream events and user activity tracking.
 * This module handles logging and querying of user interactions across the platform
 * for analytics, behavior analysis, and trace diagrams.
 * 
 * Key features:
 * - Log various event types (page views, clicks, searches, bookings)
 * - Fetch user activity traces
 * - Aggregate click statistics for analytics dashboards
 * - Support cohort analysis by city/segment
 * - Track page-level and listing-level engagement
 * 
 * @dependencies
 * - mongoose: MongoDB ODM for data modeling and queries
 * - clickstreamModel: Mongoose model from schema definition
 * 
 * @notes
 * - Events are append-only (never updated or deleted)
 * - Timestamps are critical for trace diagrams and session analysis
 * - Metadata field allows flexible event context storage
 * - Use indexes on userId, eventType, and createdAt for performance
 */

import mongoose from 'mongoose';
import { getMongoConnection } from '../../db/mongo.js';

/**
 * Get the Clickstream model from the mongo connection
 * @returns {mongoose.Model} Clickstream model
 */
function getClickstreamModel() {
    const db = getMongoConnection();
    return db.model('Clickstream');
}

/**
 * Log a clickstream event
 * @param {Object} eventData - Event data
 * @param {string} [eventData.userId] - User ID (optional for anonymous events)
 * @param {string} eventData.eventType - Type of event (PAGE_VIEW, CLICK, SEARCH, BOOKING, etc.)
 * @param {string} eventData.path - URL path or route
 * @param {Object} [eventData.metadata] - Additional event context (listing IDs, search params, etc.)
 * @param {string} [eventData.sessionId] - Optional session identifier
 * @param {string} [eventData.ipAddress] - Optional IP address
 * @param {string} [eventData.userAgent] - Optional user agent string
 * @returns {Promise<Object>} Created event document
 */
export async function logEvent(eventData) {
    try {
        const Clickstream = getClickstreamModel();

        const event = new Clickstream({
            userId: eventData.userId || null,
            eventType: eventData.eventType,
            path: eventData.path,
            metadata: eventData.metadata || {},
            sessionId: eventData.sessionId || null,
            ipAddress: eventData.ipAddress || null,
            userAgent: eventData.userAgent || null,
            timestamp: new Date()
        });

        const savedEvent = await event.save();
        return savedEvent.toObject();
    } catch (error) {
        console.error('Error logging clickstream event:', error);
        throw error;
    }
}

/**
 * Batch log multiple clickstream events
 * Useful for delayed/batched analytics submissions
 * @param {Array<Object>} events - Array of event data objects
 * @returns {Promise<Array>} Array of created event documents
 */
export async function logEventsBatch(events) {
    try {
        const Clickstream = getClickstreamModel();

        const eventDocs = events.map(eventData => ({
            userId: eventData.userId || null,
            eventType: eventData.eventType,
            path: eventData.path,
            metadata: eventData.metadata || {},
            sessionId: eventData.sessionId || null,
            ipAddress: eventData.ipAddress || null,
            userAgent: eventData.userAgent || null,
            timestamp: eventData.timestamp || new Date()
        }));

        const savedEvents = await Clickstream.insertMany(eventDocs);
        return savedEvents.map(e => e.toObject());
    } catch (error) {
        console.error('Error batch logging clickstream events:', error);
        throw error;
    }
}

/**
 * Get user activity trace (journey) within a date range
 * Used for trace diagrams showing user paths through the application
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @param {Date} [options.startDate] - Start date for trace
 * @param {Date} [options.endDate] - End date for trace
 * @param {number} [options.limit=500] - Max events to return
 * @returns {Promise<Array>} Array of events in chronological order
 */
export async function getUserTrace(userId, options = {}) {
    try {
        const Clickstream = getClickstreamModel();

        const query = { userId };

        // Apply date range filters if provided
        if (options.startDate || options.endDate) {
            query.timestamp = {};
            if (options.startDate) {
                query.timestamp.$gte = new Date(options.startDate);
            }
            if (options.endDate) {
                query.timestamp.$lte = new Date(options.endDate);
            }
        }

        const limit = Math.min(1000, Math.max(1, options.limit || 500));

        const events = await Clickstream.find(query)
            .sort({ timestamp: 1 }) // Chronological order
            .limit(limit)
            .lean();

        return events;
    } catch (error) {
        console.error('Error getting user trace:', error);
        throw error;
    }
}

/**
 * Get user session summary (events grouped by session)
 * @param {string} userId - User ID
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>} Session summary with event list and statistics
 */
export async function getUserSession(userId, sessionId) {
    try {
        const Clickstream = getClickstreamModel();

        const events = await Clickstream.find({
            userId,
            sessionId
        })
            .sort({ timestamp: 1 })
            .lean();

        if (events.length === 0) {
            return {
                sessionId,
                userId,
                events: [],
                eventCount: 0,
                duration: 0,
                paths: []
            };
        }

        const firstEvent = events[0];
        const lastEvent = events[events.length - 1];
        const duration = lastEvent.timestamp - firstEvent.timestamp;
        const paths = [...new Set(events.map(e => e.path))];

        return {
            sessionId,
            userId,
            events,
            eventCount: events.length,
            startTime: firstEvent.timestamp,
            endTime: lastEvent.timestamp,
            duration, // milliseconds
            paths,
            eventTypes: [...new Set(events.map(e => e.eventType))]
        };
    } catch (error) {
        console.error('Error getting user session:', error);
        throw error;
    }
}
