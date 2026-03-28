import React, { useState, useEffect } from 'react';
import { Users, Store, Target, Activity, Search } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useBranding } from '../context/BrandingContext';
import SectionHeader from '../components/SectionHeader';
import { ViewType } from '../types';
import api from '../api/client';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import { LivePhotosFeed } from '../components/LivePhotosFeed';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom Icons for Promoter (P) and Supervisor (S)
const createCustomIcon = (label: string, color: string) => L.divIcon({
  className: 'custom-map-icon',
  html: `<div style="
    background-color: ${color}; 
    color: white; 
    border-radius: 50%; 
    width: 32px; 
    height: 32px; 
    display: flex; 
    align-items: center; 
    justify-content: center; 
    font-weight: 900; 
    font-size: 14px;
    border: 3px solid white; 
    box-shadow: 0 4px 6px rgba(0,0,0,0.3);
  ">${label}</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16]
});

const PromoterIcon = createCustomIcon('P', '#10b981'); // Emerald-500
const SupervisorIcon = createCustomIcon('S', '#f59e0b'); // Amber-500

interface LiveMapViewProps {
  onNavigate: (view: ViewType) => void;
}

const LiveMapView: React.FC<LiveMapViewProps> = ({ onNavigate }) => {
  const { settings } = useBranding();
  
  const [loading, setLoading] = useState(true);
  const [promoters, setPromoters] = useState<any[]>([]);
  const [supermarkets, setSupermarkets] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClientId, setFilterClientId] = useState('');
  const [filterSupervisorId, setFilterSupervisorId] = useState('');
  const [filterPromoterId, setFilterPromoterId] = useState('');

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(prev => prev ? true : false); // Only show full loading on first load
      const today = new Date().toISOString().split('T')[0];
      
      const [employeesRes, supermarketsRes, clientsRes, routesRes] = await Promise.all([
        api.get('/employees'),
        api.get('/supermarkets'),
        api.get('/clients'),
        api.get('/routes')
      ]);

      const allEmployees = employeesRes.data;
      
      // Filter Promoters
      const prom = allEmployees.filter((e: any) => 
        e.role && (e.role.name.toLowerCase() === 'promotor' || e.role.name.toLowerCase() === 'promoter')
      );
      
      // Filter Supervisors
      const sups = allEmployees.filter((e: any) => 
        e.role && (
          e.role.name.toLowerCase().includes('supervisor') ||
          e.role.name.toLowerCase().includes('coordenador') ||
          e.role.name.toLowerCase().includes('gerente')
        )
      );

      setPromoters(prom);
      setSupervisors(sups);
      setSupermarkets(supermarketsRes.data);
      setClients(clientsRes.data);
      
      const todayRoutes = routesRes.data.filter((r: any) => {
          return r.date === today; 
      });
      setRoutes(todayRoutes);

      setLoading(false);
    } catch (error) {
      console.error("Error fetching live map data:", error);
      setLoading(false);
    }
  };

  // Logic to map promoters to supermarkets based on today's routes
  const getPromoterLocation = (promoterId: string) => {
    const route = routes.find(r => r.promoterId === promoterId || (r.promoter && r.promoter.id === promoterId));
    if (route) {
        const supermarket = supermarkets.find(s => s.id === route.supermarketId || (route.supermarket && route.supermarket.id === s.id));
        return supermarket;
    }
    return null;
  };

  const getSupermarketPromoters = (supermarketId: string) => {
    return routes
        .filter(r => (r.supermarketId === supermarketId || (r.supermarket && r.supermarket.id === supermarketId)))
        .map(r => {
            const pId = r.promoterId || (r.promoter && r.promoter.id);
            return promoters.find(p => p.id === pId);
        })
        .filter(Boolean);
  };

  // Filter Logic
  const filteredPromoters = promoters.filter(p => {
    // Search Term (Name or Email)
    const matchesSearch = (p.fullName && p.fullName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (p.email && p.email.toLowerCase().includes(searchTerm.toLowerCase()));

    // Filter by Supervisor
    const matchesSupervisor = !filterSupervisorId || (p.supervisorId === filterSupervisorId) || (p.supervisor && p.supervisor.id === filterSupervisorId);

    // Filter by Specific Promoter Selection
    const matchesPromoter = !filterPromoterId || p.id === filterPromoterId;

    return matchesSearch && matchesSupervisor && matchesPromoter;
  });

  const filteredSupervisors = supervisors.filter(s => {
    const matchesSearch = (s.fullName && s.fullName.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesSearch;
  });

  // Filter Supermarkets (for Map)
  const filteredSupermarkets = supermarkets.filter(s => {
      // Filter by Client
      const matchesClient = !filterClientId || (s.clients && s.clients.some((c: any) => c.id === filterClientId));
      return matchesClient;
  });

  if (loading) return <div className="p-8">Carregando mapa ao vivo...</div>;

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col gap-4 animate-in fade-in duration-500">
      
      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-2">
             <div className="relative h-3 w-3">
                <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping opacity-75" />
                <div className="relative h-3 w-3 bg-emerald-500 rounded-full" />
             </div>
             <h1 className="text-xl font-black text-[color:var(--color-text)]">Live Map</h1>
          </div>

          <div className="flex flex-col md:flex-row gap-3 flex-1 w-full md:w-auto justify-end">
              <div className="relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                 <input 
                    type="text" 
                    placeholder="Buscar promotor..." 
                    className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-100 w-full md:w-64"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                 />
              </div>

              <select
                value={filterClientId}
                onChange={(e) => setFilterClientId(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Todos os Clientes</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.nomeFantasia || c.razaoSocial || c.nome || c.fantasyName}</option>)}
              </select>

              <select
                value={filterSupervisorId}
                onChange={(e) => setFilterSupervisorId(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Todos os Supervisores</option>
                {supervisors.map(s => <option key={s.id} value={s.id}>{s.fullName || s.name}</option>)}
              </select>
          </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden">
        {/* Map Area */}
        <div className="flex-1 bg-white rounded-[2rem] border border-slate-200 overflow-hidden relative shadow-inner z-0">
           <MapContainer center={[-14.2350, -51.9253]} zoom={4} style={{ height: '100%', width: '100%' }}>
              <LayersControl position="topright">
                <LayersControl.BaseLayer checked name="Mapa (Padrão)">
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                </LayersControl.BaseLayer>

                <LayersControl.BaseLayer name="Satélite">
                  <TileLayer
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                    attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                  />
                </LayersControl.BaseLayer>
              </LayersControl>
              
              {/* Supermarket Markers (Gray/Default) */}
              {filteredSupermarkets.filter(s => s.latitude && s.longitude).map(s => {
                  const promotersAtLocation = getSupermarketPromoters(s.id);
                  const hasPromoters = promotersAtLocation.length > 0;
                  
                  return (
                      <Marker 
                        key={`store-${s.id}`}
                        position={[parseFloat(s.latitude), parseFloat(s.longitude)]}
                        opacity={0.5}
                      >
                          <Popup>
                              <div className="min-w-[200px]">
                                  <strong className="block text-base mb-1">{s.fantasyName}</strong>
                                  <p className="text-xs text-gray-500 mb-2">{s.city} - {s.state}</p>
                              </div>
                          </Popup>
                      </Marker>
                  );
              })}

              {/* Promoter Live Location Markers */}
              {filteredPromoters.filter(p => p.lastLatitude && p.lastLongitude).map(p => (
                <Marker
                  key={`promoter-${p.id}`}
                  position={[p.lastLatitude, p.lastLongitude]}
                  icon={PromoterIcon}
                >
                  <Popup>
                    <div className="min-w-[150px]">
                      <strong className="block text-sm mb-1">{p.fullName}</strong>
                      <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">PROMOTOR</span>
                      <p className="text-xs text-gray-500 mt-2">
                        Última atualização: {p.lastLocationAt ? new Date(p.lastLocationAt).toLocaleTimeString() : 'N/A'}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Supervisor Live Location Markers */}
              {filteredSupervisors.filter(s => s.lastLatitude && s.lastLongitude).map(s => (
                <Marker
                  key={`supervisor-${s.id}`}
                  position={[s.lastLatitude, s.lastLongitude]}
                  icon={SupervisorIcon}
                >
                  <Popup>
                    <div className="min-w-[150px]">
                      <strong className="block text-sm mb-1">{s.fullName}</strong>
                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">SUPERVISOR</span>
                      <p className="text-xs text-gray-500 mt-2">
                        Última atualização: {s.lastLocationAt ? new Date(s.lastLocationAt).toLocaleTimeString() : 'N/A'}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              ))}

           </MapContainer>
        </div>
        
        {/* Sidebar List */}
        <div className="w-full lg:w-[450px] flex flex-col gap-4 overflow-hidden h-[calc(100vh-140px)]">
          <div className="bg-white rounded-[2rem] border border-slate-200 p-6 flex-1 overflow-y-auto shadow-sm">
            <SectionHeader icon={<Activity style={{ color: settings.primaryColor }} size={20} />} title="Rastreamento em Tempo Real" />
            
            <div className="mt-6 mb-8 border-b border-slate-100 pb-8">
               <LivePhotosFeed clientId={filterClientId} />
            </div>

            <h3 className="text-lg font-bold text-[color:var(--color-text)] mb-4 flex items-center gap-2">
              <Users size={18} className="text-slate-400" />
              Equipe em Campo
            </h3>

            <div className="space-y-4">
              {filteredPromoters.length === 0 && filteredSupervisors.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">Nenhum funcionário encontrado.</p>
              ) : (
                  <>
                  {/* Supervisors List */}
                  {filteredSupervisors.length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Supervisores</h3>
                      {filteredSupervisors.map(s => (
                        <div key={s.id} className="p-3 mb-2 rounded-xl bg-amber-50 border border-amber-100 flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center text-amber-700 font-bold text-xs">
                             S
                           </div>
                           <div className="flex-1">
                             <p className="text-sm font-bold text-[color:var(--color-text)]">{s.fullName}</p>
                             <p className="text-[10px] text-[color:var(--color-muted)]">
                               {s.lastLocationAt 
                                 ? `Visto às ${new Date(s.lastLocationAt).toLocaleTimeString()}`
                                 : 'Sem localização recente'}
                             </p>
                           </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Promoters List */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase mb-2">Promotores</h3>
                    {filteredPromoters.map(p => {
                      const location = getPromoterLocation(p.id);
                      const hasLiveLoc = p.lastLatitude && p.lastLongitude;
                      
                      return (
                          <div key={p.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:shadow-md transition-all mb-3">
                              <div className="flex items-center gap-3 mb-3">
                                  <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-xs overflow-hidden">
                                      {p.avatarUrl ? (
                                          <img src={p.avatarUrl} alt="" className="w-full h-full object-cover" />
                                      ) : (
                                          (p.fullName || p.name || 'P').charAt(0)
                                      )}
                                  </div>
                                  <div>
                                      <p className="text-sm font-black text-[color:var(--color-text)]">{p.fullName || p.name}</p>
                                      <p className="text-[10px] text-[color:var(--color-muted)] font-medium">{p.email}</p>
                                  </div>
                              </div>
                              
                              <div className="bg-white p-3 rounded-xl border border-slate-100">
                                  <div className="flex items-start gap-2">
                                      <Store size={14} className="text-slate-400 mt-0.5" />
                                      <div>
                                          <p className="text-[10px] font-black text-slate-400 uppercase">Localização (GPS)</p>
                                          <p className={`text-xs font-bold ${hasLiveLoc ? 'text-emerald-600' : 'text-slate-400 italic'}`}>
                                              {hasLiveLoc 
                                                ? `Atualizado às ${new Date(p.lastLocationAt).toLocaleTimeString()}` 
                                                : 'Aguardando sinal GPS...'}
                                          </p>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      );
                    })}
                  </div>
                  </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveMapView;
