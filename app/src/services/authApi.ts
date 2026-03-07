/**
 * 登入／註冊／驗證 API 呼叫
 */
import { getApiBaseUrl } from '../config/api';
import type { AuthResponse, LoginCredentials, RegisterCredentials } from '../types/auth';

export async function register(credentials: RegisterCredentials): Promise<AuthResponse> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '註冊失敗');
  return data as AuthResponse;
}

export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '登入失敗');
  return data as AuthResponse;
}

export async function me(token: string): Promise<{ user: AuthResponse['user'] }> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/auth/me`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '驗證失敗');
  return data as { user: AuthResponse['user'] };
}
