import { privateApiClient } from '../../../core/api/httpClient';
import { unwrapApiData } from '../../../core/api/apiResponse';
import { normalizeApiError } from '../../../core/errors/errorUtils';

function extractCart(payload) {
  return payload?.cart || null;
}

export async function getCartByRestaurant(restaurantId) {
  try {
    const response = await privateApiClient.get(
      `/cart/restaurant/${restaurantId}`
    );
    return extractCart(unwrapApiData(response));
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function addCartItem(restaurantId, payload) {
  try {
    const response = await privateApiClient.post(
      `/cart/restaurant/${restaurantId}/items`,
      {
        menuId: payload.menuId,
        quantity: payload.quantity
      }
    );
    return extractCart(unwrapApiData(response));
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function updateCartItem(restaurantId, payload) {
  try {
    const response = await privateApiClient.patch(
      `/cart/restaurant/${restaurantId}/items/${payload.menuId}`,
      {
        quantity: payload.quantity
      }
    );
    return extractCart(unwrapApiData(response));
  } catch (error) {
    throw normalizeApiError(error);
  }
}

export async function removeCartItem(restaurantId, payload) {
  try {
    const response = await privateApiClient.delete(
      `/cart/restaurant/${restaurantId}/items/${payload.menuId}`
    );
    return extractCart(unwrapApiData(response));
  } catch (error) {
    throw normalizeApiError(error);
  }
}
