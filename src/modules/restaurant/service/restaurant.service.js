const mongoose = require("mongoose");
const AppError = require("../../../core/errors/AppError");
const { USER_ROLES } = require("../../auth/types");
const { Restaurant } = require("../model");
const { RESTAURANT_APPROVAL_STATUSES } = require("../types");

function sanitizeRestaurant(document) {
  return {
    id: document._id.toString(),
    name: document.name,
    description: document.description,
    address: document.address,
    geoLocation: document.geoLocation,
    ownerId: document.ownerId.toString(),
    approvalStatus: document.approvalStatus,
    commissionRate: document.commissionRate,
    isActive: document.isActive,
    isDeleted: document.isDeleted,
    deletedAt: document.deletedAt,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function ensureObjectId(value, fieldName) {
  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }

  if (!mongoose.isValidObjectId(value)) {
    throw new AppError(
      `${fieldName} must be a valid ObjectId`,
      400,
      "VALIDATION_ERROR",
      {
        field: fieldName,
      },
    );
  }

  return new mongoose.Types.ObjectId(value);
}

function buildListQuery(filters = {}, options = {}) {
  const query = {
    isDeleted: false,
  };

  const isOwnerScope = Boolean(options.isOwnerScope);
  const isAdminScope = Boolean(options.isAdminScope);

  if (!isOwnerScope && !isAdminScope) {
    query.approvalStatus = RESTAURANT_APPROVAL_STATUSES.APPROVED;
    query.isActive = true;
  }

  if (filters.ownerId) {
    query.ownerId = ensureObjectId(filters.ownerId, "ownerId");
  }

  if (filters.approvalStatus) {
    query.approvalStatus = filters.approvalStatus;
  }

  if (typeof filters.isActive === "boolean") {
    query.isActive = filters.isActive;
  }

  if (filters.q) {
    query.$text = { $search: filters.q };
  }

  if (
    filters.geo &&
    typeof filters.geo.lng === "number" &&
    typeof filters.geo.lat === "number"
  ) {
    // query.geoLocation = { //////////$nearSphere aggregation-এ allowed না। eta somehow kaz korchilo na then nicher code ta likhlam
    //   $nearSphere: {
    //     $geometry: {
    //       type: "Point",
    //       coordinates: [filters.geo.lng, filters.geo.lat],
    //     },
    //     $maxDistance: filters.geo.radiusMeters,
    //   },
    // };
    const earthRadiusInMeters = 6378137;

    query.geoLocation = {
      $geoWithin: {
        $centerSphere: [
          [filters.geo.lng, filters.geo.lat],
          filters.geo.radiusMeters / earthRadiusInMeters,
        ],
      },
    };
  }

  return query;
}

function calculateCommissionAmount(subtotal, commissionRate) {
  const normalizedSubtotal = Number(subtotal);
  const normalizedRate = Number(commissionRate);

  if (!Number.isFinite(normalizedSubtotal) || normalizedSubtotal < 0) {
    throw new AppError(
      "Subtotal must be a non-negative number",
      400,
      "VALIDATION_ERROR",
      {
        field: "subtotal",
      },
    );
  }

  if (
    !Number.isFinite(normalizedRate) ||
    normalizedRate < 0 ||
    normalizedRate > 100
  ) {
    throw new AppError(
      "Commission rate must be between 0 and 100",
      400,
      "VALIDATION_ERROR",
      {
        field: "commissionRate",
      },
    );
  }

  const amount = Number(
    ((normalizedSubtotal * normalizedRate) / 100).toFixed(2),
  );

  return {
    subtotal: Number(normalizedSubtotal.toFixed(2)),
    commissionRate: Number(normalizedRate.toFixed(2)),
    commissionAmount: amount,
    ownerNetAmount: Number((normalizedSubtotal - amount).toFixed(2)),
  };
}

async function createRestaurant(payload, actor) {
  const ownerId =
    actor.role === USER_ROLES.ADMIN && payload.ownerId
      ? ensureObjectId(payload.ownerId, "ownerId")
      : ensureObjectId(actor.userId, "ownerId");

  const approvalStatus =
    actor.role === USER_ROLES.ADMIN && payload.approvalStatus
      ? payload.approvalStatus
      : RESTAURANT_APPROVAL_STATUSES.PENDING;

  const restaurant = await Restaurant.create({
    name: payload.name,
    description: payload.description,
    address: payload.address,
    geoLocation: payload.geoLocation,
    ownerId,
    approvalStatus,
    commissionRate: payload.commissionRate,
    isActive: payload.isActive,
  });

  return sanitizeRestaurant(restaurant);
}

async function listRestaurants(filters, actor = null) {
  const query = buildListQuery(filters, {
    isOwnerScope: false,
    isAdminScope: actor && actor.role === USER_ROLES.ADMIN,
  });

  const page = filters.page;
  const limit = filters.limit;
  const skip = (page - 1) * limit;

  let findQuery = Restaurant.find(query)
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  if (filters.q) {
    findQuery = findQuery.sort({
      score: { $meta: "textScore" },
      createdAt: -1,
    });
  }

  const [items, total] = await Promise.all([
    findQuery,
    Restaurant.countDocuments(query),
  ]);

  return {
    items: items.map(sanitizeRestaurant),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

async function listRestaurantsForOwner(ownerId, filters, actor) {
  const ownerObjectId = ensureObjectId(ownerId, "ownerId");

  if (
    actor.role !== USER_ROLES.ADMIN &&
    ownerObjectId.toString() !== actor.userId
  ) {
    throw new AppError(
      "Cannot access restaurants for another owner",
      403,
      "FORBIDDEN_OWNER_SCOPE",
    );
  }

  const scopedFilters = {
    ...filters,
    ownerId: ownerObjectId,
  };

  const query = buildListQuery(scopedFilters, {
    isOwnerScope: true,
    isAdminScope: actor.role === USER_ROLES.ADMIN,
  });

  const page = filters.page;
  const limit = filters.limit;
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Restaurant.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }),
    Restaurant.countDocuments(query),
  ]);

  return {
    items: items.map(sanitizeRestaurant),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

async function getRestaurantById(restaurantId, actor = null) {
  const _id = ensureObjectId(restaurantId, "restaurantId");

  const query = {
    _id,
    isDeleted: false,
  };

  if (!actor || actor.role !== USER_ROLES.ADMIN) {
    query.approvalStatus = RESTAURANT_APPROVAL_STATUSES.APPROVED;
    query.isActive = true;
  }

  const restaurant = await Restaurant.findOne(query);

  if (!restaurant) {
    throw new AppError("Restaurant not found", 404, "RESTAURANT_NOT_FOUND");
  }

  return sanitizeRestaurant(restaurant);
}

async function updateApprovalStatus(restaurantId, payload, actor) {
  if (actor.role !== USER_ROLES.ADMIN) {
    throw new AppError(
      "Only admin can update approval status",
      403,
      "FORBIDDEN_ROLE",
    );
  }

  const _id = ensureObjectId(restaurantId, "restaurantId");

  const update = {
    approvalStatus: payload.approvalStatus,
  };

  if (payload.approvalStatus !== RESTAURANT_APPROVAL_STATUSES.APPROVED) {
    update.isActive = false;
  }

  const restaurant = await Restaurant.findOneAndUpdate(
    {
      _id,
      isDeleted: false,
    },
    { $set: update },
    { new: true },
  );

  if (!restaurant) {
    throw new AppError("Restaurant not found", 404, "RESTAURANT_NOT_FOUND");
  }

  return sanitizeRestaurant(restaurant);
}

async function updateActiveFlag(restaurantId, payload, actor) {
  const _id = ensureObjectId(restaurantId, "restaurantId");

  const query = {
    _id,
    isDeleted: false,
  };

  if (actor.role !== USER_ROLES.ADMIN) {
    query.ownerId = ensureObjectId(actor.userId, "ownerId");
  }

  const restaurant = await Restaurant.findOne(query);

  if (!restaurant) {
    throw new AppError("Restaurant not found", 404, "RESTAURANT_NOT_FOUND");
  }

  if (
    payload.isActive &&
    restaurant.approvalStatus !== RESTAURANT_APPROVAL_STATUSES.APPROVED
  ) {
    throw new AppError(
      "Restaurant must be approved before activation",
      400,
      "RESTAURANT_NOT_APPROVED",
    );
  }

  restaurant.isActive = payload.isActive;
  await restaurant.save();

  return sanitizeRestaurant(restaurant);
}

async function softDeleteRestaurant(restaurantId, actor) {
  const _id = ensureObjectId(restaurantId, "restaurantId");

  const query = {
    _id,
    isDeleted: false,
  };

  if (actor.role !== USER_ROLES.ADMIN) {
    query.ownerId = ensureObjectId(actor.userId, "ownerId");
  }

  const restaurant = await Restaurant.findOneAndUpdate(
    query,
    {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: ensureObjectId(actor.userId, "deletedBy"),
        isActive: false,
      },
    },
    { new: true },
  );

  if (!restaurant) {
    throw new AppError("Restaurant not found", 404, "RESTAURANT_NOT_FOUND");
  }

  return {
    id: restaurant._id.toString(),
    isDeleted: restaurant.isDeleted,
    deletedAt: restaurant.deletedAt,
  };
}

module.exports = {
  createRestaurant,
  listRestaurants,
  listRestaurantsForOwner,
  getRestaurantById,
  updateApprovalStatus,
  updateActiveFlag,
  softDeleteRestaurant,
  calculateCommissionAmount,
};
