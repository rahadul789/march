const orderService = require('../service/order.service');
const orderValidation = require('../validation/order.validation');

async function createOrder(req, res) {
  const restaurantId = orderValidation.validateRestaurantIdParam(req.params);
  const payload = orderValidation.validateCreateOrderPayload(req.body);

  const order = await orderService.createOrderFromCart(req.auth, restaurantId, payload, {
    requestId: res.locals.requestId
  });

  return res.success({
    statusCode: 201,
    message: 'Order placed successfully',
    data: { order }
  });
}

async function transitionOrderStatus(req, res) {
  const orderId = orderValidation.validateOrderIdParam(req.params);
  const payload = orderValidation.validateTransitionPayload(req.body);

  const order = await orderService.transitionOrderStatus(orderId, payload, req.auth, {
    requestId: res.locals.requestId
  });

  return res.success({
    message: 'Order status updated successfully',
    data: { order }
  });
}

module.exports = {
  createOrder,
  transitionOrderStatus
};
