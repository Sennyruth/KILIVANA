export interface SellerLocation {
  id: number | string;
  name: string;
  address: string;
  county: string;
  latitude: number;
  longitude: number;
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
