export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  duration?: number;
}

export interface UsageStats {
  filesScrubbedThisMonth: number;
  plan: 'free' | 'pro';
  limit: number;
}
