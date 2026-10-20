export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PACKED'
  | 'SHIPPED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'COMPLETED'
  | 'FAILED';

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
  paymentMethod: 'MPESA' | 'BANK' | 'CASH' | 'CARD' | null;
  paymentStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string;
  cancelReason?: string;
}

export interface SellerOrderSummary {
  id: number;
  status: string;
  total: number;
  createdAt: string;
  itemCount: number;
}

export interface CreateOrderRequest {
  buyerId: number;
  addressId: number;
  items: Array<{ productId: number; quantity: number; unitPrice: number }>;
  deliveryFee: number;
  subtotal: number;
  total: number;
}

export interface CreatedOrder {
  id: number;
  buyerId: number;
  status: OrderStatus;
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentStatus: string;
  addressId: number;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
}
