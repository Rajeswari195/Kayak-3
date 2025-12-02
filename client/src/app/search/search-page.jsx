/**
 * @file client/src/app/search/search-page.jsx
 * @description Main landing page for search.
 * * Features:
 * - Hero area with SearchTabs.
 * - Placeholder for results or promotional content.
 */

import React from 'react';
import SearchTabs from '@/features/search/components/search-tabs';

export default function SearchPage() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Hero / Search Section */}
      <div className="relative py-12 md:py-20 px-4 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto space-y-8">
           <div className="text-center space-y-2">
             <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground">
               Find your next adventure
             </h1>
             <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
               Search deals on flights, hotels, and rental cars.
             </p>
           </div>
           
           <SearchTabs />
        </div>
      </div>

      {/* Content Section (Results will go here later, or promos now) */}
      <div className="container py-12 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           {/* Placeholder Promos */}
           <div className="p-6 rounded-lg border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <h3 className="font-semibold text-lg mb-2">Explore New York</h3>
              <p className="text-sm text-muted-foreground">Flights from $199</p>
           </div>
           <div className="p-6 rounded-lg border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <h3 className="font-semibold text-lg mb-2">Relax in Miami</h3>
              <p className="text-sm text-muted-foreground">Hotels from $89/night</p>
           </div>
           <div className="p-6 rounded-lg border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow cursor-pointer">
              <h3 className="font-semibold text-lg mb-2">Drive the Coast</h3>
              <p className="text-sm text-muted-foreground">Rentals from $45/day</p>
           </div>
        </div>
      </div>
    </div>
  );
}