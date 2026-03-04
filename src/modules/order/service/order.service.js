const mongoose = require('mongoose');
const AppError = require('../../../core/errors/AppError');
const { Menu } = require('../../menu/model');
const { Restaurant } = require('../../restaurant/model');
const { RESTAURANT_APPROVAL_STATUSES } = require('../../restaurant/types');
const { USER_ROLES } = require('../../auth/types');
const { Cart } = require('../../cart/model');
const {
  ORDER_STATUSES,
  COMMISSION_SETTLEMENT_STATUSES,
  ORDER_DEFAULTS
} = require('../types');
const { Order, OrderSequence } = require('../model');

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

function sanitizeOrder(document) {
  return {
    id: document._id.toString(),
    orderNumber: document.orderNumber,
    userId: document.userId.toString(),
    restaurantId: document.restaurantId.toString(),
    status: document.status,
    placedAt: document.placedAt,
    notes: document.notes,
    pricing: {
      currency: document.pricing.currency,
      subtotal: roundMoney(document.pricing.subtotal),
      discountTotal: roundMoney(document.pricing.discountTotal),
      deliveryFee: roundMoney(document.pricing.deliveryFee),
      vat: roundMoney(document.pricing.vat),
      payableTotal: roundMoney(document.pricing.payableTotal),
      grandTotal: roundMoney(document.pricing.grandTotal),
      totalItems: document.pricing.totalItems
    },
    commission: {
      ratePercent: roundMoney(document.commission.ratePercent),
      amount: roundMoney(document.commission.amount),
      settlementStatus: document.commission.settlementStatus,
      placeholder: document.commission.placeholder
    },
    cartSnapshotMeta: {
      cartId: document.cartSnapshotMeta.cartId.toString(),
      lockedAt: document.cartSnapshotMeta.lockedAt,
      lockExpiresAt: document.cartSnapshotMeta.lockExpiresAt,
      recalculatedAt: document.cartSnapshotMeta.recalculatedAt
    },
    items: document.items.map((item) => ({
      menuId: item.menuId.toString(),
      categoryId: item.categoryId.toString(),
      name: item.name,
      description: item.description,
      image: item.image,
      preparationTime: item.preparationTime,
      quantity: item.quantity,
      unitPrice: roundMoney(item.unitPrice),
      unitDiscount: roundMoney(item.unitDiscount),
      lineSubtotal: roundMoney(item.lineSubtotal),
      lineDiscount: roundMoney(item.lineDiscount),
      lineTotal: roundMoney(item.lineTotal)
    })),
    statusHistory: document.statusHistory,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt
  };
}

function createDateKey(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function formatOrderNumber(dateKey, sequenceNumber) {
  return `ORD-${dateKey}-${String(sequenceNumber).padStart(6, '0')}`;
}

async function generateOrderNumber(session, now = new Date()) {
  const dateKey = createDateKey(now);

  const sequenceDocument = await OrderSequence.findOneAndUpdate(
    { dateKey },
    {
      $inc: { sequence: 1 },
      $setOnInsert: { dateKey }
    },
    {
      new: true,
      upsert: true,
      session
    }
  );

  return formatOrderNumber(dateKey, sequenceDocument.sequence);
}

function buildMenuMap(menus) {
  const menuMap = new Map();

  for (const menu of menus) {
    menuMap.set(String(menu._id), menu);
  }

  return menuMap;
}

function buildOrderSnapshotFromMenus(cartItems, menuMap) {
  const snapshots = [];

  for (const cartItem of cartItems) {
    const key = String(cartItem.menuId);
    const menu = menuMap.get(key);

    if (!menu) {
      throw new AppError('One or more cart items are no longer available', 409, 'CART_MENU_UNAVAILABLE', {
        menuId: key
      });
    }

    const quantity = Number(cartItem.quantity);
    const unitPrice = roundMoney(menu.price);
    const unitDiscount = roundMoney(menu.discount || 0);

    const lineSubtotal = roundMoney(unitPrice * quantity);
    const lineDiscount = roundMoney((lineSubtotal * unitDiscount) / 100);
    const lineTotal = roundMoney(lineSubtotal - lineDiscount);

    snapshots.push({
      menuId: menu._id,
      categoryId: menu.categoryId,
      name: menu.name,
      description: menu.description,
      image: menu.image || null,
      preparationTime: menu.preparationTime,
      quantity,
      unitPrice,
      unitDiscount,
      lineSubtotal,
      lineDiscount,
      lineTotal
    });
  }

  return snapshots;
}

function calculatePricingBreakdown(itemSnapshots) {
  let subtotal = 0;
  let discountTotal = 0;
  let payableTotal = 0;
  let totalItems = 0;

  for (const item of itemSnapshots) {
    subtotal += Number(item.lineSubtotal);
    discountTotal += Number(item.lineDiscount);
    payableTotal += Number(item.lineTotal);
    totalItems += Number(item.quantity);
  }

  const deliveryFee = 0;
  const vat = 0;
  const grandTotal = roundMoney(payableTotal + deliveryFee + vat);

  return {
    currency: ORDER_DEFAULTS.CURRENCY,
    subtotal: roundMoney(subtotal),
    discountTotal: roundMoney(discountTotal),
    deliveryFee: roundMoney(deliveryFee),
    vat: roundMoney(vat),
    payableTotal: roundMoney(payableTotal),
    grandTotal,
    totalItems
  };
}

async function ensureRestaurantCanOrder(restaurantId, session) {
  const restaurant = await Restaurant.findOne({
    _id: restaurantId,
    isDeleted: false,
    isActive: true,
    approvalStatus: RESTAURANT_APPROVAL_STATUSES.APPROVED
  }).session(session);

  if (!restaurant) {
    throw new AppError('Restaurant is not available for ordering', 404, 'RESTAURANT_NOT_AVAILABLE');
  }

  return restaurant;
}

async function acquireCartLockForOrder(userId, restaurantId, lockTtlSeconds) {
  const now = new Date();
  const lockExpiresAt = new Date(now.getTime() + lockTtlSeconds * 1000);

  const lockedCart = await Cart.findOneAndUpdate(
    {
      userId: ensureObjectId(userId, 'userId'),
      restaurantId: ensureObjectId(restaurantId, 'restaurantId'),
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
        lockExpiresAt
      }
    },
    {
      new: true
    }
  );

  if (lockedCart) {
    return lockedCart;
  }

  const existingCart = await Cart.findOne({
    userId: ensureObjectId(userId, 'userId'),
    restaurantId: ensureObjectId(restaurantId, 'restaurantId'),
    active: true
  }).select('_id isLocked lockExpiresAt');

  if (!existingCart) {
    throw new AppError('Active cart not found', 404, 'CART_NOT_FOUND');
  }

  throw new AppError('Cart is locked by another checkout attempt', 409, 'CART_LOCKED', {
    lockExpiresAt: existingCart.lockExpiresAt
  });
}

async function releaseCartLock(cartId) {
  if (!cartId) {
    return;
  }

  await Cart.updateOne(
    {
      _id: cartId,
      active: true
    },
    {
      $set: {
        isLocked: false,
        lockedAt: null,
        lockExpiresAt: null
      }
    }
  );
}

function assertOrderActorRole(actor) {
  if (!actor || actor.role !== USER_ROLES.USER) {
    throw new AppError('Only user role can create orders', 403, 'FORBIDDEN_ROLE');
  }
}

async function createOrderFromCart(actor, restaurantId, payload) {
  assertOrderActorRole(actor);

  const userId = ensureObjectId(actor.userId, 'userId');
  const restaurantObjectId = ensureObjectId(restaurantId, 'restaurantId');

  const lockedCart = await acquireCartLockForOrder(userId, restaurantObjectId, payload.lockTtlSeconds);

  const session = await mongoose.startSession();
  let shouldReleaseLock = true;

  try {
    let createdOrder;

    await session.withTransaction(async () => {
      const now = new Date();

      const cart = await Cart.findOne({
        _id: lockedCart._id,
        userId,
        restaurantId: restaurantObjectId,
        active: true,
        isLocked: true
      }).session(session);

      if (!cart) {
        throw new AppError('Locked cart not found', 404, 'CART_NOT_FOUND');
      }

      if (!cart.items || cart.items.length === 0) {
        throw new AppError('Cart is empty', 400, 'EMPTY_CART');
      }

      if (cart.lockExpiresAt && cart.lockExpiresAt <= now) {
        throw new AppError('Cart lock expired. Please retry checkout.', 409, 'CART_LOCK_EXPIRED');
      }

      const restaurant = await ensureRestaurantCanOrder(restaurantObjectId, session);

      const menuIds = cart.items.map((item) => ensureObjectId(item.menuId, 'menuId'));
      const uniqueMenuIdCount = new Set(menuIds.map((item) => String(item))).size;

      const menus = await Menu.find({
        _id: { $in: menuIds },
        restaurantId: restaurantObjectId,
        isAvailable: true
      })
        .select('name description image preparationTime categoryId price discount')
        .session(session);

      if (menus.length !== uniqueMenuIdCount) {
        throw new AppError(
          'One or more cart items are unavailable. Refresh cart and try again.',
          409,
          'CART_MENU_UNAVAILABLE'
        );
      }

      const menuMap = buildMenuMap(menus);
      const itemSnapshots = buildOrderSnapshotFromMenus(cart.items, menuMap);
      const pricing = calculatePricingBreakdown(itemSnapshots);

      const commissionRate = roundMoney(restaurant.commissionRate || 0);
      const commissionAmount = roundMoney((pricing.payableTotal * commissionRate) / 100);

      const orderNumber = await generateOrderNumber(session, now);

      const [order] = await Order.create(
        [
          {
            orderNumber,
            userId,
            restaurantId: restaurantObjectId,
            status: ORDER_STATUSES.PLACED,
            items: itemSnapshots,
            pricing,
            commission: {
              ratePercent: commissionRate,
              amount: commissionAmount,
              settlementStatus: COMMISSION_SETTLEMENT_STATUSES.PENDING,
              placeholder: true
            },
            cartSnapshotMeta: {
              cartId: cart._id,
              lockedAt: cart.lockedAt,
              lockExpiresAt: cart.lockExpiresAt,
              recalculatedAt: now
            },
            statusHistory: [
              {
                status: ORDER_STATUSES.PLACED,
                note: 'Order created from locked cart snapshot',
                changedAt: now
              }
            ],
            notes: payload.notes || null,
            placedAt: now
          }
        ],
        { session }
      );

      cart.items = [];
      cart.totals = {
        subtotal: 0,
        discountTotal: 0,
        payableTotal: 0,
        totalItems: 0
      };
      cart.isLocked = false;
      cart.lockedAt = null;
      cart.lockExpiresAt = null;
      cart.lastRecalculatedAt = now;

      await cart.save({ session });

      createdOrder = order;
    });

    shouldReleaseLock = false;
    return sanitizeOrder(createdOrder);
  } catch (error) {
    if (error && typeof error.message === 'string' && error.message.includes('Transaction numbers are only allowed')) {
      throw new AppError(
        'MongoDB transactions require a replica set deployment',
        500,
        'TRANSACTION_NOT_SUPPORTED'
      );
    }

    throw error;
  } finally {
    if (shouldReleaseLock) {
      await releaseCartLock(lockedCart && lockedCart._id);
    }

    await session.endSession();
  }
}

module.exports = {
  createOrderFromCart,
  createDateKey,
  formatOrderNumber,
  buildOrderSnapshotFromMenus,
  calculatePricingBreakdown,
  assertOrderActorRole
};
