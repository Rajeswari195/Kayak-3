/**
 * @file client/src/features/search/components/flight-search-form.jsx
 * @description Search form for Flights.
 * * Features:
 * - Inputs for Origin/Destination (IATA code or City).
 * - Date pickers for Departure/Return.
 * - Passenger count.
 * - Swap button for locations.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { ArrowRightLeft, Calendar, Plane } from 'lucide-react';

export default function FlightSearchForm() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    origin: '',
    destination: '',
    departureDate: '',
    returnDate: '',
    passengers: 1,
    tripType: 'round-trip' // or 'one-way'
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSwap = () => {
    setFormData(prev => ({
      ...prev,
      origin: prev.destination,
      destination: prev.origin
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // In Step 46, we will handle the actual API call or URL update.
    // For now, we construct a query string and navigate.
    const query = new URLSearchParams({
      type: 'flight',
      ...formData
    }).toString();
    
    // Navigate to results page (using same route with params usually, or a sub-route)
    // We'll update the URL to trigger the search view in the parent component or results page
    navigate(`/search?${query}`);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-col md:flex-row gap-2">
        {/* Locations Group */}
        <div className="flex-1 flex flex-col md:flex-row gap-2 relative">
          <div className="flex-1 relative">
            <Plane className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              name="origin"
              placeholder="From? (e.g. JFK)" 
              value={formData.origin}
              onChange={handleChange}
              className="pl-9"
              required
            />
          </div>
          
          <Button 
            type="button" 
            variant="ghost" 
            size="icon" 
            onClick={handleSwap}
            className="hidden md:flex shrink-0 self-center rounded-full hover:bg-muted"
            title="Swap Origin and Destination"
          >
            <ArrowRightLeft className="h-4 w-4" />
          </Button>

          <div className="flex-1 relative">
            <Plane className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground rotate-90" />
             <Input 
              name="destination"
              placeholder="To? (e.g. LHR)" 
              value={formData.destination}
              onChange={handleChange}
              className="pl-9"
              required
            />
          </div>
        </div>

        {/* Dates Group */}
        <div className="flex-1 flex flex-col md:flex-row gap-2">
          <div className="flex-1 relative">
            <div className="absolute left-3 top-2.5 pointer-events-none">
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
            <Input 
              type="date"
              name="departureDate"
              value={formData.departureDate}
              onChange={handleChange}
              className="pl-9 text-muted-foreground has-[value]:text-foreground"
              required
            />
          </div>
          
          <div className="flex-1 relative">
            <div className="absolute left-3 top-2.5 pointer-events-none">
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
            <Input 
              type="date"
              name="returnDate"
              value={formData.returnDate}
              onChange={handleChange}
              min={formData.departureDate}
              className="pl-9 text-muted-foreground has-[value]:text-foreground"
            />
          </div>
        </div>
        
        {/* Submit */}
        <div className="md:w-32">
          <Button type="submit" className="w-full bg-primary hover:bg-primary/90 font-bold">
            Search
          </Button>
        </div>
      </div>
      
      {/* Filters / Extras Row */}
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-2 cursor-pointer">
          <input 
            type="radio" 
            name="tripType" 
            value="round-trip" 
            checked={formData.tripType === 'round-trip'}
            onChange={handleChange}
            className="accent-primary"
          />
          Round-trip
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input 
            type="radio" 
            name="tripType" 
            value="one-way" 
            checked={formData.tripType === 'one-way'}
            onChange={handleChange}
            className="accent-primary"
          />
          One-way
        </label>
        
        <div className="ml-auto flex items-center gap-2">
           <label htmlFor="passengers" className="text-muted-foreground">Travelers:</label>
           <input 
             id="passengers"
             name="passengers"
             type="number" 
             min="1" 
             max="9" 
             value={formData.passengers}
             onChange={handleChange}
             className="w-12 border rounded px-1 text-center text-foreground bg-background"
           />
        </div>
      </div>
    </form>
  );
}