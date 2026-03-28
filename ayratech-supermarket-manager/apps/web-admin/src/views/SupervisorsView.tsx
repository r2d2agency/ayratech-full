import React, { useState, useEffect } from 'react';
import { Search, MapPin, Users, Building2, ChevronRight, User } from 'lucide-react';
import api from '../api/client';
import { getImageUrl } from '../utils/image';
import { useBranding } from '../context/BrandingContext';

interface Employee {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role?: { id: string; name: string };
  region?: string;
  subordinates?: Employee[];
  facialPhotoUrl?: string;
}

interface SupermarketGroup {
  id: string;
  name: string;
}

interface Route {
  id: string;
  promoterId: string;
  items: {
    supermarket: {
      group?: {
        id: string;
        name: string;
      }
    }
  }[];
}

const SupervisorsView: React.FC = () => {
  const { settings } = useBranding();
  const [supervisors, setSupervisors] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupervisor, setSelectedSupervisor] = useState<Employee | null>(null);
  const [subordinates, setSubordinates] = useState<Employee[]>([]);
  const [networks, setNetworks] = useState<SupermarketGroup[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    fetchSupervisors();
  }, []);

  const fetchSupervisors = async () => {
    try {
      const response = await api.get('/employees');
      // Filter for supervisors (assuming role name contains 'supervisor' or 'coordenador')
      const allEmployees: Employee[] = response.data;
      const supervisorsList = allEmployees.filter(emp => 
        emp.role?.name?.toLowerCase().includes('supervisor') || 
        emp.role?.name?.toLowerCase().includes('coordenador') ||
        emp.role?.name?.toLowerCase().includes('gerente')
      );
      setSupervisors(supervisorsList);
    } catch (error) {
      console.error('Error fetching supervisors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSupervisor = async (supervisor: Employee) => {
    setLoadingDetails(true);
    try {
      // 1. Fetch full supervisor details (to get subordinates)
      const empResponse = await api.get(`/employees/${supervisor.id}`);
      const fullSupervisor: Employee = empResponse.data;
      setSelectedSupervisor(fullSupervisor);
      
      const subs = fullSupervisor.subordinates || [];
      setSubordinates(subs);

      // 2. Fetch networks (This is heavy, ideally backend should provide this)
      // We will fetch all routes and filter by subordinates
      // Optimization: Only fetch if we have subordinates
      if (subs.length > 0) {
        const routesResponse = await api.get('/routes');
        const allRoutes: Route[] = routesResponse.data;
        
        const subIds = new Set(subs.map(s => s.id));
        const relevantRoutes = allRoutes.filter(r => subIds.has(r.promoterId));
        
        const uniqueNetworks = new Map<string, SupermarketGroup>();
        
        relevantRoutes.forEach(route => {
          route.items?.forEach(item => {
            if (item.supermarket?.group) {
              uniqueNetworks.set(item.supermarket.group.id, item.supermarket.group);
            }
          });
        });
        
        setNetworks(Array.from(uniqueNetworks.values()));
      } else {
        setNetworks([]);
      }

    } catch (error) {
      console.error('Error fetching supervisor details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const filteredSupervisors = supervisors.filter(sup => 
    sup.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sup.region?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  /* getPhotoUrl removed in favor of imported util */

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-xl font-black text-[color:var(--color-text)] tracking-tight">Supervisores</h1>
          <p className="text-[color:var(--color-muted)] font-bold mt-1">Gerencie as equipes e regiões.</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* List Column */}
        <div className={`${selectedSupervisor ? 'col-span-4' : 'col-span-12'} transition-all duration-300`}>
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-200px)]">
            <div className="p-6 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  type="text"
                  placeholder="Buscar supervisor..."
                  className="w-full h-12 pl-12 pr-4 bg-slate-50 rounded-xl border-none outline-none focus:ring-2 focus:ring-blue-100 transition-all font-bold text-[color:var(--color-text)] placeholder:text-slate-400"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loading ? (
                <div className="flex justify-center p-8">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : filteredSupervisors.length === 0 ? (
                <div className="text-center p-8 text-[color:var(--color-muted)]">
                  Nenhum supervisor encontrado.
                </div>
              ) : (
                filteredSupervisors.map(supervisor => (
                  <div 
                    key={supervisor.id}
                    onClick={() => handleSelectSupervisor(supervisor)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all hover:shadow-md ${
                      selectedSupervisor?.id === supervisor.id 
                        ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-200' 
                        : 'bg-white border-slate-100 hover:border-blue-100'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden flex-shrink-0 border-2 border-white shadow-sm">
                        {supervisor.facialPhotoUrl ? (
                          <img 
                            src={getImageUrl(supervisor.facialPhotoUrl) || ''} 
                            alt={supervisor.fullName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <User size={20} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-[color:var(--color-text)] truncate">{supervisor.fullName}</h3>
                        <div className="flex items-center gap-2 text-xs text-[color:var(--color-muted)] mt-1">
                          <MapPin size={12} />
                          <span className="truncate">{supervisor.region || 'Sem região definida'}</span>
                        </div>
                      </div>
                      <ChevronRight size={16} className={`text-slate-300 transition-transform ${selectedSupervisor?.id === supervisor.id ? 'rotate-90 text-blue-500' : ''}`} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Details Column */}
        {selectedSupervisor && (
          <div className="col-span-8 animate-in slide-in-from-right-4 duration-500">
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden h-[calc(100vh-200px)] flex flex-col">
              {loadingDetails ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-start gap-6">
                      <div className="w-24 h-24 rounded-2xl bg-white shadow-lg overflow-hidden border-4 border-white">
                        {selectedSupervisor.facialPhotoUrl ? (
                          <img 
                            src={getImageUrl(selectedSupervisor.facialPhotoUrl) || ''} 
                            alt={selectedSupervisor.fullName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300 bg-slate-100">
                            <User size={40} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 pt-2">
                        <h2 className="text-2xl font-black text-[color:var(--color-text)]">{selectedSupervisor.fullName}</h2>
                        <p className="text-[color:var(--color-muted)] font-medium">{selectedSupervisor.email}</p>
                        
                        <div className="flex flex-wrap gap-3 mt-4">
                          <div className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center gap-1">
                            <MapPin size={12} />
                            {selectedSupervisor.region || 'Sem região'}
                          </div>
                          <div className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center gap-1">
                            <Users size={12} />
                            {subordinates.length} Promotores
                          </div>
                          <div className="px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-bold flex items-center gap-1">
                            <Building2 size={12} />
                            {networks.length} Redes Atendidas
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 overflow-y-auto p-8">
                    <div className="grid grid-cols-2 gap-8">
                      {/* Promoters List */}
                      <div>
                        <h3 className="font-bold text-[color:var(--color-text)] mb-4 flex items-center gap-2">
                          <Users size={18} className="text-blue-500" />
                          Equipe ({subordinates.length})
                        </h3>
                        <div className="space-y-3">
                          {subordinates.length > 0 ? (
                            subordinates.map(sub => (
                              <div key={sub.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                                <div className="w-8 h-8 rounded-full bg-white border border-slate-200 overflow-hidden flex-shrink-0">
                                  {sub.facialPhotoUrl ? (
                                    <img src={getImageUrl(sub.facialPhotoUrl) || ''} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                                      <User size={12} />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-[color:var(--color-text)] text-sm truncate">{sub.fullName}</p>
                                  <p className="text-xs text-[color:var(--color-muted)] truncate">{sub.email}</p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-slate-400 text-sm italic">Nenhum promotor vinculado.</p>
                          )}
                        </div>
                      </div>

                      {/* Networks List */}
                      <div>
                        <h3 className="font-bold text-[color:var(--color-text)] mb-4 flex items-center gap-2">
                          <Building2 size={18} className="text-orange-500" />
                          Redes Atendidas
                        </h3>
                        <div className="space-y-3">
                          {networks.length > 0 ? (
                            networks.map(net => (
                              <div key={net.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                                <p className="font-bold text-[color:var(--color-text)] text-sm">{net.name}</p>
                              </div>
                            ))
                          ) : (
                            <p className="text-slate-400 text-sm italic">Nenhuma rede identificada nas rotas da equipe.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SupervisorsView;
