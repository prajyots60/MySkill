import { useState, useCallback, useRef, useEffect } from 'react'

type StateOptions<T> = {
  debounce?: number
  throttle?: number
  onChange?: (value: T) => void
  equalityFn?: (a: T, b: T) => boolean
  batchUpdates?: boolean
}

/**
 * Hook for optimized state management with debounce, throttle, and batching
 * Helps prevent unnecessary re-renders and optimize performance
 */
export function useOptimizedState<T>(
  initialValue: T | (() => T),
  options: StateOptions<T> = {}
) {
  // Default options
  const {
    debounce = 0,
    throttle = 0,
    onChange,
    equalityFn = (a, b) => a === b,
    batchUpdates = false,
  } = options

  // Internal state
  const [state, setState] = useState<T>(initialValue)
  
  // Refs to avoid recreating functions on each render
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastUpdateRef = useRef<number>(0)
  const pendingValueRef = useRef<T | null>(null)
  const isMountedRef = useRef(false)
  const valueRef = useRef<T>(state)

  // Keep valueRef in sync with state
  useEffect(() => {
    valueRef.current = state
  }, [state])

  // Set mounted flag
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  // Apply pending update if any
  const applyUpdate = useCallback(() => {
    if (pendingValueRef.current !== null && isMountedRef.current) {
      const newValue = pendingValueRef.current
      pendingValueRef.current = null
      
      // Only update if value has changed
      if (!equalityFn(newValue, valueRef.current)) {
        setState(newValue)
        onChange?.(newValue)
      }
    }
  }, [equalityFn, onChange])

  // Set state with optimizations
  const setOptimizedState = useCallback(
    (value: T | ((prevState: T) => T)) => {
      // Resolve the value if it's a function
      const newValue = typeof value === 'function' 
        ? (value as ((prevState: T) => T))(valueRef.current) 
        : value
      
      // Skip update if value hasn't changed
      if (equalityFn(newValue, valueRef.current)) {
        return
      }

      // Store the pending value
      pendingValueRef.current = newValue
      
      // Handle throttling
      if (throttle > 0) {
        const now = Date.now()
        const timeSinceLastUpdate = now - lastUpdateRef.current
        
        if (timeSinceLastUpdate >= throttle) {
          // Update immediately if throttle time has passed
          lastUpdateRef.current = now
          applyUpdate()
        } else if (!timeoutRef.current || !batchUpdates) {
          // Schedule update after throttle time
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
          }
          
          timeoutRef.current = setTimeout(() => {
            lastUpdateRef.current = Date.now()
            applyUpdate()
            timeoutRef.current = null
          }, throttle - timeSinceLastUpdate)
        }
        return
      }
      
      // Handle debouncing
      if (debounce > 0) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
        
        timeoutRef.current = setTimeout(() => {
          applyUpdate()
          timeoutRef.current = null
        }, debounce)
        return
      }
      
      // No throttle or debounce, update immediately
      applyUpdate()
    },
    [applyUpdate, debounce, throttle, equalityFn, batchUpdates]
  )

  // Force immediate update bypassing throttle/debounce
  const forceUpdate = useCallback((value: T) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    
    pendingValueRef.current = null
    
    if (!equalityFn(value, valueRef.current)) {
      setState(value)
      valueRef.current = value
      onChange?.(value)
    }
  }, [equalityFn, onChange])

  // Get the current value, including any pending updates
  const getCurrentValue = useCallback(() => {
    return pendingValueRef.current !== null ? pendingValueRef.current : valueRef.current
  }, [])

  return [state, setOptimizedState, { forceUpdate, getCurrentValue }] as const
}

export default useOptimizedState
