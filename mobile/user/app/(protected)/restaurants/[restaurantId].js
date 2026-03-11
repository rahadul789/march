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
import {
  useRestaurantCartMutations,
  useRestaurantCartQuery
} from '../../../src/modules/cart/query/cart.query';
import { usePlaceOrderMutation } from '../../../src/modules/order/query/order.query';
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

function MenuRow({
  item,
  cartItem,
  onIncrease,
  onDecrease,
  isUpdating,
  disableActions
}) {
  const hasDiscount = Number(item.discount || 0) > 0;
  const hasInCart = Boolean(cartItem);
  const displayedPrice = hasInCart
    ? formatPrice(cartItem.lineTotal)
    : formatPrice(item.discountedPrice);

  return (
    <View style={styles.menuCard}>
      <View style={styles.menuCardHeader}>
        <Text style={styles.menuName}>{item.name}</Text>
        <Text style={styles.menuPrice}>{displayedPrice}</Text>
      </View>
      <Text style={styles.menuDescription} numberOfLines={2}>
        {item.description}
      </Text>
      <View style={styles.menuMetaRow}>
        <Text style={styles.menuMeta}>{item.preparationTime} min</Text>
        {hasDiscount && !hasInCart ? (
          <Text style={styles.menuDiscount}>-{Number(item.discount).toFixed(0)}%</Text>
        ) : null}
      </View>

      {hasInCart ? (
        <View style={styles.quantityRow}>
          <Pressable
            style={[
              styles.quantityButton,
              disableActions ? styles.quantityButtonDisabled : null
            ]}
            onPress={() => onDecrease(item.id, cartItem.quantity)}
            disabled={disableActions}
          >
            <Text style={styles.quantityButtonText}>-</Text>
          </Pressable>
          <Text style={styles.quantityValue}>{cartItem.quantity}</Text>
          <Pressable
            style={[
              styles.quantityButton,
              disableActions ? styles.quantityButtonDisabled : null
            ]}
            onPress={() => onIncrease(item.id, cartItem.quantity)}
            disabled={disableActions}
          >
            <Text style={styles.quantityButtonText}>+</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={[styles.addButton, disableActions ? styles.addButtonDisabled : null]}
          onPress={() => onIncrease(item.id, 0)}
          disabled={disableActions}
        >
          {isUpdating ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.addButtonText}>Add to cart</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

export default function RestaurantDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const restaurantId = String(params.restaurantId || '').trim();
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [menuActionInFlight, setMenuActionInFlight] = useState(null);

  const restaurantQuery = useRestaurantDetailQuery(restaurantId);
  const categoriesQuery = useRestaurantCategoriesQuery(restaurantId);
  const cartQuery = useRestaurantCartQuery(restaurantId);
  const { addItemMutation, updateItemMutation, removeItemMutation } =
    useRestaurantCartMutations(restaurantId);
  const placeOrderMutation = usePlaceOrderMutation(restaurantId);

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
  const cart = cartQuery.data || null;

  const cartItemsByMenuId = useMemo(() => {
    const map = new Map();
    const items = Array.isArray(cart?.items) ? cart.items : [];

    for (const item of items) {
      map.set(String(item.menuId), item);
    }

    return map;
  }, [cart]);

  const hasPendingCartAction =
    addItemMutation.isPending ||
    updateItemMutation.isPending ||
    removeItemMutation.isPending;

  const hasCartItems = Boolean((cart?.totals?.totalItems || 0) > 0);
  const canPlaceOrder = hasCartItems && !hasPendingCartAction && !placeOrderMutation.isPending;

  const onIncreaseQuantity = async (menuId, currentQuantity) => {
    setMenuActionInFlight(menuId);

    try {
      if (!currentQuantity) {
        await addItemMutation.mutateAsync({
          menuId,
          quantity: 1
        });
      } else {
        await updateItemMutation.mutateAsync({
          menuId,
          quantity: Number(currentQuantity) + 1
        });
      }
    } finally {
      setMenuActionInFlight(null);
    }
  };

  const onDecreaseQuantity = async (menuId, currentQuantity) => {
    if (!currentQuantity || currentQuantity < 1) {
      return;
    }

    setMenuActionInFlight(menuId);

    try {
      if (Number(currentQuantity) === 1) {
        await removeItemMutation.mutateAsync({
          menuId
        });
      } else {
        await updateItemMutation.mutateAsync({
          menuId,
          quantity: Number(currentQuantity) - 1
        });
      }
    } finally {
      setMenuActionInFlight(null);
    }
  };

  const onPlaceOrder = async () => {
    if (!canPlaceOrder) {
      return;
    }

    try {
      const placedOrder = await placeOrderMutation.mutateAsync({
        lockTtlSeconds: 120
      });

      if (placedOrder?.id) {
        router.push(`/(protected)/orders/${placedOrder.id}`);
      }
    } catch (_error) {
      // Error state is surfaced via mutation.error in UI.
    }
  };

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
        renderItem={({ item }) => {
          const cartItem = cartItemsByMenuId.get(String(item.id)) || null;
          const isUpdating = hasPendingCartAction && menuActionInFlight === item.id;

          return (
            <MenuRow
              item={item}
              cartItem={cartItem}
              onIncrease={onIncreaseQuantity}
              onDecrease={onDecreaseQuantity}
              isUpdating={isUpdating}
              disableActions={hasPendingCartAction}
            />
          );
        }}
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

            {cartQuery.isLoading ? (
              <View style={styles.cartSyncRow}>
                <ActivityIndicator color="#0f172a" size="small" />
                <Text style={styles.cartSyncText}>Syncing cart...</Text>
              </View>
            ) : null}

            {cart ? (
              <View style={styles.cartSummaryCard}>
                <View style={styles.cartSummaryRow}>
                  <Text style={styles.cartSummaryLabel}>Items</Text>
                  <Text style={styles.cartSummaryValue}>
                    {cart.totals?.totalItems || 0}
                  </Text>
                </View>
                <View style={styles.cartSummaryRow}>
                  <Text style={styles.cartSummaryLabel}>Subtotal</Text>
                  <Text style={styles.cartSummaryValue}>
                    {formatPrice(cart.totals?.subtotal)}
                  </Text>
                </View>
                <View style={styles.cartSummaryRow}>
                  <Text style={styles.cartSummaryLabel}>Discount</Text>
                  <Text style={styles.cartSummaryValue}>
                    {formatPrice(cart.totals?.discountTotal)}
                  </Text>
                </View>
                <View style={styles.cartSummaryRow}>
                  <Text style={styles.cartSummaryLabelStrong}>Payable</Text>
                  <Text style={styles.cartSummaryValueStrong}>
                    {formatPrice(cart.totals?.payableTotal)}
                  </Text>
                </View>
              </View>
            ) : null}

            {cartQuery.error ? (
              <Text style={styles.inlineError}>{getErrorMessage(cartQuery.error)}</Text>
            ) : null}

            <Pressable
              style={[
                styles.placeOrderButton,
                !canPlaceOrder ? styles.placeOrderButtonDisabled : null
              ]}
              onPress={onPlaceOrder}
              disabled={!canPlaceOrder}
            >
              {placeOrderMutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.placeOrderButtonText}>Place Order</Text>
              )}
            </Pressable>

            {placeOrderMutation.error ? (
              <Text style={styles.inlineError}>
                {getErrorMessage(placeOrderMutation.error)}
              </Text>
            ) : null}

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
    borderRadius: 9,
    backgroundColor: '#0f172a',
    paddingVertical: 10,
    alignItems: 'center'
  },
  addButtonDisabled: {
    opacity: 0.7
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13
  },
  quantityRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  quantityButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center'
  },
  quantityButtonDisabled: {
    opacity: 0.7
  },
  quantityButtonText: {
    color: '#fff',
    fontSize: 20,
    lineHeight: 20,
    fontWeight: '700'
  },
  quantityValue: {
    minWidth: 40,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a'
  },
  smallLoader: {
    paddingVertical: 8
  },
  cartSyncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10
  },
  cartSyncText: {
    marginLeft: 8,
    color: '#334155'
  },
  cartSummaryCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10
  },
  cartSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  cartSummaryLabel: {
    color: '#475569'
  },
  cartSummaryValue: {
    color: '#0f172a',
    fontWeight: '600'
  },
  cartSummaryLabelStrong: {
    color: '#0f172a',
    fontWeight: '700'
  },
  cartSummaryValueStrong: {
    color: '#0f172a',
    fontWeight: '700'
  },
  placeOrderButton: {
    marginBottom: 10,
    borderRadius: 10,
    backgroundColor: '#0f172a',
    paddingVertical: 12,
    alignItems: 'center'
  },
  placeOrderButtonDisabled: {
    opacity: 0.6
  },
  placeOrderButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700'
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
