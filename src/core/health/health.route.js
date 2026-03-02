const express = require('express');
const asyncHandler = require('../errors/asyncHandler');
const healthController = require('./health.controller');

const router = express.Router();

router.get('/', asyncHandler(healthController.getHealth));

module.exports = router;
