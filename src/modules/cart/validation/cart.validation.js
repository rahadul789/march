const mongoose = require('mongoose');
const AppError = require('../../../core/errors/AppError');
const { CART_DEFAULTS } = require('../types');

function parseBoolean(value, field) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (normalized === 'true') {
      return true;
    }

    if (normalized === 'false') {
      return false;
    }
  }

  throw new AppError(`${field} must be true or false`, 400, 'VALIDATION_ERROR', { field });
}

function parsePositiveInteger(value, field, min = 1, max = 1000) {
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
    throw new AppError(`${field} must be a valid ObjectId`, 400, 'VALIDATION_ERROR', { field });
  }

  return value;
}

function validateRestaurantIdParam(params) {
  return validateObjectId(params && params.restaurantId, 'restaurantId');
}

function validateMenuIdParam(params) {
  return validateObjectId(params && params.menuId, 'menuId');
}

function validateAddItemPayload(body) {
  if (!body || typeof body !== 'object') {
    throw new AppError('Invalid request body', 400, 'VALIDATION_ERROR');
  }

  return {
    menuId: validateObjectId(body.menuId, 'menuId'),
    quantity: parsePositiveInteger(body.quantity, 'quantity', 1, 100)
  };
}

function validateUpdateItemPayload(body) {
  if (!body || typeof body !== 'object') {
    throw new AppError('Invalid request body', 400, 'VALIDATION_ERROR');
  }

  return {
    quantity: parsePositiveInteger(body.quantity, 'quantity', 1, 100)
  };
}

function validateOwnerQuery(query) {
  const source = query || {};

  if (typeof source.includeUnavailable === 'undefined') {
    return { includeUnavailable: false };
  }

  return {
    includeUnavailable: parseBoolean(source.includeUnavailable, 'includeUnavailable')
  };
}

function validateLockPayload(body) {
  const source = body && typeof body === 'object' ? body : {};

  const lockTtlSeconds = typeof source.lockTtlSeconds === 'undefined'
    ? CART_DEFAULTS.LOCK_TTL_SECONDS
    : parsePositiveInteger(
      source.lockTtlSeconds,
      'lockTtlSeconds',
      CART_DEFAULTS.MIN_LOCK_TTL_SECONDS,
      CART_DEFAULTS.MAX_LOCK_TTL_SECONDS
    );

  return {
    lockTtlSeconds
  };
}

module.exports = {
  validateRestaurantIdParam,
  validateMenuIdParam,
  validateAddItemPayload,
  validateUpdateItemPayload,
  validateOwnerQuery,
  validateLockPayload
};
