function success(res, { statusCode = 200, message = 'OK', data = null, meta } = {}) {
  const payload = {
    success: true,
    message,
    data,
    requestId: res.locals.requestId,
    timestamp: new Date().toISOString()
  };

  if (meta) {
    payload.meta = meta;
  }

  return res.status(statusCode).json(payload);
}

function attachResponseHelpers(req, res, next) {
  res.success = (options) => success(res, options);
  next();
}

module.exports = {
  success,
  attachResponseHelpers
};
