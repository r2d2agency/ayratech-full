import React, { useState, useEffect } from 'react';
import { useBranding } from '../context/BrandingContext';
import api from '../api/client';
import { getImageUrl } from '../utils/image';
import { LayoutGrid } from 'lucide-react';

interface LoginViewProps {
  onLogin: () => void;
}

const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  // Ensure hook is called safely
  const { settings } = useBranding();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      // Save or clear remembered email
      if (rememberMe) {
        localStorage.setItem('rememberedEmail', email);
      } else {
        localStorage.removeItem('rememberedEmail');
      }

      // 1. Tentar login como usuário comum
      try {
        const response = await api.post('auth/login', { email, password });
        localStorage.setItem('token', response.data.access_token);
        onLogin();
        return;
      } catch (userErr: any) {
        // Se for erro de credenciais (401/404), tenta como cliente
        // Se for erro de servidor (500), lança
        if (userErr.response && (userErr.response.status === 401 || userErr.response.status === 404)) {
           // Continua para tentar como cliente
        } else {
           throw userErr;
        }
      }

      // 2. Tentar login como cliente
      const response = await api.post('auth/client/login', { email, password });
      localStorage.setItem('token', response.data.access_token);
      onLogin();

    } catch (err) {
      console.error('Login error:', err);
      setError('Login falhou. Verifique suas credenciais.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!email || !password) {
      setError('Preencha usuário e senha para registrar.');
      return;
    }
    try {
      await api.post('auth/register', { email, password });
      alert('Usuário criado com sucesso! Agora clique em Entrar.');
      setError('');
    } catch (err: any) {
      console.error('Registration error:', err);
      let errorMessage = 'Erro ao criar usuário.';
      
      if (err.response?.data?.message) {
        const msg = err.response.data.message;
        errorMessage = Array.isArray(msg) ? msg.join(', ') : msg;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(`Erro no registro: ${errorMessage}`);
    }
  }
  const handleDevReset = async () => {
    if (!email || !password) {
      setError('Preencha email e senha para recuperar acesso.');
      return;
    }
    try {
      await api.post('auth/reset', { email, password }, { headers: { 'x-admin-reset': 'AYRATECH_DEV_RESET' } });
      const response = await api.post('auth/login', { email, password });
      localStorage.setItem('token', response.data.access_token);
      onLogin();
    } catch (err: any) {
      let errorMessage = 'Falha ao recuperar acesso.';
      if (err.response?.data?.message) {
        const msg = err.response.data.message;
        errorMessage = Array.isArray(msg) ? msg.join(', ') : msg;
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[color:var(--surface)]">
      <div className="p-8 rounded-2xl border border-[color:var(--color-border)] w-96 flex flex-col items-center bg-[color:var(--surface-container-low)] shadow-[0_0_20px_rgba(253,0,255,0.12)]">
        {settings.loginLogoUrl ? (
          <img 
            src={getImageUrl(settings.loginLogoUrl)} 
            alt="Logo" 
            className="mb-6 h-32 object-contain" 
          />
        ) : (
          <div 
            className="mb-6 h-16 w-16 flex items-center justify-center rounded-full text-[color:var(--on-background)] shadow-[0_0_15px_rgba(253,0,255,0.25)] bg-gradient-to-tr from-[color:var(--color-primary)] to-[color:var(--color-secondary)]"
          >
            {settings.logoUrl ? (
              <img 
                src={getImageUrl(settings.logoUrl)} 
                alt="Logo" 
                className="w-10 h-10 object-contain brightness-0 invert" 
              />
            ) : (
              <LayoutGrid size={32} />
            )}
          </div>
        )}
        <h2 className="text-2xl font-bold mb-6 text-center  text-[color:var(--color-primary)]">Login</h2>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-[color:var(--color-muted)] text-sm font-medium mb-2  uppercase tracking-wider">Email</label>
            <input
              type="text"
              className="w-full px-4 py-3 rounded-xl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="mb-4">
            <label className="block text-[color:var(--color-muted)] text-sm font-medium mb-2  uppercase tracking-wider">Senha</label>
            <input
              type="password"
              className="w-full px-4 py-3 rounded-xl"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="mb-4 flex items-center">
            <input
              type="checkbox"
              id="rememberMe"
              className="mr-2 h-4 w-4 text-[color:var(--color-secondary)] border-white/20 rounded"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <label htmlFor="rememberMe" className="text-[color:var(--color-muted)] text-sm">Lembrar de mim</label>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full text-[color:var(--on-background)] font-bold py-3 px-4 rounded-xl bg-gradient-to-r from-[color:var(--color-primary)] to-[color:var(--color-primary)] hover:opacity-90 transition-colors disabled:opacity-70"
          >
            {isLoading ? 'Entrando...' : 'Entrar'}
          </button>
           <button
            type="button"
            onClick={handleRegister}
            className="w-full mt-2 text-[color:var(--color-muted)] font-bold py-2.5 px-4 rounded-xl border border-[color:var(--color-border)] hover:bg-white/5 transition-colors"
          >
            Registrar (Dev)
          </button>
          <button
            type="button"
            onClick={handleDevReset}
            className="w-full mt-2 text-[color:var(--color-muted)] font-bold py-2.5 px-4 rounded-xl border border-[color:var(--color-border)] hover:bg-white/5 transition-colors"
          >
            Recuperar acesso (Dev)
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginView;
