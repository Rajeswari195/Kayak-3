/**
 * @file create-hotel-booking-service.js
 * @description
 * Service for creating hotel bookings with transactional booking + billing.
 *
 * Flow:
 * - Validate payload (hotelId, roomType, check-in/out, payment token).
 * - In a MySQL transaction:
 *    - Lock hotel room row and verify rooms_available.
 *    - Create booking header and hotel booking item.
 *    - Decrement rooms_available.
 *    - Call payment simulator.
 *    - Insert billing transaction row.
 *    - Update booking status.
 * - Emit booking.events to Kafka.
 */

import { runInTransaction } from "./transaction-helper.js";
import * as hotelsRepository from "../../repositories/mysql/hotels-repository.js";
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
 * @typedef {Object} HotelBookingPayload
 * @property {string} hotelId
 * @property {string} roomType
 * @property {string} checkInDate  - ISO date string (YYYY-MM-DD)
 * @property {string} checkOutDate - ISO date string (YYYY-MM-DD)
 * @property {number} [rooms]      - default 1
 * @property {string} paymentMethodToken
 * @property {number|null} [expectedTotalPrice]
 * @property {string|null} [notes]
 */

/**
 * Create a hotel booking with transactional booking + billing.
 *
 * @param {string} userId
 * @param {HotelBookingPayload} payload
 * @returns {Promise<import("./create-flight-booking-service.js").BookingServiceResult>}
 */
export async function createHotelBookingService(userId, payload) {
  if (!userId) {
    return buildError(
      "invalid_user",
      "A valid userId is required to create a booking.",
      400
    );
  }

  if (!payload?.hotelId || !payload?.roomType) {
    return buildError(
      "invalid_hotel_payload",
      "hotelId and roomType are required.",
      400
    );
  }

  if (!payload.checkInDate || !payload.checkOutDate) {
    return buildError(
      "invalid_date_range",
      "Both checkInDate and checkOutDate are required.",
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

  const rooms = Number(payload.rooms ?? 1);
  if (!Number.isInteger(rooms) || rooms <= 0) {
    return buildError(
      "invalid_room_count",
      "rooms must be a positive integer.",
      400
    );
  }

  const checkIn = new Date(payload.checkInDate);
  const checkOut = new Date(payload.checkOutDate);
  if (!(checkIn < checkOut)) {
    return buildError(
      "invalid_date_range",
      "checkOutDate must be after checkInDate.",
      400
    );
  }

  const nights =
    Math.max(
      1,
      Math.round(
        (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
      )
    );

  let txResult = null;

  try {
    txResult = await runInTransaction(async (connection) => {
      // 1) Lock hotel room inventory
      const room =
        await hotelsRepository.findHotelRoomByHotelAndTypeForUpdate(
          connection,
          {
            hotelId: payload.hotelId,
            roomType: payload.roomType,
          }
        );

      if (!room || !room.is_active) {
        throw new BookingDomainError(
          "room_not_found",
          "Requested room type not found or inactive.",
          {},
          404
        );
      }

      const roomsAvailable =
        room.rooms_available ?? room.roomsAvailable ?? 0;

      if (roomsAvailable < rooms) {
        throw new BookingDomainError(
          "no_inventory",
          "Not enough rooms available for this room type.",
          { roomsRequested: rooms, roomsAvailable },
          409
        );
      }

      const nightlyPrice = Number(
        payload.expectedTotalPrice && nights > 0 && rooms > 0
          ? payload.expectedTotalPrice / (nights * rooms)
          : room.base_price_per_night ?? room.basePricePerNight
      );

      if (!Number.isFinite(nightlyPrice) || nightlyPrice <= 0) {
        throw new BookingDomainError(
          "invalid_price",
          "Unable to determine a valid room price.",
          {},
          400
        );
      }

      const totalAmount = nightlyPrice * nights * rooms;
      const currency = room.currency || "USD";

      // 2) Create booking header
      const booking = await bookingsRepository.createBooking(connection, {
        userId,
        status: "PENDING",
        totalAmount,
        currency,
        startDate: checkIn,
        endDate: checkOut,
        notes: payload.notes || null,
      });

      // 3) Create booking item
      const bookingItem = await bookingsRepository.createBookingItem(
        connection,
        {
          bookingId: booking.id,
          itemType: "HOTEL",
          hotelId: payload.hotelId,
          flightId: null,
          carId: null,
          startDate: checkIn,
          endDate: checkOut,
          quantity: nights * rooms,
          unitPrice: nightlyPrice,
          totalPrice: totalAmount,
          currency,
          metadata: {
            roomType: payload.roomType,
            nights,
            rooms,
            requestedTotalPrice: payload.expectedTotalPrice ?? null,
          },
        }
      );

      // 4) Decrement room inventory
      await hotelsRepository.decrementRoomsAvailable(connection, {
        hotelRoomId: room.id,
        rooms,
      });

      // 5) Payment
      const paymentResult = await paymentSimulator.chargeCard({
        userId,
        amount: totalAmount,
        currency,
        token: payload.paymentMethodToken,
      });

      // 6) Billing transaction
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
          "Payment failed during hotel booking.",
          {
            failureReason: paymentResult.errorType || "payment_failed",
            bookingId: booking.id,
          },
          402
        );
      }

      // 7) Mark booking confirmed
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
      "createHotelBookingService"
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
          "createHotelBookingService"
        );
      } catch (eventErr) {
        // eslint-disable-next-line no-console
        console.error(
          "[bookings] Failed to publish hotel booking failure event:",
          eventErr
        );
      }

      // eslint-disable-next-line no-console
      console.warn(
        "[bookings] Hotel booking domain error:",
        err.code,
        err.message
      );

      return buildError(err.code, err.message, err.httpStatus);
    }

    // eslint-disable-next-line no-console
    console.error(
      "[bookings] Unexpected error while creating hotel booking:",
      err
    );

    try {
      await publishBookingFailed(
        txResult?.booking ?? null,
        userId,
        "internal_error",
        "createHotelBookingService"
      );
    } catch (eventErr) {
      // eslint-disable-next-line no-console
      console.error(
        "[bookings] Failed to publish hotel booking failure event (internal):",
        eventErr
      );
    }

    return buildError(
      "internal_error",
      "An unexpected error occurred while creating the hotel booking.",
      500
    );
  }
}
