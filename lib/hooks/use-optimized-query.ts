import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

type QueryOptions = {
  staleTime?: number;
  cacheTime?: number;
  refetchOnWindowFocus?: boolean;
  refetchOnMount?: boolean;
  refetchInterval?: number | false;
  retry?: number | boolean;
  retryDelay?: number | ((retryAttempt: number) => number);
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
};

type QueryState<T> = {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  isFetching: boolean;
};

/**
 * A custom hook that optimizes React Query usage with additional performance features
 * 
 * @param queryFn - A function that returns a React Query hook
 * @param options - Query options
 * @returns Query state with data, loading, and error
 */
export function useOptimizedQuery<T>(
  queryFn: () => { data: T | undefined; isLoading: boolean; error: unknown; refetch: () => Promise<any>; isRefetching: boolean },
  options: QueryOptions = {}
): QueryState<T> & { refetch: () => Promise<any> } {
  const {
    staleTime = 0,
    cacheTime = 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus = false,
    refetchOnMount = true,
    refetchInterval = false,
    retry = 1,
    retryDelay = 1000,
    onSuccess,
    onError,
  } = options;

  // Use the React Query hook
  const query = queryFn();
  
  // Local state for optimized data handling
  const [state, setState] = useState<QueryState<T>>({
    data: query.data || null,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    isFetching: query.isRefetching,
  });

  // Cache reference to prevent unnecessary re-renders
  const dataRef = useRef<T | null>(null);
  const queryClient = useQueryClient();

  // Update local state when query state changes
  useEffect(() => {
    if (query.data !== undefined && query.data !== dataRef.current) {
      dataRef.current = query.data;
      setState(prev => ({
        ...prev,
        data: query.data || null,
        isLoading: false,
      }));

      // Call onSuccess callback if provided
      if (onSuccess && query.data) {
        onSuccess(query.data);
      }
    }

    if (query.error && !state.error) {
      setState(prev => ({
        ...prev,
        error: query.error as Error,
        isLoading: false,
      }));

      // Call onError callback if provided
      if (onError) {
        onError(query.error);
      }
    }

    if (query.isLoading !== state.isLoading) {
      setState(prev => ({
        ...prev,
        isLoading: query.isLoading,
      }));
    }

    if (query.isRefetching !== state.isFetching) {
      setState(prev => ({
        ...prev,
        isFetching: query.isRefetching,
      }));
    }
  }, [query.data, query.error, query.isLoading, query.isRefetching, state.error, state.isLoading, state.isFetching, onSuccess, onError]);

  // Optimized refetch function
  const refetch = useCallback(async () => {
    setState(prev => ({ ...prev, isFetching: true }));
    try {
      const result = await query.refetch();
      return result;
    } catch (error) {
      setState(prev => ({ ...prev, error: error as Error }));
      throw error;
    } finally {
      setState(prev => ({ ...prev, isFetching: false }));
    }
  }, [query]);

  return {
    ...state,
    refetch,
  };
}

export default useOptimizedQuery;
