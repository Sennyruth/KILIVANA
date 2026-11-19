export interface MpesaInitiateRequest {
  orderId: number;
  phoneNumber?: string;
}

export interface MpesaInitiateResponse {
  paymentId: number;
  orderId: number | null;
  amount: number;
  status?: string;
  darajaResponse: {
    checkoutRequestID?: string;
    merchantRequestID?: string;
    responseCode?: string;
    responseDescription?: string;
    customerMessage?: string;
  };
  createdAt: string;
}

export type StkPushInitiateResponse = MpesaInitiateResponse;

export interface PaymentStatus {
  orderId: string | null;
  paymentStatus: 'PENDING' | 'PAID' | 'HELD' | 'SETTLED' | 'FAILED' | 'CANCELLED' | 'REFUNDED' | 'UNKNOWN';
  paymentId?: number;
  amount?: number;
  merchantRequestId?: string;
  checkoutRequestId?: string;
  phoneNumber?: string;
  callbackStatus?: string;
  darajaResultCode?: number;
  darajaResultDesc?: string;
  mpesaReceipt?: string;
  transactionId?: string;
  completedAt?: string;
  paidAt?: string;
}

export function normalizePaymentStatus(value: unknown): PaymentStatus['paymentStatus'] {
  const status = String(value ?? 'UNKNOWN').trim().toUpperCase();
  if (status === 'TIMED_OUT' || status === 'TIMEOUT') return 'FAILED';
  return ['PENDING', 'PAID', 'HELD', 'SETTLED', 'FAILED', 'CANCELLED', 'REFUNDED'].includes(status)
    ? status as PaymentStatus['paymentStatus']
    : 'UNKNOWN';
}

export type MpesaSellerType = 'farmer' | 'supplier' | 'buyer';

export interface PaymentStatusResponse {
  id?: number;
  paymentId?: number;
  orderId?: number | null;
  method: string;
  reference?: string | null;
  amount: number;
  status: string;
  paymentStatus?: string;
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
  darajaResponse?: MpesaInitiateResponse['darajaResponse'] | null;
}
