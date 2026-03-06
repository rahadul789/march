const express = require('express');
const asyncHandler = require('../../../core/errors/asyncHandler');
const deliveryController = require('../controller/delivery.controller');
const { requireAuth, requireRoles } = require('../../auth/service/auth.guard');
const { USER_ROLES } = require('../../auth/types');

const router = express.Router();

router.get(
  '/nearby/available',
  requireAuth,
  requireRoles(USER_ROLES.ADMIN, USER_ROLES.RESTAURANT_OWNER),
  asyncHandler(deliveryController.findNearbyAvailable)
);

router.post(
  '/assignment/order/:orderId/auto',
  requireAuth,
  requireRoles(USER_ROLES.ADMIN, USER_ROLES.RESTAURANT_OWNER),
  asyncHandler(deliveryController.autoAssignOrder)
);

router.get(
  '/me',
  requireAuth,
  requireRoles(USER_ROLES.DELIVERYMAN),
  asyncHandler(deliveryController.getMyProfile)
);

router.patch(
  '/me/profile',
  requireAuth,
  requireRoles(USER_ROLES.DELIVERYMAN),
  asyncHandler(deliveryController.updateMyProfile)
);

router.patch(
  '/me/online',
  requireAuth,
  requireRoles(USER_ROLES.DELIVERYMAN),
  asyncHandler(deliveryController.setOnlineStatus)
);

router.patch(
  '/me/availability',
  requireAuth,
  requireRoles(USER_ROLES.DELIVERYMAN),
  asyncHandler(deliveryController.setAvailability)
);

router.patch(
  '/me/location',
  requireAuth,
  requireRoles(USER_ROLES.DELIVERYMAN),
  asyncHandler(deliveryController.updateLocation)
);

router.post(
  '/me/heartbeat',
  requireAuth,
  requireRoles(USER_ROLES.DELIVERYMAN),
  asyncHandler(deliveryController.heartbeat)
);

module.exports = router;
