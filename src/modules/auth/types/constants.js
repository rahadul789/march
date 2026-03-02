const USER_ROLES = Object.freeze({
  USER: 'user',
  DELIVERYMAN: 'deliveryman',
  RESTAURANT_OWNER: 'restaurant_owner',
  ADMIN: 'admin'
});

const ACCOUNT_STATUSES = Object.freeze({
  ACTIVE: 'active',
  SUSPENDED: 'suspended'
});

const TOKEN_TYPES = Object.freeze({
  ACCESS: 'access',
  REFRESH: 'refresh'
});

const SESSION_STATUSES = Object.freeze({
  ACTIVE: 'active',
  REVOKED: 'revoked'
});

module.exports = {
  USER_ROLES,
  ACCOUNT_STATUSES,
  TOKEN_TYPES,
  SESSION_STATUSES
};
