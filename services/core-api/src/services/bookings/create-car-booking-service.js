/**
 * @file create-car-booking-service.js
 * @description
 * Service for creating rental car bookings with transactional booking + billing.
 *
 * Flow:
 * - Validate payload (carId, pickup/dropoff dates, payment token).
 * - In a MySQL transaction:
 *    - Load & validate car listing is active.
 *    - Create booking header and car booking item.
 *    - (Optional future: enforce date-range availability at repo level.)
 *    - Call payment simulator.
 *    - Insert billing transaction row.
 *    - Update booking status.
 * - Emit booking.events to Kafka.
 */

import { runInTransaction } from "./transaction-helper.js";
import * as carsRepository from "../../repositories/mysql/cars-repository.js";
import * as bookingsRepository from "../../repositories/mysql/bookings-repository.js";
import * as billingRepository from "../../repositories/mysql/billing-repository.js";
import * as paymentSimulator from "../payments/payment-simulator-service.js";
import {
  publishBookingConfirmed,
  publishBookingFailed,
} from "../../kafka/booking-producer.js";

class BookingDomainError extends Error {
  constructor(code, message, details = {}, httpStatus = 400) {
    super(message || code);
    this.name = "BookingDomainError";
    this.code = code;
    this.details = details;
    this.httpStatus = httpStatus;
  }
}

function buildSuccess(message, data) {
  return {
    isSuccess: true,
    message,
    data,
  };
}

function buildError(errorCode, message, httpStatus) {
  return {
    isSuccess: false,
    message: message || errorCode,
    errorCode,
    ...(httpStatus ? { httpStatus } : {}),
  };
}

/**
 * @typedef {Object} CarBookingPayload
 * @property {string} carId
 * @property {string} pickupDate   - ISO date string (YYYY-MM-DD)
 * @property {string} dropoffDate  - ISO date string (YYYY-MM-DD)
 * @property {string} paymentMethodToken
 * @property {number|null} [expectedTotalPrice]
 * @property {string|null} [notes]
 */

/**
 * Create a car booking with transactional booking + billing.
 *
 * @param {string} userId
 * @param {CarBookingPayload} payload
 * @returns {Promise<import("./create-flight-booking-service.js").BookingServiceResult>}
 */
export async function createCarBookingService(userId, payload) {
  if (!userId) {
    return buildError(
      "invalid_user",
      "A valid userId is required to create a booking.",
      400
    );
  }

  if (!payload?.carId) {
    return buildError(
      "invalid_car_payload",
      "carId is required.",
      400
    );
  }

  if (!payload.pickupDate || !payload.dropoffDate) {
    return buildError(
      "invalid_date_range",
      "pickupDate and dropoffDate are required.",
      400
    );
  }

  if (!payload.paymentMethodToken) {
    return buildError(
      "missing_payment_method",
      "A paymentMethodToken is required to complete the booking.",
      400
    );
  }

  const pickup = new Date(payload.pickupDate);
  const dropoff = new Date(payload.dropoffDate);
  if (!(pickup < dropoff)) {
    return buildError(
      "invalid_date_range",
      "dropoffDate must be after pickupDate.",
      400
    );
  }

  const days =
    Math.max(
      1,
      Math.round(
        (dropoff.getTime() - pickup.getTime()) /
          (1000 * 60 * 60 * 24)
      )
    );

  let txResult = null;

  try {
    txResult = await runInTransaction(async (connection) => {
      // 1) Load car listing (and ensure active)
      const car = await carsRepository.findCarByIdForUpdate(
        connection,
        payload.carId
      );

      if (!car || !car.is_active) {
        throw new BookingDomainError(
          "car_not_found",
          "Car listing not found or inactive.",
          {},
          404
        );
      }

      const dailyPrice = Number(
        payload.expectedTotalPrice && days > 0
          ? payload.expectedTotalPrice / days
          : car.daily_price ?? car.dailyPrice
      );

      if (!Number.isFinite(dailyPrice) || dailyPrice <= 0) {
        throw new BookingDomainError(
          "invalid_price",
          "Unable to determine a valid daily price for this car.",
          {},
          400
        );
      }

      const totalAmount = dailyPrice * days;
      const currency = car.currency || "USD";

      // 2) Create booking header
      const booking = await bookingsRepository.createBooking(connection, {
        userId,
        status: "PENDING",
        totalAmount,
        currency,
        startDate: pickup,
        endDate: dropoff,
        notes: payload.notes || null,
      });

      // 3) Create booking item
      const bookingItem = await bookingsRepository.createBookingItem(
        connection,
        {
          bookingId: booking.id,
          itemType: "CAR",
          carId: car.id,
          flightId: null,
          hotelId: null,
          startDate: pickup,
          endDate: dropoff,
          quantity: days,
          unitPrice: dailyPrice,
          totalPrice: totalAmount,
          currency,
          metadata: {
            providerName: car.provider_name ?? car.providerName,
            carType: car.car_type ?? car.carType,
            model: car.model,
            modelYear: car.model_year ?? car.modelYear,
            requestedTotalPrice: payload.expectedTotalPrice ?? null,
          },
        }
      );

      // NOTE:
      // Inventory control for cars (e.g., preventing overlapping rentals
      // for the same car listing) can be implemented inside the
      // carsRepository as a future enhancement. For now we rely on
      // is_active only.

      // 4) Payment
      const paymentResult = await paymentSimulator.chargeCard({
        userId,
        amount: totalAmount,
        currency,
        token: payload.paymentMethodToken,
      });

      // 5) Billing transaction
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
        await bookingsRepository.updateBookingStatus(
          connection,
          booking.id,
          "FAILED"
        );

        throw new BookingDomainError(
          "payment_failed",
          "Payment failed during car booking.",
          {
            failureReason: paymentResult.errorType || "payment_failed",
            bookingId: booking.id,
          },
          402
        );
      }

      // 6) Confirm booking
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

    await publishBookingConfirmed(
      txResult.booking,
      [txResult.bookingItem],
      txResult.billing,
      userId,
      "createCarBookingService"
    );

    return buildSuccess("booking_created", {
      booking: txResult.booking,
      items: [txResult.bookingItem],
      billing: txResult.billing,
    });
  } catch (err) {
    if (err instanceof BookingDomainError) {
      try {
        const maybeBooking =
          txResult?.booking ?? err.details?.booking ?? null;
        await publishBookingFailed(
          maybeBooking,
          userId,
          err.code,
          "createCarBookingService"
        );
      } catch (eventErr) {
        // eslint-disable-next-line no-console
        console.error(
          "[bookings] Failed to publish car booking failure event:",
          eventErr
        );
      }

      // eslint-disable-next-line no-console
      console.warn(
        "[bookings] Car booking domain error:",
        err.code,
        err.message
      );

      return buildError(err.code, err.message, err.httpStatus);
    }

    // eslint-disable-next-line no-console
    console.error(
      "[bookings] Unexpected error while creating car booking:",
      err
    );

    try {
      await publishBookingFailed(
        txResult?.booking ?? null,
        userId,
        "internal_error",
        "createCarBookingService"
      );
    } catch (eventErr) {
      // eslint-disable-next-line no-console
      console.error(
        "[bookings] Failed to publish car booking failure event (internal):",
        eventErr
      );
    }

    return buildError(
      "internal_error",
      "An unexpected error occurred while creating the car booking.",
      500
    );
  }
}
