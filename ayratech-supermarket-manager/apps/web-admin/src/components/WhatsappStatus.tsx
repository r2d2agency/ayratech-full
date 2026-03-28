import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import api from '../api/client';

export const WhatsappStatus: React.FC<{ expanded: boolean }> = ({ expanded }) => {
  const [status, setStatus] = useState<'checking' | 'connected' | 'disconnected' | 'error'>('checking');
  const [details, setDetails] = useState<string>('');

  const checkStatus = async () => {
    setStatus('checking');
    try {
      const response = await api.get('/notifications/whatsapp/status');
      const data = response.data;
      
      // Evolution API logic
      // Assuming 'open' means connected.
      // Adjust if necessary based on real response structure.
      const state = data?.instance?.state || data?.state;
      
      if (state === 'open') {
        setStatus('connected');
        setDetails(`Conectado: ${data?.instance?.instanceName || ''}`);
      } else if (data?.status === 'ERROR') {
        setStatus('error');
        setDetails(data.message);
      } else {
        setStatus('disconnected');
        setDetails(`Estado: ${state || 'Desconhecido'}`);
      }
    } catch (error: any) {
      console.error('Failed to check WhatsApp status', error);
      setStatus('error');
      setDetails('Erro ao verificar conexão');
    }
  };

  useEffect(() => {
    checkStatus();
    // Poll every 5 minutes
    const interval = setInterval(checkStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getIcon = () => {
    switch (status) {
      case 'checking': return <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />;
      case 'connected': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'disconnected': return <AlertCircle className="w-4 h-4 text-amber-500" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getLabel = () => {
    switch (status) {
      case 'checking': return 'Verificando...';
      case 'connected': return 'WhatsApp Online';
      case 'disconnected': return 'WhatsApp Offline';
      case 'error': return 'Erro Conexão';
    }
  };

  return (
    <div 
      className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 cursor-pointer relative group transition-all"
      onClick={checkStatus}
      title={details}
    >
      <div className="min-w-[24px] flex justify-center">
          {getIcon()}
      </div>
      
      <span className={`font-bold text-sm text-[color:var(--color-muted)] transition-all duration-300 overflow-hidden whitespace-nowrap ${
        expanded ? 'w-auto opacity-100' : 'w-0 opacity-0'
      }`}>
        {getLabel()}
      </span>

      {/* Tooltip for collapsed state */}
      {!expanded && (
        <div className="absolute left-16 bg-slate-900 text-white text-xs py-1.5 px-3 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
          {getLabel()}
        </div>
      )}
    </div>
  );
};
