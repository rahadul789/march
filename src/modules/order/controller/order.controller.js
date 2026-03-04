const orderService = require('../service/order.service');
const orderValidation = require('../validation/order.validation');

async function createOrder(req, res) {
  const restaurantId = orderValidation.validateRestaurantIdParam(req.params);
  const payload = orderValidation.validateCreateOrderPayload(req.body);

  const order = await orderService.createOrderFromCart(req.auth, restaurantId, payload);

  return res.success({
    statusCode: 201,
    message: 'Order placed successfully',
    data: { order }
  });
}

module.exports = {
  createOrder
};
