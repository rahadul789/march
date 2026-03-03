const express = require('express');
const asyncHandler = require('../../../core/errors/asyncHandler');
const cartController = require('../controller/cart.controller');
const { requireAuth, requireRoles } = require('../../auth/service/auth.guard');
const { USER_ROLES } = require('../../auth/types');

const router = express.Router();

router.use(requireAuth, requireRoles(USER_ROLES.USER));

router.get('/restaurant/:restaurantId', asyncHandler(cartController.getCart));
router.post('/restaurant/:restaurantId/items', asyncHandler(cartController.addItem));
router.patch('/restaurant/:restaurantId/items/:menuId', asyncHandler(cartController.updateItem));
router.delete('/restaurant/:restaurantId/items/:menuId', asyncHandler(cartController.removeItem));

router.post('/restaurant/:restaurantId/lock', asyncHandler(cartController.lockCart));
router.post('/restaurant/:restaurantId/unlock', asyncHandler(cartController.unlockCart));

module.exports = router;
