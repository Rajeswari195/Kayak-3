/**
 * @file client/src/app/profile/profile-page.jsx
 * @description Main user profile page.
 * * Layout:
 * - Left: Profile Edit Form.
 * - Right: Tabs for Bookings and Reviews.
 */

import React from 'react';
import ProfileForm from '@/features/users/components/profile-form';
import BookingHistoryList from '@/features/users/components/booking-history-list';
import UserReviewsList from '@/features/users/components/user-reviews-list';
import { cn } from '@/lib/utils';

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground">
          Manage your profile, view bookings, and check your reviews.
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Profile Form (lg: 5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">Profile Details</h2>
              <ProfileForm />
            </div>
          </div>
        </div>

        {/* Right Column: Bookings & Reviews (lg: 7 cols) */}
        <div className="lg:col-span-7 space-y-6">
           <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
             <div className="p-6">
               <h2 className="text-xl font-semibold mb-4">My Bookings</h2>
               <BookingHistoryList />
             </div>
           </div>

           <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
             <div className="p-6">
               <h2 className="text-xl font-semibold mb-4">My Reviews</h2>
               <UserReviewsList />
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}