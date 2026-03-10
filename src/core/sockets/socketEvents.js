const mongoose = require('mongoose');
const env = require('../config/env');
const logger = require('../logger/logger');
const { internalEventBus } = require('../events/internalEventBus');
const { ORDER_STATUS_CHANGED_EVENT } = require('../events/eventTypes');
const { Order } = require('../../modules/order/model');
const { Restaurant } = require('../../modules/restaurant/model');
const { USER_ROLES } = require('../../modules/auth/types');
const { getUserRoom, getOrderRoom } = require('./socketRooms');
const { createSocketEventThrottle } = require('./socketThrottle');

const SOCKET_EVENT_THROTTLE_WINDOW_MS = env.SOCKET_EVENT_THROTTLE_WINDOW_MS || 1000;
const SOCKET_EVENT_THROTTLE_MAX_EVENTS = env.SOCKET_EVENT_THROTTLE_MAX_EVENTS || 20;
const SOCKET_MAX_ORDER_SUBSCRIPTIONS = env.SOCKET_MAX_ORDER_SUBSCRIPTIONS || 100;
const SOCKET_RECENT_SUBSCRIPTIONS_TTL_MS = env.SOCKET_RECENT_SUBSCRIPTIONS_TTL_MS || 2 * 60 * 1000;

const recentSubscriptionsByUser = new Map();

function isValidObjectId(value) {
  return mongoose.isValidObjectId(value);
}

function safeAck(ack, payload) {
  if (typeof ack === 'function') {
    ack(payload);
  }
}

function cleanupRecentSubscriptions() {
  const now = Date.now();

  for (const [key, value] of recentSubscriptionsByUser.entries()) {
    if (!value || value.expiresAt <= now) {
      recentSubscriptionsByUser.delete(key);
    }
  }
}

function rememberOrderSubscriptions(userId, orderIdsSet) {
  cleanupRecentSubscriptions();

  if (!orderIdsSet || orderIdsSet.size === 0) {
    recentSubscriptionsByUser.delete(String(userId));
    return;
  }

  recentSubscriptionsByUser.set(String(userId), {
    orderIds: Array.from(orderIdsSet),
    expiresAt: Date.now() + SOCKET_RECENT_SUBSCRIPTIONS_TTL_MS
  });
}

function loadRecentOrderSubscriptions(userId) {
  cleanupRecentSubscriptions();

  const snapshot = recentSubscriptionsByUser.get(String(userId));
  if (!snapshot) {
    return [];
  }

  if (snapshot.expiresAt <= Date.now()) {
    recentSubscriptionsByUser.delete(String(userId));
    return [];
  }

  return Array.isArray(snapshot.orderIds) ? snapshot.orderIds : [];
}

function normalizeOrderIds(rawOrderIds) {
  if (!Array.isArray(rawOrderIds)) {
    return [];
  }

  const result = [];
  const seen = new Set();

  for (const value of rawOrderIds) {
    const orderId = String(value || '').trim();
    if (!orderId || !isValidObjectId(orderId) || seen.has(orderId)) {
      continue;
    }

    seen.add(orderId);
    result.push(orderId);

    if (result.length >= SOCKET_MAX_ORDER_SUBSCRIPTIONS) {
      break;
    }
  }

  return result;
}

async function canAccessOrderRoom(orderId, auth) {
  if (!isValidObjectId(orderId)) {
    return {
      allowed: false,
      reason: 'INVALID_ORDER_ID'
    };
  }

  const order = await Order.findById(orderId)
    .select('userId deliverymanId restaurantId status');

  if (!order) {
    return {
      allowed: false,
      reason: 'ORDER_NOT_FOUND'
    };
  }

  if (auth.role === USER_ROLES.ADMIN) {
    return {
      allowed: true,
      order
    };
  }

  if (auth.role === USER_ROLES.USER && String(order.userId) === String(auth.userId)) {
    return {
      allowed: true,
      order
    };
  }

  if (auth.role === USER_ROLES.DELIVERYMAN && order.deliverymanId && String(order.deliverymanId) === String(auth.userId)) {
    return {
      allowed: true,
      order
    };
  }

  if (auth.role === USER_ROLES.RESTAURANT_OWNER) {
    const restaurant = await Restaurant.findOne({
      _id: order.restaurantId,
      ownerId: auth.userId,
      isDeleted: false
    }).select('_id');

    if (restaurant) {
      return {
        allowed: true,
        order
      };
    }
  }

  return {
    allowed: false,
    reason: 'ORDER_ROOM_FORBIDDEN'
  };
}

async function joinOrderRoom(socket, orderId) {
  const access = await canAccessOrderRoom(orderId, socket.data.auth);
  if (!access.allowed) {
    return {
      ok: false,
      reason: access.reason
    };
  }

  if (socket.data.orderSubscriptions.size >= SOCKET_MAX_ORDER_SUBSCRIPTIONS) {
    return {
      ok: false,
      reason: 'ORDER_SUBSCRIPTION_LIMIT_REACHED'
    };
  }

  const room = getOrderRoom(orderId);
  await socket.join(room);
  socket.data.orderSubscriptions.add(String(orderId));

  return {
    ok: true,
    room
  };
}

function leaveOrderRoom(socket, orderId) {
  const normalizedOrderId = String(orderId || '').trim();
  if (!normalizedOrderId) {
    return {
      ok: false,
      reason: 'INVALID_ORDER_ID'
    };
  }

  socket.data.orderSubscriptions.delete(normalizedOrderId);
  socket.leave(getOrderRoom(normalizedOrderId));

  return {
    ok: true
  };
}

async function emitOrderStatusChange(io, eventPayload) {
  if (!eventPayload || !eventPayload.orderId) {
    return;
  }

  const orderId = String(eventPayload.orderId);
  const socketEventPayload = {
    ...eventPayload,
    emittedAt: new Date().toISOString()
  };

  io.to(getOrderRoom(orderId)).emit('order:status_changed', socketEventPayload);

  const recipientUserIds = new Set();

  if (eventPayload.userId) {
    recipientUserIds.add(String(eventPayload.userId));
  }

  if (eventPayload.deliverymanId) {
    recipientUserIds.add(String(eventPayload.deliverymanId));
  }

  if (eventPayload.restaurantId && isValidObjectId(eventPayload.restaurantId)) {
    const restaurant = await Restaurant.findById(eventPayload.restaurantId).select('ownerId');
    if (restaurant && restaurant.ownerId) {
      recipientUserIds.add(String(restaurant.ownerId));
    }
  }

  for (const userId of recipientUserIds) {
    io.to(getUserRoom(userId)).emit('order:status_changed', socketEventPayload);
  }

  logger.info('Socket order status event emitted', {
    orderId,
    toStatus: eventPayload.toStatus || null,
    recipientUserCount: recipientUserIds.size
  });
}

function parseHandshakeOrderSubscriptions(socket) {
  const handshake = socket.handshake || {};
  const auth = handshake.auth && typeof handshake.auth === 'object' ? handshake.auth : {};

  return normalizeOrderIds(auth.orderIds || []);
}

function buildSocketEventHandlers(io, socket) {
  const eventThrottle = createSocketEventThrottle({
    windowMs: SOCKET_EVENT_THROTTLE_WINDOW_MS,
    maxEvents: SOCKET_EVENT_THROTTLE_MAX_EVENTS
  });

  return {
    async subscribeOrder(payload, ack) {
      if (!eventThrottle.isAllowed('order:subscribe')) {
        safeAck(ack, { ok: false, reason: 'THROTTLED' });
        return;
      }

      const orderId = payload && payload.orderId ? String(payload.orderId) : '';
      const result = await joinOrderRoom(socket, orderId);
      safeAck(ack, result);
    },
    async unsubscribeOrder(payload, ack) {
      const orderId = payload && payload.orderId ? payload.orderId : null;
      const result = leaveOrderRoom(socket, orderId);
      safeAck(ack, result);
    },
    heartbeat(payload, ack) {
      if (!eventThrottle.isAllowed('presence:heartbeat')) {
        safeAck(ack, { ok: false, reason: 'THROTTLED' });
        return;
      }

      safeAck(ack, {
        ok: true,
        serverTime: new Date().toISOString()
      });
    },
    disconnect(reason) {
      rememberOrderSubscriptions(socket.data.auth.userId, socket.data.orderSubscriptions);

      logger.info('Socket disconnected', {
        socketId: socket.id,
        userId: socket.data.auth.userId,
        reason,
        activeConnections: io.engine.clientsCount
      });
    }
  };
}

function registerSocketConnection(io) {
  io.on('connection', async (socket) => {
    const auth = socket.data.auth;
    socket.data.orderSubscriptions = new Set();

    await socket.join(getUserRoom(auth.userId));

    const handshakeOrderIds = parseHandshakeOrderSubscriptions(socket);
    const recentOrderIds = loadRecentOrderSubscriptions(auth.userId);
    const restoreOrderIds = normalizeOrderIds([...recentOrderIds, ...handshakeOrderIds]);

    for (const orderId of restoreOrderIds) {
      try {
        await joinOrderRoom(socket, orderId);
      } catch (error) {
        logger.warn('Failed to restore order room subscription', {
          socketId: socket.id,
          orderId,
          reason: error.message
        });
      }
    }

    logger.info('Socket connected', {
      socketId: socket.id,
      userId: auth.userId,
      role: auth.role,
      restoredOrderRooms: socket.data.orderSubscriptions.size,
      activeConnections: io.engine.clientsCount
    });

    const handlers = buildSocketEventHandlers(io, socket);
    socket.on('order:subscribe', (payload, ack) => {
      handlers.subscribeOrder(payload, ack).catch((error) => {
        safeAck(ack, { ok: false, reason: 'SUBSCRIBE_FAILED' });
        logger.warn('Socket order subscribe failed', {
          socketId: socket.id,
          userId: auth.userId,
          reason: error.message
        });
      });
    });
    socket.on('order:unsubscribe', (payload, ack) => {
      handlers.unsubscribeOrder(payload, ack).catch((error) => {
        safeAck(ack, { ok: false, reason: 'UNSUBSCRIBE_FAILED' });
        logger.warn('Socket order unsubscribe failed', {
          socketId: socket.id,
          userId: auth.userId,
          reason: error.message
        });
      });
    });
    socket.on('presence:heartbeat', handlers.heartbeat);
    socket.on('disconnect', handlers.disconnect);
  });
}

function registerSocketArchitecture(io) {
  const orderStatusListener = (eventPayload) => {
    Promise.resolve(emitOrderStatusChange(io, eventPayload)).catch((error) => {
      logger.error('Socket order status emit failed', {
        message: error.message,
        stack: error.stack
      });
    });
  };

  internalEventBus.on(ORDER_STATUS_CHANGED_EVENT, orderStatusListener);
  registerSocketConnection(io);

  return function cleanupSocketArchitecture() {
    internalEventBus.off(ORDER_STATUS_CHANGED_EVENT, orderStatusListener);
  };
}

module.exports = {
  registerSocketArchitecture,
  emitOrderStatusChange,
  normalizeOrderIds
};
