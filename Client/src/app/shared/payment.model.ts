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
  paymentStatus: 'PENDING' | 'PAID' | 'HELD' | 'SETTLED' | 'FAILED' | 'CANCELLED' | 'REFUNDED' | 'UNKNOWN';
  paymentId?: number;
  merchantRequestId?: string;
  checkoutRequestId?: string;
  phoneNumber?: string;
  callbackStatus?: string;
  darajaResultCode?: number;
  darajaResultDesc?: string;
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
  status: string;
  paidAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  mpesaReceiptNumber?: string | null;
  merchantRequestId?: string | null;
  checkoutRequestId?: string | null;
  phoneNumber?: string | null;
  transactionDate?: string | null;
  callbackStatus?: string | null;
  darajaResultCode?: number | null;
  darajaResultDesc?: string | null;
}
