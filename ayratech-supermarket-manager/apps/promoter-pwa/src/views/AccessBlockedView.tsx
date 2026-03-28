import React from 'react';
import { Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const AccessBlockedView: React.FC<{ reason: string; limit?: string; start?: string; end?: string; onRetry: () => void }> = ({ reason, limit, start, end, onRetry }) => {
  const { logout } = useAuth();
  const [loading, setLoading] = React.useState(false);

  const handleRetry = async () => {
    setLoading(true);
    await onRetry();
    setLoading(false);
  };

  const getMessage = () => {
    switch (reason) {
      case 'not_working_day':
      case 'day_off':
        return 'Hoje não é um dia de trabalho agendado.';
      case 'too_early':
        return `Ainda é muito cedo. Seu turno começa às ${start}.`;
      case 'shift_ended':
        return `Seu turno encerrou às ${end}.`;
      case 'no_schedule_defined':
        return 'Nenhum horário de trabalho definido. Contate seu supervisor.';
      case 'schedule_expired':
        return 'Sua escala de trabalho expirou.';
      default:
        return 'Acesso bloqueado fora do horário de trabalho.';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-sm">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500">
          <Clock size={32} />
        </div>
        
        <h1 className="text-2xl font-black text-slate-900 mb-2">Acesso Restrito</h1>
        <p className="text-slate-500 mb-8 font-medium">
          {getMessage()}
        </p>

        {(start || end) && (
           <div className="bg-slate-50 rounded-xl p-4 mb-6">
              <p className="text-xs font-bold text-slate-400 uppercase mb-1">Horário Permitido</p>
              <p className="text-lg font-black text-slate-800">
                {start || '??:??'} - {end || '??:??'}
              </p>
           </div>
        )}

        <button 
          onClick={handleRetry}
          disabled={loading}
          className="w-full py-4 bg-blue-600 text-white rounded-xl font-black shadow-lg hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2 mb-4"
        >
          {loading ? <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div> : <RefreshCw size={20} />}
          Verificar Novamente
        </button>
        
        <button 
          onClick={logout}
          className="text-slate-400 font-bold text-sm hover:text-slate-600"
        >
          Sair da Conta
        </button>
      </div>
    </div>
  );
};

export default AccessBlockedView;
