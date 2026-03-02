const express = require('express');
const healthRoute = require('./core/health/health.route');
const authRoute = require('./modules/auth/route');

const router = express.Router();

router.use('/health', healthRoute);
router.use('/auth', authRoute);

module.exports = router;
