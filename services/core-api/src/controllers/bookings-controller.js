/**
 * @file bookings-controller.js
 * @description
 * HTTP controllers for booking creation and retrieval in the core-api service.
 *
 * Responsibilities:
 * - Accept and validate HTTP requests for booking-related operations.
 * - Delegate business logic to booking service layer functions.
 * - Map domain-level success/error results into HTTP responses and status codes.
 *
 * Endpoints covered:
 * - POST /bookings/flight   → createFlightBookingController
 * - POST /bookings/hotel    → createHotelBookingController
 * - POST /bookings/car      → createCarBookingController
 * - GET  /bookings          → getUserBookingsController (view past/current/future bookings)
 *
 * Design notes:
 * - All routes using these controllers MUST be protected with `requireAuth`
 *   so that `req.user` is populated by auth-middleware.
 * - Controllers perform lightweight input validation and then hand off to
 *   services that follow the ActionState pattern:
 *     { isSuccess: true, message: string, data: any }
 *     { isSuccess: false, message: string, data?: any }
 *
 * Assumptions:
 * - Booking services have the following signatures:
 *     createFlightBookingService(userId: string, payload: object)
 *     createHotelBookingService(userId: string, payload: object)
 *     createCarBookingService(userId: string, payload: object)
 *     getUserBookingsService(userId: string, scope: "past"|"current"|"future"|"all")
 * - Each service returns a standardized ActionState object and does not throw
 *   for normal domain failures (e.g., no inventory, payment failure).
 *
 * Error handling:
 * - Synchronous/async coding errors are forwarded to `next(err)` to be handled
 *   by the global error middleware.
 * - Domain-level failures reported via ActionState are mapped to HTTP status
 *   codes using `mapServiceErrorToHttpStatus`.
 */



import {
    createFlightBookingService
} from "../services/bookings/create-flight-booking-service.js";
import {
    createHotelBookingService
} from "../services/bookings/create-hotel-booking-service.js";
import {
    createCarBookingService
} from "../services/bookings/create-car-booking-service.js";
import {
    getUserBookingsService
} from "../services/bookings/get-user-bookings-service.js";

/**
 * Shape of the user object attached to Express Request by auth-middleware.
 *
 * @typedef {Object} AuthenticatedUser
 * @property {string} id - Internal user identifier (MySQL users.id).
 * @property {("USER"|"ADMIN")} role - Role for authorization checks.
 * @property {string} [email]
 * @property {string} [firstName]
 * @property {string} [lastName]
 */

/**
 * Shape of a generic ActionState from services.
 *
 * @typedef {Object} ActionState
 * @property {boolean} isSuccess
 * @property {string} message
 * @property {any} [data]
 */

/**
 * Map a domain-level error code to an HTTP status code.
 *
 * This function centralizes status-code decisions so we can keep the mapping
 * consistent across controllers that rely on ActionState `message` values as
 * error codes.
 *
 * Known codes:
 * - "validation_error" → 400
 * - "no_inventory"     → 409
 * - "payment_failed"   → 402
 * - "booking_not_found"→ 404
 * - "duplicate_booking"→ 409
 * - "internal_error"   → 500
 *
 * Any unknown or unrecognized code is treated as a 400 Bad Request to avoid
 * leaking internal details while still signaling a client-side issue.
 *
 * @param {string} code
 * @returns {number}
 */
function mapServiceErrorToHttpStatus(code) {
    const normalized = typeof code === "string" ? code : "";

    switch (normalized) {
        case "validation_error":
            return 400;
        case "no_inventory":
            return 409;
        case "payment_failed":
            // 402 Payment Required is semantically appropriate here.
            return 402;
        case "booking_not_found":
            return 404;
        case "duplicate_booking":
            return 409;
        case "internal_error":
            return 500;
        default:
            // Default to 400 for unknown domain errors.
            return 400;
    }
}

/**
 * Helper to build a standardized validation error response.
 *
 * @param {import("express").Response} res
 * @param {string[]} errors
 * @returns {import("express").Response}
 */
function respondValidationError(res, errors) {
    return res.status(400).json({
        isSuccess: false,
        message: "validation_error",
        details: {
            errors
        }
    });
}

/**
 * Validate the request body for a flight booking.
 *
 * Expected shape:
 * {
 *   "flightId": "uuid-or-id-string",
 *   "departureDate": "2025-06-01" | ISO string,
 *   "returnDate": "2025-06-08" | null | undefined,
 *   "class": "ECONOMY" | "BUSINESS" | "FIRST" | string,
 *   "seats": 1,
 *   "price": 350.0,
 *   "paymentMethodToken": "tok_xxx"
 * }
 *
 * Notes:
 * - Detailed business constraints (inventory, price validation, etc.) are
 *   handled by the booking service in combination with MySQL transactions.
 *
 * @param {any} body
 * @returns {{ isValid: boolean, errors: string[] }}
 */
function validateFlightBookingRequestBody(body) {
    const errors = [];

    if (!body || typeof body !== "object") {
        errors.push("Request body must be a JSON object.");
        return { isValid: false, errors };
    }

    if (!body.flightId || typeof body.flightId !== "string") {
        errors.push("Field 'flightId' is required and must be a string.");
    }

    if (!body.departureDate || typeof body.departureDate !== "string") {
        errors.push("Field 'departureDate' is required and must be a string.");
    } else if (Number.isNaN(Date.parse(body.departureDate))) {
        errors.push("Field 'departureDate' must be a valid date string.");
    }

    if (body.returnDate != null) {
        if (typeof body.returnDate !== "string") {
            errors.push("Field 'returnDate' must be a string when provided.");
        } else if (Number.isNaN(Date.parse(body.returnDate))) {
            errors.push("Field 'returnDate' must be a valid date string when provided.");
        } else {
            const dep = Date.parse(body.departureDate);
            const ret = Date.parse(body.returnDate);
            if (!Number.isNaN(dep) && ret < dep) {
                errors.push("Field 'returnDate' cannot be earlier than 'departureDate'.");
            }
        }
    }

    if (!body.class || typeof body.class !== "string") {
        errors.push("Field 'class' is required and must be a string.");
    }

    if (
        typeof body.seats !== "number" ||
        !Number.isFinite(body.seats) ||
        !Number.isInteger(body.seats) ||
        body.seats <= 0
    ) {
        errors.push(
            "Field 'seats' is required and must be a positive integer."
        );
    }

    if (
        typeof body.price !== "number" ||
        !Number.isFinite(body.price) ||
        body.price <= 0
    ) {
        errors.push(
            "Field 'price' is required and must be a positive number."
        );
    }

    if (
        !body.paymentMethodToken ||
        typeof body.paymentMethodToken !== "string"
    ) {
        errors.push(
            "Field 'paymentMethodToken' is required and must be a string."
        );
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Validate the request body for a hotel booking.
 *
 * Expected shape:
 * {
 *   "hotelId": "uuid-or-id-string",
 *   "roomType": "DELUXE" | "STANDARD" | string,
 *   "checkInDate": "2025-06-01",
 *   "checkOutDate": "2025-06-08",
 *   "pricePerNight": 150.0,
 *   "paymentMethodToken": "tok_xxx"
 * }
 *
 * @param {any} body
 * @returns {{ isValid: boolean, errors: string[] }}
 */
function validateHotelBookingRequestBody(body) {
    const errors = [];

    if (!body || typeof body !== "object") {
        errors.push("Request body must be a JSON object.");
        return { isValid: false, errors };
    }

    if (!body.hotelId || typeof body.hotelId !== "string") {
        errors.push("Field 'hotelId' is required and must be a string.");
    }

    if (!body.roomType || typeof body.roomType !== "string") {
        errors.push("Field 'roomType' is required and must be a string.");
    }

    if (!body.checkInDate || typeof body.checkInDate !== "string") {
        errors.push("Field 'checkInDate' is required and must be a string.");
    } else if (Number.isNaN(Date.parse(body.checkInDate))) {
        errors.push("Field 'checkInDate' must be a valid date string.");
    }

    if (!body.checkOutDate || typeof body.checkOutDate !== "string") {
        errors.push("Field 'checkOutDate' is required and must be a string.");
    } else if (Number.isNaN(Date.parse(body.checkOutDate))) {
        errors.push("Field 'checkOutDate' must be a valid date string.");
    } else {
        const checkIn = Date.parse(body.checkInDate);
        const checkOut = Date.parse(body.checkOutDate);
        if (!Number.isNaN(checkIn) && checkOut <= checkIn) {
            errors.push(
                "Field 'checkOutDate' must be later than 'checkInDate'."
            );
        }
    }

    if (
        typeof body.pricePerNight !== "number" ||
        !Number.isFinite(body.pricePerNight) ||
        body.pricePerNight <= 0
    ) {
        errors.push(
            "Field 'pricePerNight' is required and must be a positive number."
        );
    }

    if (
        !body.paymentMethodToken ||
        typeof body.paymentMethodToken !== "string"
    ) {
        errors.push(
            "Field 'paymentMethodToken' is required and must be a string."
        );
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Validate the request body for a car booking.
 *
 * Expected shape:
 * {
 *   "carId": "uuid-or-id-string",
 *   "pickupLocation": "SFO",
 *   "dropoffLocation": "SFO" | "LAX",
 *   "pickupDate": "2025-06-01",
 *   "dropoffDate": "2025-06-08",
 *   "pricePerDay": 55.0,
 *   "paymentMethodToken": "tok_xxx"
 * }
 *
 * Notes:
 * - The car availability, provider rules, etc. are enforced by the booking
 *   service and underlying repositories.
 *
 * @param {any} body
 * @returns {{ isValid: boolean, errors: string[] }}
 */
function validateCarBookingRequestBody(body) {
    const errors = [];

    if (!body || typeof body !== "object") {
        errors.push("Request body must be a JSON object.");
        return { isValid: false, errors };
    }

    if (!body.carId || typeof body.carId !== "string") {
        errors.push("Field 'carId' is required and must be a string.");
    }

    if (!body.pickupLocation || typeof body.pickupLocation !== "string") {
        errors.push("Field 'pickupLocation' is required and must be a string.");
    }

    if (!body.dropoffLocation || typeof body.dropoffLocation !== "string") {
        errors.push("Field 'dropoffLocation' is required and must be a string.");
    }

    if (!body.pickupDate || typeof body.pickupDate !== "string") {
        errors.push("Field 'pickupDate' is required and must be a string.");
    } else if (Number.isNaN(Date.parse(body.pickupDate))) {
        errors.push("Field 'pickupDate' must be a valid date string.");
    }

    if (!body.dropoffDate || typeof body.dropoffDate !== "string") {
        errors.push("Field 'dropoffDate' is required and must be a string.");
    } else if (Number.isNaN(Date.parse(body.dropoffDate))) {
        errors.push("Field 'dropoffDate' must be a valid date string.");
    } else {
        const pickup = Date.parse(body.pickupDate);
        const dropoff = Date.parse(body.dropoffDate);
        if (!Number.isNaN(pickup) && dropoff <= pickup) {
            errors.push(
                "Field 'dropoffDate' must be later than 'pickupDate'."
            );
        }
    }

    if (
        typeof body.pricePerDay !== "number" ||
        !Number.isFinite(body.pricePerDay) ||
        body.pricePerDay <= 0
    ) {
        errors.push(
            "Field 'pricePerDay' is required and must be a positive number."
        );
    }

    if (
        !body.paymentMethodToken ||
        typeof body.paymentMethodToken !== "string"
    ) {
        errors.push(
            "Field 'paymentMethodToken' is required and must be a string."
        );
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Controller: Create a flight booking for the authenticated user.
 *
 * Route: POST /bookings/flight
 *
 * Middleware requirements:
 * - Must be preceded by `requireAuth` so that `req.user` is populated.
 *
 * Behavior:
 * - Validates request body structure and basic constraints.
 * - Delegates to `createFlightBookingService(userId, payload)`.
 * - Returns the ActionState result with an appropriate HTTP status:
 *   - 201 on success (`isSuccess === true`).
 *   - 4xx/5xx on failure based on error code mapping.
 *
 * @param {import("express").Request & { user?: AuthenticatedUser }} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export async function createFlightBookingController(req, res, next) {
    try {
        const authUser = req.user;
        if (!authUser || !authUser.id) {
            // This should not occur if requireAuth is used correctly, but we guard
            // explicitly for defense in depth.
            return res.status(401).json({
                isSuccess: false,
                message: "token_missing"
            });
        }

        const { isValid, errors } = validateFlightBookingRequestBody(req.body);
        if (!isValid) {
            return respondValidationError(res, errors);
        }

        const payload = {
            flightId: req.body.flightId,
            departureDate: req.body.departureDate,
            returnDate: req.body.returnDate || null,
            class: req.body.class,
            seats: req.body.seats,
            price: req.body.price,
            paymentMethodToken: req.body.paymentMethodToken
        };

        /** @type {ActionState} */
        const result = await createFlightBookingService(authUser.id, payload);

        if (!result || typeof result.isSuccess !== "boolean") {
            // If the service does not follow the ActionState contract, treat this
            // as an internal error.
            return res.status(500).json({
                isSuccess: false,
                message: "internal_error"
            });
        }

        if (!result.isSuccess) {
            const status = mapServiceErrorToHttpStatus(result.message);
            return res.status(status).json(result);
        }

        // Creation succeeded.
        return res.status(201).json(result);
    } catch (err) {
        // Unexpected errors are passed to the centralized error handler.
        return next(err);
    }
}

/**
 * Controller: Create a hotel booking for the authenticated user.
 *
 * Route: POST /bookings/hotel
 *
 * Middleware requirements:
 * - Must be preceded by `requireAuth`.
 *
 * @param {import("express").Request & { user?: AuthenticatedUser }} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export async function createHotelBookingController(req, res, next) {
    try {
        const authUser = req.user;
        if (!authUser || !authUser.id) {
            return res.status(401).json({
                isSuccess: false,
                message: "token_missing"
            });
        }

        const { isValid, errors } = validateHotelBookingRequestBody(req.body);
        if (!isValid) {
            return respondValidationError(res, errors);
        }

        const payload = {
            hotelId: req.body.hotelId,
            roomType: req.body.roomType,
            checkInDate: req.body.checkInDate,
            checkOutDate: req.body.checkOutDate,
            pricePerNight: req.body.pricePerNight,
            paymentMethodToken: req.body.paymentMethodToken
        };

        /** @type {ActionState} */
        const result = await createHotelBookingService(authUser.id, payload);

        if (!result || typeof result.isSuccess !== "boolean") {
            return res.status(500).json({
                isSuccess: false,
                message: "internal_error"
            });
        }

        if (!result.isSuccess) {
            const status = mapServiceErrorToHttpStatus(result.message);
            return res.status(status).json(result);
        }

        return res.status(201).json(result);
    } catch (err) {
        return next(err);
    }
}

/**
 * Controller: Create a car booking for the authenticated user.
 *
 * Route: POST /bookings/car
 *
 * Middleware requirements:
 * - Must be preceded by `requireAuth`.
 *
 * @param {import("express").Request & { user?: AuthenticatedUser }} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export async function createCarBookingController(req, res, next) {
    try {
        const authUser = req.user;
        if (!authUser || !authUser.id) {
            return res.status(401).json({
                isSuccess: false,
                message: "token_missing"
            });
        }

        const { isValid, errors } = validateCarBookingRequestBody(req.body);
        if (!isValid) {
            return respondValidationError(res, errors);
        }

        const payload = {
            carId: req.body.carId,
            pickupLocation: req.body.pickupLocation,
            dropoffLocation: req.body.dropoffLocation,
            pickupDate: req.body.pickupDate,
            dropoffDate: req.body.dropoffDate,
            pricePerDay: req.body.pricePerDay,
            paymentMethodToken: req.body.paymentMethodToken
        };

        /** @type {ActionState} */
        const result = await createCarBookingService(authUser.id, payload);

        if (!result || typeof result.isSuccess !== "boolean") {
            return res.status(500).json({
                isSuccess: false,
                message: "internal_error"
            });
        }

        if (!result.isSuccess) {
            const status = mapServiceErrorToHttpStatus(result.message);
            return res.status(status).json(result);
        }

        return res.status(201).json(result);
    } catch (err) {
        return next(err);
    }
}

/**
 * Controller: Get bookings for the authenticated user.
 *
 * Route: GET /bookings?scope=past|current|future|all
 *
 * Query parameters:
 * - scope (optional): one of "past", "current", "future", "all" (default "all").
 *
 * Scope semantics (enforced by service / DB layer using UTC dates):
 * - past:   booking end date < today
 * - current: booking start date <= today <= end date
 * - future: booking start date > today
 * - all:   no scope filter; return all user bookings
 *
 * Middleware requirements:
 * - Must be preceded by `requireAuth`.
 *
 * @param {import("express").Request & { user?: AuthenticatedUser }} req
 * @param {import("express").Response} res
 * @param {import("express").NextFunction} next
 */
export async function getUserBookingsController(req, res, next) {
    try {
        const authUser = req.user;
        if (!authUser || !authUser.id) {
            return res.status(401).json({
                isSuccess: false,
                message: "token_missing"
            });
        }

        const rawScope =
            typeof req.query.scope === "string"
                ? req.query.scope.toLowerCase()
                : "all";

        /** @type {Array<"past"|"current"|"future"|"all">} */
        const allowedScopes = ["past", "current", "future", "all"];

        if (!allowedScopes.includes(/** @type {any} */(rawScope))) {
            return respondValidationError(res, [
                `Query parameter 'scope' must be one of ${allowedScopes.join(
                    ", "
                )}.`
            ]);
        }

        /** @type {"past"|"current"|"future"|"all"} */
        const scope = /** @type {any} */ (rawScope);

        /** @type {ActionState} */
        const result = await getUserBookingsService(authUser.id, scope);

        if (!result || typeof result.isSuccess !== "boolean") {
            return res.status(500).json({
                isSuccess: false,
                message: "internal_error"
            });
        }

        if (!result.isSuccess) {
            const status = mapServiceErrorToHttpStatus(result.message);
            return res.status(status).json(result);
        }

        // For retrieval, success is 200 OK.
        return res.status(200).json(result);
    } catch (err) {
        return next(err);
    }
}
