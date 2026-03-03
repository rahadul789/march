const cartService = require('../service/cart.service');
const cartValidation = require('../validation/cart.validation');

async function getCart(req, res) {
  const restaurantId = cartValidation.validateRestaurantIdParam(req.params);

  const cart = await cartService.getCart(req.auth.userId, restaurantId);

  return res.success({
    message: 'Cart fetched successfully',
    data: { cart }
  });
}

async function addItem(req, res) {
  const restaurantId = cartValidation.validateRestaurantIdParam(req.params);
  const payload = cartValidation.validateAddItemPayload(req.body);

  const cart = await cartService.addItem(req.auth.userId, restaurantId, payload);

  return res.success({
    message: 'Cart item added successfully',
    data: { cart }
  });
}

async function updateItem(req, res) {
  const restaurantId = cartValidation.validateRestaurantIdParam(req.params);
  const menuId = cartValidation.validateMenuIdParam(req.params);
  const payload = cartValidation.validateUpdateItemPayload(req.body);

  const cart = await cartService.updateItem(req.auth.userId, restaurantId, menuId, payload);

  return res.success({
    message: 'Cart item updated successfully',
    data: { cart }
  });
}

async function removeItem(req, res) {
  const restaurantId = cartValidation.validateRestaurantIdParam(req.params);
  const menuId = cartValidation.validateMenuIdParam(req.params);

  const cart = await cartService.removeItem(req.auth.userId, restaurantId, menuId);

  return res.success({
    message: 'Cart item removed successfully',
    data: { cart }
  });
}

async function lockCart(req, res) {
  const restaurantId = cartValidation.validateRestaurantIdParam(req.params);
  const payload = cartValidation.validateLockPayload(req.body);

  const cart = await cartService.lockCartForOrder(req.auth.userId, restaurantId, payload.lockTtlSeconds);

  return res.success({
    message: 'Cart locked for checkout',
    data: { cart }
  });
}

async function unlockCart(req, res) {
  const restaurantId = cartValidation.validateRestaurantIdParam(req.params);

  const cart = await cartService.unlockCart(req.auth.userId, restaurantId);

  return res.success({
    message: 'Cart unlocked',
    data: { cart }
  });
}

module.exports = {
  getCart,
  addItem,
  updateItem,
  removeItem,
  lockCart,
  unlockCart
};
