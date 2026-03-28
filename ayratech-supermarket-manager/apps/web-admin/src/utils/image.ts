import { API_URL } from '../api/client';

export const getImageUrl = (url: string | undefined | null) => {
  if (!url || typeof url !== 'string') return '';
  if (url.startsWith('data:')) return url;

  // Robustly handle any URL containing /uploads/
  // This fixes issues where the URL might be:
  // 1. A full URL from a different environment (localhost vs prod)
  // 2. A malformed URL (e.g. .ayratech.app.br/uploads/...)
  // 3. A relative path (/uploads/...)
  // PRIORITIZE THIS to fix hardcoded localhost URLs in database
  if (url.includes('/uploads/')) {
    const relativePath = url.substring(url.indexOf('/uploads/'));
    return `${API_URL}${relativePath}`;
  }

  // Handle full URLs that don't match the uploads pattern (external images)
  if (url.startsWith('http')) {
      return url;
  }

  // Handle bare filenames (legacy support) - assume they go to /uploads/
  if (!url.includes('/') && !url.startsWith('http')) {
    return `${API_URL}/uploads/${url}`;
  }

  // Handle other relative paths
  return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

export const resolveImageUrl = getImageUrl;
