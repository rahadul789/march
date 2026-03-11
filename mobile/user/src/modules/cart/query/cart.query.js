import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addCartItem,
  getCartByRestaurant,
  removeCartItem,
  updateCartItem
} from '../api/cart.api';
import { QUERY_KEYS } from '../../../shared/constants/queryKeys';

export function useRestaurantCartQuery(restaurantId) {
  return useQuery({
    queryKey: QUERY_KEYS.cart.byRestaurant(restaurantId),
    queryFn: () => getCartByRestaurant(restaurantId),
    enabled: Boolean(restaurantId),
    staleTime: 0,
    gcTime: 15 * 60 * 1000
  });
}

export function useRestaurantCartMutations(restaurantId) {
  const queryClient = useQueryClient();
  const cartQueryKey = QUERY_KEYS.cart.byRestaurant(restaurantId);

  const syncCartSnapshot = (cart) => {
    if (!cart) {
      return;
    }

    queryClient.setQueryData(cartQueryKey, cart);
  };

  const addItemMutation = useMutation({
    mutationFn: (payload) => addCartItem(restaurantId, payload),
    onSuccess: syncCartSnapshot
  });

  const updateItemMutation = useMutation({
    mutationFn: (payload) => updateCartItem(restaurantId, payload),
    onSuccess: syncCartSnapshot
  });

  const removeItemMutation = useMutation({
    mutationFn: (payload) => removeCartItem(restaurantId, payload),
    onSuccess: syncCartSnapshot
  });

  return {
    addItemMutation,
    updateItemMutation,
    removeItemMutation
  };
}
