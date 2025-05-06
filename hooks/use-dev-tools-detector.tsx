import { useEffect, useState, useRef, useCallback } from 'react';

type DevToolsStatus = {
  isOpen: boolean;
  detectionMethod: 'viewportDifference' | 'debuggerDelay' | null;
};

/**
 * Hook that detects if browser DevTools are open using multiple detection techniques:
 * 1. Viewport difference detection - Compares window outer dimensions with inner dimensions
 * 2. JavaScript execution delay via debugger - Measures execution delay when debugging is active
 * 
 * @returns DevToolsStatus object with isOpen flag and which detection method triggered
 */
export function useDevToolsDetector(): DevToolsStatus {
  const [devToolsStatus, setDevToolsStatus] = useState<DevToolsStatus>({
    isOpen: false,
    detectionMethod: null
  });
  
  const threshold = 160; // Threshold for viewport difference (in pixels)
  const debugDelayThreshold = 100; // Threshold for debugger delay detection (in ms)
  const prevTimeRef = useRef<number>(0);
  const detectionActiveRef = useRef(true);

  // Viewport difference detection (works for side or bottom docked DevTools)
  const detectViewportDifference = useCallback(() => {
    if (!detectionActiveRef.current) return;
    
    const windowOuterWidth = window.outerWidth;
    const windowOuterHeight = window.outerHeight;
    const windowInnerWidth = window.innerWidth;
    const windowInnerHeight = window.innerHeight;
    
    const widthDiff = windowOuterWidth - windowInnerWidth;
    const heightDiff = windowOuterHeight - windowInnerHeight;
    
    // If either difference exceeds the threshold significantly, DevTools are likely open
    const devToolsOpen = widthDiff > threshold || heightDiff > threshold;
    
    if (devToolsOpen && !devToolsStatus.isOpen) {
      setDevToolsStatus({
        isOpen: true,
        detectionMethod: 'viewportDifference'
      });
    }
  }, [devToolsStatus.isOpen, threshold]);
  
  // Debugger delay detection (works when DevTools console/sources tab is active)
  const detectDebuggerDelay = useCallback(() => {
    if (!detectionActiveRef.current) return;
    
    const currentTime = performance.now();
    
    // Skip first run to get a valid time difference
    if (prevTimeRef.current === 0) {
      prevTimeRef.current = currentTime;
      return;
    }
    
    // Insert debugger statement that will pause execution if DevTools is open
    // This creates a significant delay that can be measured
    // eslint-disable-next-line no-debugger
    debugger;
    
    const timeDiff = performance.now() - currentTime;
    if (timeDiff > debugDelayThreshold && !devToolsStatus.isOpen) {
      setDevToolsStatus({
        isOpen: true,
        detectionMethod: 'debuggerDelay'
      });
    }
    
    prevTimeRef.current = performance.now();
  }, [devToolsStatus.isOpen, debugDelayThreshold]);

  // Setup effect - only run once on mount
  useEffect(() => {
    // Run both detection methods on mount
    detectViewportDifference();
    detectDebuggerDelay();
    
    // Set up interval-based checking
    const viewportCheckInterval = setInterval(detectViewportDifference, 1000);
    const debuggerCheckInterval = setInterval(detectDebuggerDelay, 1000);
    
    // Also detect on window resize which happens when DevTools are toggled
    window.addEventListener('resize', detectViewportDifference);
    
    return () => {
      detectionActiveRef.current = false;
      clearInterval(viewportCheckInterval);
      clearInterval(debuggerCheckInterval);
      window.removeEventListener('resize', detectViewportDifference);
    };
  }, [detectViewportDifference, detectDebuggerDelay]);
  
  return devToolsStatus;
}

export default useDevToolsDetector;