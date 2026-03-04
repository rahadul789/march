const { internalEventBus } = require('../../../core/events/internalEventBus');
const { ORDER_STATUS_CHANGED_EVENT } = require('../../../core/events/eventTypes');
const logger = require('../../../core/logger/logger');

function registerOrderStatusEventHandlers({ onSocketEvent, onPushEvent } = {}) {
  internalEventBus.on(ORDER_STATUS_CHANGED_EVENT, (eventPayload) => {
    logger.info('Order status change received by notification handlers', {
      orderId: eventPayload.orderId,
      fromStatus: eventPayload.fromStatus,
      toStatus: eventPayload.toStatus
    });

    if (typeof onSocketEvent === 'function') {
      onSocketEvent(eventPayload);
    }

    if (typeof onPushEvent === 'function') {
      onPushEvent(eventPayload);
    }
  });
}

module.exports = {
  registerOrderStatusEventHandlers
};
