const mongoose = require('mongoose');
const AppError = require('../../../core/errors/AppError');
const {
  DELIVERY_PROFILE_DEFAULTS,
  DELIVERY_ASSIGNMENT_DEFAULTS,
  DELIVERY_VEHICLE_TYPES
} = require('../types');

function ensureString(value, field, { required = true, max = 500, allowNull = false } = {}) {
  if ((value === null || typeof value === 'undefined') && allowNull) {
    return null;
  }

  if (typeof value !== 'string') {
    if (required) {
      throw new AppError(`${field} must be a string`, 400, 'VALIDATION_ERROR', { field });
    }
    return undefined;
  }

  const normalized = value.trim();

  if (required && !normalized) {
    throw new AppError(`${field} is required`, 400, 'VALIDATION_ERROR', { field });
  }

  if (normalized.length > max) {
    throw new AppError(`${field} cannot exceed ${max} characters`, 400, 'VALIDATION_ERROR', { field });
  }

  return normalized || (allowNull ? null : normalized);
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

function parseNumber(value, field) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new AppError(`${field} must be a valid number`, 400, 'VALIDATION_ERROR', { field });
  }

  return parsed;
}

function parsePositiveInteger(value, field, min, max) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new AppError(
      `${field} must be an integer between ${min} and ${max}`,
      400,
      'VALIDATION_ERROR',
      { field }
    );
  }

  return parsed;
}

function normalizeGeoPoint(lng, lat) {
  const normalizedLng = parseNumber(lng, 'lng');
  const normalizedLat = parseNumber(lat, 'lat');

  if (normalizedLng < -180 || normalizedLng > 180) {
    throw new AppError('lng must be between -180 and 180', 400, 'VALIDATION_ERROR', { field: 'lng' });
  }

  if (normalizedLat < -90 || normalizedLat > 90) {
    throw new AppError('lat must be between -90 and 90', 400, 'VALIDATION_ERROR', { field: 'lat' });
  }

  return {
    lng: normalizedLng,
    lat: normalizedLat
  };
}

function validateObjectId(value, field) {
  if (!value || !mongoose.isValidObjectId(value)) {
    throw new AppError(`${field} must be a valid ObjectId`, 400, 'VALIDATION_ERROR', { field });
  }

  return value;
}

function validateUpdateProfilePayload(body) {
  if (!body || typeof body !== 'object') {
    throw new AppError('Invalid request body', 400, 'VALIDATION_ERROR');
  }

  const payload = {};

  if (typeof body.fullName !== 'undefined') {
    payload.fullName = ensureString(body.fullName, 'fullName', { required: true, max: 120 });
  }

  if (typeof body.phone !== 'undefined') {
    payload.phone = ensureString(body.phone, 'phone', { required: true, max: 30 });
  }

  if (typeof body.avatarUrl !== 'undefined') {
    payload.avatarUrl = ensureString(body.avatarUrl, 'avatarUrl', {
      required: false,
      allowNull: true,
      max: 1200
    });
  }

  if (typeof body.vehicleType !== 'undefined') {
    const vehicleType = ensureString(body.vehicleType, 'vehicleType', { required: true, max: 30 }).toLowerCase();

    if (!Object.values(DELIVERY_VEHICLE_TYPES).includes(vehicleType)) {
      throw new AppError('Invalid vehicleType value', 400, 'VALIDATION_ERROR', {
        field: 'vehicleType'
      });
    }

    payload.vehicleType = vehicleType;
  }

  if (typeof body.vehicleNumber !== 'undefined') {
    payload.vehicleNumber = ensureString(body.vehicleNumber, 'vehicleNumber', {
      required: false,
      allowNull: true,
      max: 50
    });
  }

  if (Object.keys(payload).length === 0) {
    throw new AppError('At least one profile field is required', 400, 'VALIDATION_ERROR');
  }

  return payload;
}

function validateOnlineTogglePayload(body) {
  if (!body || typeof body !== 'object') {
    throw new AppError('Invalid request body', 400, 'VALIDATION_ERROR');
  }

  return {
    isOnline: parseBoolean(body.isOnline, 'isOnline')
  };
}

function validateAvailabilityPayload(body) {
  if (!body || typeof body !== 'object') {
    throw new AppError('Invalid request body', 400, 'VALIDATION_ERROR');
  }

  return {
    isAvailable: parseBoolean(body.isAvailable, 'isAvailable')
  };
}

function validateLocationPayload(body) {
  if (!body || typeof body !== 'object') {
    throw new AppError('Invalid request body', 400, 'VALIDATION_ERROR');
  }

  const geo = normalizeGeoPoint(body.lng, body.lat);

  const payload = {
    ...geo
  };

  if (typeof body.accuracyMeters !== 'undefined') {
    const accuracy = parseNumber(body.accuracyMeters, 'accuracyMeters');

    if (accuracy < 0 || accuracy > 5000) {
      throw new AppError('accuracyMeters must be between 0 and 5000', 400, 'VALIDATION_ERROR', {
        field: 'accuracyMeters'
      });
    }

    payload.accuracyMeters = accuracy;
  }

  return payload;
}

function validateHeartbeatPayload(body) {
  if (typeof body === 'undefined' || body === null) {
    return {};
  }

  if (typeof body !== 'object') {
    throw new AppError('Invalid request body', 400, 'VALIDATION_ERROR');
  }

  if (typeof body.lng === 'undefined' && typeof body.lat === 'undefined') {
    return {};
  }

  return validateLocationPayload(body);
}

function validateNearbyQuery(query) {
  const source = query || {};

  const geo = normalizeGeoPoint(source.lng, source.lat);

  const radiusMeters = typeof source.radiusMeters === 'undefined'
    ? DELIVERY_PROFILE_DEFAULTS.SEARCH_RADIUS_METERS
    : parseNumber(source.radiusMeters, 'radiusMeters');

  if (radiusMeters <= 0 || radiusMeters > DELIVERY_PROFILE_DEFAULTS.MAX_SEARCH_RADIUS_METERS) {
    throw new AppError(
      `radiusMeters must be between 1 and ${DELIVERY_PROFILE_DEFAULTS.MAX_SEARCH_RADIUS_METERS}`,
      400,
      'VALIDATION_ERROR',
      { field: 'radiusMeters' }
    );
  }

  const limit = typeof source.limit === 'undefined' ? 50 : parseNumber(source.limit, 'limit');

  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    throw new AppError('limit must be an integer between 1 and 200', 400, 'VALIDATION_ERROR', {
      field: 'limit'
    });
  }

  return {
    ...geo,
    radiusMeters,
    limit
  };
}

function validateOrderIdParam(params) {
  return validateObjectId(params && params.orderId, 'orderId');
}

function validateAssignmentPayload(body) {
  const source = body && typeof body === 'object' ? body : {};

  const payload = {
    searchRadiusMeters: typeof source.searchRadiusMeters === 'undefined'
      ? DELIVERY_ASSIGNMENT_DEFAULTS.SEARCH_RADIUS_METERS
      : parsePositiveInteger(
        source.searchRadiusMeters,
        'searchRadiusMeters',
        1,
        DELIVERY_ASSIGNMENT_DEFAULTS.MAX_SEARCH_RADIUS_METERS
      ),
    candidateLimit: typeof source.candidateLimit === 'undefined'
      ? DELIVERY_ASSIGNMENT_DEFAULTS.CANDIDATE_LIMIT
      : parsePositiveInteger(
        source.candidateLimit,
        'candidateLimit',
        1,
        DELIVERY_ASSIGNMENT_DEFAULTS.MAX_CANDIDATE_LIMIT
      ),
    lockTtlSeconds: typeof source.lockTtlSeconds === 'undefined'
      ? DELIVERY_ASSIGNMENT_DEFAULTS.LOCK_TTL_SECONDS
      : parsePositiveInteger(
        source.lockTtlSeconds,
        'lockTtlSeconds',
        1,
        DELIVERY_ASSIGNMENT_DEFAULTS.MAX_LOCK_TTL_SECONDS
      ),
    assignmentTimeoutMs: typeof source.assignmentTimeoutMs === 'undefined'
      ? DELIVERY_ASSIGNMENT_DEFAULTS.ASSIGNMENT_TIMEOUT_MS
      : parsePositiveInteger(
        source.assignmentTimeoutMs,
        'assignmentTimeoutMs',
        100,
        DELIVERY_ASSIGNMENT_DEFAULTS.MAX_ASSIGNMENT_TIMEOUT_MS
      ),
    maxLastSeenAgeSeconds: typeof source.maxLastSeenAgeSeconds === 'undefined'
      ? DELIVERY_ASSIGNMENT_DEFAULTS.MAX_LAST_SEEN_AGE_SECONDS
      : parsePositiveInteger(
        source.maxLastSeenAgeSeconds,
        'maxLastSeenAgeSeconds',
        5,
        600
      )
  };

  if ((payload.lockTtlSeconds * 1000) < payload.assignmentTimeoutMs) {
    throw new AppError(
      'lockTtlSeconds must cover assignmentTimeoutMs window',
      400,
      'VALIDATION_ERROR',
      { field: 'lockTtlSeconds' }
    );
  }

  payload.note = ensureString(source.note, 'note', {
    required: false,
    allowNull: true,
    max: 500
  });

  return payload;
}

module.exports = {
  validateUpdateProfilePayload,
  validateOnlineTogglePayload,
  validateAvailabilityPayload,
  validateLocationPayload,
  validateHeartbeatPayload,
  validateNearbyQuery,
  validateOrderIdParam,
  validateAssignmentPayload
};
