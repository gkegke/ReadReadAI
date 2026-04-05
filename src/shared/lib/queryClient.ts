import { QueryClient } from "@tanstack/react-query";

/**
 * [ARCHITECTURE] Singleton QueryClient
 * Standardizes cache management across React components and
 * non-component services/mutations.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});
