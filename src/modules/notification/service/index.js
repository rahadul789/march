const notificationService = require('./notification.service');
const { registerOrderStatusEventHandlers } = require('./orderStatus.eventHandler');
const { dispatchExpoPushNotifications } = require('./expoPush.service');

function initializeNotificationService({ onSocketBroadcast, onPushBroadcast } = {}) {
  notificationService.configureDeliveryHandlers({
    onSocketBroadcast,
    onPushBroadcast: typeof onPushBroadcast === 'function'
      ? onPushBroadcast
      : dispatchExpoPushNotifications
  });

  registerOrderStatusEventHandlers();
}

module.exports = {
  initializeNotificationService,
  notificationService,
  registerOrderStatusEventHandlers,
  dispatchExpoPushNotifications
};
