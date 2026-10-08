export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
  timestamp?: string;
  error?: ApiErrorDetail | null;
}

export interface ApiErrorDetail {
  code?: string;
  details?: string;
}