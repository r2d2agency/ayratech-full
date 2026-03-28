import axios from 'axios';

export const API_URL = (() => {
  const url = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000' : 'https://api.ayratech.app.br');
  if (url && !url.startsWith('http')) {
    return `https://${url.startsWith('.') ? url.substring(1) : url}`;
  }
  return url;
})();

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
    // Apenas desloga se for explicitamente 401 E não for a rota de login
    // Adicionar verificação de expiração para não deslogar prematuramente por outros erros 401
    if (error.response && error.response.status === 401) {
      // Evita loop de redirecionamento se já estiver na tela de login
      if (window.location.pathname !== '/login') {
          console.warn('Sessão expirada ou inválida (401).');
          // Force logout on 401 to prevent stuck state
          localStorage.removeItem('token');
          window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default client;
