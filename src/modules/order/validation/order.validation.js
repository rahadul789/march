const mongoose = require('mongoose');
const AppError = require('../../../core/errors/AppError');
const { ORDER_DEFAULTS, ORDER_STATUSES } = require('../types');

function parsePositiveInteger(value, field, min = 1, max = 1000000) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new AppError(`${field} must be an integer between ${min} and ${max}`, 400, 'VALIDATION_ERROR', {
      field
    });
  }

  return parsed;
}

function validateObjectId(value, field) {
  if (!value || !mongoose.isValidObjectId(value)) {
    throw new AppError(`${field} must be a valid ObjectId`, 400, 'VALIDATION_ERROR', {
      field
    });
  }

  return value;
}

function normalizeOptionalNote(value, field) {
  if (typeof value === 'undefined' || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new AppError(`${field} must be a string`, 400, 'VALIDATION_ERROR', { field });
  }

  const normalized = value.trim();

  if (normalized.length > 500) {
    throw new AppError(`${field} cannot exceed 500 characters`, 400, 'VALIDATION_ERROR', { field });
  }

  return normalized || null;
}

function validateRestaurantIdParam(params) {
  return validateObjectId(params && params.restaurantId, 'restaurantId');
}

function validateOrderIdParam(params) {
  return validateObjectId(params && params.orderId, 'orderId');
}

function validateCreateOrderPayload(body) {
  const source = body && typeof body === 'object' ? body : {};

  const payload = {};

  payload.notes = normalizeOptionalNote(source.notes, 'notes');

  if (typeof source.lockTtlSeconds !== 'undefined') {
    payload.lockTtlSeconds = parsePositiveInteger(
      source.lockTtlSeconds,
      'lockTtlSeconds',
      30,
      600
    );
  } else {
    payload.lockTtlSeconds = ORDER_DEFAULTS.ORDER_LOCK_TTL_SECONDS;
  }

  return payload;
}

function validateTransitionPayload(body) {
  const source = body && typeof body === 'object' ? body : null;

  if (!source) {
    throw new AppError('Invalid request body', 400, 'VALIDATION_ERROR');
  }

  const rawToStatus = typeof source.toStatus === 'string' ? source.toStatus.trim().toUpperCase() : '';

  if (!Object.values(ORDER_STATUSES).includes(rawToStatus)) {
    throw new AppError('Invalid toStatus value', 400, 'VALIDATION_ERROR', {
      field: 'toStatus'
    });
  }

  const expectedRevision = parsePositiveInteger(source.expectedRevision, 'expectedRevision', 0, 1000000000);

  let deliverymanId;
  if (typeof source.deliverymanId !== 'undefined' && source.deliverymanId !== null && source.deliverymanId !== '') {
    deliverymanId = validateObjectId(source.deliverymanId, 'deliverymanId');
  }

  return {
    toStatus: rawToStatus,
    expectedRevision,
    note: normalizeOptionalNote(source.note, 'note'),
    deliverymanId: deliverymanId || null
  };
}

module.exports = {
  validateRestaurantIdParam,
  validateOrderIdParam,
  validateCreateOrderPayload,
  validateTransitionPayload
};
