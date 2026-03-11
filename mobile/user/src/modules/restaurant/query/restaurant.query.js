import { useQuery } from '@tanstack/react-query';
import { listRestaurantCategories } from '../../category/api/category.api';
import { listRestaurantMenu } from '../../menu/api/menu.api';
import { getRestaurantById, listRestaurants } from '../api/restaurant.api';
import { QUERY_KEYS } from '../../../shared/constants/queryKeys';

export function useRestaurantListQuery(params = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.restaurant.list(params),
    queryFn: () => listRestaurants(params),
    staleTime: 60000,
    gcTime: 10 * 60 * 1000
  });
}

export function useRestaurantDetailQuery(restaurantId) {
  return useQuery({
    queryKey: QUERY_KEYS.restaurant.detail(restaurantId),
    queryFn: () => getRestaurantById(restaurantId),
    enabled: Boolean(restaurantId),
    staleTime: 60000,
    gcTime: 10 * 60 * 1000
  });
}

export function useRestaurantCategoriesQuery(restaurantId) {
  return useQuery({
    queryKey: QUERY_KEYS.restaurant.categories(restaurantId),
    queryFn: () => listRestaurantCategories(restaurantId),
    enabled: Boolean(restaurantId),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000
  });
}

export function useRestaurantMenuQuery(restaurantId, params = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.restaurant.menu(restaurantId, params),
    queryFn: () => listRestaurantMenu(restaurantId, params),
    enabled: Boolean(restaurantId),
    staleTime: 30000,
    gcTime: 10 * 60 * 1000,
    placeholderData: (previousData) => previousData
  });
}
