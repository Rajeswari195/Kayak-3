/**
 * @file client/src/features/search/components/car-results-grid.jsx
 * @description Displays search results for rental cars.
 * * Features:
 * - Fetches data using React Query and search params.
 * - Sidebar filters: Price, Type (Economy, SUV, etc.).
 * - Displays car details (Transmission, Seats).
 */

import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { searchCars } from '../api';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import LoadingSpinner from '@/components/loading-spinner';
import StatusBanner from '@/components/status-banner';
import { Car, Users, Fuel, Gauge } from 'lucide-react';

export default function CarResultsGrid() {
  const [searchParams] = useSearchParams();
  
  const [filters, setFilters] = useState({
    priceMax: '',
    carType: '',
    sort: 'price_asc'
  });

  const queryParams = {
    pickupLocation: searchParams.get('pickupLocation'),
    dropoffLocation: searchParams.get('dropoffLocation'),
    pickupDate: searchParams.get('pickupDate'),
    dropoffDate: searchParams.get('dropoffDate'),
    priceMax: filters.priceMax,
    carType: filters.carType,
    sortBy: 'price',
    sortOrder: 'asc'
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['cars', queryParams],
    queryFn: () => searchCars(queryParams),
    enabled: !!queryParams.pickupLocation && !!queryParams.pickupDate,
  });

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const results = data?.items || [];

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* Sidebar */}
      <aside className="w-full md:w-64 space-y-6">
        <div className="p-4 border rounded-lg bg-card">
          <h3 className="font-semibold mb-4">Filters</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Max Price / Day</label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">$</span>
                <Input 
                  type="number" 
                  name="priceMax" 
                  placeholder="Any"
                  value={filters.priceMax}
                  onChange={handleFilterChange}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Car Type</label>
              <select 
                name="carType" 
                value={filters.carType} 
                onChange={handleFilterChange}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Any</option>
                <option value="ECONOMY">Economy</option>
                <option value="COMPACT">Compact</option>
                <option value="SUV">SUV</option>
                <option value="LUXURY">Luxury</option>
              </select>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Grid */}
      <div className="flex-1 space-y-4">
        <div className="flex justify-between items-center bg-muted/30 p-3 rounded-lg">
          <span className="text-sm text-muted-foreground">
            {isLoading ? 'Searching...' : `${data?.total || 0} cars found`}
          </span>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Sort by:</label>
            <select 
              name="sort" 
              value={filters.sort} 
              onChange={handleFilterChange}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="price_asc">Price (Low to High)</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <LoadingSpinner centered className="min-h-[300px]" />
        ) : error ? (
          <StatusBanner status="error" message={error.message || "Failed to load cars"} />
        ) : results.length === 0 ? (
          <div className="text-center py-12 border border-dashed rounded-lg">
            <Car className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
            <h3 className="text-lg font-medium">No cars found</h3>
            <p className="text-muted-foreground">Try changing your location or dates.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {results.map((car) => (
              <div key={car.id} className="border rounded-lg p-4 bg-card hover:shadow-lg transition-shadow flex flex-col gap-4">
                <div>
                  <div className="flex justify-between items-start">
                    <h4 className="font-semibold text-lg">{car.make} {car.model}</h4>
                    <span className="text-xs px-2 py-1 bg-muted rounded font-medium">{car.carType}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{car.providerName}</p>
                </div>

                <div className="flex items-center justify-center py-4 bg-muted/20 rounded-md">
                  <Car className="h-16 w-16 text-primary/80" />
                </div>

                <div className="grid grid-cols-2 gap-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    {car.seats} Seats
                  </div>
                  <div className="flex items-center gap-2">
                    <Gauge className="h-4 w-4" />
                    {car.transmission}
                  </div>
                  <div className="flex items-center gap-2 col-span-2">
                    <Fuel className="h-4 w-4" />
                    Unlimited Mileage
                  </div>
                </div>

                <div className="mt-auto pt-4 border-t flex items-center justify-between">
                  <div>
                    <p className="text-xl font-bold">{car.currency} {car.dailyPrice}</p>
                    <p className="text-xs text-muted-foreground">per day</p>
                  </div>
                  <Button size="sm">Select</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}