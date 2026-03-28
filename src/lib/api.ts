const normalizeApiBaseUrl = (value?: string) => {
  const raw = String(value || '').trim().replace(/\/+$/, '');
  if (!raw) return '';

  // Evita URL final duplicada como /api/api/... quando o endpoint já vem com /api
  return raw.replace(/\/api$/i, '');
};

const ENV_API_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_URL);
const isBrowser = typeof window !== 'undefined';
const isLocalhost = isBrowser && ['localhost', '127.0.0.1'].includes(window.location.hostname);

const getBaseCandidates = (endpoint: string) => {
  const sameOriginBase = '';
  const supportsSameOrigin = endpoint.startsWith('/api/') || endpoint.startsWith('/uploads/');
  const shouldPreferSameOrigin = isBrowser && !isLocalhost && supportsSameOrigin;

  const ordered = shouldPreferSameOrigin
    ? [sameOriginBase, ENV_API_URL]
    : [ENV_API_URL, sameOriginBase];

  return [...new Set(ordered.filter((base) => base !== undefined && base !== null))];
};

const buildUrl = (base: string, endpoint: string) =>
  base ? `${base}${endpoint}` : endpoint;

export const API_URL = ENV_API_URL;

const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);
const MAX_GET_RETRIES = 2;
const ERROR_LOG_COOLDOWN_MS = 15000;
const lastErrorLogByKey = new Map<string, number>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const shouldRetry = (method: string, status?: number) => {
  if (method !== 'GET') return false;
  if (!status) return true;
  return RETRYABLE_STATUS.has(status);
};

const isAuthMutationFallbackEndpoint = (endpoint: string) => {
  const normalized = endpoint.toLowerCase();
  return (
    normalized === '/api/auth/login' ||
    normalized === '/api/auth/register' ||
    normalized === '/auth/login' ||
    normalized === '/auth/register'
  );
};

const getEndpointCandidates = (endpoint: string, method: string) => {
  if (method === 'GET' || !isAuthMutationFallbackEndpoint(endpoint)) {
    return [endpoint];
  }

  const normalized = endpoint.toLowerCase();
  if (normalized.startsWith('/api/')) {
    return [endpoint, endpoint.replace(/^\/api\//i, '/')];
  }

  if (!normalized.startsWith('/api/')) {
    return [endpoint, `/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`];
  }

  return [endpoint];
};

const shouldLogNow = (key: string) => {
  const now = Date.now();
  const last = lastErrorLogByKey.get(key) || 0;
  if (now - last < ERROR_LOG_COOLDOWN_MS) return false;
  lastErrorLogByKey.set(key, now);
  return true;
};

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  body?: unknown;
  auth?: boolean;
}

export const api = async <T>(endpoint: string, options: ApiOptions = {}): Promise<T> => {
  const { method = 'GET', body, auth = true } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (auth) {
    const token = localStorage.getItem('auth_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const baseCandidates = getBaseCandidates(endpoint);
  const endpointCandidates = getEndpointCandidates(endpoint, method);
  const requestUrls = endpointCandidates.flatMap((endpointCandidate) =>
    baseCandidates.map((base) => buildUrl(base, endpointCandidate))
  );
  const retries = method === 'GET' ? MAX_GET_RETRIES : 0;
  let lastError: Error | null = null;

  for (let urlIndex = 0; urlIndex < requestUrls.length; urlIndex++) {
    const url = requestUrls[urlIndex];

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });

        const contentType = response.headers.get('content-type') || '';
        let data: any = null;

        // Read body as text first for safer parsing
        const rawText = await response.text().catch(() => '');

        if (contentType.includes('application/json') || rawText.trim().startsWith('{') || rawText.trim().startsWith('[')) {
          try {
            data = JSON.parse(rawText);
          } catch {
            data = { raw: rawText };
          }
        } else {
          if ((rawText.trim().startsWith('<!') || rawText.includes('<html')) && shouldLogNow(`html:${url}:${response.status}`)) {
            // eslint-disable-next-line no-console
            console.error('[api] Got HTML instead of JSON', {
              url,
              status: response.status,
              preview: rawText.substring(0, 300),
            });
          }
          data = { raw: rawText };
        }

        if (!response.ok) {
          if (attempt < retries && shouldRetry(method, response.status)) {
            await sleep(250 * Math.pow(2, attempt));
            continue;
          }

          const baseMsg = data?.error || data?.message || `Erro na requisição (${response.status})`;
          const details = data?.details ? `: ${data.details}` : '';
          const logKey = `fail:${url}:${response.status}`;
          if (shouldLogNow(logKey)) {
            // eslint-disable-next-line no-console
            console.error('[api] request failed', {
              url,
              status: response.status,
              contentType,
              body,
              response: data,
            });
          }

          const canFallbackGet = method === 'GET' && response.status >= 500;
          const canFallbackAuthMutation =
            method !== 'GET' &&
            isAuthMutationFallbackEndpoint(endpoint) &&
            [404, 405].includes(response.status);
          const shouldTryNextUrl =
            urlIndex < requestUrls.length - 1 && (canFallbackGet || canFallbackAuthMutation);
          if (shouldTryNextUrl) {
            lastError = new Error(`${baseMsg}${details}`);
            break;
          }

          throw new Error(`${baseMsg}${details}`);
        }

        return data as T;
      } catch (error: any) {
        const canRetry = attempt < retries && shouldRetry(method);
        if (canRetry) {
          await sleep(250 * Math.pow(2, attempt));
          continue;
        }

        if (shouldLogNow(`network:${url}`)) {
          // eslint-disable-next-line no-console
          console.error('[api] network failure', {
            url,
            method,
            message: error?.message || 'Erro de rede',
          });
        }

        const shouldTryNextBase =
          urlIndex < requestUrls.length - 1 &&
          (method === 'GET' || isAuthMutationFallbackEndpoint(endpoint));
        if (shouldTryNextBase) {
          lastError = error instanceof Error ? error : new Error('Erro de rede');
          break;
        }

        throw error;
      }
    }
  }

  if (lastError) throw lastError;
  throw new Error('Falha inesperada na requisição');
};

// Auth helpers
export const authApi = {
  login: (email: string, password: string) =>
    api<{ user: { id: string; email: string; name: string }; token: string }>(
      '/api/auth/login',
      { method: 'POST', body: { email, password }, auth: false }
    ),

  register: (email: string, password: string, name: string, plan_id?: string) =>
    api<{ user: { id: string; email: string; name: string }; token: string }>(
      '/api/auth/register',
      { method: 'POST', body: { email, password, name, plan_id }, auth: false }
    ),

  getMe: () =>
    api<{ user: { id: string; email: string; name: string } }>('/api/auth/me'),

  getSignupPlans: () =>
    api<Array<{
      id: string;
      name: string;
      description: string | null;
      max_connections: number;
      max_monthly_messages: number;
      max_users: number;
      price: number;
      billing_period: string;
      trial_days: number;
      has_chat: boolean;
      has_campaigns: boolean;
      has_asaas_integration: boolean;
    }>>('/api/auth/plans', { auth: false }),
};

export const setAuthToken = (token: string) => {
  localStorage.setItem('auth_token', token);
  localStorage.setItem('token', token);
};

export const clearAuthToken = () => {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('token');
};

export const getAuthToken = () => {
  return localStorage.getItem('auth_token');
};
