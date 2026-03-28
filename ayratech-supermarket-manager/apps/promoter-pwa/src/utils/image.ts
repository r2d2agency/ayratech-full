import { API_URL } from '../api/client';

export const resolveImageUrl = (url: string | undefined | null) => {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  if (url.startsWith('blob:')) return url;
  
  // Fix for images saved with localhost or different domains
  if (url.includes('/uploads/')) {
    const relativePath = url.substring(url.indexOf('/uploads/'));
    return `${API_URL}${relativePath}`;
  }
  
  // If it's a full URL
  if (url.startsWith('http')) {
      // If we are in prod (https) and the url is http, try to upgrade or fix
      if (window.location.protocol === 'https:' && url.startsWith('http:')) {
           // If it's our own API but with http, replace with API_URL (which should be https in prod)
           // Or if it's localhost, also replace with API_URL
           if (url.includes('localhost') || url.includes('api.ayratech.app.br')) {
               // Try to extract the path part
               const pathPart = url.split('/uploads/')[1];
               if (pathPart) {
                   return `${API_URL}/uploads/${pathPart}`;
               }
           }
      }
      return url;
  }

  // Case 3: Relative path without /uploads/ (presumably)
  // If it's a bare filename, assume it's in uploads
  if (!url.includes('/') && !url.startsWith('http')) {
    return `${API_URL}/uploads/${url}`;
  }

  // Handle other relative paths
  return `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};
