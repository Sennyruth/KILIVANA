export type ProductCategory = string;

export type ProductType = 'PRODUCE' | 'INPUT';
export type ProductStatus =
  | 'ACTIVE'
  | 'PENDING_APPROVAL'
  | 'REJECTED'
  | 'SUSPENDED';

export interface ProductImage {
  id: number;
  url: string;
  publicId: string;
  assetId: string | null;
  sortOrder: number;
  isPrimary: boolean;
  createdAt: string;
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
  categoryId?: number;
  minimumOrderQty?: number;
  status?: ProductStatus;
}

export interface ProductFilters {
  category?: ProductCategory;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  farmerId?: string;
}

/** Shape returned by the backend's /api/v1/products endpoints. */
export interface ProductResponse {
  id: number;
  sellerId: number;
  sellerType: 'FARMER' | 'SUPPLIER' | 'farmer' | 'supplier';
  location?: string | null;
  farmerName?: string | null;
  farmerVerified?: boolean;
  sellerName?: string | null;
  sellerCounty?: string | null;
  sellerLocation?: string | null;
  farmCertified?: boolean | null;
  isLive?: boolean | null;
  categoryName?: string | null;
  categoryId: number;
  name: string;
  description: string;
  unit: string;
  price: number;
  stockQty: number;
  reservedQty: number;
  soldQty: number;
  minimumOrderQty: number;
  status: ProductStatus | 'pending' | Lowercase<ProductStatus>;
  createdAt: string;
  updatedAt: string;
  images: ProductImage[] | null;
}
