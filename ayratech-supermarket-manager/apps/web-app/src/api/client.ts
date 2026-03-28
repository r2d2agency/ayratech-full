import axios from 'axios';

const normalizeApiUrl = (value?: string) => {
  let url = String(value ?? '').trim();

  if (!url) {
    url = '/api';
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

const API_URL = normalizeApiUrl((window as any).env?.API_URL);

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
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
