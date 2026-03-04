const { EventEmitter } = require('events');
const logger = require('../logger/logger');

const internalEventBus = new EventEmitter();
internalEventBus.setMaxListeners(100);

function emitEvent(eventName, payload) {
  internalEventBus.emit(eventName, payload);

  logger.info('Internal event emitted', {
    eventName,
    payloadKeys: payload && typeof payload === 'object' ? Object.keys(payload) : []
  });
}

module.exports = {
  internalEventBus,
  emitEvent
};
