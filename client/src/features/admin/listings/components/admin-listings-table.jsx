/**
 * @file client/src/features/admin/listings/components/admin-listings-table.jsx
 * @description Generic table for managing listings (Flights, Hotels, Cars).
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getAdminFlights, updateFlight, 
  getAdminHotels, updateHotel,
  getAdminCars, updateCar 
} from '../api';
import { Button } from '@/ui/button';
import LoadingSpinner from '@/components/loading-spinner';
import { Edit, Power, CheckCircle, XCircle } from 'lucide-react';

const TYPE_CONFIG = {
  flight: {
    fetcher: getAdminFlights,
    updater: updateFlight,
    key: 'admin-flights',
    columns: [
      { header: 'Airline', accessor: 'airline' },
      { header: 'Flight #', accessor: 'flightNumber' },
      { header: 'Route', render: (r) => `${r.originAirportId} → ${r.destinationAirportId}` },
      { header: 'Price', render: (r) => `${r.currency} ${r.basePrice}` },
      { header: 'Seats', render: (r) => `${r.seatsAvailable}/${r.seatsTotal}` },
    ]
  },
  hotel: {
    fetcher: getAdminHotels,
    updater: updateHotel,
    key: 'admin-hotels',
    columns: [
      { header: 'Name', accessor: 'name' },
      { header: 'City', accessor: 'city' },
      { header: 'Stars', accessor: 'starRating' },
      { header: 'Price/Night', render: (r) => `${r.currency} ${r.basePricePerNight}` },
    ]
  },
  car: {
    fetcher: getAdminCars,
    updater: updateCar,
    key: 'admin-cars',
    columns: [
      { header: 'Provider', accessor: 'providerName' },
      { header: 'Model', render: (r) => `${r.make} ${r.model}` },
      { header: 'Type', accessor: 'carType' },
      { header: 'City', accessor: 'pickupCity' },
      { header: 'Price/Day', render: (r) => `${r.currency} ${r.dailyPrice}` },
    ]
  }
};

export default function AdminListingsTable({ type = 'flight' }) {
  const config = TYPE_CONFIG[type];
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: [config.key, page],
    queryFn: () => config.fetcher({ page, pageSize: 10 }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, currentState }) => config.updater(id, { isActive: !currentState }),
    onSuccess: () => {
      queryClient.invalidateQueries([config.key]);
    }
  });

  if (isLoading) return <LoadingSpinner centered />;

  const items = data?.items || [];

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-card">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground font-medium">
            <tr>
              {config.columns.map((col, i) => (
                <th key={i} className="h-10 px-4 align-middle">{col.header}</th>
              ))}
              <th className="h-10 px-4 align-middle">Status</th>
              <th className="h-10 px-4 align-middle text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={config.columns.length + 2} className="p-4 text-center text-muted-foreground">
                  No listings found.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-t hover:bg-muted/50 transition-colors">
                  {config.columns.map((col, i) => (
                    <td key={i} className="p-4 align-middle">
                      {col.render ? col.render(item) : item[col.accessor]}
                    </td>
                  ))}
                  <td className="p-4 align-middle">
                    {item.isActive ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        <CheckCircle className="h-3 w-3" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        <XCircle className="h-3 w-3" /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="p-4 align-middle text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" title="Edit (Coming Soon)">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className={item.isActive ? "text-destructive hover:text-destructive" : "text-green-600 hover:text-green-700"}
                        onClick={() => toggleActiveMutation.mutate({ id: item.id, currentState: item.isActive })}
                        title={item.isActive ? "Deactivate" : "Activate"}
                      >
                        <Power className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination controls could go here */}
    </div>
  );
}