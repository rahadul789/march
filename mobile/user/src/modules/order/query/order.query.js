import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createOrderFromCart, getOrderById } from '../api/order.api';
import { QUERY_KEYS } from '../../../shared/constants/queryKeys';
import { TERMINAL_ORDER_STATUSES } from '../types/order.constants';

export function useOrderDetailQuery(orderId) {
  return useQuery({
    queryKey: QUERY_KEYS.order.detail(orderId),
    queryFn: () => getOrderById(orderId),
    enabled: Boolean(orderId),
    staleTime: 10000,
    gcTime: 30 * 60 * 1000,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return TERMINAL_ORDER_STATUSES.has(status) ? false : 15000;
    }
  });
}

export function usePlaceOrderMutation(restaurantId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => createOrderFromCart(restaurantId, payload),
    onSuccess: (order) => {
      if (!order || !order.id) {
        return;
      }

      queryClient.setQueryData(QUERY_KEYS.order.detail(order.id), order);
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.cart.byRestaurant(restaurantId)
      });
    }
  });
}
