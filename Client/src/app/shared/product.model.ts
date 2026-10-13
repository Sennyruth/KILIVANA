export type ProductCategory = string;

export type ProductType = 'PRODUCE' | 'INPUT';
export type ProductStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'OUT_OF_STOCK'
  | 'PENDING_APPROVAL'
  | 'REJECTED';

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

/** Shape returned by GET /api/v1/sellers/{sellerId}/products and POST /api/v1/products. */
export interface ProductResponse {
  id: number;
  sellerId: number;
  sellerType: 'farmer' | 'supplier';
  categoryId: number;
  name: string;
  description: string;
  unit: string;
  price: number;
  stockQty: number;
  reservedQty: number;
  soldQty: number;
  minimumOrderQty: number;
  status: ProductStatus | Lowercase<ProductStatus>;
  createdAt: string;
  updatedAt: string;
  images: ProductImage[] | null;
}