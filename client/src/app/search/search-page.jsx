/**
 * @file client/src/app/search/search-page.jsx
 * @description Main landing page for search.
 * * Features:
 * - Hero area with SearchTabs.
 * - Conditionally renders Results Components (Flights/Hotels/Cars) based on URL params.
 * - Shows promotional placeholders if no search is active.
 */

import React from 'react';
import { useSearchParams } from 'react-router-dom';
import SearchTabs from '@/features/search/components/search-tabs';
import FlightResultsTable from '@/features/search/components/flight-results-table';
import HotelResultsGrid from '@/features/search/components/hotel-results-grid';
import CarResultsGrid from '@/features/search/components/car-results-grid';

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  
  // Determine if a search is active and what type
  const searchType = searchParams.get('type');
  const hasSearch = !!searchType;

  // Simple render logic based on type
  const renderResults = () => {
    switch (searchType) {
      case 'flight':
        return <FlightResultsTable />;
      case 'hotel':
        return <HotelResultsGrid />;
      case 'car':
        return <CarResultsGrid />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Hero / Search Section */}
      <div className="relative py-12 md:py-16 px-4 bg-gradient-to-b from-primary/5 to-background border-b">
        <div className="container mx-auto space-y-8">
           {!hasSearch && (
             <div className="text-center space-y-2 animate-in fade-in slide-in-from-top-4">
               <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground">
                 Find your next adventure
               </h1>
               <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                 Search deals on flights, hotels, and rental cars.
               </p>
             </div>
           )}
           
           <SearchTabs />
        </div>
      </div>

      {/* Content Section */}
      <div className="container py-8 flex-1">
        {hasSearch ? (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            {renderResults()}
          </div>
        ) : (
          /* Placeholder Promos (Only show when not searching) */
          <div className="space-y-8 animate-in fade-in zoom-in duration-500">
            <h2 className="text-2xl font-bold">Popular Destinations</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div className="p-6 rounded-lg border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <div className="h-32 bg-muted rounded-md mb-4 flex items-center justify-center">NYC</div>
                  <h3 className="font-semibold text-lg mb-1">New York, NY</h3>
                  <p className="text-sm text-muted-foreground">Flights from $199</p>
               </div>
               <div className="p-6 rounded-lg border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <div className="h-32 bg-muted rounded-md mb-4 flex items-center justify-center">MIA</div>
                  <h3 className="font-semibold text-lg mb-1">Miami, FL</h3>
                  <p className="text-sm text-muted-foreground">Hotels from $89/night</p>
               </div>
               <div className="p-6 rounded-lg border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <div className="h-32 bg-muted rounded-md mb-4 flex items-center justify-center">LAX</div>
                  <h3 className="font-semibold text-lg mb-1">Los Angeles, CA</h3>
                  <p className="text-sm text-muted-foreground">Rentals from $45/day</p>
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}