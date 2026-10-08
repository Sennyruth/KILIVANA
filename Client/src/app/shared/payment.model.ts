export interface MpesaInitiateRequest {
  orderId: string;
  phone: string;
  amount: number;
}

export interface MpesaInitiateResponse {
  checkoutRequestId: string;
  merchantRequestId: string;
  message: string;
}

export interface PaymentStatus {
  orderId: string;
  paymentStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
  mpesaReceipt?: string;
  transactionId?: string;
  completedAt?: string;
}