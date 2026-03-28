import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import { offlineService } from '../services/offline.service';
import { MapPin, ArrowRight, CheckCircle, WifiOff, Settings, ListTodo, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import SupervisorDashboardView from './SupervisorDashboardView';
import toast from 'react-hot-toast';

const DashboardView = () => {
  const { user } = useAuth();
  const { settings } = useBranding();
  const navigate = useNavigate();
  const [todaysRoutes, setTodaysRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Check if user is a manager (admin, supervisor, etc.)
  const userRole = user?.role?.toLowerCase() || '';
  const isManager = ['admin', 'superadmin', 'supervisor', 'gerente', 'coordenador'].some(role => userRole.includes(role));

  useEffect(() => {
    fetchRoutes(selectedDate);
  }, [selectedDate]);

  const fetchRoutes = async (dateObj: Date) => {
    setLoading(true);
    // Use local date to avoid UTC issues (e.g. previous/next day in evening)
    const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    
    try {
      // Fetch routes for selected date
      // Ideally backend should support ?date=today&promoterId=me
      // Now fetching filtered by date to improve performance
      const response = await client.get('/routes/summary', { params: { date: dateStr } });
      
      const filtered = response.data.filter((r: any) => {
        return r.date.startsWith(dateStr) && (
          isManager || // Managers see all routes
          r.promoter?.id === user.employee.id || // Legacy single promoter check
          (r.promoters && r.promoters.some((p: any) => p.id === user.employee.id)) // Multi-promoter check
        );
      });
      
      setTodaysRoutes(filtered);
      setIsOffline(false);

      // Cache routes offline (only for today or future? Maybe all accessed?)
      if (filtered.length > 0) {
        filtered.forEach((route: any) => {
          offlineService.saveRoute(route);
        });
        console.log(`Cached ${filtered.length} routes for offline use.`);
      }

    } catch (error) {
      console.error('Error fetching routes, trying offline cache:', error);
      setIsOffline(true);
      
      try {
        let cachedRoutes = await offlineService.getRoutesByDate(dateStr);
        
        // Fallback: If strict date match fails, get all and filter (robustness)
        if (!cachedRoutes || cachedRoutes.length === 0) {
            console.log('No routes found by exact date index, scanning all...');
            const allRoutes = await offlineService.getAllRoutes();
            cachedRoutes = allRoutes.filter(r => r.date && r.date.startsWith(dateStr));
        }

        console.log(`Loaded ${cachedRoutes?.length} routes from offline cache for ${dateStr}`);
        
        if (cachedRoutes && cachedRoutes.length > 0) {
          setTodaysRoutes(cachedRoutes);
          toast('Modo Offline: Exibindo rotas salvas localmente.', { icon: '📡' });
        } else {
          // Only show error if it's today, otherwise it might just be empty history
          const todayStr = new Date().toISOString().split('T')[0];
          if (dateStr === todayStr) {
             toast.error('Sem conexão e sem rotas salvas para esta data.');
          }
        }
      } catch (cacheError) {
        console.error('Error fetching from offline cache:', cacheError);
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePrevDay = () => setSelectedDate(prev => subDays(prev, 1));
  const handleNextDay = () => setSelectedDate(prev => addDays(prev, 1));

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  if (loading) {
    return <div className="p-4 text-center text-gray-500">Carregando painel...</div>;
  }

  return (
    <div className="p-4 space-y-6 pb-20">
      <header className="flex justify-between items-center">
        <div>
          <p className="text-gray-500 text-sm">{getGreeting()},</p>
          <h1 className="text-2xl font-bold text-gray-800">
            {String(user?.employee?.fullName || user?.name || user?.email || 'Promotor').split(' ')[0]}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => navigate('/settings')}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-full transition-colors"
          >
            <Settings size={20} />
          </button>
          
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-full p-1 shadow-sm">
            <button 
              onClick={handlePrevDay}
              className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <div 
              style={{ color: settings.primaryColor }} 
              className="px-2 text-xs font-bold min-w-[3rem] text-center"
            >
              {format(selectedDate, 'dd/MM', { locale: ptBR })}
            </div>
            <button 
              onClick={handleNextDay}
              className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </header>

      {isOffline && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-2 rounded-lg flex items-center gap-2 text-sm">
          <WifiOff size={16} />
          <span>Você está offline. Exibindo dados salvos localmente.</span>
        </div>
      )}

      {isManager ? (
        <SupervisorDashboardView routes={todaysRoutes} />
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-primary text-white p-4 rounded-2xl shadow-sm">
              <p className="text-white/80 text-xs mb-1">Visitas Hoje</p>
              <p className="text-3xl font-bold">
                {todaysRoutes.reduce((acc, r) => acc + r.items.length, 0)}
              </p>
            </div>
            <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm">
              <p className="text-gray-400 text-xs mb-1">Pendentes</p>
              <p className="text-3xl font-bold text-gray-800">
                {todaysRoutes.reduce((acc, r) => acc + r.items.filter((i: any) => i.status === 'PENDING').length, 0)}
              </p>
            </div>
          </div>

          {/* Current/Next Route */}
          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">
              {format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') 
                ? 'Agenda do Dia' 
                : `Agenda de ${format(selectedDate, 'dd/MM', { locale: ptBR })}`}
            </h2>
            
            {todaysRoutes.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center border border-dashed border-gray-300">
                <p className="text-gray-500">Nenhuma rota agendada para hoje.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {todaysRoutes.map((route) => (
                  <div key={route.id} className="space-y-3">
                    {/* Route Header with Promoters */}
                    <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-500">Equipe:</span>
                            <div className="flex -space-x-2">
                                {((route.promoters && route.promoters.length > 0) ? route.promoters : (route.promoter ? [route.promoter] : [])).map((p: any) => {
                                    const displayName = (p.fullName || p.name || p.email || '').trim() || 'Promotor';
                                    return (
                                        <div
                                          key={p.id}
                                          className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 border-2 border-white flex items-center justify-center text-[10px] font-bold"
                                          title={displayName}
                                        >
                                          {displayName.charAt(0).toUpperCase()}
                                        </div>
                                    );
                                })}
                            </div>
                            <span className="text-xs text-gray-400 ml-1">
                                {((route.promoters && route.promoters.length > 0) ? route.promoters : (route.promoter ? [route.promoter] : [])).map((p: any) => {
                                    const displayName = (p.fullName || p.name || p.email || '').trim() || 'Promotor';
                                    return displayName.split(' ')[0];
                                }).join(', ')}
                            </span>
                         </div>
                         <div className="flex items-center gap-2">
                            {route.status === 'COMPLETED' && (
                                <span className="text-[10px] text-green-700 bg-green-100 px-2 py-1 rounded-full font-bold">
                                    Finalizada
                                </span>
                            )}
                            <div className="text-[10px] text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                                Rota #{route.id.slice(0, 4)}
                            </div>
                         </div>
                    </div>

                    {route.items.sort((a: any, b: any) => a.order - b.order).map((item: any) => {
                      const isCompleted = item.status === 'CHECKOUT' || item.status === 'COMPLETED';
                      const isInProgress = item.status === 'CHECKIN';
                      
                      const currentUserCheckin = item.checkins?.find((c: any) => (c.promoterId === user?.id || c.promoterId === user?.employee?.id) && !c.checkOutTime);
                      const isCurrentUserCheckedIn = !!currentUserCheckin;

                      return (
                        <div 
                          key={item.id}
                          onClick={() => {
                            // Always navigate to Route Details first, as requested
                            // "ao clicar abre o detalhe da rota.. e ai as tarefas"
                            navigate(`/routes/${route.id}`, { state: { targetItemId: item.id } });
                          }}
                          className={`relative bg-white p-4 rounded-xl shadow-sm border flex gap-4 items-center active:scale-[0.98] transition-transform ${
                            isInProgress ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-100'
                          }`}
                        >
                          <div className="flex-col items-center justify-center min-w-[2.5rem] text-center">
                            <span className={`text-sm font-bold ${isCompleted ? 'text-green-500' : isInProgress ? 'text-blue-500' : 'text-gray-400'}`}>
                              {item.startTime || '--:--'}
                            </span>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-gray-800 truncate">
                              {item.supermarket?.fantasyName || item.supermarket?.name || 'PDV Sem Nome'}
                            </h3>
                            <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                              <MapPin size={10} /> 
                              {(() => {
                                const s = item.supermarket;
                                if (!s) return 'Endereço não disponível';
                                const parts = [
                                  s.street, 
                                  s.number, 
                                  s.neighborhood,
                                  s.city,
                                  s.state
                                ].filter(Boolean);
                                return parts.length > 0 ? parts.join(', ') : (s.address || 'Endereço não disponível');
                              })()}
                            </p>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/routes/${route.id}`, { state: { targetItemId: item.id, openTasks: true } });
                                }}
                                className="mt-2 text-xs flex items-center gap-1 bg-blue-50 text-blue-600 px-2 py-1 rounded-md font-medium hover:bg-blue-100 transition-colors w-fit"
                            >
                                <ListTodo size={12} />
                                Tarefas
                            </button>
                          </div>

                          <div className="shrink-0">
                             {isCompleted ? (
                               <CheckCircle className="text-green-500" size={24} />
                             ) : isInProgress ? (
                               <div className="animate-pulse bg-blue-100 text-blue-600 px-2 py-1 rounded text-xs font-bold">
                                 AGORA
                               </div>
                             ) : (
                               <div className="bg-gray-100 text-gray-400 p-1 rounded-full">
                                 <ArrowRight size={16} />
                               </div>
                             )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default DashboardView;
