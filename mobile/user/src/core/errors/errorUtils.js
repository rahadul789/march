import axios from 'axios';

export class ApiRequestError extends Error {
  constructor({
    message = 'Request failed',
    code = 'REQUEST_ERROR',
    statusCode = 500,
    details = null,
    requestId = null
  } = {}) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.requestId = requestId;
  }
}

export function normalizeApiError(error) {
  if (error instanceof ApiRequestError) {
    return error;
  }

  if (axios.isAxiosError(error)) {
    const payload = error.response && error.response.data ? error.response.data : null;

    if (payload && payload.error) {
      return new ApiRequestError({
        message: payload.error.message || 'Request failed',
        code: payload.error.code || 'REQUEST_ERROR',
        statusCode: error.response ? error.response.status : 500,
        details: payload.error.details || null,
        requestId: payload.requestId || null
      });
    }

    if (!error.response) {
      return new ApiRequestError({
        message: 'Network unavailable. Please check your connection.',
        code: 'NETWORK_ERROR',
        statusCode: 0
      });
    }

    return new ApiRequestError({
      message: 'Unexpected API response',
      code: 'UNEXPECTED_RESPONSE',
      statusCode: error.response.status
    });
  }

  if (error instanceof Error) {
    return new ApiRequestError({
      message: error.message,
      code: 'CLIENT_ERROR',
      statusCode: 500
    });
  }

  return new ApiRequestError({
    message: 'Unknown error',
    code: 'UNKNOWN_ERROR',
    statusCode: 500
  });
}

export function getErrorMessage(error, fallback = 'Something went wrong') {
  const normalized = normalizeApiError(error);
  return normalized.message || fallback;
}
