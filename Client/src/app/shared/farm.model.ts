import type { FarmerProfileImage } from './farmer.model';

export type FarmOwnershipType = 'OWNED' | 'LEASED' | 'COMMUNAL';

export interface FarmerFarm {
  id: number | string;
  farmerId: number | string;
  name: string;
  county: string;
  subCounty?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  sizeAcres: number;
  ownershipType: FarmOwnershipType;
  status?: string;
  description?: string | null;
  images?: FarmerProfileImage[];
}

export interface FarmerFarmRequest {
  name: string;
  county: string;
  subCounty?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  sizeAcres: number;
  ownershipType: FarmOwnershipType;
  description?: string;
}

/** Admin farmer details include farmer profile photos separately from per-farm images. */
export interface AdminFarmerDetails {
  id: number | string;
  name: string;
  profileImages: FarmerProfileImage[];
  farms: FarmerFarm[];
}
