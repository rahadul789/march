const express = require('express');
const asyncHandler = require('../../../core/errors/asyncHandler');
const menuController = require('../controller/menu.controller');
const { requireAuth, requireRoles } = require('../../auth/service/auth.guard');
const { USER_ROLES } = require('../../auth/types');

const router = express.Router();

router.get('/restaurant/:restaurantId', asyncHandler(menuController.listRestaurantMenu));
router.get('/restaurant/:restaurantId/owner', requireAuth, requireRoles(USER_ROLES.RESTAURANT_OWNER), asyncHandler(menuController.listOwnerMenu));
router.get('/:menuId', asyncHandler(menuController.getMenuById));

router.post('/restaurant/:restaurantId', requireAuth, requireRoles(USER_ROLES.RESTAURANT_OWNER), asyncHandler(menuController.createMenu));
router.patch('/:menuId', requireAuth, requireRoles(USER_ROLES.RESTAURANT_OWNER), asyncHandler(menuController.updateMenu));
router.delete('/:menuId', requireAuth, requireRoles(USER_ROLES.RESTAURANT_OWNER), asyncHandler(menuController.deleteMenu));

module.exports = router;
