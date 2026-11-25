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

export type DeliveryStatus =
  | 'PENDING_ASSIGNMENT'
  | 'ASSIGNED'
  | 'ACCEPTED'
  | 'EN_ROUTE_TO_PICKUP'
  | 'ARRIVED_AT_PICKUP'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'ARRIVED_AT_DESTINATION'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'FAILED';

export function deliveryStatusLabel(status?: string | null): string | null {
  if (!status) return null;
  const labels: Partial<Record<DeliveryStatus, string>> = {
    PENDING_ASSIGNMENT: 'Awaiting driver assignment',
    ASSIGNED: 'Driver assigned',
    ACCEPTED: 'Driver accepted',
    EN_ROUTE_TO_PICKUP: 'Driver heading to pickup',
    ARRIVED_AT_PICKUP: 'Driver at pickup',
    PICKED_UP: 'Picked up',
    IN_TRANSIT: 'In transit',
    ARRIVED_AT_DESTINATION: 'Arrived at destination',
    DELIVERED: 'Delivered',
    CANCELLED: 'Delivery cancelled',
    FAILED: 'Delivery issue',
  };
  return labels[status.toUpperCase() as DeliveryStatus] ?? null;
}

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
  deliveryStatus?: DeliveryStatus | null;
  logisticsJobId?: number | null;
  driverName?: string | null;
  subtotal: number;
  deliveryFee: number;
  total: number;
  deliveryAddress: string;
  pickupLocation?: string | null;
  phone: string;
  paymentMethod: 'MPESA' | 'BANK' | 'CASH' | 'CARD' | null;
  paymentStatus: 'PENDING' | 'PAID' | 'HELD' | 'SETTLED' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
  paymentReference?: string | null;
  paidAt?: string | null;
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string;
  cancelReason?: string;
}

export interface SellerOrderSummary {
  id: number;
  buyerName?: string;
  buyerPhone?: string;
  deliveryAddress?: string;
  pickupLocation?: string | null;
  status: string;
  paymentStatus?: 'PENDING' | 'PAID' | 'HELD' | 'SETTLED' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
  deliveryStatus?: DeliveryStatus | null;
  logisticsJobId?: number | null;
  driverName?: string | null;
  total: number;
  createdAt: string;
  itemCount: number;
  itemNames?: string[];
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
