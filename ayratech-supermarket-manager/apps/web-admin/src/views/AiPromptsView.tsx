import React, { useState, useEffect } from 'react';
import { Plus, Save, Trash2, FileText, Check, AlertCircle } from 'lucide-react';
import api from '../api/client';

interface AiPrompt {
  id: string;
  name: string;
  content: string;
  type: string;
  createdAt: string;
  supportsImageAnalysis?: boolean;
}

const AiPromptsView: React.FC = () => {
  const [prompts, setPrompts] = useState<AiPrompt[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<Partial<AiPrompt> | null>(null);

  useEffect(() => {
    fetchPrompts();
  }, []);

  const fetchPrompts = async () => {
    setLoading(true);
    try {
      // Assuming there is an endpoint to list all prompts, otherwise we might need to implement it in backend
      // For now, I'll assume we can list them or at least get by name. 
      // Since the controller only has getPrompt(:name), I might need to add a list endpoint.
      // But let's check if there is a general get. 
      // The controller has @Get('prompts/:name').
      // I should add @Get('prompts') to the controller to list all.
      // For now, let's implement the UI and assume the backend will support it.
      const res = await api.get('/ai/prompts'); 
      setPrompts(res.data);
    } catch (error) {
      console.error('Error fetching prompts', error);
      // Fallback for demo if endpoint doesn't exist yet
      // setPrompts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!editingPrompt?.id) return;
    
    if (!confirm('Tem certeza que deseja excluir este prompt?')) return;

    setLoading(true);
    try {
      await api.delete(`/ai/prompts/${editingPrompt.id}`);
      setMessage({ type: 'success', text: 'Prompt excluído com sucesso!' });
      setEditingPrompt(null);
      fetchPrompts();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error deleting prompt', error);
      setMessage({ type: 'error', text: 'Erro ao excluir prompt.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editingPrompt || !editingPrompt.name || !editingPrompt.content) {
      setMessage({ type: 'error', text: 'Preencha todos os campos obrigatórios.' });
      return;
    }

    setLoading(true);
    try {
      if (editingPrompt.id) {
        await api.put(`/ai/prompts/${editingPrompt.id}`, editingPrompt);
        setMessage({ type: 'success', text: 'Prompt atualizado com sucesso!' });
      } else {
        await api.post('/ai/prompts', editingPrompt);
        setMessage({ type: 'success', text: 'Prompt salvo com sucesso!' });
      }
      setEditingPrompt(null);
      fetchPrompts();
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error saving prompt', error);
      setMessage({ type: 'error', text: 'Erro ao salvar prompt.' });
    } finally {
      setLoading(false);
    }
  };

  const handleNew = () => {
    setEditingPrompt({
      name: '',
      content: '',
      type: 'product_analysis'
    });
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
           <h1 className="text-2xl font-black text-[color:var(--color-text)] tracking-tight">Prompts de IA</h1>
           <p className="text-[color:var(--color-muted)] font-medium text-lg">Gerencie as instruções para os assistentes de IA.</p>
        </div>
        {!editingPrompt && (
          <button 
            onClick={handleNew}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
          >
            <Plus size={20} />
            Novo Prompt
          </button>
        )}
      </div>

      {message && (
        <div className={`p-4 rounded-xl flex items-center gap-3 ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
          <span className="font-medium">{message.text}</span>
        </div>
      )}

      {editingPrompt ? (
        <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm max-w-4xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-[color:var(--color-text)]">
              {editingPrompt.id ? 'Editar Prompt' : 'Novo Prompt'}
            </h2>
            <button 
              onClick={() => setEditingPrompt(null)}
              className="text-slate-400 hover:text-[color:var(--color-muted)] font-bold text-sm"
            >
              Cancelar
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-[color:var(--color-text)] mb-2">Nome do Prompt (Identificador)</label>
              <input
                type="text"
                value={editingPrompt.name}
                onChange={e => setEditingPrompt({...editingPrompt, name: e.target.value})}
                placeholder="Ex: analise_produto_padrao"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono text-sm"
              />
              <p className="text-xs text-slate-400 mt-1">Usado para identificar este prompt no código.</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-[color:var(--color-text)] mb-2">Tipo</label>
              <select
                value={editingPrompt.type}
                onChange={e => setEditingPrompt({...editingPrompt, type: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              >
                <option value="product_analysis">Análise de Produto</option>
                <option value="description_generation">Geração de Descrição</option>
                <option value="general">Geral</option>
              </select>
            </div>

            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <input
                type="checkbox"
                id="supportsImageAnalysis"
                checked={editingPrompt.supportsImageAnalysis !== false}
                onChange={e => setEditingPrompt({...editingPrompt, supportsImageAnalysis: e.target.checked})}
                className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="supportsImageAnalysis" className="cursor-pointer">
                <span className="block font-bold text-[color:var(--color-text)]">Analisar Imagem</span>
                <span className="text-xs text-[color:var(--color-muted)]">Habilitar envio de imagem para a IA junto com este prompt.</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-bold text-[color:var(--color-text)] mb-2">Conteúdo / Instruções</label>
              <textarea
                value={editingPrompt.content}
                onChange={e => setEditingPrompt({...editingPrompt, content: e.target.value})}
                placeholder="Instruções detalhadas para a IA..."
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all h-64 font-mono text-sm leading-relaxed"
              />
            </div>

            <div className="flex justify-end pt-4 gap-3">
              {editingPrompt.id && (
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="flex items-center gap-2 bg-red-100 text-red-700 px-6 py-3 rounded-xl font-bold hover:bg-red-200 transition-all disabled:opacity-50"
                >
                  <Trash2 size={20} />
                  Excluir
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex items-center gap-2 bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 transition-all disabled:opacity-50"
              >
                {loading ? 'Salvando...' : (
                  <>
                    <Save size={20} />
                    Salvar Prompt
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {prompts.map(prompt => (
            <div 
              key={prompt.id} 
              className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
              onClick={() => setEditingPrompt(prompt)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl group-hover:bg-blue-100 transition-colors">
                  <FileText size={24} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-[color:var(--color-muted)] px-2 py-1 rounded-lg">
                  {prompt.type}
                </span>
              </div>
              <h3 className="font-bold text-lg text-[color:var(--color-text)] mb-2">{prompt.name}</h3>
              <p className="text-[color:var(--color-muted)] text-sm line-clamp-3 font-mono bg-slate-50 p-3 rounded-xl border border-slate-100">
                {prompt.content}
              </p>
              <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400">
                <span>Atualizado em {new Date(prompt.createdAt).toLocaleDateString()}</span>
                {prompt.supportsImageAnalysis !== false && (
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md font-bold text-[10px]">
                        IMAGEM
                    </span>
                )}
              </div>
            </div>
          ))}
          
          {prompts.length === 0 && !loading && (
            <div className="col-span-full text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
              <p className="text-[color:var(--color-muted)] font-medium">Nenhum prompt configurado.</p>
              <button 
                onClick={handleNew}
                className="text-blue-600 font-bold mt-2 hover:underline"
              >
                Criar o primeiro
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AiPromptsView;
