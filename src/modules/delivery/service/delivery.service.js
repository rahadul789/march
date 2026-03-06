const mongoose = require("mongoose");
const AppError = require("../../../core/errors/AppError");
const { emitEvent } = require("../../../core/events/internalEventBus");
const {
  ORDER_ASSIGNMENT_TIMEOUT_EVENT,
} = require("../../../core/events/eventTypes");
const { USER_ROLES, ACCOUNT_STATUSES } = require("../../auth/types");
const { User } = require("../../auth/model");
const { Restaurant } = require("../../restaurant/model");
const { Order } = require("../../order/model");
const orderService = require("../../order/service/order.service");
const { ORDER_STATUSES } = require("../../order/types");
const { DeliverymanProfile, OrderAssignmentLock } = require("../model");
const {
  ACTIVE_DELIVERY_ORDER_STATUSES,
  DELIVERY_PROFILE_DEFAULTS,
  DELIVERY_ASSIGNMENT_DEFAULTS,
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

function assertAssignmentActor(actor) {
  if (!actor || !actor.userId || !actor.role) {
    throw new AppError(
      "Authenticated actor is required",
      401,
      "AUTHORIZATION_REQUIRED",
    );
  }

  if (![USER_ROLES.ADMIN, USER_ROLES.RESTAURANT_OWNER].includes(actor.role)) {
    throw new AppError(
      "Only admin or restaurant owner can assign orders",
      403,
      "FORBIDDEN_ROLE",
    );
  }
}

function isOrderAssignable(order) {
  return (
    order &&
    order.status === ORDER_STATUSES.READY_FOR_PICKUP &&
    !order.deliverymanId
  );
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

async function ensureOwnerAssignmentScope(order, actor) {
  if (actor.role !== USER_ROLES.RESTAURANT_OWNER) {
    return;
  }

  const restaurant = await Restaurant.findOne({
    _id: order.restaurantId,
    ownerId: ensureObjectId(actor.userId, "actor.userId"),
    isDeleted: false,
  }).select("_id");

  if (!restaurant) {
    throw new AppError(
      "Order is not under your restaurant scope",
      403,
      "FORBIDDEN_OWNER_SCOPE",
    );
  }
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

async function acquireOrderAssignmentLock(
  orderId,
  actorUserId,
  lockTtlSeconds,
) {
  const orderObjectId = ensureObjectId(orderId, "orderId");
  const actorObjectId = ensureObjectId(actorUserId, "actor.userId");
  const now = new Date();
  const lockToken = new mongoose.Types.ObjectId().toString();
  const expiresAt = new Date(now.getTime() + lockTtlSeconds * 1000);

  try {
    const lock = await OrderAssignmentLock.findOneAndUpdate(
      {
        orderId: orderObjectId,
        $or: [
          { expiresAt: { $lte: now } },
          { expiresAt: null },
          { expiresAt: { $exists: false } },
        ],
      },
      {
        $setOnInsert: {
          orderId: orderObjectId,
        },
        $set: {
          lockToken,
          lockedByUserId: actorObjectId,
          acquiredAt: now,
          expiresAt,
          lastAttemptAt: now,
          attemptCount: 0,
        },
      },
      {
        upsert: true,
        new: true,
      },
    );

    return lock;
  } catch (error) {
    if (error && error.code === 11000) {
      throw new AppError(
        "Order assignment is already in progress",
        409,
        "ORDER_ASSIGNMENT_LOCKED",
      );
    }

    throw error;
  }
}

async function touchAssignmentLock(lockId, lockToken) {
  if (!lockId || !lockToken) {
    return;
  }

  await OrderAssignmentLock.updateOne(
    {
      _id: lockId,
      lockToken,
    },
    {
      $set: {
        lastAttemptAt: new Date(),
      },
      $inc: {
        attemptCount: 1,
      },
    },
  );
}

async function releaseOrderAssignmentLock(orderId, lockToken) {
  if (!orderId || !lockToken) {
    return;
  }

  await OrderAssignmentLock.deleteOne({
    orderId: ensureObjectId(orderId, "orderId"),
    lockToken,
  });
}

async function findNearbyAssignableRiders(restaurantCoordinates, payload) {
  if (
    !Array.isArray(restaurantCoordinates) ||
    restaurantCoordinates.length !== 2
  ) {
    throw new AppError(
      "Restaurant location is missing or invalid for assignment",
      409,
      "RESTAURANT_LOCATION_UNAVAILABLE",
    );
  }

  const staleCutoff = new Date(
    Date.now() - payload.maxLastSeenAgeSeconds * 1000,
  );

  const candidates = await DeliverymanProfile.aggregate([
    {
      $geoNear: {
        near: {
          type: "Point",
          coordinates: restaurantCoordinates,
        },
        distanceField: "distanceMeters",
        spherical: true,
        key: "currentLocation",
        maxDistance: payload.searchRadiusMeters,
        query: {
          isOnline: true,
          isAvailable: true, // eta comment korle multiple delivery assign kora jabe
          lastSeenAt: { $gte: staleCutoff },
        },
      },
    },
    {
      $sort: {
        distanceMeters: 1,
        lastSeenAt: -1,
      },
    },
    {
      $limit: payload.candidateLimit,
    },
    {
      $project: {
        _id: 1,
        userId: 1,
        distanceMeters: 1,
        lastSeenAt: 1,
      },
    },
  ]);

  if (!candidates.length) {
    return [];
  }

  const candidateUserIds = candidates.map((candidate) =>
    ensureObjectId(candidate.userId, "candidate.userId"),
  );

  const activeDeliveryUsers = await User.find({
    _id: { $in: candidateUserIds },
    role: USER_ROLES.DELIVERYMAN,
    status: ACCOUNT_STATUSES.ACTIVE,
  }).select("_id");

  const activeUserIdSet = new Set(
    activeDeliveryUsers.map((user) => String(user._id)),
  );

  return candidates
    .filter((candidate) => activeUserIdSet.has(String(candidate.userId)))
    .map((candidate) => ({
      profileId: candidate._id.toString(),
      userId: candidate.userId.toString(),
      distanceMeters: Number(candidate.distanceMeters || 0),
      lastSeenAt: candidate.lastSeenAt,
    }));
}

async function autoAssignOrder(orderId, payload, actor, context = {}) {
  assertAssignmentActor(actor);

  const orderObjectId = ensureObjectId(orderId, "orderId");

  // এই order assign করা হচ্ছে
  // আর কেউ assign করতে পারবে না// এই lock টা acquire করতে পারবে শুধু একবারই
  // একই order যেন একসাথে দুইজন assign করতে না পারে
  // Server A → assign start
  // Server B → blocked
  const lock = await acquireOrderAssignmentLock(
    orderObjectId,
    actor.userId,
    payload.lockTtlSeconds,
  );

  // 3 seconds এর মধ্যে rider খুঁজতে হবে না পেলে assignment stop
  const timeoutAt = Date.now() + payload.assignmentTimeoutMs;
  // Current time = 10:00:00
  // maxLastSeenAgeSeconds = 120
  // 10:00:00 - 120 seconds
  // = 09:58:00
  // staleCutoff = 09:58:00
  // যে deliveryman 09:58 এর আগে lastSeen ছিল তাকে ignore করা হবে
  const staleCutoff = new Date(
    Date.now() - payload.maxLastSeenAgeSeconds * 1000, //এটা check করে deliveryman কতক্ষণ আগে last seen হয়েছে। যদি অনেকদিন আগে last seen হয়ে থাকে তাহলে তাকে candidate থেকে বাদ দেয়া হবে
  );

  try {
    let order = await Order.findById(orderObjectId).select(
      "orderNumber restaurantId status deliverymanId revision userId",
    );

    if (!order) {
      throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
    }

    // restaurant owner নিজের restaurant এর order assign করতে পারবে
    await ensureOwnerAssignmentScope(order, actor);

    // Already assigned হলে error।
    if (!isOrderAssignable(order)) {
      throw new AppError(
        "Order is not assignable in current state",
        409,
        "ORDER_NOT_ASSIGNABLE",
        {
          currentStatus: order.status,
          deliverymanId: order.deliverymanId
            ? String(order.deliverymanId)
            : null,
        },
      );
    }
    // Restaurant location দরকার rider search করার জন্য।
    const restaurant = await Restaurant.findOne({
      _id: order.restaurantId,
      isDeleted: false,
    }).select("geoLocation");

    if (!restaurant || !restaurant.geoLocation) {
      throw new AppError(
        "Restaurant location is unavailable for assignment",
        409,
        "RESTAURANT_LOCATION_UNAVAILABLE",
      );
    }

    // geo query দিয়ে nearest riders খুঁজে
    const candidates = await findNearbyAssignableRiders(
      restaurant.geoLocation.coordinates,
      payload,
    );

    // const candidates = [
    //   {
    //     "_id": "p1",
    //     "userId": "u1",
    //     "distanceMeters": 250,
    //     "lastSeenAt": "2026-03-06T10:00:00"
    //   },
    //   {
    //     "_id": "p2",
    //     "userId": "u2",
    //     "distanceMeters": 400,
    //     "lastSeenAt": "2026-03-06T10:01:00"
    //   },
    // ]

    // assignment progress track করা
    let assignedOrder = null;
    let selectedCandidate = null;
    let attemptedCount = 0;

    // Nearest rider → next rider।
    for (const candidate of candidates) {
      if (Date.now() > timeoutAt) {
        break;
      }

      attemptedCount += 1;
      // Assignment progress database এ update।
      await touchAssignmentLock(lock._id, lock.lockToken);

      // Rider offline হলে skip।
      const candidateStillAvailable = await DeliverymanProfile.findOne({
        _id: ensureObjectId(candidate.profileId, "candidate.profileId"),
        userId: ensureObjectId(candidate.userId, "candidate.userId"),
        isOnline: true,
        isAvailable: true, // eta comment korle multiple delivery assign kora jabe
        lastSeenAt: { $gte: staleCutoff },
      }).select("userId");

      // Next rider।
      if (!candidateStillAvailable) {
        continue;
      }

      try {
        const assignmentNote =
          payload.note ||
          `Auto-assigned by nearest distance (${Math.round(candidate.distanceMeters)}m)`;

        // Order status change & DeliverymanId set hoy:
        assignedOrder = await orderService.transitionOrderStatus(
          orderObjectId,
          {
            toStatus: ORDER_STATUSES.ASSIGNED,
            expectedRevision: order.revision,
            note: assignmentNote,
            deliverymanId: candidateStillAvailable.userId.toString(),
          },
          actor,
          context,
        );

        selectedCandidate = candidate;
        break;
      } catch (error) {
        if (error && error.code === "ORDER_REVISION_CONFLICT") {
          order = await Order.findById(orderObjectId).select(
            "orderNumber restaurantId status deliverymanId revision userId",
          );

          if (!order || !isOrderAssignable(order)) {
            break;
          }

          continue;
        }

        if (error && error.code === "INVALID_ORDER_TRANSITION") {
          break;
        }

        throw error;
      }
    }

    if (assignedOrder && selectedCandidate) {
      return {
        order: assignedOrder,
        assignment: {
          matched: true,
          riderUserId: selectedCandidate.userId,
          distanceMeters: Number(selectedCandidate.distanceMeters),
          attemptedCount,
          timedOut: false,
          fallbackRequired: false,
        },
      };
    }

    const latestOrder = await Order.findById(orderObjectId);
    const timedOut = Date.now() > timeoutAt;

    emitEvent(ORDER_ASSIGNMENT_TIMEOUT_EVENT, {
      orderId: orderObjectId.toString(),
      orderNumber: latestOrder ? latestOrder.orderNumber : null,
      restaurantId: latestOrder ? latestOrder.restaurantId.toString() : null,
      requestId: context.requestId || null,
      attemptedCount,
      candidateCount: candidates.length,
      timeoutMs: payload.assignmentTimeoutMs,
      reason: timedOut ? "ASSIGNMENT_TIMEOUT" : "NO_AVAILABLE_RIDER",
      triggeredByUserId: String(actor.userId),
      triggeredByRole: actor.role,
      occurredAt: new Date().toISOString(),
    });

    return {
      order: latestOrder
        ? {
            id: latestOrder._id.toString(),
            orderNumber: latestOrder.orderNumber,
            restaurantId: latestOrder.restaurantId.toString(),
            status: latestOrder.status,
            revision: latestOrder.revision,
            deliverymanId: latestOrder.deliverymanId
              ? latestOrder.deliverymanId.toString()
              : null,
          }
        : null,
      assignment: {
        matched: false,
        riderUserId: null,
        distanceMeters: null,
        attemptedCount,
        timedOut,
        fallbackRequired: true,
        fallbackReason: timedOut ? "ASSIGNMENT_TIMEOUT" : "NO_AVAILABLE_RIDER",
      },
    };
  } finally {
    await releaseOrderAssignmentLock(orderObjectId, lock.lockToken);
  }
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
  autoAssignOrder,
};

//////////////////////////////////////// autoAssignOrder

// Order ready
//      │
//      ▼
// Lock order
//      │
//      ▼
// Find nearby riders
//      │
//      ▼
// Loop riders
//      │
//      ▼
// Check online + available
//      │
//      ▼
// Try assign
//      │
//  ┌───┴─────┐
//  │         │
// Success   Fail
//  │         │
//  ▼         ▼
// Return    Next rider
