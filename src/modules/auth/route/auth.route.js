const express = require('express');
const asyncHandler = require('../../../core/errors/asyncHandler');
const authController = require('../controller/auth.controller');
const loginRateLimiter = require('./loginRateLimiter');
const { requireAuth, requireRoles } = require('../service/auth.guard');
const { USER_ROLES } = require('../types');

const router = express.Router();

router.post('/register', asyncHandler(authController.register));
router.post('/login', loginRateLimiter, asyncHandler(authController.login));
router.post('/refresh', asyncHandler(authController.refresh));
router.post('/logout', asyncHandler(authController.logout));
router.get('/me', requireAuth, asyncHandler(authController.me));

// RBAC middleware validation route for operational checks.
router.get(
  '/admin/ping',
  requireAuth,
  requireRoles(USER_ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    return res.success({
      message: 'Admin authorization check passed',
      data: {
        role: req.auth.role
      }
    });
  })
);

module.exports = router;
