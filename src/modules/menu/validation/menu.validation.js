const mongoose = require('mongoose');
const AppError = require('../../../core/errors/AppError');
const { MENU_DEFAULTS } = require('../types');

function ensureNonEmptyString(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError(`${field} is required`, 400, 'VALIDATION_ERROR', { field });
  }

  return value.trim();
}

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

function parseMoney(value, field) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    throw new AppError(`${field} must be a non-negative number`, 400, 'VALIDATION_ERROR', {
      field
    });
  }

  return Number(number.toFixed(2));
}

function parseInteger(value, field, min, max) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new AppError(`${field} must be an integer`, 400, 'VALIDATION_ERROR', { field });
  }

  if (parsed < min || parsed > max) {
    throw new AppError(`${field} must be between ${min} and ${max}`, 400, 'VALIDATION_ERROR', {
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

function validateCreatePayload(body, restaurantId) {
  if (!body || typeof body !== 'object') {
    throw new AppError('Invalid request body', 400, 'VALIDATION_ERROR');
  }

  const price = parseMoney(body.price, 'price');
  const discount = typeof body.discount === 'undefined'
    ? MENU_DEFAULTS.DISCOUNT_PERCENT
    : parseMoney(body.discount, 'discount');

  if (discount > 100) {
    throw new AppError('discount must be between 0 and 100', 400, 'VALIDATION_ERROR', {
      field: 'discount'
    });
  }

  return {
    name: ensureNonEmptyString(body.name, 'name'),
    description: ensureNonEmptyString(body.description, 'description'),
    restaurantId,
    categoryId: validateObjectId(body.categoryId, 'categoryId'),
    price,
    discount,
    isAvailable: typeof body.isAvailable === 'undefined'
      ? true
      : parseBoolean(body.isAvailable, 'isAvailable'),
    preparationTime: typeof body.preparationTime === 'undefined'
      ? MENU_DEFAULTS.PREPARATION_TIME_MINUTES
      : parseInteger(body.preparationTime, 'preparationTime', 1, 240),
    image: typeof body.image === 'string' && body.image.trim() ? body.image.trim() : null
  };
}

function validateUpdatePayload(body) {
  if (!body || typeof body !== 'object') {
    throw new AppError('Invalid request body', 400, 'VALIDATION_ERROR');
  }

  const payload = {};

  if (typeof body.name !== 'undefined') {
    payload.name = ensureNonEmptyString(body.name, 'name');
  }

  if (typeof body.description !== 'undefined') {
    payload.description = ensureNonEmptyString(body.description, 'description');
  }

  if (typeof body.categoryId !== 'undefined') {
    payload.categoryId = validateObjectId(body.categoryId, 'categoryId');
  }

  if (typeof body.price !== 'undefined') {
    payload.price = parseMoney(body.price, 'price');
  }

  if (typeof body.discount !== 'undefined') {
    payload.discount = parseMoney(body.discount, 'discount');

    if (payload.discount > 100) {
      throw new AppError('discount must be between 0 and 100', 400, 'VALIDATION_ERROR', {
        field: 'discount'
      });
    }
  }

  if (typeof body.isAvailable !== 'undefined') {
    payload.isAvailable = parseBoolean(body.isAvailable, 'isAvailable');
  }

  if (typeof body.preparationTime !== 'undefined') {
    payload.preparationTime = parseInteger(body.preparationTime, 'preparationTime', 1, 240);
  }

  if (typeof body.image !== 'undefined') {
    payload.image = typeof body.image === 'string' && body.image.trim() ? body.image.trim() : null;
  }

  if (Object.keys(payload).length === 0) {
    throw new AppError('At least one updatable field is required', 400, 'VALIDATION_ERROR');
  }

  return payload;
}

function validateListQuery(query) {
  const source = query || {};

  const page = typeof source.page === 'undefined'
    ? 1
    : parseInteger(source.page, 'page', 1, 1000000);

  const limit = typeof source.limit === 'undefined'
    ? MENU_DEFAULTS.PAGE_SIZE
    : parseInteger(source.limit, 'limit', 1, 100);

  return {
    q: typeof source.q === 'string' ? source.q.trim() : undefined,
    categoryId: typeof source.categoryId === 'undefined'
      ? undefined
      : validateObjectId(source.categoryId, 'categoryId'),
    isAvailable: typeof source.isAvailable === 'undefined'
      ? undefined
      : parseBoolean(source.isAvailable, 'isAvailable'),
    page,
    limit
  };
}

module.exports = {
  validateRestaurantIdParam,
  validateMenuIdParam,
  validateCreatePayload,
  validateUpdatePayload,
  validateListQuery
};
