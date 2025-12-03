/**
 * @file client/src/features/bookings/components/car-booking-modal.jsx
 * @description Modal flow for booking a rental car.
 */

import React, { useState } from 'react';
import { bookCar } from '../api';
import { Modal } from '@/ui/modal';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import BookingStepper from './booking-stepper';
import StatusBanner from '@/components/status-banner';
import LoadingSpinner from '@/components/loading-spinner';
import { Car, CreditCard, Calendar, MapPin } from 'lucide-react';

export default function CarBookingModal({ isOpen, onClose, car, searchParams }) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const pickup = searchParams?.pickupDate;
  const dropoff = searchParams?.dropoffDate;
  
  const start = new Date(pickup);
  const end = new Date(dropoff);
  const days = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
  const totalPrice = (car?.dailyPrice || 0) * days;

  const handleBooking = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      await bookCar({
        carId: car.id,
        pickupLocation: searchParams.pickupLocation,
        dropoffLocation: searchParams.dropoffLocation,
        pickupDate: pickup,
        dropoffDate: dropoff,
        pricePerDay: car.dailyPrice,
        paymentMethodToken: `tok_${Math.random().toString(36).substr(2, 9)}`
      });
      setStep(3);
    } catch (err) {
      console.error("Car booking failed:", err);
      setError(err.message || "Booking failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!car) return null;

  const renderContent = () => {
    if (step === 1) {
      return (
        <div className="space-y-4">
          <div className="bg-muted/30 p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <h3 className="font-semibold text-lg">{car.make} {car.model}</h3>
              <span className="text-xs bg-background border px-2 py-1 rounded">{car.carType}</span>
            </div>
            <p className="text-sm text-muted-foreground">Provider: {car.providerName}</p>
            
            <div className="grid grid-cols-2 gap-2 text-sm mt-2">
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                <span>Pick-up: {searchParams.pickupLocation}</span>
              </div>
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                <span>Drop-off: {searchParams.dropoffLocation}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
               <Calendar className="h-3 w-3" />
               <span>{days} Day{days > 1 ? 's' : ''} rental</span>
            </div>

            <div className="border-t pt-2 mt-2 flex justify-between items-center">
              <span>Total</span>
              <span className="font-bold text-lg">{car.currency} {totalPrice.toFixed(2)}</span>
            </div>
          </div>
          <div className="flex justify-end pt-4">
            <Button onClick={() => setStep(2)}>Continue to Payment</Button>
          </div>
        </div>
      );
    }

    if (step === 2) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Payment Details (Simulated)</p>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Card Number</label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value="4242 4242 4242 4242" readOnly className="pl-9 font-mono bg-muted/50" />
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 text-yellow-800 text-xs p-3 rounded-md mt-2">
            Charge: <strong>{car.currency} {totalPrice.toFixed(2)}</strong>
          </div>

          {error && <StatusBanner status="error" message={error} />}

          <div className="flex justify-between pt-4">
            <Button variant="ghost" onClick={() => setStep(1)} disabled={isSubmitting}>Back</Button>
            <Button onClick={handleBooking} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <LoadingSpinner className="mr-2 h-4 w-4" />
                  Processing...
                </>
              ) : "Confirm Booking"}
            </Button>
          </div>
        </div>
      );
    }

    if (step === 3) {
      return (
        <div className="text-center space-y-4 py-6">
          <div className="h-16 w-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Car className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-bold">Success!</h3>
          <p className="text-muted-foreground">Your car reservation is confirmed.</p>
          <div className="pt-4">
            <Button onClick={onClose} variant="outline">Close</Button>
          </div>
        </div>
      );
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={() => { if(!isSubmitting) onClose(); }} 
      title={step === 3 ? "Reservation" : `Book Rental Car`}
    >
      {step < 3 && <BookingStepper currentStep={step} />}
      {renderContent()}
    </Modal>
  );
}