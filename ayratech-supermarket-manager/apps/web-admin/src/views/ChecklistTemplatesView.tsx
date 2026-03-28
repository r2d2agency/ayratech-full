import React, { useState, useEffect } from 'react';
import { Search, Plus, X, Edit, Trash, Check, CheckSquare, Image as ImageIcon, Calendar, DollarSign, Package } from 'lucide-react';
import { useBranding } from '../context/BrandingContext';
import api from '../api/client';

interface ChecklistItem {
  id?: string;
  description: string;
  type: 'SIMPLE' | 'PHOTO' | 'VALIDITY_CHECK' | 'PRICE_CHECK' | 'STOCK_COUNT';
  isMandatory: boolean;
  order: number;
  competitorId?: string;
  competitorIds?: string[];
}

interface ChecklistTemplate {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  items: ChecklistItem[];
}

const ChecklistTemplatesView: React.FC = () => {
  const { settings } = useBranding();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ChecklistTemplate | null>(null);
  
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formItems, setFormItems] = useState<ChecklistItem[]>([]);

  // Competitor Quick Add State
  const [showCompetitorModal, setShowCompetitorModal] = useState(false);
  const [newCompetitorName, setNewCompetitorName] = useState('');

  useEffect(() => {
    fetchTemplates();
    fetchCompetitors();
  }, []);

  const fetchCompetitors = async () => {
    try {
      const res = await api.get('/competitors');
      setCompetitors(res.data.filter((c: any) => c.active));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await api.get('/checklists');
      setTemplates(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (template?: ChecklistTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormName(template.name);
      setFormDescription(template.description || '');
      const items = template.items.map((item: any) => ({
        ...item,
        competitorIds: item.competitors ? item.competitors.map((c: any) => c.id) : (item.competitorId ? [item.competitorId] : [])
      }));
      setFormItems([...items.sort((a: any, b: any) => a.order - b.order)]);
    } else {
      setEditingTemplate(null);
      setFormName('');
      setFormDescription('');
      setFormItems([]);
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingTemplate(null);
    setFormName('');
    setFormDescription('');
    setFormItems([]);
  };

  const addItem = () => {
    setFormItems([
      ...formItems,
      {
        description: '',
        type: 'SIMPLE',
        isMandatory: false,
        order: formItems.length
      }
    ]);
  };

  const updateItem = (index: number, field: keyof ChecklistItem, value: any) => {
    const newItems = [...formItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormItems(newItems);
  };

  const removeItem = (index: number) => {
    const newItems = formItems.filter((_, i) => i !== index);
    // Reorder
    newItems.forEach((item, i) => item.order = i);
    setFormItems(newItems);
  };

  const handleCreateCompetitor = async () => {
    if (!newCompetitorName.trim()) return;
    try {
      await api.post('/competitors', { name: newCompetitorName, active: true });
      await fetchCompetitors();
      setNewCompetitorName('');
      setShowCompetitorModal(false);
    } catch (err) {
      console.error(err);
      alert('Erro ao criar concorrente');
    }
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      alert('Nome é obrigatório');
      return;
    }

    // Validate items
    for (const item of formItems) {
      if (!item.description.trim()) {
        alert('Todos os itens devem ter descrição');
        return;
      }
    }

    const payload = {
      name: formName,
      description: formDescription,
      active: true,
      items: formItems.map(({ id, ...rest }) => rest) // Remove IDs for update/create to ensure clean state
    };

    try {
      if (editingTemplate) {
        await api.patch(`/checklists/${editingTemplate.id}`, payload);
      } else {
        await api.post('/checklists', payload);
      }
      fetchTemplates();
      closeModal();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar checklist');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este modelo?')) return;
    try {
      await api.delete(`/checklists/${id}`);
      fetchTemplates();
    } catch (err) {
      console.error(err);
      alert('Erro ao excluir checklist');
    }
  };

  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[color:var(--color-text)] tracking-tight">
            Checklists
          </h1>
          <p className="text-[color:var(--color-muted)] mt-1">
            Gerencie modelos de checklist para validação de produtos
          </p>
        </div>
        
        <button 
          onClick={() => openModal()}
          className={`
            group flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:scale-105 active:scale-95
          `}
          style={{ backgroundColor: settings.primaryColor }}
        >
          <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
          Novo Modelo
        </button>
      </div>

      {/* Search */}
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
        <input 
          type="text"
          placeholder="Buscar modelos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-white rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium text-[color:var(--color-muted)] placeholder:text-slate-400"
        />
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map(template => (
          <div key={template.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all group relative overflow-hidden">
             <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: settings.primaryColor }} />
             
             <div className="flex justify-between items-start mb-4">
               <div>
                 <h3 className="font-bold text-lg text-[color:var(--color-text)]">{template.name}</h3>
                 <p className="text-sm text-[color:var(--color-muted)] line-clamp-2">{template.description || 'Sem descrição'}</p>
               </div>
               <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                 <button 
                   onClick={() => openModal(template)}
                   className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
                 >
                   <Edit size={18} />
                 </button>
                 <button 
                   onClick={() => handleDelete(template.id)}
                   className="p-2 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
                 >
                   <Trash size={18} />
                 </button>
               </div>
             </div>

             <div className="space-y-2 mt-4">
               <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Itens ({template.items.length})</div>
               {template.items.slice(0, 3).map((item, idx) => (
                 <div key={idx} className="flex items-center gap-2 text-sm text-[color:var(--color-muted)]">
                    {item.type === 'SIMPLE' && <CheckSquare size={14} className="text-slate-400" />}
                    {item.type === 'PHOTO' && <ImageIcon size={14} className="text-blue-400" />}
                    {item.type === 'VALIDITY_CHECK' && <Calendar size={14} className="text-orange-400" />}
                    {item.type === 'PRICE_CHECK' && <DollarSign size={14} className="text-green-400" />}
                    {item.type === 'STOCK_COUNT' && <Package size={14} className="text-purple-400" />}
                    <span className="truncate">{item.description}</span>
                 </div>
               ))}
               {template.items.length > 3 && (
                 <div className="text-xs text-slate-400 italic">...e mais {template.items.length - 3} itens</div>
               )}
             </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showCompetitorModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 animate-in zoom-in-95">
            <h3 className="font-bold text-lg text-[color:var(--color-text)] mb-4">Novo Concorrente</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[color:var(--color-muted)] mb-1">Nome da Marca</label>
                <input 
                  type="text"
                  autoFocus
                  value={newCompetitorName}
                  onChange={(e) => setNewCompetitorName(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500"
                  placeholder="Ex: Coca-Cola"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button 
                  onClick={() => setShowCompetitorModal(false)}
                  className="px-4 py-2 text-[color:var(--color-muted)] hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleCreateCompetitor}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-black text-[color:var(--color-text)]">
                {editingTemplate ? 'Editar Checklist' : 'Novo Checklist'}
              </h2>
              <button 
                onClick={closeModal}
                className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-[color:var(--color-muted)] hover:bg-slate-50 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[color:var(--color-muted)] mb-1">Nome do Modelo</label>
                  <input 
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 transition-all"
                    placeholder="Ex: Validação de Laticínios"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[color:var(--color-muted)] mb-1">Descrição (Opcional)</label>
                  <textarea 
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 transition-all resize-none h-20"
                    placeholder="Detalhes sobre este checklist..."
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-[color:var(--color-muted)] uppercase tracking-wider">Itens do Checklist</label>
                  <button 
                    onClick={addItem}
                    className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Plus size={14} /> Adicionar Item
                  </button>
                </div>

                <div className="space-y-3">
                  {formItems.map((item, index) => (
                    <div key={index} className="flex items-start gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100 group">
                      <div className="mt-2.5 text-slate-300 font-bold text-xs w-4">{index + 1}</div>
                      
                      <div className="flex-1 space-y-2">
                        <input 
                          type="text"
                          value={item.description}
                          onChange={(e) => updateItem(index, 'description', e.target.value)}
                          placeholder="O que deve ser verificado?"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500"
                        />
                        
                        <div className="flex gap-2">
                          <select
                            value={item.type}
                            onChange={(e) => updateItem(index, 'type', e.target.value)}
                            className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500 text-[color:var(--color-muted)]"
                          >
                            <option value="SIMPLE">Simples Conferência</option>
                            <option value="PHOTO">Exigir Foto</option>
                            <option value="VALIDITY_CHECK">Verificar Validade</option>
                            <option value="PRICE_CHECK">Pesquisa de Preço</option>
                            <option value="STOCK_COUNT">Contagem de Estoque</option>
                          </select>

                          {item.type === 'PRICE_CHECK' && (
                            <div className="flex gap-2 flex-1">
                              <div className="flex flex-col gap-2 flex-1 min-w-[200px]">
                                <div className="flex flex-wrap gap-1">
                                  {(item.competitorIds || []).map(id => {
                                     const comp = competitors.find(c => c.id === id);
                                     if (!comp) return null;
                                     return (
                                       <span key={id} className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-md text-xs flex items-center gap-1">
                                         {comp.name}
                                         <button onClick={() => {
                                            const newIds = (item.competitorIds || []).filter(i => i !== id);
                                            updateItem(index, 'competitorIds', newIds);
                                         }} className="hover:text-blue-900"><X size={12}/></button>
                                       </span>
                                     );
                                  })}
                                </div>
                                <select 
                                  value=""
                                  onChange={(e) => {
                                     if (!e.target.value) return;
                                     const newIds = [...(item.competitorIds || []), e.target.value];
                                     updateItem(index, 'competitorIds', newIds);
                                  }}
                                  className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-blue-500 text-[color:var(--color-muted)] w-full"
                                >
                                  <option value="">Adicionar Concorrente...</option>
                                  {competitors.filter(c => !(item.competitorIds || []).includes(c.id)).map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                  ))}
                                </select>
                              </div>
                              <button
                                onClick={() => setShowCompetitorModal(true)}
                                className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                title="Novo Concorrente"
                              >
                                <Plus size={16} />
                              </button>
                            </div>
                          )}

                          <label className="flex items-center gap-2 px-2 py-1.5 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                            <input 
                              type="checkbox"
                              checked={item.isMandatory}
                              onChange={(e) => updateItem(index, 'isMandatory', e.target.checked)}
                              className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <span className="text-xs text-[color:var(--color-muted)] font-medium">Obrigatório</span>
                          </label>
                        </div>
                      </div>

                      <button 
                        onClick={() => removeItem(index)}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors mt-1"
                      >
                        <Trash size={16} />
                      </button>
                    </div>
                  ))}
                  
                  {formItems.length === 0 && (
                    <div className="text-center py-8 text-slate-400 text-sm bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                      Nenhum item adicionado ainda.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button 
                onClick={closeModal}
                className="px-5 py-2.5 text-[color:var(--color-muted)] font-bold hover:bg-slate-200 rounded-xl transition-colors text-sm"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave}
                className="px-6 py-2.5 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all text-sm flex items-center gap-2"
                style={{ backgroundColor: settings.primaryColor }}
              >
                <Check size={18} />
                Salvar Modelo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChecklistTemplatesView;
