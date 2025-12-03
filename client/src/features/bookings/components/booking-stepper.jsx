/**
 * @file client/src/features/bookings/components/booking-stepper.jsx
 * @description Visual stepper for multi-stage booking flows.
 */

import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function BookingStepper({ currentStep, steps = ["Review", "Payment", "Confirmed"] }) {
  return (
    <div className="flex items-center justify-center space-x-4 mb-8">
      {steps.map((label, index) => {
        const stepNum = index + 1;
        const isCompleted = stepNum < currentStep;
        const isActive = stepNum === currentStep;

        return (
          <div key={label} className="flex items-center">
            {/* Line connector (skip for first item) */}
            {index > 0 && (
              <div className={cn(
                "h-[2px] w-8 md:w-16 mx-2 md:mx-4",
                stepNum <= currentStep ? "bg-primary" : "bg-muted"
              )} />
            )}

            <div className="flex flex-col items-center gap-1">
              <div 
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border-2 transition-colors",
                  isCompleted ? "bg-primary border-primary text-primary-foreground" :
                  isActive ? "border-primary text-primary" :
                  "border-muted text-muted-foreground"
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : stepNum}
              </div>
              <span className={cn(
                "text-xs font-medium",
                isActive ? "text-foreground" : "text-muted-foreground"
              )}>
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}