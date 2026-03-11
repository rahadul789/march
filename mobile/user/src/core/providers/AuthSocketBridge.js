import { useEffect } from 'react';
import useAuthStore from '../../modules/auth/store/auth.store';
import {
  connectUserSocket,
  disconnectUserSocket,
  setSocketAuthToken
} from '../realtime/socket.gateway';

export default function AuthSocketBridge() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    if (!accessToken) {
      disconnectUserSocket();
      return;
    }

    setSocketAuthToken(accessToken);
    connectUserSocket(accessToken);
  }, [accessToken, hasHydrated]);

  return null;
}
