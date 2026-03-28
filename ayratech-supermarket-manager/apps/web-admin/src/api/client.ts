import axios from 'axios';

const ensureApiSuffix = (url: string) => {
  const normalized = url.replace(/\/+$/, '');
  return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
};

const normalizeApiUrl = (value?: string) => {
  let url = String(value ?? '').trim();

  if (!url) {
    url = import.meta.env.VITE_SUPERMARKET_API_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '/api');
  }

  if (!/^https?:\/\//i.test(url)) {
    const cleaned = url.replace(/^\.+/, '').replace(/^\/+|\/+$/g, '');

    if (cleaned.includes('.')) {
      return ensureApiSuffix(`https://${cleaned}`);
    }

    return `/${cleaned || 'api'}`;
  }

  try {
    const parsed = new URL(url);
    const absoluteUrl = `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '');
    const isLocalhost = ['localhost', '127.0.0.1'].includes(parsed.hostname);

    return isLocalhost ? absoluteUrl : ensureApiSuffix(absoluteUrl);
  } catch {
    return ensureApiSuffix(url);
  }
};

export const API_URL = normalizeApiUrl(import.meta.env.VITE_API_URL);

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
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
