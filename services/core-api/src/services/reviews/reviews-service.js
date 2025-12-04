/**
 * @file reviews-service.js
 * @description
 * Business logic for user reviews.
 * * Responsibilities:
 * - Validate review payloads.
 * - Persist reviews to MongoDB.
 * - Update the SQL listing table with new aggregated ratings (denormalization).
 * - Enrich "My Reviews" with human-readable listing names (e.g., Hotel Name).
 */

import * as reviewsRepository from "../../repositories/mongo/reviews-repository.js";
import { mysqlQuery } from "../../db/mysql.js";
import { findHotelById } from "../../repositories/mysql/hotels-repository.js";
import { findFlightById } from "../../repositories/mysql/flights-repository.js";
import { findCarById } from "../../repositories/mysql/cars-repository.js";
import { ValidationError, ConflictError } from "../../lib/errors.js";

/**
 * Map listing type to SQL table name for denormalization.
 */
const TABLE_MAP = {
  FLIGHT: "flights",
  HOTEL: "hotels",
  CAR: "cars"
};

/**
 * Create a review and update the parent listing's aggregated stats.
 * * @param {string} userId
 * * @param {Object} payload
 * * @returns {Promise<Object>} The created review.
 */
export async function createReviewService(userId, payload) {
  const { listingType, listingId, rating, title, comment, bookingId } = payload;

  if (!listingType || !listingId || !rating) {
    throw new ValidationError("listingType, listingId, and rating are required.");
  }

  if (rating < 1 || rating > 5) {
    throw new ValidationError("Rating must be an integer between 1 and 5.");
  }

  // 1. Create Review in Mongo
  let review;
  try {
    review = await reviewsRepository.createReview({
      userId,
      listingType,
      listingId,
      bookingId: bookingId || null,
      rating,
      title,
      comment,
      stayDate: new Date() // simplistic default; ideally comes from booking data
    });
  } catch (err) {
    if (err.code === 11000) { // Mongo duplicate key error
      throw new ConflictError("You have already reviewed this listing.");
    }
    throw err;
  }

  // 2. Compute new aggregates (Average + Count)
  const stats = await reviewsRepository.getAggregatedRating(listingType, listingId);

  // 3. Denormalize to MySQL
  // We update the SQL table so that sorting by "rating" or "stars" in search results is fast.
  if (stats && TABLE_MAP[listingType]) {
    const table = TABLE_MAP[listingType];
    // Safe SQL construction due to strict enum usage in TABLE_MAP
    const sql = `UPDATE ${table} SET rating_avg = ?, rating_count = ? WHERE id = ?`;
    await mysqlQuery(sql, [stats.average, stats.count, listingId]);
  }

  return review;
}

/**
 * Get reviews for a specific listing (Public view).
 * * @param {Object} query
 * @returns {Promise<Object>} Paginated reviews.
 */
export async function getReviewsForListingService(query) {
  const { listingType, listingId, page = 1, pageSize = 20 } = query;

  if (!listingType || !listingId) {
    throw new ValidationError("listingType and listingId are required.");
  }

  const limit = Math.min(Math.max(Number(pageSize), 1), 100);
  const offset = (Math.max(Number(page), 1) - 1) * limit;

  const result = await reviewsRepository.findReviewsForListing({
    listingType,
    listingId,
    limit,
    offset
  });

  return {
    ...result,
    page: Number(page),
    pageSize: limit
  };
}

/**
 * Get reviews authored by the current user AND enrich them with listing names.
 * This allows the frontend to show "Hilton SF" instead of "UUID-123".
 * * @param {string} userId
 * * @returns {Promise<Object[]>}
 */
export async function getMyReviewsService(userId) {
  // 1. Fetch raw reviews from Mongo
  const reviews = await reviewsRepository.findReviewsByUser(userId);

  // 2. Enrich with listing details (Name/Title) from MySQL
  // We use Promise.all to fetch details in parallel.
  const enrichedReviews = await Promise.all(reviews.map(async (review) => {
    let listingName = review.listingId; // Default fallback to ID if not found

    try {
      if (review.listingType === 'HOTEL') {
        const hotel = await findHotelById(review.listingId);
        if (hotel) listingName = hotel.name;
      } 
      else if (review.listingType === 'FLIGHT') {
        const flight = await findFlightById(review.listingId);
        if (flight) listingName = `${flight.airline} ${flight.flightNumber}`;
      } 
      else if (review.listingType === 'CAR') {
        const car = await findCarById(review.listingId);
        if (car) listingName = `${car.make} ${car.model}`;
      }
    } catch (err) {
      // If a listing is deleted or DB fails, just keep the ID.
      console.warn(`[ReviewsService] Failed to fetch details for ${review.listingType} ${review.listingId}`);
    }

    return {
      ...review,
      listingName
    };
  }));

  return enrichedReviews;
}