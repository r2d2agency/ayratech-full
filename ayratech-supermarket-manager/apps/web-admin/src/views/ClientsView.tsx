import React, { useState, useEffect } from 'react';
import { Plus, X, Trash2, Edit, Eye, Store, Package } from 'lucide-react';
import { useBranding } from '../context/BrandingContext';
// Verified Modal Fix
import api from '../api/client';
import { getImageUrl } from '../utils/image';
import { SearchableSelect } from '../components/SearchableSelect';

const ClientsView: React.FC = () => {
  const { settings } = useBranding();
  const [activeTab, setActiveTab] = useState<'clients' | 'templates'>('clients');
  const [clients, setClients] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showContractModal, setShowContractModal] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [editingClient, setEditingClient] = useState<string | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkClient, setLinkClient] = useState<any | null>(null);
  const [availableSupermarkets, setAvailableSupermarkets] = useState<any[]>([]);
  const [selectedSupermarketIds, setSelectedSupermarketIds] = useState<string[]>([]);
  const [leftSearch, setLeftSearch] = useState('');
  const [leftStateFilter, setLeftStateFilter] = useState('');
  const [leftCityFilter, setLeftCityFilter] = useState('');
  const [rightSearch, setRightSearch] = useState('');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsClient, setDetailsClient] = useState<any | null>(null);
  const [detailsTab, setDetailsTab] = useState<'products' | 'pdvs'>('products');
  const [searchTerm, setSearchTerm] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  
  // Supermarket Groups for Link Modal
  const [supermarketGroups, setSupermarketGroups] = useState<any[]>([]);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('');

  // Client Form State
  const [newClient, setNewClient] = useState({
    razaoSocial: '',
    nomeFantasia: '',
    cnpj: '',
    emailPrincipal: '',
    telefonePrincipal: '',
    status: 'ativo',
    logradouro: '',
    numero: '',
    bairro: '',
    cidade: '',
    estado: '',
    cep: '',
    logo: '',
    password: '',
    photoConfig: {
      labels: { before: '', storage: '', after: '' },
      categories: {} as Record<string, any>
    },
    defaultVisitChecklistTemplateId: '',
    defaultInventoryChecklistTemplateId: '',
    requiresInventoryCount: true,
    locationRange: 500,
    inventoryFrequency: ''
  });

  // Contract Form State
  const [newContract, setNewContract] = useState({
    clientId: '',
    templateId: '',
    description: '',
    startDate: '',
    endDate: '',
    value: 0
  });

  // Template Form State
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    content: ''
  });

  useEffect(() => {
    fetchClients();
    fetchTemplates();
  }, []);

  const openDetailsModal = (client: any) => {
    setDetailsClient(client);
    setDetailsTab('products');
    setShowDetailsModal(true);
  };

  const openLinkModal = async (client: any) => {
    setLinkClient(client);
    setSelectedSupermarketIds((client.supermarkets || []).map((s: any) => s.id));
    try {
      const [resSupermarkets, resGroups] = await Promise.all([
        api.get('/supermarkets'),
        api.get('/supermarket-groups')
      ]);
      setAvailableSupermarkets(resSupermarkets.data);
      setSupermarketGroups(resGroups.data);
      setShowLinkModal(true);
    } catch (e) {
      console.error('Failed to fetch supermarkets or groups', e);
    }
  };

  const addToSelected = (id: string) => {
    setSelectedSupermarketIds(prev => prev.includes(id) ? prev : [...prev, id]);
  };
  const removeFromSelected = (id: string) => {
    setSelectedSupermarketIds(prev => prev.filter(sid => sid !== id));
  };
  const saveLinks = async () => {
    if (!linkClient) return;
    try {
      await api.patch(`/clients/${linkClient.id}`, { supermarketIds: selectedSupermarketIds });
      alert('Vínculos atualizados com sucesso!');
      setShowLinkModal(false);
      setLinkClient(null);
      fetchClients();
    } catch (error: any) {
      console.error('Error updating links', error);
      const msg = error.response?.data?.message || error.message;
      alert(`Erro ao atualizar vínculos:\n${msg}`);
    }
  };
  const fetchTemplates = async () => {
    try {
      const response = await api.get('/contract-templates');
      setTemplates(response.data);
    } catch (error) {
      console.error("Failed to fetch templates", error);
    }
  };

  const fetchClients = async () => {
    try {
      const response = await api.get('/clients');
      const mappedClients = response.data.map((c: any) => {
        const directProducts = c.products || [];
        const brandProducts = c.brands ? c.brands.flatMap((b: any) => b.products || []) : [];
        const allProducts = [...directProducts, ...brandProducts];

        return {
          ...c,
          id: c.id,
          nome: c.nomeFantasia || c.razaoSocial, // Display Fantasy Name, fallback to Corporate Name
          logo: getImageUrl(c.logo),
          totalProdutos: allProducts.length,
          totalPdvs: c.supermarkets ? c.supermarkets.length : 0,
          status: c.status,
          allProducts: allProducts
        };
      });
      setClients(mappedClients);
    } catch (error) {
      console.error("Failed to fetch clients", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter(c => 
    (c.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.razaoSocial || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.nomeFantasia || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.cnpj && c.cnpj.includes(searchTerm)) ||
    (c.emailPrincipal && c.emailPrincipal.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/contracts', newContract);
      alert('Contrato criado com sucesso!');
      setShowContractModal(false);
      setNewContract({ 
        clientId: '', 
        templateId: '', 
        description: '', 
        startDate: '', 
        endDate: '', 
        value: 0,
        type: 'fixo',
        valuePerStore: 0,
        valuePerVisit: 0,
        visitFrequency: '',
        visitsPerMonth: 0,
        slaPercentage: 0
      });
    } catch (error) {
      console.error("Error creating contract:", error);
      alert('Erro ao criar contrato.');
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/contract-templates', newTemplate);
      alert('Modelo de contrato criado com sucesso!');
      setShowTemplateModal(false);
      setNewTemplate({ name: '', description: '', content: '' });
      fetchTemplates();
    } catch (error) {
      console.error("Error creating template:", error);
      alert('Erro ao criar modelo de contrato.');
    }
  };

  const resetClientForm = () => {
    setNewClient({
      razaoSocial: '',
      nomeFantasia: '',
      cnpj: '',
      emailPrincipal: '',
      telefonePrincipal: '',
      status: 'ativo',
      logradouro: '',
      numero: '',
      bairro: '',
      cidade: '',
      estado: '',
      cep: '',
      logo: '',
      password: '',
      defaultVisitChecklistTemplateId: '',
      defaultInventoryChecklistTemplateId: '',
      requiresInventoryCount: false,
      photoConfig: {
        labels: { before: '', storage: '', after: '' },
        categories: {}
      }
    });
    setLogoFile(null);
    setEditingClient(null);
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    setNewClient(prev => ({
      ...prev,
      photoConfig: {
        ...prev.photoConfig,
        categories: {
          ...prev.photoConfig.categories,
          [newCategoryName]: {
            labels: { before: '', storage: '', after: '' }
          }
        }
      }
    }));
    setNewCategoryName('');
  };

  const handleRemoveCategory = (category: string) => {
    const newCategories = { ...newClient.photoConfig.categories };
    delete newCategories[category];
    setNewClient(prev => ({
      ...prev,
      photoConfig: {
        ...prev.photoConfig,
        categories: newCategories
      }
    }));
  };

  const handleAddAllFiltered = () => {
    const toAdd = availableSupermarkets
      .filter(s => !selectedSupermarketIds.includes(s.id))
      .filter(s => !selectedGroupFilter || (s.group?.id === selectedGroupFilter))
      .filter(s => (s.fantasyName || '').toLowerCase().includes(leftSearch.toLowerCase()))
      .map(s => s.id);
      
    if (toAdd.length > 0) {
      setSelectedSupermarketIds(prev => [...prev, ...toAdd]);
    }
  };

  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('razaoSocial', newClient.razaoSocial);
      if (newClient.nomeFantasia) formData.append('nomeFantasia', newClient.nomeFantasia);
      if (newClient.cnpj) formData.append('cnpj', newClient.cnpj);
      if (newClient.emailPrincipal) formData.append('emailPrincipal', newClient.emailPrincipal);
      if (newClient.telefonePrincipal) formData.append('telefonePrincipal', newClient.telefonePrincipal);
      if (newClient.status) formData.append('status', newClient.status);
      if (newClient.logradouro) formData.append('logradouro', newClient.logradouro);
      if (newClient.numero) formData.append('numero', newClient.numero);
      if (newClient.bairro) formData.append('bairro', newClient.bairro);
      if (newClient.cidade) formData.append('cidade', newClient.cidade);
      if (newClient.estado) formData.append('estado', newClient.estado);
      if (newClient.cep) formData.append('cep', newClient.cep);
      if (newClient.password) formData.append('password', newClient.password);
      if (newClient.defaultVisitChecklistTemplateId) formData.append('defaultVisitChecklistTemplateId', newClient.defaultVisitChecklistTemplateId);
      if (newClient.defaultInventoryChecklistTemplateId) formData.append('defaultInventoryChecklistTemplateId', newClient.defaultInventoryChecklistTemplateId);
      formData.append('requiresInventoryCount', String(newClient.requiresInventoryCount));
      if (newClient.locationRange) formData.append('locationRange', String(newClient.locationRange));
      if (newClient.inventoryFrequency) formData.append('inventoryFrequency', newClient.inventoryFrequency);
      
      // Append photoConfig as JSON string
      if (newClient.photoConfig) {
        formData.append('photoConfig', JSON.stringify(newClient.photoConfig));
      }
      
      if (logoFile) {
        formData.append('logo', logoFile);
      } else if (newClient.logo) {
        formData.append('logo', newClient.logo);
      }

      if (editingClient) {
        await api.patch(`/clients/${editingClient}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        alert('Cliente atualizado com sucesso!');
      } else {
        await api.post('/clients', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        alert('Cliente criado com sucesso!');
      }

      setShowClientModal(false);
      resetClientForm();
      fetchClients();
    } catch (error) {
      console.error("Error saving client:", error);
      alert('Erro ao salvar cliente.');
    }
  };

  const handleEditClient = (client: any) => {
    setEditingClient(client.id);
    const photoConfig = client.photoConfig || {};
    if (!photoConfig.labels) photoConfig.labels = { before: '', storage: '', after: '' };
    if (!photoConfig.categories) photoConfig.categories = {};

    setNewClient({
      razaoSocial: client.razaoSocial || '',
      nomeFantasia: client.nomeFantasia || '',
      cnpj: client.cnpj || '',
      emailPrincipal: client.emailPrincipal || '',
      telefonePrincipal: client.telefonePrincipal || '',
      status: client.status || 'ativo',
      logradouro: client.logradouro || '',
      numero: client.numero || '',
      bairro: client.bairro || '',
      cidade: client.cidade || '',
      estado: client.estado || '',
      cep: client.cep || '',
      logo: client.logo || '',
      password: '',
      photoConfig,
      defaultVisitChecklistTemplateId: client.defaultVisitChecklistTemplateId || '',
      defaultInventoryChecklistTemplateId: client.defaultInventoryChecklistTemplateId || '',
      requiresInventoryCount: client.requiresInventoryCount !== undefined ? client.requiresInventoryCount : true,
      locationRange: client.locationRange || 500,
      inventoryFrequency: client.inventoryFrequency || ''
    });
    setShowClientModal(true);
  };

  const handleDeleteClient = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este cliente?')) return;
    try {
      await api.delete(`/clients/${id}`);
      fetchClients();
    } catch (error) {
      console.error("Error deleting client:", error);
      alert('Erro ao excluir cliente.');
    }
  };

  if (loading) return <div className="p-8">Carregando clientes...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 relative">
      {showLinkModal && linkClient && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
          <div className="rounded-3xl p-6 max-w-5xl w-full shadow-[0_0_20px_rgba(253,0,255,0.12)] relative flex flex-col max-h-[90vh] border border-[color:var(--color-border)] bg-[color:var(--surface-container-low)]">
            <button 
              onClick={() => setShowLinkModal(false)}
              className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-full transition-colors"
            >
              <X size={20} className="text-[color:var(--color-muted)]" />
            </button>
            <h2 className="text-xl font-bold  text-[color:var(--color-text)] mb-4">Vincular PDVs - {linkClient.nome}</h2>
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4">
              <div className="rounded-xl p-3 border border-[color:var(--color-border)] flex flex-col h-full overflow-hidden bg-[color:var(--surface-container-highest)]">
                <div className="mb-2 space-y-2 flex-shrink-0">
                  <div className="flex gap-2">
                    <div className="flex-1 relative z-20">
                      <SearchableSelect
                        placeholder="Todas as Redes"
                        value={selectedGroupFilter}
                        onChange={(val) => setSelectedGroupFilter(val)}
                        options={[
                          { value: '', label: 'Todas as Redes' },
                          ...supermarketGroups.map(g => ({ value: g.id, label: g.name }))
                        ]}
                        className="w-full"
                      />
                    </div>
                    <button
                      onClick={handleAddAllFiltered}
                      className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-200 whitespace-nowrap"
                      title="Adicionar todos os PDVs filtrados"
                    >
                      Add Todos
                    </button>
                  </div>
                  <input 
                    type="text"
                    value={leftSearch}
                    onChange={e => setLeftSearch(e.target.value)}
                    placeholder="Filtrar PDVs disponíveis..."
                    className="w-full px-3 py-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--surface-container-low)] text-xs"
                  />
                </div>
                <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                  {availableSupermarkets
                    .filter(s => !selectedSupermarketIds.includes(s.id))
                    .filter(s => !selectedGroupFilter || (s.group?.id === selectedGroupFilter))
                    .filter(s => (s.fantasyName || '').toLowerCase().includes(leftSearch.toLowerCase()))
                    .map(s => (
                      <div key={s.id} className="flex items-center justify-between bg-[color:var(--surface-container-low)] border border-[color:var(--color-border)] rounded-lg px-3 py-2 hover:border-[color:var(--color-secondary)]/50 transition-colors group cursor-pointer" onClick={() => addToSelected(s.id)}>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[color:var(--color-text)] truncate group-hover:text-[color:var(--color-secondary)]">{s.fantasyName}</p>
                          <p className="text-[10px] text-[color:var(--color-muted)]">{s.city} - {s.state}</p>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); addToSelected(s.id); }}
                          className="text-[10px] font-bold text-[color:var(--color-secondary)] hover:bg-white/5 px-2 py-1 rounded"
                        >
                          Incluir
                        </button>
                      </div>
                    ))
                  }
                </div>
              </div>

              <div className="flex items-center justify-center py-2 lg:py-0">
                <div className="text-[color:var(--color-muted)] font-bold text-xs lg:rotate-0 rotate-90 hidden lg:block">&rarr;</div>
              </div>
              
              <div className="rounded-xl p-3 border border-[color:var(--color-border)] flex flex-col h-full overflow-hidden bg-[color:var(--surface-container-highest)]">
                <div className="mb-2 flex-shrink-0 flex justify-between items-center gap-2">
                  <input 
                    type="text"
                    value={rightSearch}
                    onChange={e => setRightSearch(e.target.value)}
                    placeholder="Filtrar PDVs vinculados..."
                    className="w-full px-3 py-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--surface-container-low)] text-xs"
                  />
                  <button 
                    onClick={() => setSelectedSupermarketIds([])}
                    className="text-xs font-bold text-[color:var(--color-tertiary)] hover:opacity-90 whitespace-nowrap"
                  >
                    Remover Todos
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                  {availableSupermarkets
                    .filter(s => selectedSupermarketIds.includes(s.id))
                    .filter(s => (s.fantasyName || '').toLowerCase().includes(rightSearch.toLowerCase()))
                    .map(s => (
                      <div key={s.id} className="flex items-center justify-between bg-[color:var(--surface-container-low)] border border-[color:var(--color-border)] rounded-lg px-3 py-2 hover:border-[color:var(--color-tertiary)]/50 transition-colors group cursor-pointer" onClick={() => removeFromSelected(s.id)}>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[color:var(--color-text)] truncate group-hover:text-[color:var(--color-tertiary)]">{s.fantasyName}</p>
                          <p className="text-[10px] text-[color:var(--color-muted)]">{s.city} - {s.state}</p>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); removeFromSelected(s.id); }}
                          className="text-[10px] font-bold text-[color:var(--color-tertiary)] hover:bg-white/5 px-2 py-1 rounded"
                        >
                          Remover
                        </button>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-3 flex-shrink-0">
              <button 
                onClick={() => setShowLinkModal(false)}
                className="px-4 py-2 font-bold text-[color:var(--color-muted)] hover:bg-white/5 rounded-lg text-sm"
              >
                Cancelar
              </button>
              <button 
                onClick={saveLinks}
                className="px-6 py-2 text-white font-black rounded-lg shadow-lg hover:scale-105 transition-all text-sm"
                style={{ backgroundColor: settings.primaryColor }}
              >
                Salvar Vínculos ({selectedSupermarketIds.length})
              </button>
            </div>
          </div>
        </div>
      )}
      {showClientModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="rounded-3xl p-8 max-w-2xl w-full shadow-[0_0_20px_rgba(253,0,255,0.12)] relative max-h-[90vh] overflow-y-auto border border-[color:var(--color-border)] bg-[color:var(--surface-container-low)]">
            <button 
              onClick={() => setShowClientModal(false)}
              className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-full transition-colors"
            >
              <X size={20} className="text-[color:var(--color-muted)]" />
            </button>
            
            <h2 className="text-2xl font-bold  text-[color:var(--color-text)] mb-6">{editingClient ? 'Editar Cliente' : 'Novo Cliente'}</h2>
            
            <form onSubmit={handleClientSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[11px] font-bold text-[color:var(--color-muted)] uppercase mb-1 block  tracking-wider">Razão Social *</label>
                  <input 
                    type="text" 
                    required
                    value={newClient.razaoSocial}
                    onChange={e => setNewClient({...newClient, razaoSocial: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl font-bold text-sm"
                    placeholder="Razão Social Ltda"
                  />
                </div>
                
                <div className="col-span-2 md:col-span-1">
                  <label className="text-[11px] font-bold text-[color:var(--color-muted)] uppercase mb-1 block  tracking-wider">Nome Fantasia</label>
                  <input 
                    type="text" 
                    value={newClient.nomeFantasia}
                    onChange={e => setNewClient({...newClient, nomeFantasia: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl font-bold text-sm"
                    placeholder="Nome Comercial"
                  />
                </div>

                <div className="col-span-2 md:col-span-1">
                  <label className="text-[11px] font-bold text-[color:var(--color-muted)] uppercase mb-1 block  tracking-wider">CNPJ *</label>
                  <input 
                    type="text" 
                    required
                    value={newClient.cnpj}
                    onChange={e => setNewClient({...newClient, cnpj: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl font-bold text-sm"
                    placeholder="00.000.000/0000-00"
                  />
                </div>

                <div className="col-span-2 md:col-span-1">
                  <label className="text-[11px] font-bold text-[color:var(--color-muted)] uppercase mb-1 block  tracking-wider">Email Principal</label>
                  <input 
                    type="email" 
                    value={newClient.emailPrincipal}
                    onChange={e => setNewClient({...newClient, emailPrincipal: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl font-bold text-sm"
                  />
                </div>

                <div className="col-span-2 md:col-span-1">
                  <label className="text-[11px] font-bold text-[color:var(--color-muted)] uppercase mb-1 block  tracking-wider">Telefone Principal</label>
                  <input 
                    type="text" 
                    value={newClient.telefonePrincipal}
                    onChange={e => setNewClient({...newClient, telefonePrincipal: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl font-bold text-sm"
                  />
                </div>

                <div className="col-span-2 md:col-span-1">
                  <label className="text-[11px] font-bold text-[color:var(--color-muted)] uppercase mb-1 block  tracking-wider">Senha de Acesso (Opcional na edição)</label>
                  <input 
                    type="password" 
                    value={newClient.password || ''}
                    onChange={e => setNewClient({...newClient, password: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl font-bold text-sm"
                    placeholder={editingClient ? "Deixe em branco para manter" : "Senha do cliente"}
                    required={!editingClient}
                  />
                </div>

                <div className="col-span-2 md:col-span-1">
                  <SearchableSelect
                    label="Status"
                    value={newClient.status}
                    onChange={(val) => setNewClient({...newClient, status: val})}
                    options={[
                      { value: 'ativo', label: 'Ativo' },
                      { value: 'inativo', label: 'Inativo' },
                      { value: 'suspenso', label: 'Suspenso' }
                    ]}
                  />
                </div>
              </div>

              <div className="border-t border-[color:var(--color-border)] pt-4">
                <h3 className="text-sm font-bold text-[color:var(--color-text)] mb-4 uppercase tracking-wider ">Padrões de Checklist</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="col-span-2 md:col-span-1">
                    <SearchableSelect
                      label="Checklist de Visita Padrão"
                      placeholder="Selecione um checklist..."
                      value={newClient.defaultVisitChecklistTemplateId}
                      onChange={(val) => setNewClient({...newClient, defaultVisitChecklistTemplateId: val})}
                      options={[
                        { value: '', label: 'Nenhum' },
                        ...checklistTemplates.map(t => ({ value: t.id, label: t.name }))
                      ]}
                    />
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <SearchableSelect
                      label="Checklist de Inventário Padrão"
                      placeholder="Selecione um checklist..."
                      value={newClient.defaultInventoryChecklistTemplateId}
                      onChange={(val) => setNewClient({...newClient, defaultInventoryChecklistTemplateId: val})}
                      options={[
                        { value: '', label: 'Nenhum' },
                        ...checklistTemplates.map(t => ({ value: t.id, label: t.name }))
                      ]}
                    />
                  </div>
                  <div className="col-span-2 flex items-center gap-3 p-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--surface-container-highest)]">
                    <input
                      type="checkbox"
                      id="requiresInventoryCount"
                      checked={newClient.requiresInventoryCount}
                      onChange={e => setNewClient({...newClient, requiresInventoryCount: e.target.checked})}
                      className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="requiresInventoryCount" className="text-sm font-bold text-[color:var(--color-text)] cursor-pointer select-none">
                      Exigir Contagem de Estoque (Inventário)
                    </label>
                  </div>
                  
                  <div className="col-span-2 md:col-span-1">
                     <label className="text-[11px] font-bold text-[color:var(--color-muted)] uppercase mb-1 block  tracking-wider">Frequência de Inventário</label>
                     <select
                       value={newClient.inventoryFrequency || ''}
                       onChange={e => setNewClient({...newClient, inventoryFrequency: e.target.value})}
                       className="w-full px-4 py-3 rounded-xl font-bold text-sm"
                     >
                       <option value="">Sempre (Padrão)</option>
                       <option value="daily">Diário (1x por dia)</option>
                       <option value="weekly">Semanal (1x por semana)</option>
                       <option value="biweekly">Quinzenal (1x a cada 15 dias)</option>
                       <option value="monthly">Mensal (1x por mês)</option>
                     </select>
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <label className="text-[11px] font-bold text-[color:var(--color-muted)] uppercase mb-1 block  tracking-wider">Raio de Localização (m)</label>
                    <input 
                      type="number" 
                      value={newClient.locationRange || 500}
                      onChange={e => setNewClient({...newClient, locationRange: parseInt(e.target.value) || 500})}
                      className="w-full px-4 py-3 rounded-xl font-bold text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-[color:var(--color-border)] pt-4">
                <h3 className="text-sm font-bold text-[color:var(--color-text)] mb-4 uppercase tracking-wider ">Endereço</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="col-span-2 md:col-span-1">
                    <label className="text-[11px] font-bold text-[color:var(--color-muted)] uppercase mb-1 block  tracking-wider">CEP</label>
                    <input 
                      type="text" 
                      value={newClient.cep}
                      onChange={e => setNewClient({...newClient, cep: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl font-bold text-sm"
                    />
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <label className="text-[11px] font-bold text-[color:var(--color-muted)] uppercase mb-1 block  tracking-wider">Logradouro</label>
                    <input 
                      type="text" 
                      value={newClient.logradouro}
                      onChange={e => setNewClient({...newClient, logradouro: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl font-bold text-sm"
                    />
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <label className="text-[11px] font-bold text-[color:var(--color-muted)] uppercase mb-1 block  tracking-wider">Número</label>
                    <input 
                      type="text" 
                      value={newClient.numero}
                      onChange={e => setNewClient({...newClient, numero: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl font-bold text-sm"
                    />
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <label className="text-[11px] font-bold text-[color:var(--color-muted)] uppercase mb-1 block  tracking-wider">Bairro</label>
                    <input 
                      type="text" 
                      value={newClient.bairro}
                      onChange={e => setNewClient({...newClient, bairro: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl font-bold text-sm"
                    />
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <label className="text-[11px] font-bold text-[color:var(--color-muted)] uppercase mb-1 block  tracking-wider">Cidade</label>
                    <input 
                      type="text" 
                      value={newClient.cidade}
                      onChange={e => setNewClient({...newClient, cidade: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl font-bold text-sm"
                    />
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <label className="text-[11px] font-bold text-[color:var(--color-muted)] uppercase mb-1 block  tracking-wider">Estado (UF)</label>
                    <input 
                      type="text" 
                      value={newClient.estado}
                      onChange={e => setNewClient({...newClient, estado: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl font-bold text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-[color:var(--color-border)] pt-4">
                <h3 className="text-sm font-bold text-[color:var(--color-text)] mb-4 uppercase tracking-wider ">Configuração de Fotos (Checklist)</h3>
                <p className="text-xs text-[color:var(--color-muted)] mb-4">Defina os rótulos das fotos que devem ser tiradas. Deixe em branco para desativar um tipo de foto.</p>
                
                {/* Default Config */}
                <div className="mb-6">
                  <h4 className="text-xs font-bold text-[color:var(--color-text)] mb-3">Rótulos Padrão</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-[color:var(--color-muted)] uppercase mb-1 block">Foto Antes</label>
                      <input 
                        type="text" 
                        value={newClient.photoConfig?.labels?.before || ''}
                        onChange={e => setNewClient(prev => ({
                          ...prev,
                          photoConfig: { ...prev.photoConfig, labels: { ...prev.photoConfig?.labels, before: e.target.value } }
                        }))}
                        className="w-full px-3 py-2 rounded-lg text-sm"
                        placeholder="Ex: Foto Loja"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[color:var(--color-muted)] uppercase mb-1 block">Foto Estoque</label>
                      <input 
                        type="text" 
                        value={newClient.photoConfig?.labels?.storage || ''}
                        onChange={e => setNewClient(prev => ({
                          ...prev,
                          photoConfig: { ...prev.photoConfig, labels: { ...prev.photoConfig?.labels, storage: e.target.value } }
                        }))}
                        className="w-full px-3 py-2 rounded-lg text-sm"
                        placeholder="Ex: Foto Câmara Fria"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[color:var(--color-muted)] uppercase mb-1 block">Foto Depois</label>
                      <input 
                        type="text" 
                        value={newClient.photoConfig?.labels?.after || ''}
                        onChange={e => setNewClient(prev => ({
                          ...prev,
                          photoConfig: { ...prev.photoConfig, labels: { ...prev.photoConfig?.labels, after: e.target.value } }
                        }))}
                        className="w-full px-3 py-2 rounded-lg text-sm"
                        placeholder="Ex: Foto Loja Arrumada"
                      />
                    </div>
                  </div>
                </div>

                {/* Category Configs */}
                <div>
                  <h4 className="text-xs font-bold text-[color:var(--color-text)] mb-3">Personalizar por Categoria</h4>
                  
                  <div className="flex gap-2 mb-4">
                    <input 
                      type="text" 
                      value={newCategoryName}
                      onChange={e => setNewCategoryName(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg text-sm"
                      placeholder="Nome da Categoria (ex: Laticínios)"
                    />
                    <button 
                      type="button"
                      onClick={handleAddCategory}
                      className="px-4 py-2 bg-[color:var(--color-primary)] text-black rounded-lg text-sm font-bold hover:opacity-90"
                    >
                      Adicionar
                    </button>
                  </div>

                  <div className="space-y-4">
                    {Object.entries(newClient.photoConfig?.categories || {}).map(([category, config]: [string, any]) => (
                      <div key={category} className="p-3 rounded-xl border border-[color:var(--color-border)] relative bg-[color:var(--surface-container-highest)]">
                        <button 
                          type="button"
                          onClick={() => handleRemoveCategory(category)}
                          className="absolute top-2 right-2 text-[color:var(--color-tertiary)] hover:bg-white/5 p-1 rounded"
                        >
                          <Trash2 size={14} />
                        </button>
                        <h5 className="text-sm font-bold text-[color:var(--color-text)] mb-2">{category}</h5>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <input 
                            type="text" 
                            value={config.labels?.before || ''}
                            onChange={e => setNewClient(prev => ({
                              ...prev,
                              photoConfig: {
                                ...prev.photoConfig,
                                categories: {
                                  ...prev.photoConfig.categories,
                                  [category]: {
                                    ...prev.photoConfig.categories[category],
                                    labels: { ...prev.photoConfig.categories[category]?.labels, before: e.target.value }
                                  }
                                }
                              }
                            }))}
                            className="w-full px-2 py-1.5 rounded text-xs"
                            placeholder="Rótulo Antes"
                          />
                          <input 
                            type="text" 
                            value={config.labels?.storage || ''}
                            onChange={e => setNewClient(prev => ({
                              ...prev,
                              photoConfig: {
                                ...prev.photoConfig,
                                categories: {
                                  ...prev.photoConfig.categories,
                                  [category]: {
                                    ...prev.photoConfig.categories[category],
                                    labels: { ...prev.photoConfig.categories[category]?.labels, storage: e.target.value }
                                  }
                                }
                              }
                            }))}
                            className="w-full px-2 py-1.5 rounded text-xs"
                            placeholder="Rótulo Estoque"
                          />
                          <input 
                            type="text" 
                            value={config.labels?.after || ''}
                            onChange={e => setNewClient(prev => ({
                              ...prev,
                              photoConfig: {
                                ...prev.photoConfig,
                                categories: {
                                  ...prev.photoConfig.categories,
                                  [category]: {
                                    ...prev.photoConfig.categories[category],
                                    labels: { ...prev.photoConfig.categories[category]?.labels, after: e.target.value }
                                  }
                                }
                              }
                            }))}
                            className="w-full px-2 py-1.5 rounded text-xs"
                            placeholder="Rótulo Depois"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[color:var(--color-muted)] uppercase mb-1 block  tracking-wider">Logo (Upload ou URL)</label>
                <div className="flex flex-col gap-2">
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={e => setLogoFile(e.target.files?.[0] || null)}
                    className="w-full px-4 py-3 rounded-xl font-bold text-sm"
                  />
                  <input 
                    type="text" 
                    value={newClient.logo}
                    onChange={e => setNewClient({...newClient, logo: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl font-bold text-sm"
                    placeholder="Ou cole a URL da imagem..."
                  />
                </div>
              </div>

              <button 
                type="submit"
                className="w-full py-4 text-white rounded-xl font-black shadow-lg hover:scale-[1.02] transition-all mt-4"
                style={{ backgroundColor: settings.primaryColor }}
              >
                {editingClient ? 'Atualizar Cliente' : 'Cadastrar Cliente'}
              </button>
            </form>
          </div>
        </div>
      )}

      {showContractModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="rounded-3xl p-8 max-w-md w-full shadow-[0_0_20px_rgba(253,0,255,0.12)] relative border border-[color:var(--color-border)] bg-[color:var(--surface-container-low)]">
            <button 
              onClick={() => setShowContractModal(false)}
              className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-full transition-colors"
            >
              <X size={20} className="text-[color:var(--color-muted)]" />
            </button>
            
            <h2 className="text-2xl font-bold  text-[color:var(--color-text)] mb-6">Novo Contrato</h2>
            
            <form onSubmit={handleCreateContract} className="space-y-4">
              <div>
                <SearchableSelect
                  label="Cliente"
                  required
                  placeholder="Selecione um cliente..."
                  value={newContract.clientId}
                  onChange={(val) => setNewContract({...newContract, clientId: val})}
                  options={clients.map(c => ({ value: c.id, label: c.nome }))}
                />
              </div>

              <div>
                <SearchableSelect
                  label="Modelo de Contrato"
                  placeholder="Sem modelo vinculado"
                  value={newContract.templateId}
                  onChange={(val) => {
                    const template = templates.find(t => t.id === val);
                    setNewContract({
                      ...newContract, 
                      templateId: val,
                      description: template ? `Contrato - ${template.name}` : newContract.description
                    });
                  }}
                  options={[
                    { value: '', label: 'Sem modelo vinculado' },
                    ...templates.map(t => ({ value: t.id, label: t.name }))
                  ]}
                />
              </div>
              
              <div>
                <label className="text-[11px] font-bold text-[color:var(--color-muted)] uppercase mb-1 block  tracking-wider">Descrição do Contrato</label>
                <input 
                  type="text" 
                  required
                  value={newContract.description}
                  onChange={e => setNewContract({...newContract, description: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl font-bold text-sm"
                  placeholder="Ex: Contrato Anual 2024"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-[color:var(--color-muted)] uppercase mb-1 block  tracking-wider">Início</label>
                  <input 
                    type="date" 
                    required
                    value={newContract.startDate}
                    onChange={e => setNewContract({...newContract, startDate: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl font-bold text-sm"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[color:var(--color-muted)] uppercase mb-1 block  tracking-wider">Fim</label>
                  <input 
                    type="date" 
                    required
                    value={newContract.endDate}
                    onChange={e => setNewContract({...newContract, endDate: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl font-bold text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[color:var(--color-muted)] uppercase mb-1 block  tracking-wider">Tipo de Contrato</label>
                <select 
                  value={newContract.type}
                  onChange={e => setNewContract({...newContract, type: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl font-bold text-sm"
                >
                  <option value="fixo">Fixo Mensal</option>
                  <option value="por_loja">Por Loja</option>
                  <option value="por_visita">Por Visita</option>
                </select>
              </div>

              {newContract.type === 'fixo' && (
                <div>
                  <label className="text-[11px] font-bold text-[color:var(--color-muted)] uppercase mb-1 block  tracking-wider">Valor Mensal (R$)</label>
                  <input 
                    type="number" 
                    min="0"
                    step="0.01"
                    value={newContract.value}
                    onChange={e => setNewContract({...newContract, value: parseFloat(e.target.value)})}
                    className="w-full px-4 py-3 rounded-xl font-bold text-sm"
                  />
                </div>
              )}

              {newContract.type === 'por_loja' && (
                <div>
                  <label className="text-[11px] font-bold text-[color:var(--color-muted)] uppercase mb-1 block  tracking-wider">Valor por Loja (R$)</label>
                  <input 
                    type="number" 
                    min="0"
                    step="0.01"
                    value={newContract.valuePerStore}
                    onChange={e => setNewContract({...newContract, valuePerStore: parseFloat(e.target.value)})}
                    className="w-full px-4 py-3 rounded-xl font-bold text-sm"
                  />
                </div>
              )}

              {newContract.type === 'por_visita' && (
                <div>
                  <label className="text-[11px] font-bold text-[color:var(--color-muted)] uppercase mb-1 block  tracking-wider">Valor por Visita (R$)</label>
                  <input 
                    type="number" 
                    min="0"
                    step="0.01"
                    value={newContract.valuePerVisit}
                    onChange={e => setNewContract({...newContract, valuePerVisit: parseFloat(e.target.value)})}
                    className="w-full px-4 py-3 rounded-xl font-bold text-sm"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-[color:var(--color-muted)] uppercase mb-1 block  tracking-wider">Frequência de Visitas</label>
                  <input 
                    type="text" 
                    value={newContract.visitFrequency}
                    onChange={e => setNewContract({...newContract, visitFrequency: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl font-bold text-sm"
                    placeholder="Ex: Semanal"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[color:var(--color-muted)] uppercase mb-1 block  tracking-wider">Visitas/Mês</label>
                  <input 
                    type="number" 
                    value={newContract.visitsPerMonth}
                    onChange={e => setNewContract({...newContract, visitsPerMonth: parseFloat(e.target.value)})}
                    className="w-full px-4 py-3 rounded-xl font-bold text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[color:var(--color-muted)] uppercase mb-1 block  tracking-wider">SLA (%)</label>
                <input 
                  type="number" 
                  min="0"
                  max="100"
                  value={newContract.slaPercentage}
                  onChange={e => setNewContract({...newContract, slaPercentage: parseFloat(e.target.value)})}
                  className="w-full px-4 py-3 rounded-xl font-bold text-sm"
                />
              </div>

              <button 
                type="submit"
                className="w-full py-4 text-white rounded-xl font-black shadow-lg hover:scale-[1.02] transition-all mt-4"
                style={{ backgroundColor: settings.primaryColor }}
              >
                Criar Contrato
              </button>
            </form>
          </div>
        </div>
      )}

      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl relative">
            <button 
              onClick={() => setShowTemplateModal(false)}
              className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X size={20} className="text-slate-400" />
            </button>
            
            <h2 className="text-2xl font-black text-[color:var(--color-text)] mb-6">Novo Modelo</h2>
            
            <form onSubmit={handleCreateTemplate} className="space-y-4">
              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase mb-1 block">Nome do Modelo</label>
                <input 
                  type="text" 
                  required
                  value={newTemplate.name}
                  onChange={e => setNewTemplate({...newTemplate, name: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none focus:ring-2 focus:ring-blue-100 font-bold text-sm"
                  placeholder="Ex: Contrato Padrão 2024"
                />
              </div>
              
              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase mb-1 block">Descrição</label>
                <input 
                  type="text" 
                  value={newTemplate.description}
                  onChange={e => setNewTemplate({...newTemplate, description: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none focus:ring-2 focus:ring-blue-100 font-bold text-sm"
                />
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase mb-1 block">Conteúdo (Cláusulas)</label>
                <textarea 
                  rows={6}
                  value={newTemplate.content}
                  onChange={e => setNewTemplate({...newTemplate, content: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none focus:ring-2 focus:ring-blue-100 font-bold text-sm resize-none"
                  placeholder="Digite o texto do contrato aqui..."
                />
              </div>

              <button 
                type="submit"
                className="w-full py-4 text-white rounded-xl font-black shadow-lg hover:scale-[1.02] transition-all mt-4"
                style={{ backgroundColor: settings.primaryColor }}
              >
                Salvar Modelo
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight  text-[color:var(--color-text)]">Clientes & Contratos</h1>
          <p className="text-[color:var(--color-muted)] font-medium text-lg">Marcas que confiam na operação Ayratech.</p>
        </div>
        <div className="flex gap-4">
          {activeTab === 'templates' && (
             <button 
              onClick={() => setShowTemplateModal(true)}
              className="flex items-center gap-2 text-[color:var(--color-text)] border border-[color:var(--color-border)] px-6 py-3 rounded-2xl font-bold shadow-sm transition-all hover:bg-white/5 bg-[color:var(--surface-container-low)]"
            >
              <Plus size={20} /> Novo Modelo
            </button>
          )}
          {activeTab === 'clients' && (
            <button 
              onClick={() => { resetClientForm(); setShowClientModal(true); }}
              className="flex items-center gap-2 text-[color:var(--color-text)] border border-[color:var(--color-border)] px-6 py-3 rounded-2xl font-bold shadow-sm transition-all hover:bg-white/5 bg-[color:var(--surface-container-low)]"
            >
              <Plus size={20} /> Novo Cliente
            </button>
          )}
          <button 
            onClick={() => setShowContractModal(true)}
            className="flex items-center gap-2 text-black px-8 py-3 rounded-2xl font-bold shadow-[0_0_20px_rgba(253,0,255,0.25)] transition-all hover:scale-105 bg-gradient-to-r from-[color:var(--color-primary)] to-[color:var(--color-primary)]"
            style={{ backgroundColor: settings.primaryColor }}
          >
            <Plus size={20} /> Novo Contrato
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-[color:var(--color-border)]">
        <button 
          onClick={() => setActiveTab('clients')}
          className={`pb-4 text-sm font-black uppercase tracking-widest transition-all ${
            activeTab === 'clients' 
              ? 'border-b-4 text-[color:var(--color-text)]' 
              : 'text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]'
          }`}
          style={{ borderColor: activeTab === 'clients' ? settings.primaryColor : 'transparent' }}
        >
          Clientes
        </button>
        <button 
          onClick={() => setActiveTab('templates')}
          className={`pb-4 text-sm font-black uppercase tracking-widest transition-all ${
            activeTab === 'templates' 
              ? 'border-b-4 text-[color:var(--color-text)]' 
              : 'text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]'
          }`}
          style={{ borderColor: activeTab === 'templates' ? settings.primaryColor : 'transparent' }}
        >
          Modelos de Contrato
        </button>
      </div>

      {activeTab === 'clients' && (
        <div className="mb-6">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Buscar clientes por nome, CNPJ ou email..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-100 font-medium"
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'clients' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredClients.map(c => (
            <div 
              key={c.id} 
              onClick={() => openLinkModal(c)}
              className="rounded-3xl border border-[color:var(--color-border)] p-8 hover:shadow-xl transition-all group relative overflow-hidden cursor-pointer bg-[color:var(--surface-container-low)]"
            >
              <div 
                className="absolute top-0 right-0 w-32 h-32 opacity-10 rounded-bl-full -mr-10 -mt-10 transition-all group-hover:opacity-20" 
                style={{ backgroundColor: settings.primaryColor }}
              />
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-8">
                  <div className="h-16 w-16 rounded-2xl bg-[color:var(--surface-container-highest)] border border-[color:var(--color-border)] shadow-sm flex items-center justify-center p-3">
                    <img src={getImageUrl(c.logo)} className="object-contain" alt={c.nome} />
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${c.status === 'ativo' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-gray-50 text-gray-600 border-gray-100'}`}>
                      {c.status}
                    </span>
                    <div className="flex gap-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleEditClient(c); }}
                        className="p-2 bg-white/5 text-[color:var(--color-muted)] hover:text-[color:var(--color-secondary)] hover:bg-white/10 rounded-lg transition-all" 
                        title="Editar"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteClient(c.id); }}
                        className="p-2 bg-white/5 text-[color:var(--color-muted)] hover:text-[color:var(--color-tertiary)] hover:bg-white/10 rounded-lg transition-all" 
                        title="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-[color:var(--color-text)] mb-1">{c.nome}</h3>
                <p className="text-[color:var(--color-muted)] font-bold mb-2">{c.totalProdutos} SKUs cadastrados</p>
                <p className="text-[color:var(--color-muted)] font-bold mb-8">{c.totalPdvs} PDVs vinculados</p>
                <div className="pt-6 border-t border-[color:var(--color-border)] flex gap-3">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      openDetailsModal(c);
                    }}
                    className="flex-1 py-3 bg-white/5 text-[color:var(--color-text)] rounded-xl text-xs font-bold hover:bg-white/10 transition-colors"
                  >
                    Produtos
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      openLinkModal(c);
                    }}
                    className="flex-1 py-3 rounded-xl text-xs font-bold transition-colors bg-opacity-10 hover:bg-opacity-20"
                    style={{ 
                      color: settings.primaryColor,
                      backgroundColor: `${settings.primaryColor}1a` // 10% opacity
                    }}
                  >
                    Vincular PDVs
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {templates.map(t => (
            <div key={t.id} className="rounded-3xl border border-[color:var(--color-border)] p-8 hover:shadow-xl transition-all group relative overflow-hidden bg-[color:var(--surface-container-low)]">
              <div 
                className="absolute top-0 right-0 w-32 h-32 opacity-5 rounded-bl-full -mr-10 -mt-10 transition-all group-hover:opacity-10 bg-slate-900" 
              />
              <div className="relative z-10">
                <h3 className="text-xl font-bold text-[color:var(--color-text)] mb-2">{t.name}</h3>
                <p className="text-[color:var(--color-muted)] font-medium text-sm mb-4 line-clamp-2">{t.description || 'Sem descrição'}</p>
                <div className="pt-4 border-t border-[color:var(--color-border)]">
                  <button className="w-full py-2 bg-white/5 text-[color:var(--color-text)] rounded-lg text-xs font-bold hover:bg-white/10 transition-colors">
                    Editar Modelo
                  </button>
                </div>
              </div>
            </div>
          ))}
          {templates.length === 0 && (
            <div className="col-span-full text-center py-12 text-[color:var(--color-muted)]">
              <p>Nenhum modelo de contrato cadastrado.</p>
            </div>
          )}
        </div>
      )}

      {showDetailsModal && detailsClient && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="rounded-3xl p-8 max-w-4xl w-full shadow-[0_0_20px_rgba(253,0,255,0.12)] relative max-h-[90vh] flex flex-col border border-[color:var(--color-border)] bg-[color:var(--surface-container-low)]">
            <button 
              onClick={() => setShowDetailsModal(false)}
              className="absolute top-4 right-4 p-2 hover:bg-white/5 rounded-full transition-colors"
            >
              <X size={20} className="text-[color:var(--color-muted)]" />
            </button>

            <div className="flex items-center gap-4 mb-6">
              <div className="h-16 w-16 rounded-2xl bg-[color:var(--surface-container-highest)] border border-[color:var(--color-border)] shadow-sm flex items-center justify-center p-3">
                <img src={getImageUrl(detailsClient.logo)} className="object-contain" alt={detailsClient.nome} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-[color:var(--color-text)]">{detailsClient.nome}</h2>
                <p className="text-[color:var(--color-muted)] font-medium">Detalhes e Associações</p>
              </div>
            </div>

            <div className="flex gap-6 border-b border-[color:var(--color-border)] mb-6">
              <button 
                onClick={() => setDetailsTab('products')}
                className={`pb-4 flex items-center gap-2 text-sm font-black uppercase tracking-widest transition-all ${
                  detailsTab === 'products' ? 'border-b-4 text-[color:var(--color-text)]' : 'text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]'
                }`}
                style={{ borderColor: detailsTab === 'products' ? settings.primaryColor : 'transparent' }}
              >
                <Package size={18} /> Produtos ({detailsClient.allProducts?.length || 0})
              </button>
              <button 
                onClick={() => setDetailsTab('pdvs')}
                className={`pb-4 flex items-center gap-2 text-sm font-black uppercase tracking-widest transition-all ${
                  detailsTab === 'pdvs' ? 'border-b-4 text-[color:var(--color-text)]' : 'text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]'
                }`}
                style={{ borderColor: detailsTab === 'pdvs' ? settings.primaryColor : 'transparent' }}
              >
                <Store size={18} /> PDVs ({detailsClient.supermarkets?.length || 0})
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-[300px]">
               {detailsTab === 'products' && (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                   {detailsClient.allProducts?.length > 0 ? (
                     detailsClient.allProducts.map((p: any) => (
                       <div key={p.id} className="p-4 rounded-xl border border-[color:var(--color-border)] flex gap-3 items-center bg-[color:var(--surface-container-highest)]">
                          <div className="h-12 w-12 rounded-lg flex items-center justify-center border border-[color:var(--color-border)] bg-[color:var(--surface-container-low)]">
                            {p.image ? (
                              <img src={getImageUrl(p.image)} className="h-10 w-10 object-contain" />
                            ) : (
                              <Package size={20} className="text-[color:var(--color-muted)]" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-[color:var(--color-text)] line-clamp-1" title={p.name}>{p.name}</p>
                            <p className="text-xs text-[color:var(--color-muted)]">{p.category?.name || 'Sem categoria'}</p>
                          </div>
                       </div>
                     ))
                   ) : (
                      <div className="col-span-full text-center py-12 text-[color:var(--color-muted)] flex flex-col items-center">
                        <Package size={48} className="mb-4 opacity-20" />
                        <p>Nenhum produto cadastrado.</p>
                      </div>
                   )}
                 </div>
               )}

               {detailsTab === 'pdvs' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {detailsClient.supermarkets?.length > 0 ? (
                      detailsClient.supermarkets.map((s: any) => (
                        <div key={s.id} className="p-4 rounded-xl border border-[color:var(--color-border)] flex justify-between items-center bg-[color:var(--surface-container-highest)]">
                           <div>
                             <p className="font-bold text-[color:var(--color-text)]">{s.fantasyName}</p>
                             <p className="text-xs text-[color:var(--color-muted)]">{s.city} - {s.state}</p>
                           </div>
                           <div className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg">
                             Ativo
                           </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-full text-center py-12 text-[color:var(--color-muted)] flex flex-col items-center">
                        <Store size={48} className="mb-4 opacity-20" />
                        <p>Nenhum PDV vinculado.</p>
                      </div>
                    )}
                  </div>
               )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientsView;
