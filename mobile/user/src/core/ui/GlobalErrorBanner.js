import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import useErrorStore from '../store/error.store';

const AUTO_DISMISS_MS = 6000;

export default function GlobalErrorBanner() {
  const globalError = useErrorStore((state) => state.globalError);
  const clearGlobalError = useErrorStore((state) => state.clearGlobalError);

  useEffect(() => {
    if (!globalError) {
      return undefined;
    }

    const timeout = setTimeout(() => {
      clearGlobalError();
    }, AUTO_DISMISS_MS);

    return () => clearTimeout(timeout);
  }, [globalError, clearGlobalError]);

  if (!globalError) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.message}>{globalError.message}</Text>
      <Pressable onPress={clearGlobalError}>
        <Text style={styles.dismiss}>Dismiss</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    borderBottomColor: '#fecaca',
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  message: {
    flex: 1,
    color: '#991b1b',
    marginRight: 8
  },
  dismiss: {
    color: '#b91c1c',
    fontWeight: '600'
  }
});
