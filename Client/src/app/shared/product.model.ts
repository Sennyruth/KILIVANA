export type ProductCategory =
  | 'VEGETABLES'
  | 'FRUITS'
  | 'GRAINS'
  | 'DAIRY'
  | 'POULTRY'
  | 'LIVESTOCK'
  | 'HERBS'
  | 'FERTILIZERS'
  | 'SEEDS'
  | 'PESTICIDES'
  | 'EQUIPMENT'
  | 'TOOLS'
  | 'OTHER';

export type ProductType = 'PRODUCE' | 'INPUT';

export interface ProductImage {
  id: string;
  url: string;
  alt: string;
  isPrimary: boolean;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
  unit: string;
  category: ProductCategory;
  type: ProductType;
  images: ProductImage[];
  farmerId: string;
  farmerName: string;
  farmerVerified: boolean;
  location: string;
  rating: number;
  reviewCount: number;
  available: boolean;
  createdAt: string;
}

export interface ProductFilters {
  category?: ProductCategory;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  farmerId?: string;
}