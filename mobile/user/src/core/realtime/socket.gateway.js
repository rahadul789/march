import { io } from 'socket.io-client';
import { API_BASE_URL } from '../config/env';

function toSocketBaseUrl() {
  return API_BASE_URL.replace(/\/api\/v\d+\/?$/, '');
}

let socketInstance = null;

export function connectUserSocket(accessToken) {
  if (!accessToken) {
    return null;
  }

  if (socketInstance && socketInstance.connected) {
    return socketInstance;
  }

  socketInstance = io(toSocketBaseUrl(), {
    transports: ['websocket'],
    auth: {
      token: accessToken
    }
  });

  return socketInstance;
}

export function disconnectUserSocket() {
  if (!socketInstance) {
    return;
  }

  socketInstance.disconnect();
  socketInstance = null;
}
