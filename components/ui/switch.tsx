"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

// Create a simple Switch implementation without local state management
const Switch = React.forwardRef<
  HTMLButtonElement, 
  { 
    className?: string;
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    id?: string;
    disabled?: boolean;
  }
>(({ className, checked = false, onCheckedChange, id, disabled, ...props }, ref) => {
  // Handle click without causing infinite loops
  const handleClick = React.useCallback(() => {
    if (disabled) return;
    
    // Simply call the callback with the new value
    if (onCheckedChange) {
      onCheckedChange(!checked);
    }
  }, [checked, onCheckedChange, disabled]);
  
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      data-state={checked ? "checked" : "unchecked"}
      disabled={disabled}
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-input",
        className
      )}
      onClick={handleClick}
      ref={ref}
      {...props}
    >
      <span 
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform absolute",
          checked ? "translate-x-5" : "translate-x-0"
        )}
        style={{ transform: checked ? 'translateX(1.25rem)' : 'translateX(0)' }}
      />
    </button>
  );
});

Switch.displayName = "Switch";

export { Switch }
