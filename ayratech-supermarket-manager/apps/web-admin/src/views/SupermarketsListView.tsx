import React, { useState, useEffect } from 'react';
import { Store, Edit, Trash2, X, Search, MapPin, Map as MapIcon, List, Package, Plus, CheckCircle2, Building2 } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import api from '../api/client';
import { useBranding } from '../context/BrandingContext';
import { ViewType, SupermarketGroup } from '../types';
import MapModal from '../components/MapModal';
import { SearchableSelect } from '../components/SearchableSelect';
import { validateCNPJ } from '../utils/validators';
import { formatCNPJ } from '../utils/formatters';

// Fix for default marker icon
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface SupermarketsListViewProps {
  onNavigate: (view: ViewType) => void;
}

const SupermarketsListView: React.FC<SupermarketsListViewProps> = ({ onNavigate }) => {
  const { settings } = useBranding();
  const [supermarkets, setSupermarkets] = useState<any[]>([]);
  const [groups, setGroups] = useState<SupermarketGroup[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [filterClient, setFilterClient] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  
  // Modal & Form State
  const [showModal, setShowModal] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'location' | 'clients' | 'products'>('general');
  const [editingSupermarket, setEditingSupermarket] = useState<any | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [selectedBrandForMix, setSelectedBrandForMix] = useState<string>('');

  const [formData, setFormData] = useState({
    fantasyName: '',
    cnpj: '',
    groupId: '',
    classification: 'Prata',
    zipCode: '',
    street: '',
    number: '',
    neighborhood: '',
    complement: '',
    city: '',
    state: '',
    latitude: null as number | null,
    longitude: null as number | null,
    status: true,
    clientIds: [] as string[],
    productIds: [] as string[]
  });

  const fetchData = async () => {
    try {
      const [supermarketsRes, groupsRes, clientsRes, productsRes, brandsRes] = await Promise.all([
        api.get('/supermarkets'),
        api.get('/supermarket-groups'),
        api.get('/clients'),
        api.get('/products'),
        api.get('/brands')
      ]);
      setSupermarkets(supermarketsRes.data);
      setGroups(groupsRes.data);
      setClients(clientsRes.data);
      setProducts(productsRes.data);
      setBrands(brandsRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetForm = () => {
    setFormData({
      fantasyName: '',
      cnpj: '',
      groupId: '',
      classification: 'Prata',
      zipCode: '',
      street: '',
      number: '',
      neighborhood: '',
      complement: '',
      city: '',
      state: '',
      latitude: null,
      longitude: null,
      status: true
    });
    setEditingSupermarket(null);
  };

  const handleAddNew = () => {
    resetForm();
    setActiveTab('general');
    setFormData(prev => ({ ...prev, productIds: [] }));
    setShowModal(true);
  };

  const handleEdit = (supermarket: any) => {
    setEditingSupermarket(supermarket);
    setActiveTab('general');
    setFormData({
      fantasyName: supermarket.fantasyName || '',
      cnpj: formatCNPJ(supermarket.cnpj || ''),
      groupId: supermarket.groupId || (supermarket.group?.id || ''),
      classification: supermarket.classification || 'Prata',
      zipCode: supermarket.zipCode || '',
      street: supermarket.street || '',
      number: supermarket.number || '',
      neighborhood: supermarket.neighborhood || '',
      complement: supermarket.complement || '',
      city: supermarket.city || '',
      state: supermarket.state || '',
      latitude: supermarket.latitude ? parseFloat(supermarket.latitude) : null,
      longitude: supermarket.longitude ? parseFloat(supermarket.longitude) : null,
      status: supermarket.status !== undefined ? supermarket.status : true,
      clientIds: supermarket.clients ? supermarket.clients.map((c: any) => c.id) : [],
      productIds: supermarket.products ? supermarket.products.map((p: any) => p.id) : []
    });
    setShowModal(true);
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este supermercado? Esta ação não pode ser desfeita.')) {
      setDeletingId(id);
      try {
        await api.delete(`/supermarkets/${id}`);
        setSupermarkets(prev => prev.filter(s => s.id !== id));
      } catch (error: any) {
        console.error("Error deleting supermarket:", error);
        const msg = error.response?.data?.message || 'Erro ao excluir supermercado.';
        alert(msg);
      } finally {
        setDeletingId(null);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'cnpj') {
      setFormData(prev => ({ ...prev, [name]: formatCNPJ(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleLocationConfirm = (lat: number, lng: number) => {
    setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }));
  };

  const handleCepBlur = async () => {
    const cep = formData.zipCode.replace(/\D/g, '');
    if (cep.length !== 8) return;

    setCepLoading(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          street: data.logradouro,
          neighborhood: data.bairro,
          city: data.localidade,
          state: data.uf
        }));
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
    } finally {
      setCepLoading(false);
    }
  };

  const handleClientToggle = (clientId: string) => {
    setFormData(prev => {
      const currentIds = prev.clientIds || [];
      if (currentIds.includes(clientId)) {
        return { ...prev, clientIds: currentIds.filter(id => id !== clientId) };
      } else {
        return { ...prev, clientIds: [...currentIds, clientId] };
      }
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fantasyName || !formData.city) {
      alert('Por favor, preencha o Nome Fantasia e a Cidade.');
      return;
    }

    if (formData.cnpj && !validateCNPJ(formData.cnpj)) {
      alert('CNPJ inválido. Por favor, verifique o número digitado.');
      return;
    }

    try {
      const payload = { ...formData };
      // Remove formatting from CNPJ before saving
      if (payload.cnpj) {
        payload.cnpj = payload.cnpj.replace(/\D/g, '');
      }

      // Convert empty string to undefined for groupId to avoid foreign key constraint errors
      if (!payload.groupId) {
        delete (payload as any).groupId;
      }

      if (editingSupermarket) {
        await api.patch(`/supermarkets/${editingSupermarket.id}`, payload);
        alert('Supermercado atualizado com sucesso!');
      } else {
        await api.post('/supermarkets', payload);
        alert('Supermercado criado com sucesso!');
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error("Error saving supermarket:", error);
      const msg = error.response?.data?.message 
        ? (Array.isArray(error.response.data.message) ? error.response.data.message.join('\n') : error.response.data.message)
        : error.message;
      alert(`Erro ao salvar supermercado:\n${msg}`);
    }
  };

  if (loading) return <div className="p-8">Carregando supermercados...</div>;

  const filteredSupermarkets = supermarkets.filter(s => {
    const matchesSearch = (s.fantasyName && s.fantasyName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.city && s.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.group?.name && s.group.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesClient = !filterClient || (s.clients && s.clients.some((c: any) => c.id === filterClient));

    let matchesProduct = true;
    if (filterProduct) {
       const product = products.find(p => p.id === filterProduct);
       if (product && product.clientId) {
           matchesProduct = s.clients && s.clients.some((c: any) => c.id === product.clientId);
       } else {
           matchesProduct = false;
       }
    }

    return matchesSearch && matchesClient && matchesProduct;
  });

  return (
    <div className="animate-in fade-in duration-500 space-y-8 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-2xl font-black text-[color:var(--color-text)] tracking-tight">Supermercados</h1>
          <p className="text-[color:var(--color-muted)] font-medium text-lg">Pontos de venda da rede Ayratech.</p>
        </div>
        <button 
          onClick={handleAddNew} 
          className="text-white px-8 py-3 rounded-2xl font-black shadow-xl shadow-blue-200 hover:scale-105 transition-all"
          style={{ backgroundColor: settings.primaryColor }}
        >
          Cadastrar PDV
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row gap-4 justify-between items-center">
             <div className="flex gap-2 w-full md:w-auto">
                <button
                   onClick={() => setViewMode('list')}
                   className={`p-2 rounded-xl border transition-all ${viewMode === 'list' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-slate-200 text-slate-400 hover:bg-slate-50'}`}
                   title="Visualização em Lista"
                >
                   <List size={20} />
                </button>
                <button
                   onClick={() => setViewMode('map')}
                   className={`p-2 rounded-xl border transition-all ${viewMode === 'map' ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-slate-200 text-slate-400 hover:bg-slate-50'}`}
                   title="Visualização em Mapa"
                >
                   <MapIcon size={20} />
                </button>
             </div>

            <div className="flex flex-col md:flex-row gap-4 flex-1 w-full">
                 <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input 
                        type="text" 
                        placeholder="Buscar por nome, cidade ou rede..." 
                        className="w-full pl-12 h-12 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-blue-100 transition-all text-sm font-medium"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                 </div>
                 
                 <div className="min-w-[200px]">
                    <SearchableSelect
                        placeholder="Todos os Clientes"
                        value={filterClient}
                        onChange={(val) => setFilterClient(val)}
                        options={[
                            { value: '', label: 'Todos os Clientes' },
                            ...clients.map(c => ({ value: c.id, label: c.nome || c.fantasyName || c.razaoSocial }))
                        ]}
                    />
                 </div>

                 <div className="min-w-[200px]">
                    <SearchableSelect
                        placeholder="Todos os Produtos"
                        value={filterProduct}
                        onChange={(val) => setFilterProduct(val)}
                        options={[
                            { value: '', label: 'Todos os Produtos' },
                            ...products.map(p => ({ value: p.id, label: p.name }))
                        ]}
                    />
                 </div>
            </div>
        </div>
        {viewMode === 'list' ? (
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
              <th className="px-8 py-5">Identificação do PDV</th>
              <th className="px-8 py-5">Rede / Grupo</th>
              <th className="px-8 py-5">Cidade / UF</th>
              <th className="px-8 py-5 text-center">Classificação</th>
              <th className="px-8 py-5 text-right">Controle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredSupermarkets.map(s => (
              <tr key={s.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="px-8 py-6">
                   <div className="flex items-center gap-4">
                      <div 
                        className="h-12 w-12 rounded-2xl flex items-center justify-center border transition-colors"
                        style={{ 
                          backgroundColor: `${settings.primaryColor}10`,
                          color: settings.primaryColor,
                          borderColor: `${settings.primaryColor}20`
                        }}
                      >
                         <Store size={22} />
                      </div>
                      <div>
                        <p className="text-base font-black text-[color:var(--color-text)]">{s.fantasyName}</p>
                        <p className="text-xs text-slate-400 font-bold">CNPJ: {s.cnpj || 'Não informado'}</p>
                      </div>
                   </div>
                </td>
                <td className="px-8 py-6">
                  <span className="text-sm font-black text-[color:var(--color-muted)] bg-slate-100 px-3 py-1 rounded-lg">{s.group?.name || 'Sem Rede'}</span>
                </td>
                <td className="px-8 py-6">
                  <p className="text-sm font-bold text-[color:var(--color-muted)]">{s.city} - {s.state}</p>
                </td>
                <td className="px-8 py-6 text-center">
                   <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider ${
                      s.classification === 'Ouro' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-[color:var(--color-muted)]'
                   }`}>
                      {s.classification}
                   </span>
                </td>
                <td className="px-8 py-6 text-right">
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => handleEdit(s)}
                      className="p-3 text-slate-400 hover:bg-blue-50 rounded-xl transition-all"
                      title="Editar"
                    >
                      <Edit size={20} className="text-blue-500" />
                    </button>
                    <button 
                      onClick={() => handleDelete(s.id)}
                      className="p-3 text-slate-400 hover:bg-red-50 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Excluir"
                      disabled={deletingId === s.id}
                    >
                      {deletingId === s.id ? (
                        <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 size={20} className="text-red-500" />
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        ) : (
           <div className="h-[600px] w-full relative z-0">
              <MapContainer center={[-14.2350, -51.9253]} zoom={4} style={{ height: '100%', width: '100%' }}>
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  {filteredSupermarkets.filter(s => s.latitude && s.longitude).map(s => (
                      <Marker key={s.id} position={[parseFloat(s.latitude), parseFloat(s.longitude)]}>
                          <Popup>
                              <div className="min-w-[200px]">
                                  <strong className="block text-lg mb-1">{s.fantasyName}</strong>
                                  <p className="text-sm text-gray-600 mb-2">{s.street}, {s.number} - {s.neighborhood}</p>
                                  <p className="text-sm text-gray-600 mb-2">{s.city} - {s.state}</p>
                                  <div className="flex gap-2 mt-2">
                                      <button 
                                        onClick={() => handleEdit(s)}
                                        className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
                                      >
                                        Editar
                                      </button>
                                  </div>
                              </div>
                          </Popup>
                      </Marker>
                  ))}
              </MapContainer>
           </div>
        )}
      </div>

      {/* Modal de Cadastro/Edição */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md px-8 py-6 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-black text-[color:var(--color-text)]">
                  {editingSupermarket ? 'Editar Supermercado' : 'Novo Supermercado'}
                </h2>
                <p className="text-[color:var(--color-muted)] font-medium">Preencha os dados do ponto de venda</p>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={24} className="text-slate-400" />
              </button>
            </div>
            
            <div className="flex border-b border-slate-100">
              <button 
                type="button"
                className={`flex-1 px-8 py-4 font-bold text-sm uppercase tracking-wider transition-all border-b-2 ${activeTab === 'general' ? 'border-blue-500 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-400 hover:text-[color:var(--color-muted)] hover:bg-slate-50'}`}
                onClick={() => setActiveTab('general')}
              >
                Dados Gerais
              </button>
              <button 
                type="button"
                className={`flex-1 px-8 py-4 font-bold text-sm uppercase tracking-wider transition-all border-b-2 ${activeTab === 'location' ? 'border-blue-500 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-400 hover:text-[color:var(--color-muted)] hover:bg-slate-50'}`}
                onClick={() => setActiveTab('location')}
              >
                Endereço e Localização
              </button>
              <button 
                type="button"
                className={`flex-1 px-8 py-4 font-bold text-sm uppercase tracking-wider transition-all border-b-2 ${activeTab === 'clients' ? 'border-blue-500 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-400 hover:text-[color:var(--color-muted)] hover:bg-slate-50'}`}
                onClick={() => setActiveTab('clients')}
              >
                Clientes Vinculados
              </button>
              <button 
                type="button"
                className={`flex-1 px-8 py-4 font-bold text-sm uppercase tracking-wider transition-all border-b-2 ${activeTab === 'products' ? 'border-blue-500 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-400 hover:text-[color:var(--color-muted)] hover:bg-slate-50'}`}
                onClick={() => setActiveTab('products')}
              >
                Produtos (Mix)
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-8 space-y-8">
              {activeTab === 'general' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-left-4 duration-300">
                    <div className="md:col-span-2">
                       <label className="text-[11px] font-black text-slate-400 uppercase mb-3 block tracking-widest">Nome Fantasia *</label>
                       <input 
                           type="text" 
                           name="fantasyName"
                           value={formData.fantasyName}
                           onChange={handleChange}
                           className="w-full h-14 px-6 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:ring-4 focus:ring-blue-100 transition-all font-bold text-[color:var(--color-text)]" 
                           placeholder="Ex: Pão de Açúcar - Loja 102"
                           required
                       />
                    </div>
    
                    <div>
                       <label className="text-[11px] font-black text-slate-400 uppercase mb-3 block tracking-widest">CNPJ</label>
                       <input 
                           type="text" 
                           name="cnpj"
                           value={formData.cnpj}
                           onChange={handleChange}
                           className="w-full h-14 px-6 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:ring-4 focus:ring-blue-100 transition-all font-bold text-[color:var(--color-text)]" 
                           placeholder="00.000.000/0000-00"
                       />
                    </div>
                    
                    <div>
                       <SearchableSelect 
                           label="Rede / Grupo"
                           placeholder="Selecione..."
                           value={formData.groupId}
                           onChange={(val) => setFormData(prev => ({ ...prev, groupId: val }))}
                           options={[
                              { value: '', label: 'Selecione...' },
                              ...groups.map(group => ({ value: group.id, label: group.name }))
                           ]}
                       />
                    </div>
    
                    <div>
                       <SearchableSelect 
                           label="Classificação"
                           value={formData.classification}
                           onChange={(val) => setFormData(prev => ({ ...prev, classification: val }))}
                           options={[
                              { value: 'Ouro', label: 'Ouro' },
                              { value: 'Prata', label: 'Prata' },
                              { value: 'Bronze', label: 'Bronze' }
                           ]}
                       />
                    </div>
                </div>
              )}

              {activeTab === 'location' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div>
                       <label className="text-[11px] font-black text-slate-400 uppercase mb-3 block tracking-widest">CEP</label>
                       <div className="relative">
                           <input 
                               type="text" 
                               name="zipCode"
                               value={formData.zipCode}
                               onChange={handleChange}
                               onBlur={handleCepBlur}
                               className="w-full h-14 px-6 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:ring-4 focus:ring-blue-100 transition-all font-bold text-[color:var(--color-text)]" 
                               placeholder="00000-000" 
                           />
                           {cepLoading && <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400">Buscando...</div>}
                       </div>
                    </div>
    
                    <div>
                       <label className="text-[11px] font-black text-slate-400 uppercase mb-3 block tracking-widest">Estado (UF)</label>
                       <input 
                           type="text" 
                           name="state"
                           value={formData.state}
                           onChange={handleChange}
                           className="w-full h-14 px-6 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:ring-4 focus:ring-blue-100 transition-all font-bold text-[color:var(--color-text)]" 
                           placeholder="SP" 
                       />
                    </div>
    
                    <div>
                       <label className="text-[11px] font-black text-slate-400 uppercase mb-3 block tracking-widest">Cidade *</label>
                       <input 
                           type="text" 
                           name="city"
                           value={formData.city}
                           onChange={handleChange}
                           className="w-full h-14 px-6 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:ring-4 focus:ring-blue-100 transition-all font-bold text-[color:var(--color-text)]" 
                           placeholder="Cidade" 
                           required
                       />
                    </div>
    
                    <div>
                       <label className="text-[11px] font-black text-slate-400 uppercase mb-3 block tracking-widest">Bairro</label>
                       <input 
                           type="text" 
                           name="neighborhood"
                           value={formData.neighborhood}
                           onChange={handleChange}
                           className="w-full h-14 px-6 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:ring-4 focus:ring-blue-100 transition-all font-bold text-[color:var(--color-text)]" 
                           placeholder="Bairro" 
                       />
                    </div>
    
                    <div className="md:col-span-2">
                       <label className="text-[11px] font-black text-slate-400 uppercase mb-3 block tracking-widest">Logradouro (Rua, Av...)</label>
                       <input 
                           type="text" 
                           name="street"
                           value={formData.street}
                           onChange={handleChange}
                           className="w-full h-14 px-6 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:ring-4 focus:ring-blue-100 transition-all font-bold text-[color:var(--color-text)]" 
                           placeholder="Nome da Rua" 
                       />
                    </div>
    
                    <div>
                       <label className="text-[11px] font-black text-slate-400 uppercase mb-3 block tracking-widest">Número</label>
                       <input 
                           type="text" 
                           name="number"
                           value={formData.number}
                           onChange={handleChange}
                           className="w-full h-14 px-6 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:ring-4 focus:ring-blue-100 transition-all font-bold text-[color:var(--color-text)]" 
                           placeholder="123" 
                       />
                    </div>
    
                    <div>
                       <label className="text-[11px] font-black text-slate-400 uppercase mb-3 block tracking-widest">Complemento</label>
                       <input 
                           type="text" 
                           name="complement"
                           value={formData.complement}
                           onChange={handleChange}
                           className="w-full h-14 px-6 rounded-2xl bg-slate-50 border border-slate-200 outline-none focus:ring-4 focus:ring-blue-100 transition-all font-bold text-[color:var(--color-text)]" 
                           placeholder="Bloco A, Sala 1" 
                       />
                    </div>

                    <div className="md:col-span-2 border-t border-slate-100 pt-6 mt-2 flex flex-col gap-4">
                       <div className="flex justify-between items-center">
                         <h3 className="text-lg font-black text-[color:var(--color-text)]">Coordenadas Geográficas</h3>
                         <button
                           type="button"
                           onClick={() => setShowMapModal(true)}
                           className="flex items-center gap-2 text-blue-500 font-bold hover:bg-blue-50 px-4 py-2 rounded-xl transition-colors"
                         >
                           <MapPin size={18} />
                           Selecionar no Mapa
                         </button>
                       </div>
                       
                       <div className="grid grid-cols-2 gap-4">
                          <div>
                             <label className="text-[11px] font-black text-slate-400 uppercase mb-3 block tracking-widest">Latitude</label>
                             <input 
                                 type="number" 
                                 step="any"
                                 value={formData.latitude || ''}
                                 readOnly
                                 className="w-full h-14 px-6 rounded-2xl bg-slate-100 border border-slate-200 outline-none font-bold text-[color:var(--color-muted)] cursor-not-allowed" 
                                 placeholder="Latitude" 
                             />
                          </div>
                          <div>
                             <label className="text-[11px] font-black text-slate-400 uppercase mb-3 block tracking-widest">Longitude</label>
                             <input 
                                 type="number" 
                                 step="any"
                                 value={formData.longitude || ''}
                                 readOnly
                                 className="w-full h-14 px-6 rounded-2xl bg-slate-100 border border-slate-200 outline-none font-bold text-[color:var(--color-muted)] cursor-not-allowed" 
                                 placeholder="Longitude" 
                             />
                          </div>
                       </div>
                    </div>
                </div>
              )}

              {activeTab === 'clients' && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="mb-6">
                    <h3 className="text-lg font-black text-[color:var(--color-text)] mb-2">Vínculo com Clientes</h3>
                    <p className="text-sm text-[color:var(--color-muted)]">Selecione os clientes que atuam neste supermercado.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto pr-2">
                    {clients.map(client => (
                      <div 
                        key={client.id}
                        onClick={() => handleClientToggle(client.id)}
                        className={`
                          cursor-pointer p-4 rounded-xl border-2 transition-all flex items-center gap-4 group
                          ${formData.clientIds.includes(client.id) 
                            ? 'border-blue-500 bg-blue-50' 
                            : 'border-slate-100 hover:border-blue-200 hover:bg-slate-50'}
                        `}
                      >
                        <div className={`
                          w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors
                          ${formData.clientIds.includes(client.id)
                            ? 'bg-blue-500 border-blue-500 text-white'
                            : 'border-slate-300 group-hover:border-blue-300'}
                        `}>
                          {formData.clientIds.includes(client.id) && (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[color:var(--color-text)] truncate">{client.nomeFantasia || client.razaoSocial}</p>
                          <p className="text-xs text-[color:var(--color-muted)] font-medium">CNPJ: {client.cnpj}</p>
                        </div>
                      </div>
                    ))}
                    
                    {clients.length === 0 && (
                      <div className="col-span-full py-8 text-center text-slate-400 font-medium">
                        Nenhum cliente cadastrado.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'products' && (
                <div key="products-tab" className="space-y-6">
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4">
                    <p className="text-sm text-blue-800">
                      Gerencie o Mix de Produtos deste ponto de venda. Selecione uma marca para visualizar e vincular produtos.
                    </p>
                  </div>

                  <div>
                    <SearchableSelect 
                        key="brand-select"
                        label="Selecione a Marca para filtrar produtos"
                        placeholder="Selecione uma marca..."
                        value={selectedBrandForMix}
                        onChange={(val) => setSelectedBrandForMix(val)}
                        options={[
                          { value: '', label: 'Selecione...' },
                          ...(Array.isArray(brands) ? brands.filter(b => b && b.id && b.name).map(brand => ({ value: brand.id, label: brand.name })) : [])
                        ]}
                    />
                  </div>

                  {selectedBrandForMix && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-[500px]">
                      {/* Available Products */}
                      <div className="flex flex-col h-full border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                        <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                          <h3 className="font-bold text-[color:var(--color-text)]">Disponíveis</h3>
                          <span className="text-xs bg-slate-200 text-[color:var(--color-muted)] px-2 py-1 rounded-full">
                            {Array.isArray(products) ? products.filter(p => (p.brand?.id === selectedBrandForMix || p.brandId === selectedBrandForMix) && !formData.productIds.includes(p.id)).length : 0}
                          </span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                          {Array.isArray(products) && products
                            .filter(p => (p.brand?.id === selectedBrandForMix || p.brandId === selectedBrandForMix) && !formData.productIds.includes(p.id))
                            .map(product => (
                              <div 
                                key={product.id}
                                onClick={() => setFormData(prev => ({ ...prev, productIds: [...prev.productIds, product.id] }))}
                                className="p-3 rounded-xl border border-slate-100 hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-all group flex items-center justify-between"
                              >
                                <div className="flex items-center gap-3">
                                  {product.image ? (
                                    <img src={product.image} alt="" className="w-8 h-8 rounded-lg object-cover bg-white" />
                                  ) : (
                                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                                      <Package size={14} className="text-slate-400" />
                                    </div>
                                  )}
                                  <div>
                                    <p className="text-sm font-medium text-[color:var(--color-text)] group-hover:text-blue-700">{product.name}</p>
                                    {product.sku && <p className="text-[10px] text-slate-400">SKU: {product.sku}</p>}
                                  </div>
                                </div>
                                <Plus size={16} className="text-slate-300 group-hover:text-blue-500" />
                              </div>
                            ))
                          }
                          {Array.isArray(products) && products.filter(p => (p.brand?.id === selectedBrandForMix || p.brandId === selectedBrandForMix) && !formData.productIds.includes(p.id)).length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                              <p className="text-sm">Todos os produtos desta marca já foram selecionados.</p>
                            </div>
                          )}
                        </div>
                        <div className="p-3 border-t border-slate-100 bg-slate-50">
                           <button
                             type="button" 
                             onClick={() => {
                               const available = products
                                 .filter(p => (p.brand?.id === selectedBrandForMix || p.brandId === selectedBrandForMix) && !formData.productIds.includes(p.id))
                                 .map(p => p.id);
                               setFormData(prev => ({ ...prev, productIds: [...prev.productIds, ...available] }));
                             }}
                             className="w-full py-2 text-xs font-bold text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                           >
                             Adicionar Todos
                           </button>
                        </div>
                      </div>

                      {/* Selected Products */}
                      <div className="flex flex-col h-full border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                        <div className="bg-green-50 px-4 py-3 border-b border-green-100 flex justify-between items-center">
                          <h3 className="font-bold text-green-800">Selecionados (Mix)</h3>
                          <span className="text-xs bg-green-200 text-green-700 px-2 py-1 rounded-full">
                            {Array.isArray(products) ? products.filter(p => (p.brand?.id === selectedBrandForMix || p.brandId === selectedBrandForMix) && formData.productIds.includes(p.id)).length : 0}
                          </span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                          {Array.isArray(products) && products
                            .filter(p => (p.brand?.id === selectedBrandForMix || p.brandId === selectedBrandForMix) && formData.productIds.includes(p.id))
                            .map(product => (
                              <div 
                                key={product.id}
                                onClick={() => setFormData(prev => ({ ...prev, productIds: prev.productIds.filter(id => id !== product.id) }))}
                                className="p-3 rounded-xl border border-green-100 bg-green-50/30 hover:border-red-300 hover:bg-red-50 cursor-pointer transition-all group flex items-center justify-between"
                              >
                                <div className="flex items-center gap-3">
                                  {product.image ? (
                                    <img src={product.image} alt="" className="w-8 h-8 rounded-lg object-cover bg-white" />
                                  ) : (
                                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                                      <Package size={14} className="text-slate-400" />
                                    </div>
                                  )}
                                  <div>
                                    <p className="text-sm font-medium text-[color:var(--color-text)] group-hover:text-red-700">{product.name}</p>
                                    {product.sku && <p className="text-[10px] text-slate-400">SKU: {product.sku}</p>}
                                  </div>
                                </div>
                                <X size={16} className="text-green-300 group-hover:text-red-500" />
                              </div>
                            ))
                          }
                           {Array.isArray(products) && products.filter(p => (p.brand?.id === selectedBrandForMix || p.brandId === selectedBrandForMix) && formData.productIds.includes(p.id)).length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                              <p className="text-sm">Nenhum produto selecionado para esta marca.</p>
                            </div>
                          )}
                        </div>
                        <div className="p-3 border-t border-slate-100 bg-slate-50">
                           <button 
                             type="button"
                             onClick={() => {
                               const toRemove = products
                                 .filter(p => (p.brand?.id === selectedBrandForMix || p.brandId === selectedBrandForMix) && formData.productIds.includes(p.id))
                                 .map(p => p.id);
                               setFormData(prev => ({ ...prev, productIds: prev.productIds.filter(id => !toRemove.includes(id)) }));
                             }}
                             className="w-full py-2 text-xs font-bold text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                           >
                             Remover Todos
                           </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-6 border-t border-slate-100 flex justify-end gap-4">
                 <button 
                   type="button"
                   onClick={() => setShowModal(false)} 
                   className="px-6 py-3 font-bold text-[color:var(--color-muted)] hover:bg-slate-50 rounded-xl transition-all"
                 >
                   Cancelar
                 </button>
                 <button 
                   type="submit"
                   className="px-8 py-3 text-white font-black rounded-xl shadow-lg shadow-blue-200 hover:scale-105 transition-all"
                   style={{ backgroundColor: settings.primaryColor }}
                 >
                   {editingSupermarket ? 'Salvar Alterações' : 'Criar Supermercado'}
                 </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <MapModal
        isOpen={showMapModal}
        onClose={() => setShowMapModal(false)}
        onConfirm={handleLocationConfirm}
        initialLat={formData.latitude || undefined}
        initialLng={formData.longitude || undefined}
        address={`${formData.street || ''} ${formData.number || ''}, ${formData.city || ''} - ${formData.state || ''}`}
      />
    </div>
  );
};

export default SupermarketsListView;