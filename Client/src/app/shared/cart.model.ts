import type { ProductType } from './product.model';

export interface CartItem {
  id: string | number;
  productId: string;
  name: string;
  price: number;
  unit: string;
  quantity: number;
  availableQuantity?: number;
  imageUrl: string;
  sellerName: string;
  lineTotal: number;
  type?: ProductType;
}

export interface Cart {
  id: string | number;
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  buyerId: number;
  status: 'ACTIVE' | 'CHECKOUT_PROCESSING' | 'ABANDONED';
  createdAt: string;
  updatedAt: string;
}
