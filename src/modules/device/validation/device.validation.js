const AppError = require('../../../core/errors/AppError');

function validateListQuery(query) {
  if (!query || typeof query !== 'object') {
    throw new AppError('Invalid query', 400, 'VALIDATION_ERROR');
  }

  return {};
}

module.exports = {
  validateListQuery
};
