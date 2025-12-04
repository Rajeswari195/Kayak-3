/**
 * @file client/src/ui/textarea.jsx
 * @description A reusable Textarea component.
 * * Features:
 * - Consistent border, padding, and focus states with Input.
 * - Supports disabled state.
 * * @dependencies
 * - @/lib/utils: For class merging.
 */

import React from "react";
import { cn } from "@/lib/utils";

/**
 * Textarea Component
 * * @param {Object} props - Standard textarea props
 * * @param {string} [props.className] - Additional classes
 * * @param {React.Ref<HTMLTextAreaElement>} ref
 */
const Textarea = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});

Textarea.displayName = "Textarea";

export { Textarea };