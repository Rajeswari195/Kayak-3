/**
 * @file client/src/features/users/components/user-reviews-list.jsx
 * @description Displays a list of reviews written by the user.
 * * Features:
 * - Fetches reviews from the backend.
 * - Displays a loading spinner while fetching.
 * - Renders a list of ReviewCard components with listing names.
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
          {/* Display the Listing Name (enriched by backend) or fallback to ID */}
          <h4 className="font-bold text-base mb-1">
            {review.listingName || review.listingId}
          </h4>
          
          <h5 className="font-medium text-sm text-muted-foreground">
            {review.title || "No Title"}
          </h5>

          <div className="flex items-center gap-1 mt-2">
             {Array.from({ length: 5 }).map((_, i) => (
               <Star 
                 key={i} 
                 className={`h-4 w-4 ${i < review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} 
               />
             ))}
          </div>
        </div>
        <span className="text-xs text-muted-foreground">
          {new Date(review.createdAt).toLocaleDateString()}
        </span>
      </div>
      
      <p className="mt-3 text-sm leading-relaxed">
        {review.comment}
      </p>

      <div className="mt-3 pt-3 border-t text-xs text-muted-foreground font-mono flex items-center gap-2">
        <span className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-bold">
          {review.listingType}
        </span>
        <span className="opacity-50">ID: {review.listingId}</span>
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
        const response = await getUserReviews();
        setReviews(response.items || []);
      } catch (err) {
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
    <div className="animate-in fade-in duration-500">
      {reviews.map(r => <ReviewCard key={r.id || r._id} review={r} />)}
    </div>
  );
}