import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import { resolveImageUrl } from '../utils/image';
import { toast, Toaster } from 'react-hot-toast';
import { saveOfflineSession, verifyOfflineLogin } from '../utils/auth-storage';
import { APP_VERSION } from '../version';

const LoginView = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { settings } = useBranding();
  const navigate = useNavigate();

  const formatCpf = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  const handleIdentifierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Simple heuristic: if user is typing numbers, try to format as CPF
    // If user types letters or @, treat as email (no formatting)
    const onlyNumbers = value.replace(/\D/g, '');
    const isNumericStart = /^\d/.test(value);
    
    if (isNumericStart && !value.includes('@')) {
       setIdentifier(formatCpf(value));
    } else {
       setIdentifier(value);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Send identifier as 'email' field because backend expects it in DTO (even if it is CPF)
      const response = await client.post('/auth/login', { email: identifier, password });
      
      const { access_token, user } = response.data;

      // Save for offline access
      await saveOfflineSession(identifier, password, access_token, user);

      login(access_token, user);
      toast.success('Login realizado com sucesso!');
      navigate('/');
    } catch (error: any) {
      console.error('Login error:', error);

      // Try offline login if network error or server unavailable
      if (!error.response || error.code === 'ERR_NETWORK' || error.response?.status >= 500) {
        console.log('Attempting offline login...');
        const offlineSession = await verifyOfflineLogin(identifier, password);
        
        if (offlineSession) {
           login(offlineSession.token, offlineSession.user);
           toast('Login Offline: Funcionalidades limitadas.', { icon: '📡' });
           navigate('/');
           return; // Exit function successfully
        }
      }

      toast.error(error.response?.data?.message || 'Falha no login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Toaster position="top-center" />
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 space-y-6">
        <div className="text-center">
          {settings.loginLogoUrl || settings.logoUrl ? (
            <img 
              src={resolveImageUrl(settings.loginLogoUrl || settings.logoUrl)} 
              alt={settings.companyName} 
              className="h-20 mx-auto mb-4 object-contain"
            />
          ) : (
            <h1 className="text-3xl font-bold text-primary mb-2">{settings.companyName}</h1>
          )}
          <p className="text-gray-500">App do Promotor</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CPF ou Email</label>
            <input
              type="text"
              value={identifier}
              onChange={handleIdentifierChange}
              className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
              placeholder="000.000.000-00 ou email@exemplo.com"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        
        <div className="text-center text-xs text-gray-400">
          v{APP_VERSION}
        </div>
      </div>
    </div>
  );
};

export default LoginView;
