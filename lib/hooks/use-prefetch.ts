import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

/**
 * A custom hook that provides prefetching capabilities for both navigation and data
 * 
 * @returns A function to prefetch a route and optionally associated data
 */
export function usePrefetch() {
  const router = useRouter();
  const queryClient = useQueryClient();

  /**
   * Prefetch a route and optionally associated data
   * 
   * @param href - The route to prefetch
   * @param queryKey - Optional query key to prefetch data for
   * @param queryFn - Optional function to fetch data if not already in cache
   */
  const prefetch = useCallback(
    (href: string, queryKey?: unknown[], queryFn?: () => Promise<unknown>) => {
      // Prefetch the route
      router.prefetch(href);

      // If a query key and function are provided, prefetch the data
      if (queryKey && queryFn) {
        // Only fetch if not already in cache or stale
        const existingData = queryClient.getQueryData(queryKey);
        if (!existingData) {
          queryClient.prefetchQuery({
            queryKey,
            queryFn,
            staleTime: 60 * 1000, // 1 minute
          });
        }
      }
    },
    [router, queryClient]
  );

  return prefetch;
}

export default usePrefetch;
