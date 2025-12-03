/**
 * @file create-hotel-booking-service.js
 * @description
 * Service for creating hotel bookings with transactional booking + billing.
 */

import { randomUUID } from "node:crypto";
import { runInBookingTransaction } from "./transaction-helper.js";
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

function generateBookingReference() {
  // Simple human-readable reference: KYK-RANDOM
  return `KYK-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

export async function createHotelBookingService(userId, payload) {
  if (!userId) {
    return buildError("invalid_user", "A valid userId is required.", 400);
  }

  if (!payload?.hotelId || !payload?.roomType) {
    return buildError("invalid_hotel_payload", "hotelId and roomType are required.", 400);
  }

  if (!payload.checkInDate || !payload.checkOutDate) {
    return buildError("invalid_date_range", "Both checkInDate and checkOutDate are required.", 400);
  }

  if (!payload.paymentMethodToken) {
    return buildError("missing_payment_method", "Payment token required.", 400);
  }

  const rooms = Number(payload.rooms ?? 1);
  if (!Number.isInteger(rooms) || rooms <= 0) {
    return buildError("invalid_room_count", "rooms must be a positive integer.", 400);
  }

  const checkIn = new Date(payload.checkInDate);
  const checkOut = new Date(payload.checkOutDate);
  if (!(checkIn < checkOut)) {
    return buildError("invalid_date_range", "checkOutDate must be after checkInDate.", 400);
  }

  const nights = Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));

  let txResult = null;

  try {
    txResult = await runInBookingTransaction("createHotelBooking", async (connection) => {
      // 1) Lock hotel room inventory
      let room;
      if (payload.roomType === 'STANDARD') {
        room = await hotelsRepository.findAnyAvailableRoomTypeForUpdate(connection, payload.hotelId);
      } else {
        room = await hotelsRepository.findHotelRoomByHotelAndTypeForUpdate(
          connection,
          {
            hotelId: payload.hotelId,
            roomType: payload.roomType,
          }
        );
      }

      if (!room || !room.is_active) {
        throw new BookingDomainError("room_not_found", "Requested room type not found or inactive.", {}, 404);
      }

      const roomsAvailable = room.rooms_available ?? room.roomsAvailable ?? 0;

      if (roomsAvailable < rooms) {
        throw new BookingDomainError(
          "no_inventory",
          "Not enough rooms available.",
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
        throw new BookingDomainError("invalid_price", "Unable to determine a valid room price.", {}, 400);
      }

      const totalAmount = nightlyPrice * nights * rooms;
      const currency = room.currency || "USD";

      // 2) Create booking header
      const bookingId = randomUUID();
      const bookingReference = generateBookingReference();

      const booking = await bookingsRepository.createBooking(
        {
          id: bookingId,
          userId,
          bookingReference,
          status: "PENDING",
          totalAmount,
          currency,
          startDate: checkIn,
          endDate: checkOut,
          notes: payload.notes || null,
        },
        connection
      );

      // 3) Create booking item
      const itemId = randomUUID();
      const bookingItem = await bookingsRepository.createBookingItem(
        {
          id: itemId,
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
        },
        connection
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
      const billingId = randomUUID();
      const billing = await billingRepository.insertBillingTransaction(
        {
          id: billingId,
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
        },
        connection
      );

      if (!paymentResult.success) {
        await bookingsRepository.updateBookingStatus(
          booking.id,
          "FAILED",
          undefined,
          connection
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
        booking.id,
        "CONFIRMED",
        undefined,
        connection
      );

      return {
        booking,
        bookingItem,
        billing,
      };
    });

    try {
      await publishBookingConfirmed(
        txResult.booking,
        [txResult.bookingItem],
        txResult.billing,
        userId,
        "createHotelBookingService"
      );
    } catch (kafkaErr) {
      console.warn("[bookings] Failed to publish booking confirmation event:", kafkaErr.message);
    }

    return buildSuccess("booking_created", {
      booking: txResult.booking,
      items: [txResult.bookingItem],
      billing: txResult.billing,
    });
  } catch (err) {
    if (err instanceof BookingDomainError) {
      try {
        const maybeBooking = txResult?.booking ?? err.details?.booking ?? null;
        await publishBookingFailed(maybeBooking, userId, err.code, "createHotelBookingService");
      } catch (eventErr) {
        console.error("[bookings] Failed to publish hotel booking failure event:", eventErr);
      }
      return buildError(err.code, err.message, err.httpStatus);
    }

    console.error("[bookings] Unexpected error while creating hotel booking:", err);
    try {
      await publishBookingFailed(txResult?.booking ?? null, userId, "internal_error", "createHotelBookingService");
    } catch (eventErr) {
      console.error("[bookings] Failed to publish hotel booking failure event (internal):", eventErr);
    }

    return buildError("internal_error", "An unexpected error occurred.", 500);
  }
}