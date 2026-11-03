import { environment } from '../../environments/environment';


const NGROK_URL = environment.ngrokUrl || '';

export const API_ORIGIN = environment.apiOrigin;
export const API_BASE = NGROK_URL ? `${NGROK_URL}/api/v1` : '/api/v1';

export const ApiEndpoints = {
  REGIONS: {
    COUNTIES: `${API_BASE}/regions`,
  },
  AUTH: {
    REGISTER: `${API_BASE}/auth/register`,
    LOGIN: `${API_BASE}/auth/login`,
    REFRESH: `${API_BASE}/auth/refresh`,
    FORGOT_PASSWORD: `${API_BASE}/auth/forgot-password`,
    RESET_PASSWORD: `${API_BASE}/auth/reset-password`,
    PROFILE: `${API_BASE}/auth/me`,
    EMAIL_VERIFICATION_REQUEST: `${API_BASE}/auth/email-verification/request`,
    EMAIL_VERIFICATION_VERIFY: `${API_BASE}/auth/email-verification/verify`,
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
    CLEAR_BY_ID: (cartId: string | number) => `${API_BASE}/carts/${cartId}`,
  },

  CHECKOUT: {
    START: `${API_BASE}/checkout`,
    DELIVERY_QUOTE: `${API_BASE}/checkout/delivery-quote`,
    CREATE_ORDER: `${API_BASE}/checkout/order`,
  },

  PICKUP_STATIONS: {
    AVAILABLE: `${API_BASE}/pickup-stations/available`,
    AVAILABLE_BY_REGION: (region: string) => `${API_BASE}/pickup-stations/available/region/${encodeURIComponent(region)}`,
  },

  ORDERS: {
    LIST: `${API_BASE}/orders`,
    DETAIL: (id: string) => `${API_BASE}/orders/${id}`,
    CREATE: `${API_BASE}/orders`,
    CANCEL: (id: string) => `${API_BASE}/orders/${id}/cancel`,
    BUYER: (buyerId: string) => `${API_BASE}/orders/buyer/${buyerId}`,
    SELLER: (sellerId: string) => `${API_BASE}/orders/seller/${sellerId}`,
    FARMER: (farmerId: string) => `${API_BASE}/orders/seller/${farmerId}`,
    SUPPLIER: (supplierId: string) => `${API_BASE}/orders/seller/${supplierId}`,
    TIMELINE: (id: string) => `${API_BASE}/orders/${id}/timeline`,
    SEARCH: `${API_BASE}/orders/search`,
  },
  LOGISTICS: {
    TRACKING_EVENTS: (jobId: string | number) => `${API_BASE}/logistics/tracking-events/job/${jobId}`,
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
    STK_PUSH: (sellerType: 'farmer' | 'supplier' | 'buyer') => `${API_BASE}/payments/stk-push/${sellerType}`,
    CREATE: `${API_BASE}/payments`,
    STATUS: (id: string) => `${API_BASE}/payments/${id}/status`,
    REFUND: (id: string) => `${API_BASE}/payments/${id}/refund`,
    WEBHOOK: `${API_BASE}/payments/webhook`,
    BY_ORDER: (orderId: string) => `${API_BASE}/payments/order/${orderId}`,
  },

  USERS: {
    CREATE_OWN_ADDRESS: `${API_BASE}/users/addresses`,
    SUPPLIERS: `${API_BASE}/users/suppliers`,
    PUBLIC_FARMER: (farmerId: string | number) => `${API_BASE}/users/farmers/${farmerId}`,
    FARMER_PROFILE: (farmerId: string | number) =>
      `${API_BASE}/profiles/farmers/${farmerId}`,
  },

  PROFILES: {
    FARMER: (userId: string | number) => `${API_BASE}/profiles/farmers/${userId}`,
    FARMER_IMAGES: (userId: string | number) => `${API_BASE}/profiles/farmers/${userId}/images`,
    FARMER_IMAGE: (userId: string | number, imageId: string | number) =>
      `${API_BASE}/profiles/farmers/${userId}/images/${imageId}`,
    FARMER_IMAGE_PRIMARY: (userId: string | number, imageId: string | number) =>
      `${API_BASE}/profiles/farmers/${userId}/images/${imageId}/primary`,
  },

  FARMER_FARMS: {
    LIST_MINE: `${API_BASE}/farmers/me/farms`,
    CREATE_MINE: `${API_BASE}/farmers/me/farms`,
    UPDATE_MINE: (farmId: string | number) => `${API_BASE}/farmers/me/farms/${farmId}`,
  },

  SELLER_LOCATIONS: {
    LIST_MINE: `${API_BASE}/suppliers/me/warehouses`,
    CREATE_MINE: `${API_BASE}/suppliers/me/warehouses`,
    DETAIL: (locationId: string | number) => `${API_BASE}/suppliers/me/warehouses/${locationId}`,
    UPDATE: (locationId: string | number) => `${API_BASE}/suppliers/me/warehouses/${locationId}`,
    DEACTIVATE: (locationId: string | number) => `${API_BASE}/suppliers/me/warehouses/${locationId}`,
    SET_DEFAULT: (locationId: string | number) => `${API_BASE}/suppliers/me/warehouses/${locationId}/default`,
  },
  
} as const;
