import { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

const DEFAULT_COORDINATE = Object.freeze({
  latitude: 23.8103,
  longitude: 90.4125
});

export default function LiveTrackingMapCard({
  trackingEnabled,
  trackingStopped,
  riderOffline,
  userCoordinate,
  deliveryCoordinate,
  deliveryUpdatedAt,
  deliverySignalStale,
  locationPermissionGranted,
  locationLoading,
  animatedDeliveryCoordinate
}) {
  const mapRef = useRef(null);

  const initialRegion = useMemo(() => {
    const fallback = deliveryCoordinate || userCoordinate || DEFAULT_COORDINATE;

    return {
      latitude: fallback.latitude,
      longitude: fallback.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02
    };
  }, [deliveryCoordinate, userCoordinate]);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    const coordinates = [];

    if (userCoordinate) {
      coordinates.push(userCoordinate);
    }

    if (deliveryCoordinate) {
      coordinates.push(deliveryCoordinate);
    }

    if (coordinates.length < 2) {
      return;
    }

    mapRef.current.fitToCoordinates(coordinates, {
      edgePadding: {
        top: 60,
        right: 40,
        bottom: 60,
        left: 40
      },
      animated: true
    });
  }, [userCoordinate, deliveryCoordinate]);

  const trackingStatusText = (() => {
    if (trackingStopped) {
      return 'Tracking stopped because the order is finalized.';
    }

    if (!trackingEnabled) {
      return 'Tracking starts when order reaches ASSIGNED status.';
    }

    if (riderOffline) {
      return 'Rider is currently offline. Waiting for reconnect.';
    }

    if (!deliveryCoordinate) {
      return 'Waiting for rider location updates...';
    }

    return 'Live delivery location is active.';
  })();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Live Tracking Map</Text>
      <Text style={styles.subtitle}>{trackingStatusText}</Text>

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={initialRegion}
          showsUserLocation={false}
          showsCompass={false}
          showsTraffic={false}
          toolbarEnabled={false}
        >
          {userCoordinate ? (
            <Marker coordinate={userCoordinate} title="You" pinColor="#2563eb" />
          ) : null}

          {deliveryCoordinate ? (
            <Marker.Animated
              coordinate={animatedDeliveryCoordinate}
              title="Deliveryman"
              pinColor="#dc2626"
            />
          ) : null}
        </MapView>

        {locationLoading ? (
          <View style={styles.overlay}>
            <ActivityIndicator color="#0f172a" />
            <Text style={styles.overlayText}>Loading your location...</Text>
          </View>
        ) : null}
      </View>

      {!locationPermissionGranted && !locationLoading ? (
        <Text style={styles.meta}>User marker unavailable: location permission denied.</Text>
      ) : null}

      {deliveryUpdatedAt ? (
        <Text style={styles.meta}>Last rider update: {new Date(deliveryUpdatedAt).toLocaleTimeString()}</Text>
      ) : null}

      {deliverySignalStale ? (
        <Text style={styles.metaWarning}>
          Location signal is stale. Push fallback can be triggered in next milestone.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a'
  },
  subtitle: {
    marginTop: 6,
    color: '#334155',
    lineHeight: 20
  },
  mapContainer: {
    marginTop: 10,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minHeight: 240
  },
  map: {
    width: '100%',
    height: 240
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(248,250,252,0.8)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  overlayText: {
    marginTop: 8,
    color: '#0f172a',
    fontWeight: '600'
  },
  meta: {
    marginTop: 8,
    color: '#64748b',
    fontSize: 12
  },
  metaWarning: {
    marginTop: 8,
    color: '#b45309',
    fontSize: 12,
    fontWeight: '600'
  }
});
