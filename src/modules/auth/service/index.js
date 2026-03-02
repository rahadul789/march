const authService = require('./auth.service');
const authGuard = require('./auth.guard');

module.exports = {
  ...authService,
  ...authGuard
};
