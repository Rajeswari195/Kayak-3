/**
 * @file client/src/features/search/components/car-search-form.jsx
 * @description Search form for Rental Cars.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Calendar, MapPin, Car } from 'lucide-react';

export default function CarSearchForm() {
  const navigate = useNavigate();
  const [sameDropoff, setSameDropoff] = useState(true);
  const [formData, setFormData] = useState({
    pickupLocation: '',
    dropoffLocation: '',
    pickupDate: '',
    dropoffDate: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const query = new URLSearchParams({
      type: 'car',
      pickupLocation: formData.pickupLocation,
      dropoffLocation: sameDropoff ? formData.pickupLocation : formData.dropoffLocation,
      pickupDate: formData.pickupDate,
      dropoffDate: formData.dropoffDate
    }).toString();
    navigate(`/search?${query}`);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col md:flex-row gap-2">
           {/* Pickup */}
           <div className="flex-[2] relative">
              <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                name="pickupLocation"
                placeholder="Pick-up location" 
                value={formData.pickupLocation}
                onChange={handleChange}
                className="pl-9"
                required
              />
           </div>

           {/* Dropoff (Conditional) */}
           {!sameDropoff && (
             <div className="flex-[2] relative animate-in fade-in slide-in-from-left-2">
                <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  name="dropoffLocation"
                  placeholder="Drop-off location" 
                  value={formData.dropoffLocation}
                  onChange={handleChange}
                  className="pl-9"
                  required
                />
             </div>
           )}
        </div>

        <div className="flex flex-col md:flex-row gap-2">
           {/* Dates */}
           <div className="flex-1 relative">
             <div className="absolute left-3 top-2.5 pointer-events-none">
                <Calendar className="h-4 w-4 text-muted-foreground" />
             </div>
             <Input 
               type="date"
               name="pickupDate"
               value={formData.pickupDate}
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
               name="dropoffDate"
               value={formData.dropoffDate}
               onChange={handleChange}
               min={formData.pickupDate}
               className="pl-9 text-muted-foreground has-[value]:text-foreground"
               required
             />
           </div>

           {/* Submit */}
           <div className="md:w-32">
             <Button type="submit" className="w-full bg-primary hover:bg-primary/90 font-bold">
               Search
             </Button>
           </div>
        </div>
      </div>

      {/* Options */}
      <div className="flex items-center gap-2 text-sm">
         <label className="flex items-center gap-2 cursor-pointer select-none">
           <input 
             type="checkbox" 
             checked={sameDropoff} 
             onChange={(e) => setSameDropoff(e.target.checked)}
             className="accent-primary h-4 w-4"
           />
           Drop-off at same location
         </label>
      </div>
    </form>
  );
}