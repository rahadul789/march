import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useRestaurantCategoriesQuery,
  useRestaurantDetailQuery,
  useRestaurantMenuQuery
} from '../../../src/modules/restaurant/query/restaurant.query';
import { getErrorMessage } from '../../../src/core/errors/errorUtils';

const MENU_LIST_PARAMS = Object.freeze({
  page: 1,
  limit: 50
});

function formatPrice(value) {
  return `${Number(value || 0).toFixed(2)} BDT`;
}

function CategoryChip({ isSelected, label, onPress }) {
  return (
    <Pressable
      style={[styles.categoryChip, isSelected ? styles.categoryChipActive : null]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.categoryChipText,
          isSelected ? styles.categoryChipTextActive : null
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function MenuRow({ item }) {
  const hasDiscount = Number(item.discount || 0) > 0;

  return (
    <View style={styles.menuCard}>
      <View style={styles.menuCardHeader}>
        <Text style={styles.menuName}>{item.name}</Text>
        <Text style={styles.menuPrice}>{formatPrice(item.discountedPrice)}</Text>
      </View>
      <Text style={styles.menuDescription} numberOfLines={2}>
        {item.description}
      </Text>
      <View style={styles.menuMetaRow}>
        <Text style={styles.menuMeta}>{item.preparationTime} min</Text>
        {hasDiscount ? (
          <Text style={styles.menuDiscount}>-{Number(item.discount).toFixed(0)}%</Text>
        ) : null}
      </View>
      <Pressable style={styles.addButton} disabled>
        <Text style={styles.addButtonText}>Add (Cart next milestone)</Text>
      </Pressable>
    </View>
  );
}

export default function RestaurantDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const restaurantId = String(params.restaurantId || '').trim();
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);

  const restaurantQuery = useRestaurantDetailQuery(restaurantId);
  const categoriesQuery = useRestaurantCategoriesQuery(restaurantId);

  const menuParams = useMemo(
    () => ({
      ...MENU_LIST_PARAMS,
      categoryId: selectedCategoryId || undefined
    }),
    [selectedCategoryId]
  );

  const menuQuery = useRestaurantMenuQuery(restaurantId, menuParams);

  const categoryItems = categoriesQuery.data || [];
  const menuItems = menuQuery.data?.items || [];

  if (restaurantQuery.isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0f172a" />
      </View>
    );
  }

  if (restaurantQuery.error || !restaurantQuery.data) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorTitle}>Could not load restaurant</Text>
        <Text style={styles.errorMessage}>
          {getErrorMessage(restaurantQuery.error)}
        </Text>
        <Pressable style={styles.retryButton} onPress={() => restaurantQuery.refetch()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const restaurant = restaurantQuery.data;

  return (
    <View style={styles.container}>
      <FlatList
        data={menuItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MenuRow item={item} />}
        ListHeaderComponent={
          <View>
            <Pressable style={styles.inlineBack} onPress={() => router.back()}>
              <Text style={styles.inlineBackText}>Back</Text>
            </Pressable>

            <Text style={styles.title}>{restaurant.name}</Text>
            <Text style={styles.subtitle}>{restaurant.description}</Text>
            <Text style={styles.address}>
              {restaurant.address?.fullAddress || 'Address unavailable'}
            </Text>

            <Text style={styles.sectionTitle}>Categories</Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryRow}
            >
              <CategoryChip
                label="All"
                isSelected={!selectedCategoryId}
                onPress={() => setSelectedCategoryId(null)}
              />

              {categoryItems.map((category) => (
                <CategoryChip
                  key={category.id}
                  label={category.name}
                  isSelected={selectedCategoryId === category.id}
                  onPress={() => setSelectedCategoryId(category.id)}
                />
              ))}
            </ScrollView>

            {categoriesQuery.isLoading ? (
              <View style={styles.smallLoader}>
                <ActivityIndicator color="#0f172a" />
              </View>
            ) : null}

            {categoriesQuery.error ? (
              <Text style={styles.inlineError}>
                {getErrorMessage(categoriesQuery.error)}
              </Text>
            ) : null}

            <Text style={styles.sectionTitle}>Menu</Text>

            {menuQuery.isLoading ? (
              <View style={styles.smallLoader}>
                <ActivityIndicator color="#0f172a" />
              </View>
            ) : null}

            {menuQuery.error ? (
              <View style={styles.menuErrorContainer}>
                <Text style={styles.inlineError}>{getErrorMessage(menuQuery.error)}</Text>
                <Pressable style={styles.retrySmallButton} onPress={() => menuQuery.refetch()}>
                  <Text style={styles.retrySmallButtonText}>Retry</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !menuQuery.isLoading && !menuQuery.error ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No menu items for this category</Text>
            </View>
          ) : null
        }
        refreshing={menuQuery.isRefetching}
        onRefresh={() => menuQuery.refetch()}
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
    paddingTop: 56,
    paddingHorizontal: 16
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    backgroundColor: '#f8fafc'
  },
  inlineBack: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12
  },
  inlineBackText: {
    color: '#0f172a',
    fontWeight: '600'
  },
  title: {
    marginTop: 14,
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a'
  },
  subtitle: {
    marginTop: 8,
    color: '#334155',
    lineHeight: 20
  },
  address: {
    marginTop: 8,
    color: '#64748b'
  },
  sectionTitle: {
    marginTop: 16,
    marginBottom: 10,
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a'
  },
  categoryRow: {
    paddingBottom: 2
  },
  categoryChip: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: '#fff'
  },
  categoryChipActive: {
    borderColor: '#0f172a',
    backgroundColor: '#0f172a'
  },
  categoryChipText: {
    color: '#1e293b',
    fontSize: 13,
    fontWeight: '600'
  },
  categoryChipTextActive: {
    color: '#fff'
  },
  menuCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10
  },
  menuCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  menuName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginRight: 10
  },
  menuPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a'
  },
  menuDescription: {
    marginTop: 6,
    color: '#334155'
  },
  menuMetaRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  menuMeta: {
    color: '#64748b'
  },
  menuDiscount: {
    color: '#b91c1c',
    fontWeight: '700'
  },
  addButton: {
    marginTop: 10,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
    paddingVertical: 9,
    alignItems: 'center'
  },
  addButtonText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 12
  },
  smallLoader: {
    paddingVertical: 8
  },
  inlineError: {
    color: '#dc2626'
  },
  menuErrorContainer: {
    marginBottom: 8
  },
  retrySmallButton: {
    marginTop: 6,
    alignSelf: 'flex-start',
    borderRadius: 8,
    backgroundColor: '#0f172a',
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  retrySmallButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12
  },
  listContent: {
    paddingBottom: 24
  },
  emptyState: {
    marginTop: 28,
    alignItems: 'center'
  },
  emptyStateText: {
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
    paddingHorizontal: 20
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600'
  },
  backButton: {
    marginTop: 10
  },
  backButtonText: {
    color: '#0f172a',
    fontWeight: '600'
  }
});
