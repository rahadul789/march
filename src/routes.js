const express = require('express');
const healthRoute = require('./core/health/health.route');
const authRoute = require('./modules/auth/route');
const deviceRoute = require('./modules/device/route');

const router = express.Router();

router.use('/health', healthRoute);
router.use('/auth', authRoute);
router.use('/device', deviceRoute);

module.exports = router;
