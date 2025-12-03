/**
 * @file client/src/features/users/components/booking-history-list.jsx
 * @description Displays a list of bookings for the user profile.
 * * Features:
 * - Fetches bookings on mount.
 * - Tabs for Past, Current, Future.
 * - Displays booking cards with status badges.
 */

import React, { useState, useEffect } from 'react';
import { getUserBookings } from '../api';
import { Button } from '@/ui/button';
import LoadingSpinner from '@/components/loading-spinner';
import StatusBanner from '@/components/status-banner';
import { Calendar, Plane, Building, Car, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'current', label: 'Current' },
  { id: 'future', label: 'Upcoming' },
  { id: 'past', label: 'Past' }
];

const ICONS = {
  FLIGHT: Plane,
  HOTEL: Building,
  CAR: Car
};

function BookingCard({ booking }) {
  // A booking might have multiple items, but usually the header has the status/total.
  // We'll show the items briefly.
  const statusColors = {
    CONFIRMED: "bg-green-100 text-green-800",
    PENDING: "bg-yellow-100 text-yellow-800",
    CANCELED: "bg-gray-100 text-gray-800",
    FAILED: "bg-red-100 text-red-800"
  };

  return (
    <div className="border rounded-lg p-4 bg-card text-card-foreground shadow-sm mb-4">
      <div className="flex justify-between items-start mb-2">
        <div>
          <span className="text-xs font-mono text-muted-foreground">Ref: {booking.bookingReference}</span>
          <div className="font-semibold text-lg flex items-center gap-2">
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", statusColors[booking.status] || "bg-gray-100")}>
              {booking.status}
            </span>
            <span>{booking.currency} {booking.totalAmount.toFixed(2)}</span>
          </div>
        </div>
        <div className="text-right text-sm">
          <div className="flex items-center gap-1 text-muted-foreground justify-end">
            <Calendar className="h-3 w-3" />
            <span>{booking.startDate}</span>
          </div>
          {booking.endDate && (
            <div className="text-xs text-muted-foreground">to {booking.endDate}</div>
          )}
        </div>
      </div>

      {/* Booking Items Preview */}
      <div className="space-y-2 mt-3 border-t pt-2">
        {booking.items && booking.items.map((item) => {
          const Icon = ICONS[item.itemType] || AlertCircle;
          return (
            <div key={item.id} className="flex items-center gap-3 text-sm">
              <div className="p-2 bg-muted rounded-md">
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="font-medium">
                  {item.itemType}
                  {item.quantity > 1 && <span className="text-muted-foreground text-xs ml-1">x{item.quantity}</span>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.unitPrice} {item.currency}
                </p>
              </div>
              <div className="font-medium">
                {item.totalPrice} {item.currency}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function BookingHistoryList() {
  const [activeTab, setActiveTab] = useState('future');
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function fetch() {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch ALL bookings and filter client-side for smoother UX, 
        // or fetch by scope if list is huge. Given requirement, we fetch per scope or all.
        // Let's fetch all via specific scope calls or just one call if API supports it.
        // The API getUserBookings({ scope }) supports scope.
        // We'll fetch the active scope.
        const response = await getUserBookings({ scope: activeTab });
        if (mounted) setBookings(response.data?.bookings || []);
      } catch (err) {
        if (mounted) setError(err.message || "Failed to load bookings");
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    fetch();

    return () => { mounted = false; };
  }, [activeTab]);

  return (
    <div className="space-y-4">
      <div className="flex space-x-1 bg-muted p-1 rounded-md w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-sm transition-all",
              activeTab === tab.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/50"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingSpinner centered className="min-h-[200px]" />
      ) : error ? (
        <StatusBanner status="error" message={error} />
      ) : bookings.length === 0 ? (
        <div className="text-center py-10 border border-dashed rounded-lg text-muted-foreground">
          <p>No {activeTab} bookings found.</p>
        </div>
      ) : (
        <div>
          {bookings.map(b => (
            <BookingCard key={b.id} booking={b} />
          ))}
        </div>
      )}
    </div>
  );
}