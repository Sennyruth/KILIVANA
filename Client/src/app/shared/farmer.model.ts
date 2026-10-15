export interface FarmerProfile {
  id: string;
  name: string;
  region: string | null;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'NOT_REQUIRED';
  createdAt?: string;
}

export interface FarmerProfileResponse {
  id: number;
  name: string;
  region: string | null;
  verificationStatus: FarmerProfile['verificationStatus'];
  createdAt?: string;
}

export function toFarmerProfile(response: FarmerProfileResponse): FarmerProfile {
  return {
    id: String(response.id),
    name: response.name,
    region: response.region,
    verificationStatus: response.verificationStatus,
    createdAt: response.createdAt,
  };
}
