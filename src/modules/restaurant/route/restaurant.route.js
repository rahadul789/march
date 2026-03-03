const express = require('express');
const asyncHandler = require('../../../core/errors/asyncHandler');
const restaurantController = require('../controller/restaurant.controller');
const { USER_ROLES } = require('../../auth/types');
const { requireAuth, requireRoles } = require('../../auth/service/auth.guard');

const router = express.Router();

router.get('/', asyncHandler(restaurantController.listRestaurants));
router.get(
  '/mine',
  requireAuth,
  requireRoles(USER_ROLES.RESTAURANT_OWNER, USER_ROLES.ADMIN),
  asyncHandler(restaurantController.listMyRestaurants)
);
router.get('/:restaurantId', asyncHandler(restaurantController.getRestaurantById));

router.post(
  '/',
  requireAuth,
  requireRoles(USER_ROLES.RESTAURANT_OWNER, USER_ROLES.ADMIN),
  asyncHandler(restaurantController.createRestaurant)
);

router.patch(
  '/:restaurantId/approval',
  requireAuth,
  requireRoles(USER_ROLES.ADMIN),
  asyncHandler(restaurantController.updateApprovalStatus)
);

router.patch(
  '/:restaurantId/active',
  requireAuth,
  requireRoles(USER_ROLES.RESTAURANT_OWNER, USER_ROLES.ADMIN),
  asyncHandler(restaurantController.updateActiveFlag)
);

router.delete(
  '/:restaurantId',
  requireAuth,
  requireRoles(USER_ROLES.RESTAURANT_OWNER, USER_ROLES.ADMIN),
  asyncHandler(restaurantController.softDeleteRestaurant)
);

module.exports = router;
