const mongoose = require("mongoose");
const AppError = require("../../../core/errors/AppError");
const { USER_ROLES, ACCOUNT_STATUSES } = require("../../auth/types");
const { User } = require("../../auth/model");
const { Order } = require("../../order/model");
const { DeliverymanProfile } = require("../model");
const {
  ACTIVE_DELIVERY_ORDER_STATUSES,
  DELIVERY_PROFILE_DEFAULTS,
  DELIVERY_VEHICLE_TYPES,
} = require("../types");

function roundCoordinate(value) {
  return Number(Number(value).toFixed(6));
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

function assertDeliverymanActor(actor) {
  if (!actor || actor.role !== USER_ROLES.DELIVERYMAN) {
    throw new AppError(
      "Only deliveryman role can access this resource",
      403,
      "FORBIDDEN_ROLE",
    );
  }
}

async function ensureDeliverymanUser(userId) {
  const user = await User.findOne({
    _id: ensureObjectId(userId, "userId"),
    role: USER_ROLES.DELIVERYMAN,
    status: ACCOUNT_STATUSES.ACTIVE,
  }).select("fullName phone");

  if (!user) {
    throw new AppError(
      "Active deliveryman user not found",
      404,
      "DELIVERYMAN_USER_NOT_FOUND",
    );
  }

  return user;
}

async function getActiveOrderCountForDeliveryman(deliverymanUserId) {
  const count = await Order.countDocuments({
    deliverymanId: ensureObjectId(deliverymanUserId, "deliverymanId"),
    status: {
      $in: ACTIVE_DELIVERY_ORDER_STATUSES,
    },
  });

  return count;
}

function sanitizeDeliverymanProfileWithCount(document, activeOrderCount) {
  return {
    id: document._id.toString(),
    userId: document.userId.toString(),
    profile: {
      fullName: document.profile.fullName,
      phone: document.profile.phone,
      avatarUrl: document.profile.avatarUrl,
      vehicleType: document.profile.vehicleType,
      vehicleNumber: document.profile.vehicleNumber,
    },
    isOnline: document.isOnline,
    isAvailable: document.isAvailable,
    currentLocation: document.currentLocation,
    currentLocationAccuracyMeters: document.currentLocationAccuracyMeters,
    lastSeenAt: document.lastSeenAt,
    activeOrderCount: Number(activeOrderCount || 0),
    supportsMultipleActiveOrders: true,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

async function sanitizeDeliverymanProfile(document) {
  const activeOrderCount = await getActiveOrderCountForDeliveryman(
    document.userId,
  );
  return sanitizeDeliverymanProfileWithCount(document, activeOrderCount);
}

async function getOrCreateOwnProfile(actor) {
  assertDeliverymanActor(actor);

  const user = await ensureDeliverymanUser(actor.userId);
  const userObjectId = ensureObjectId(actor.userId, "userId");

  const profile = await DeliverymanProfile.findOneAndUpdate(
    { userId: userObjectId },
    {
      $setOnInsert: {
        userId: userObjectId,
        profile: {
          fullName: user.fullName,
          phone: user.phone,
          avatarUrl: null,
          vehicleType: DELIVERY_VEHICLE_TYPES.BIKE,
          vehicleNumber: null,
        },
        isOnline: false,
        isAvailable: false,
        currentLocation: {
          type: "Point",
          coordinates: [90.724831, 24.876534],
        },
        currentLocationAccuracyMeters: null,
        lastSeenAt: new Date(),
      },
    },
    {
      upsert: true,
      new: true,
    },
  );

  return profile;
}

async function updateOwnProfile(actor, payload) {
  const profile = await getOrCreateOwnProfile(actor);

  if (payload.fullName) {
    profile.profile.fullName = payload.fullName;
  }

  if (payload.phone) {
    profile.profile.phone = payload.phone;
  }

  if (typeof payload.avatarUrl !== "undefined") {
    profile.profile.avatarUrl = payload.avatarUrl;
  }

  if (payload.vehicleType) {
    profile.profile.vehicleType = payload.vehicleType;
  }

  if (typeof payload.vehicleNumber !== "undefined") {
    profile.profile.vehicleNumber = payload.vehicleNumber;
  }

  profile.lastSeenAt = new Date();

  await profile.save();

  return sanitizeDeliverymanProfile(profile);
}

async function getOwnProfile(actor) {
  const profile = await getOrCreateOwnProfile(actor);
  return sanitizeDeliverymanProfile(profile);
}

async function setOnlineStatus(actor, isOnline) {
  const profile = await getOrCreateOwnProfile(actor);

  profile.isOnline = isOnline;
  if (!isOnline) {
    profile.isAvailable = false;
  }
  profile.lastSeenAt = new Date();

  await profile.save();

  return sanitizeDeliverymanProfile(profile);
}

async function setAvailabilityStatus(actor, isAvailable) {
  const profile = await getOrCreateOwnProfile(actor);

  if (isAvailable && !profile.isOnline) {
    throw new AppError(
      "Deliveryman must be online before becoming available",
      400,
      "DELIVERYMAN_OFFLINE",
    );
  }

  profile.isAvailable = isAvailable;
  profile.lastSeenAt = new Date();

  await profile.save();

  return sanitizeDeliverymanProfile(profile);
}

async function updateCurrentLocation(actor, payload) {
  const profile = await getOrCreateOwnProfile(actor);

  profile.currentLocation = {
    type: "Point",
    coordinates: [roundCoordinate(payload.lng), roundCoordinate(payload.lat)],
  };

  if (typeof payload.accuracyMeters === "number") {
    profile.currentLocationAccuracyMeters = payload.accuracyMeters;
  }

  profile.lastSeenAt = new Date();

  await profile.save();

  return sanitizeDeliverymanProfile(profile);
}

async function heartbeat(actor, payload = {}) {
  let profile = await getOrCreateOwnProfile(actor);

  if (typeof payload.lng === "number" && typeof payload.lat === "number") {
    profile.currentLocation = {
      type: "Point",
      coordinates: [roundCoordinate(payload.lng), roundCoordinate(payload.lat)],
    };

    if (typeof payload.accuracyMeters === "number") {
      profile.currentLocationAccuracyMeters = payload.accuracyMeters;
    }
  }

  profile.lastSeenAt = new Date();
  await profile.save();

  profile = await DeliverymanProfile.findById(profile._id);
  return sanitizeDeliverymanProfile(profile);
}

async function findAvailableDeliverymenNearby(filters) {
  const radiusMeters =
    typeof filters.radiusMeters === "number"
      ? filters.radiusMeters
      : DELIVERY_PROFILE_DEFAULTS.SEARCH_RADIUS_METERS;

  const query = {
    isOnline: true,
    isAvailable: true,
    currentLocation: {
      $nearSphere: {
        $geometry: {
          type: "Point",
          coordinates: [filters.lng, filters.lat],
        },
        $maxDistance: radiusMeters,
      },
    },
  };

  const profiles = await DeliverymanProfile.find(query)
    .limit(filters.limit)
    .sort({ lastSeenAt: -1 });

  const userIds = profiles.map((profile) =>
    ensureObjectId(profile.userId, "userId"),
  );

  const counts = await Order.aggregate([
    {
      $match: {
        deliverymanId: { $in: userIds },
        status: { $in: ACTIVE_DELIVERY_ORDER_STATUSES },
      },
    },
    {
      $group: {
        _id: "$deliverymanId",
        activeOrderCount: { $sum: 1 },
      },
    },
  ]);

  const countMap = new Map(
    counts.map((row) => [String(row._id), Number(row.activeOrderCount || 0)]),
  );

  const result = profiles.map((profile) =>
    sanitizeDeliverymanProfileWithCount(
      profile,
      countMap.get(String(profile.userId)) || 0,
    ),
  );

  return {
    items: result,
    meta: {
      radiusMeters,
      limit: filters.limit,
      total: result.length,
    },
  };
}

module.exports = {
  getOwnProfile,
  updateOwnProfile,
  setOnlineStatus,
  setAvailabilityStatus,
  updateCurrentLocation,
  heartbeat,
  findAvailableDeliverymenNearby,
  assertDeliverymanActor,
  getActiveOrderCountForDeliveryman,
};
