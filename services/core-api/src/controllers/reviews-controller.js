/**
 * @file reviews-controller.js
 * @description
 * HTTP controllers for Review operations.
 */

import {
  createReviewService,
  getReviewsForListingService,
  getMyReviewsService
} from "../services/reviews/reviews-service.js";

/**
 * POST /api/reviews
 * Submit a new review.
 */
export async function createReviewController(req, res, next) {
  try {
    const userId = req.user.id;
    const review = await createReviewService(userId, req.body);
    res.status(201).json({ success: true, review });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/reviews
 * List reviews. Supports two modes:
 * 1. ?my=true -> Get current user's reviews.
 * 2. ?listingType=...&listingId=... -> Get reviews for a listing (public).
 */
export async function getReviewsController(req, res, next) {
  try {
    // Mode 1: My reviews (Requires Auth)
    if (req.query.my === 'true') {
      if (!req.user) {
        return res.status(401).json({ code: "token_missing", message: "Authentication required." });
      }
      const reviews = await getMyReviewsService(req.user.id);
      return res.json({ items: reviews });
    }

    // Mode 2: Public listing reviews
    const result = await getReviewsForListingService(req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}