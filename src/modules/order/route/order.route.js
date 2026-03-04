const express = require('express');
const asyncHandler = require('../../../core/errors/asyncHandler');
const orderController = require('../controller/order.controller');
const { requireAuth, requireRoles } = require('../../auth/service/auth.guard');
const { USER_ROLES } = require('../../auth/types');

const router = express.Router();

router.post(
  '/restaurant/:restaurantId',
  requireAuth,
  requireRoles(USER_ROLES.USER),
  asyncHandler(orderController.createOrder)
);

router.patch(
  '/:orderId/status',
  requireAuth,
  asyncHandler(orderController.transitionOrderStatus)
);

module.exports = router;
