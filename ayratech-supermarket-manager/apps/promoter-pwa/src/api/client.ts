import axios from 'axios';

const normalizeApiUrl = (value?: string) => {
  let url = String(value ?? '').trim();

  if (!url) {
    url = import.meta.env.DEV ? 'http://localhost:3000' : '/api';
  }

  if (!/^https?:\/\//i.test(url)) {
    const cleaned = url.replace(/^\.+/, '').replace(/^\/+|\/+$/g, '');

    if (cleaned.includes('.')) {
      url = `https://${cleaned}`;
    } else {
      return `/${cleaned || 'api'}`;
    }
  }

  try {
    const parsed = new URL(url);
    const isLocalhost = ['localhost', '127.0.0.1'].includes(parsed.hostname);

    if (!isLocalhost && (!parsed.pathname || parsed.pathname === '/')) {
      parsed.pathname = '/api';
    }

    return parsed.toString().replace(/\/$/, '');
  } catch {
    return url.replace(/\/$/, '');
  }
};

export const API_URL = normalizeApiUrl(import.meta.env.VITE_API_URL);

const client = axios.create({
  baseURL: API_URL,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      if (window.location.pathname !== '/login') {
        console.warn('Sessão expirada ou inválida (401).');
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default client;
