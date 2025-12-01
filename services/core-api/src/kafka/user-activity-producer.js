/**
 * @description
 * Kafka producer for user activity and clickstream events.
 * Publishes events to the 'user.activity' topic for downstream analytics processing.
 * 
 * Key features:
 * - Async event publishing to user.activity topic
 * - Event serialization to JSON
 * - Automatic partitioning by userId for ordered processing
 * - Error handling and logging for failed publishes
 * - Support for batch event publishing
 * 
 * @dependencies
 * - kafkaClient: Kafka producer instance
 * - topics: Topic name constants
 * 
 * @notes
 * - Events are keyed by userId to ensure same-user events go to same partition
 * - Failed publishes are logged but don't throw to prevent blocking user requests
 * - Timestamps are added server-side to ensure accuracy
 * - Topic must exist before publishing (create manually or via auto-create)
 */

import { getKafkaProducer } from './kafka-client.js';
import { TOPICS } from './topics.js';

/**
 * Publish a single user activity event to Kafka
 * @param {Object} eventData - Event data
 * @param {string} [eventData.userId] - User ID (optional for anonymous events)
 * @param {string} eventData.eventType - Type of event (PAGE_VIEW, CLICK, SEARCH, BOOKING, etc.)
 * @param {string} eventData.path - URL path or route
 * @param {Object} [eventData.metadata] - Additional event context
 * @param {string} [eventData.sessionId] - Session identifier
 * @param {string} [eventData.ipAddress] - Client IP address
 * @param {string} [eventData.userAgent] - User agent string
 * @returns {Promise<void>}
 */
export async function publishUserActivity(eventData) {
    try {
        const producer = await getKafkaProducer();

        // Enrich event with server timestamp
        const enrichedEvent = {
            ...eventData,
            timestamp: new Date().toISOString(),
            serverProcessedAt: new Date().toISOString()
        };

        // Prepare Kafka message
        const message = {
            key: eventData.userId || 'anonymous', // Partition by userId for ordering
            value: JSON.stringify(enrichedEvent),
            headers: {
                eventType: eventData.eventType,
                source: 'core-api'
            }
        };

        // Send to Kafka
        await producer.send({
            topic: TOPICS.USER_ACTIVITY,
            messages: [message]
        });

        console.log(`Published user activity event: ${eventData.eventType} for user ${eventData.userId || 'anonymous'}`);
    } catch (error) {
        // Log error but don't throw - we don't want Kafka issues to break user requests
        console.error('Error publishing user activity to Kafka:', error);
        console.error('Event that failed to publish:', eventData);
    }
}

/**
 * Publish multiple user activity events in batch
 * More efficient for bulk operations or delayed batch submissions
 * @param {Array<Object>} events - Array of event data objects
 * @returns {Promise<void>}
 */
export async function publishUserActivityBatch(events) {
    try {
        if (!events || events.length === 0) {
            console.warn('publishUserActivityBatch called with empty events array');
            return;
        }

        const producer = await getKafkaProducer();

        // Prepare all messages
        const messages = events.map(eventData => {
            const enrichedEvent = {
                ...eventData,
                timestamp: eventData.timestamp || new Date().toISOString(),
                serverProcessedAt: new Date().toISOString()
            };

            return {
                key: eventData.userId || 'anonymous',
                value: JSON.stringify(enrichedEvent),
                headers: {
                    eventType: eventData.eventType,
                    source: 'core-api'
                }
            };
        });

        // Send batch to Kafka
        await producer.send({
            topic: TOPICS.USER_ACTIVITY,
            messages
        });

        console.log(`Published ${events.length} user activity events to Kafka`);
    } catch (error) {
        console.error('Error publishing batch user activity to Kafka:', error);
        console.error(`Failed batch size: ${events.length}`);
    }
}

/**
 * Publish a page view event (convenience wrapper)
 * @param {string} userId - User ID
 * @param {string} path - Page path
 * @param {Object} metadata - Additional context
 * @returns {Promise<void>}
 */
export async function publishPageView(userId, path, metadata = {}) {
    await publishUserActivity({
        userId,
        eventType: 'PAGE_VIEW',
        path,
        metadata
    });
}

/**
 * Publish a search event (convenience wrapper)
 * @param {string} userId - User ID
 * @param {string} searchType - Type of search (flights, hotels, cars)
 * @param {Object} searchParams - Search parameters
 * @returns {Promise<void>}
 */
export async function publishSearchEvent(userId, searchType, searchParams = {}) {
    await publishUserActivity({
        userId,
        eventType: 'SEARCH',
        path: `/search/${searchType}`,
        metadata: {
            searchType,
            ...searchParams
        }
    });
}

/**
 * Publish a click event (convenience wrapper)
 * @param {string} userId - User ID
 * @param {string} path - Current path
 * @param {string} target - What was clicked
 * @param {Object} metadata - Additional context
 * @returns {Promise<void>}
 */
export async function publishClickEvent(userId, path, target, metadata = {}) {
    await publishUserActivity({
        userId,
        eventType: 'CLICK',
        path,
        metadata: {
            target,
            ...metadata
        }
    });
}

/**
 * Publish a booking-related event (convenience wrapper)
 * @param {string} userId - User ID
 * @param {string} action - Booking action (initiated, completed, failed, canceled)
 * @param {Object} bookingData - Booking details
 * @returns {Promise<void>}
 */
export async function publishBookingEvent(userId, action, bookingData = {}) {
    await publishUserActivity({
        userId,
        eventType: 'BOOKING',
        path: '/bookings',
        metadata: {
            action,
            ...bookingData
        }
    });
}
