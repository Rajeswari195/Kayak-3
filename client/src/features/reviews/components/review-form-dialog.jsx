/**
 * @file client/src/features/reviews/components/review-form-dialog.jsx
 * @description Dialog for submitting a review for a booking.
 */

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createReview } from '../api';
import { Modal } from '@/ui/modal';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Textarea } from '@/ui/textarea';
import StatusBanner from '@/components/status-banner';
import LoadingSpinner from '@/components/loading-spinner';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ReviewFormDialog({ isOpen, onClose, bookingItem, bookingId }) {
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [formData, setFormData] = useState({
    title: '',
    comment: ''
  });

  const mutation = useMutation({
    mutationFn: createReview,
    onSuccess: () => {
      queryClient.invalidateQueries(['my-reviews']);
      onClose();
    }
  });

  if (!bookingItem) return null;

  // Determine listing ID based on item type
  const listingId = bookingItem.flightId || bookingItem.hotelId || bookingItem.carId;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!listingId) return;

    mutation.mutate({
      listingType: bookingItem.itemType,
      listingId,
      bookingId,
      rating,
      title: formData.title,
      comment: formData.comment
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Review your ${bookingItem.itemType.toLowerCase()}`}
      className="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium">Rating</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className="focus:outline-none transition-transform hover:scale-110"
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setRating(star)}
              >
                <Star
                  className={cn(
                    "h-8 w-8 transition-colors",
                    (hoverRating || rating) >= star
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground/30"
                  )}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="title" className="text-sm font-medium">Headline</label>
          <Input
            id="title"
            placeholder="Summarize your experience"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="comment" className="text-sm font-medium">Review</label>
          <Textarea
            id="comment"
            placeholder="What did you like or dislike?"
            value={formData.comment}
            onChange={(e) => setFormData(prev => ({ ...prev, comment: e.target.value }))}
            className="min-h-[100px]"
            required
          />
        </div>

        {mutation.isError && (
          <StatusBanner 
            status="error" 
            message={mutation.error?.message || "Failed to submit review."} 
          />
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? (
              <>
                <LoadingSpinner className="mr-2 h-4 w-4" />
                Submitting...
              </>
            ) : "Submit Review"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}