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
  emailVerified: boolean;
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
  emailVerified: boolean;
  createdAt: string;
}

export interface AuthTokenResponse {
  accessToken: string | null;
  refreshToken: string | null;
  tokenType: string | null;
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
    emailVerified: response.emailVerified,
    verified: response.verificationStatus === 'VERIFIED' || response.verificationStatus === 'NOT_REQUIRED',
    createdAt: response.createdAt,
  };
}

export interface EmailVerificationRequest {
  email: string;
}

export interface EmailVerificationResponse {
  challengeId: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
  message: string;
}

export interface EmailVerificationVerifyRequest {
  challengeId: string;
  email: string;
  code: string;
}
