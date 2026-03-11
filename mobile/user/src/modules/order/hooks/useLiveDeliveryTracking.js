import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { AnimatedRegion } from 'react-native-maps';
import { getUserSocket } from '../../../core/realtime/socket.gateway';
import {
  TERMINAL_ORDER_STATUSES,
  TRACKABLE_ORDER_STATUSES
} from '../types/order.constants';

const DEFAULT_REGION = Object.freeze({
  latitude: 23.8103,
  longitude: 90.4125
});
const DELIVERY_SIGNAL_STALE_MS = 60000;

function normalizeTrackingPayload(payload, targetOrderId) {
  if (!payload || String(payload.orderId) !== String(targetOrderId)) {
    return null;
  }

  const latitude = Number(payload.lat);
  const longitude = Number(payload.lng);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return {
    latitude,
    longitude,
    status: payload.status || null,
    updatedAt: payload.updatedAt || null
  };
}

export default function useLiveDeliveryTracking({ orderId, orderStatus }) {
  const [userCoordinate, setUserCoordinate] = useState(null);
  const [deliveryCoordinate, setDeliveryCoordinate] = useState(null);
  const [deliveryUpdatedAt, setDeliveryUpdatedAt] = useState(null);
  const [trackingStopped, setTrackingStopped] = useState(false);
  const [riderOffline, setRiderOffline] = useState(false);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [locationLoading, setLocationLoading] = useState(true);
  const [deliverySignalStale, setDeliverySignalStale] = useState(false);

  const appStateRef = useRef(AppState.currentState || 'active');
  const pendingDeliveryRef = useRef(null);
  const locationWatchSubscriptionRef = useRef(null);
  const animatedDeliveryCoordinateRef = useRef(
    new AnimatedRegion({
      ...DEFAULT_REGION,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01
    })
  );

  const trackingEnabled = useMemo(
    () => Boolean(orderId && TRACKABLE_ORDER_STATUSES.has(orderStatus)),
    [orderId, orderStatus]
  );

  useEffect(() => {
    if (TERMINAL_ORDER_STATUSES.has(orderStatus)) {
      setTrackingStopped(true);
    }
  }, [orderStatus]);

  useEffect(() => {
    let isMounted = true;

    const setupUserLocation = async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!isMounted) {
          return;
        }

        if (permission.status !== 'granted') {
          setLocationPermissionGranted(false);
          return;
        }

        setLocationPermissionGranted(true);
        const currentPosition = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced
        });

        if (!isMounted) {
          return;
        }

        setUserCoordinate({
          latitude: currentPosition.coords.latitude,
          longitude: currentPosition.coords.longitude
        });

        locationWatchSubscriptionRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 25,
            timeInterval: 15000
          },
          (position) => {
            setUserCoordinate({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            });
          }
        );
      } finally {
        if (isMounted) {
          setLocationLoading(false);
        }
      }
    };

    setupUserLocation();

    return () => {
      isMounted = false;
      if (locationWatchSubscriptionRef.current) {
        locationWatchSubscriptionRef.current.remove();
        locationWatchSubscriptionRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      const previous = appStateRef.current;
      appStateRef.current = nextState;

      const movedToForeground =
        previous !== 'active' &&
        nextState === 'active' &&
        pendingDeliveryRef.current;

      if (movedToForeground) {
        const queued = pendingDeliveryRef.current;
        pendingDeliveryRef.current = null;

        animatedDeliveryCoordinateRef.current.timing({
          latitude: queued.latitude,
          longitude: queued.longitude,
          duration: 300,
          useNativeDriver: false
        }).start();
      }
    });

    return () => {
      appStateSubscription.remove();
    };
  }, []);

  useEffect(() => {
    const socket = getUserSocket();
    if (!socket || !orderId || !trackingEnabled) {
      return undefined;
    }

    const handleDeliveryLocation = (payload) => {
      const normalized = normalizeTrackingPayload(payload, orderId);
      if (!normalized) {
        return;
      }

      if (TERMINAL_ORDER_STATUSES.has(normalized.status)) {
        setTrackingStopped(true);
        return;
      }

      setRiderOffline(false);
      setDeliveryUpdatedAt(normalized.updatedAt || new Date().toISOString());
      setDeliveryCoordinate({
        latitude: normalized.latitude,
        longitude: normalized.longitude
      });

      if (appStateRef.current !== 'active') {
        pendingDeliveryRef.current = normalized;
        return;
      }

      animatedDeliveryCoordinateRef.current.timing({
        latitude: normalized.latitude,
        longitude: normalized.longitude,
        duration: 850,
        useNativeDriver: false
      }).start();
    };

    const handleTrackingStopped = (payload) => {
      if (!payload || String(payload.orderId) !== String(orderId)) {
        return;
      }

      setTrackingStopped(true);
    };

    const handleRiderOffline = (payload) => {
      if (!payload || String(payload.orderId) !== String(orderId)) {
        return;
      }

      setRiderOffline(true);
    };

    socket.on('order:delivery:location', handleDeliveryLocation);
    socket.on('tracking:location_update', handleDeliveryLocation);
    socket.on('tracking:stopped', handleTrackingStopped);
    socket.on('tracking:rider_offline', handleRiderOffline);

    return () => {
      socket.off('order:delivery:location', handleDeliveryLocation);
      socket.off('tracking:location_update', handleDeliveryLocation);
      socket.off('tracking:stopped', handleTrackingStopped);
      socket.off('tracking:rider_offline', handleRiderOffline);
    };
  }, [orderId, trackingEnabled]);

  useEffect(() => {
    if (!deliveryUpdatedAt) {
      setDeliverySignalStale(false);
      return undefined;
    }

    const interval = setInterval(() => {
      const ageMs = Date.now() - new Date(deliveryUpdatedAt).getTime();
      setDeliverySignalStale(ageMs > DELIVERY_SIGNAL_STALE_MS);
    }, 5000);

    return () => clearInterval(interval);
  }, [deliveryUpdatedAt]);

  return {
    trackingEnabled,
    trackingStopped,
    riderOffline,
    userCoordinate,
    deliveryCoordinate,
    deliveryUpdatedAt,
    deliverySignalStale,
    locationPermissionGranted,
    locationLoading,
    animatedDeliveryCoordinate: animatedDeliveryCoordinateRef.current
  };
}
