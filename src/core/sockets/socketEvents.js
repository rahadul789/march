const mongoose = require('mongoose');
const env = require('../config/env');
const logger = require('../logger/logger');
const { internalEventBus } = require('../events/internalEventBus');
const {
  ORDER_STATUS_CHANGED_EVENT,
  DELIVERYMAN_OFFLINE_EVENT
} = require('../events/eventTypes');
const { Order } = require('../../modules/order/model');
const { Restaurant } = require('../../modules/restaurant/model');
const { ORDER_STATUSES } = require('../../modules/order/types');
const { USER_ROLES } = require('../../modules/auth/types');
const deliveryService = require('../../modules/delivery/service');
const { DeliverymanProfile } = require('../../modules/delivery/model');
const { getUserRoom, getOrderRoom } = require('./socketRooms');
const { createSocketEventThrottle } = require('./socketThrottle');

const SOCKET_EVENT_THROTTLE_WINDOW_MS = env.SOCKET_EVENT_THROTTLE_WINDOW_MS || 1000;
const SOCKET_EVENT_THROTTLE_MAX_EVENTS = env.SOCKET_EVENT_THROTTLE_MAX_EVENTS || 20;
const SOCKET_MAX_ORDER_SUBSCRIPTIONS = env.SOCKET_MAX_ORDER_SUBSCRIPTIONS || 100;
const SOCKET_RECENT_SUBSCRIPTIONS_TTL_MS = env.SOCKET_RECENT_SUBSCRIPTIONS_TTL_MS || 2 * 60 * 1000;
const SOCKET_LOCATION_UPDATE_MIN_INTERVAL_MS = env.SOCKET_LOCATION_UPDATE_MIN_INTERVAL_MS || 1500;

const TRACKABLE_ORDER_STATUSES = new Set([
  ORDER_STATUSES.ASSIGNED,
  ORDER_STATUSES.PICKED_UP
]);

const recentSubscriptionsByUser = new Map();
const lastTrackingUpdateAtByKey = new Map();

function isValidObjectId(value) {
  return mongoose.isValidObjectId(value);
}

function safeAck(ack, payload) {
  if (typeof ack === 'function') {
    ack(payload);
  }
}

function roundCoordinate(value) {
  return Number(Number(value).toFixed(6));
}

function cleanupRecentSubscriptions() {
  const now = Date.now();

  for (const [key, value] of recentSubscriptionsByUser.entries()) {
    if (!value || value.expiresAt <= now) {
      recentSubscriptionsByUser.delete(key);
    }
  }
}

function cleanupTrackingThrottleMap() {
  const now = Date.now();
  const staleThreshold = SOCKET_LOCATION_UPDATE_MIN_INTERVAL_MS * 10;

  if (lastTrackingUpdateAtByKey.size < 500) {
    return;
  }

  for (const [key, timestamp] of lastTrackingUpdateAtByKey.entries()) {
    if ((now - timestamp) > staleThreshold) {
      lastTrackingUpdateAtByKey.delete(key);
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

function validateTrackingLocationPayload(payload) {
  const source = payload && typeof payload === 'object' ? payload : null;
  if (!source) {
    throw new Error('INVALID_PAYLOAD');
  }

  const orderId = String(source.orderId || '').trim();
  if (!isValidObjectId(orderId)) {
    throw new Error('INVALID_ORDER_ID');
  }

  const lng = Number(source.lng);
  const lat = Number(source.lat);

  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new Error('INVALID_LNG');
  }

  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error('INVALID_LAT');
  }

  let accuracyMeters = null;
  if (typeof source.accuracyMeters !== 'undefined') {
    const parsedAccuracy = Number(source.accuracyMeters);
    if (!Number.isFinite(parsedAccuracy) || parsedAccuracy < 0 || parsedAccuracy > 5000) {
      throw new Error('INVALID_ACCURACY_METERS');
    }
    accuracyMeters = parsedAccuracy;
  }

  return {
    orderId,
    lng: roundCoordinate(lng),
    lat: roundCoordinate(lat),
    accuracyMeters
  };
}

function ensureMinLocationUpdateInterval(userId, orderId) {
  cleanupTrackingThrottleMap();

  const key = `${String(userId)}:${String(orderId)}`;
  const now = Date.now();
  const lastTimestamp = lastTrackingUpdateAtByKey.get(key);

  if (lastTimestamp && (now - lastTimestamp) < SOCKET_LOCATION_UPDATE_MIN_INTERVAL_MS) {
    return false;
  }

  lastTrackingUpdateAtByKey.set(key, now);
  return true;
}

function clearTrackingThrottleForOrder(orderId) {
  const suffix = `:${String(orderId)}`;

  for (const key of lastTrackingUpdateAtByKey.keys()) {
    if (key.endsWith(suffix)) {
      lastTrackingUpdateAtByKey.delete(key);
    }
  }
}

function clearTrackingThrottleForRider(userId) {
  const prefix = `${String(userId)}:`;

  for (const key of lastTrackingUpdateAtByKey.keys()) {
    if (key.startsWith(prefix)) {
      lastTrackingUpdateAtByKey.delete(key);
    }
  }
}

async function resolveTrackableOrder(orderId) {
  return Order.findById(orderId)
    .select('userId deliverymanId restaurantId status');
}

async function canAccessOrderRoom(orderId, auth) {
  if (!isValidObjectId(orderId)) {
    return {
      allowed: false,
      reason: 'INVALID_ORDER_ID'
    };
  }

  const order = await resolveTrackableOrder(orderId);

  if (!order) {
    return {
      allowed: false,
      reason: 'ORDER_NOT_FOUND'
    };
  }

  if (!TRACKABLE_ORDER_STATUSES.has(order.status)) {
    return {
      allowed: false,
      reason: 'ORDER_NOT_TRACKABLE'
    };
  }

  const isOrderOwner = String(order.userId) === String(auth.userId);
  const isAssignedRider = order.deliverymanId && String(order.deliverymanId) === String(auth.userId);

  if (isOrderOwner || isAssignedRider) {
    return {
      allowed: true,
      order
    };
  }

  return {
    allowed: false,
    reason: 'ORDER_ROOM_FORBIDDEN'
  };
}

async function ensureTrackingParticipantsInRoom(io, order) {
  const room = getOrderRoom(order._id);
  const participants = [];

  if (order.userId) {
    participants.push(String(order.userId));
  }

  if (order.deliverymanId) {
    participants.push(String(order.deliverymanId));
  }

  for (const userId of participants) {
    io.in(getUserRoom(userId)).socketsJoin(room);
  }

  return room;
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
  const toStatus = String(eventPayload.toStatus || '').toUpperCase();
  const room = getOrderRoom(orderId);

  const socketEventPayload = {
    ...eventPayload,
    emittedAt: new Date().toISOString()
  };

  if (toStatus === ORDER_STATUSES.ASSIGNED || toStatus === ORDER_STATUSES.PICKED_UP) {
    const latestOrder = await resolveTrackableOrder(orderId);
    if (latestOrder) {
      await ensureTrackingParticipantsInRoom(io, latestOrder);
      io.to(room).emit('tracking:started', {
        orderId,
        status: toStatus,
        emittedAt: socketEventPayload.emittedAt
      });
    }
  }

  if (toStatus === ORDER_STATUSES.DELIVERED || toStatus === ORDER_STATUSES.CANCELLED) {
    io.to(room).emit('tracking:stopped', {
      orderId,
      status: toStatus,
      reason: 'ORDER_FINALIZED',
      emittedAt: socketEventPayload.emittedAt
    });
    io.in(room).socketsLeave(room);
    clearTrackingThrottleForOrder(orderId);
  }

  io.to(room).emit('order:status_changed', socketEventPayload);

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
    toStatus,
    recipientUserCount: recipientUserIds.size
  });
}

async function handleDeliverymanOffline(io, eventPayload) {
  if (!eventPayload || !eventPayload.userId || !isValidObjectId(eventPayload.userId)) {
    return;
  }

  const userId = String(eventPayload.userId);
  const riderRoom = getUserRoom(userId);
  const activeOrders = await Order.find({
    deliverymanId: userId,
    status: { $in: [ORDER_STATUSES.ASSIGNED, ORDER_STATUSES.PICKED_UP] }
  }).select('_id');

  for (const order of activeOrders) {
    const orderRoom = getOrderRoom(order._id);
    io.in(riderRoom).socketsLeave(orderRoom);
    io.to(orderRoom).emit('tracking:rider_offline', {
      orderId: String(order._id),
      deliverymanId: userId,
      emittedAt: new Date().toISOString()
    });
    clearTrackingThrottleForOrder(order._id);
  }

  clearTrackingThrottleForRider(userId);
}

function parseHandshakeOrderSubscriptions(socket) {
  const handshake = socket.handshake || {};
  const auth = handshake.auth && typeof handshake.auth === 'object' ? handshake.auth : {};

  return normalizeOrderIds(auth.orderIds || []);
}

async function handleTrackingLocationUpdate(io, socket, payload, ack) {
  const auth = socket.data.auth;

  if (auth.role !== USER_ROLES.DELIVERYMAN) {
    safeAck(ack, { ok: false, reason: 'FORBIDDEN_ROLE' });
    return;
  }

  let validatedPayload;
  try {
    validatedPayload = validateTrackingLocationPayload(payload);
  } catch (error) {
    safeAck(ack, { ok: false, reason: error.message || 'INVALID_PAYLOAD' });
    return;
  }

  if (!ensureMinLocationUpdateInterval(auth.userId, validatedPayload.orderId)) {
    safeAck(ack, { ok: false, reason: 'THROTTLED' });
    return;
  }

  const order = await Order.findOne({
    _id: validatedPayload.orderId,
    deliverymanId: auth.userId,
    status: { $in: [ORDER_STATUSES.ASSIGNED, ORDER_STATUSES.PICKED_UP] }
  }).select('_id userId deliverymanId status');

  if (!order) {
    safeAck(ack, { ok: false, reason: 'TRACKING_ORDER_FORBIDDEN' });
    return;
  }

  const updatePayload = {
    lng: validatedPayload.lng,
    lat: validatedPayload.lat
  };

  if (validatedPayload.accuracyMeters !== null) {
    updatePayload.accuracyMeters = validatedPayload.accuracyMeters;
  }

  const now = new Date();
  const updatedProfile = await DeliverymanProfile.updateOne(
    { userId: auth.userId },
    {
      $set: {
        currentLocation: {
          type: 'Point',
          coordinates: [validatedPayload.lng, validatedPayload.lat]
        },
        currentLocationAccuracyMeters: validatedPayload.accuracyMeters,
        lastSeenAt: now
      }
    }
  );

  if (!updatedProfile || !updatedProfile.matchedCount) {
    await deliveryService.updateCurrentLocation(auth, updatePayload);
  }

  const room = await ensureTrackingParticipantsInRoom(io, order);
  const trackingPayload = {
    orderId: String(order._id),
    deliverymanId: String(auth.userId),
    status: order.status,
    lng: validatedPayload.lng,
    lat: validatedPayload.lat,
    accuracyMeters: validatedPayload.accuracyMeters,
    updatedAt: now.toISOString()
  };

  io.to(room).emit('tracking:location_update', trackingPayload);
  safeAck(ack, { ok: true, data: trackingPayload });
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
    async trackingLocationUpdate(payload, ack) {
      if (!eventThrottle.isAllowed('tracking:location_update')) {
        safeAck(ack, { ok: false, reason: 'THROTTLED' });
        return;
      }

      await handleTrackingLocationUpdate(io, socket, payload, ack);
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
    socket.on('tracking:location_update', (payload, ack) => {
      handlers.trackingLocationUpdate(payload, ack).catch((error) => {
        safeAck(ack, { ok: false, reason: 'TRACKING_UPDATE_FAILED' });
        logger.warn('Socket tracking location update failed', {
          socketId: socket.id,
          userId: auth.userId,
          reason: error.message
        });
      });
    });
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

  const deliverymanOfflineListener = (eventPayload) => {
    Promise.resolve(handleDeliverymanOffline(io, eventPayload)).catch((error) => {
      logger.error('Socket deliveryman offline handling failed', {
        message: error.message,
        stack: error.stack
      });
    });
  };

  internalEventBus.on(ORDER_STATUS_CHANGED_EVENT, orderStatusListener);
  internalEventBus.on(DELIVERYMAN_OFFLINE_EVENT, deliverymanOfflineListener);
  registerSocketConnection(io);

  return function cleanupSocketArchitecture() {
    internalEventBus.off(ORDER_STATUS_CHANGED_EVENT, orderStatusListener);
    internalEventBus.off(DELIVERYMAN_OFFLINE_EVENT, deliverymanOfflineListener);
  };
}

module.exports = {
  registerSocketArchitecture,
  emitOrderStatusChange,
  normalizeOrderIds,
  validateTrackingLocationPayload
};
