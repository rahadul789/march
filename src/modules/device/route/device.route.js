const express = require('express');
const asyncHandler = require('../../../core/errors/asyncHandler');
const deviceController = require('../controller/device.controller');
const { requireAuth } = require('../../auth/service/auth.guard');

const router = express.Router();

router.get('/my', requireAuth, asyncHandler(deviceController.listMyDevices));

module.exports = router;
