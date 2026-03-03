const express = require('express');
const healthRoute = require('./core/health/health.route');
const authRoute = require('./modules/auth/route');
const deviceRoute = require('./modules/device/route');
const restaurantRoute = require('./modules/restaurant/route');
const categoryRoute = require('./modules/category/route');

const router = express.Router();

router.use('/health', healthRoute);
router.use('/auth', authRoute);
router.use('/device', deviceRoute);
router.use('/restaurant', restaurantRoute);
router.use('/category', categoryRoute);

module.exports = router;
