/**
 * @file create-flight-booking-service.js
 * @description
 * Service for creating flight bookings with transactional booking + billing.
 *
 * Flow:
 * - Validate basic payload (seats, flightId, paymentMethodToken).
 * - Use MySQL transaction to:
 *    - Lock flight row and verify availability.
 *    - Create booking header and booking item.
 *    - Decrement flight seats_available.
 *    - Call payment simulator.
 *    - Insert billing transaction row.
 *    - Update booking status (CONFIRMED on success).
 * - On success, emit BOOKING_CONFIRMED event to Kafka.
 * - On failure, rollback transaction and emit BOOKING_FAILED event.
 */

import { runInBookingTransaction } from "./transaction-helper.js";
import * as flightsRepository from "../../repositories/mysql/flights-repository.js";
import * as bookingsRepository from "../../repositories/mysql/bookings-repository.js";
import * as billingRepository from "../../repositories/mysql/billing-repository.js";
import * as paymentSimulator from "../payments/payment-simulator-service.js";
import {
  publishBookingConfirmed,
  publishBookingFailed,
} from "../../kafka/booking-producer.js";

/**
 * @typedef {Object} FlightBookingPayload
 * @property {string} flightId
 * @property {number} seats
 * @property {string|null} [cabinClass]
 * @property {string|null} [paymentMethodToken]
 * @property {number|null} [expectedTotalPrice]
 * @property {string|null} [notes]
 */

/**
 * @typedef {Object} BookingServiceSuccess
 * @property {true} isSuccess
 * @property {string} message
 * @property {{ booking: Object, items: Object[], billing: Object }} data
 */

/**
 * @typedef {Object} BookingServiceError
 * @property {false} isSuccess
 * @property {string} message
 * @property {string} errorCode
 * @property {number} [httpStatus]
 */

/**
 * @typedef {BookingServiceSuccess | BookingServiceError} BookingServiceResult
 */

/**
 * Domain error used inside booking transactions.
 */
class BookingDomainError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Object} [details]
   * @param {number} [httpStatus]
   */
  constructor(code, message, details = {}, httpStatus = 400) {
    super(message || code);
    this.name = "BookingDomainError";
    this.code = code;
    this.details = details;
    this.httpStatus = httpStatus;
  }
}

/**
 * Build a success result.
 *
 * @param {string} message
 * @param {Object} data
 * @returns {BookingServiceSuccess}
 */
function buildSuccess(message, data) {
  return {
    isSuccess: true,
    message,
    data,
  };
}

/**
 * Build an error result.
 *
 * @param {string} errorCode
 * @param {string} message
 * @param {number} [httpStatus]
 * @returns {BookingServiceError}
 */
function buildError(errorCode, message, httpStatus) {
  return {
    isSuccess: false,
    message: message || errorCode,
    errorCode,
    ...(httpStatus ? { httpStatus } : {}),
  };
}

/**
 * Create a flight booking with transactional booking + billing.
 *
 * @param {string} userId - Relational users.id
 * @param {FlightBookingPayload} payload
 * @returns {Promise<BookingServiceResult>}
 */
export async function createFlightBookingService(userId, payload) {
  if (!userId) {
    return buildError(
      "invalid_user",
      "A valid userId is required to create a booking.",
      400
    );
  }

  const seats = Number(payload?.seats ?? 1);
  if (!Number.isInteger(seats) || seats <= 0) {
    return buildError(
      "invalid_seat_count",
      "Seats must be a positive integer.",
      400
    );
  }

  if (!payload?.flightId) {
    return buildError(
      "invalid_flight_id",
      "A flightId is required to create a flight booking.",
      400
    );
  }

  if (!payload?.paymentMethodToken) {
    return buildError(
      "missing_payment_method",
      "A paymentMethodToken is required to complete the booking.",
      400
    );
  }

  /** @type {{ booking: any, bookingItem: any, billing: any } | null} */
  let txResult = null;

  try {
    txResult = await runInBookingTransaction("createFlightBooking", async (connection) => {
      // 1) Lock and load flight
      const flight = await flightsRepository.findFlightByIdForUpdate(
        connection,
        payload.flightId
      );

      if (!flight || !flight.is_active) {
        throw new BookingDomainError(
          "flight_not_found",
          "Flight not found or inactive.",
          {},
          404
        );
      }

      const seatsAvailable =
        flight.seats_available ?? flight.seatsAvailable ?? 0;

      if (seatsAvailable < seats) {
        throw new BookingDomainError(
          "no_inventory",
          "Not enough seats available for this flight.",
          { seatsRequested: seats, seatsAvailable },
          409
        );
      }

      const basePrice = Number(
        payload.expectedTotalPrice && seats > 0
          ? payload.expectedTotalPrice / seats
          : flight.base_price ?? flight.basePrice
      );

      if (!Number.isFinite(basePrice) || basePrice <= 0) {
        throw new BookingDomainError(
          "invalid_price",
          "Unable to determine a valid ticket price.",
          {},
          400
        );
      }

      const totalAmount = basePrice * seats;
      const currency = flight.currency || "USD";

      const departureTime =
        flight.departure_time ?? flight.departureTime ?? null;
      const arrivalTime =
        flight.arrival_time ?? flight.arrivalTime ?? null;

      const startDate = departureTime
        ? new Date(departureTime)
        : new Date();
      const endDate = arrivalTime ? new Date(arrivalTime) : startDate;

      // 2) Create booking header
      const booking = await bookingsRepository.createBooking(connection, {
        userId,
        status: "PENDING",
        totalAmount,
        currency,
        startDate,
        endDate,
        notes: payload.notes || null,
      });

      // 3) Create booking item
      const bookingItem = await bookingsRepository.createBookingItem(
        connection,
        {
          bookingId: booking.id,
          itemType: "FLIGHT",
          flightId: flight.id,
          hotelId: null,
          carId: null,
          startDate,
          endDate,
          quantity: seats,
          unitPrice: basePrice,
          totalPrice: totalAmount,
          currency,
          metadata: {
            cabinClass:
              payload.cabinClass ||
              flight.cabin_class ||
              flight.cabinClass ||
              "ECONOMY",
            seats,
            requestedTotalPrice: payload.expectedTotalPrice ?? null,
          },
        }
      );

      // 4) Decrement flight inventory
      await flightsRepository.decrementSeatsAvailable(connection, {
        flightId: flight.id,
        seats,
      });

      // 5) Call payment simulator
      const paymentResult = await paymentSimulator.chargeCard({
        userId,
        amount: totalAmount,
        currency,
        token: payload.paymentMethodToken,
      });

      // 6) Persist billing row
      const billing = await billingRepository.createBillingTransaction(
        connection,
        {
          bookingId: booking.id,
          userId,
          amount: totalAmount,
          currency,
          paymentMethod: "CARD",
          paymentToken: payload.paymentMethodToken,
          providerReference: paymentResult.providerRef ?? null,
          status: paymentResult.success ? "SUCCESS" : "FAILED",
          errorCode: paymentResult.success
            ? null
            : paymentResult.errorType || "payment_failed",
          rawResponse: paymentResult.rawResponse ?? null,
        }
      );

      if (!paymentResult.success) {
        // Mark booking as FAILED but allow transaction rollback
        await bookingsRepository.updateBookingStatus(
          connection,
          booking.id,
          "FAILED"
        );

        throw new BookingDomainError(
          "payment_failed",
          "Payment failed during flight booking.",
          {
            failureReason: paymentResult.errorType || "payment_failed",
            bookingId: booking.id,
          },
          402
        );
      }

      // 7) Mark booking as CONFIRMED
      await bookingsRepository.updateBookingStatus(
        connection,
        booking.id,
        "CONFIRMED"
      );

      return {
        booking,
        bookingItem,
        billing,
      };
    });

    // Transaction committed successfully
    await publishBookingConfirmed(
      txResult.booking,
      [txResult.bookingItem],
      txResult.billing,
      userId,
      "createFlightBookingService"
    );

    return buildSuccess("booking_created", {
      booking: txResult.booking,
      items: [txResult.bookingItem],
      billing: txResult.billing,
    });
  } catch (err) {
    if (err instanceof BookingDomainError) {
      // Domain-level failure during transaction
      // Best-effort event emission; safe even after rollback.
      try {
        const maybeBooking =
          txResult?.booking ?? err.details?.booking ?? null;
        await publishBookingFailed(
          maybeBooking,
          userId,
          err.code,
          "createFlightBookingService"
        );
      } catch (eventErr) {
        // eslint-disable-next-line no-console
        console.error(
          "[bookings] Failed to publish flight booking failure event:",
          eventErr
        );
      }

      // eslint-disable-next-line no-console
      console.warn(
        "[bookings] Flight booking domain error:",
        err.code,
        err.message
      );

      return buildError(err.code, err.message, err.httpStatus);
    }

    // Unexpected error
    // eslint-disable-next-line no-console
    console.error(
      "[bookings] Unexpected error while creating flight booking:",
      err
    );

    try {
      await publishBookingFailed(
        txResult?.booking ?? null,
        userId,
        "internal_error",
        "createFlightBookingService"
      );
    } catch (eventErr) {
      // eslint-disable-next-line no-console
      console.error(
        "[bookings] Failed to publish flight booking failure event (internal):",
        eventErr
      );
    }

    return buildError(
      "internal_error",
      "An unexpected error occurred while creating the flight booking.",
      500
    );
  }
}
