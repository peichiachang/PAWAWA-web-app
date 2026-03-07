import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_TOKEN_KEY, AUTH_USER_KEY } from '../constants';
import { login as apiLogin, register as apiRegister, me } from '../services/authApi';
import type { AuthUser, LoginCredentials, RegisterCredentials } from '../types/auth';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const persistSession = useCallback(async (newUser: AuthUser, newToken: string) => {
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, newToken);
    await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(newUser));
    setUser(newUser);
    setToken(newToken);
    setError(null);
  }, []);

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      setError(null);
      try {
        const { user: u, token: t } = await apiLogin(credentials);
        await persistSession(u, t);
      } catch (err) {
        setError(err instanceof Error ? err.message : '登入失敗');
        throw err;
      }
    },
    [persistSession]
  );

  const register = useCallback(
    async (credentials: RegisterCredentials) => {
      setError(null);
      try {
        const { user: u, token: t } = await apiRegister(credentials);
        await persistSession(u, t);
      } catch (err) {
        setError(err instanceof Error ? err.message : '註冊失敗');
        throw err;
      }
    },
    [persistSession]
  );

  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, AUTH_USER_KEY]);
    setUser(null);
    setToken(null);
    setError(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [storedToken, storedUserJson] = await Promise.all([
          AsyncStorage.getItem(AUTH_TOKEN_KEY),
          AsyncStorage.getItem(AUTH_USER_KEY),
        ]);
        if (cancelled || !storedToken?.trim()) {
          if (!cancelled) setLoading(false);
          return;
        }
        try {
          const { user: u } = await me(storedToken);
          if (!cancelled) {
            setUser(u);
            setToken(storedToken);
          }
        } catch (_e) {
          await AsyncStorage.multiRemove([AUTH_TOKEN_KEY, AUTH_USER_KEY]);
          if (!cancelled) setUser(null);
          setToken(null);
        }
      } catch (_e) {
        if (!cancelled) setUser(null);
        setToken(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value: AuthContextValue = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    error,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
