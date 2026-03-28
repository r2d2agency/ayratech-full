import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../api/client';
import { resolveImageUrl } from '../utils/image';

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

interface BrandingContextType {
  settings: BrandingSettings;
  updateSettings: (newSettings: Partial<BrandingSettings>) => void;
}

const defaultSettings: BrandingSettings = {
  companyName: 'Ayratech',
  primaryColor: '#2563eb', // Default blue-600
  logoUrl: 'https://cdn-icons-png.flaticon.com/512/3050/3050253.png', // Placeholder
};

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<BrandingSettings>(defaultSettings);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await api.get('/settings');
        if (response.data) {
            setSettings(prev => ({ ...prev, ...response.data }));
        }
      } catch (error) {
        console.error('Failed to fetch branding settings:', error);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    // Update Title
    if (settings.companyName) {
        document.title = settings.companyName;
    }

    // Update Theme Color
    if (settings.primaryColor) {
        const metaThemeColor = document.querySelector("meta[name='theme-color']") as HTMLMetaElement;
        if (metaThemeColor) {
            metaThemeColor.content = settings.primaryColor;
        }
    }

    // Update Favicon
    if (settings.faviconUrl) {
        const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement || document.createElement('link');
        link.type = 'image/x-icon';
        link.rel = 'shortcut icon';
        link.href = resolveImageUrl(settings.faviconUrl);
        document.getElementsByTagName('head')[0].appendChild(link);
    }

    // Update PWA Icon & Manifest
    if (settings.pwaIconUrl) {
        const pwaIconFullUrl = resolveImageUrl(settings.pwaIconUrl);

        // Update Apple Touch Icon
        const appleLink = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement || document.createElement('link');
        appleLink.rel = 'apple-touch-icon';
        appleLink.href = pwaIconFullUrl;
        if (!document.head.contains(appleLink)) {
            document.head.appendChild(appleLink);
        }

        // Update Manifest
        const updateManifest = () => {
             const manifest = {
                name: settings.companyName || 'Ayratech',
                short_name: settings.companyName || 'Ayratech',
                description: `App do Promotor - ${settings.companyName}`,
                theme_color: settings.primaryColor || '#ffffff',
                background_color: '#ffffff',
                display: 'standalone',
                scope: window.location.origin + '/',
                start_url: window.location.origin + '/',
                icons: [
                    {
                        src: pwaIconFullUrl,
                        sizes: "192x192",
                        type: "image/png"
                    },
                    {
                        src: pwaIconFullUrl,
                        sizes: "512x512",
                        type: "image/png"
                    }
                ]
            };

            const stringManifest = JSON.stringify(manifest);
            const blob = new Blob([stringManifest], {type: 'application/json'});
            const manifestURL = URL.createObjectURL(blob);
            
            let manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
            if (manifestLink) {
                manifestLink.setAttribute('href', manifestURL);
            } else {
                manifestLink = document.createElement('link');
                manifestLink.rel = 'manifest';
                manifestLink.href = manifestURL;
                document.head.appendChild(manifestLink);
            }
        };

        updateManifest();
    }
  }, [settings]);

  const updateSettings = (newSettings: Partial<BrandingSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  return (
    <BrandingContext.Provider value={{ settings, updateSettings }}>
      <style>{`
        :root {
          --primary-color: ${settings.primaryColor};
        }
        .text-primary { color: ${settings.primaryColor}; }
        .bg-primary { background-color: ${settings.primaryColor}; }
        .border-primary { border-color: ${settings.primaryColor}; }
        .ring-primary { --tw-ring-color: ${settings.primaryColor}; }
      `}</style>
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = () => {
  const context = useContext(BrandingContext);
  if (!context) throw new Error('useBranding must be used within a BrandingProvider');
  return context;
};
