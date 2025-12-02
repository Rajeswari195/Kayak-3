/**
 * @file client/src/components/loading-spinner.jsx
 * @description A unified loading spinner component.
 * * Features:
 * - Uses SVG animation via Tailwind `animate-spin`.
 * - Configurable size and color.
 * - Center alignment helper option.
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * LoadingSpinner Component
 * * @param {Object} props
 * @param {string} [props.className] - Additional classes.
 * @param {boolean} [props.centered] - If true, wraps spinner in a full-width/height flex container.
 * @param {number} [props.size] - Size in pixels (default 24).
 */
export default function LoadingSpinner({ 
  className, 
  centered = false, 
  size = 24 
}) {
  const spinner = (
    <Loader2 
      className={cn("animate-spin text-primary", className)} 
      size={size} 
      aria-label="Loading..."
    />
  );

  if (centered) {
    return (
      <div className="flex items-center justify-center w-full h-full min-h-[100px] p-4">
        {spinner}
      </div>
    );
  }

  return spinner;
}