const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/march_food_delivery_test';
process.env.ACCESS_TOKEN_SECRET = 'test_access_secret';
process.env.REFRESH_TOKEN_SECRET = 'test_refresh_secret';

const { Notification } = require('../src/modules/notification/model');
const {
  normalizeOrderStatusEventPayload,
  buildNotificationDocuments
} = require('../src/modules/notification/service/notification.service');
const { NOTIFICATION_RECIPIENT_ROLES } = require('../src/modules/notification/types');

test('notification schema includes userId and unread indexes', () => {
  const indexes = Notification.schema.indexes();

  assert.ok(indexes.some(([keys]) => keys.userId === 1));
  assert.ok(indexes.some(([keys]) => (
    keys.userId === 1 && keys.isUnread === 1 && keys.createdAt === -1
  )));
});

test('notification schema unread default is true', () => {
  const document = new Notification({
    userId: new mongoose.Types.ObjectId(),
    type: 'ORDER_STATUS_CHANGED',
    title: 'Order ORD-20260306-000001 ASSIGNED',
    message: 'Your order is now ASSIGNED.',
    sourceEvent: { name: 'order.status.changed' }
  });

  assert.equal(document.isUnread, true);
});

test('order status event normalization rejects missing required fields', () => {
  assert.throws(() => {
    normalizeOrderStatusEventPayload({
      orderId: new mongoose.Types.ObjectId().toString(),
      toStatus: 'ASSIGNED'
    });
  });
});

test('buildNotificationDocuments creates unread docs for recipients', () => {
  const normalizedEvent = normalizeOrderStatusEventPayload({
    orderId: new mongoose.Types.ObjectId().toString(),
    orderNumber: 'ORD-20260306-000001',
    restaurantId: new mongoose.Types.ObjectId().toString(),
    userId: new mongoose.Types.ObjectId().toString(),
    toStatus: 'ASSIGNED',
    fromStatus: 'READY_FOR_PICKUP'
  });

  const recipients = [
    {
      userId: normalizedEvent.userId,
      role: NOTIFICATION_RECIPIENT_ROLES.CUSTOMER
    }
  ];

  const docs = buildNotificationDocuments(normalizedEvent, recipients);

  assert.equal(docs.length, 1);
  assert.equal(docs[0].isUnread, true);
  assert.equal(docs[0].payload.toStatus, 'ASSIGNED');
});
