export interface MpesaInitiateRequest {
  orderId: number;
  phoneNumber?: string;
}

export interface MpesaInitiateResponse {
  paymentId: number;
  orderId: number;
  amount: number;
  status: string;
  darajaResponse: {
    checkoutRequestID?: string;
    merchantRequestID?: string;
    responseCode?: string;
    responseDescription?: string;
    customerMessage?: string;
  };
  createdAt: string;
}

export interface PaymentStatus {
  orderId: string;
  paymentStatus: 'PENDING' | 'PAID' | 'HELD' | 'SETTLED' | 'FAILED' | 'REFUNDED';
  mpesaReceipt?: string;
  transactionId?: string;
  completedAt?: string;
}

export type MpesaSellerType = 'farmer' | 'supplier' | 'buyer';

export interface PaymentStatusResponse {
  id: number;
  orderId: number;
  method: string;
  reference?: string | null;
  amount: number;
  status: 'pending' | 'paid' | 'held' | 'settled' | 'failed' | 'refunded';
  paidAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  mpesaReceiptNumber?: string | null;
}
