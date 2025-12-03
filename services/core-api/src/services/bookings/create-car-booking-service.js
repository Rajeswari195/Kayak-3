/**
 * @file create-car-booking-service.js
 */

import { randomUUID } from "node:crypto";
import { runInBookingTransaction } from "./transaction-helper.js";
import * as carsRepository from "../../repositories/mysql/cars-repository.js";
import * as bookingsRepository from "../../repositories/mysql/bookings-repository.js";
import * as billingRepository from "../../repositories/mysql/billing-repository.js";
import * as paymentSimulator from "../payments/payment-simulator-service.js";
import { publishBookingConfirmed, publishBookingFailed } from "../../kafka/booking-producer.js";

class BookingDomainError extends Error {
  constructor(code, message, details = {}, httpStatus = 400) {
    super(message || code);
    this.name = "BookingDomainError";
    this.code = code;
    this.details = details;
    this.httpStatus = httpStatus;
  }
}

function buildSuccess(message, data) { return { isSuccess: true, message, data }; }
function buildError(errorCode, message, httpStatus) { return { isSuccess: false, message: message || errorCode, errorCode, ...(httpStatus ? { httpStatus } : {}) }; }

function generateBookingReference() {
  return `KYK-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

export async function createCarBookingService(userId, payload) {
  if (!userId) return buildError("invalid_user", "Valid userId required.", 400);
  if (!payload?.carId) return buildError("invalid_car_payload", "carId required.", 400);
  if (!payload.pickupDate || !payload.dropoffDate) return buildError("invalid_date_range", "Dates required.", 400);
  if (!payload.paymentMethodToken) return buildError("missing_payment_method", "Payment token required.", 400);

  const pickup = new Date(payload.pickupDate);
  const dropoff = new Date(payload.dropoffDate);
  if (!(pickup < dropoff)) return buildError("invalid_date_range", "Dropoff must be after pickup.", 400);

  const days = Math.max(1, Math.round((dropoff.getTime() - pickup.getTime()) / (1000 * 60 * 60 * 24)));
  let txResult = null;

  try {
    txResult = await runInBookingTransaction("createCarBooking", async (connection) => {
      // 1) Load car listing (lock)
      const car = await carsRepository.findCarByIdForUpdate(connection, payload.carId);

      if (!car || !car.is_active) throw new BookingDomainError("car_not_found", "Car not found/inactive.", {}, 404);

      const dailyPrice = Number(payload.expectedTotalPrice && days > 0 ? payload.expectedTotalPrice / days : car.daily_price ?? car.dailyPrice);
      if (!Number.isFinite(dailyPrice) || dailyPrice <= 0) throw new BookingDomainError("invalid_price", "Invalid price.", {}, 400);

      const totalAmount = dailyPrice * days;
      const currency = car.currency || "USD";

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
          startDate: pickup,
          endDate: dropoff,
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
          metadata: { providerName: car.provider_name ?? car.providerName, carType: car.car_type ?? car.carType, model: car.model, modelYear: car.model_year ?? car.modelYear },
        },
        connection
      );

      // 4) Payment
      const paymentResult = await paymentSimulator.chargeCard({ userId, amount: totalAmount, currency, token: payload.paymentMethodToken });

      // 5) Billing
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

      // 6) Confirm
      await bookingsRepository.updateBookingStatus(booking.id, "CONFIRMED", undefined, connection);

      return { booking, bookingItem, billing };
    });

    await publishBookingConfirmed(txResult.booking, [txResult.bookingItem], txResult.billing, userId, "createCarBookingService");
    return buildSuccess("booking_created", { booking: txResult.booking, items: [txResult.bookingItem], billing: txResult.billing });

  } catch (err) {
    if (err instanceof BookingDomainError) {
      try { await publishBookingFailed(txResult?.booking ?? null, userId, err.code, "createCarBookingService"); } catch (e) {}
      return buildError(err.code, err.message, err.httpStatus);
    }
    console.error(err);
    try { await publishBookingFailed(txResult?.booking ?? null, userId, "internal_error", "createCarBookingService"); } catch (e) {}
    return buildError("internal_error", "Unexpected error.", 500);
  }
}