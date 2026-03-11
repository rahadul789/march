import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { getMe, logout } from '../../src/modules/auth/api/auth.api';
import useAuthStore from '../../src/modules/auth/store/auth.store';
import { QUERY_KEYS } from '../../src/shared/constants/queryKeys';
import { getErrorMessage } from '../../src/core/errors/errorUtils';

export default function HomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const clearAuthSession = useAuthStore((state) => state.clearAuthSession);

  const meQuery = useQuery({
    queryKey: QUERY_KEYS.auth.me,
    queryFn: getMe,
    staleTime: 60000
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      if (refreshToken) {
        await logout({ refreshToken });
      }
      return true;
    },
    onSettled: async () => {
      clearAuthSession();
      await queryClient.cancelQueries();
      queryClient.clear();
      router.replace('/(auth)/login');
    }
  });

  const displayName = useMemo(() => {
    if (meQuery.data?.user?.fullName) {
      return meQuery.data.user.fullName;
    }

    return user?.fullName || 'User';
  }, [meQuery.data, user]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Home</Text>
      <Text style={styles.subtitle}>Authenticated session is active.</Text>

      {meQuery.isFetching ? (
        <ActivityIndicator color="#0f172a" />
      ) : (
        <View style={styles.profileCard}>
          <Text style={styles.label}>Welcome</Text>
          <Text style={styles.value}>{displayName}</Text>
          <Text style={styles.meta}>
            {meQuery.data?.user?.email || user?.email || 'Email unavailable'}
          </Text>
        </View>
      )}

      {meQuery.error ? (
        <Text style={styles.errorText}>{getErrorMessage(meQuery.error)}</Text>
      ) : null}

      <Pressable
        style={({ pressed }) => [
          styles.secondaryButton,
          pressed ? styles.buttonPressed : null
        ]}
        onPress={() => router.push('/(protected)/restaurants')}
      >
        <Text style={styles.secondaryButtonText}>Browse Restaurants</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.button,
          pressed ? styles.buttonPressed : null,
          logoutMutation.isPending ? styles.buttonDisabled : null
        ]}
        onPress={() => logoutMutation.mutate()}
        disabled={logoutMutation.isPending}
      >
        <Text style={styles.buttonText}>
          {logoutMutation.isPending ? 'Signing out...' : 'Logout'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 72,
    paddingHorizontal: 20,
    backgroundColor: '#f8fafc'
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0f172a'
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 20,
    color: '#475569'
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  label: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#64748b'
  },
  value: {
    marginTop: 6,
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a'
  },
  meta: {
    marginTop: 4,
    color: '#475569'
  },
  button: {
    marginTop: 18,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12
  },
  buttonPressed: {
    opacity: 0.92
  },
  buttonDisabled: {
    opacity: 0.7
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600'
  },
  secondaryButton: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: '#0f172a',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#fff'
  },
  secondaryButtonText: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '600'
  },
  errorText: {
    marginTop: 12,
    color: '#dc2626'
  }
});
