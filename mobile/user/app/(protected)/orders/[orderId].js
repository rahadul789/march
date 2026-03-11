import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useOrderDetailQuery } from '../../../src/modules/order/query/order.query';
import { QUERY_KEYS } from '../../../src/shared/constants/queryKeys';
import { getErrorMessage } from '../../../src/core/errors/errorUtils';
import {
  getUserSocket,
  subscribeToOrderRoom,
  unsubscribeFromOrderRoom
} from '../../../src/core/realtime/socket.gateway';
import {
  ORDER_STATUSES,
  TERMINAL_ORDER_STATUSES,
  TRACKABLE_ORDER_STATUSES
} from '../../../src/modules/order/types/order.constants';
import useLiveDeliveryTracking from '../../../src/modules/order/hooks/useLiveDeliveryTracking';
import LiveTrackingMapCard from '../../../src/modules/order/ui/LiveTrackingMapCard';

function formatPrice(value) {
  return `${Number(value || 0).toFixed(2)} BDT`;
}

function StatusBadge({ status }) {
  const backgroundColor = (() => {
    if (status === ORDER_STATUSES.DELIVERED) {
      return '#16a34a';
    }

    if (status === ORDER_STATUSES.CANCELLED) {
      return '#dc2626';
    }

    if (status === ORDER_STATUSES.ASSIGNED || status === ORDER_STATUSES.PICKED_UP) {
      return '#2563eb';
    }

    return '#334155';
  })();

  return (
    <View style={[styles.statusBadge, { backgroundColor }]}>
      <Text style={styles.statusBadgeText}>{status}</Text>
    </View>
  );
}

export default function OrderDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const queryClient = useQueryClient();
  const orderId = String(params.orderId || '').trim();
  const [trackingRoomJoined, setTrackingRoomJoined] = useState(false);

  const orderQuery = useOrderDetailQuery(orderId);
  const order = orderQuery.data || null;
  const refetchOrder = orderQuery.refetch;

  const isTrackableStatus = TRACKABLE_ORDER_STATUSES.has(order?.status);
  const isTerminalStatus = TERMINAL_ORDER_STATUSES.has(order?.status);
  const liveTracking = useLiveDeliveryTracking({
    orderId,
    orderStatus: order?.status
  });

  const orderItems = useMemo(() => (Array.isArray(order?.items) ? order.items : []), [order]);

  useEffect(() => {
    if (!orderId || !isTrackableStatus) {
      setTrackingRoomJoined(false);
      return undefined;
    }

    let isMounted = true;

    subscribeToOrderRoom(orderId).then((ack) => {
      if (!isMounted) {
        return;
      }

      setTrackingRoomJoined(Boolean(ack?.ok || ack?.queued));
    });

    return () => {
      isMounted = false;
      unsubscribeFromOrderRoom(orderId);
    };
  }, [orderId, isTrackableStatus]);

  useEffect(() => {
    const socket = getUserSocket();
    if (!socket || !orderId) {
      return undefined;
    }

    const onOrderStatusChanged = (payload) => {
      if (!payload || String(payload.orderId) !== orderId) {
        return;
      }

      queryClient.setQueryData(QUERY_KEYS.order.detail(orderId), (previous) => {
        if (!previous) {
          return previous;
        }

        return {
          ...previous,
          status: payload.toStatus || previous.status,
          revision:
            typeof payload.revision === 'number' ? payload.revision : previous.revision
        };
      });

      refetchOrder();
    };

    socket.on('order:status_changed', onOrderStatusChanged);
    return () => {
      socket.off('order:status_changed', onOrderStatusChanged);
    };
  }, [orderId, queryClient, refetchOrder]);

  if (orderQuery.isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0f172a" />
      </View>
    );
  }

  if (orderQuery.error || !order) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorTitle}>Could not load order</Text>
        <Text style={styles.errorMessage}>{getErrorMessage(orderQuery.error)}</Text>
        <Pressable style={styles.retryButton} onPress={() => orderQuery.refetch()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={orderItems}
        keyExtractor={(item) => `${item.menuId}`}
        renderItem={({ item }) => (
          <View style={styles.itemCard}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemTotal}>{formatPrice(item.lineTotal)}</Text>
            </View>
            <Text style={styles.itemMeta}>Qty: {item.quantity}</Text>
            <Text style={styles.itemMeta}>Unit: {formatPrice(item.unitPrice)}</Text>
          </View>
        )}
        ListHeaderComponent={
          <View>
            <Pressable style={styles.inlineBack} onPress={() => router.back()}>
              <Text style={styles.inlineBackText}>Back</Text>
            </Pressable>

            <Text style={styles.title}>Order #{order.orderNumber}</Text>
            <StatusBadge status={order.status} />

            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>{formatPrice(order.pricing?.subtotal)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Discount</Text>
                <Text style={styles.summaryValue}>
                  {formatPrice(order.pricing?.discountTotal)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabelStrong}>Grand Total</Text>
                <Text style={styles.summaryValueStrong}>
                  {formatPrice(order.pricing?.grandTotal)}
                </Text>
              </View>
            </View>

            <View style={styles.trackingCard}>
              <Text style={styles.trackingTitle}>Tracking Entry</Text>
              <Text style={styles.trackingText}>
                {isTrackableStatus
                  ? trackingRoomJoined
                    ? 'Socket room subscribed. Live delivery tracking can start.'
                    : 'Joining order room...'
                  : isTerminalStatus
                    ? 'Tracking closed because order is finalized.'
                    : 'Tracking will start when order becomes ASSIGNED.'}
              </Text>
            </View>

            <LiveTrackingMapCard
              trackingEnabled={liveTracking.trackingEnabled}
              trackingStopped={liveTracking.trackingStopped}
              riderOffline={liveTracking.riderOffline}
              userCoordinate={liveTracking.userCoordinate}
              deliveryCoordinate={liveTracking.deliveryCoordinate}
              deliveryUpdatedAt={liveTracking.deliveryUpdatedAt}
              deliverySignalStale={liveTracking.deliverySignalStale}
              locationPermissionGranted={liveTracking.locationPermissionGranted}
              locationLoading={liveTracking.locationLoading}
              animatedDeliveryCoordinate={liveTracking.animatedDeliveryCoordinate}
            />

            <Text style={styles.sectionTitle}>Items</Text>
          </View>
        }
        refreshing={orderQuery.isRefetching}
        onRefresh={() => orderQuery.refetch()}
        contentContainerStyle={styles.listContent}
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
    paddingHorizontal: 20,
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
    marginTop: 12,
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a'
  },
  statusBadge: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700'
  },
  summaryCard: {
    marginTop: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  summaryLabel: {
    color: '#475569'
  },
  summaryValue: {
    color: '#0f172a',
    fontWeight: '600'
  },
  summaryLabelStrong: {
    color: '#0f172a',
    fontWeight: '700'
  },
  summaryValueStrong: {
    color: '#0f172a',
    fontWeight: '700'
  },
  trackingCard: {
    marginTop: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12
  },
  trackingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a'
  },
  trackingText: {
    marginTop: 6,
    color: '#334155',
    lineHeight: 20
  },
  sectionTitle: {
    marginTop: 16,
    marginBottom: 10,
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a'
  },
  itemCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  itemName: {
    flex: 1,
    marginRight: 12,
    fontWeight: '700',
    color: '#0f172a'
  },
  itemTotal: {
    fontWeight: '700',
    color: '#0f172a'
  },
  itemMeta: {
    marginTop: 4,
    color: '#64748b'
  },
  listContent: {
    paddingBottom: 24
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
  backButton: {
    marginTop: 10
  },
  backButtonText: {
    color: '#0f172a',
    fontWeight: '600'
  }
});
