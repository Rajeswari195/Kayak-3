/**
 * @file client/src/ui/modal.jsx
 * @description A lightweight, reusable Modal/Dialog component.
 * * Features:
 * - Backdrop blur.
 * - Centered content.
 * - Animation (fade-in/scale).
 * - Click-outside to close.
 * - Escape key to close.
 */

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Modal({ isOpen, onClose, title, children, className }) {
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden'; // Prevent scrolling bg
    }
    
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity animate-in fade-in duration-200" 
        onClick={onClose}
      />

      {/* Dialog Content */}
      <div 
        className={cn(
          "relative bg-background w-full max-w-lg rounded-lg shadow-lg border animate-in zoom-in-95 duration-200",
          className
        )}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <button 
            onClick={onClose}
            className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}