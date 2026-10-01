export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PACKED'
  | 'SHIPPED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
  lineTotal: number;
}

export interface Order {
  id: string;
  buyerId: string;
  buyerName: string;
  items: OrderItem[];
  status: OrderStatus;
  subtotal: number;
  deliveryFee: number;
  total: number;
  deliveryAddress: string;
  phone: string;
  paymentMethod: 'MPESA' | 'CASH' | 'CARD';
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED';
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string;
  cancelReason?: string;
}

export interface CreateOrderRequest {
  items: { productId: string; quantity: number }[];
  deliveryAddress: string;
  phone: string;
  paymentMethod: 'MPESA' | 'CASH' | 'CARD';
}