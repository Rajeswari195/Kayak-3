/**
 * @file client/src/ui/input.jsx
 * @description A reusable Input component.
 * * Features:
 * - consistent border, padding, and focus states.
 * - supports disabled state.
 * - integrates with tailwind typography classes.
 * * @dependencies
 * - @/lib/utils: For class merging.
 */

import React from "react";
import { cn } from "@/lib/utils";

/**
 * Input Component
 * * @param {Object} props - Standard input props
 * @param {string} [props.className] - Additional classes
 * @param {string} [props.type] - Input type (text, password, etc.)
 * @param {React.Ref<HTMLInputElement>} ref - Ref to the input element
 */
const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});

Input.displayName = "Input";

export { Input };