/**
 * @file client/src/lib/utils.js
 * @description Shared utility functions for the frontend.
 * * Includes:
 * - cn: A helper to merge Tailwind CSS classes conditionally and intelligently.
 */

import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names with tailwind-merge to handle conflicts.
 * * @param {...(string|undefined|null|false)} inputs - Class names or conditional expressions.
 * @returns {string} - The merged class string.
 * * @example
 * cn("p-4 bg-red-500", isActive && "bg-blue-500") 
 * // Returns "p-4 bg-blue-500" (correctly overriding bg-red-500)
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}