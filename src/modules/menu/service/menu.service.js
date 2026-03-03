const mongoose = require('mongoose');
const AppError = require('../../../core/errors/AppError');
const { USER_ROLES } = require('../../auth/types');
const { Restaurant } = require('../../restaurant/model');
const { RESTAURANT_APPROVAL_STATUSES } = require('../../restaurant/types');
const { Category } = require('../../category/model');
const { Menu } = require('../model');
const { ACTIVE_ORDER_STATUSES } = require('../types');

function ensureObjectId(value, fieldName) {
  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }

  if (!mongoose.isValidObjectId(value)) {
    throw new AppError(`${fieldName} must be a valid ObjectId`, 400, 'VALIDATION_ERROR', {
      field: fieldName
    });
  }

  return new mongoose.Types.ObjectId(value);
}

function sanitizeMenu(document) {
  const price = Number(document.price);
  const discount = Number(document.discount);
  const discountedPrice = Number((price - (price * discount) / 100).toFixed(2));

  return {
    id: document._id.toString(),
    name: document.name,
    description: document.description,
    restaurantId: document.restaurantId.toString(),
    categoryId: document.categoryId.toString(),
    price,
    discount,
    discountedPrice,
    isAvailable: document.isAvailable,
    preparationTime: document.preparationTime,
    image: document.image,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt
  };
}

async function ensureRestaurantVisible(restaurantId) {
  const restaurant = await Restaurant.findOne({
    _id: restaurantId,
    isDeleted: false,
    isActive: true,
    approvalStatus: RESTAURANT_APPROVAL_STATUSES.APPROVED
  }).select('_id');

  if (!restaurant) {
    throw new AppError('Restaurant not found', 404, 'RESTAURANT_NOT_FOUND');
  }
}

async function ensureOwnerCanModifyRestaurant(restaurantId, actor) {
  if (!actor || actor.role !== USER_ROLES.RESTAURANT_OWNER) {
    throw new AppError('Only restaurant owner can modify menu', 403, 'FORBIDDEN_ROLE');
  }

  const restaurant = await Restaurant.findOne({
    _id: restaurantId,
    ownerId: ensureObjectId(actor.userId, 'ownerId'),
    isDeleted: false
  }).select('_id');

  if (!restaurant) {
    throw new AppError('Restaurant not found or not owned by actor', 403, 'FORBIDDEN_OWNER_SCOPE');
  }
}

async function ensureCategoryBelongsToRestaurant(categoryId, restaurantId) {
  const category = await Category.findOne({
    _id: categoryId,
    restaurantId,
    isActive: true
  }).select('_id');

  if (!category) {
    throw new AppError('Category not found for this restaurant', 400, 'INVALID_CATEGORY_REFERENCE');
  }
}

async function getOwnedMenuOrThrow(menuId, actor) {
  if (!actor || actor.role !== USER_ROLES.RESTAURANT_OWNER) {
    throw new AppError('Only restaurant owner can modify menu', 403, 'FORBIDDEN_ROLE');
  }

  const menu = await Menu.findById(menuId);

  if (!menu) {
    throw new AppError('Menu item not found', 404, 'MENU_NOT_FOUND');
  }

  await ensureOwnerCanModifyRestaurant(menu.restaurantId, actor);

  return menu;
}

async function hasActiveOrdersForMenu(menuId) {
  const menuObjectId = ensureObjectId(menuId, 'menuId');
  const ordersCollection = mongoose.connection.db.collection('orders');

  const query = {
    status: { $in: ACTIVE_ORDER_STATUSES },
    $or: [
      { 'items.menuId': menuObjectId },
      { 'items.menuId': menuObjectId.toString() },
      { 'items.menuItemId': menuObjectId },
      { 'items.menuItemId': menuObjectId.toString() }
    ]
  };

  const total = await ordersCollection.countDocuments(query, { limit: 1 });
  return total > 0;
}

async function createMenu(payload, actor) {
  const restaurantId = ensureObjectId(payload.restaurantId, 'restaurantId');
  const categoryId = ensureObjectId(payload.categoryId, 'categoryId');

  await ensureOwnerCanModifyRestaurant(restaurantId, actor);
  await ensureCategoryBelongsToRestaurant(categoryId, restaurantId);

  const menu = await Menu.create({
    name: payload.name,
    description: payload.description,
    restaurantId,
    categoryId,
    price: payload.price,
    discount: payload.discount,
    isAvailable: payload.isAvailable,
    preparationTime: payload.preparationTime,
    image: payload.image
  });

  return sanitizeMenu(menu);
}

async function listMenuByRestaurant(restaurantId, filters) {
  const restaurantObjectId = ensureObjectId(restaurantId, 'restaurantId');
  await ensureRestaurantVisible(restaurantObjectId);

  const query = {
    restaurantId: restaurantObjectId,
    isAvailable: true
  };

  if (filters.categoryId) {
    query.categoryId = ensureObjectId(filters.categoryId, 'categoryId');
  }

  if (filters.q) {
    query.$text = { $search: filters.q };
  }

  const page = filters.page;
  const limit = filters.limit;
  const skip = (page - 1) * limit;

  let findQuery = Menu.find(query)
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 })
    .lean();

  if (filters.q) {
    findQuery = findQuery.sort({ score: { $meta: 'textScore' }, createdAt: -1 });
  }

  const [items, total] = await Promise.all([
    findQuery,
    Menu.countDocuments(query)
  ]);

  return {
    items: items.map((item) => {
      const price = Number(item.price);
      const discount = Number(item.discount);
      const discountedPrice = Number((price - (price * discount) / 100).toFixed(2));

      return {
        id: item._id.toString(),
        name: item.name,
        description: item.description,
        restaurantId: item.restaurantId.toString(),
        categoryId: item.categoryId.toString(),
        price,
        discount,
        discountedPrice,
        isAvailable: item.isAvailable,
        preparationTime: item.preparationTime,
        image: item.image,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      };
    }),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1
    }
  };
}

async function listMenuForOwner(restaurantId, actor, filters) {
  const restaurantObjectId = ensureObjectId(restaurantId, 'restaurantId');

  await ensureOwnerCanModifyRestaurant(restaurantObjectId, actor);

  const query = {
    restaurantId: restaurantObjectId
  };

  if (typeof filters.isAvailable === 'boolean') {
    query.isAvailable = filters.isAvailable;
  }

  if (filters.categoryId) {
    query.categoryId = ensureObjectId(filters.categoryId, 'categoryId');
  }

  if (filters.q) {
    query.$text = { $search: filters.q };
  }

  const page = filters.page;
  const limit = filters.limit;
  const skip = (page - 1) * limit;

  let findQuery = Menu.find(query)
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  if (filters.q) {
    findQuery = findQuery.sort({ score: { $meta: 'textScore' }, createdAt: -1 });
  }

  const [items, total] = await Promise.all([
    findQuery,
    Menu.countDocuments(query)
  ]);

  return {
    items: items.map(sanitizeMenu),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1
    }
  };
}

async function getMenuById(menuId) {
  const menuObjectId = ensureObjectId(menuId, 'menuId');

  const menu = await Menu.findById(menuObjectId);

  if (!menu || !menu.isAvailable) {
    throw new AppError('Menu item not found', 404, 'MENU_NOT_FOUND');
  }

  await ensureRestaurantVisible(menu.restaurantId);

  return sanitizeMenu(menu);
}

async function updateMenu(menuId, payload, actor) {
  const menuObjectId = ensureObjectId(menuId, 'menuId');

  const menu = await getOwnedMenuOrThrow(menuObjectId, actor);

  if (typeof payload.categoryId !== 'undefined') {
    const categoryId = ensureObjectId(payload.categoryId, 'categoryId');
    await ensureCategoryBelongsToRestaurant(categoryId, menu.restaurantId);
    menu.categoryId = categoryId;
  }

  if (typeof payload.name !== 'undefined') {
    menu.name = payload.name;
  }

  if (typeof payload.description !== 'undefined') {
    menu.description = payload.description;
  }

  if (typeof payload.price !== 'undefined') {
    menu.price = payload.price;
  }

  if (typeof payload.discount !== 'undefined') {
    menu.discount = payload.discount;
  }

  if (typeof payload.isAvailable !== 'undefined') {
    menu.isAvailable = payload.isAvailable;
  }

  if (typeof payload.preparationTime !== 'undefined') {
    menu.preparationTime = payload.preparationTime;
  }

  if (typeof payload.image !== 'undefined') {
    menu.image = payload.image;
  }

  await menu.save();

  return sanitizeMenu(menu);
}

async function deleteMenu(menuId, actor) {
  const menuObjectId = ensureObjectId(menuId, 'menuId');

  const menu = await getOwnedMenuOrThrow(menuObjectId, actor);

  const hasActiveOrders = await hasActiveOrdersForMenu(menu._id);

  if (hasActiveOrders) {
    throw new AppError(
      'Cannot delete menu item while active orders reference it',
      409,
      'MENU_HAS_ACTIVE_ORDERS'
    );
  }

  await Menu.deleteOne({ _id: menu._id });

  return {
    id: menu._id.toString(),
    deleted: true
  };
}

module.exports = {
  createMenu,
  listMenuByRestaurant,
  listMenuForOwner,
  getMenuById,
  updateMenu,
  deleteMenu,
  hasActiveOrdersForMenu
};
