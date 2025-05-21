'use client';

import { useState, useCallback } from 'react';

interface RetryConfig {
  maxRetries: number;
  retryStrategy: 'linear' | 'exponential' | 'fibonacci';
  initialDelay: number;  // in ms
  maxDelay?: number;     // in ms
  jitter?: boolean;      // add randomness to delay
}

interface RetryHistoryEntry {
  timestamp: number;
  attemptNumber: number;
  delay: number;
  error?: string;
}

interface RetryState {
  attemptCount: number;
  retryHistory: RetryHistoryEntry[];
  success: boolean;
  lastError?: Error;
  isRetrying: boolean;
}

export function useUploadErrorHandler(defaultConfig?: Partial<RetryConfig>) {
  const [retryConfig, setRetryConfig] = useState<RetryConfig>({
    maxRetries: defaultConfig?.maxRetries ?? 5,
    retryStrategy: defaultConfig?.retryStrategy ?? 'exponential',
    initialDelay: defaultConfig?.initialDelay ?? 1000,
    maxDelay: defaultConfig?.maxDelay ?? 30000,
    jitter: defaultConfig?.jitter ?? true,
  });

  const [retryState, setRetryState] = useState<RetryState>({
    attemptCount: 0,
    retryHistory: [],
    success: false,
    isRetrying: false,
  });

  /**
   * Calculate retry delay based on strategy
   */
  const calculateDelay = useCallback((attempt: number): number => {
    const { retryStrategy, initialDelay, maxDelay = 30000, jitter } = retryConfig;
    
    let delay: number;
    
    switch (retryStrategy) {
      case 'linear':
        delay = initialDelay * attempt;
        break;
        
      case 'exponential':
        delay = initialDelay * Math.pow(2, attempt - 1);
        break;
        
      case 'fibonacci':
        delay = calculateFibonacciDelay(attempt, initialDelay);
        break;
        
      default:
        delay = initialDelay;
    }
    
    // Apply maximum delay
    delay = Math.min(delay, maxDelay);
    
    // Apply jitter (±30%) if enabled
    if (jitter) {
      const jitterFactor = 0.3; // 30% jitter
      const randomFactor = 1 - jitterFactor + (Math.random() * jitterFactor * 2);
      delay = Math.floor(delay * randomFactor);
    }
    
    return delay;
  }, [retryConfig]);
  
  /**
   * Calculate Fibonacci sequence delay
   */
  const calculateFibonacciDelay = (attempt: number, initialDelay: number): number => {
    if (attempt <= 0) return 0;
    if (attempt === 1) return initialDelay;
    
    let prev = 0;
    let current = 1;
    
    for (let i = 2; i <= attempt; i++) {
      const next = prev + current;
      prev = current;
      current = next;
    }
    
    return current * initialDelay;
  };

  /**
   * Execute a function with retries
   */
  const executeWithRetry = useCallback(async <T,>(
    fn: () => Promise<T>,
    onRetry?: (attempt: number, delay: number, error: Error) => void,
    onBeforeAttempt?: (attempt: number) => void,
  ): Promise<T> => {
    let attemptCount = 0;
    const retryHistory: RetryHistoryEntry[] = [];
    
    setRetryState(prev => ({
      ...prev,
      attemptCount: 0,
      retryHistory: [],
      isRetrying: false,
      lastError: undefined,
    }));
    
    const execute = async (): Promise<T> => {
      attemptCount++;
      
      try {
        if (onBeforeAttempt) {
          onBeforeAttempt(attemptCount);
        }
        
        setRetryState(prev => ({
          ...prev,
          attemptCount,
          isRetrying: attemptCount > 1,
        }));
        
        const result = await fn();
        
        setRetryState(prev => ({
          ...prev,
          success: true,
          isRetrying: false,
        }));
        
        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        
        // Record the error in history
        const now = Date.now();
        
        if (attemptCount <= retryConfig.maxRetries) {
          const delay = calculateDelay(attemptCount);
          
          retryHistory.push({
            timestamp: now,
            attemptNumber: attemptCount,
            delay,
            error: err.message,
          });
          
          setRetryState(prev => ({
            ...prev,
            attemptCount,
            retryHistory: [...retryHistory],
            isRetrying: true,
            lastError: err,
          }));
          
          if (onRetry) {
            onRetry(attemptCount, delay, err);
          }
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Try again
          return execute();
        } else {
          // No more retries left
          setRetryState(prev => ({
            ...prev,
            isRetrying: false,
            success: false,
            lastError: err,
            retryHistory: [...retryHistory],
          }));
          
          throw err;
        }
      }
    };
    
    return execute();
  }, [retryConfig, calculateDelay]);

  /**
   * Update retry configuration
   */
  const updateRetryConfig = useCallback((config: Partial<RetryConfig>) => {
    setRetryConfig(prev => ({
      ...prev,
      ...config,
    }));
  }, []);
  
  /**
   * Reset retry state
   */
  const resetRetryState = useCallback(() => {
    setRetryState({
      attemptCount: 0,
      retryHistory: [],
      success: false,
      isRetrying: false,
    });
  }, []);

  return {
    executeWithRetry,
    updateRetryConfig,
    resetRetryState,
    retryState,
    retryConfig,
  };
}

export default useUploadErrorHandler;
