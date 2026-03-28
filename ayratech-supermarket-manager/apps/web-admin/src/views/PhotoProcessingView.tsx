import React, { useState, useEffect } from 'react';
import { Wand2, Check, XCircle, Square, CheckSquare, AlertTriangle } from 'lucide-react';
import api from '../api/client';
import { getImageUrl } from '../utils/image';

const PhotoProcessingView: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchPendingItems();
  }, []);

  const fetchPendingItems = async () => {
    setLoading(true);
    try {
      const res = await api.get('/ai/pending');
      setItems(res.data);
      // Automatically select all items that have a prompt
      const validIds = new Set(res.data.filter((i: any) => i.product?.analysisPrompt).map((i: any) => i.id));
      setSelectedIds(validIds as Set<string>);
    } catch (error) {
      console.error('Error fetching pending items', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const toggleSelectAll = () => {
    const validItems = items.filter(i => i.product?.analysisPrompt);
    if (selectedIds.size === validItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(validItems.map(i => i.id)));
    }
  };

  const handleAnalyzeBatch = async () => {
    if (selectedIds.size === 0) return;
    
    setProcessing(true);
    const ids = Array.from(selectedIds);
    try {
      const res = await api.post('/ai/analyze-batch', { ids });
      // Update local state based on results
      const results = res.data; // [{id, status, reason}]
      
      setItems(prev => prev.map(item => {
        const result = results.find((r: any) => r.id === item.id);
        if (result) {
            return { ...item, aiStatus: result.status, aiObservation: result.reason };
        }
        return item;
      }));
      
      // Clear processed from selection
      const newSelection = new Set(selectedIds);
      results.forEach((r: any) => newSelection.delete(r.id));
      setSelectedIds(newSelection);
      
      alert('Análise concluída!');
    } catch (error) {
      alert('Erro na análise em lote.');
    } finally {
      setProcessing(false);
    }
  };

  const validItemsCount = items.filter(i => i.product?.analysisPrompt).length;

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-2xl font-black text-[color:var(--color-text)] tracking-tight">Centro de Processamento de Fotos (IA)</h1>
           <p className="text-[color:var(--color-muted)] font-medium text-lg">Validação automática de execução no PDV.</p>
        </div>
        <div className="flex items-center gap-4">
            <button
                onClick={toggleSelectAll}
                className="text-sm font-bold text-[color:var(--color-muted)] hover:text-purple-600 flex items-center gap-2"
            >
                {selectedIds.size > 0 && selectedIds.size === validItemsCount ? (
                    <CheckSquare size={20} className="text-purple-600" />
                ) : (
                    <Square size={20} />
                )}
                Selecionar Todos ({validItemsCount})
            </button>
            <button 
              onClick={handleAnalyzeBatch}
              disabled={processing || selectedIds.size === 0}
              className="flex items-center gap-2 bg-purple-600 text-white px-8 py-3 rounded-2xl font-black shadow-xl shadow-purple-200 hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100"
            >
              <Wand2 size={20} />
              {processing ? 'Processando...' : `Analisar Selecionados (${selectedIds.size})`}
            </button>
        </div>
      </div>

      {items.length === 0 && !loading && (
        <div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
            <p className="text-[color:var(--color-muted)] font-medium">Nenhuma foto pendente de análise.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {items.map(item => {
            const hasPrompt = !!item.product?.analysisPrompt;
            const isSelected = selectedIds.has(item.id);
            
            return (
            <div 
                key={item.id} 
                className={`relative bg-white rounded-3xl border overflow-hidden shadow-sm transition-all ${
                    !hasPrompt ? 'opacity-60 border-slate-100' : 
                    isSelected ? 'border-purple-500 ring-2 ring-purple-100 shadow-md' : 'border-slate-200 hover:shadow-md'
                }`}
                onClick={() => hasPrompt && toggleSelection(item.id)}
            >
                {/* Selection Overlay/Checkbox */}
                <div className="absolute top-3 right-3 z-20">
                    {hasPrompt ? (
                        <div className={`rounded-lg p-1 transition-all ${isSelected ? 'bg-purple-600 text-white' : 'bg-white/80 text-slate-400 hover:text-purple-600'}`}>
                            {isSelected ? <CheckSquare size={24} /> : <Square size={24} />}
                        </div>
                    ) : (
                        <div className="bg-orange-100 text-orange-600 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1">
                            <AlertTriangle size={12} />
                            SEM PROMPT
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 h-48 pointer-events-none">
                    <div className="relative border-r border-slate-100 group">
                        <span className="absolute top-2 left-2 bg-black/50 text-white text-[10px] font-bold px-2 py-1 rounded-full z-10 backdrop-blur-md">Referência</span>
                        <img 
                            src={getImageUrl(item.product?.referenceImageUrl || item.product?.image)} 
                            className="w-full h-full object-cover" 
                            alt="Reference" 
                        />
                    </div>
                    <div className="relative group">
                        <span className="absolute top-2 left-2 bg-blue-500/80 text-white text-[10px] font-bold px-2 py-1 rounded-full z-10 backdrop-blur-md">PDV</span>
                        <img 
                            src={getImageUrl(item.photos?.[0])} 
                            className="w-full h-full object-cover" 
                            alt="PDV" 
                        />
                    </div>
                </div>
                <div className="p-5">
                    <div className="flex justify-between items-start mb-3 gap-2">
                        <h3 className="font-bold text-[color:var(--color-text)] line-clamp-1 text-sm" title={item.product?.name}>{item.product?.name}</h3>
                        <StatusBadge status={item.aiStatus} />
                    </div>
                    <p className="text-xs text-[color:var(--color-muted)] mb-3 flex items-center gap-1">
                        <span className="font-bold">{item.routeItem?.route?.promoter?.fullName || 'Promotor'}</span>
                        <span>•</span>
                        <span>{item.checkInTime ? new Date(item.checkInTime).toLocaleDateString() : '-'}</span>
                    </p>
                    
                    {item.aiObservation ? (
                        <div className={`text-xs p-3 rounded-xl ${item.aiStatus === 'OK' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                            {item.aiObservation}
                        </div>
                    ) : (
                         <div className="text-xs p-3 rounded-xl bg-slate-50 text-slate-400 border border-slate-100 italic">
                            {hasPrompt ? 'Aguardando análise...' : 'Configure o prompt do produto para analisar.'}
                        </div>
                    )}
                </div>
            </div>
        )})}
      </div>
    </div>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
    switch(status) {
        case 'OK': return <span className="bg-green-100 text-green-700 px-2 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 whitespace-nowrap"><Check size={10}/> OK</span>;
        case 'FLAGGED': return <span className="bg-red-100 text-red-700 px-2 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 whitespace-nowrap"><XCircle size={10}/> REVISAR</span>;
        default: return <span className="bg-slate-100 text-[color:var(--color-muted)] px-2 py-1 rounded-lg text-[10px] font-black whitespace-nowrap">PENDENTE</span>;
    }
}

export default PhotoProcessingView;
