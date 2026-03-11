import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AppProviders from '../src/core/providers/AppProviders';
import GlobalErrorBanner from '../src/core/ui/GlobalErrorBanner';

export function ErrorBoundary({ error, retry }) {
  return (
    <View style={styles.errorBoundaryContainer}>
      <Text style={styles.errorBoundaryTitle}>Unexpected error</Text>
      <Text style={styles.errorBoundaryMessage}>
        {error?.message || 'Something went wrong. Please retry.'}
      </Text>
      <Pressable style={styles.errorBoundaryButton} onPress={retry}>
        <Text style={styles.errorBoundaryButtonText}>Retry</Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="dark" />
      <GlobalErrorBanner />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(protected)" />
      </Stack>
    </AppProviders>
  );
}

const styles = StyleSheet.create({
  errorBoundaryContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#fff'
  },
  errorBoundaryTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12
  },
  errorBoundaryMessage: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: '#334155',
    marginBottom: 18
  },
  errorBoundaryButton: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 10
  },
  errorBoundaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600'
  }
});
