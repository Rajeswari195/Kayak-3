/**
 * @file client/src/ui/dropdown-menu.jsx
 * @description Reusable Dropdown Menu components built on top of Radix UI primitives (simulated here for standard React/Tailwind).
 * * Features:
 * - Simple composition: Trigger, Content, Item, Label, Separator.
 * - Tailwind styling for consistent look.
 */

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

const DropdownMenuContext = React.createContext({
  isOpen: false,
  setIsOpen: () => {},
});

export const DropdownMenu = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <DropdownMenuContext.Provider value={{ isOpen, setIsOpen }}>
      <div className="relative inline-block text-left" ref={containerRef}>
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
};

export const DropdownMenuTrigger = ({ children, asChild }) => {
  const { isOpen, setIsOpen } = React.useContext(DropdownMenuContext);
  
  const child = asChild ? React.Children.only(children) : children;
  
  return React.cloneElement(child, {
    onClick: (e) => {
      if (child.props.onClick) child.props.onClick(e);
      setIsOpen(!isOpen);
    },
    'aria-expanded': isOpen,
  });
};

export const DropdownMenuContent = ({ children, className, align = 'start' }) => {
  const { isOpen } = React.useContext(DropdownMenuContext);

  if (!isOpen) return null;

  const alignmentClasses = {
    start: 'left-0',
    end: 'right-0',
    center: 'left-1/2 -translate-x-1/2',
  };

  return (
    <div
      className={cn(
        "absolute z-50 mt-2 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-80 zoom-in-95 data-[side=bottom]:slide-in-from-top-2",
        alignmentClasses[align],
        className
      )}
    >
      {children}
    </div>
  );
};

export const DropdownMenuItem = ({ children, className, onClick, asChild }) => {
  const { setIsOpen } = React.useContext(DropdownMenuContext);

  const handleClick = (e) => {
    if (onClick) onClick(e);
    setIsOpen(false); // Close menu on item click
  };

  const baseClass = cn(
    "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 cursor-pointer",
    className
  );

  if (asChild) {
    const child = React.Children.only(children);
    return React.cloneElement(child, {
      className: cn(baseClass, child.props.className),
      onClick: (e) => {
        if (child.props.onClick) child.props.onClick(e);
        handleClick(e);
      }
    });
  }

  return (
    <div className={baseClass} onClick={handleClick}>
      {children}
    </div>
  );
};

export const DropdownMenuLabel = ({ children, className }) => (
  <div className={cn("px-2 py-1.5 text-sm font-semibold", className)}>
    {children}
  </div>
);

export const DropdownMenuSeparator = ({ className }) => (
  <div className={cn("-mx-1 my-1 h-px bg-muted", className)} />
);