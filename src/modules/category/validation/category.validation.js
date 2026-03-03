const mongoose = require('mongoose');
const AppError = require('../../../core/errors/AppError');
const { CATEGORY_DEFAULTS } = require('../types');

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

function parseSortOrder(value, field) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new AppError(`${field} must be an integer >= 0`, 400, 'VALIDATION_ERROR', {
      field
    });
  }

  return parsed;
}

function validateRestaurantIdParam(params) {
  const restaurantId = params && params.restaurantId;

  if (!restaurantId || !mongoose.isValidObjectId(restaurantId)) {
    throw new AppError('restaurantId must be a valid ObjectId', 400, 'VALIDATION_ERROR', {
      field: 'restaurantId'
    });
  }

  return restaurantId;
}

function validateCategoryIdParam(params) {
  const categoryId = params && params.categoryId;

  if (!categoryId || !mongoose.isValidObjectId(categoryId)) {
    throw new AppError('categoryId must be a valid ObjectId', 400, 'VALIDATION_ERROR', {
      field: 'categoryId'
    });
  }

  return categoryId;
}

function validateCreatePayload(body, restaurantId) {
  if (!body || typeof body !== 'object') {
    throw new AppError('Invalid request body', 400, 'VALIDATION_ERROR');
  }

  const payload = {
    name: ensureNonEmptyString(body.name, 'name'),
    restaurantId,
    sortOrder: typeof body.sortOrder === 'undefined'
      ? CATEGORY_DEFAULTS.SORT_ORDER
      : parseSortOrder(body.sortOrder, 'sortOrder'),
    isActive: typeof body.isActive === 'undefined'
      ? true
      : parseBoolean(body.isActive, 'isActive')
  };

  return payload;
}

function validateOwnerListQuery(query) {
  const source = query || {};

  if (typeof source.isActive === 'undefined') {
    return {};
  }

  return {
    isActive: parseBoolean(source.isActive, 'isActive')
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

  if (typeof body.sortOrder !== 'undefined') {
    payload.sortOrder = parseSortOrder(body.sortOrder, 'sortOrder');
  }

  if (typeof body.isActive !== 'undefined') {
    payload.isActive = parseBoolean(body.isActive, 'isActive');
  }

  if (Object.keys(payload).length === 0) {
    throw new AppError('At least one updatable field is required', 400, 'VALIDATION_ERROR');
  }

  return payload;
}

module.exports = {
  validateRestaurantIdParam,
  validateCategoryIdParam,
  validateCreatePayload,
  validateOwnerListQuery,
  validateUpdatePayload
};
