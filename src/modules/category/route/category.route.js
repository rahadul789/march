const express = require("express");
const asyncHandler = require("../../../core/errors/asyncHandler");
const categoryController = require("../controller/category.controller");
const { requireAuth, requireRoles } = require("../../auth/service/auth.guard");
const { USER_ROLES } = require("../../auth/types");

const router = express.Router();

router.get(
  "/restaurant/:restaurantId",
  asyncHandler(categoryController.listCategories),
);
router.get(
  "/restaurant/:restaurantId/owner",
  requireAuth,
  requireRoles(USER_ROLES.RESTAURANT_OWNER),
  asyncHandler(categoryController.listOwnerCategories),
);

router.post(
  "/restaurant/:restaurantId",
  requireAuth,
  requireRoles(USER_ROLES.RESTAURANT_OWNER),
  asyncHandler(categoryController.createCategory),
);

router.patch(
  "/:categoryId",
  requireAuth,
  requireRoles(USER_ROLES.RESTAURANT_OWNER),
  asyncHandler(categoryController.updateCategory),
);

router.delete(
  "/:categoryId",
  requireAuth,
  requireRoles(USER_ROLES.RESTAURANT_OWNER),
  asyncHandler(categoryController.deleteCategory),
);

module.exports = router;
