import { privateApiClient } from '../../../core/api/httpClient';
import { unwrapApiData } from '../../../core/api/apiResponse';
import { normalizeApiError } from '../../../core/errors/errorUtils';

export async function listRestaurantMenu(restaurantId, params = {}) {
  try {
    const response = await privateApiClient.get(`/menu/restaurant/${restaurantId}`, {
      params
    });

    const items = unwrapApiData(response);
    return {
      items: Array.isArray(items) ? items : [],
      meta: response.data?.meta || null
    };
  } catch (error) {
    throw normalizeApiError(error);
  }
}
