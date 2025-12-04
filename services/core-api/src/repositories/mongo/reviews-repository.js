/**
 * @file reviews-repository.js
 * @description
 * MongoDB repository for managing user reviews.
 * * Responsibilities:
 * - Create new reviews.
 * - List reviews for a specific listing (flight/hotel/car).
 * - List reviews by a specific user.
 * - Compute aggregated ratings (average + count) for listings.
 */

import { getMongoConnection } from "../../db/mongo.js";
import { createReviewModel } from "../../../../../db/schema/mongo/index.js";

/**
 * Get the Review model from the shared connection.
 * Ensures the model is registered on the active connection.
 * @returns {Promise<import("mongoose").Model>}
 */
async function getReviewModel() {
  const db = await getMongoConnection();
  return createReviewModel(db);
}

/**
 * Create a new review.
 * * @param {Object} data
 * * @param {string} data.userId
 * * @param {"FLIGHT"|"HOTEL"|"CAR"} data.listingType
 * * @param {string} data.listingId
 * * @param {string} [data.bookingId]
 * * @param {number} data.rating
 * * @param {string} [data.title]
 * * @param {string} [data.comment]
 * * @param {Date} [data.stayDate]
 * * @returns {Promise<Object>} Created review document
 */
export async function createReview(data) {
  const Review = await getReviewModel();
  const review = new Review({
    ...data,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  const saved = await review.save();
  return saved.toObject();
}

/**
 * Find reviews for a specific listing with pagination.
 * * @param {Object} params
 * * @param {string} params.listingType
 * * @param {string} params.listingId
 * * @param {number} [params.limit=20]
 * * @param {number} [params.offset=0]
 * * @returns {Promise<{ items: Object[], total: number }>}
 */
export async function findReviewsForListing({ listingType, listingId, limit = 20, offset = 0 }) {
  const Review = await getReviewModel();
  const query = { listingType, listingId };

  const [items, total] = await Promise.all([
    Review.find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean(),
    Review.countDocuments(query)
  ]);

  return { items, total };
}

/**
 * Find reviews authored by a specific user.
 * * @param {string} userId
 * * @param {number} [limit=50]
 * * @returns {Promise<Object[]>}
 */
export async function findReviewsByUser(userId, limit = 50) {
  const Review = await getReviewModel();
  return Review.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

/**
 * Aggregate rating statistics for a listing.
 * * @param {string} listingType
 * * @param {string} listingId
 * * @returns {Promise<{ average: number, count: number } | null>}
 */
export async function getAggregatedRating(listingType, listingId) {
  const Review = await getReviewModel();
  
  const result = await Review.aggregate([
    { $match: { listingType, listingId } },
    {
      $group: {
        _id: null,
        average: { $avg: "$rating" },
        count: { $sum: 1 }
      }
    }
  ]);

  if (!result || result.length === 0) {
    return null;
  }

  return {
    average: Number(result[0].average.toFixed(2)),
    count: result[0].count
  };
}