const logger = require("../../../core/logger/logger");
const { internalEventBus } = require("../../../core/events/internalEventBus");
const {
  ORDER_STATUS_CHANGED_EVENT,
} = require("../../../core/events/eventTypes");
const notificationService = require("./notification.service");

let subscribed = false;

function registerOrderStatusEventHandlers() {
  if (subscribed) {
    return;
  }

  internalEventBus.on(ORDER_STATUS_CHANGED_EVENT, (eventPayload) => {
    Promise.resolve(
      notificationService.handleOrderStatusChanged(eventPayload),
    ).catch((error) => {
      logger.error("Order status notification processing failed", {
        message: error.message,
        stack: error.stack,
      });
    });
  });

  subscribed = true;
  logger.info("Notification event handler subscribed", {
    eventName: ORDER_STATUS_CHANGED_EVENT,
  });
}

module.exports = {
  registerOrderStatusEventHandlers,
};
