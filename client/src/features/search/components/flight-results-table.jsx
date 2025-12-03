/**
 * @file client/src/features/search/components/flight-results-table.jsx
 * @description Displays search results for flights with filters.
 * * Features:
 * - Fetches data using React Query and search params.
 * - Sidebar filters: Price range, Stops.
 * - Sorting: Price, Duration.
 * - Displays flight list cards.
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { searchFlights } from '../api';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import LoadingSpinner from '@/components/loading-spinner';
import StatusBanner from '@/components/status-banner';
import { Plane, Clock, ArrowRight } from 'lucide-react';

export default function FlightResultsTable() {
  const [searchParams] = useSearchParams();
  
  // Local filter state
  const [filters, setFilters] = useState({
    priceMax: '',
    stops: '', // '0', '1', '2+'
    sort: 'price_asc' // 'price_asc', 'duration_asc'
  });

  // Extract query params from URL
  const queryParams = {
    origin: searchParams.get('origin'),
    destination: searchParams.get('destination'),
    departureDate: searchParams.get('departureDate'),
    returnDate: searchParams.get('returnDate'),
    passengers: searchParams.get('passengers'),
    // Merge local filters
    priceMax: filters.priceMax,
    stops: filters.stops,
    sortBy: filters.sort === 'duration_asc' ? 'duration' : 'price',
    sortOrder: 'asc'
  };

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['flights', queryParams],
    queryFn: () => searchFlights(queryParams),
    enabled: !!queryParams.origin && !!queryParams.destination && !!queryParams.departureDate,
  });

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  // Mock data fallback if API returns empty/error during dev (optional, removed for prod-like code)
  const results = data?.items || []; 

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* Filters Sidebar */}
      <aside className="w-full md:w-64 space-y-6">
        <div className="p-4 border rounded-lg bg-card">
          <h3 className="font-semibold mb-4">Filters</h3>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Max Price</label>
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
              <label className="text-sm font-medium mb-1 block">Stops</label>
              <select 
                name="stops" 
                value={filters.stops} 
                onChange={handleFilterChange}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Any</option>
                <option value="0">Non-stop</option>
                <option value="1">1 Stop</option>
                <option value="2">2+ Stops</option>
              </select>
            </div>
          </div>
        </div>
      </aside>

      {/* Results Area */}
      <div className="flex-1 space-y-4">
        {/* Sorting / Header */}
        <div className="flex justify-between items-center bg-muted/30 p-3 rounded-lg">
          <span className="text-sm text-muted-foreground">
            {isLoading ? 'Searching...' : `${data?.total || 0} flights found`}
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
              <option value="duration_asc">Duration (Shortest)</option>
            </select>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <LoadingSpinner centered className="min-h-[300px]" />
        ) : error ? (
          <StatusBanner status="error" message={error.message || "Failed to load flights"} />
        ) : results.length === 0 ? (
          <div className="text-center py-12 border border-dashed rounded-lg">
            <Plane className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
            <h3 className="text-lg font-medium">No flights found</h3>
            <p className="text-muted-foreground">Try adjusting your dates or filters.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {results.map((flight) => (
              <div key={flight.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-card flex flex-col sm:flex-row gap-4">
                {/* Airline & Route Info */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    {/* Placeholder Airline Logo */}
                    <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center text-xs font-bold text-primary">
                      {flight.airline?.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-semibold">{flight.airline}</h4>
                      <p className="text-xs text-muted-foreground">{flight.flightNumber}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 mt-2">
                    <div className="text-center">
                      <p className="text-lg font-medium">{new Date(flight.departureTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                      <p className="text-xs text-muted-foreground">{flight.originAirportId}</p>
                    </div>
                    <div className="flex-1 flex flex-col items-center">
                      <p className="text-xs text-muted-foreground">{flight.totalDurationMinutes ? `${Math.floor(flight.totalDurationMinutes/60)}h ${flight.totalDurationMinutes%60}m` : 'N/A'}</p>
                      <div className="w-full h-[1px] bg-border relative my-1">
                        <Plane className="h-3 w-3 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-muted-foreground rotate-90" />
                      </div>
                      <p className="text-xs text-muted-foreground">{flight.stops === 0 ? 'Non-stop' : `${flight.stops} stop(s)`}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-medium">{new Date(flight.arrivalTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                      <p className="text-xs text-muted-foreground">{flight.destinationAirportId}</p>
                    </div>
                  </div>
                </div>

                {/* Price & Action */}
                <div className="sm:w-48 border-t sm:border-t-0 sm:border-l pt-4 sm:pt-0 sm:pl-4 flex flex-row sm:flex-col justify-between sm:justify-center items-center gap-2">
                  <div className="text-right sm:text-center">
                    <p className="text-2xl font-bold">{flight.currency} {flight.basePrice}</p>
                    <p className="text-xs text-muted-foreground">{flight.cabinClass}</p>
                  </div>
                  <Button className="w-full sm:w-auto">
                    Select
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}