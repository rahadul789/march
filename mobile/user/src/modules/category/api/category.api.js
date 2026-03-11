import { privateApiClient } from '../../../core/api/httpClient';
import { unwrapApiData } from '../../../core/api/apiResponse';
import { normalizeApiError } from '../../../core/errors/errorUtils';

export async function listRestaurantCategories(restaurantId) {
  try {
    const response = await privateApiClient.get(
      `/category/restaurant/${restaurantId}`
    );
    const categories = unwrapApiData(response);
    return Array.isArray(categories) ? categories : [];
  } catch (error) {
    throw normalizeApiError(error);
  }
}
