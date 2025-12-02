/**
 * @file client/src/features/search/components/hotel-search-form.jsx
 * @description Search form for Hotels.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Calendar, MapPin, Users } from 'lucide-react';

export default function HotelSearchForm() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    city: '',
    checkInDate: '',
    checkOutDate: '',
    guests: 2
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const query = new URLSearchParams({
      type: 'hotel',
      ...formData
    }).toString();
    navigate(`/search?${query}`);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-col md:flex-row gap-2">
        
        {/* Location */}
        <div className="flex-[2] relative">
          <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            name="city"
            placeholder="Where do you want to stay? (e.g. Paris)" 
            value={formData.city}
            onChange={handleChange}
            className="pl-9"
            required
          />
        </div>

        {/* Dates */}
        <div className="flex-1 relative">
          <div className="absolute left-3 top-2.5 pointer-events-none">
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </div>
          <Input 
            type="date"
            name="checkInDate"
            placeholder="Check-in"
            value={formData.checkInDate}
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
            name="checkOutDate"
            placeholder="Check-out"
            value={formData.checkOutDate}
            onChange={handleChange}
            min={formData.checkInDate}
            className="pl-9 text-muted-foreground has-[value]:text-foreground"
            required
          />
        </div>
        
        {/* Guests */}
        <div className="flex-[0.5] relative min-w-[80px]">
           <Users className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
           <Input 
             type="number"
             name="guests"
             min="1"
             max="10"
             value={formData.guests}
             onChange={handleChange}
             className="pl-9"
             title="Guests"
           />
        </div>

        {/* Submit */}
        <div className="md:w-32">
          <Button type="submit" className="w-full bg-primary hover:bg-primary/90 font-bold">
            Search
          </Button>
        </div>
      </div>
    </form>
  );
}