const mongoose = require("mongoose");
const logger = require("../../../core/logger/logger");
const AppError = require("../../../core/errors/AppError");
const {
  ORDER_STATUS_CHANGED_EVENT,
} = require("../../../core/events/eventTypes");
const { Restaurant } = require("../../restaurant/model");
const { Notification } = require("../model");
const {
  NOTIFICATION_TYPES,
  NOTIFICATION_RECIPIENT_ROLES,
} = require("../types");

let socketBroadcastHandler = null;
let pushBroadcastHandler = null;

function ensureObjectId(value, fieldName) {
  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }

  if (!mongoose.isValidObjectId(value)) {
    throw new AppError(
      `${fieldName} must be a valid ObjectId`,
      400,
      "VALIDATION_ERROR",
      {
        field: fieldName,
      },
    );
  }

  return new mongoose.Types.ObjectId(value);
}

function normalizeOrderStatus(status) {
  return String(status || "")
    .trim()
    .toUpperCase()
    .replace(/_/g, " ");
}

function buildTitle(orderNumber, toStatus) {
  return `Order ${orderNumber} ${normalizeOrderStatus(toStatus)}`;
}

function buildMessage(toStatus, recipientRole) {
  const normalizedStatus = normalizeOrderStatus(toStatus);

  if (recipientRole === NOTIFICATION_RECIPIENT_ROLES.CUSTOMER) {
    return `Your order is now ${normalizedStatus}.`;
  }

  if (recipientRole === NOTIFICATION_RECIPIENT_ROLES.DELIVERYMAN) {
    return `Assigned order is now ${normalizedStatus}.`;
  }

  if (recipientRole === NOTIFICATION_RECIPIENT_ROLES.RESTAURANT_OWNER) {
    return `Restaurant order is now ${normalizedStatus}.`;
  }

  return `Order status changed to ${normalizedStatus}.`;
}

function normalizeOrderStatusEventPayload(eventPayload) {
  if (!eventPayload || typeof eventPayload !== "object") {
    throw new AppError(
      "Order status event payload is required",
      400,
      "VALIDATION_ERROR",
    );
  }

  const requiredFields = [
    "orderId",
    "orderNumber",
    "restaurantId",
    "userId",
    "toStatus",
  ];

  for (const fieldName of requiredFields) {
    if (!eventPayload[fieldName]) {
      throw new AppError(
        `Missing required event field: ${fieldName}`,
        400,
        "VALIDATION_ERROR",
        {
          field: fieldName,
        },
      );
    }
  }

  return {
    orderId: ensureObjectId(eventPayload.orderId, "orderId"),
    orderNumber: String(eventPayload.orderNumber).trim(),
    restaurantId: ensureObjectId(eventPayload.restaurantId, "restaurantId"),
    userId: ensureObjectId(eventPayload.userId, "userId"),
    deliverymanId: eventPayload.deliverymanId
      ? ensureObjectId(eventPayload.deliverymanId, "deliverymanId")
      : null,
    fromStatus: eventPayload.fromStatus || null,
    toStatus: String(eventPayload.toStatus).trim().toUpperCase(),
    revision:
      typeof eventPayload.revision === "number" ? eventPayload.revision : null,
    requestId: eventPayload.requestId ? String(eventPayload.requestId) : null,
    changedAt: eventPayload.changedAt
      ? new Date(eventPayload.changedAt)
      : new Date(),
  };
}

// এই function-টার কাজ হলো order status change হলে কারা notification পাবে সেটা determine করা।
// মানে recipients list তৈরি করা।
async function resolveOrderStatusRecipients(normalizedEvent) {
  const recipientMap = new Map();

  recipientMap.set(String(normalizedEvent.userId), {
    userId: normalizedEvent.userId,
    role: NOTIFICATION_RECIPIENT_ROLES.CUSTOMER,
  });

  if (normalizedEvent.deliverymanId) {
    recipientMap.set(String(normalizedEvent.deliverymanId), {
      userId: normalizedEvent.deliverymanId,
      role: NOTIFICATION_RECIPIENT_ROLES.DELIVERYMAN,
    });
  }

  const restaurant = await Restaurant.findById(
    normalizedEvent.restaurantId,
  ).select("ownerId");
  if (restaurant && restaurant.ownerId) {
    recipientMap.set(String(restaurant.ownerId), {
      userId: restaurant.ownerId,
      role: NOTIFICATION_RECIPIENT_ROLES.RESTAURANT_OWNER,
    });
  }

  return Array.from(recipientMap.values());
}

function buildNotificationDocuments(normalizedEvent, recipients) {
  return recipients.map((recipient) => ({
    userId: recipient.userId,
    type: NOTIFICATION_TYPES.ORDER_STATUS_CHANGED,
    title: buildTitle(normalizedEvent.orderNumber, normalizedEvent.toStatus),
    message: buildMessage(normalizedEvent.toStatus, recipient.role),
    payload: {
      orderId: String(normalizedEvent.orderId),
      orderNumber: normalizedEvent.orderNumber,
      restaurantId: String(normalizedEvent.restaurantId),
      fromStatus: normalizedEvent.fromStatus,
      toStatus: normalizedEvent.toStatus,
      revision: normalizedEvent.revision,
      recipientRole: recipient.role,
    },
    isUnread: true,
    readAt: null,
    sourceEvent: {
      name: ORDER_STATUS_CHANGED_EVENT,
      requestId: normalizedEvent.requestId,
      emittedAt: normalizedEvent.changedAt,
    },
  }));
}

function sanitizeNotification(document) {
  return {
    id: document._id.toString(),
    userId: document.userId.toString(),
    type: document.type,
    title: document.title,
    message: document.message,
    payload: document.payload,
    isUnread: document.isUnread,
    readAt: document.readAt,
    sourceEvent: document.sourceEvent,
    delivery: document.delivery,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function configureDeliveryHandlers({
  onSocketBroadcast,
  onPushBroadcast,
} = {}) {
  socketBroadcastHandler =
    typeof onSocketBroadcast === "function" ? onSocketBroadcast : null;
  pushBroadcastHandler =
    typeof onPushBroadcast === "function" ? onPushBroadcast : null;
}

async function storeNotifications(documents) {
  if (!Array.isArray(documents) || documents.length === 0) {
    return [];
  }

  const created = await Notification.insertMany(documents, { ordered: false });
  return created.map(sanitizeNotification);
}

async function dispatchPreparedNotifications(notifications, eventPayload) {
  if (!notifications.length) {
    return;
  }

  if (socketBroadcastHandler) {
    try {
      await Promise.resolve(
        socketBroadcastHandler(notifications, eventPayload),
      );
    } catch (error) {
      logger.error("Socket notification broadcast handler failed", {
        message: error.message,
      });
    }
  }

  if (pushBroadcastHandler) {
    try {
      await Promise.resolve(pushBroadcastHandler(notifications, eventPayload));
    } catch (error) {
      logger.error("Push notification broadcast handler failed", {
        message: error.message,
      });
    }
  }
}

async function handleOrderStatusChanged(eventPayload) {
  const normalizedEvent = normalizeOrderStatusEventPayload(eventPayload);
  const recipients = await resolveOrderStatusRecipients(normalizedEvent);
  const documents = buildNotificationDocuments(normalizedEvent, recipients);
  const notifications = await storeNotifications(documents);

  await dispatchPreparedNotifications(notifications, normalizedEvent);

  logger.info("Order status notifications stored", {
    orderId: String(normalizedEvent.orderId),
    toStatus: normalizedEvent.toStatus,
    recipientCount: recipients.length,
    persistedCount: notifications.length,
  });

  return notifications;
}

module.exports = {
  configureDeliveryHandlers,
  handleOrderStatusChanged,
  normalizeOrderStatusEventPayload,
  buildNotificationDocuments,
};
