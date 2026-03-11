import { QueryClientProvider } from '@tanstack/react-query';
import { setupAuthInterceptors } from '../api/authInterceptor';
import queryClient from '../query/queryClient';

setupAuthInterceptors();

export default function AppProviders({ children }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
