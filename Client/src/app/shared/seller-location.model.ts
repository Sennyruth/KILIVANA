import { hasValidDispatchCoordinates } from './dispatch-location';

export interface SellerLocation {
  id: number | string;
  name: string;
  address: string;
  county: string;
  latitude: number | null;
  longitude: number | null;
  contactName?: string | null;
  contactPhone?: string | null;
  operatingHours?: string | null;
  active: boolean;
  defaultLocation: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SellerLocationRequest {
  name: string;
  address: string;
  county: string;
  latitude: number;
  longitude: number;
  contactName?: string;
  contactPhone?: string;
  operatingHours?: string;
}

export function hasSellerDispatchLocation(location: Pick<
  SellerLocation,
  'address' | 'latitude' | 'longitude' | 'active'
>): boolean {
  return location.active && hasValidDispatchCoordinates(location);
}
