import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash, X, Filter, CheckSquare, Square, Save, ArrowRight, ArrowLeft, ArrowRightLeft } from 'lucide-react';
import { useBranding } from '../context/BrandingContext';
import { ViewType, SupermarketGroup } from '../types';
// Verified Mix Implementation
import api from '../api/client';
import { SearchableSelect } from '../components/SearchableSelect';

interface SupermarketGroupsViewProps {
  onNavigate: (view: ViewType) => void;
}

const SupermarketGroupsView: React.FC<SupermarketGroupsViewProps> = ({ onNavigate }) => {
  const { settings } = useBranding();
  const [groups, setGroups] = useState<SupermarketGroup[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'mix'>('details');
  const [editingGroup, setEditingGroup] = useState<SupermarketGroup | null>(null);
  
  // Mix Filter State
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [selectedSearchTerm, setSelectedSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    status: true,
    productIds: [] as string[]
  });

  const fetchGroups = async () => {
    try {
      const response = await api.get('/supermarket-groups');
      setGroups(response.data);
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  const fetchDependencies = async () => {
    try {
      const [productsRes, brandsRes, categoriesRes] = await Promise.all([
        api.get('/products'),
        api.get('/brands'),
        api.get('/categories')
      ]);
      setProducts(productsRes.data);
      setBrands(brandsRes.data);
      setCategories(categoriesRes.data);
    } catch (error) {
      console.error('Error fetching dependencies:', error);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchGroups(), fetchDependencies()]);
      setLoading(false);
    };
    init();
  }, []);

  const resetForm = () => {
    setFormData({ name: '', status: true, productIds: [] });
    setEditingGroup(null);
    setActiveTab('details');
    setSelectedBrandId('');
    setSelectedCategoryId('');
    setProductSearchTerm('');
    setSelectedSearchTerm('');
  };

  const handleAddNew = () => {
    resetForm();
    setShowModal(true);
  };

  const handleEdit = (group: any) => {
    setEditingGroup(group);
    setFormData({
      name: group.name,
      status: group.status !== undefined ? group.status : true,
      productIds: group.products ? group.products.map((p: any) => p.id) : []
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este grupo?')) {
      try {
        await api.delete(`/supermarket-groups/${id}`);
        fetchGroups();
      } catch (error) {
        console.error('Error deleting group:', error);
        alert('Erro ao excluir grupo.');
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      alert('Por favor, preencha o Nome da Rede.');
      return;
    }

    try {
      if (editingGroup) {
        await api.patch(`/supermarket-groups/${editingGroup.id}`, formData);
        alert('Rede atualizada com sucesso!');
      } else {
        await api.post('/supermarket-groups', formData);
        alert('Rede criada com sucesso!');
      }
      setShowModal(false);
      resetForm();
      fetchGroups();
    } catch (error: any) {
      console.error('Error saving group:', error);
      const msg = error.response?.data?.message 
        ? (Array.isArray(error.response.data.message) ? error.response.data.message.join('\n') : error.response.data.message)
        : error.message;
      alert(`Erro ao salvar rede:\n${msg}`);
    }
  };

  const filteredGroups = groups.filter(group => 
    group.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const availableProducts = products.filter(p => {
    // Must NOT be selected
    if (formData.productIds.includes(p.id)) return false;
    
    // Apply filters
    if (selectedBrandId && p.brand?.id !== selectedBrandId) return false;
    if (selectedCategoryId && p.categoryRef?.id !== selectedCategoryId) return false;
    if (productSearchTerm) {
      const term = productSearchTerm.toLowerCase();
      const matchesName = p.name?.toLowerCase().includes(term);
      const matchesSku = p.sku?.toLowerCase().includes(term);
      if (!matchesName && !matchesSku) return false;
    }
    return true;
  });

  const selectedProductsList = products.filter(p => {
    // Must be selected
    if (!formData.productIds.includes(p.id)) return false;

    // Apply search filter (optional)
    if (selectedSearchTerm) {
      const term = selectedSearchTerm.toLowerCase();
      const matchesName = p.name?.toLowerCase().includes(term);
      const matchesSku = p.sku?.toLowerCase().includes(term);
      if (!matchesName && !matchesSku) return false;
    }
    return true;
  });

  const toggleProduct = (productId: string) => {
    setFormData(prev => {
      const exists = prev.productIds.includes(productId);
      if (exists) {
        return { ...prev, productIds: prev.productIds.filter(id => id !== productId) };
      } else {
        return { ...prev, productIds: [...prev.productIds, productId] };
      }
    });
  };

  const addAllVisible = () => {
    const newIds = [...formData.productIds];
    availableProducts.forEach(p => {
      if (!newIds.includes(p.id)) newIds.push(p.id);
    });
    setFormData(prev => ({ ...prev, productIds: newIds }));
  };

  const removeAllVisible = () => {
    const visibleIds = selectedProductsList.map(p => p.id);
    setFormData(prev => ({ 
      ...prev, 
      productIds: prev.productIds.filter(id => !visibleIds.includes(id)) 
    }));
  };

  return (
    <div className="animate-in fade-in duration-500 relative">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-xl font-black text-[color:var(--color-text)] tracking-tight">Redes / Grupos</h1>
          <p className="text-[color:var(--color-muted)] font-bold mt-1">Gerencie as redes de supermercados.</p>
        </div>
        <button 
          onClick={handleAddNew}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl text-white font-bold shadow-lg shadow-blue-200 hover:scale-105 transition-all"
          style={{ backgroundColor: settings.primaryColor }}
        >
          <Plus size={20} />
          Nova Rede
        </button>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text"
              placeholder="Buscar rede..."
              className="w-full h-12 pl-12 pr-4 bg-slate-50 rounded-xl border-none outline-none focus:ring-2 focus:ring-blue-100 transition-all font-bold text-[color:var(--color-text)] placeholder:text-slate-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
           <div className="p-10 text-center text-[color:var(--color-muted)]">Carregando...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-8 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Nome</th>
                  <th className="px-8 py-4 text-left text-[11px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-8 py-4 text-right text-[11px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredGroups.map((group) => (
                  <tr key={group.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-4 font-bold text-[color:var(--color-text)]">{group.name}</td>
                    <td className="px-8 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-black ${group.status ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {group.status ? 'ATIVO' : 'INATIVO'}
                      </span>
                    </td>
                    <td className="px-8 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleEdit(group)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        >
                          <Edit size={18} />
                        </button>
                        <button 
                            onClick={() => handleDelete(group.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Cadastro/Edição */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] w-full max-w-5xl shadow-2xl animate-in zoom-in-95 duration-200 h-[90vh] flex flex-col relative">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center rounded-t-[2rem] shrink-0">
              <div>
                <h2 className="text-2xl font-black text-[color:var(--color-text)]">
                  {editingGroup ? 'Editar Rede' : 'Nova Rede'}
                </h2>
                <p className="text-[color:var(--color-muted)] font-medium">Preencha os dados da rede</p>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={24} className="text-slate-400" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {/* Tabs */}
              <div className="px-8 border-b border-slate-100 flex gap-6 shrink-0 bg-white z-10">
                 <button
                   type="button"
                   onClick={() => setActiveTab('details')}
                   className={`py-4 text-sm font-black uppercase tracking-widest border-b-2 transition-all ${
                     activeTab === 'details' 
                       ? 'text-blue-600 border-blue-600' 
                       : 'text-slate-400 border-transparent hover:text-[color:var(--color-muted)]'
                   }`}
                 >
                   Dados Gerais
                 </button>
                 <button
                   type="button"
                   onClick={() => setActiveTab('mix')}
                   className={`py-4 text-sm font-black uppercase tracking-widest border-b-2 transition-all ${
                     activeTab === 'mix' 
                       ? 'text-blue-600 border-blue-600' 
                       : 'text-slate-400 border-transparent hover:text-[color:var(--color-muted)]'
                   }`}
                 >
                   Mix de Produtos
                 </button>
              </div>

              <div className="flex-1 min-h-0 overflow-hidden flex flex-col relative">
                {activeTab === 'details' ? (
                  <div className="overflow-y-auto p-8 space-y-8 h-full">
                    <div>
                       <label className="text-[11px] font-black text-slate-400 uppercase mb-3 block tracking-widest">Nome da Rede *</label>
                       <input 
                           type="text" 
                           value={formData.name}
                           onChange={(e) => setFormData({...formData, name: e.target.value})}
                           className="w-full h-14 px-6 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:ring-4 focus:ring-blue-100 transition-all font-bold text-[color:var(--color-text)]" 
                           placeholder="Ex: Grupo Pão de Açúcar"
                           required
                       />
                    </div>

                    <div>
                       <SearchableSelect
                         label="Status"
                         value={formData.status ? 'true' : 'false'}
                         onChange={(val) => setFormData({...formData, status: val === 'true'})}
                         options={[
                           { value: 'true', label: 'Ativo' },
                           { value: 'false', label: 'Inativo' }
                         ]}
                       />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col h-full p-4 space-y-4">
                    {/* Transfer List Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 h-full min-h-0">
                      
                      {/* Left: Available */}
                      <div className="flex flex-col h-full bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                        <div className="p-2 border-b border-slate-100 bg-white space-y-2 shrink-0">
                          <div className="flex justify-between items-center gap-2">
                             <div className="flex items-center gap-2">
                               <h3 className="font-bold text-[color:var(--color-text)] text-sm">Disponíveis</h3>
                               <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{availableProducts.length}</span>
                             </div>
                             <div className="relative w-40">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                                <input 
                                  type="text"
                                  placeholder="Buscar..."
                                  className="w-full h-8 pl-7 pr-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold text-[color:var(--color-muted)] outline-none focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400"
                                  value={productSearchTerm}
                                  onChange={(e) => setProductSearchTerm(e.target.value)}
                                />
                             </div>
                          </div>
                          
                          <div className="flex gap-2">
                            <div className="flex-1 min-w-0">
                              <SearchableSelect
                                value={selectedBrandId}
                                onChange={setSelectedBrandId}
                                options={[
                                  { value: '', label: 'Todas as Marcas' },
                                  ...brands.map(b => ({ value: b.id, label: b.name }))
                                ]}
                                placeholder="Marca"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <SearchableSelect
                                value={selectedCategoryId}
                                onChange={setSelectedCategoryId}
                                options={[
                                  { value: '', label: 'Todas as Categorias' },
                                  ...categories.map(c => ({ value: c.id, label: c.name }))
                                ]}
                                placeholder="Categoria"
                              />
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={addAllVisible}
                              disabled={availableProducts.length === 0}
                              className="flex-1 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-[10px] font-black hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                              <Plus size={12} />
                              Adicionar Todos
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const visibleIds = availableProducts.map(p => p.id);
                                setFormData(prev => ({
                                  ...prev,
                                  productIds: [...new Set([...prev.productIds, ...visibleIds])]
                                }));
                              }}
                              disabled={availableProducts.length === 0}
                              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                              title="Adicionar filtrados"
                            >
                              <ArrowRight size={12} />
                            </button>
                          </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-slate-50">
                          {availableProducts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                              <Search size={24} className="opacity-20" />
                              <p className="text-xs font-medium">Nenhum produto disponível</p>
                            </div>
                          ) : (
                            availableProducts.map(product => (
                              <div 
                                key={product.id}
                                className="bg-white p-2 rounded-lg border border-slate-100 flex items-center gap-2 hover:border-blue-200 transition-colors group relative"
                              >
                                {product.image ? (
                                  <img src={product.image} alt="" className="w-8 h-8 rounded-md object-cover bg-slate-100 shrink-0" />
                                ) : (
                                  <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center text-slate-400 text-[9px] font-bold shrink-0">IMG</div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="font-bold text-[color:var(--color-text)] text-xs truncate" title={product.name}>{product.name}</div>
                                  <div className="text-[9px] font-medium text-slate-400 truncate">
                                    {product.brand?.name || 'Sem Marca'} • {product.sku || 'S/ SKU'}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => toggleProduct(product.id)}
                                  className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-500 hover:text-white transition-all shrink-0 shadow-sm"
                                  title="Adicionar"
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Middle Arrow */}
                      <div className="flex items-center justify-center">
                        <div className="text-slate-300 lg:rotate-0 rotate-90">
                          <ArrowRightLeft size={20} />
                        </div>
                      </div>

                      {/* Right: Selected */}
                      <div className="flex flex-col h-full bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                        <div className="p-2 border-b border-slate-100 bg-white space-y-2 shrink-0">
                          <div className="flex justify-between items-center gap-2">
                             <div className="flex items-center gap-2">
                               <h3 className="font-bold text-[color:var(--color-text)] text-sm">Selecionados</h3>
                               <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{formData.productIds.length}</span>
                             </div>
                             <div className="relative w-40">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                                <input 
                                  type="text"
                                  placeholder="Buscar..."
                                  className="w-full h-8 pl-7 pr-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-bold text-[color:var(--color-muted)] outline-none focus:ring-2 focus:ring-red-100 transition-all placeholder:text-slate-400"
                                  value={selectedSearchTerm}
                                  onChange={(e) => setSelectedSearchTerm(e.target.value)}
                                />
                             </div>
                          </div>
                          
                          <div className="h-10"></div> {/* Spacer to align with left column brand select height */}
                          
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={removeAllVisible}
                              disabled={selectedProductsList.length === 0}
                              className="flex-1 py-1.5 rounded-lg bg-red-50 text-red-600 text-[10px] font-black hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                              <Trash size={12} />
                              Remover Todos
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const visibleIds = selectedProductsList.map(p => p.id);
                                setFormData(prev => ({
                                  ...prev,
                                  productIds: prev.productIds.filter(id => !visibleIds.includes(id))
                                }));
                              }}
                              disabled={selectedProductsList.length === 0}
                              className="px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                              title="Remover filtrados"
                            >
                              <ArrowLeft size={12} />
                            </button>
                          </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-slate-50">
                          {selectedProductsList.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                              <CheckSquare size={24} className="opacity-20" />
                              <p className="text-xs font-medium">Nenhum produto selecionado</p>
                            </div>
                          ) : (
                            selectedProductsList.map(product => (
                              <div 
                                key={product.id}
                                className="bg-white p-2 rounded-lg border border-slate-100 flex items-center gap-2 hover:border-red-200 transition-colors group relative"
                              >
                                {product.image ? (
                                  <img src={product.image} alt="" className="w-8 h-8 rounded-md object-cover bg-slate-100 shrink-0" />
                                ) : (
                                  <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center text-slate-400 text-[9px] font-bold shrink-0">IMG</div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="font-bold text-[color:var(--color-text)] text-xs truncate" title={product.name}>{product.name}</div>
                                  <div className="text-[9px] font-medium text-slate-400 truncate">
                                    {product.brand?.name || 'Sem Marca'} • {product.sku || 'S/ SKU'}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => toggleProduct(product.id)}
                                  className="w-6 h-6 rounded-md bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shrink-0 shadow-sm"
                                  title="Remover"
                                >
                                  <Trash size={14} />
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-8 pt-6 border-t border-slate-100 flex justify-end gap-4 bg-white rounded-b-[2rem] shrink-0 z-10">
                 <button 
                   type="button"
                   onClick={() => setShowModal(false)} 
                   className="px-6 py-3 font-bold text-[color:var(--color-muted)] hover:bg-slate-50 rounded-xl transition-all"
                 >
                   Cancelar
                 </button>
                 <button 
                   type="submit"
                   className="px-8 py-3 text-white font-black rounded-xl shadow-lg shadow-blue-200 hover:scale-105 transition-all flex items-center gap-2"
                   style={{ backgroundColor: settings.primaryColor }}
                 >
                   <Save size={20} />
                   {editingGroup ? 'Salvar Alterações' : 'Criar Rede'}
                 </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupermarketGroupsView;
