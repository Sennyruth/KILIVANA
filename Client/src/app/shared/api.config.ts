import { environment } from '../../environments/environment';

// API Configuration for ngrok integration
const NGROK_URL = environment.ngrokUrl || '';

export const API_BASE = NGROK_URL ? `${NGROK_URL}/api/v1` : '/api/v1';

export const ApiEndpoints = {
  AUTH: {
    REGISTER: `${API_BASE}/auth/register`,
    LOGIN: `${API_BASE}/auth/login`,
    REFRESH: `${API_BASE}/auth/refresh`,
    PROFILE: `${API_BASE}/auth/me`,
  },
  PRODUCTS: {
    LIST: `${API_BASE}/products`,
    DETAIL: (id: string) => `${API_BASE}/products/${id}`,
    UPLOAD: `${API_BASE}/products/images`,
    CATEGORIES: `${API_BASE}/products/categories`,
  },
  CART: {
    GET: `${API_BASE}/cart`,
    ADD: `${API_BASE}/cart/items`,
    UPDATE: (itemId: string) => `${API_BASE}/cart/items/${itemId}`,
    REMOVE: (itemId: string) => `${API_BASE}/cart/items/${itemId}`,
    CLEAR: `${API_BASE}/cart`,
  },
  ORDERS: {
    CREATE: `${API_BASE}/orders`,
    LIST: `${API_BASE}/orders`,
    DETAIL: (id: string) => `${API_BASE}/orders/${id}`,
    CANCEL: (id: string) => `${API_BASE}/orders/${id}/cancel`,
  },
  PAYMENT: {
    MPESA: `${API_BASE}/payments/mpesa`,
    STATUS: (orderId: string) => `${API_BASE}/payments/${orderId}/status`,
  },
  TRACKING: {
    HISTORY: (orderId: string) => `${API_BASE}/orders/${orderId}/tracking`,
  },
  USERS: {
    SUPPLIERS: `${API_BASE}/users/suppliers`,
  },
} as const;