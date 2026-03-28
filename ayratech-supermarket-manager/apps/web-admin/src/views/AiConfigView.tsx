import React, { useState, useEffect } from 'react';
import { Settings, Key, Bot, Save, AlertCircle, CheckCircle } from 'lucide-react';
import api from '../api/client';

const modelsByProvider: Record<string, string[]> = {
  gemini: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro-vision'],
  openai: ['gpt-4o', 'gpt-4-turbo', 'gpt-4-vision-preview']
};

const AiConfigView: React.FC = () => {
  const [provider, setProvider] = useState('gemini');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await api.get('/ai/config');
      if (response.data) {
        setProvider(response.data.provider);
        setApiKey(response.data.apiKey || '');
        setModel(response.data.model || '');
      }
    } catch (error) {
      console.error('Error fetching config:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await api.post('/ai/config', {
        provider,
        apiKey,
        model,
        isActive: true,
      });
      setMessage({ type: 'success', text: 'Configuração salva com sucesso!' });
      
      // Clear success message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao salvar configuração.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-2xl font-black text-[color:var(--color-text)] tracking-tight flex items-center gap-3">
             <Bot size={36} className="text-purple-600" />
             Configuração de IA
           </h1>
           <p className="text-[color:var(--color-muted)] font-medium text-lg">Gerencie os provedores e chaves de API para análise de imagens.</p>
        </div>
      </div>

      <div className="max-w-2xl">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-8 space-y-6">
            
            {message && (
              <div className={`p-4 rounded-xl flex items-center gap-3 ${
                message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                <span className="font-bold">{message.text}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Provedor de IA</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setProvider('gemini')}
                  className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                    provider === 'gemini' 
                      ? 'border-purple-600 bg-purple-50 text-purple-700' 
                      : 'border-slate-100 bg-slate-50 text-[color:var(--color-muted)] hover:border-slate-200'
                  }`}
                >
                  <span className="font-black">Google Gemini</span>
                  <span className="text-xs opacity-70">Recomendado</span>
                </button>
                <button
                  onClick={() => { setProvider('openai'); setModel(''); }}
                  className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                    provider === 'openai' 
                      ? 'border-green-600 bg-green-50 text-green-700' 
                      : 'border-slate-100 bg-slate-50 text-[color:var(--color-muted)] hover:border-slate-200'
                  }`}
                >
                  <span className="font-black">OpenAI GPT-4</span>
                  <span className="text-xs opacity-70">Alta Precisão</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Key size={14} />
                Chave de API (API Key)
              </label>
              <input 
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="Ex: sk-..."
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[color:var(--color-text)] font-medium outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all"
              />
              <p className="text-xs text-slate-400">
                A chave será armazenada de forma segura. Para Gemini, obtenha no Google AI Studio.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Settings size={14} />
                Modelo de IA
              </label>
              <select 
                value={model}
                onChange={e => setModel(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[color:var(--color-text)] font-bold outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all appearance-none cursor-pointer"
                disabled={!apiKey}
              >
                <option value="">Selecione um modelo...</option>
                {modelsByProvider[provider]?.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <p className="text-xs text-slate-400">
                Selecione o modelo desejado para processamento das imagens.
              </p>
            </div>

            <div className="pt-4">
              <button 
                onClick={handleSave}
                disabled={loading || !apiKey}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white px-8 py-4 rounded-2xl font-black shadow-lg shadow-slate-200 hover:bg-slate-800 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Save size={20} />
                    Salvar Configuração
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default AiConfigView;
