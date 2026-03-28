import React, { useState, useEffect } from 'react';
import { Search, Plus, X, Edit, Trash, ChevronDown, Check, Wand2, Image as ImageIcon, ArrowRightLeft } from 'lucide-react';
import { useBranding } from '../context/BrandingContext';
import { SearchableSelect } from '../components/SearchableSelect';
import { SearchableMultiSelect } from '../components/SearchableMultiSelect';
import api, { API_URL } from '../api/client';
import { getImageUrl } from '../utils/image';

const ProductImage = ({ src, alt }: { src: string, alt: string }) => {
  const [error, setError] = useState(false);
  
  if (!src || error) {
    return <ImageIcon className="text-slate-300" size={48} />;
  }
  
  return (
    <img 
      src={src} 
      className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110" 
      alt={alt} 
      onError={() => setError(true)}
    />
  );
};

const ProductsView: React.FC = () => {
  const { settings } = useBranding();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState('Todos os Clientes');
  const [products, setProducts] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [checklists, setChecklists] = useState<any[]>([]);
  const [supermarketGroups, setSupermarketGroups] = useState<any[]>([]);
  const [supermarkets, setSupermarkets] = useState<any[]>([]);
  const [aiPrompts, setAiPrompts] = useState<any[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [referenceImageFile, setReferenceImageFile] = useState<File | null>(null);
  const [referenceImagePreview, setReferenceImagePreview] = useState<string>('');
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [activeTab, setActiveTab] = useState<'geral' | 'ia' | 'pdvs'>('geral');
  const [leftSearch, setLeftSearch] = useState('');
  const [rightSearch, setRightSearch] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('');

  const [productForm, setProductForm] = useState({
    name: '',
    sku: '',
    category: '',
    categoryId: '',
    image: '',
    brandId: '',
    clientId: '',
    barcode: '',
    subcategory: '',
    status: 'active',
    checklistTemplateId: '',
    referenceImageUrl: '',
    analysisPrompt: '',
    supermarketGroupIds: [] as string[],
    supermarketIds: [] as string[]
  });

  const [selectedParentId, setSelectedParentId] = useState('');
  const [selectedSubId, setSelectedSubId] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [productsRes, clientsRes, brandsRes, categoriesRes, checklistsRes, promptsRes, groupsRes, supermarketsRes] = await Promise.all([
        api.get('/products'),
        api.get('/clients'),
        api.get('/brands'),
        api.get('/categories'),
        api.get('/checklists'),
        api.get('/ai/prompts'),
        api.get('/supermarket-groups'),
        api.get('/supermarkets')
      ]);

      const mappedClients = clientsRes.data.map((c: any) => ({
        id: c.id,
        nome: c.nomeFantasia || c.razaoSocial,
        logo: getImageUrl(c.logo) || 'https://placehold.co/150'
      }));
      setClients(mappedClients);
      setBrands(brandsRes.data);
      setCategories(categoriesRes.data);
      setChecklists(checklistsRes.data.filter((c: any) => c.active));
      setAiPrompts(promptsRes.data);
      setSupermarketGroups(groupsRes.data);
      setSupermarkets(supermarketsRes.data);

      const mappedProducts = productsRes.data.map((p: any) => {
        const imgUrl = getImageUrl(p.image);
        
        return {
        id: p.id,
        nome: p.name,
        sku: p.sku,
        categoria: p.category,
        categoryId: p.categoryRef?.id,
        imagem: imgUrl,
        brandId: p.brand?.id,
        clientId: p.client?.id,
        barcode: p.barcode,
        subcategory: p.subcategory,
        status: p.status,
        categoryRef: p.categoryRef,
        checklistTemplateId: p.checklistTemplate?.id || '',
        referenceImageUrl: p.referenceImageUrl,
        analysisPrompt: p.analysisPrompt,
        supermarketGroupIds: p.supermarketGroups?.map((g: any) => g.id) || []
      }});
      setProducts(mappedProducts);

    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePrompt = async () => {
    // We allow generation if we have a saved product ID OR if we have a local file (though backend needs ID for now, 
    // but with our change backend can take file + ID). 
    // Actually, backend needs productId to verify product exists, but if we pass file, it doesn't need saved image.
    // So we still need editingProduct.id.
    
    if (!editingProduct?.id) {
        alert('Salve o produto antes de gerar o prompt.');
        return;
    }
    
    // If no local file and no saved URL, we can't generate
    if (!referenceImageFile && !productForm.referenceImageUrl) {
        alert('O produto precisa ter uma imagem de referência (carregue uma nova ou salve uma URL).');
        return;
    }

    setGeneratingPrompt(true);
    try {
        let res;
        
        if (referenceImageFile) {
            // Use FormData to send file
            const formData = new FormData();
            formData.append('productId', editingProduct.id);
            if (selectedPromptId) {
                formData.append('promptId', selectedPromptId);
            }
            formData.append('image', referenceImageFile);
            
            res = await api.post('/ai/generate-product-prompt', formData);
        } else {
            // Use JSON for existing saved image
            res = await api.post('/ai/generate-product-prompt', {
                productId: editingProduct.id,
                promptId: selectedPromptId
            });
        }
        
        setProductForm(prev => ({ ...prev, analysisPrompt: res.data.description }));
        alert('Prompt gerado com sucesso!');
    } catch (error: any) {
        console.error('Error generating prompt', error);
        const msg = error.response?.data?.message || error.message || 'Erro ao gerar prompt.';
        alert(`Erro: ${msg}`);
    } finally {
        setGeneratingPrompt(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!productForm.clientId) {
      alert('Por favor, selecione um Fabricante/Cliente.');
      return;
    }

    try {
      const formData = new FormData();
      
      // Append fields
      Object.keys(productForm).forEach(key => {
        const value = productForm[key as keyof typeof productForm];
        
        // Skip empty optional fields
        if ((key === 'brandId' || key === 'clientId' || key === 'categoryId' || key === 'checklistTemplateId') && !value) return;
        
        // Skip image string if we are uploading a file (controller will handle it)
        // Or if it's just the placeholder/empty
        if (key === 'image') return; 

        // Handle supermarketGroupIds specifically
        if (key === 'supermarketGroupIds') {
           const val = productForm.supermarketGroupIds;
           if (Array.isArray(val)) {
             formData.append('supermarketGroupIds', JSON.stringify(val));
           } else {
             formData.append('supermarketGroupIds', '[]');
           }
           return;
        }

        // Handle supermarketIds specifically
        if (key === 'supermarketIds') {
           const val = productForm.supermarketIds;
           if (Array.isArray(val)) {
             formData.append('supermarketIds', JSON.stringify(val));
           } else {
             formData.append('supermarketIds', '[]');
           }
           return;
        }

        if (value !== undefined && value !== null) {
          formData.append(key, value as string);
        }
      });

      // Handle Category Logic
      const finalCategoryId = selectedSubId || selectedParentId;
      if (finalCategoryId) {
        formData.set('categoryId', finalCategoryId);
        
        // Update legacy strings
        const selectedCat = categories.find(c => c.id === finalCategoryId);
        if (selectedCat) {
          if (selectedCat.parent) {
            // It's a subcategory
            formData.set('category', selectedCat.parent.name);
            formData.set('subcategory', selectedCat.name);
          } else {
            // It's a parent category
            formData.set('category', selectedCat.name);
            formData.set('subcategory', '');
          }
        }
      }

      // Append file if exists
      if (imageFile) {
        formData.append('image', imageFile);
      } else if (productForm.image && productForm.image !== 'https://via.placeholder.com/150') {
         // If no new file, but we have an existing image URL, we might want to keep it.
         // Strip API_URL if present to save relative path
         let imageUrl = productForm.image;
         if (imageUrl.startsWith(API_URL)) {
            imageUrl = imageUrl.replace(API_URL, '');
         } else if (imageUrl.startsWith('http')) {
            // Try to extract relative path if it matches expected pattern
            try {
              const urlObj = new URL(imageUrl);
              imageUrl = urlObj.pathname; // This will keep /uploads/...
            } catch (e) {
              // If invalid URL, keep as is
            }
         }
         formData.append('image', imageUrl);
      }

      // Append Reference Image if exists
      if (referenceImageFile) {
        formData.append('referenceImage', referenceImageFile);
      } else if (productForm.referenceImageUrl) {
         let refUrl = productForm.referenceImageUrl;
         if (refUrl.startsWith(API_URL)) {
            refUrl = refUrl.replace(API_URL, '');
         } else if (refUrl.startsWith('http')) {
            try {
              const urlObj = new URL(refUrl);
              refUrl = urlObj.pathname;
            } catch (e) {}
         }
         formData.append('referenceImageUrl', refUrl);
      }
      
      if (editingProduct) {
        await api.patch(`/products/${editingProduct.id}`, formData);
        alert('Produto atualizado com sucesso!');
      } else {
        await api.post('/products', formData);
        alert('Produto criado com sucesso!');
      }
      
      setShowModal(false);
      setEditingProduct(null);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error("Error saving product:", error);
      console.error("Error details:", error.response?.data);
      
      let msg = 'Erro desconhecido.';
      if (error.response?.data) {
        if (typeof error.response.data === 'string') {
            msg = error.response.data;
        } else if (error.response.data.message) {
            msg = Array.isArray(error.response.data.message) 
            ? error.response.data.message.join('\n') 
            : JSON.stringify(error.response.data.message);
        } else {
            msg = JSON.stringify(error.response.data);
        }
      } else if (error.message) {
        msg = error.message;
      }
      
      alert(`Erro ao salvar produto:\n${msg}`);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;
    try {
      await api.delete(`/products/${id}`);
      fetchData();
    } catch (error) {
      console.error("Error deleting product:", error);
      alert('Erro ao excluir produto.');
    }
  };

  const openEditModal = (product: any) => {
    setEditingProduct(product);
    
    // Determine IDs from product.categoryRef
    let pId = '';
    let sId = '';
    
    if (product.categoryRef) {
      if (product.categoryRef.parent) {
        pId = product.categoryRef.parent.id;
        sId = product.categoryRef.id;
      } else {
        pId = product.categoryRef.id;
        sId = '';
      }
    } else if (product.categoryId) {
       // Fallback: try to find category by ID in our list
       const cat = categories.find(c => c.id === product.categoryId);
       if (cat) {
         if (cat.parent) {
            pId = cat.parent.id;
            sId = cat.id;
         } else {
            pId = cat.id;
            sId = '';
         }
       }
    }

    setSelectedParentId(pId);
    setSelectedSubId(sId);

    setProductForm({
      name: product.nome,
      sku: product.sku,
      category: product.categoria,
      categoryId: product.categoryId || product.categoryRef?.id || '',
      image: product.imagem === 'https://via.placeholder.com/150' ? '' : product.imagem,
      brandId: product.brandId || '',
      clientId: product.clientId || '',
      barcode: product.barcode || '',
      subcategory: product.subcategory || '',
      status: product.status || 'active',
      checklistTemplateId: product.checklistTemplateId || '',
      referenceImageUrl: product.referenceImageUrl || '',
      analysisPrompt: product.analysisPrompt || '',
      supermarketGroupIds: product.supermarketGroups ? product.supermarketGroups.map((g: any) => g.id) : [],
      supermarketIds: product.supermarkets ? product.supermarkets.map((s: any) => s.id) : []
    });
    
    setImagePreview(product.imagem === 'https://via.placeholder.com/150' ? '' : product.imagem);
    setImageFile(null);
    setReferenceImagePreview(product.referenceImageUrl ? getImageUrl(product.referenceImageUrl) : '');
    setReferenceImageFile(null);
    setShowModal(true);
  };

  const resetForm = () => {
    setProductForm({
      name: '',
      sku: '',
      category: '',
      categoryId: '',
      image: '',
      brandId: '',
      clientId: '',
      barcode: '',
      subcategory: '',
      status: 'active',
      checklistTemplateId: '',
      referenceImageUrl: '',
      analysisPrompt: '',
      supermarketGroupIds: [],
      supermarketIds: []
    });
    setSelectedParentId('');
    setSelectedSubId('');
    setImagePreview('');
    setImageFile(null);
    setReferenceImagePreview('');
    setReferenceImageFile(null);
    setLeftSearch('');
    setRightSearch('');
    setSelectedGroupFilter('');
    setActiveTab('geral');
  };

  const addToSelected = (id: string) => {
    setProductForm(prev => ({
      ...prev,
      supermarketIds: [...prev.supermarketIds, id]
    }));
  };

  const removeFromSelected = (id: string) => {
    setProductForm(prev => ({
      ...prev,
      supermarketIds: prev.supermarketIds.filter(sid => sid !== id)
    }));
  };

  const handleAddAllFiltered = () => {
    const filteredToAdd = supermarkets
      .filter(s => !productForm.supermarketIds.includes(s.id))
      .filter(s => !selectedGroupFilter || (s.group?.id === selectedGroupFilter))
      .filter(s => (s.fantasyName || '').toLowerCase().includes(leftSearch.toLowerCase()))
      .map(s => s.id);
      
    if (filteredToAdd.length > 0) {
      setProductForm(prev => ({
        ...prev,
        supermarketIds: [...prev.supermarketIds, ...filteredToAdd]
      }));
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.sku.includes(searchTerm) || 
                          p.categoria.toLowerCase().includes(searchTerm.toLowerCase());
    
    const clientName = clients.find(c => c.id === p.clientId)?.nome || '';
    const matchesClient = selectedClient === 'Todos os Clientes' || clientName === selectedClient;

    return matchesSearch && matchesClient;
  });

  if (loading) return <div className="p-8">Carregando produtos...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-2xl font-black text-[color:var(--color-text)] tracking-tight">Catálogo de SKUs</h1>
          <p className="text-[color:var(--color-muted)] font-medium text-lg">Controle central de mix de produtos.</p>
        </div>
        <button 
          onClick={() => {
            setEditingProduct(null);
            resetForm();
            setShowModal(true);
          }}
          className="flex items-center gap-2 text-white px-8 py-3 rounded-2xl font-black shadow-xl shadow-blue-200 hover:scale-105 transition-all"
          style={{ backgroundColor: settings.primaryColor }}
        >
          <Plus size={20} />
          Adicionar Produto
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6 bg-slate-50/50 border-b border-slate-200 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Filtrar por nome, SKU ou categoria..." 
              className="w-full pl-12 h-12 rounded-xl border border-slate-200 outline-none focus:ring-4 focus:ring-blue-100 transition-all text-sm font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-64">
            <SearchableSelect
              placeholder="Todos os Clientes"
              value={selectedClient === 'Todos os Clientes' ? '' : selectedClient}
              onChange={(val) => setSelectedClient(val || 'Todos os Clientes')}
              options={[
                { value: '', label: 'Todos os Clientes' },
                ...clients.map(c => ({ value: c.nome, label: c.nome }))
              ]}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-8">
          {filteredProducts.map(p => (
            <div key={p.id} className="group border border-slate-100 rounded-2xl p-5 hover:shadow-xl transition-all bg-white relative">
               <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                <button 
                  onClick={() => openEditModal(p)}
                  className="p-2 bg-white rounded-full shadow-sm hover:bg-slate-50 text-blue-600"
                >
                  <Edit size={16} />
                </button>
                <button 
                  onClick={() => handleDeleteProduct(p.id)}
                  className="p-2 bg-white rounded-full shadow-sm hover:bg-slate-50 text-red-600"
                >
                  <Trash size={16} />
                </button>
              </div>
              
              <div className="relative aspect-square overflow-hidden rounded-xl mb-5 bg-slate-50 flex items-center justify-center">
                <ProductImage src={getImageUrl(p.imagem)} alt={p.nome} />
                <div className="absolute top-2 left-2 px-3 py-1 bg-white/90 backdrop-blur-sm rounded-lg text-[9px] font-black text-[color:var(--color-text)] border border-slate-100 shadow-sm">
                  {p.sku}
                </div>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: settings.primaryColor }}>{p.categoria}</p>
              <h4 className="text-lg font-black text-[color:var(--color-text)] truncate mb-1">{p.nome}</h4>
              <div className="flex items-center gap-2 mt-4">
                <div className="h-6 w-6 rounded-lg border border-slate-100 flex items-center justify-center p-1">
                  <img src={clients.find(c => c.id === p.clientId)?.logo} className="object-contain" alt="" />
                </div>
                <span className="text-[11px] font-black text-[color:var(--color-muted)]">{clients.find(c => c.id === p.clientId)?.nome}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-black text-[color:var(--color-text)]">
                {editingProduct ? 'Editar Produto' : 'Novo Produto'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-[color:var(--color-muted)]">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSaveProduct} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Tabs */}
              <div className="flex gap-6 border-b border-slate-200 mb-6">
                <button 
                  type="button"
                  onClick={() => setActiveTab('geral')}
                  className={`pb-4 text-sm font-black uppercase tracking-widest transition-all ${
                    activeTab === 'geral' 
                      ? 'border-b-4 text-[color:var(--color-text)]' 
                      : 'text-slate-400 hover:text-[color:var(--color-muted)]'
                  }`}
                  style={{ borderColor: activeTab === 'geral' ? settings.primaryColor : 'transparent' }}
                >
                  Geral
                </button>
                <button 
                  type="button"
                  onClick={() => setActiveTab('pdvs')}
                  className={`pb-4 text-sm font-black uppercase tracking-widest transition-all ${
                    activeTab === 'pdvs' 
                      ? 'border-b-4 text-[color:var(--color-text)]' 
                      : 'text-slate-400 hover:text-[color:var(--color-muted)]'
                  }`}
                  style={{ borderColor: activeTab === 'pdvs' ? settings.primaryColor : 'transparent' }}
                >
                  Disponibilidade (PDVs)
                </button>
                <button 
                  type="button"
                  onClick={() => setActiveTab('ia')}
                  className={`pb-4 text-sm font-black uppercase tracking-widest transition-all ${
                    activeTab === 'ia' 
                      ? 'border-b-4 text-[color:var(--color-text)]' 
                      : 'text-slate-400 hover:text-[color:var(--color-muted)]'
                  }`}
                  style={{ borderColor: activeTab === 'ia' ? settings.primaryColor : 'transparent' }}
                >
                  IA & Imagens
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ display: activeTab === 'geral' ? 'grid' : 'none' }}>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-[color:var(--color-muted)] uppercase mb-2">Nome do Produto</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all font-medium"
                    value={productForm.name}
                    onChange={e => setProductForm({...productForm, name: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[color:var(--color-muted)] uppercase mb-2">SKU</label>
                  <input
                    type="text"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all font-medium"
                    value={productForm.sku}
                    onChange={e => setProductForm({...productForm, sku: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[color:var(--color-muted)] uppercase mb-2">Código de Barras</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-50 focus:border-blue-500 outline-none transition-all font-medium"
                    value={productForm.barcode}
                    onChange={e => setProductForm({...productForm, barcode: e.target.value})}
                  />
                </div>

                <div>
                  <SearchableSelect
                    label="Categoria"
                    required
                    placeholder="Selecione..."
                    value={selectedParentId}
                    onChange={(val) => {
                      setSelectedParentId(val);
                      setSelectedSubId('');
                    }}
                    options={categories.filter(c => !c.parent).map(c => ({ value: c.id, label: c.name }))}
                  />
                </div>

                <div>
                  <SearchableSelect
                    label="Subcategoria"
                    placeholder="Selecione..."
                    value={selectedSubId}
                    onChange={(val) => setSelectedSubId(val)}
                    disabled={!selectedParentId}
                    options={selectedParentId ? [
                      { value: '', label: 'Nenhuma' },
                      ...categories.filter(c => c.parent?.id === selectedParentId).map(c => ({ value: c.id, label: c.name }))
                    ] : []}
                  />
                </div>

                <div>
                  <SearchableSelect
                    label="Marca"
                    required
                    placeholder="Selecione..."
                    value={productForm.brandId}
                    onChange={(val) => {
                      const selectedBrandId = val;
                      const brand = brands.find(b => b.id === selectedBrandId);
                      const newClientId = brand?.client?.id || productForm.clientId;
                      
                      setProductForm(prev => ({
                        ...prev, 
                        brandId: selectedBrandId,
                        // Auto-select client if brand has one
                        clientId: newClientId
                      }));
                    }}
                    options={brands.map(b => ({ value: b.id, label: b.name }))}
                  />
                </div>

                <div>
                  <SearchableSelect
                    label="Fabricante/Cliente"
                    required
                    placeholder="Buscar Cliente..."
                    value={productForm.clientId}
                    onChange={(val) => setProductForm(prev => ({ ...prev, clientId: val }))}
                    options={clients.map(c => ({ value: c.id, label: c.nome }))}
                  />
                </div>

                <div>
                  <SearchableMultiSelect
                    label="Grupos de Supermercado (Redes)"
                    placeholder="Selecione as redes..."
                    value={productForm.supermarketGroupIds}
                    onChange={(vals) => setProductForm({...productForm, supermarketGroupIds: vals})}
                    options={supermarketGroups.map(g => ({ value: g.id, label: g.name }))}
                  />
                  {supermarketGroups.length === 0 && (
                    <p className="text-[10px] text-amber-600 mt-1 font-medium">
                      Nenhum grupo cadastrado.
                    </p>
                  )}
                </div>

                <div>
                  <SearchableSelect
                    label="Status"
                    value={productForm.status}
                    onChange={(val) => setProductForm({...productForm, status: val})}
                    options={[
                      { value: 'active', label: 'Ativo' },
                      { value: 'inactive', label: 'Inativo' }
                    ]}
                  />
                </div>

                <div>
                  <SearchableSelect
                    label="Checklist de Tarefas"
                    placeholder="Nenhum"
                    value={productForm.checklistTemplateId}
                    onChange={(val) => setProductForm({...productForm, checklistTemplateId: val})}
                    options={checklists.map(t => ({ value: t.id, label: t.name }))}
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-[color:var(--color-muted)] uppercase mb-2">Imagem do Produto</label>
                  <div className="flex items-center gap-4">
                    <div className="relative w-24 h-24 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden bg-slate-50 group hover:border-blue-400 transition-all cursor-pointer">
                      {imagePreview ? (
                        <img src={imagePreview} className="w-full h-full object-cover" alt="Preview" />
                      ) : (
                        <div className="text-center p-2">
                          <span className="text-xs text-slate-400 font-medium">Upload</span>
                        </div>
                      )}
                      <input 
                        type="file" 
                        accept="image/*"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          if (file) {
                            setImageFile(file);
                            setImagePreview(URL.createObjectURL(file));
                          }
                        }}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[color:var(--color-muted)] mb-1">Clique para selecionar uma imagem</p>
                      <p className="text-xs text-slate-400">Formatos aceitos: JPG, PNG, WEBP. A imagem será otimizada automaticamente.</p>
                      {imagePreview && (
                        <button 
                          type="button"
                          onClick={() => {
                            setImageFile(null);
                            setImagePreview('');
                            setProductForm({...productForm, image: ''});
                          }}
                          className="mt-2 text-xs font-bold text-red-500 hover:text-red-600"
                        >
                          Remover Imagem
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* PDVs Tab */}
              <div style={{ display: activeTab === 'pdvs' ? 'block' : 'none' }}>
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 flex flex-col h-[500px]">
                      <div className="mb-4">
                          <h3 className="text-sm font-black text-[color:var(--color-text)] mb-1">Disponibilidade nos PDVs</h3>
                          <p className="text-xs text-[color:var(--color-muted)]">Selecione os PDVs onde este produto deve estar disponível (Mix).</p>
                      </div>
                      
                      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4">
                          {/* Left Column: Available */}
                          <div className="bg-white rounded-xl border border-slate-200 flex flex-col h-full overflow-hidden">
                              <div className="p-3 border-b border-slate-100 bg-slate-50 space-y-2">
                                  <div className="flex gap-2">
                                       <div className="flex-1">
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
                                          type="button"
                                          onClick={handleAddAllFiltered}
                                          className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-200 whitespace-nowrap"
                                       >
                                          Add Todos
                                       </button>
                                  </div>
                                  <input 
                                      type="text"
                                      value={leftSearch}
                                      onChange={e => setLeftSearch(e.target.value)}
                                      placeholder="Buscar PDVs disponíveis..."
                                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs"
                                  />
                              </div>
                              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                  {supermarkets
                                      .filter(s => !productForm.supermarketIds.includes(s.id))
                                      .filter(s => !selectedGroupFilter || (s.group?.id === selectedGroupFilter))
                                      .filter(s => (s.fantasyName || '').toLowerCase().includes(leftSearch.toLowerCase()))
                                      .map(s => (
                                          <div key={s.id} className="flex items-center justify-between bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-lg px-3 py-2 transition-colors">
                                              <div className="min-w-0">
                                                  <p className="text-xs font-bold text-[color:var(--color-text)] truncate">{s.fantasyName}</p>
                                                  <p className="text-[10px] text-slate-400">{s.city} - {s.state}</p>
                                              </div>
                                              <button 
                                                  type="button"
                                                  onClick={() => addToSelected(s.id)}
                                                  className="text-[10px] font-black text-blue-600 hover:bg-blue-50 px-2 py-1 rounded"
                                              >
                                                  Incluir →
                                              </button>
                                          </div>
                                      ))
                                  }
                                  {supermarkets.filter(s => !productForm.supermarketIds.includes(s.id)).length === 0 && (
                                      <div className="text-center py-8 text-slate-400 text-xs">
                                          Nenhum PDV disponível
                                      </div>
                                  )}
                              </div>
                          </div>

                          {/* Middle Arrow */}
                          <div className="flex items-center justify-center">
                              <div className="text-slate-300 lg:rotate-0 rotate-90">
                                  <ArrowRightLeft size={20} />
                              </div>
                          </div>

                          {/* Right Column: Selected */}
                          <div className="bg-white rounded-xl border border-slate-200 flex flex-col h-full overflow-hidden">
                              <div className="p-3 border-b border-slate-100 bg-slate-50">
                                  <div className="flex justify-between items-center mb-2">
                                      <span className="text-xs font-bold text-[color:var(--color-text)]">Selecionados ({productForm.supermarketIds.length})</span>
                                      <button
                                          type="button"
                                          onClick={() => setProductForm(prev => ({ ...prev, supermarketIds: [] }))}
                                          className="text-[10px] text-red-500 font-bold hover:underline"
                                      >
                                          Limpar Tudo
                                      </button>
                                  </div>
                                  <input 
                                      type="text"
                                      value={rightSearch}
                                      onChange={e => setRightSearch(e.target.value)}
                                      placeholder="Buscar nos selecionados..."
                                      className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs"
                                  />
                              </div>
                              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                  {supermarkets
                                      .filter(s => productForm.supermarketIds.includes(s.id))
                                      .filter(s => (s.fantasyName || '').toLowerCase().includes(rightSearch.toLowerCase()))
                                      .map(s => (
                                          <div key={s.id} className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                                              <div className="min-w-0">
                                                  <p className="text-xs font-bold text-blue-900 truncate">{s.fantasyName}</p>
                                                  <p className="text-[10px] text-blue-400">{s.city} - {s.state}</p>
                                              </div>
                                              <button 
                                                  type="button"
                                                  onClick={() => removeFromSelected(s.id)}
                                                  className="text-[10px] font-black text-red-500 hover:bg-red-50 px-2 py-1 rounded"
                                              >
                                                  ✕
                                              </button>
                                          </div>
                                      ))
                                  }
                                  {productForm.supermarketIds.length === 0 && (
                                      <div className="text-center py-8 text-slate-400 text-xs">
                                          Nenhum PDV selecionado
                                      </div>
                                  )}
                              </div>
                          </div>
                      </div>
                  </div>
              </div>

              <div className="space-y-4" style={{ display: activeTab === 'ia' ? 'block' : 'none' }}>
                <div className="border border-slate-200 rounded-xl p-4">
                  <label className="block text-xs font-bold text-[color:var(--color-muted)] uppercase mb-2">Imagem de Referência (IA)</label>
                  <div className="flex items-center gap-4">
                    <div className="relative w-24 h-24 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden bg-slate-50 group hover:border-blue-400 transition-all cursor-pointer">
                      {referenceImagePreview ? (
                        <img src={referenceImagePreview} className="w-full h-full object-cover" alt="Preview" />
                      ) : (
                        <div className="text-center p-2">
                          <span className="text-xs text-slate-400 font-medium">Upload</span>
                        </div>
                      )}
                      <input 
                        type="file" 
                        accept="image/*"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          if (file) {
                            setReferenceImageFile(file);
                            setReferenceImagePreview(URL.createObjectURL(file));
                          }
                        }}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[color:var(--color-muted)] mb-1">Imagem usada pela IA para descrever o produto.</p>
                      <p className="text-xs text-slate-400">Formatos aceitos: JPG, PNG, WEBP. Otimização automática.</p>
                      {referenceImagePreview && (
                        <button 
                          type="button"
                          onClick={() => {
                            setReferenceImageFile(null);
                            setReferenceImagePreview('');
                            setProductForm({...productForm, referenceImageUrl: ''});
                          }}
                          className="mt-2 text-xs font-bold text-red-500 hover:text-red-600"
                        >
                          Remover Imagem
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="border border-slate-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Wand2 size={18} className="text-blue-600" />
                      <span className="text-sm font-bold text-[color:var(--color-text)]">Inteligência Artificial</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-48">
                        <SearchableSelect
                          placeholder="Prompt Padrão"
                          value={selectedPromptId}
                          onChange={(val) => setSelectedPromptId(val)}
                          options={[
                            { value: '', label: 'Prompt Padrão' },
                            ...aiPrompts.filter((p: any) => p.supportsImageAnalysis !== false).map((p: any) => ({ value: p.id, label: p.name }))
                          ]}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleGeneratePrompt}
                        disabled={generatingPrompt}
                        className="px-3 py-2 rounded-lg text-white font-bold shadow-sm disabled:opacity-60 h-[42px]"
                        style={{ backgroundColor: settings.primaryColor }}
                      >
                        {generatingPrompt ? 'Gerando...' : 'Gerar com IA'}
                      </button>
                    </div>
                  </div>
                  <label className="block text-xs font-bold text-[color:var(--color-muted)] uppercase mb-2">Prompt da Imagem</label>
                  <textarea
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-50 outline-none transition-all font-mono text-sm"
                    rows={6}
                    value={productForm.analysisPrompt}
                    onChange={e => setProductForm({ ...productForm, analysisPrompt: e.target.value })}
                    placeholder="Descrição detalhada gerada pela IA para identificar o produto na imagem."
                  />
                </div>
              </div>

              <div className="flex justify-end pt-6 border-t border-slate-100 gap-3">
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
                  Salvar Produto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsView;
