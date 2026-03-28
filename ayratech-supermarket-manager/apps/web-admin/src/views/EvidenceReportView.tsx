import React, { useState, useEffect, useMemo } from 'react';
import { useBranding } from '../context/BrandingContext';
import SectionHeader from '../components/SectionHeader';
import { 
  Calendar, 
  Filter, 
  Search,
  Image as ImageIcon,
  MapPin,
  User,
  Package,
  Store
} from 'lucide-react';
import api from '../api/client';
import { getImageUrl } from '../utils/image';
import { jwtDecode } from "jwt-decode";

interface EvidenceItem {
  id: string;
  photos?: string[];
  checklists?: {
    id: string;
    type: string;
    value?: string;
    description: string;
  }[];
  routeItem: {
    supermarket: {
      fantasyName: string;
      city: string;
      state: string;
    };
    route: {
      date: string;
      promoter: {
        fullName: string;
      };
    };
  };
  product: {
    name: string;
    brand?: {
      name: string;
    };
  };
}

interface Client {
  id: string;
  fantasyName: string;
}

const EvidenceReportView: React.FC = () => {
  const { settings } = useBranding();
  const [loading, setLoading] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
  });
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clients, setClients] = useState<Client[]>([]);
  const [userRole, setUserRole] = useState<string>('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        setUserRole(decoded.role || '');
        if (decoded.role === 'client') {
          setSelectedClientId(decoded.clientId || decoded.sub);
        } else {
          loadClients();
        }
      } catch (e) {
        console.error("Error decoding token:", e);
      }
    }
  }, []);

  const loadClients = async () => {
    try {
      const response = await api.get('/clients');
      setClients(response.data);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      const params: any = {
        startDate,
        endDate
      };
      if (selectedClientId) {
        params.clientId = selectedClientId;
      }
      const response = await api.get('/routes/report/evidence', { params });
      setEvidence(response.data);
    } catch (error) {
      console.error('Error fetching evidence:', error);
    } finally {
      setLoading(false);
    }
  };

  // Group evidence by Date -> Supermarket -> Promoter
  const groupedEvidence = useMemo(() => {
    const grouped: Record<string, Record<string, Record<string, EvidenceItem[]>>> = {};

    evidence.forEach(item => {
      const date = item.routeItem.route.date;
      const supermarket = `${item.routeItem.supermarket.fantasyName} (${item.routeItem.supermarket.city}-${item.routeItem.supermarket.state})`;
      const promoter = item.routeItem.route.promoter?.fullName || 'N/A';

      if (!grouped[date]) grouped[date] = {};
      if (!grouped[date][supermarket]) grouped[date][supermarket] = {};
      if (!grouped[date][supermarket][promoter]) grouped[date][supermarket][promoter] = [];

      grouped[date][supermarket][promoter].push(item);
    });

    return grouped;
  }, [evidence]);

  return (
    <div className="p-6">
      <SectionHeader 
        title="Relatório de Evidências" 
        subtitle="Visualize as fotos coletadas pelos promotores"
      />

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6 border border-gray-100">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Período
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
              <span className="text-gray-400">até</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </div>

          {(userRole === 'admin' || userRole === 'supervisor') && (
            <div className="min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cliente
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="">Todos os clientes</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.fantasyName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={handleSearch}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white font-medium transition-colors ${
              loading 
                ? 'bg-indigo-400 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Search size={20} />
            )}
            Filtrar
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-8">
        {Object.entries(groupedEvidence).map(([date, supermarkets]) => (
          <div key={date} className="space-y-6">
            <h2 className="flex items-center gap-2 text-xl font-bold text-gray-800 border-b pb-2">
              <Calendar className="text-indigo-600" size={24} />
              {new Date(date).toLocaleDateString('pt-BR')}
            </h2>

            {Object.entries(supermarkets).map(([supermarketName, promoters]) => (
              <div key={supermarketName} className="ml-4 space-y-4">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-700">
                  <Store className="text-gray-500" size={20} />
                  {supermarketName}
                </h3>

                {Object.entries(promoters).map(([promoterName, items]) => (
                  <div key={promoterName} className="ml-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <h4 className="flex items-center gap-2 font-medium text-gray-600 mb-4">
                      <User className="text-gray-400" size={18} />
                      {promoterName}
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {items.map(item => (
                        <div key={item.id} className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-medium text-gray-800 text-sm line-clamp-2" title={item.product.name}>
                                {item.product.name}
                              </p>
                              {item.product.brand && (
                                <p className="text-xs text-gray-500">{item.product.brand.name}</p>
                              )}
                            </div>
                          </div>

                          <div className="space-y-2">
                            {/* Standard Photos */}
                            {item.photos && item.photos.length > 0 && (
                              <div className="flex gap-2 overflow-x-auto pb-2">
                                {item.photos.map((photo, idx) => (
                                  <a 
                                    key={idx} 
                                    href={getImageUrl(photo)} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="block flex-shrink-0"
                                  >
                                    <img 
                                      src={getImageUrl(photo)} 
                                      alt={`Evidence ${idx + 1}`} 
                                      className="w-20 h-20 object-cover rounded-md border border-gray-200 hover:border-indigo-500 transition-colors"
                                    />
                                  </a>
                                ))}
                              </div>
                            )}

                            {/* Checklist Photos */}
                            {item.checklists && item.checklists.filter(c => c.type === 'PHOTO' && c.value).map(cl => (
                              <div key={cl.id} className="border-t pt-2 mt-2">
                                <p className="text-xs text-gray-500 mb-1">{cl.description}</p>
                                <a 
                                  href={getImageUrl(cl.value!)} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="block"
                                >
                                  <img 
                                    src={getImageUrl(cl.value!)} 
                                    alt={cl.description} 
                                    className="w-full h-32 object-cover rounded-md border border-gray-200 hover:border-indigo-500 transition-colors"
                                  />
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
        
        {!loading && evidence.length === 0 && (
          <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <ImageIcon size={48} className="mx-auto mb-4 opacity-20" />
            <p>Nenhuma evidência encontrada para os filtros selecionados.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EvidenceReportView;
