const mongoose = require('mongoose');
const AppError = require('../../../core/errors/AppError');
const { ORDER_DEFAULTS } = require('../types');

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

function validateRestaurantIdParam(params) {
  return validateObjectId(params && params.restaurantId, 'restaurantId');
}

function validateCreateOrderPayload(body) {
  const source = body && typeof body === 'object' ? body : {};

  const payload = {};

  if (typeof source.notes !== 'undefined') {
    if (typeof source.notes !== 'string') {
      throw new AppError('notes must be a string', 400, 'VALIDATION_ERROR', {
        field: 'notes'
      });
    }

    const normalizedNotes = source.notes.trim();

    if (normalizedNotes.length > 500) {
      throw new AppError('notes cannot exceed 500 characters', 400, 'VALIDATION_ERROR', {
        field: 'notes'
      });
    }

    payload.notes = normalizedNotes || null;
  }

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

module.exports = {
  validateRestaurantIdParam,
  validateCreateOrderPayload
};
