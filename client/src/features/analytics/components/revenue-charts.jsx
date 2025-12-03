/**
 * @file client/src/features/analytics/components/revenue-charts.jsx
 * @description Charts for displaying revenue analytics.
 */

import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import LoadingSpinner from '@/components/loading-spinner';

// Internal card wrapper since @/ui/card is not implemented
const SimpleCard = ({ title, children, className }) => (
  <div className={`rounded-lg border bg-card text-card-foreground shadow-sm ${className}`}>
    <div className="p-6 flex flex-col space-y-1.5">
      <h3 className="font-semibold leading-none tracking-tight">{title}</h3>
    </div>
    <div className="p-6 pt-0">{children}</div>
  </div>
);

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export function TopPropertiesChart({ data, isLoading }) {
  if (isLoading) return <LoadingSpinner centered className="h-[300px]" />;
  if (!data || data.length === 0) return <div className="h-[300px] flex items-center justify-center text-muted-foreground">No data available</div>;

  return (
    <SimpleCard title="Top Properties by Revenue (Year)">
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tickFormatter={(value) => `$${value}`} />
            <YAxis dataKey="listingName" type="category" width={150} tick={{fontSize: 12}} />
            <Tooltip 
              formatter={(value) => [`$${value.toLocaleString()}`, 'Revenue']}
              contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #eee' }}
            />
            <Bar dataKey="totalRevenue" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </SimpleCard>
  );
}

export function CityRevenueChart({ data, isLoading }) {
  if (isLoading) return <LoadingSpinner centered className="h-[300px]" />;
  if (!data || data.length === 0) return <div className="h-[300px] flex items-center justify-center text-muted-foreground">No data available</div>;

  return (
    <SimpleCard title="Revenue by City">
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              fill="#8884d8"
              paddingAngle={5}
              dataKey="totalRevenue"
              nameKey="city"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </SimpleCard>
  );
}

export function TopProvidersList({ data, isLoading }) {
  if (isLoading) return <LoadingSpinner centered className="h-[300px]" />;
  if (!data || data.length === 0) return <div className="h-[300px] flex items-center justify-center text-muted-foreground">No data available</div>;

  return (
    <SimpleCard title="Top Performing Providers (This Month)">
      <div className="space-y-4">
        {data.map((provider, i) => (
          <div key={i} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
            <div className="space-y-0.5">
              <p className="text-sm font-medium leading-none">{provider.provider}</p>
              <p className="text-xs text-muted-foreground">{provider.listingType}</p>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold block">${provider.totalRevenue.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground">{provider.itemsSold} sales</span>
            </div>
          </div>
        ))}
      </div>
    </SimpleCard>
  );
}