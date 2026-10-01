export type UserRole = 'FARMER' | 'BUYER' | 'SUPPLIER';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  verified: boolean;
  createdAt: string;
  avatarUrl?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthUserResponse {
  user: User;
  tokens: AuthTokens;
}