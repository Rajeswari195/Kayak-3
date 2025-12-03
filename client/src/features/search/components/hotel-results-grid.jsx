/**
 * @file client/src/features/search/components/hotel-results-grid.jsx
 * @description Displays search results for hotels with filters.
 * * Features:
 * - Fetches data using React Query and search params.
 * - Sidebar filters: Price, Star Rating.
 * - Sorting: Price, Stars.
 * - Grid layout for property cards.
 */

import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { searchHotels } from '../api';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import LoadingSpinner from '@/components/loading-spinner';
import StatusBanner from '@/components/status-banner';
import { Building, MapPin, Star } from 'lucide-react';

export default function HotelResultsGrid() {
  const [searchParams] = useSearchParams();
  
  const [filters, setFilters] = useState({
    priceMax: '',
    minStars: '',
    sort: 'price_asc'
  });

  const queryParams = {
    city: searchParams.get('city'),
    checkInDate: searchParams.get('checkInDate'),
    checkOutDate: searchParams.get('checkOutDate'),
    guests: searchParams.get('guests'),
    priceMax: filters.priceMax,
    minStars: filters.minStars,
    sortBy: filters.sort.startsWith('stars') ? 'stars' : 'price',
    sortOrder: filters.sort.endsWith('desc') ? 'desc' : 'asc'
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['hotels', queryParams],
    queryFn: () => searchHotels(queryParams),
    enabled: !!queryParams.city && !!queryParams.checkInDate,
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
              <label className="text-sm font-medium mb-1 block">Max Price / Night</label>
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
              <label className="text-sm font-medium mb-1 block">Star Rating</label>
              <select 
                name="minStars" 
                value={filters.minStars} 
                onChange={handleFilterChange}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Any</option>
                <option value="3">3+ Stars</option>
                <option value="4">4+ Stars</option>
                <option value="5">5 Stars</option>
              </select>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Grid */}
      <div className="flex-1 space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center bg-muted/30 p-3 rounded-lg">
          <span className="text-sm text-muted-foreground">
            {isLoading ? 'Searching...' : `${data?.total || 0} properties found`}
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
              <option value="stars_desc">Stars (High to Low)</option>
            </select>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <LoadingSpinner centered className="min-h-[300px]" />
        ) : error ? (
          <StatusBanner status="error" message={error.message || "Failed to load hotels"} />
        ) : results.length === 0 ? (
          <div className="text-center py-12 border border-dashed rounded-lg">
            <Building className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
            <h3 className="text-lg font-medium">No properties found</h3>
            <p className="text-muted-foreground">Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {results.map((hotel) => (
              <div key={hotel.id} className="border rounded-lg overflow-hidden bg-card hover:shadow-lg transition-shadow flex flex-col">
                {/* Image Placeholder */}
                <div className="h-48 bg-muted flex items-center justify-center relative">
                  <Building className="h-12 w-12 text-muted-foreground/30" />
                  <div className="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    {hotel.starRating}
                  </div>
                </div>
                
                <div className="p-4 flex-1 flex flex-col">
                  <h4 className="font-semibold text-lg line-clamp-1">{hotel.name}</h4>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <MapPin className="h-3 w-3" />
                    <span className="line-clamp-1">{hotel.city}, {hotel.state}</span>
                  </div>
                  
                  <div className="mt-auto pt-4 flex items-end justify-between">
                    <div>
                      <p className="text-2xl font-bold">{hotel.currency} {hotel.basePricePerNight}</p>
                      <p className="text-xs text-muted-foreground">per night</p>
                    </div>
                    <Button size="sm">View</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}