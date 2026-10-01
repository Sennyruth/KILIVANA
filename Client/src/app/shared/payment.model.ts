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
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED';
  mpesaReceipt?: string;
  transactionId?: string;
  completedAt?: string;
}