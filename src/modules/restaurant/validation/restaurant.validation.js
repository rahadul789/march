const mongoose = require("mongoose");
const AppError = require("../../../core/errors/AppError");
const { RESTAURANT_APPROVAL_STATUSES } = require("../types");

function ensureNonEmptyString(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(`${field} is required`, 400, "VALIDATION_ERROR", {
      field,
    });
  }

  return value.trim();
}

function parseBoolean(value, field) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (normalized === "true") {
      return true;
    }

    if (normalized === "false") {
      return false;
    }
  }

  throw new AppError(
    `${field} must be true or false`,
    400,
    "VALIDATION_ERROR",
    { field },
  );
}

function parseOptionalBoolean(value, field) {
  if (typeof value === "undefined") {
    return undefined;
  }

  return parseBoolean(value, field);
}

function parseNumber(value, field) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new AppError(
      `${field} must be a valid number`,
      400,
      "VALIDATION_ERROR",
      { field },
    );
  }

  return number;
}

function parseOptionalObjectId(value, field) {
  if (typeof value === "undefined" || value === null || value === "") {
    return undefined;
  }

  if (!mongoose.isValidObjectId(value)) {
    throw new AppError(
      `${field} must be a valid ObjectId`,
      400,
      "VALIDATION_ERROR",
      { field },
    );
  }

  return value;
}

function normalizeAddress(addressInput) {
  if (typeof addressInput === "string") {
    return {
      fullAddress: ensureNonEmptyString(addressInput, "address"),
    };
  }

  if (!addressInput || typeof addressInput !== "object") {
    throw new AppError("address is required", 400, "VALIDATION_ERROR", {
      field: "address",
    });
  }

  const fullAddress = ensureNonEmptyString(
    addressInput.fullAddress,
    "address.fullAddress",
  );

  return {
    fullAddress,
    city:
      typeof addressInput.city === "string"
        ? addressInput.city.trim() || null
        : null,
    state:
      typeof addressInput.state === "string"
        ? addressInput.state.trim() || null
        : null,
    country:
      typeof addressInput.country === "string"
        ? addressInput.country.trim() || null
        : null,
    postalCode:
      typeof addressInput.postalCode === "string"
        ? addressInput.postalCode.trim() || null
        : null,
  };
}

function normalizeGeoLocation(payload) {
  const geo =
    payload && payload.geoLocation && typeof payload.geoLocation === "object"
      ? payload.geoLocation
      : null;

  let lng;
  let lat;

  if (geo && Array.isArray(geo.coordinates) && geo.coordinates.length === 2) {
    [lng, lat] = geo.coordinates;
  } else {
    lng =
      payload && typeof payload.longitude !== "undefined"
        ? payload.longitude
        : undefined;
    lat =
      payload && typeof payload.latitude !== "undefined"
        ? payload.latitude
        : undefined;
  }

  if (typeof lng === "undefined" || typeof lat === "undefined") {
    throw new AppError(
      "geoLocation coordinates are required",
      400,
      "VALIDATION_ERROR",
      {
        field: "geoLocation",
      },
    );
  }

  const normalizedLng = parseNumber(lng, "geoLocation.longitude");
  const normalizedLat = parseNumber(lat, "geoLocation.latitude");

  if (normalizedLng < -180 || normalizedLng > 180) {
    throw new AppError(
      "longitude must be between -180 and 180",
      400,
      "VALIDATION_ERROR",
      {
        field: "geoLocation.longitude",
      },
    );
  }

  if (normalizedLat < -90 || normalizedLat > 90) {
    throw new AppError(
      "latitude must be between -90 and 90",
      400,
      "VALIDATION_ERROR",
      {
        field: "geoLocation.latitude",
      },
    );
  }

  return {
    type: "Point",
    coordinates: [normalizedLng, normalizedLat],
  };
}

function validateCreatePayload(body) {
  if (!body || typeof body !== "object") {
    throw new AppError("Invalid request body", 400, "VALIDATION_ERROR");
  }

  const name = ensureNonEmptyString(body.name, "name");
  const description = ensureNonEmptyString(body.description, "description");
  const address = normalizeAddress(body.address);
  const geoLocation = normalizeGeoLocation(body);

  const commissionRate =
    typeof body.commissionRate === "undefined"
      ? 15
      : parseNumber(body.commissionRate, "commissionRate");

  if (commissionRate < 0 || commissionRate > 100) {
    throw new AppError(
      "commissionRate must be between 0 and 100",
      400,
      "VALIDATION_ERROR",
      {
        field: "commissionRate",
      },
    );
  }

  const isActive =
    typeof body.isActive === "undefined"
      ? true
      : parseBoolean(body.isActive, "isActive");

  let approvalStatus;
  if (typeof body.approvalStatus !== "undefined") {
    approvalStatus = ensureNonEmptyString(
      body.approvalStatus,
      "approvalStatus",
    ).toLowerCase();

    if (!Object.values(RESTAURANT_APPROVAL_STATUSES).includes(approvalStatus)) {
      throw new AppError(
        "Invalid approvalStatus value",
        400,
        "VALIDATION_ERROR",
        {
          field: "approvalStatus",
        },
      );
    }
  }

  return {
    name,
    description,
    address,
    geoLocation,
    ownerId: parseOptionalObjectId(body.ownerId, "ownerId"),
    approvalStatus,
    commissionRate,
    isActive,
  };
}

function validateListQuery(query) {
  const source = query || {};

  const page =
    typeof source.page === "undefined"
      ? 1
      : Math.trunc(parseNumber(source.page, "page"));
  const limit =
    typeof source.limit === "undefined"
      ? 5
      : Math.trunc(parseNumber(source.limit, "limit"));

  if (page < 1) {
    throw new AppError("page must be >= 1", 400, "VALIDATION_ERROR", {
      field: "page",
    });
  }

  if (limit < 1 || limit > 100) {
    throw new AppError(
      "limit must be between 1 and 100",
      400,
      "VALIDATION_ERROR",
      { field: "limit" },
    );
  }

  let approvalStatus;
  if (typeof source.approvalStatus !== "undefined") {
    approvalStatus = ensureNonEmptyString(
      source.approvalStatus,
      "approvalStatus",
    ).toLowerCase();

    if (!Object.values(RESTAURANT_APPROVAL_STATUSES).includes(approvalStatus)) {
      throw new AppError(
        "Invalid approvalStatus value",
        400,
        "VALIDATION_ERROR",
        {
          field: "approvalStatus",
        },
      );
    }
  }

  let geo;
  if (
    typeof source.lng !== "undefined" ||
    typeof source.lat !== "undefined" ||
    typeof source.radiusMeters !== "undefined"
  ) {
    if (
      typeof source.lng === "undefined" ||
      typeof source.lat === "undefined"
    ) {
      throw new AppError(
        "Both lng and lat are required for geo search",
        400,
        "VALIDATION_ERROR",
        {
          field: "geo",
        },
      );
    }

    const lng = parseNumber(source.lng, "lng");
    const lat = parseNumber(source.lat, "lat");
    const radiusMeters =
      typeof source.radiusMeters === "undefined"
        ? 5000
        : parseNumber(source.radiusMeters, "radiusMeters");

    if (lng < -180 || lng > 180) {
      throw new AppError(
        "lng must be between -180 and 180",
        400,
        "VALIDATION_ERROR",
        {
          field: "lng",
        },
      );
    }

    if (lat < -90 || lat > 90) {
      throw new AppError(
        "lat must be between -90 and 90",
        400,
        "VALIDATION_ERROR",
        {
          field: "lat",
        },
      );
    }

    if (radiusMeters <= 0 || radiusMeters > 50000) {
      throw new AppError(
        "radiusMeters must be between 1 and 50000",
        400,
        "VALIDATION_ERROR",
        {
          field: "radiusMeters",
        },
      );
    }

    geo = {
      lng,
      lat,
      radiusMeters,
    };
  }

  return {
    q: typeof source.q === "string" ? source.q.trim() : undefined,
    ownerId: parseOptionalObjectId(source.ownerId, "ownerId"),
    approvalStatus,
    isActive: parseOptionalBoolean(source.isActive, "isActive"),
    geo,
    page,
    limit,
  };
}

function validateRestaurantIdParam(params) {
  const restaurantId = params && params.restaurantId;

  if (!restaurantId || !mongoose.isValidObjectId(restaurantId)) {
    throw new AppError(
      "restaurantId must be a valid ObjectId",
      400,
      "VALIDATION_ERROR",
      {
        field: "restaurantId",
      },
    );
  }

  return restaurantId;
}

function validateApprovalUpdatePayload(body) {
  if (!body || typeof body !== "object") {
    throw new AppError("Invalid request body", 400, "VALIDATION_ERROR");
  }

  const approvalStatus = ensureNonEmptyString(
    body.approvalStatus,
    "approvalStatus",
  ).toLowerCase();

  if (!Object.values(RESTAURANT_APPROVAL_STATUSES).includes(approvalStatus)) {
    throw new AppError(
      "Invalid approvalStatus value",
      400,
      "VALIDATION_ERROR",
      {
        field: "approvalStatus",
      },
    );
  }

  return { approvalStatus };
}

function validateActiveUpdatePayload(body) {
  if (!body || typeof body !== "object") {
    throw new AppError("Invalid request body", 400, "VALIDATION_ERROR");
  }

  return {
    isActive: parseBoolean(body.isActive, "isActive"),
  };
}

module.exports = {
  validateCreatePayload,
  validateListQuery,
  validateRestaurantIdParam,
  validateApprovalUpdatePayload,
  validateActiveUpdatePayload,
};
