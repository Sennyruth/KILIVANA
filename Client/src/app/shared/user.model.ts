export type UserRole = 'FARMER' | 'BUYER' | 'SUPPLIER';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION';

export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'NOT_REQUIRED';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  username?: string;
  region?: string;
  referenceCode?: string;
  role: UserRole;
  status: UserStatus;
  verificationStatus: VerificationStatus;
  verified: boolean;
  createdAt: string;
  avatarUrl?: string;
}

export interface UserResponse {
  id: number;
  name: string;
  email: string;
  phone: string;
  username: string | null;
  referenceCode: string | null;
  region: string | null;
  role: UserRole;
  status: UserStatus;
  verificationStatus: VerificationStatus;
  createdAt: string;
}

export interface AuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number | null;
  user: UserResponse;
}

export function toUser(response: UserResponse): User {
  return {
    id: String(response.id),
    name: response.name,
    email: response.email,
    phone: response.phone,
    username: response.username ?? undefined,
    region: response.region ?? undefined,
    referenceCode: response.referenceCode ?? undefined,
    role: response.role,
    status: response.status,
    verificationStatus: response.verificationStatus,
    verified: response.verificationStatus === 'VERIFIED' || response.verificationStatus === 'NOT_REQUIRED',
    createdAt: response.createdAt,
  };
}
