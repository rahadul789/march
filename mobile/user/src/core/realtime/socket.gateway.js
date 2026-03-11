import { io } from 'socket.io-client';
import { API_BASE_URL } from '../config/env';

const SOCKET_ACK_TIMEOUT_MS = 5000;

let socketInstance = null;
let currentAccessToken = null;
const trackedOrderSubscriptions = new Set();

function toSocketBaseUrl() {
  return API_BASE_URL.replace(/\/api\/v\d+\/?$/, '');
}

function applySocketAuth() {
  if (!socketInstance) {
    return;
  }

  socketInstance.auth = {
    token: currentAccessToken,
    orderIds: Array.from(trackedOrderSubscriptions)
  };
}

function emitWithAck(eventName, payload) {
  return new Promise((resolve) => {
    if (!socketInstance || !socketInstance.connected) {
      resolve({
        ok: false,
        reason: 'SOCKET_NOT_CONNECTED'
      });
      return;
    }

    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve({
          ok: false,
          reason: 'SOCKET_ACK_TIMEOUT'
        });
      }
    }, SOCKET_ACK_TIMEOUT_MS);

    socketInstance.emit(eventName, payload, (ack) => {
      if (settled) {
        return;
      }

      clearTimeout(timeout);
      settled = true;
      resolve(ack || { ok: false, reason: 'EMPTY_ACK' });
    });
  });
}

function bindSocketLifecycleOnce() {
  if (!socketInstance || socketInstance.__marchLifecycleBound) {
    return;
  }

  socketInstance.__marchLifecycleBound = true;
  socketInstance.on('connect', () => {
    applySocketAuth();

    for (const orderId of trackedOrderSubscriptions) {
      socketInstance.emit('order:subscribe', { orderId });
    }
  });
}

export function getUserSocket() {
  return socketInstance;
}

export function setSocketAuthToken(accessToken) {
  currentAccessToken = accessToken || null;
  applySocketAuth();
}

export function connectUserSocket(accessToken) {
  if (!accessToken) {
    return null;
  }

  currentAccessToken = accessToken;

  if (!socketInstance) {
    socketInstance = io(toSocketBaseUrl(), {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000
    });
  }

  applySocketAuth();
  bindSocketLifecycleOnce();

  if (!socketInstance.connected) {
    socketInstance.connect();
  }

  return socketInstance;
}

export async function subscribeToOrderRoom(orderId) {
  const normalizedOrderId = String(orderId || '').trim();
  if (!normalizedOrderId) {
    return {
      ok: false,
      reason: 'INVALID_ORDER_ID'
    };
  }

  trackedOrderSubscriptions.add(normalizedOrderId);
  applySocketAuth();

  if (!socketInstance || !socketInstance.connected) {
    return {
      ok: true,
      queued: true
    };
  }

  return emitWithAck('order:subscribe', { orderId: normalizedOrderId });
}

export async function unsubscribeFromOrderRoom(orderId) {
  const normalizedOrderId = String(orderId || '').trim();
  if (!normalizedOrderId) {
    return {
      ok: false,
      reason: 'INVALID_ORDER_ID'
    };
  }

  trackedOrderSubscriptions.delete(normalizedOrderId);
  applySocketAuth();

  if (!socketInstance || !socketInstance.connected) {
    return {
      ok: true,
      queued: true
    };
  }

  return emitWithAck('order:unsubscribe', { orderId: normalizedOrderId });
}

export function disconnectUserSocket() {
  trackedOrderSubscriptions.clear();
  currentAccessToken = null;

  if (!socketInstance) {
    return;
  }

  socketInstance.disconnect();
  socketInstance = null;
}
