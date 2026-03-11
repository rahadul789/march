import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { login } from '../../src/modules/auth/api/auth.api';
import useAuthStore from '../../src/modules/auth/store/auth.store';
import { getErrorMessage } from '../../src/core/errors/errorUtils';
import useErrorStore from '../../src/core/store/error.store';

export default function LoginScreen() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const setAuthSession = useAuthStore((state) => state.setAuthSession);
  const clearGlobalError = useErrorStore((state) => state.clearGlobalError);

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (result) => {
      clearGlobalError();
      setAuthSession({
        user: result.user,
        tokens: result.tokens
      });
      router.replace('/(protected)/home');
    }
  });

  const onSubmit = () => {
    if (!identifier.trim() || !password.trim()) {
      return;
    }

    mutation.mutate({
      identifier: identifier.trim(),
      password
    });
  };

  const errorMessage = mutation.error ? getErrorMessage(mutation.error) : null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.subtitle}>Access your food delivery account</Text>

        <TextInput
          value={identifier}
          onChangeText={setIdentifier}
          placeholder="Email or phone"
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />

        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
          style={styles.input}
        />

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed ? styles.buttonPressed : null,
            mutation.isPending ? styles.buttonDisabled : null
          ]}
          onPress={onSubmit}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </Pressable>

        <Link href="/(auth)/register" style={styles.link}>
          Create a new account
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#f8fafc'
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a'
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 16,
    color: '#475569'
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    backgroundColor: '#fff'
  },
  button: {
    marginTop: 6,
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
  link: {
    marginTop: 14,
    textAlign: 'center',
    color: '#2563eb'
  },
  errorText: {
    color: '#dc2626',
    marginTop: 2,
    marginBottom: 6
  }
});
