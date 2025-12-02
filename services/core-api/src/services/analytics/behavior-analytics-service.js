// services/core-api/src/services/analytics/behavior-analytics-service.js

/**
 * Behavior analytics (clicks, reviews, traces) using MongoDB + MySQL.
 *
 * Exposed functions:
 *  - getPageClickStats({ sinceDays, limit })
 *  - getListingClickStats({ sinceDays, limit })
 *  - getReviewDistribution({ listingType, listingId })
 *  - getUserTraceForAnalytics(userId, { limitEvents })
 *  - getCohortTraceByCity(city, { limitUsers, limitEvents })
 */

import { getMongoConnection } from "../../db/mongo.js";
import { mysqlQuery } from "../../db/mysql.js";

// Cross-package import of Mongo collection names.
// Path assumes repo layout: /db/schema/mongo from repo root.
import {
  CLICKSTREAM_COLLECTION_NAME,
  REVIEW_COLLECTION_NAME,
} from "../../../../../db/schema/mongo/index.js";

/**
 * @param {number} days
 */
function computeSinceDate(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

/**
 * Aggregate click counts per page and eventType.
 *
 * @param {{ sinceDays?: number, limit?: number }} [params]
 */
export async function getPageClickStats(params = {}) {
  const sinceDays = Number.isFinite(params.sinceDays)
    ? Number(params.sinceDays)
    : 30;
  const limit = Math.min(Math.max(Number(params.limit || 100), 1), 500);

  const conn = await getMongoConnection();
  const clickCol = conn.collection(CLICKSTREAM_COLLECTION_NAME);

  const match = {};
  if (sinceDays > 0) {
    match.createdAt = { $gte: computeSinceDate(sinceDays) };
  }

  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: {
          page: "$page",
          eventType: "$eventType",
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: limit },
  ];

  const docs = await clickCol.aggregate(pipeline).toArray();

  return docs.map((d) => ({
    page: d._id.page,
    eventType: d._id.eventType,
    count: d.count,
  }));
}

/**
 * Aggregate click counts per listing (type + id).
 *
 * @param {{ sinceDays?: number, limit?: number }} [params]
 */
export async function getListingClickStats(params = {}) {
  const sinceDays = Number.isFinite(params.sinceDays)
    ? Number(params.sinceDays)
    : 30;
  const limit = Math.min(Math.max(Number(params.limit || 100), 1), 500);

  const conn = await getMongoConnection();
  const clickCol = conn.collection(CLICKSTREAM_COLLECTION_NAME);

  const match = {
    listingId: { $ne: null },
    listingType: { $ne: null },
  };

  if (sinceDays > 0) {
    match.createdAt = { $gte: computeSinceDate(sinceDays) };
  }

  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: {
          listingType: "$listingType",
          listingId: "$listingId",
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: limit },
  ];

  const docs = await clickCol.aggregate(pipeline).toArray();

  return docs.map((d) => ({
    listingType: d._id.listingType,
    listingId: d._id.listingId,
    clickCount: d.count,
  }));
}

/**
 * Distribution of ratings (1–5) for a given listing.
 *
 * @param {{ listingType: 'FLIGHT'|'HOTEL'|'CAR', listingId: string }} params
 */
export async function getReviewDistribution(params) {
  const { listingType, listingId } = params;

  const conn = await getMongoConnection();
  const reviewCol = conn.collection(REVIEW_COLLECTION_NAME);

  const match = { listingType, listingId };

  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: "$rating",
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ];

  const docs = await reviewCol.aggregate(pipeline).toArray();

  const totalCount = docs.reduce((sum, d) => sum + d.count, 0) || 0;
  const buckets = [];

  for (let rating = 1; rating <= 5; rating += 1) {
    const doc = docs.find((d) => d._id === rating);
    const count = doc ? doc.count : 0;
    buckets.push({
      rating,
      count,
      percentage: totalCount ? (count / totalCount) * 100 : 0,
    });
  }

  const weightedSum = docs.reduce(
    (sum, d) => sum + d._id * d.count,
    0
  );
  const averageRating =
    totalCount > 0 ? weightedSum / totalCount : null;

  return {
    listingType,
    listingId,
    totalReviews: totalCount,
    averageRating,
    buckets,
  };
}

/**
 * Simple trace for a single user: event list + session-level paths.
 *
 * @param {string} userId
 * @param {{ limitEvents?: number }} [params]
 */
export async function getUserTraceForAnalytics(userId, params = {}) {
  const limitEvents = Math.min(
    Math.max(Number(params.limitEvents || 500), 1),
    5000
  );

  const conn = await getMongoConnection();
  const clickCol = conn.collection(CLICKSTREAM_COLLECTION_NAME);

  const events = await clickCol
    .find({ userId })
    .sort({ createdAt: 1 })
    .limit(limitEvents)
    .toArray();

  const sessions = new Map();

  for (const ev of events) {
    const sessionId = ev.sessionId || "unknown";
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, []);
    }
    sessions.get(sessionId).push(ev);
  }

  const sessionTraces = [];

  for (const [sessionId, evs] of sessions.entries()) {
    const pages = evs.map((e) => e.page || e.path || "unknown");
    const uniquePages = [...new Set(pages)];
    sessionTraces.push({
      sessionId,
      eventCount: evs.length,
      pagesSequence: pages,
      uniquePages,
      startTime: evs[0]?.createdAt || evs[0]?.timestamp || null,
      endTime:
        evs[evs.length - 1]?.createdAt ||
        evs[evs.length - 1]?.timestamp ||
        null,
    });
  }

  return {
    userId,
    totalEvents: events.length,
    sessions: sessionTraces,
  };
}

/**
 * Cohort trace for users from a given city: common page sequences.
 *
 * @param {string} city
 * @param {{ limitUsers?: number, limitEvents?: number }} [params]
 */
export async function getCohortTraceByCity(city, params = {}) {
  const limitUsers = Math.min(
    Math.max(Number(params.limitUsers || 100), 1),
    1000
  );
  const limitEvents = Math.min(
    Math.max(Number(params.limitEvents || 2000), 1),
    10_000
  );

  // 1) Find users from this city (MySQL)
  const userRows = await mysqlQuery(
    `
    SELECT id
    FROM users
    WHERE city = ?
      AND is_active = 1
    LIMIT ?
  `,
    [city, limitUsers]
  );

  if (!userRows || userRows.length === 0) {
    return {
      city,
      userCount: 0,
      totalEvents: 0,
      topPaths: [],
    };
  }

  const userIds = userRows.map((r) => r.id);

  // 2) Fetch clickstream events for this cohort (Mongo)
  const conn = await getMongoConnection();
  const clickCol = conn.collection(CLICKSTREAM_COLLECTION_NAME);

  const events = await clickCol
    .find({ userId: { $in: userIds } })
    .sort({ userId: 1, sessionId: 1, createdAt: 1 })
    .limit(limitEvents)
    .toArray();

  // 3) Build per-session page sequences and count path patterns
  const sessionMap = new Map(); // key: `${userId}:${sessionId}` => [pages]

  for (const ev of events) {
    const uId = ev.userId || "unknown";
    const sId = ev.sessionId || "unknown";
    const key = `${uId}:${sId}`;
    const page = ev.page || ev.path || "unknown";

    if (!sessionMap.has(key)) {
      sessionMap.set(key, []);
    }
    sessionMap.get(key).push(page);
  }

  const pathCounts = new Map(); // sequence string => count

  for (const pages of sessionMap.values()) {
    if (!pages || pages.length === 0) continue;
    const sequence = pages.join(" → ");
    pathCounts.set(sequence, (pathCounts.get(sequence) || 0) + 1);
  }

  const topPaths = Array.from(pathCounts.entries())
    .map(([sequence, count]) => ({ sequence, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return {
    city,
    userCount: userIds.length,
    totalEvents: events.length,
    topPaths,
  };
}
