import { privateApiClient } from '../../../core/api/httpClient';
import { unwrapApiData } from '../../../core/api/apiResponse';
import { normalizeApiError } from '../../../core/errors/errorUtils';

export async function listRestaurants(params = {}) {
  try {
    const response = await privateApiClient.get('/restaurants', { params });
    return unwrapApiData(response);
  } catch (error) {
    throw normalizeApiError(error);
  }
}
