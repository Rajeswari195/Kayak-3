/**
 * @file listings-routes.js
 * @description
 * Express router for public listings search endpoints:
 *   - GET /search/flights
 *   - GET /search/hotels
 *   - GET /search/cars
 *
 * Responsibilities:
 * - Map HTTP paths to controller functions.
 * - Keep routing concerns separate from controller logic.
 *
 * Notes:
 * - This router is intentionally unauthenticated; these endpoints form the
 *   public metasearch surface of the application.
 * - The router should be mounted from `routes/index.js`, typically under
 *   a prefix such as `/api`.
 */



import { Router } from "express";
import {
  searchFlights,
  searchHotels,
  searchCars,
} from "../controllers/listings-controller.js";

const router = Router();

// Flight search (one-way / basic round-trip is handled by the controller).
router.get("/search/flights", searchFlights);

// Hotel search by city/state, price, stars, etc.
router.get("/search/hotels", searchHotels);

// Car search by pickup/dropoff, type, price, etc.
router.get("/search/cars", searchCars);

export default router;
