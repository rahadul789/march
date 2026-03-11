import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { normalizeApiError } from '../errors/errorUtils';
import useErrorStore from '../store/error.store';

function reportGlobalError(error) {
  const normalized = normalizeApiError(error);
  useErrorStore.getState().setGlobalError(normalized);
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      reportGlobalError(error);
    }
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      reportGlobalError(error);
    }
  }),
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
      staleTime: 30000
    },
    mutations: {
      retry: 0
    }
  }
});

export default queryClient;
