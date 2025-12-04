/**
 * @file client/src/features/admin/listings/components/add-listing-dialog.jsx
 * @description Admin dialog to create new listings (Flight, Hotel, Car).
 * * Features:
 * - Tabbed interface for selecting listing type.
 * - Dynamic forms based on selected type.
 * - Validation and API submission.
 */

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFlight, createHotel, createCar } from '../api';
import { Modal } from '@/ui/modal';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import StatusBanner from '@/components/status-banner';
import LoadingSpinner from '@/components/loading-spinner';
import { Plane, Building, Car } from 'lucide-react';
import { cn } from '@/lib/utils';

const TYPES = [
  { id: 'flight', label: 'Flight', icon: Plane },
  { id: 'hotel', label: 'Hotel', icon: Building },
  { id: 'car', label: 'Car', icon: Car },
];

export default function AddListingDialog({ isOpen, onClose }) {
  const queryClient = useQueryClient();
  const [activeType, setActiveType] = useState('flight');
  const [error, setError] = useState(null);

  // Form States
  const [flightForm, setFlightForm] = useState({
    flightNumber: '', airline: '', originAirportId: '', destinationAirportId: '',
    departureTime: '', arrivalTime: '', basePrice: '', seatsTotal: 100, cabinClass: 'ECONOMY'
  });
  
  const [hotelForm, setHotelForm] = useState({
    name: '', addressLine1: '', city: '', state: '', zip: '', 
    basePricePerNight: '', starRating: 3
  });

  const [carForm, setCarForm] = useState({
    providerName: '', carType: 'ECONOMY', make: '', model: '', modelYear: 2024,
    dailyPrice: '', pickupCity: '', pickupState: '', seats: 4, transmission: 'AUTOMATIC'
  });

  // Mutations
  const flightMutation = useMutation({
    mutationFn: createFlight,
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-flights']);
      handleClose();
    },
    onError: (err) => setError(err.message)
  });

  const hotelMutation = useMutation({
    mutationFn: createHotel,
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-hotels']);
      handleClose();
    },
    onError: (err) => setError(err.message)
  });

  const carMutation = useMutation({
    mutationFn: createCar,
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-cars']);
      handleClose();
    },
    onError: (err) => setError(err.message)
  });

  const isPending = flightMutation.isPending || hotelMutation.isPending || carMutation.isPending;

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);

    if (activeType === 'flight') {
      flightMutation.mutate({
        ...flightForm,
        basePrice: Number(flightForm.basePrice),
        seatsTotal: Number(flightForm.seatsTotal),
        // Ensure ISO strings
        departureTime: new Date(flightForm.departureTime).toISOString(),
        arrivalTime: new Date(flightForm.arrivalTime).toISOString(),
      });
    } else if (activeType === 'hotel') {
      hotelMutation.mutate({
        ...hotelForm,
        basePricePerNight: Number(hotelForm.basePricePerNight),
        starRating: Number(hotelForm.starRating)
      });
    } else if (activeType === 'car') {
      carMutation.mutate({
        ...carForm,
        dailyPrice: Number(carForm.dailyPrice),
        seats: Number(carForm.seats),
        modelYear: Number(carForm.modelYear)
      });
    }
  };

  const handleInputChange = (setter, field, value) => {
    setter(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add New Listing"
      className="max-w-2xl"
    >
      <div className="space-y-6">
        {/* Type Selector */}
        <div className="flex space-x-2 border-b pb-2">
          {TYPES.map(type => {
            const Icon = type.icon;
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => setActiveType(type.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors",
                  activeType === type.id 
                    ? "bg-primary text-primary-foreground" 
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                <Icon className="h-4 w-4" />
                {type.label}
              </button>
            )
          })}
        </div>

        {error && <StatusBanner status="error" message={error} />}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* FLIGHT FORM */}
          {activeType === 'flight' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Airline</label>
                <Input required value={flightForm.airline} onChange={e => handleInputChange(setFlightForm, 'airline', e.target.value)} placeholder="e.g. United" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Flight Number</label>
                <Input required value={flightForm.flightNumber} onChange={e => handleInputChange(setFlightForm, 'flightNumber', e.target.value)} placeholder="e.g. UA123" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Origin (IATA)</label>
                <Input required maxLength={3} value={flightForm.originAirportId} onChange={e => handleInputChange(setFlightForm, 'originAirportId', e.target.value.toUpperCase())} placeholder="JFK" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Destination (IATA)</label>
                <Input required maxLength={3} value={flightForm.destinationAirportId} onChange={e => handleInputChange(setFlightForm, 'destinationAirportId', e.target.value.toUpperCase())} placeholder="LHR" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Departure Time</label>
                <Input required type="datetime-local" value={flightForm.departureTime} onChange={e => handleInputChange(setFlightForm, 'departureTime', e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Arrival Time</label>
                <Input required type="datetime-local" value={flightForm.arrivalTime} onChange={e => handleInputChange(setFlightForm, 'arrivalTime', e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Price (USD)</label>
                <Input required type="number" min="0" step="0.01" value={flightForm.basePrice} onChange={e => handleInputChange(setFlightForm, 'basePrice', e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Total Seats</label>
                <Input required type="number" min="1" value={flightForm.seatsTotal} onChange={e => handleInputChange(setFlightForm, 'seatsTotal', e.target.value)} />
              </div>
            </div>
          )}

          {/* HOTEL FORM */}
          {activeType === 'hotel' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <label className="text-sm font-medium">Hotel Name</label>
                <Input required value={hotelForm.name} onChange={e => handleInputChange(setHotelForm, 'name', e.target.value)} placeholder="e.g. Grand Hyatt" />
              </div>
              <div className="col-span-2 space-y-2">
                <label className="text-sm font-medium">Address</label>
                <Input required value={hotelForm.addressLine1} onChange={e => handleInputChange(setHotelForm, 'addressLine1', e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">City</label>
                <Input required value={hotelForm.city} onChange={e => handleInputChange(setHotelForm, 'city', e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">State</label>
                <Input required maxLength={2} value={hotelForm.state} onChange={e => handleInputChange(setHotelForm, 'state', e.target.value.toUpperCase())} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">ZIP</label>
                <Input required value={hotelForm.zip} onChange={e => handleInputChange(setHotelForm, 'zip', e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Price per Night</label>
                <Input required type="number" min="0" step="0.01" value={hotelForm.basePricePerNight} onChange={e => handleInputChange(setHotelForm, 'basePricePerNight', e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Star Rating (1-5)</label>
                <Input required type="number" min="1" max="5" value={hotelForm.starRating} onChange={e => handleInputChange(setHotelForm, 'starRating', e.target.value)} />
              </div>
            </div>
          )}

          {/* CAR FORM */}
          {activeType === 'car' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Provider</label>
                <Input required value={carForm.providerName} onChange={e => handleInputChange(setCarForm, 'providerName', e.target.value)} placeholder="e.g. Hertz" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={carForm.carType} 
                  onChange={e => handleInputChange(setCarForm, 'carType', e.target.value)}
                >
                  <option value="ECONOMY">Economy</option>
                  <option value="COMPACT">Compact</option>
                  <option value="SUV">SUV</option>
                  <option value="LUXURY">Luxury</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Make</label>
                <Input required value={carForm.make} onChange={e => handleInputChange(setCarForm, 'make', e.target.value)} placeholder="Toyota" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Model</label>
                <Input required value={carForm.model} onChange={e => handleInputChange(setCarForm, 'model', e.target.value)} placeholder="Corolla" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Year</label>
                <Input required type="number" value={carForm.modelYear} onChange={e => handleInputChange(setCarForm, 'modelYear', e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Price per Day</label>
                <Input required type="number" min="0" step="0.01" value={carForm.dailyPrice} onChange={e => handleInputChange(setCarForm, 'dailyPrice', e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Pickup City</label>
                <Input required value={carForm.pickupCity} onChange={e => handleInputChange(setCarForm, 'pickupCity', e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Pickup State</label>
                <Input required maxLength={2} value={carForm.pickupState} onChange={e => handleInputChange(setCarForm, 'pickupState', e.target.value.toUpperCase())} />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="ghost" onClick={handleClose}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <LoadingSpinner className="mr-2 h-4 w-4" /> : null}
              Create Listing
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}