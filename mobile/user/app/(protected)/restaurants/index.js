import { useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  useRestaurantListQuery
} from '../../../src/modules/restaurant/query/restaurant.query';
import { QUERY_KEYS } from '../../../src/shared/constants/queryKeys';
import { getRestaurantById } from '../../../src/modules/restaurant/api/restaurant.api';
import { listRestaurantCategories } from '../../../src/modules/category/api/category.api';
import { listRestaurantMenu } from '../../../src/modules/menu/api/menu.api';
import { getErrorMessage } from '../../../src/core/errors/errorUtils';

const LIST_PARAMS = Object.freeze({
  page: 1,
  limit: 20
});

const MENU_PARAMS = Object.freeze({
  page: 1,
  limit: 20
});

function RestaurantCard({ item, onPress, onPressIn }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        pressed ? styles.cardPressed : null
      ]}
      onPress={onPress}
      onPressIn={onPressIn}
    >
      <Text style={styles.cardTitle}>{item.name}</Text>
      <Text style={styles.cardDescription} numberOfLines={2}>
        {item.description}
      </Text>
      <Text style={styles.cardMeta} numberOfLines={1}>
        {item.address?.fullAddress || 'Address unavailable'}
      </Text>
    </Pressable>
  );
}

export default function RestaurantListScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const restaurantsQuery = useRestaurantListQuery(LIST_PARAMS);
  const restaurants = restaurantsQuery.data?.items || [];

  const prefetchRestaurantBundle = useCallback(
    async (restaurantId) => {
      if (!restaurantId) {
        return;
      }

      await Promise.allSettled([
        queryClient.prefetchQuery({
          queryKey: QUERY_KEYS.restaurant.detail(restaurantId),
          queryFn: () => getRestaurantById(restaurantId)
        }),
        queryClient.prefetchQuery({
          queryKey: QUERY_KEYS.restaurant.categories(restaurantId),
          queryFn: () => listRestaurantCategories(restaurantId)
        }),
        queryClient.prefetchQuery({
          queryKey: QUERY_KEYS.restaurant.menu(restaurantId, MENU_PARAMS),
          queryFn: () => listRestaurantMenu(restaurantId, MENU_PARAMS)
        })
      ]);
    },
    [queryClient]
  );

  const onRefresh = () => {
    restaurantsQuery.refetch();
  };

  const onOpenRestaurant = (restaurantId) => {
    router.push(`/(protected)/restaurants/${restaurantId}`);
  };

  if (restaurantsQuery.isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0f172a" />
      </View>
    );
  }

  if (restaurantsQuery.error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorTitle}>Could not load restaurants</Text>
        <Text style={styles.errorMessage}>
          {getErrorMessage(restaurantsQuery.error)}
        </Text>
        <Pressable style={styles.retryButton} onPress={onRefresh}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Restaurants</Text>
      <Text style={styles.subtitle}>Browse approved restaurants near you</Text>

      <FlatList
        data={restaurants}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <RestaurantCard
            item={item}
            onPress={() => onOpenRestaurant(item.id)}
            onPressIn={() => prefetchRestaurantBundle(item.id)}
          />
        )}
        refreshing={restaurantsQuery.isRefetching}
        onRefresh={onRefresh}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No restaurants found</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingTop: 60,
    paddingHorizontal: 16
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#f8fafc'
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0f172a'
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 14,
    color: '#475569'
  },
  listContent: {
    paddingBottom: 28
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10
  },
  cardPressed: {
    opacity: 0.92
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a'
  },
  cardDescription: {
    marginTop: 6,
    color: '#334155',
    lineHeight: 20
  },
  cardMeta: {
    marginTop: 10,
    color: '#64748b'
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a'
  },
  errorMessage: {
    marginTop: 8,
    textAlign: 'center',
    color: '#475569'
  },
  retryButton: {
    marginTop: 14,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 18
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600'
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 48
  },
  emptyStateText: {
    color: '#64748b'
  }
});
