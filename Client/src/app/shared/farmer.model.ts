export interface FarmerProfile {
  id: string;
  name: string;
  region: string | null;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'NOT_REQUIRED';
  createdAt?: string;
  userId?: string;
  farmName?: string;
  farmDetails?: string | null;
  verificationInfo?: string | null;
  images?: FarmerProfileImage[];
}

export interface FarmerProfileImage {
  id: number;
  url: string;
  publicId?: string;
  assetId?: string | null;
  sortOrder?: number;
  isPrimary?: boolean;
  createdAt?: string;
}

export interface FarmerProfileResponse {
  id: number;
  userId?: number;
  name?: string;
  farmName?: string | null;
  location?: string | null;
  region?: string | null;
  farmDetails?: string | null;
  verificationInfo?: string | null;
  verificationStatus?: FarmerProfile['verificationStatus'];
  createdAt?: string;
  images?: FarmerProfileImage[] | null;
}

export function toFarmerProfile(response: FarmerProfileResponse): FarmerProfile {
  return {
    id: String(response.id),
    name: response.name ?? '',
    region: response.region ?? response.location ?? null,
    verificationStatus: response.verificationStatus ?? 'PENDING',
    createdAt: response.createdAt,
    userId: response.userId === undefined ? undefined : String(response.userId),
    farmName: response.farmName ?? response.name ?? '',
    farmDetails: response.farmDetails ?? null,
    verificationInfo: response.verificationInfo ?? null,
    images: response.images ?? [],
  };
}
