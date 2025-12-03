/**
 * @file client/src/app/admin/admin-analytics-page.jsx
 * @description Main dashboard for Admin Analytics.
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  getRevenueTopProperties, 
  getRevenueByCity, 
  getTopProviders,
  getPageClicks,
  getListingClicks 
} from '@/features/analytics/api';
import { TopPropertiesChart, CityRevenueChart, TopProvidersList } from '@/features/analytics/components/revenue-charts';
import { PageClicksChart, ListingClicksChart } from '@/features/analytics/components/behavior-charts';

export default function AdminAnalyticsPage() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  // --- Revenue Queries ---
  const topPropertiesQuery = useQuery({
    queryKey: ['analytics-revenue-top-properties', currentYear],
    queryFn: () => getRevenueTopProperties({ year: currentYear }),
  });

  const cityRevenueQuery = useQuery({
    queryKey: ['analytics-revenue-city', currentYear],
    queryFn: () => getRevenueByCity({ year: currentYear }),
  });

  const topProvidersQuery = useQuery({
    queryKey: ['analytics-top-providers', currentMonth],
    queryFn: () => getTopProviders({ month: currentMonth }),
  });

  // --- Behavior Queries ---
  const pageClicksQuery = useQuery({
    queryKey: ['analytics-page-clicks'],
    queryFn: () => getPageClicks({ sinceDays: 30 }),
  });

  const listingClicksQuery = useQuery({
    queryKey: ['analytics-listing-clicks'],
    queryFn: () => getListingClicks({ sinceDays: 30 }),
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of revenue and user behavior for {currentYear}.
        </p>
      </div>

      {/* Revenue Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-6">
        {/* Top Properties (Wide) */}
        <div className="lg:col-span-4">
          <TopPropertiesChart 
            data={topPropertiesQuery.data?.items} 
            isLoading={topPropertiesQuery.isLoading} 
          />
        </div>
        
        {/* City Revenue (Narrow) */}
        <div className="lg:col-span-3">
          <CityRevenueChart 
            data={cityRevenueQuery.data?.cities} 
            isLoading={cityRevenueQuery.isLoading} 
          />
        </div>
      </div>

      {/* Secondary Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
           <TopProvidersList 
             data={topProvidersQuery.data?.providers}
             isLoading={topProvidersQuery.isLoading}
           />
        </div>
        <div className="md:col-span-2">
           <PageClicksChart 
             data={pageClicksQuery.data?.items}
             isLoading={pageClicksQuery.isLoading}
           />
        </div>
      </div>

      {/* Tertiary Row */}
      <div className="grid grid-cols-1 gap-6">
         <ListingClicksChart 
           data={listingClicksQuery.data?.items}
           isLoading={listingClicksQuery.isLoading}
         />
      </div>
    </div>
  );
}