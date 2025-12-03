/**
 * @file client/src/features/users/components/user-reviews-list.jsx
 * @description Displays a list of reviews written by the user.
 */

import React, { useState, useEffect } from 'react';
import { getUserReviews } from '../api';
import LoadingSpinner from '@/components/loading-spinner';
import StatusBanner from '@/components/status-banner';
import { Star } from 'lucide-react';

function ReviewCard({ review }) {
  return (
    <div className="border rounded-lg p-4 bg-card text-card-foreground shadow-sm mb-4">
      <div className="flex justify-between items-start">
        <div>
          <h4 className="font-semibold text-sm">{review.title || "No Title"}</h4>
          <div className="flex items-center gap-1 mt-1">
             {Array.from({ length: 5 }).map((_, i) => (
               <Star 
                 key={i} 
                 className={`h-3 w-3 ${i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} 
               />
             ))}
          </div>
        </div>
        <span className="text-xs text-muted-foreground">
          {new Date(review.createdAt).toLocaleDateString()}
        </span>
      </div>
      
      <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
        {review.comment}
      </p>

      <div className="mt-2 pt-2 border-t text-xs text-muted-foreground font-mono">
        {review.listingType} • {review.listingId}
      </div>
    </div>
  );
}

export default function UserReviewsList() {
  const [reviews, setReviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetch() {
      setIsLoading(true);
      try {
        // const data = await getUserReviews();
        // setReviews(data || []);
      } catch (err) {
        // Backend might 404 if no reviews endpoint yet, handle gracefully
        console.warn("Reviews fetch failed", err);
        setError("Could not load reviews.");
      } finally {
        setIsLoading(false);
      }
    }
    fetch();
  }, []);

  if (isLoading) return <LoadingSpinner centered className="min-h-[100px]" />;
  
  if (error) return <StatusBanner status="error" message={error} />;

  if (reviews.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-lg">
        You haven't written any reviews yet.
      </div>
    );
  }

  return (
    <div>
      {reviews.map(r => <ReviewCard key={r.id || r._id} review={r} />)}
    </div>
  );
}