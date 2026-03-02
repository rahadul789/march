const mongoose = require('mongoose');
const AppError = require('./AppError');
const logger = require('../logger/logger');

function mapMongooseError(error) {
  if (error instanceof AppError) {
    return error;
  }

  if (error.name === 'TokenExpiredError') {
    return new AppError('Token expired', 401, 'TOKEN_EXPIRED');
  }

  if (error.name === 'JsonWebTokenError') {
    return new AppError('Invalid token', 401, 'INVALID_TOKEN');
  }

  if (typeof error.statusCode === 'number') {
    return new AppError(
      error.message || 'Request failed',
      error.statusCode,
      error.code || 'REQUEST_ERROR',
      error.details || null
    );
  }

  if (error.name === 'ValidationError') {
    return new AppError('Validation failed', 400, 'VALIDATION_ERROR', error.errors);
  }

  if (error.name === 'CastError') {
    return new AppError(`Invalid value for ${error.path}`, 400, 'CAST_ERROR', {
      path: error.path,
      value: error.value
    });
  }

  if (error instanceof mongoose.Error.DocumentNotFoundError) {
    return new AppError('Resource not found', 404, 'RESOURCE_NOT_FOUND');
  }

  if (error.code === 11000) {
    return new AppError('Duplicate resource', 409, 'DUPLICATE_RESOURCE', error.keyValue);
  }

  return new AppError('Internal server error', 500, 'INTERNAL_SERVER_ERROR');
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const normalizedError = mapMongooseError(error);
  const requestId = res.locals.requestId;

  const logMeta = {
    requestId,
    method: req.method,
    path: req.originalUrl,
    statusCode: normalizedError.statusCode,
    errorMessage: error.message,
    stack: error.stack
  };

  if (normalizedError.statusCode >= 500) {
    logger.error('Request processing failed', logMeta);
  } else {
    logger.warn('Request validation/processing issue', logMeta);
  }

  res.status(normalizedError.statusCode).json({
    success: false,
    error: {
      code: normalizedError.code,
      message: normalizedError.message,
      details: normalizedError.details
    },
    requestId,
    timestamp: new Date().toISOString()
  });
}

module.exports = errorHandler;
