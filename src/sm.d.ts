// Type declarations for @sm (ayratech-supermarket-manager) modules
// These are resolved by Vite alias at build time

declare module '@sm/context/BrandingContext' {
  import { FC, ReactNode } from 'react';
  export interface BrandingSettings {
    companyName: string;
    primaryColor: string;
    logoUrl: string;
    loginLogoUrl?: string;
    systemLogoUrl?: string;
    splashScreenUrl?: string;
    faviconUrl?: string;
    pwaIconUrl?: string;
    siteIconUrl?: string;
    blurThreshold?: number;
  }
  export const BrandingProvider: FC<{ children: ReactNode }>;
  export const useBranding: () => { settings: BrandingSettings; updateSettings: (s: Partial<BrandingSettings>) => void };
}

declare module '@sm/context/ThemeContext' {
  import { FC, ReactNode } from 'react';
  export const ThemeProvider: FC<{ children: ReactNode }>;
  export const useTheme: () => { theme: 'light' | 'dark'; toggleTheme: () => void };
}

declare module '@sm/types' {
  export type ViewType = string;
  export interface SupermarketData { [key: string]: any }
  export interface Client { [key: string]: any }
  export interface Product { [key: string]: any }
  export interface SupermarketGroup { [key: string]: any }
}

declare module '@sm/utils/image' {
  export const getImageUrl: (url: string | undefined | null) => string;
  export const resolveImageUrl: (url: string | undefined | null) => string;
}

declare module '@sm/api/client' {
  import { AxiosInstance } from 'axios';
  export const API_URL: string;
  const api: AxiosInstance;
  export default api;
}

// Wildcard for all view modules
declare module '@sm/views/*' {
  import { FC } from 'react';
  const Component: FC<any>;
  export default Component;
}

// Wildcard for all component modules
declare module '@sm/components/*' {
  import { FC } from 'react';
  const Component: FC<any>;
  export default Component;
}

declare module '@sm/hooks/*' {
  const hook: (...args: any[]) => any;
  export default hook;
  export const useLivePhotos: (...args: any[]) => any;
}
