/**
 * @file client/src/features/bookings/components/hotel-booking-modal.jsx
 * @description Modal flow for booking a hotel room.
 */

import React, { useState } from 'react';
import { bookHotel } from '../api';
import { Modal } from '@/ui/modal';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import BookingStepper from './booking-stepper';
import StatusBanner from '@/components/status-banner';
import LoadingSpinner from '@/components/loading-spinner';
import { Building, CreditCard, Calendar } from 'lucide-react';

export default function HotelBookingModal({ isOpen, onClose, hotel, searchParams }) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const checkIn = searchParams?.checkInDate;
  const checkOut = searchParams?.checkOutDate;
  
  // Calculate nights
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const nights = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
  const totalPrice = (hotel?.basePricePerNight || 0) * nights;

  const [paymentDetails, setPaymentDetails] = useState({
    cardNumber: '4242424242424242',
    expiry: '12/28',
    cvc: '123'
  });

  const handleBooking = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      await bookHotel({
        hotelId: hotel.id,
        roomType: 'STANDARD', // Defaulting for simplicity as per search results
        checkInDate: checkIn,
        checkOutDate: checkOut,
        pricePerNight: hotel.basePricePerNight,
        rooms: 1,
        paymentMethodToken: `tok_${Math.random().toString(36).substr(2, 9)}`
      });
      setStep(3);
    } catch (err) {
      console.error("Hotel booking failed:", err);
      setError(err.message || "Booking failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!hotel) return null;

  const renderContent = () => {
    if (step === 1) {
      return (
        <div className="space-y-4">
          <div className="bg-muted/30 p-4 rounded-lg space-y-2">
            <h3 className="font-semibold text-lg">{hotel.name}</h3>
            <p className="text-sm text-muted-foreground">{hotel.city}, {hotel.state}</p>
            
            <div className="flex items-center gap-4 text-sm mt-2">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                <span>{new Date(checkIn).toLocaleDateString()} — {new Date(checkOut).toLocaleDateString()}</span>
              </div>
              <div className="font-medium bg-background px-2 py-0.5 rounded border">
                {nights} Night{nights > 1 ? 's' : ''}
              </div>
            </div>
            
            <div className="border-t pt-2 mt-2 flex justify-between items-center">
              <span>Standard Room</span>
              <span className="font-bold text-lg">{hotel.currency} {totalPrice.toFixed(2)}</span>
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
                <Input value={paymentDetails.cardNumber} onChange={()=>{}} readOnly className="pl-9 font-mono bg-muted/50" />
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 text-yellow-800 text-xs p-3 rounded-md mt-2">
            Total Charge: <strong>{hotel.currency} {totalPrice.toFixed(2)}</strong>
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
            <Building className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-bold">Booking Confirmed!</h3>
          <p className="text-muted-foreground">Your stay at {hotel.name} is confirmed.</p>
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
      title={step === 3 ? "Success" : `Book Hotel`}
    >
      {step < 3 && <BookingStepper currentStep={step} />}
      {renderContent()}
    </Modal>
  );
}