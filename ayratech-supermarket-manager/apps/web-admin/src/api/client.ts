import axios from 'axios';

export const API_URL = (() => {
  let url = import.meta.env.VITE_API_URL;
  
  // Fallback if not defined
  if (!url) {
    url = import.meta.env.DEV ? 'http://localhost:3000' : 'https://api.ayratech.app.br';
  }
  
  // Ensure it's a string
  url = String(url).trim();

  // If it doesn't start with http, assume it's a domain or partial URL
  if (!url.startsWith('http')) {
    // Remove leading dot if present (fix for some env config issues)
    if (url.startsWith('.')) {
      url = url.substring(1);
    }
    // Remove leading slashes
    while (url.startsWith('/')) {
        url = url.substring(1);
    }
    url = `https://${url}`;
  }
  
  // Remove trailing slash to be consistent
  if (url.endsWith('/')) {
    url = url.slice(0, -1);
  }
  
  return url;
})();

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      // Optional: Redirect to login page if not already there
      if (window.location.pathname !== '/login') {
         window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
