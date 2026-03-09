/**
 * 登入／註冊相關型別
 */

export interface AuthUser {
  id: string;
  email?: string;
  phone?: string;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
}

export interface LoginCredentials {
  email?: string;
  phone?: string;
  password: string;
}

export interface RegisterCredentials {
  email?: string;
  phone?: string;
  password: string;
}
