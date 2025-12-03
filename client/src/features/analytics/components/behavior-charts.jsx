/**
 * @file client/src/features/analytics/components/behavior-charts.jsx
 * @description Charts for displaying user behavior/clickstream analytics.
 */

import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import LoadingSpinner from '@/components/loading-spinner';

const SimpleCard = ({ title, children, className }) => (
  <div className={`rounded-lg border bg-card text-card-foreground shadow-sm ${className}`}>
    <div className="p-6 flex flex-col space-y-1.5">
      <h3 className="font-semibold leading-none tracking-tight">{title}</h3>
    </div>
    <div className="p-6 pt-0">{children}</div>
  </div>
);

export function PageClicksChart({ data, isLoading }) {
  if (isLoading) return <LoadingSpinner centered className="h-[300px]" />;
  if (!data || data.length === 0) return <div className="h-[300px] flex items-center justify-center text-muted-foreground">No data available</div>;

  return (
    <SimpleCard title="Most Visited Pages (Last 30 Days)">
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis 
              dataKey="page" 
              tick={{fontSize: 10}} 
              interval={0} 
              angle={-15} 
              textAnchor="end" 
              height={60}
            />
            <YAxis />
            <Tooltip 
              cursor={{fill: 'transparent'}}
              contentStyle={{ backgroundColor: '#fff', borderRadius: '8px' }}
            />
            <Bar dataKey="count" fill="#8884d8" radius={[4, 4, 0, 0]} name="Views" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </SimpleCard>
  );
}

export function ListingClicksChart({ data, isLoading }) {
  if (isLoading) return <LoadingSpinner centered className="h-[300px]" />;
  if (!data || data.length === 0) return <div className="h-[300px] flex items-center justify-center text-muted-foreground">No data available</div>;

  return (
    <SimpleCard title="Most Viewed Listings">
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" />
            <YAxis dataKey="listingId" type="category" width={100} tick={{fontSize: 10}} />
            <Tooltip 
               contentStyle={{ backgroundColor: '#fff', borderRadius: '8px' }}
               labelFormatter={(label) => `ID: ${label}`}
            />
            <Bar dataKey="clickCount" fill="#82ca9d" radius={[0, 4, 4, 0]} name="Clicks" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </SimpleCard>
  );
}