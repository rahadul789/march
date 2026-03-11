import { ApiRequestError } from '../errors/errorUtils';

export function unwrapApiData(response) {
  const payload = response && response.data ? response.data : null;

  if (!payload || typeof payload !== 'object') {
    throw new ApiRequestError({
      message: 'Malformed API payload',
      code: 'MALFORMED_API_PAYLOAD',
      statusCode: 500
    });
  }

  if (!payload.success) {
    throw new ApiRequestError({
      message: payload.error?.message || 'Request failed',
      code: payload.error?.code || 'REQUEST_FAILED',
      statusCode: response.status || 500,
      details: payload.error?.details || null,
      requestId: payload.requestId || null
    });
  }

  return payload.data;
}
