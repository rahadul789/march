const notificationService = require("./notification.service");
const {
  registerOrderStatusEventHandlers,
} = require("./orderStatus.eventHandler");

function initializeNotificationService({
  onSocketBroadcast,
  onPushBroadcast,
} = {}) {
  notificationService.configureDeliveryHandlers({
    onSocketBroadcast,
    onPushBroadcast,
  });

  registerOrderStatusEventHandlers(); //এটা event bus এ subscribe করে।
}

module.exports = {
  initializeNotificationService,
  notificationService,
  registerOrderStatusEventHandlers,
};
