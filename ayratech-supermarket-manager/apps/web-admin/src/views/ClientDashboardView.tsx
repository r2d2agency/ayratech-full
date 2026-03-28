import React, { useState, useEffect, useMemo } from 'react';
import { useBranding } from '../context/BrandingContext';
import StatCard from '../components/StatCard';
import { 
  BarChart2, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Filter, 
  MapPin,
  Camera,
  Package,
  Store,
  Calendar,
  Clock,
  Search,
  List,
  Grid,
  ChevronRight,
  User,
  Tags
} from 'lucide-react';
import api from '../api/client';
import { getImageUrl } from '../utils/image';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface ClientDashboardStats {
  totalRoutes: number;
  visitedRoutes: number;
  totalProductsChecked: number;
  stockouts: number;
  nearExpiry: number;
  expired: number;
  photosCount: number;
  totalStock: number;
}

interface RouteItem {
  id: string;
  date: string;
  status: string;
  promoter: {
    fullName: string;
  };
  items: Array<{
    id: string;
    status: string;
    checkInTime?: string;
    checkOutTime?: string;
    supermarket: {
      id: string;
      fantasyName: string;
      city?: string;
      state?: string;
    };
    products: Array<{
      id: string;
      isStockout: boolean;
      checked: boolean;
      observation?: string;
      photos?: string[];
      validityDate?: string;
      validityQuantity?: number;
      stockCount?: number;
      gondolaCount?: number;
      inventoryCount?: number;
      product: {
        id: string;
        name: string;
        sku?: string;
        image?: string;
        client?: {
          id: string;
        };
        brand?: {
          id: string;
          name: string;
          client?: {
            id: string;
          };
        };
      };
    }>;
  }>;
}

interface ClientInfo {
  id: string;
  name: string;
  logo?: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#FF4444'];

const ClientDashboardView: React.FC = () => {
  const { settings } = useBranding();
  const [supermarkets, setSupermarkets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  const [filteredRoutes, setFilteredRoutes] = useState<RouteItem[]>([]);
  const [clientInfo, setClientInfo] = useState<ClientInfo | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'visits' | 'stockouts' | 'expiry' | 'stock' | 'brands' | 'pdvs'>('overview');
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  const handleImageError = (url: string) => {
    setImageErrors(prev => ({ ...prev, [url]: true }));
  };
  
  // Filters
  const [selectedPdv, setSelectedPdv] = useState<string>('');
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30); // Last 30 days
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  useEffect(() => {
    fetchData();
    fetchClientInfo();
  }, []);

  useEffect(() => {
    filterData();
  }, [routes, selectedPdv, selectedBrand, startDate, endDate, clientInfo]);

  const getOverallValidity = (p: any) => {
    const storeDate = p?.validityStoreDate ? String(p.validityStoreDate) : '';
    const storeQty =
      p?.validityStoreQuantity !== null && p?.validityStoreQuantity !== undefined
        ? Number(p.validityStoreQuantity)
        : 0;
    const stockDate = p?.validityStockDate ? String(p.validityStockDate) : '';
    const stockQty =
      p?.validityStockQuantity !== null && p?.validityStockQuantity !== undefined
        ? Number(p.validityStockQuantity)
        : 0;
    const legacyDate = p?.validityDate ? String(p.validityDate) : '';
    const legacyQty =
      p?.validityQuantity !== null && p?.validityQuantity !== undefined ? Number(p.validityQuantity) : 0;

    const hasStore = !!(storeDate && storeQty > 0);
    const hasStock = !!(stockDate && stockQty > 0);

    if (hasStore && hasStock) return storeDate <= stockDate ? { date: storeDate, qty: storeQty } : { date: stockDate, qty: stockQty };
    if (hasStore) return { date: storeDate, qty: storeQty };
    if (hasStock) return { date: stockDate, qty: stockQty };
    if (legacyDate) return { date: legacyDate, qty: legacyQty };
    return null;
  };

  const fetchClientInfo = async () => {
    try {
      const response = await api.get('/auth/profile');
      if (response.data) {
        setClientInfo({
          id: response.data.id || response.data.clientId || response.data.sub,
          name: response.data.razaoSocial || response.data.username,
          logo: response.data.logo
        });
      }
    } catch (error) {
      console.error('Error fetching client info:', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Parallel requests with independent error handling
      const [routesRes, pdvsRes] = await Promise.allSettled([
        api.get('/routes/client/all'),
        api.get('/routes/client/supermarkets')
      ]);

      if (routesRes.status === 'fulfilled') {
        console.log('ClientDashboardView: Routes received:', routesRes.value.data);
        setRoutes(routesRes.value.data);
      } else {
        console.error('ClientDashboardView: Error fetching routes:', routesRes.reason);
      }

      if (pdvsRes.status === 'fulfilled') {
        console.log('ClientDashboardView: Supermarkets received:', pdvsRes.value.data);
        setSupermarkets(pdvsRes.value.data || []);
      } else {
        console.error('ClientDashboardView: Error fetching supermarkets:', pdvsRes.reason);
        // We can continue without supermarkets (will fallback to route extraction)
      }

    } catch (error) {
      console.error('Error fetching client data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterData = () => {
    let filtered = [...routes];

    // Filter by Date Range
    if (startDate && endDate) {
      filtered = filtered.filter(r => {
        const rDate = r.date.split('T')[0];
        return rDate >= startDate && rDate <= endDate;
      });
    }

    // Filter by PDV and Brand requires deeper filtering
    // We filter the route items and products, but keep the route structure if it has matching items
    filtered = filtered.map(r => {
      const filteredItems = r.items.filter(i => {
        const matchesPdv = !selectedPdv || i.supermarket.id === selectedPdv;
        if (!matchesPdv) return false;

        // Check if any product matches the client ownership
        // AND matches the selected brand if applicable
        const hasMatchingProducts = i.products.some(p => {
          // Ownership check
          const belongsToClient = clientInfo ? (
             p.product.client?.id === clientInfo.id || 
             p.product.brand?.client?.id === clientInfo.id
          ) : true; // If clientInfo not loaded yet, show all? Or wait? 
          // Better to show all if not loaded to avoid flickering empty state, 
          // but strict mode is safer. Let's assume true for now or it hides everything.
          
          if (!belongsToClient) return false;

          // Brand filter
          if (selectedBrand && p.product.brand?.id !== selectedBrand) return false;

          return true;
        });

        // If no products match, BUT the supermarket is linked to the client (and no specific brand filter is set),
        // we might still want to show the visit (e.g. check-in only).
        // However, if the user selected a brand, we strictly want that brand.
        if (!hasMatchingProducts) {
           if (selectedBrand) return false;
           // If no brand selected, and we are here, it means no products matched ownership.
           // But if the PDV is ours, we keep the visit (with 0 products visible).
           // We need to check if PDV is in our supermarkets list.
           const isMyPdv = supermarkets.some(sm => sm.id === i.supermarket.id);
           return isMyPdv;
        }

        return true;
      }).map(i => ({
        ...i,
        products: i.products.filter(p => {
           // Apply same ownership and brand logic to filter individual products
           const belongsToClient = clientInfo ? (
             p.product.client?.id === clientInfo.id || 
             p.product.brand?.client?.id === clientInfo.id
          ) : true;
          
          if (!belongsToClient) return false;
          if (selectedBrand && p.product.brand?.id !== selectedBrand) return false;
          
          return true;
        })
      }));

      return {
        ...r,
        items: filteredItems
      };
    }).filter(r => r.items.length > 0);

    setFilteredRoutes(filtered);
  };

  const stats = useMemo<ClientDashboardStats>(() => {
    let totalRoutes = 0;
    let visitedRoutes = 0;
    let totalProductsChecked = 0;
    let stockouts = 0;
    let nearExpiry = 0;
    let expired = 0;
    let photosCount = 0;
    let totalStock = 0;

    filteredRoutes.forEach(route => {
      route.items.forEach(item => {
        totalRoutes++;
        if (item.status === 'COMPLETED' || item.checkInTime) visitedRoutes++;

        item.products.forEach(p => {
          if (p.checked) totalProductsChecked++;
          if (p.isStockout) stockouts++;
          if (p.photos) photosCount += p.photos.length;
          if (p.stockCount !== undefined && p.stockCount !== null) totalStock += p.stockCount;

          const overall = getOverallValidity(p);
          if (overall?.date) {
            const today = new Date();
            today.setHours(0,0,0,0);
            const valDate = new Date(overall.date);
            const diffTime = valDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays < 0) expired++;
            else if (diffDays <= 30) nearExpiry++;
          }
        });
      });
    });

    return {
      totalRoutes,
      visitedRoutes,
      totalProductsChecked,
      stockouts,
      nearExpiry,
      expired,
      photosCount,
      totalStock
    };
  }, [filteredRoutes]);

  const pdvs = useMemo(() => {
    // If we have direct supermarkets list, use it as base
    if (supermarkets.length > 0) {
      return supermarkets.map(sm => {
        // Calculate stats from routes for this supermarket
        const smRoutes = filteredRoutes.filter(r => 
          r.items.some(i => i.supermarket.id === sm.id)
        );
        
        let visits = 0;
        let rupturas = 0;
        let vencidos = 0;

        smRoutes.forEach(route => {
           const item = route.items.find(i => i.supermarket.id === sm.id);
           if (item) {
             visits++;
             item.products.forEach(p => {
               if (p.isStockout) rupturas++;
               // Check validity
               const overall = getOverallValidity(p);
               if (overall?.date) {
                 const today = new Date();
                 const valDate = new Date(overall.date);
                 const diffTime = valDate.getTime() - today.getTime();
                 const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                 if (diffDays <= 30) vencidos++;
               }
             });
           }
        });

        return {
          id: sm.id,
          name: sm.fantasyName || sm.razaoSocial || 'Sem Nome',
          city: sm.city || sm.cidade || 'N/A',
          visits,
          rupturas,
          vencidos
        };
      });
    }

    // Fallback to extracting from routes if supermarkets list is empty
    const pdvsMap = new Map();
    filteredRoutes.forEach(route => {
      route.items.forEach(item => {
        if (!pdvsMap.has(item.supermarket.id)) {
          pdvsMap.set(item.supermarket.id, {
            id: item.supermarket.id,
            name: item.supermarket.fantasyName,
            city: item.supermarket.city || 'N/A',
            visits: 0,
            rupturas: 0,
            vencidos: 0
          });
        }
        
        const pdv = pdvsMap.get(item.supermarket.id);
        pdv.visits++;
        
        item.products.forEach(p => {
          if (p.isStockout) pdv.rupturas++;
           const overall = getOverallValidity(p);
           if (overall?.date) {
              const today = new Date();
              const valDate = new Date(overall.date);
              const diffTime = valDate.getTime() - today.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              if (diffDays <= 30) pdv.vencidos++;
            }
        });
      });
    });
    return Array.from(pdvsMap.values());
  }, [filteredRoutes, supermarkets]);

  const brands = useMemo(() => {
    const uniqueBrands = new Map();
    routes.forEach(r => {
      r.items.forEach(i => {
        i.products.forEach(p => {
          if (p.product.brand && !uniqueBrands.has(p.product.brand.id)) {
            uniqueBrands.set(p.product.brand.id, p.product.brand.name);
          }
        });
      });
    });
    return Array.from(uniqueBrands.entries()).map(([id, name]) => ({ id, name }));
  }, [routes]);

  const stockoutByPdvData = useMemo(() => {
    const data: Record<string, number> = {};
    filteredRoutes.forEach(r => {
      r.items.forEach(i => {
        const pdvName = i.supermarket.fantasyName;
        const stockoutsInItem = i.products.filter(p => p.isStockout).length;
        if (stockoutsInItem > 0) {
          data[pdvName] = (data[pdvName] || 0) + stockoutsInItem;
        }
      });
    });
    return Object.entries(data)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredRoutes]);

  const expiryStatusData = useMemo(() => {
    return [
      { name: 'Vencidos', value: stats.expired },
      { name: 'Próx. Vencimento', value: stats.nearExpiry },
      { name: 'Em Dia', value: stats.totalProductsChecked - stats.expired - stats.nearExpiry }
    ].filter(d => d.value > 0);
  }, [stats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Handle errors or empty states gracefully
  if (!clientInfo && !loading) {
     // Optional: Render a fallback or retry button
  }

  const renderTabs = () => (
    <div className="flex flex-wrap gap-2 border-b border-slate-200 mb-6">
      {[
        { id: 'overview', label: 'Visão Geral', icon: <BarChart2 size={18} /> },
        { id: 'visits', label: 'Histórico de Visitas', icon: <Calendar size={18} /> },
        { id: 'stockouts', label: 'Rupturas', icon: <XCircle size={18} /> },
        { id: 'expiry', label: 'Validade', icon: <AlertTriangle size={18} /> },
        { id: 'stock', label: 'Estoque', icon: <Package size={18} /> },
        { id: 'brands', label: 'Marcas', icon: <Tags size={18} /> },
        { id: 'pdvs', label: 'PDVs', icon: <Store size={18} /> },
      ].map(tab => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id as any)}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === tab.id
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-[color:var(--color-muted)] hover:text-[color:var(--color-text)] hover:border-slate-300'
          }`}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Client Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-center gap-6">
        <div className="w-24 h-24 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
          {clientInfo?.logo ? (
            <img src={getImageUrl(clientInfo.logo)} alt={clientInfo.name} className="w-full h-full object-contain p-2" />
          ) : (
            <Store className="text-slate-300" size={40} />
          )}
        </div>
        <div className="flex-1 text-center md:text-left">
          <h1 className="text-2xl font-bold text-[color:var(--color-text)]">{clientInfo?.name || 'Cliente'}</h1>
          <p className="text-[color:var(--color-muted)] mt-1">Dashboard de Performance e Acompanhamento</p>
          <div className="flex flex-wrap gap-4 mt-4 justify-center md:justify-start">
            <div className="flex items-center gap-2 text-sm text-[color:var(--color-muted)] bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
              <Calendar size={14} className="text-blue-500" />
              <span>{new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-[color:var(--color-muted)] bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
              <Store size={14} className="text-purple-500" />
              <span>{stats.visitedRoutes} Visitas Realizadas</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-[color:var(--color-muted)] mb-1 uppercase">Período</label>
          <div className="flex gap-2">
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full p-2 border rounded-lg text-sm"
            />
            <span className="self-center text-slate-400">-</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full p-2 border rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-[color:var(--color-muted)] mb-1 uppercase">Filtrar por PDV</label>
          <div className="relative">
            <Store className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select
              value={selectedPdv}
              onChange={(e) => setSelectedPdv(e.target.value)}
              className="w-full pl-10 p-2 border rounded-lg text-sm appearance-none bg-white"
            >
              <option value="">Todos os Supermercados</option>
              {pdvs.map(pdv => (
                <option key={pdv.id} value={pdv.id}>{pdv.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-[color:var(--color-muted)] mb-1 uppercase">Filtrar por Marca</label>
          <div className="relative">
            <Tags className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full pl-10 p-2 border rounded-lg text-sm appearance-none bg-white"
            >
              <option value="">Todas as Marcas</option>
              {brands.map(brand => (
                <option key={brand.id} value={brand.id}>{brand.name}</option>
              ))}
            </select>
          </div>
        </div>
        
        <button 
          onClick={() => {
            setSelectedPdv('');
            setSelectedBrand('');
            setStartDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
            setEndDate(new Date().toISOString().split('T')[0]);
          }}
          className="p-2 text-[color:var(--color-muted)] hover:text-[color:var(--color-text)] hover:bg-slate-100 rounded-lg transition-colors"
          title="Limpar Filtros"
        >
          <Filter size={20} />
        </button>
      </div>

      {renderTabs()}

      {/* Tab Content */}
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
        
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard 
                icon={<Package className="text-blue-600" />} 
                label="Produtos Verificados" 
                value={stats.totalProductsChecked.toString()} 
                color="bg-blue-50" 
              />
              <StatCard 
                icon={<XCircle className="text-red-600" />} 
                label="Rupturas Identificadas" 
                value={stats.stockouts.toString()} 
                subValue={`${((stats.stockouts / (stats.totalProductsChecked || 1)) * 100).toFixed(1)}%`}
                color="bg-red-50" 
              />
              <StatCard 
                icon={<AlertTriangle className="text-orange-600" />} 
                label="Próx. Vencimento" 
                value={stats.nearExpiry.toString()} 
                color="bg-orange-50" 
              />
              <StatCard 
                icon={<AlertTriangle className="text-red-800" />} 
                label="Produtos Vencidos" 
                value={stats.expired.toString()} 
                color="bg-red-100" 
              />
              <StatCard 
                icon={<Package className="text-blue-800" />} 
                label="Total em Estoque" 
                value={stats.totalStock.toString()} 
                color="bg-blue-100" 
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               {/* Stockouts by PDV Chart */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="font-bold text-lg text-[color:var(--color-text)] mb-6 flex items-center gap-2">
                  <XCircle size={20} className="text-red-500" />
                  Rupturas por PDV (Top 10)
                </h3>
                <div style={{ width: '100%', height: 300, minHeight: 300 }}>
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={200}>
                    <BarChart data={stockoutByPdvData} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
                      <Tooltip />
                      <Bar dataKey="value" fill="#ef4444" radius={[0, 4, 4, 0]} name="Rupturas" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Expiry Status Chart */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="font-bold text-lg text-[color:var(--color-text)] mb-6 flex items-center gap-2">
                  <Calendar size={20} className="text-orange-500" />
                  Status de Validade
                </h3>
                <div style={{ width: '100%', height: 300, minHeight: 300 }}>
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={200}>
                    <PieChart>
                      <Pie
                        data={expiryStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        fill="#8884d8"
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {expiryStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.name === 'Vencidos' ? '#991b1b' : entry.name === 'Próx. Vencimento' ? '#ea580c' : '#22c55e'} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Recent Photos Preview */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
               <h3 className="font-bold text-lg text-[color:var(--color-text)] mb-6 flex items-center gap-2">
                  <Camera size={20} className="text-purple-500" />
                  Últimas Fotos Registradas
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                   {filteredRoutes
                     .flatMap(r => r.items)
                     .flatMap(i => i.products)
                     .filter(p => p.photos && p.photos.length > 0)
                     .flatMap(p => p.photos?.map(photo => ({ 
                       url: photo, 
                       productName: p.product.name,
                       date: getOverallValidity(p)?.date 
                     })))
                     .slice(0, 6)
                     .map((photo, idx) => (
                       <div key={idx} className="relative aspect-square rounded-lg overflow-hidden group cursor-pointer bg-slate-100 flex items-center justify-center">
                         {!imageErrors[photo.url] ? (
                           <img 
                             src={getImageUrl(photo.url || '')} 
                             alt={photo.productName}
                             className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                             onError={() => handleImageError(photo.url)}
                           />
                         ) : (
                           <div className="flex flex-col items-center justify-center text-slate-300">
                             <Camera size={24} className="mb-1" />
                             <span className="text-[10px]">Sem imagem</span>
                           </div>
                         )}
                         <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                           <p className="text-white text-xs font-medium truncate w-full">{photo?.productName}</p>
                         </div>
                       </div>
                     ))
                   }
                   {stats.photosCount === 0 && (
                     <div className="col-span-full text-center py-10 text-slate-400">
                       Nenhuma foto registrada neste período.
                     </div>
                   )}
                </div>
            </div>
          </div>
        )}

        {activeTab === 'visits' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-[color:var(--color-muted)] font-medium">
                  <tr>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Promotor</th>
                    <th className="px-4 py-3">Supermercado</th>
                    <th className="px-4 py-3">Cidade</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Check-in</th>
                    <th className="px-4 py-3">Check-out</th>
                    <th className="px-4 py-3 text-right">Produtos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRoutes.flatMap(r => r.items.map(item => ({ route: r, item }))).map(({ route, item }, idx) => (
                    <tr key={`${route.id}-${item.id}`} className="hover:bg-slate-50">
                      <td className="px-4 py-3">{new Date(route.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3">{route.promoter?.fullName || '-'}</td>
                      <td className="px-4 py-3 font-medium text-[color:var(--color-text)]">{item.supermarket.fantasyName}</td>
                      <td className="px-4 py-3 text-[color:var(--color-muted)]">{item.supermarket.city}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          item.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                          item.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-[color:var(--color-muted)]'
                        }`}>
                          {item.status === 'COMPLETED' ? 'Concluída' : 
                           item.status === 'IN_PROGRESS' ? 'Em Andamento' : 'Pendente'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[color:var(--color-muted)]">{item.checkInTime ? new Date(item.checkInTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}</td>
                      <td className="px-4 py-3 text-[color:var(--color-muted)]">{item.checkOutTime ? new Date(item.checkOutTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '-'}</td>
                      <td className="px-4 py-3 text-right font-medium">{item.products.filter(p => p.checked).length} / {item.products.length}</td>
                    </tr>
                  ))}
                  {filteredRoutes.length === 0 && (
                     <tr>
                       <td colSpan={8} className="px-4 py-10 text-center text-slate-400">Nenhuma visita encontrada.</td>
                     </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'stockouts' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
             <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-[color:var(--color-muted)] font-medium">
                  <tr>
                    <th className="px-4 py-3">Produto</th>
                    <th className="px-4 py-3">Marca</th>
                    <th className="px-4 py-3">Supermercado</th>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Promotor</th>
                    <th className="px-4 py-3">Obs.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRoutes.flatMap(r => r.items.flatMap(item => 
                    item.products.filter(p => p.isStockout).map(p => ({ route: r, item, product: p }))
                  )).map(({ route, item, product }, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-[color:var(--color-text)]">{product.product.name}</td>
                      <td className="px-4 py-3 text-[color:var(--color-muted)]">{product.product.brand?.name || '-'}</td>
                      <td className="px-4 py-3">{item.supermarket.fantasyName}</td>
                      <td className="px-4 py-3">{new Date(route.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-[color:var(--color-muted)]">{route.promoter?.fullName}</td>
                      <td className="px-4 py-3 text-[color:var(--color-muted)] italic truncate max-w-[200px]">{product.observation || '-'}</td>
                    </tr>
                  ))}
                  {stats.stockouts === 0 && (
                     <tr>
                       <td colSpan={6} className="px-4 py-10 text-center text-slate-400">Nenhuma ruptura registrada.</td>
                     </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'expiry' && (
           <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
             <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-[color:var(--color-muted)] font-medium">
                  <tr>
                    <th className="px-4 py-3">Produto</th>
                    <th className="px-4 py-3">Marca</th>
                    <th className="px-4 py-3">Supermercado</th>
                    <th className="px-4 py-3">Validade</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Dias Restantes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRoutes.flatMap(r => r.items.flatMap(item => 
                    item.products
                      .map(p => ({ p, overall: getOverallValidity(p) }))
                      .filter(({ overall }) => !!overall?.date)
                      .map(({ p, overall }) => {
                      const today = new Date();
                      today.setHours(0,0,0,0);
                      const valDate = new Date(String(overall!.date));
                      const diffTime = valDate.getTime() - today.getTime();
                      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                      return { route: r, item, product: p, overall, diffDays };
                    })
                  ))
                  .sort((a, b) => a.diffDays - b.diffDays)
                  .map(({ route, item, product, overall, diffDays }, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-[color:var(--color-text)]">{product.product.name}</td>
                      <td className="px-4 py-3 text-[color:var(--color-muted)]">{product.product.brand?.name || '-'}</td>
                      <td className="px-4 py-3">{item.supermarket.fantasyName}</td>
                      <td className="px-4 py-3">{new Date(String(overall!.date)).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                         {diffDays < 0 ? (
                           <span className="flex flex-col gap-1">
                             <span className="inline-flex items-center gap-1 text-red-600 bg-red-50 px-2 py-1 rounded-full text-xs font-bold w-fit">
                               Vencido
                             </span>
                             {overall?.qty && overall.qty > 0 && (
                               <span className="text-[10px] text-[color:var(--color-muted)] font-normal pl-1">
                                 Qtd: {overall.qty}
                               </span>
                             )}
                           </span>
                         ) : diffDays <= 30 ? (
                           <span className="flex flex-col gap-1">
                             <span className="inline-flex items-center gap-1 text-orange-600 bg-orange-50 px-2 py-1 rounded-full text-xs font-bold w-fit">
                               Próx. Vencimento
                             </span>
                             {overall?.qty && overall.qty > 0 && (
                               <span className="text-[10px] text-[color:var(--color-muted)] font-normal pl-1">
                                 Qtd: {overall.qty}
                               </span>
                             )}
                           </span>
                         ) : (
                           <span className="flex flex-col gap-1">
                             <span className="inline-flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-full text-xs font-medium w-fit">
                               Em Dia
                             </span>
                             {overall?.qty && overall.qty > 0 && (
                               <span className="text-[10px] text-[color:var(--color-muted)] font-normal pl-1">
                                 Qtd: {overall.qty}
                               </span>
                             )}
                           </span>
                         )}
                      </td>
                      <td className={`px-4 py-3 font-medium ${diffDays < 0 ? 'text-red-600' : diffDays <= 30 ? 'text-orange-600' : 'text-[color:var(--color-muted)]'}`}>
                        {diffDays} dias
                      </td>
                    </tr>
                  ))}
                   {stats.nearExpiry === 0 && stats.expired === 0 && (
                     <tr>
                       <td colSpan={6} className="px-4 py-10 text-center text-slate-400">Nenhum produto próximo do vencimento ou vencido.</td>
                     </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'stock' && (
           <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
             <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-[color:var(--color-muted)] font-medium">
                  <tr>
                    <th className="px-4 py-3">Produto</th>
                    <th className="px-4 py-3">Marca</th>
                    <th className="px-4 py-3">Supermercado</th>
                    <th className="px-4 py-3">Loja</th>
                    <th className="px-4 py-3">Estoque</th>
                    <th className="px-4 py-3">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRoutes.flatMap(r => r.items.flatMap(item => 
                    item.products.filter(p => (p.stockCount !== undefined && p.stockCount !== null) || (p.gondolaCount !== undefined && p.gondolaCount !== null) || (p.inventoryCount !== undefined && p.inventoryCount !== null)).map(p => ({ route: r, item, product: p }))
                  ))
                  .sort((a, b) => new Date(b.route.date).getTime() - new Date(a.route.date).getTime())
                  .map(({ route, item, product }, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-[color:var(--color-text)]">{product.product.name}</td>
                      <td className="px-4 py-3 text-[color:var(--color-muted)]">{product.product.brand?.name || '-'}</td>
                      <td className="px-4 py-3">{item.supermarket.fantasyName}</td>
                      <td className="px-4 py-3 font-medium text-[color:var(--color-muted)]">
                        {product.gondolaCount ?? '-'}
                      </td>
                      <td className="px-4 py-3 font-medium text-[color:var(--color-muted)]">
                        {product.inventoryCount ?? product.stockCount ?? '-'}
                      </td>
                      <td className="px-4 py-3 font-bold text-blue-600">
                        {((product.gondolaCount !== undefined && product.gondolaCount !== null) || (product.inventoryCount !== undefined && product.inventoryCount !== null) || (product.stockCount !== undefined && product.stockCount !== null)) ? 
                          ((Number(product.gondolaCount) || 0) + (Number(product.inventoryCount ?? product.stockCount) || 0)) 
                          : '-'}
                      </td>
                    </tr>
                  ))}
                   {filteredRoutes.every(r => r.items.every(i => i.products.every(p => (p.stockCount === undefined || p.stockCount === null) && (p.gondolaCount === undefined || p.gondolaCount === null) && (p.inventoryCount === undefined || p.inventoryCount === null)))) && (
                     <tr>
                       <td colSpan={6} className="px-4 py-10 text-center text-slate-400">Nenhuma contagem de estoque registrada.</td>
                     </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'brands' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {brands.map(brand => {
              // Calculate stats for this brand
              let brandStockouts = 0;
              let brandExpiry = 0;
              let brandChecked = 0;
              
              filteredRoutes.forEach(r => r.items.forEach(i => i.products.forEach(p => {
                if (p.product.brand?.id === brand.id) {
                  if (p.checked) brandChecked++;
                  if (p.isStockout) brandStockouts++;
                  const overall = getOverallValidity(p);
                  if (overall?.date) {
                     const today = new Date();
                     today.setHours(0,0,0,0);
                     const valDate = new Date(overall.date);
                     if (valDate < today) brandExpiry++;
                  }
                }
              })));

              return (
                <div key={brand.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                      <Tags size={20} />
                    </div>
                    <h3 className="font-bold text-[color:var(--color-text)]">{brand.name}</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-[color:var(--color-muted)]">Verificados</span>
                      <span className="font-medium text-[color:var(--color-text)]">{brandChecked}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-[color:var(--color-muted)]">Rupturas</span>
                      <span className="font-medium text-red-600">{brandStockouts}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-[color:var(--color-muted)]">Vencidos</span>
                      <span className="font-medium text-red-800">{brandExpiry}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === 'pdvs' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pdvs.map(pdv => {
              // Calculate stats for this PDV
              let pdvVisits = 0;
              let pdvStockouts = 0;
              let pdvExpiry = 0;
              
              filteredRoutes.forEach(r => r.items.forEach(i => {
                if (i.supermarket.id === pdv.id) {
                  if (i.status === 'COMPLETED' || i.checkInTime) pdvVisits++;
                  i.products.forEach(p => {
                    if (p.isStockout) pdvStockouts++;
                    const overall = getOverallValidity(p);
                    if (overall?.date) {
                       const today = new Date();
                       today.setHours(0,0,0,0);
                       const valDate = new Date(overall.date);
                       if (valDate < today) pdvExpiry++;
                    }
                  });
                }
              }));

              return (
                <div key={pdv.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
                      <Store size={20} />
                    </div>
                    <h3 className="font-bold text-[color:var(--color-text)]">{pdv.name}</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-[color:var(--color-muted)]">Visitas Realizadas</span>
                      <span className="font-medium text-[color:var(--color-text)]">{pdvVisits}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-[color:var(--color-muted)]">Rupturas</span>
                      <span className="font-medium text-red-600">{pdvStockouts}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-[color:var(--color-muted)]">Vencidos</span>
                      <span className="font-medium text-red-800">{pdvExpiry}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
};

export default ClientDashboardView;
