const authService = require('../service/auth.service');
const authValidation = require('../validation/auth.validation');

async function register(req, res) {
  const payload = authValidation.validateRegisterPayload(req.body);
  const user = await authService.register(payload);

  return res.success({
    statusCode: 201,
    message: 'Account created successfully',
    data: { user }
  });
}

async function login(req, res) {
  const payload = authValidation.validateLoginPayload(req.body);
  const context = authValidation.extractRequestContext(req);

  const result = await authService.login(payload, context);

  return res.success({
    message: 'Login successful',
    data: result
  });
}

async function refresh(req, res) {
  const payload = authValidation.validateRefreshPayload(req.body);
  const context = authValidation.extractRequestContext(req);

  const result = await authService.refreshTokens(payload.refreshToken, context);

  return res.success({
    message: 'Token rotated successfully',
    data: result
  });
}

async function logout(req, res) {
  const payload = authValidation.validateLogoutPayload(req.body);
  const result = await authService.logout(payload.refreshToken);

  return res.success({
    message: result.invalidated ? 'Session logged out successfully' : 'Session already invalid',
    data: result
  });
}

async function me(req, res) {
  const user = await authService.getCurrentUser(req.auth.userId);

  return res.success({
    message: 'Current user fetched successfully',
    data: { user }
  });
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  me
};
