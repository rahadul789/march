const mongoose = require('mongoose');
const AppError = require('../../../core/errors/AppError');
const { Menu } = require('../../menu/model');
const { Restaurant } = require('../../restaurant/model');
const { RESTAURANT_APPROVAL_STATUSES } = require('../../restaurant/types');
const { USER_ROLES } = require('../../auth/types');
const { Cart } = require('../model');

function roundMoney(value) {
  return Number(Number(value).toFixed(2));
}

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

function sanitizeCart(document) {
  return {
    id: document._id.toString(),
    userId: document.userId.toString(),
    restaurantId: document.restaurantId.toString(),
    active: document.active,
    isLocked: document.isLocked,
    lockedAt: document.lockedAt,
    lockExpiresAt: document.lockExpiresAt,
    lastRecalculatedAt: document.lastRecalculatedAt,
    totals: {
      subtotal: roundMoney(document.totals.subtotal || 0),
      discountTotal: roundMoney(document.totals.discountTotal || 0),
      payableTotal: roundMoney(document.totals.payableTotal || 0),
      totalItems: Number(document.totals.totalItems || 0)
    },
    items: (document.items || []).map((item) => ({
      menuId: item.menuId.toString(),
      quantity: item.quantity,
      nameSnapshot: item.nameSnapshot,
      imageSnapshot: item.imageSnapshot,
      preparationTimeSnapshot: item.preparationTimeSnapshot,
      unitPrice: roundMoney(item.unitPrice),
      unitDiscount: roundMoney(item.unitDiscount),
      lineSubtotal: roundMoney(item.lineSubtotal),
      lineDiscount: roundMoney(item.lineDiscount),
      lineTotal: roundMoney(item.lineTotal)
    })),
    createdAt: document.createdAt,
    updatedAt: document.updatedAt
  };
}

async function ensureRestaurantCanOrder(restaurantId) {
  const restaurant = await Restaurant.findOne({
    _id: restaurantId,
    isDeleted: false,
    isActive: true,
    approvalStatus: RESTAURANT_APPROVAL_STATUSES.APPROVED
  }).select('_id');

  if (!restaurant) {
    throw new AppError('Restaurant is not available for ordering', 404, 'RESTAURANT_NOT_AVAILABLE');
  }
}

async function getMenuForCartOrThrow(menuId, restaurantId) {
  const menu = await Menu.findOne({
    _id: menuId,
    restaurantId,
    isAvailable: true
  }).select('name description price discount preparationTime image restaurantId categoryId isAvailable');

  if (!menu) {
    throw new AppError('Menu item is not available', 409, 'MENU_NOT_AVAILABLE', {
      menuId: String(menuId)
    });
  }

  return menu;
}

async function getOrCreateActiveCart(userId, restaurantId) {
  const userObjectId = ensureObjectId(userId, 'userId');
  const restaurantObjectId = ensureObjectId(restaurantId, 'restaurantId');

  try {
    const cart = await Cart.findOneAndUpdate(
      {
        userId: userObjectId,
        restaurantId: restaurantObjectId,
        active: true
      },
      {
        $setOnInsert: {
          userId: userObjectId,
          restaurantId: restaurantObjectId,
          active: true,
          totals: {
            subtotal: 0,
            discountTotal: 0,
            payableTotal: 0,
            totalItems: 0
          }
        }
      },
      {
        upsert: true,
        new: true
      }
    );

    return cart;
  } catch (error) {
    if (error && error.code === 11000) {
      const fallback = await Cart.findOne({
        userId: userObjectId,
        restaurantId: restaurantObjectId,
        active: true
      });

      if (fallback) {
        return fallback;
      }
    }

    throw error;
  }
}

async function getActiveCartOrThrow(userId, restaurantId) {
  const cart = await Cart.findOne({
    userId: ensureObjectId(userId, 'userId'),
    restaurantId: ensureObjectId(restaurantId, 'restaurantId'),
    active: true
  });

  if (!cart) {
    throw new AppError('Active cart not found', 404, 'CART_NOT_FOUND');
  }

  return cart;
}

async function tryReleaseExpiredLock(cart) {
  if (!cart.isLocked) {
    return cart;
  }

  const now = new Date();

  if (cart.lockExpiresAt && cart.lockExpiresAt <= now) {
    cart.isLocked = false;
    cart.lockedAt = null;
    cart.lockExpiresAt = null;
    await cart.save();
  }

  return cart;
}

async function ensureCartUnlocked(cart) {
  await tryReleaseExpiredLock(cart);

  if (cart.isLocked) {
    throw new AppError('Cart is locked for checkout', 409, 'CART_LOCKED', {
      lockExpiresAt: cart.lockExpiresAt
    });
  }
}

function buildMenuMap(menus) {
  const map = new Map();

  for (const menu of menus) {
    map.set(String(menu._id), menu);
  }

  return map;
}

function calculateCartFromMenus(items, menuMap) {
  const calculatedItems = [];

  let subtotal = 0;
  let discountTotal = 0;
  let payableTotal = 0;
  let totalItems = 0;

  for (const item of items) {
    const key = String(item.menuId);
    const menu = menuMap.get(key);

    if (!menu) {
      throw new AppError('One or more menu items are unavailable', 409, 'MENU_UNAVAILABLE', {
        menuId: key
      });
    }

    const quantity = Number(item.quantity);
    const unitPrice = roundMoney(menu.price);
    const unitDiscount = roundMoney(menu.discount || 0);

    const lineSubtotal = roundMoney(unitPrice * quantity);
    const lineDiscount = roundMoney((lineSubtotal * unitDiscount) / 100);
    const lineTotal = roundMoney(lineSubtotal - lineDiscount);

    subtotal += lineSubtotal;
    discountTotal += lineDiscount;
    payableTotal += lineTotal;
    totalItems += quantity;

    calculatedItems.push({
      menuId: menu._id,
      quantity,
      nameSnapshot: menu.name,
      imageSnapshot: menu.image || null,
      preparationTimeSnapshot: menu.preparationTime,
      unitPrice,
      unitDiscount,
      lineSubtotal,
      lineDiscount,
      lineTotal
    });
  }

  return {
    items: calculatedItems,
    totals: {
      subtotal: roundMoney(subtotal),
      discountTotal: roundMoney(discountTotal),
      payableTotal: roundMoney(payableTotal),
      totalItems
    }
  };
}

async function recalculateCart(cart) {
  if (!cart.items || cart.items.length === 0) {
    cart.items = [];
    cart.totals = {
      subtotal: 0,
      discountTotal: 0,
      payableTotal: 0,
      totalItems: 0
    };
    cart.lastRecalculatedAt = new Date();
    await cart.save();
    return cart;
  }

  const menuIds = cart.items.map((item) => ensureObjectId(item.menuId, 'menuId'));

  const menus = await Menu.find({
    _id: { $in: menuIds },
    restaurantId: cart.restaurantId,
    isAvailable: true
  }).select('name price discount preparationTime image isAvailable restaurantId');

  const uniqueMenuIdCount = new Set(menuIds.map((id) => String(id))).size;

  if (menus.length !== uniqueMenuIdCount) {
    throw new AppError(
      'One or more cart menu items are unavailable. Please refresh your cart.',
      409,
      'CART_MENU_UNAVAILABLE'
    );
  }

  const menuMap = buildMenuMap(menus);
  const calculated = calculateCartFromMenus(cart.items, menuMap);

  cart.items = calculated.items;
  cart.totals = calculated.totals;
  cart.lastRecalculatedAt = new Date();

  await cart.save();

  return cart;
}

async function getCart(userId, restaurantId) {
  await ensureRestaurantCanOrder(restaurantId);

  const cart = await getOrCreateActiveCart(userId, restaurantId);
  await ensureCartUnlocked(cart);

  await recalculateCart(cart);

  return sanitizeCart(cart);
}

async function addItem(userId, restaurantId, payload) {
  await ensureRestaurantCanOrder(restaurantId);

  const cart = await getOrCreateActiveCart(userId, restaurantId);
  await ensureCartUnlocked(cart);

  const menu = await getMenuForCartOrThrow(payload.menuId, cart.restaurantId);

  const index = cart.items.findIndex((item) => String(item.menuId) === String(menu._id));

  if (index >= 0) {
    cart.items[index].quantity += payload.quantity;
  } else {
    cart.items.push({
      menuId: menu._id,
      quantity: payload.quantity,
      nameSnapshot: menu.name,
      imageSnapshot: menu.image || null,
      preparationTimeSnapshot: menu.preparationTime,
      unitPrice: roundMoney(menu.price),
      unitDiscount: roundMoney(menu.discount || 0),
      lineSubtotal: 0,
      lineDiscount: 0,
      lineTotal: 0
    });
  }

  await recalculateCart(cart);

  return sanitizeCart(cart);
}

async function updateItem(userId, restaurantId, menuId, payload) {
  await ensureRestaurantCanOrder(restaurantId);

  const cart = await getActiveCartOrThrow(userId, restaurantId);
  await ensureCartUnlocked(cart);

  const index = cart.items.findIndex((item) => String(item.menuId) === String(menuId));

  if (index === -1) {
    throw new AppError('Cart item not found', 404, 'CART_ITEM_NOT_FOUND');
  }

  await getMenuForCartOrThrow(menuId, cart.restaurantId);

  cart.items[index].quantity = payload.quantity;

  await recalculateCart(cart);

  return sanitizeCart(cart);
}

async function removeItem(userId, restaurantId, menuId) {
  await ensureRestaurantCanOrder(restaurantId);

  const cart = await getActiveCartOrThrow(userId, restaurantId);
  await ensureCartUnlocked(cart);

  const previousLength = cart.items.length;

  cart.items = cart.items.filter((item) => String(item.menuId) !== String(menuId));

  if (cart.items.length === previousLength) {
    throw new AppError('Cart item not found', 404, 'CART_ITEM_NOT_FOUND');
  }

  await recalculateCart(cart);

  return sanitizeCart(cart);
}

async function lockCartForOrder(userId, restaurantId, lockTtlSeconds) {
  await ensureRestaurantCanOrder(restaurantId);

  const cart = await getActiveCartOrThrow(userId, restaurantId);

  if (!cart.items || cart.items.length === 0) {
    throw new AppError('Cannot lock an empty cart', 400, 'EMPTY_CART');
  }

  await recalculateCart(cart);

  const now = new Date();
  const expiresAt = new Date(now.getTime() + (lockTtlSeconds * 1000));

  const lockedCart = await Cart.findOneAndUpdate(
    {
      _id: cart._id,
      active: true,
      $or: [
        { isLocked: false },
        { lockExpiresAt: { $lte: now } },
        { lockExpiresAt: null }
      ]
    },
    {
      $set: {
        isLocked: true,
        lockedAt: now,
        lockExpiresAt: expiresAt
      }
    },
    {
      new: true
    }
  );

  if (!lockedCart) {
    throw new AppError('Cart is already locked by an ongoing checkout', 409, 'CART_LOCKED');
  }

  return sanitizeCart(lockedCart);
}

async function unlockCart(userId, restaurantId) {
  const cart = await getActiveCartOrThrow(userId, restaurantId);

  cart.isLocked = false;
  cart.lockedAt = null;
  cart.lockExpiresAt = null;

  await cart.save();

  return sanitizeCart(cart);
}

function assertCartActorRole(actor) {
  if (!actor || actor.role !== USER_ROLES.USER) {
    throw new AppError('Only user role can operate cart', 403, 'FORBIDDEN_ROLE');
  }
}

module.exports = {
  getCart,
  addItem,
  updateItem,
  removeItem,
  lockCartForOrder,
  unlockCart,
  recalculateCart,
  calculateCartFromMenus,
  assertCartActorRole
};
