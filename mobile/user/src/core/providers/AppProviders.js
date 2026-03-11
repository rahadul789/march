import { QueryClientProvider } from '@tanstack/react-query';
import { setupAuthInterceptors } from '../api/authInterceptor';
import queryClient from '../query/queryClient';
import AuthSocketBridge from './AuthSocketBridge';

setupAuthInterceptors();

export default function AppProviders({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthSocketBridge />
      {children}
    </QueryClientProvider>
  );
}
