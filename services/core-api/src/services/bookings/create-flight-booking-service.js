/**
 * @file create-flight-booking-service.js
 */

import { randomUUID } from "node:crypto";
import { runInBookingTransaction } from "./transaction-helper.js";
import * as flightsRepository from "../../repositories/mysql/flights-repository.js";
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
  return { isSuccess: true, message, data };
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
  return `KYK-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

export async function createFlightBookingService(userId, payload) {
  if (!userId) return buildError("invalid_user", "A valid userId is required.", 400);
  
  const seats = Number(payload?.seats ?? 1);
  if (!Number.isInteger(seats) || seats <= 0) return buildError("invalid_seat_count", "Seats must be a positive integer.", 400);
  if (!payload?.flightId) return buildError("invalid_flight_id", "A flightId is required.", 400);
  if (!payload?.paymentMethodToken) return buildError("missing_payment_method", "Payment token required.", 400);

  let txResult = null;

  try {
    txResult = await runInBookingTransaction("createFlightBooking", async (connection) => {
      // 1) Lock and load flight
      const flight = await flightsRepository.findFlightByIdForUpdate(connection, payload.flightId);

      if (!flight || !flight.is_active) {
        throw new BookingDomainError("flight_not_found", "Flight not found or inactive.", {}, 404);
      }

      const seatsAvailable = flight.seats_available ?? flight.seatsAvailable ?? 0;

      if (seatsAvailable < seats) {
        throw new BookingDomainError("no_inventory", "Not enough seats available.", { seatsRequested: seats, seatsAvailable }, 409);
      }

      const basePrice = Number(
        payload.expectedTotalPrice && seats > 0
          ? payload.expectedTotalPrice / seats
          : flight.base_price ?? flight.basePrice
      );

      const totalAmount = basePrice * seats;
      const currency = flight.currency || "USD";
      const departureTime = flight.departure_time ?? flight.departureTime ?? null;
      const arrivalTime = flight.arrival_time ?? flight.arrivalTime ?? null;
      const startDate = departureTime ? new Date(departureTime) : new Date();
      const endDate = arrivalTime ? new Date(arrivalTime) : startDate;

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
          startDate,
          endDate,
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
            cabinClass: payload.cabinClass || flight.cabin_class || flight.cabinClass || "ECONOMY",
            seats,
            requestedTotalPrice: payload.expectedTotalPrice ?? null,
          },
        },
        connection
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
          errorCode: paymentResult.success ? null : paymentResult.errorType || "payment_failed",
          rawResponse: paymentResult.rawResponse ?? null,
        },
        connection
      );

      if (!paymentResult.success) {
        await bookingsRepository.updateBookingStatus(booking.id, "FAILED", undefined, connection);
        throw new BookingDomainError("payment_failed", "Payment failed.", { failureReason: paymentResult.errorType, bookingId: booking.id }, 402);
      }

      // 7) Mark booking as CONFIRMED
      await bookingsRepository.updateBookingStatus(booking.id, "CONFIRMED", undefined, connection);

      return { booking, bookingItem, billing };
    });

    await publishBookingConfirmed(txResult.booking, [txResult.bookingItem], txResult.billing, userId, "createFlightBookingService");
    return buildSuccess("booking_created", { booking: txResult.booking, items: [txResult.bookingItem], billing: txResult.billing });

  } catch (err) {
    if (err instanceof BookingDomainError) {
      try {
        const maybeBooking = txResult?.booking ?? err.details?.booking ?? null;
        await publishBookingFailed(maybeBooking, userId, err.code, "createFlightBookingService");
      } catch (e) { console.error(e); }
      return buildError(err.code, err.message, err.httpStatus);
    }
    console.error(err);
    try { await publishBookingFailed(txResult?.booking ?? null, userId, "internal_error", "createFlightBookingService"); } catch (e) {}
    return buildError("internal_error", "Unexpected error.", 500);
  }
}