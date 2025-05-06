import React, { useRef, useState, useEffect } from "react";

/**
 * A hook that uses IntersectionObserver to detect when an element enters the viewport
 */
export const useIntersectionObserver = (options = {}) => {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [entry, setEntry] = React.useState<IntersectionObserverEntry | null>(null);
  const [isVisible, setIsVisible] = React.useState(false);

  React.useEffect(() => {
    if (ref.current) {
      const observer = new IntersectionObserver(([entry]) => {
        setEntry(entry);
        setIsVisible(entry.isIntersecting);
      }, options);
      
      observer.observe(ref.current);
      
      return () => {
        observer.disconnect();
      };
    }
    return undefined;
  }, [ref, options]);

  return { ref, entry, isVisible };
};