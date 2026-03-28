import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X, Search, ChevronRight } from 'lucide-react';
import { useBranding } from '../context/BrandingContext';
import api from '../api/client';

const CategoriesView: React.FC = () => {
  const { settings } = useBranding();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    parentId: ''
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await api.get('/categories');
      setCategories(response.data);
    } catch (error) {
      console.error("Error fetching categories:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...formData };
      if (!payload.parentId) delete (payload as any).parentId;

      if (editingCategory) {
        await api.patch(`/categories/${editingCategory.id}`, payload);
        alert('Categoria atualizada com sucesso!');
      } else {
        await api.post('/categories', payload);
        alert('Categoria criada com sucesso!');
      }
      setShowModal(false);
      resetForm();
      fetchCategories();
    } catch (error) {
      console.error("Error saving category:", error);
      alert('Erro ao salvar categoria.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta categoria?')) return;
    try {
      await api.delete(`/categories/${id}`);
      fetchCategories();
    } catch (error: any) {
      console.error("Error deleting category:", error);
      const message = error.response?.data?.message || 'Erro ao excluir categoria.';
      alert(message);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', parentId: '' });
    setEditingCategory(null);
  };

  const openEditModal = (category: any) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      parentId: category.parent?.id || ''
    });
    setShowModal(true);
  };

  // Helper to find all descendant IDs recursively
  const getDescendantIds = (categoryId: string, allCategories: any[]): string[] => {
    const category = allCategories.find(c => c.id === categoryId);
    if (!category || !category.children) return [];
    
    let ids: string[] = [];
    for (const child of category.children) {
      ids.push(child.id);
      ids = [...ids, ...getDescendantIds(child.id, allCategories)];
    }
    return ids;
  };

  // Helper to flatten categories for select dropdown (excluding self and children to avoid cycles)
  const getAvailableParents = () => {
    if (!editingCategory) return categories;
    const descendantIds = getDescendantIds(editingCategory.id, categories);
    return categories.filter(c => c.id !== editingCategory.id && !descendantIds.includes(c.id));
  };

  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-8">Carregando categorias...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-2xl font-black text-[color:var(--color-text)] tracking-tight">Categorias</h1>
          <p className="text-[color:var(--color-muted)] font-medium text-lg">Gerencie as categorias e subcategorias de produtos.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 text-white px-8 py-3 rounded-2xl font-black shadow-xl shadow-blue-200 hover:scale-105 transition-all"
          style={{ backgroundColor: settings.primaryColor }}
        >
          <Plus size={20} />
          Nova Categoria
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6 bg-slate-50/50 border-b border-slate-200">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar categorias..." 
              className="w-full pl-12 h-12 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-blue-100 transition-all text-sm font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">
                <th className="p-6">Nome</th>
                <th className="p-6">Categoria Pai</th>
                <th className="p-6">Descrição</th>
                <th className="p-6 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCategories.map(category => (
                <tr key={category.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="p-6 font-bold text-[color:var(--color-text)]">{category.name}</td>
                  <td className="p-6 text-[color:var(--color-muted)]">
                    {category.parent ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-50 text-blue-600 text-xs font-bold">
                        {category.parent.name}
                      </span>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                  <td className="p-6 text-[color:var(--color-muted)] text-sm">{category.description}</td>
                  <td className="p-6 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => openEditModal(category)}
                        className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-blue-500 transition-colors"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(category.id)}
                        className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCategories.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-slate-400">
                    Nenhuma categoria encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-black text-[color:var(--color-text)]">
                {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-[color:var(--color-muted)]">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[color:var(--color-muted)] uppercase mb-2">Nome</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all font-medium"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[color:var(--color-muted)] uppercase mb-2">Categoria Pai (Opcional)</label>
                <select
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all font-medium bg-white"
                  value={formData.parentId}
                  onChange={e => setFormData({...formData, parentId: e.target.value})}
                >
                  <option value="">Nenhuma (Raiz)</option>
                  {getAvailableParents().map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[color:var(--color-muted)] uppercase mb-2">Descrição</label>
                <textarea
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all font-medium resize-none"
                  rows={3}
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                />
              </div>

              <div className="flex justify-end pt-4 gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-3 text-[color:var(--color-muted)] font-bold hover:bg-slate-50 rounded-xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-8 py-3 text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:scale-105 transition-all"
                  style={{ backgroundColor: settings.primaryColor }}
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoriesView;
