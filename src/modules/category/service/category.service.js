const mongoose = require("mongoose");
const AppError = require("../../../core/errors/AppError");
const { USER_ROLES } = require("../../auth/types");
const { Restaurant } = require("../../restaurant/model");
const { RESTAURANT_APPROVAL_STATUSES } = require("../../restaurant/types");
const { Category } = require("../model");

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

function sanitizeCategory(document) {
  return {
    id: document._id.toString(),
    name: document.name,
    restaurantId: document.restaurantId.toString(),
    sortOrder: document.sortOrder,
    isActive: document.isActive,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

async function ensureRestaurantExistsForPublicRead(restaurantId) {
  const restaurant = await Restaurant.findOne({
    _id: restaurantId,
    isDeleted: false,
    isActive: true,
    approvalStatus: RESTAURANT_APPROVAL_STATUSES.APPROVED,
  }).select("_id");

  if (!restaurant) {
    throw new AppError("Restaurant not found", 404, "RESTAURANT_NOT_FOUND");
  }
}

async function ensureOwnerCanModifyRestaurant(restaurantId, actor) {
  if (!actor || actor.role !== USER_ROLES.RESTAURANT_OWNER) {
    throw new AppError(
      "Only restaurant owner can modify categories",
      403,
      "FORBIDDEN_ROLE",
    );
  }

  const restaurant = await Restaurant.findOne({
    _id: restaurantId,
    ownerId: ensureObjectId(actor.userId, "ownerId"),
    isDeleted: false,
  }).select("_id");

  if (!restaurant) {
    throw new AppError(
      "Restaurant not found or not owned by actor",
      403,
      "FORBIDDEN_OWNER_SCOPE",
    );
  }
}

async function getOwnedCategoryOrThrow(categoryId, actor) {
  if (!actor || actor.role !== USER_ROLES.RESTAURANT_OWNER) {
    throw new AppError(
      "Only restaurant owner can modify categories",
      403,
      "FORBIDDEN_ROLE",
    );
  }

  const category = await Category.findById(categoryId);

  if (!category) {
    throw new AppError("Category not found", 404, "CATEGORY_NOT_FOUND");
  }

  await ensureOwnerCanModifyRestaurant(category.restaurantId, actor);

  return category;
}

async function createCategory(payload, actor) {
  const restaurantId = ensureObjectId(payload.restaurantId, "restaurantId");

  await ensureOwnerCanModifyRestaurant(restaurantId, actor);

  const category = await Category.create({
    name: payload.name,
    restaurantId,
    sortOrder: payload.sortOrder,
    isActive: payload.isActive,
  });

  return sanitizeCategory(category);
}

async function listCategoriesForRestaurant(restaurantId) {
  const restaurantObjectId = ensureObjectId(restaurantId, "restaurantId");

  await ensureRestaurantExistsForPublicRead(restaurantObjectId);

  const query = {
    restaurantId: restaurantObjectId,
    isActive: true,
  };

  const categories = await Category.find(query)
    .sort({ sortOrder: 1, _id: 1 })
    .lean();

  return categories.map((item) => ({
    id: item._id.toString(),
    name: item.name,
    restaurantId: item.restaurantId.toString(),
    sortOrder: item.sortOrder,
    isActive: item.isActive,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));
}

async function listCategoriesForOwner(restaurantId, actor, options = {}) {
  const restaurantObjectId = ensureObjectId(restaurantId, "restaurantId");

  await ensureOwnerCanModifyRestaurant(restaurantObjectId, actor);

  const query = {
    restaurantId: restaurantObjectId,
  };

  if (typeof options.isActive === "boolean") {
    query.isActive = options.isActive;
  }

  const categories = await Category.find(query)
    .sort({ sortOrder: 1, _id: 1 })
    .lean();

  return categories.map((item) => ({
    id: item._id.toString(),
    name: item.name,
    restaurantId: item.restaurantId.toString(),
    sortOrder: item.sortOrder,
    isActive: item.isActive,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));
}

async function updateCategory(categoryId, payload, actor) {
  const categoryObjectId = ensureObjectId(categoryId, "categoryId");

  const category = await getOwnedCategoryOrThrow(categoryObjectId, actor);

  if (typeof payload.name !== "undefined") {
    category.name = payload.name;
  }

  if (typeof payload.sortOrder !== "undefined") {
    category.sortOrder = payload.sortOrder;
  }

  if (typeof payload.isActive !== "undefined") {
    category.isActive = payload.isActive;
  }

  await category.save();

  return sanitizeCategory(category);
}

async function deleteCategory(categoryId, actor) {
  const categoryObjectId = ensureObjectId(categoryId, "categoryId");

  const category = await getOwnedCategoryOrThrow(categoryObjectId, actor);

  await Category.deleteOne({ _id: category._id });

  return {
    id: category._id.toString(),
    deleted: true,
  };
}

module.exports = {
  createCategory,
  listCategoriesForRestaurant,
  listCategoriesForOwner,
  updateCategory,
  deleteCategory,
};
