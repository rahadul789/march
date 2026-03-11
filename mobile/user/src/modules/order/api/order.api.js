import { privateApiClient } from '../../../core/api/httpClient';
import { unwrapApiData } from '../../../core/api/apiResponse';
import { normalizeApiError } from '../../../core/errors/errorUtils';

export async function createOrderFromCart(restaurantId, payload = {}) {
  try {
    const response = await privateApiClient.post(
      `/order/restaurant/${restaurantId}`,
      {
        notes: payload.notes || null,
        lockTtlSeconds: payload.lockTtlSeconds
      }
    );

    const data = unwrapApiData(response);
    return data?.order || null;
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function getOrderById(orderId) {
  try {
    const response = await privateApiClient.get(`/order/${orderId}`);
    const data = unwrapApiData(response);
    return data?.order || null;
  } catch (error) {
    throw normalizeApiError(error);
  }
}
