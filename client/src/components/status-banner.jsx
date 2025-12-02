/**
 * @file client/src/components/status-banner.jsx
 * @description A component to display status messages, alerts, and error codes.
 * * Features:
 * - Variants for Error, Success, and Info.
 * - Displays a specific "Code" badge if an error code is provided (e.g. `invalid_user_id`).
 * - Used in forms and dashboards to provide feedback.
 * * @dependencies
 * - lucide-react: For icons.
 * - @/lib/utils: For class merging.
 */

import React from 'react';
import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const VARIANT_STYLES = {
  error: "bg-destructive/15 text-destructive border-destructive/20",
  success: "bg-green-100 text-green-800 border-green-200",
  info: "bg-blue-50 text-blue-800 border-blue-200",
};

const VARIANT_ICONS = {
  error: XCircle,
  success: CheckCircle2,
  info: Info,
};

/**
 * StatusBanner Component
 * * @param {Object} props
 * @param {'error'|'success'|'info'} [props.status='info'] - Type of message.
 * @param {string} [props.message] - Main text message to display.
 * @param {string} [props.code] - Optional error code (e.g. 'invalid_user_id').
 * @param {string} [props.className] - Additional classes.
 * @param {boolean} [props.closable] - (Optional) Whether to show a close button (visual only for now).
 * @param {Function} [props.onClose] - Callback when close button is clicked.
 */
export default function StatusBanner({ 
  status = 'info', 
  message, 
  code, 
  className, 
  closable = false,
  onClose 
}) {
  if (!message && !code) return null;

  const Icon = VARIANT_ICONS[status] || Info;
  const styles = VARIANT_STYLES[status] || VARIANT_STYLES.info;

  return (
    <div className={cn(
      "flex items-start gap-3 p-4 rounded-md border text-sm animate-in fade-in slide-in-from-top-1",
      styles,
      className
    )}>
      <Icon className="h-5 w-5 shrink-0 mt-0.5" />
      
      <div className="flex-1 flex flex-col gap-1">
        {message && (
          <p className="font-medium leading-relaxed">
            {message}
          </p>
        )}
        
        {code && (
          <div className="mt-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-white/50 border border-black/5 uppercase tracking-wide">
              Code: {code}
            </span>
          </div>
        )}
      </div>

      {closable && onClose && (
        <button 
          onClick={onClose}
          className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Close"
        >
          <XCircle className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}