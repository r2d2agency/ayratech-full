import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X, Search, Tag } from 'lucide-react';
import { useBranding } from '../context/BrandingContext';
import api from '../api/client';
import { SearchableSelect } from '../components/SearchableSelect';
import { SearchableMultiSelect } from '../components/SearchableMultiSelect';

const BrandsView: React.FC = () => {
  const { settings } = useBranding();
  const [brands, setBrands] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [checklistTemplates, setChecklistTemplates] = useState<any[]>([]);
  const [supermarkets, setSupermarkets] = useState<any[]>([]);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [promoters, setPromoters] = useState<any[]>([]);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState('');
  const [availablePromoterSearch, setAvailablePromoterSearch] = useState('');
  const [selectedPromoterSearch, setSelectedPromoterSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    clientId: '',
    waitForStockCount: false,
    stockNotificationContact: '',
    inventoryFrequency: '',
    inventoryFrequencyDays: '' as any,
    inventoryPostponeUntilWeekEnd: true,
    inventoryPostponeRequiresJustification: true,
    inventoryMaxPostponesPerWeek: 10 as any,
    checklistTemplateId: '',
    promoterIds: [] as string[],
    supermarketIds: [] as string[],
    availabilityWindows: [] as any[],
  });

  useEffect(() => {
    fetchBrands();
    fetchClients();
    fetchChecklistTemplates();
    fetchSupermarkets();
    fetchSupervisors();
  }, []);

  const fetchBrands = async () => {
    try {
      const response = await api.get('/brands');
      setBrands(response.data);
    } catch (error) {
      console.error("Error fetching brands:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const response = await api.get('/clients');
      setClients(response.data);
    } catch (error) {
      console.error("Error fetching clients:", error);
    }
  };

  const fetchChecklistTemplates = async () => {
    try {
      const response = await api.get('/checklists');
      setChecklistTemplates(response.data);
    } catch (error) {
      console.error("Error fetching checklist templates:", error);
    }
  };

  const fetchSupermarkets = async () => {
    try {
      const response = await api.get('/supermarkets');
      setSupermarkets(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Error fetching supermarkets:", error);
    }
  };

  const fetchSupervisors = async () => {
    try {
      const response = await api.get('/employees', { params: { role: 'supervisor' } });
      setSupervisors(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("Error fetching supervisors:", error);
    }
  };

  const fetchPromoters = async (supervisorId: string) => {
    try {
      if (!supervisorId) {
        setPromoters([]);
        return;
      }
      const response = await api.get('/employees', { params: { role: 'promotor', supervisorId } });
      const list = Array.isArray(response.data) ? response.data : [];
      setPromoters(list.filter((p: any) => !p.status || p.status === 'active'));
    } catch (error) {
      console.error("Error fetching promoters:", error);
      setPromoters([]);
    }
  };

  const normalizeAvailabilityWindows = (windows: any[] | undefined) => {
    const base = Array.from({ length: 7 }).map((_, dayOfWeek) => ({
      dayOfWeek,
      active: false,
      startTime: '08:00',
      endTime: '18:00',
    }));
    if (!Array.isArray(windows)) return base;
    const byDay = new Map(windows.map(w => [Number(w.dayOfWeek), w]));
    return base.map(w => {
      const existing = byDay.get(w.dayOfWeek);
      if (!existing) return w;
      return {
        dayOfWeek: w.dayOfWeek,
        active: existing.active !== false,
        startTime: existing.startTime || w.startTime,
        endTime: existing.endTime || w.endTime,
      };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!formData.clientId) {
        alert('Selecione um cliente para a marca.');
        return;
      }

      // Clean up payload
      const payload: any = { ...formData };
      
      // Ensure waitForStockCount is boolean
      payload.waitForStockCount = !!payload.waitForStockCount;

      if (payload.inventoryFrequencyDays === '') payload.inventoryFrequencyDays = undefined;
      if (payload.inventoryMaxPostponesPerWeek === '') payload.inventoryMaxPostponesPerWeek = undefined;
      if (!payload.checklistTemplateId) payload.checklistTemplateId = undefined;
      
      if (payload.name) {
        payload.name = payload.name.trim();
      }

      if (!payload.waitForStockCount) {
        payload.stockNotificationContact = '';
      }
      
      // If stockNotificationContact is empty string, send it as is (allowed by DTO) 
      // or consider sending null if backend supports it. 
      // For now, let's keep it as string but ensure it's trimmed if it's not empty.
      if (payload.stockNotificationContact) {
        payload.stockNotificationContact = payload.stockNotificationContact.trim();
      }

      console.log('Saving brand payload:', payload);

      if (editingBrand) {
        await api.patch(`/brands/${editingBrand.id}`, payload);
        alert('Marca atualizada com sucesso!');
      } else {
        await api.post('/brands', payload);
        alert('Marca criada com sucesso!');
      }
      setShowModal(false);
      resetForm();
      fetchBrands();
    } catch (error: any) {
      console.error("Error saving brand:", error);
      console.error("Error response data:", error.response?.data);
      
      let message = error.response?.data?.message || 'Erro ao salvar marca.';
      if (typeof message === 'object') {
        if (Array.isArray(message)) {
           message = message.join('\n');
        } else {
           message = JSON.stringify(message);
        }
      }
      alert(message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta marca?')) return;
    try {
      await api.delete(`/brands/${id}`);
      fetchBrands();
    } catch (error) {
      console.error("Error deleting brand:", error);
      alert('Erro ao excluir marca.');
    }
  };

  const resetForm = () => {
    setFormData({ 
      name: '', 
      clientId: '',
      waitForStockCount: false,
      stockNotificationContact: '',
      inventoryFrequency: '',
      inventoryFrequencyDays: '' as any,
      inventoryPostponeUntilWeekEnd: true,
      inventoryPostponeRequiresJustification: true,
      inventoryMaxPostponesPerWeek: 10 as any,
      checklistTemplateId: ''
      ,
      promoterIds: [],
      supermarketIds: [],
      availabilityWindows: normalizeAvailabilityWindows([]),
    });
    setEditingBrand(null);
    setSelectedSupervisorId('');
    setPromoters([]);
    setAvailablePromoterSearch('');
    setSelectedPromoterSearch('');
  };

  const openEditModal = (brand: any) => {
    console.log('Opening edit modal for brand:', brand);
    console.log('Brand client:', brand.client);
    console.log('Computed clientId:', brand.clientId || brand.client?.id || '');
    
    setEditingBrand(brand);
    setFormData({
      name: brand.name,
      clientId: brand.clientId || brand.client?.id || '',
      waitForStockCount: brand.waitForStockCount || false,
      stockNotificationContact: brand.stockNotificationContact || '',
      inventoryFrequency: brand.inventoryFrequency || '',
      inventoryFrequencyDays: brand.inventoryFrequencyDays ?? '' as any,
      inventoryPostponeUntilWeekEnd: brand.inventoryPostponeUntilWeekEnd !== false,
      inventoryPostponeRequiresJustification: brand.inventoryPostponeRequiresJustification !== false,
      inventoryMaxPostponesPerWeek: brand.inventoryMaxPostponesPerWeek ?? 10,
      checklistTemplateId: brand.checklistTemplateId || (brand.checklistTemplate ? brand.checklistTemplate.id : '')
      ,
      promoterIds: Array.isArray(brand.promoters) ? brand.promoters.map((p: any) => p.id) : [],
      supermarketIds: Array.isArray(brand.supermarkets) ? brand.supermarkets.map((s: any) => s.id) : [],
      availabilityWindows: normalizeAvailabilityWindows(brand.availabilityWindows),
    });
    setShowModal(true);
    setAvailablePromoterSearch('');
    setSelectedPromoterSearch('');
  };

  const filteredBrands = brands.filter(b => 
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (b.client?.nomeFantasia || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-8">Carregando marcas...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-2xl font-black text-[color:var(--color-text)] tracking-tight">Marcas</h1>
          <p className="text-[color:var(--color-muted)] font-medium text-lg">Gerencie as marcas de produtos.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-2 text-white px-8 py-3 rounded-2xl font-black shadow-xl shadow-blue-200 hover:scale-105 transition-all"
          style={{ backgroundColor: settings.primaryColor }}
        >
          <Plus size={20} />
          Nova Marca
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6 bg-slate-50/50 border-b border-slate-200">
          <div className="relative max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar marcas..." 
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
                <th className="p-6">Nome da Marca</th>
                <th className="p-6">Cliente Associado</th>
                <th className="p-6">Produtos</th>
                <th className="p-6 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBrands.map(brand => (
                <tr key={brand.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="p-6 font-bold text-[color:var(--color-text)] flex items-center gap-2">
                    <Tag size={16} className="text-slate-400" />
                    {brand.name}
                  </td>
                  <td className="p-6 text-[color:var(--color-muted)]">
                    {brand.client ? (
                      <span className="font-medium text-[color:var(--color-text)]">{brand.client.nomeFantasia || brand.client.razaoSocial}</span>
                    ) : (
                      <span className="text-slate-300 italic">Sem cliente</span>
                    )}
                    {brand.checklistTemplate && (
                        <div className="mt-1 flex items-center gap-1">
                            <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100">
                                Checklist: {brand.checklistTemplate.name}
                            </span>
                        </div>
                    )}
                  </td>
                  <td className="p-6 text-[color:var(--color-muted)]">
                    {brand.products?.length || 0} produtos
                  </td>
                  <td className="p-6 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => openEditModal(brand)}
                        className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-blue-500 transition-colors"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(brand.id)}
                        className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredBrands.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-slate-400">
                    Nenhuma marca encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-start sm:items-center justify-center z-50 p-4"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-black text-[color:var(--color-text)]">
                {editingBrand ? 'Editar Marca' : 'Nova Marca'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-[color:var(--color-muted)]">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-[color:var(--color-muted)] uppercase mb-2">Nome da Marca</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all font-medium"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="Ex: Nestlé"
                />
              </div>

              <div>
                <SearchableSelect
                  label="Cliente Associado"
                  required
                  placeholder="Selecione um cliente..."
                  value={formData.clientId}
                  onChange={(val) => setFormData({...formData, clientId: val})}
                  options={clients.map(c => ({
                    value: c.id,
                    label: c.nomeFantasia || c.razaoSocial
                  }))}
                />
                <p className="text-[10px] text-slate-400 mt-1 ml-1">A marca deve estar vinculada a um cliente (indústria).</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[color:var(--color-muted)] uppercase mb-2">Template de Checklist Padrão</label>
                <select
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all font-medium"
                  value={formData.checklistTemplateId}
                  onChange={e => setFormData({...formData, checklistTemplateId: e.target.value})}
                >
                  <option value="">Nenhum (Padrão do Sistema)</option>
                  {checklistTemplates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1 ml-1">Checklist que será aplicado aos produtos desta marca caso não tenham um específico.</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl space-y-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="waitForStockCount"
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    checked={formData.waitForStockCount}
                    onChange={e => setFormData({...formData, waitForStockCount: e.target.checked})}
                  />
                  <label htmlFor="waitForStockCount" className="text-sm font-bold text-[color:var(--color-text)] cursor-pointer">
                    Aguardar contagem de estoque
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[color:var(--color-muted)] uppercase mb-2">
                    Frequência de Inventário
                  </label>
                  <select
                    value={formData.inventoryFrequency || ''}
                    onChange={e => setFormData({...formData, inventoryFrequency: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all font-medium bg-white"
                  >
                    <option value="">Sempre (Padrão)</option>
                    <option value="daily">Diário (1x por dia)</option>
                    <option value="weekly">Semanal (1x por semana)</option>
                    <option value="biweekly">Quinzenal (1x a cada 15 dias)</option>
                    <option value="monthly">Mensal (1x por mês)</option>
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1 ml-1">
                    Define com que frequência o inventário deve ser preenchido obrigatoriamente.
                  </p>
                </div>
                
                {formData.waitForStockCount && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                    <label className="block text-xs font-bold text-[color:var(--color-muted)] uppercase mb-2">Contato para Notificação</label>
                    <input
                      type="text"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all font-medium"
                      value={formData.stockNotificationContact}
                      onChange={e => setFormData({...formData, stockNotificationContact: e.target.value})}
                      placeholder="Email ou telefone do responsável"
                    />
                    <p className="text-[10px] text-slate-400 mt-1 ml-1">
                      O promotor será instruído a aguardar até que este contato autorize a continuação.
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-white border border-slate-200 p-4 rounded-xl space-y-4">
                <h4 className="text-xs font-black text-[color:var(--color-muted)] uppercase tracking-widest">Regras de Inventário</h4>

                <div>
                  <label className="block text-xs font-bold text-[color:var(--color-muted)] uppercase mb-2">Dias (semanal/quizenal)</label>
                  <input
                    type="number"
                    min={1}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all font-medium"
                    value={formData.inventoryFrequencyDays}
                    onChange={e => setFormData({ ...formData, inventoryFrequencyDays: e.target.value === '' ? '' : parseInt(e.target.value, 10) })}
                    placeholder="Ex: 15"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      checked={formData.inventoryPostponeUntilWeekEnd}
                      onChange={e => setFormData({ ...formData, inventoryPostponeUntilWeekEnd: e.target.checked })}
                    />
                    <span className="text-sm font-bold text-[color:var(--color-text)]">Permitir prorrogar apenas até o fim da semana</span>
                  </label>

                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      checked={formData.inventoryPostponeRequiresJustification}
                      onChange={e => setFormData({ ...formData, inventoryPostponeRequiresJustification: e.target.checked })}
                    />
                    <span className="text-sm font-bold text-[color:var(--color-text)]">Exigir justificativa ao prorrogar</span>
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[color:var(--color-muted)] uppercase mb-2">Máx. prorrogações por semana</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all font-medium"
                    value={formData.inventoryMaxPostponesPerWeek}
                    onChange={e => setFormData({ ...formData, inventoryMaxPostponesPerWeek: e.target.value === '' ? '' : parseInt(e.target.value, 10) })}
                    placeholder="Ex: 10"
                  />
                </div>
              </div>

              <div className="bg-white border border-slate-200 p-4 rounded-xl space-y-3">
                <h4 className="text-xs font-black text-[color:var(--color-muted)] uppercase tracking-widest">PDVs da Marca</h4>
                <SearchableMultiSelect
                  label="Selecionar PDVs"
                  value={formData.supermarketIds}
                  onChange={(vals) => setFormData({ ...formData, supermarketIds: vals })}
                  options={supermarkets.map((s: any) => ({
                    value: s.id,
                    label: `${s.fantasyName || s.name || 'PDV'} - ${s.city || ''}`,
                  }))}
                  placeholder="Selecione..."
                />
              </div>

              <div className="bg-white border border-slate-200 p-4 rounded-xl space-y-3">
                <h4 className="text-xs font-black text-[color:var(--color-muted)] uppercase tracking-widest">Horários da Marca</h4>
                <div className="space-y-2">
                  {(formData.availabilityWindows || []).map((w: any) => {
                    const labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                    return (
                      <div key={w.dayOfWeek} className="flex items-center gap-3">
                        <label className="flex items-center gap-2 w-16">
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            checked={!!w.active}
                            onChange={e => {
                              const next = (formData.availabilityWindows || []).map((x: any) =>
                                x.dayOfWeek === w.dayOfWeek ? { ...x, active: e.target.checked } : x,
                              );
                              setFormData({ ...formData, availabilityWindows: next });
                            }}
                          />
                          <span className="text-xs font-bold text-[color:var(--color-text)]">{labels[w.dayOfWeek] || w.dayOfWeek}</span>
                        </label>
                        <input
                          type="time"
                          className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold text-[color:var(--color-text)] w-28"
                          value={w.startTime || '08:00'}
                          disabled={!w.active}
                          onChange={e => {
                            const next = (formData.availabilityWindows || []).map((x: any) =>
                              x.dayOfWeek === w.dayOfWeek ? { ...x, startTime: e.target.value } : x,
                            );
                            setFormData({ ...formData, availabilityWindows: next });
                          }}
                        />
                        <span className="text-xs text-slate-400 font-bold">até</span>
                        <input
                          type="time"
                          className="px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold text-[color:var(--color-text)] w-28"
                          value={w.endTime || '18:00'}
                          disabled={!w.active}
                          onChange={e => {
                            const next = (formData.availabilityWindows || []).map((x: any) =>
                              x.dayOfWeek === w.dayOfWeek ? { ...x, endTime: e.target.value } : x,
                            );
                            setFormData({ ...formData, availabilityWindows: next });
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white border border-slate-200 p-4 rounded-xl space-y-4">
                <h4 className="text-xs font-black text-[color:var(--color-muted)] uppercase tracking-widest">Promotores da Marca</h4>
                <SearchableSelect
                  label="Supervisor (para filtrar)"
                  placeholder="Selecione..."
                  value={selectedSupervisorId}
                  onChange={(val) => {
                    setSelectedSupervisorId(val);
                    fetchPromoters(val);
                  }}
                  options={supervisors.map((s: any) => ({
                    value: s.id,
                    label: s.fullName || s.name || s.email || 'Supervisor',
                  }))}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="p-3 bg-slate-50 border-b border-slate-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black text-[color:var(--color-muted)] uppercase">Disponíveis</p>
                        <span className="text-[10px] font-bold text-[color:var(--color-muted)] bg-slate-200 px-2 py-0.5 rounded-full">
                          {promoters.filter((p: any) => !formData.promoterIds.includes(p.id)).length}
                        </span>
                      </div>
                      <input
                        type="text"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium outline-none focus:ring-4 focus:ring-blue-50"
                        placeholder="Buscar..."
                        value={availablePromoterSearch}
                        onChange={e => setAvailablePromoterSearch(e.target.value)}
                      />
                    </div>
                    <div className="max-h-56 overflow-y-auto p-2 space-y-1 bg-white">
                      {promoters
                        .filter((p: any) => !formData.promoterIds.includes(p.id))
                        .filter((p: any) => (p.fullName || p.name || '').toLowerCase().includes(availablePromoterSearch.toLowerCase()))
                        .map((p: any) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setFormData({ ...formData, promoterIds: [...formData.promoterIds, p.id] })}
                            className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                          >
                            <p className="text-xs font-bold text-[color:var(--color-text)] truncate">{p.fullName || p.name}</p>
                            <p className="text-[10px] text-slate-400 truncate">{p.email || ''}</p>
                          </button>
                        ))}
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="p-3 bg-slate-50 border-b border-slate-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black text-[color:var(--color-muted)] uppercase">Selecionados</p>
                        <span className="text-[10px] font-bold text-[color:var(--color-muted)] bg-slate-200 px-2 py-0.5 rounded-full">
                          {formData.promoterIds.length}
                        </span>
                      </div>
                      <input
                        type="text"
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium outline-none focus:ring-4 focus:ring-blue-50"
                        placeholder="Buscar..."
                        value={selectedPromoterSearch}
                        onChange={e => setSelectedPromoterSearch(e.target.value)}
                      />
                    </div>
                    <div className="max-h-56 overflow-y-auto p-2 space-y-1 bg-white">
                      {formData.promoterIds
                        .map((id: string) => {
                          const fromLoaded = promoters.find((p: any) => p.id === id);
                          const fromBrand = editingBrand?.promoters?.find((p: any) => p.id === id);
                          return fromLoaded || fromBrand || { id, fullName: id };
                        })
                        .filter((p: any) => (p.fullName || p.name || '').toLowerCase().includes(selectedPromoterSearch.toLowerCase()))
                        .map((p: any) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => setFormData({ ...formData, promoterIds: formData.promoterIds.filter(pid => pid !== p.id) })}
                            className="w-full text-left px-3 py-2 rounded-lg border border-slate-200 hover:border-red-300 hover:bg-red-50 transition-colors"
                          >
                            <p className="text-xs font-bold text-[color:var(--color-text)] truncate">{p.fullName || p.name}</p>
                            <p className="text-[10px] text-slate-400 truncate">{p.email || ''}</p>
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
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

export default BrandsView;
