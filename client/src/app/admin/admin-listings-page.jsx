/**
 * @file client/src/app/admin/admin-listings-page.jsx
 * @description Admin page for managing listings.
 */

import React, { useState } from 'react';
import AdminListingsTable from '@/features/admin/listings/components/admin-listings-table';
import { Button } from '@/ui/button';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'flight', label: 'Flights' },
  { id: 'hotel', label: 'Hotels' },
  { id: 'car', label: 'Cars' },
];

export default function AdminListingsPage() {
  const [activeType, setActiveType] = useState('flight');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Listings</h1>
          <p className="text-muted-foreground">Manage your travel inventory.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Listing
        </Button>
      </div>

      <div className="flex space-x-1 border-b">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveType(tab.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              activeType === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <AdminListingsTable type={activeType} />
    </div>
  );
}