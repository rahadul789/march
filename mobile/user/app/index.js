import { Redirect } from 'expo-router';
import useAuthStore from '../src/modules/auth/store/auth.store';
import RouteHydrationLoader from '../src/core/ui/RouteHydrationLoader';

export default function IndexScreen() {
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const isAuthenticated = useAuthStore((state) =>
    Boolean(state.accessToken && state.refreshToken && state.user)
  );

  if (!hasHydrated) {
    return <RouteHydrationLoader />;
  }

  if (isAuthenticated) {
    return <Redirect href="/(protected)/home" />;
  }

  return <Redirect href="/(auth)/login" />;
}
