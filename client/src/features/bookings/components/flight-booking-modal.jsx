/**
 * @file client/src/features/bookings/components/flight-booking-modal.jsx
 * @description Modal flow for booking a flight.
 * * Steps:
 * 1. Review: Confirm flight details and travelers.
 * 2. Payment: Enter payment info (Simulated).
 * 3. Confirmation: Success message.
 */

import React, { useState } from 'react';
import { useAuth } from '@/features/auth/use-auth';
import { bookFlight } from '../api';
import { Modal } from '@/ui/modal';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import BookingStepper from './booking-stepper';
import StatusBanner from '@/components/status-banner';
import LoadingSpinner from '@/components/loading-spinner';
import { Plane, CreditCard, Calendar } from 'lucide-react';

export default function FlightBookingModal({ isOpen, onClose, flight, searchParams }) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  
  // Parse params
  const passengers = parseInt(searchParams?.passengers || '1', 10);
  const totalPrice = (flight?.basePrice || 0) * passengers;

  const [paymentDetails, setPaymentDetails] = useState({
    cardNumber: '4242424242424242', // Pre-filled for demo convenience
    expiry: '12/28',
    cvc: '123'
  });

  const handleBooking = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      await bookFlight({
        flightId: flight.id,
        departureDate: flight.departureTime, // Use actual timestamp from object
        returnDate: null, // Basic flow assumes one-way logic per flight leg for now
        class: flight.cabinClass || 'ECONOMY',
        seats: passengers,
        price: flight.basePrice, // Sending unit price as 'price' to satisfy validator
        paymentMethodToken: `tok_${Math.random().toString(36).substr(2, 9)}`
      });
      setStep(3); // Move to success
    } catch (err) {
      console.error("Booking failed:", err);
      setError(err.message || "Booking failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderContent = () => {
    if (step === 1) {
      return (
        <div className="space-y-4">
          <div className="bg-muted/30 p-4 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-lg">{flight.airline}</span>
              <span className="text-sm text-muted-foreground">{flight.flightNumber}</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Plane className="h-4 w-4" />
                <span>{flight.originAirportId} → {flight.destinationAirportId}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{new Date(flight.departureTime).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="border-t pt-2 mt-2 flex justify-between items-center">
              <span>{passengers} Passenger(s)</span>
              <span className="font-bold text-lg">{flight.currency} {totalPrice.toFixed(2)}</span>
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
          <p className="text-sm text-muted-foreground">
            Enter your payment details. (This is a simulation, use the pre-filled test card).
          </p>
          
          <div className="grid gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Card Number</label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  value={paymentDetails.cardNumber} 
                  onChange={e => setPaymentDetails({...paymentDetails, cardNumber: e.target.value})}
                  className="pl-9 font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Expiry</label>
                <Input 
                  value={paymentDetails.expiry} 
                  onChange={e => setPaymentDetails({...paymentDetails, expiry: e.target.value})}
                  placeholder="MM/YY"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">CVC</label>
                <Input 
                  value={paymentDetails.cvc} 
                  onChange={e => setPaymentDetails({...paymentDetails, cvc: e.target.value})}
                  type="password"
                />
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 text-yellow-800 text-xs p-3 rounded-md mt-2">
            <strong>Note:</strong> Total amount of <strong>{flight.currency} {totalPrice.toFixed(2)}</strong> will be charged.
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
              ) : (
                "Pay & Book"
              )}
            </Button>
          </div>
        </div>
      );
    }

    if (step === 3) {
      return (
        <div className="text-center space-y-4 py-6">
          <div className="h-16 w-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Plane className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-bold text-foreground">Booking Confirmed!</h3>
          <p className="text-muted-foreground">
            Your flight to {flight.destinationAirportId} has been booked successfully.
          </p>
          <div className="pt-4">
            <Button onClick={onClose} variant="outline" className="min-w-[120px]">
              Close
            </Button>
          </div>
        </div>
      );
    }
  };

  if (!flight) return null;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={() => { if(!isSubmitting) onClose(); }} 
      title={step === 3 ? "Success" : `Book Flight: ${flight.airline}`}
    >
      {step < 3 && <BookingStepper currentStep={step} />}
      {renderContent()}
    </Modal>
  );
}