const express = require('express');
const healthRoute = require('./core/health/health.route');
const authRoute = require('./modules/auth/route');
const deviceRoute = require('./modules/device/route');
const restaurantRoute = require('./modules/restaurant/route');
const categoryRoute = require('./modules/category/route');
const menuRoute = require('./modules/menu/route');
const cartRoute = require('./modules/cart/route');
const orderRoute = require('./modules/order/route');
const deliveryRoute = require('./modules/delivery/route');

const router = express.Router();

router.use('/health', healthRoute);
router.use('/auth', authRoute);
router.use('/device', deviceRoute);
router.use('/restaurant', restaurantRoute);
router.use('/category', categoryRoute);
router.use('/menu', menuRoute);
router.use('/cart', cartRoute);
router.use('/order', orderRoute);
router.use('/delivery', deliveryRoute);

module.exports = router;
