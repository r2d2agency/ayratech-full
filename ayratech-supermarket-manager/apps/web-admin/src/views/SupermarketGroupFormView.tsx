import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useBranding } from '../context/BrandingContext';
import { ViewType } from '../types';
import api from '../api/client';

interface SupermarketGroupFormViewProps {
  onNavigate: (view: ViewType) => void;
}

const SupermarketGroupFormView: React.FC<SupermarketGroupFormViewProps> = ({ onNavigate }) => {
  const { settings } = useBranding();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name) {
        alert('Por favor, preencha o Nome da Rede.');
        return;
    }

    setLoading(true);
    try {
      await api.post('/supermarket-groups', { name });
      alert('Rede cadastrada com sucesso!');
      onNavigate('supermarket_groups_list');
    } catch (error: any) {
      console.error('Erro ao cadastrar:', error);
      alert('Erro ao salvar rede: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-500 max-w-2xl mx-auto">
       <div className="flex items-center gap-6 mb-10">
          <button onClick={() => onNavigate('supermarket_groups_list')} className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm hover:bg-slate-50 transition-all">
             <ChevronRight className="rotate-180" size={24} />
          </button>
          <div>
            <h1 className="text-xl font-black text-[color:var(--color-text)] tracking-tight">Nova Rede / Grupo</h1>
            <p className="text-[color:var(--color-muted)] font-bold">Cadastre uma nova rede de supermercados.</p>
          </div>
       </div>
       <div className="bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm">
          <div className="grid grid-cols-1 gap-8">
             <div>
                <label className="text-[11px] font-black text-slate-400 uppercase mb-3 block tracking-widest">Nome da Rede</label>
                <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-14 px-6 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:ring-4 focus:ring-blue-100 transition-all font-bold text-[color:var(--color-text)]" 
                    placeholder="Ex: Grupo Pão de Açúcar" 
                />
             </div>
          </div>
          <div className="mt-12 pt-10 border-t border-slate-100 flex justify-end gap-6">
             <button onClick={() => onNavigate('supermarket_groups_list')} className="px-8 py-4 font-black text-slate-400 hover:text-[color:var(--color-muted)] transition-all">Descartar</button>
             <button 
                disabled={loading}
                className="px-12 py-4 text-white font-black rounded-2xl shadow-2xl shadow-blue-200 hover:scale-105 transition-all disabled:opacity-50"
                style={{ backgroundColor: settings.primaryColor }}
                onClick={handleSubmit}
             >
               {loading ? 'Salvando...' : 'Salvar'}
             </button>
        </div>
     </div>
  </div>
  );
};

export default SupermarketGroupFormView;
