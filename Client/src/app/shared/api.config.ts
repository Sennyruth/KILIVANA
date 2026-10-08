import { environment } from '../../environments/environment';

// API Configuration for ngrok integration
const NGROK_URL = environment.ngrokUrl || '';

export const API_BASE = NGROK_URL ? `${NGROK_URL}/api/v1` : '/api/v1';

export const ApiEndpoints = {
  AUTH: {
    REGISTER: `${API_BASE}/auth/register`,
    LOGIN: `${API_BASE}/auth/login`,
    REFRESH: `${API_BASE}/auth/refresh`,
    FORGOT_PASSWORD: `${API_BASE}/auth/forgot-password`,
    RESET_PASSWORD: `${API_BASE}/auth/reset-password`,
    PROFILE: `${API_BASE}/auth/me`,
  },
  PRODUCTS: {
    LIST: `${API_BASE}/products`,
    DETAIL: (id: string) => `${API_BASE}/products/${id}`,
    UPDATE: (id: string) => `${API_BASE}/products/${id}`,
    DELETE: (id: string) => `${API_BASE}/products/${id}`,
    UPLOAD: (id: string) => `${API_BASE}/products/${id}/images`,
    IMAGES: (id: string) => `${API_BASE}/products/${id}/images`,
    IMAGE: (productId: string, imageId: number) =>
      `${API_BASE}/products/${productId}/images/${imageId}`,
    SELLER: (sellerId: string | number) => `${API_BASE}/products/seller/${sellerId}`,
    CATEGORIES: `${API_BASE}/categories/active`,
    SEARCH: `${API_BASE}/products/search`,
    BY_CATEGORY: (categoryId: string) => `${API_BASE}/products/category/${categoryId}`,
    UPDATE_STATUS: (id: string) => `${API_BASE}/products/${id}/status`,
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
    CHECKOUT: `${API_BASE}/orders/checkout`,
    MINE: `${API_BASE}/orders/mine`,
    CANCEL: (id: string) => `${API_BASE}/orders/${id}/cancel`,
    BUYER: (buyerId: string) => `${API_BASE}/orders/buyer/${buyerId}`,
    SELLER_MINE: `${API_BASE}/orders/seller/mine`,
    TIMELINE: (id: string) => `${API_BASE}/orders/${id}/timeline`,
    CONFIRM_RECEIPT: (id: string) => `${API_BASE}/orders/${id}/confirm-receipt`,
    SEARCH: `${API_BASE}/orders/search`,
  },

  DISPUTES: {
    CREATE: `${API_BASE}/disputes`,
    DETAIL: (id: string) => `${API_BASE}/disputes/${id}`,
    USER: (userId: string) => `${API_BASE}/disputes/user/${userId}`,
    ORDER: (orderId: string) => `${API_BASE}/disputes/order/${orderId}`,
    UPDATE_STATUS: (id: string) => `${API_BASE}/disputes/${id}/status`,
    RESOLVE: (id: string) => `${API_BASE}/disputes/${id}/resolution`,
  },

  PAYMENT: {
    INITIATE: `${API_BASE}/payments/initiate`,
    CREATE: `${API_BASE}/payments`,
    STATUS: (id: string) => `${API_BASE}/payments/${id}/status`,
    REFUND: (id: string) => `${API_BASE}/payments/${id}/refund`,
    WEBHOOK: `${API_BASE}/payments/webhook`,
    BY_ORDER: (orderId: string) => `${API_BASE}/payments/order/${orderId}`,
  },

  TRACKING: {
    HISTORY: (orderId: string) => `${API_BASE}/orders/${orderId}/tracking`,
  },

  USERS: {
    SUPPLIERS: `${API_BASE}/users/suppliers`,
  },
  
} as const;