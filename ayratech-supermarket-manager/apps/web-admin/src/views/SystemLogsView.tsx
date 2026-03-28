import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { 
  AlertCircle, 
  RefreshCw, 
  Trash2, 
  Search, 
  Info, 
  AlertTriangle, 
  XCircle,
  Clock,
  User,
  Code
} from 'lucide-react';

interface SystemLog {
  id: string;
  level: string;
  message: string;
  stack: string;
  context: string;
  userId: string;
  metadata: any;
  createdAt: string;
}

const SystemLogsView: React.FC = () => {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await api.get('/system-logs?limit=100');
      setLogs(response.data);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = async () => {
    if (!window.confirm('Tem certeza que deseja limpar todos os logs?')) return;
    try {
      await api.delete('/system-logs');
      fetchLogs();
    } catch (error) {
      console.error('Error clearing logs:', error);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error': return <XCircle className="text-red-500" size={20} />;
      case 'warn': return <AlertTriangle className="text-yellow-500" size={20} />;
      case 'info': return <Info className="text-blue-500" size={20} />;
      default: return <AlertCircle className="text-[color:var(--color-muted)]" size={20} />;
    }
  };

  const getLevelBadge = (level: string) => {
    const classes = {
      error: 'bg-red-100 text-red-700',
      warn: 'bg-yellow-100 text-yellow-700',
      info: 'bg-blue-100 text-blue-700',
      debug: 'bg-slate-100 text-[color:var(--color-text)]',
    }[level] || 'bg-slate-100 text-[color:var(--color-text)]';

    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${classes}`}>
        {level}
      </span>
    );
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--color-text)] flex items-center gap-2">
            <Code className="text-blue-600" />
            Logs do Sistema
          </h1>
          <p className="text-[color:var(--color-muted)] mt-1">
            Monitoramento de erros e eventos do sistema
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-[color:var(--color-text)] rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </button>
          
          <button
            onClick={clearLogs}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
          >
            <Trash2 size={18} />
            Limpar
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-4 text-xs font-bold text-[color:var(--color-muted)] uppercase w-16">Nível</th>
                <th className="p-4 text-xs font-bold text-[color:var(--color-muted)] uppercase w-48">Contexto</th>
                <th className="p-4 text-xs font-bold text-[color:var(--color-muted)] uppercase">Mensagem</th>
                <th className="p-4 text-xs font-bold text-[color:var(--color-muted)] uppercase w-48">Data/Hora</th>
                <th className="p-4 text-xs font-bold text-[color:var(--color-muted)] uppercase w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-[color:var(--color-muted)]">
                    Nenhum log encontrado.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <React.Fragment key={log.id}>
                    <tr 
                      className={`hover:bg-slate-50 cursor-pointer transition-colors ${expandedLog === log.id ? 'bg-slate-50' : ''}`}
                      onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                    >
                      <td className="p-4 align-top">
                        <div className="flex items-center gap-2">
                          {getLevelIcon(log.level)}
                          {getLevelBadge(log.level)}
                        </div>
                      </td>
                      <td className="p-4 align-top">
                        <div className="font-medium text-[color:var(--color-text)] font-mono text-sm">{log.context}</div>
                        {log.userId && (
                          <div className="flex items-center gap-1 text-xs text-[color:var(--color-muted)] mt-1">
                            <User size={12} />
                            {log.userId}
                          </div>
                        )}
                      </td>
                      <td className="p-4 align-top">
                        <div className="text-[color:var(--color-text)] line-clamp-2">{log.message}</div>
                      </td>
                      <td className="p-4 align-top text-[color:var(--color-muted)] text-sm whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Clock size={14} />
                          {new Date(log.createdAt).toLocaleString()}
                        </div>
                      </td>
                      <td className="p-4 align-top text-right">
                        <div className={`transition-transform duration-200 ${expandedLog === log.id ? 'rotate-180' : ''}`}>
                          <RefreshCw size={16} className="opacity-0" /> {/* Spacer */}
                          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-slate-400">
                            <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      </td>
                    </tr>
                    {expandedLog === log.id && (
                      <tr className="bg-slate-50">
                        <td colSpan={5} className="p-4 pt-0 border-b border-slate-200">
                          <div className="bg-slate-900 rounded-lg p-4 text-slate-300 font-mono text-xs overflow-x-auto space-y-4">
                            <div>
                              <div className="text-[color:var(--color-muted)] mb-1 uppercase tracking-wider font-bold">Stack Trace</div>
                              <pre className="whitespace-pre-wrap">{log.stack || 'N/A'}</pre>
                            </div>
                            
                            {log.metadata && Object.keys(log.metadata).length > 0 && (
                              <div>
                                <div className="text-[color:var(--color-muted)] mb-1 uppercase tracking-wider font-bold">Metadata</div>
                                <pre className="whitespace-pre-wrap">{JSON.stringify(log.metadata, null, 2)}</pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SystemLogsView;
