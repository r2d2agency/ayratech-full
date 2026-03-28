import { useState, useEffect } from 'react';
import client from '../api/client';
import { offlineService } from '../services/offline.service';
import { toast, Toaster } from 'react-hot-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, MapPin, Coffee, LogIn, LogOut, ArrowLeft, Wifi, WifiOff, RefreshCw, List, Calendar, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface TimeClockEvent {
  id: string;
  eventType: 'ENTRY' | 'LUNCH_START' | 'LUNCH_END' | 'EXIT';
  timestamp: string;
}

interface ScheduleRule {
  startTime: string;
  endTime: string;
  breakStart?: string | null;
  breakEnd?: string | null;
  toleranceMinutes: number;
}

interface TodayStatus {
  events: TimeClockEvent[];
  nextAction: 'ENTRY' | 'LUNCH_START' | 'LUNCH_END' | 'EXIT' | 'DONE';
  status: 'PENDING' | 'WORKING' | 'LUNCH' | 'DONE';
  schedule?: ScheduleRule | null;
  summary: {
    entry?: string;
    lunchStart?: string;
    lunchEnd?: string;
    exit?: string;
  };
}

export default function TimeClockView() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [data, setData] = useState<TodayStatus | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    console.log('TimeClockView v1.4 loaded at', new Date().toISOString());
    // Try to load local cache immediately for better UX
    const cached = localStorage.getItem('timeClockStatus');
    if (cached) {
      setData(JSON.parse(cached));
      setLoading(false);
    }

    // Initial Sync and Fetch
    if (navigator.onLine) {
      offlineService.syncPendingActions().finally(() => {
        fetchStatus();
        updatePendingCount();
      });
    } else {
      fetchStatus();
      updatePendingCount();
    }

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    
    const handleStatusChange = () => {
        setIsOnline(navigator.onLine);
        if (navigator.onLine) {
            offlineService.syncPendingActions().then(() => {
                fetchStatus();
                updatePendingCount();
            });
        }
    };
    
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);

    return () => {
        clearInterval(timer);
        window.removeEventListener('online', handleStatusChange);
        window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  const updatePendingCount = async () => {
      const count = await offlineService.getPendingCount();
      setPendingCount(count);
  };

  const fetchStatus = async () => {
    try {
      let finalData: TodayStatus;

      try {
        const response = await client.get('/time-clock/status/today');
        finalData = response.data;
      } catch (error) {
        console.error('Error fetching status, trying local cache', error);
        const cached = localStorage.getItem('timeClockStatus');
        if (cached) {
            finalData = JSON.parse(cached);
            toast('Modo Offline: Usando dados em cache', { icon: '📡' });
        } else {
            throw error;
        }
      }

      // Merge Pending Actions logic
      const pendingActions = await offlineService.getPendingActionsByType('TIME_CLOCK');
      if (pendingActions && pendingActions.length > 0) {
        console.log(`Aplicando ${pendingActions.length} ações pendentes ao estado.`);
        
        // Sort by creation time
        pendingActions.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        
        const newSummary = { ...finalData.summary };
        let newStatus = finalData.status;
        let newNextAction = finalData.nextAction;
        const newEvents = [...(finalData.events || [])];

        for (const action of pendingActions) {
            const payload = action.payload;
            const type = payload.eventType;
            const ts = payload.timestamp;

            // Update Summary & Status
            if (type === 'ENTRY') {
                newSummary.entry = ts;
                newStatus = 'WORKING';
                newNextAction = 'LUNCH_START';
            } else if (type === 'LUNCH_START') {
                newSummary.lunchStart = ts;
                newStatus = 'LUNCH';
                newNextAction = 'LUNCH_END';
            } else if (type === 'LUNCH_END') {
                newSummary.lunchEnd = ts;
                newStatus = 'WORKING';
                newNextAction = 'EXIT';
            } else if (type === 'EXIT') {
                newSummary.exit = ts;
                newStatus = 'DONE';
                newNextAction = 'DONE';
            }

            // Add to events list if not already present (avoid duplicates)
            if (!newEvents.find(e => e.timestamp === ts)) {
                newEvents.push({
                    id: 'pending-' + action.id,
                    eventType: type as any,
                    timestamp: ts
                });
            }
        }

        finalData = {
            ...finalData,
            summary: newSummary,
            status: newStatus,
            nextAction: newNextAction,
            events: newEvents
        };
      }

      setData(finalData);
      localStorage.setItem('timeClockStatus', JSON.stringify(finalData));

    } catch (error) {
        console.error('Critical error fetching status', error);
        toast.error('Erro ao carregar dados do ponto');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!data) return;

    setProcessing(true);
    
    const proceedWithRegister = async (lat: number | null, lng: number | null) => {
        const timestamp = new Date().toISOString();
        try {
            await client.post('/time-clock', {
              eventType: data.nextAction,
              timestamp,
              latitude: lat,
              longitude: lng
            });
            toast.success('Ponto registrado com sucesso!');
            fetchStatus();
        } catch (error: any) {
            console.error('API failed', error);

            // Don't queue offline if it's a client error (4xx)
            // This prevents false "offline" registration when the server rejects the request (e.g. validation error)
            if (error.response && error.response.status >= 400 && error.response.status < 500) {
                const message = error.response.data?.message || 'Erro ao registrar ponto';
                toast.error(message);
                return; 
            }

            console.log('Saving offline action due to network/server error', error);
            await offlineService.addPendingAction(
                'TIME_CLOCK',
                '/time-clock',
                'POST',
                {
                    eventType: data.nextAction,
                    timestamp,
                    latitude: lat,
                    longitude: lng
                }
            );
            
            // Optimistic Update
            const newSummary = { ...data.summary };
            let newStatus: TodayStatus['status'] = data.status;
            let newNextAction: TodayStatus['nextAction'] = data.nextAction;

            if (data.nextAction === 'ENTRY') {
                newSummary.entry = timestamp;
                newStatus = 'WORKING';
                newNextAction = 'LUNCH_START';
            } else if (data.nextAction === 'LUNCH_START') {
                newSummary.lunchStart = timestamp;
                newStatus = 'LUNCH';
                newNextAction = 'LUNCH_END';
            } else if (data.nextAction === 'LUNCH_END') {
                newSummary.lunchEnd = timestamp;
                newStatus = 'WORKING';
                newNextAction = 'EXIT';
            } else if (data.nextAction === 'EXIT') {
                newSummary.exit = timestamp;
                newStatus = 'DONE';
                newNextAction = 'DONE';
            }

            const newEvent: TimeClockEvent = {
                id: 'temp-' + Date.now(),
                eventType: data.nextAction,
                timestamp: timestamp
            };

            const newData = {
                ...data,
                status: newStatus,
                nextAction: newNextAction,
                summary: newSummary,
                events: [...(data.events || []), newEvent]
            };
            
            setData(newData);
            localStorage.setItem('timeClockStatus', JSON.stringify(newData));
            updatePendingCount();
            toast.success('Ponto salvo offline! Será enviado quando online.');
        } finally {
            setProcessing(false);
        }
    };

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => proceedWithRegister(position.coords.latitude, position.coords.longitude),
            (error) => {
                console.error('Geolocation error:', error);
                toast.error('Não foi possível obter localização. Registrando sem local...');
                // Fallback to null location
                proceedWithRegister(null, null);
            }, 
            { enableHighAccuracy: true, timeout: 10000 }
        );
    } else {
        toast.error('Geolocalização não suportada. Registrando sem local...');
        proceedWithRegister(null, null);
    }
  };

  const getButtonConfig = () => {
    switch (data?.nextAction) {
      case 'ENTRY': return { label: 'Registrar Entrada', icon: LogIn, color: 'bg-green-600 hover:bg-green-700' };
      case 'LUNCH_START': return { label: 'Início Almoço', icon: Coffee, color: 'bg-orange-500 hover:bg-orange-600' };
      case 'LUNCH_END': return { label: 'Volta Almoço', icon: Coffee, color: 'bg-orange-500 hover:bg-orange-600' };
      case 'EXIT': return { label: 'Registrar Saída', icon: LogOut, color: 'bg-red-600 hover:bg-red-700' };
      case 'DONE': return { label: 'Dia Finalizado', icon: CheckCircle, color: 'bg-gray-400 cursor-not-allowed', disabled: true };
      default: return { label: 'Carregando...', icon: Clock, color: 'bg-gray-400' };
    }
  };

  const CheckCircle = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );

  const btnConfig = getButtonConfig();
  const Icon = btnConfig.icon;

  const getEventLabel = (type: string) => {
    switch (type) {
      case 'ENTRY': return 'Entrada';
      case 'LUNCH_START': return 'Início Almoço';
      case 'LUNCH_END': return 'Volta Almoço';
      case 'EXIT': return 'Saída';
      default: return type;
    }
  };

  const getScheduledTime = (type: string) => {
    if (!data?.schedule) return null;
    switch (type) {
        case 'ENTRY': return data.schedule.startTime;
        case 'LUNCH_START': return data.schedule.breakStart;
        case 'LUNCH_END': return data.schedule.breakEnd;
        case 'EXIT': return data.schedule.endTime;
        default: return null;
    }
  };

  const isLate = (type: string) => {
      const scheduled = getScheduledTime(type);
      if (!scheduled || !data?.schedule) return false;
      
      // If already done, not late (or at least, we don't show the warning anymore)
      // Check if done:
      if (type === 'ENTRY' && data.summary.entry) return false;
      if (type === 'LUNCH_START' && data.summary.lunchStart) return false;
      if (type === 'LUNCH_END' && data.summary.lunchEnd) return false;
      if (type === 'EXIT' && data.summary.exit) return false;

      // Current Time vs Scheduled + Tolerance
      const [h, m] = String(scheduled || '00:00').split(':').map(Number);
      const limit = new Date();
      limit.setHours(h, m + data.schedule.toleranceMinutes, 0, 0);
      
      return new Date() > limit;
  };

  const activeDelay = (() => {
      if (!data) return null;
      if (data.nextAction === 'ENTRY' && isLate('ENTRY')) return 'Entrada';
      if (data.nextAction === 'LUNCH_START' && isLate('LUNCH_START')) return 'Início Almoço';
      if (data.nextAction === 'LUNCH_END' && isLate('LUNCH_END')) return 'Volta Almoço';
      if (data.nextAction === 'EXIT' && isLate('EXIT')) return 'Saída';
      return null;
  })();

  if (loading) return <div className="h-screen flex items-center justify-center">Carregando...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Toaster position="top-center" />
      
      {/* Header */}
      <div className="bg-white p-4 shadow-sm flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="p-1">
            <ArrowLeft size={24} className="text-gray-600" />
            </button>
            <h1 className="font-bold text-gray-800 text-lg">
              Ponto Eletrônico <span className="text-xs text-gray-400 font-normal ml-2">v1.4</span>
            </h1>
        </div>

        <div className="flex items-center gap-2">
            {pendingCount > 0 && (
                <button 
                  onClick={() => offlineService.syncPendingActions().then(() => { fetchStatus(); updatePendingCount(); })}
                  className="bg-orange-100 text-orange-600 p-2 rounded-full relative"
                >
                  <RefreshCw size={20} className={processing ? 'animate-spin' : ''} />
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full">
                    {pendingCount}
                  </span>
                </button>
            )}
            {isOnline ? (
                <Wifi size={20} className="text-green-500" title="Online" />
            ) : (
                <WifiOff size={20} className="text-red-500" title="Offline" />
            )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        
        {/* Delay Warning */}
        {activeDelay && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-r shadow-sm flex items-center gap-3 animate-pulse">
             <AlertTriangle size={24} />
             <div>
                <p className="font-bold text-sm">Atenção: Atraso Detectado</p>
                <p className="text-xs">Você está atrasado para: <span className="font-bold">{activeDelay}</span>. Registre agora!</p>
             </div>
          </div>
        )}
        
        {/* Clock Display */}
        <div className="flex flex-col items-center gap-2 mt-4">
          <div className="text-gray-500 font-medium text-lg capitalize">
            {format(currentTime, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </div>
          <div className="text-5xl font-bold text-gray-800 tracking-wider font-mono">
            {format(currentTime, 'HH:mm:ss')}
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-bold ${
            data?.status === 'WORKING' ? 'bg-green-100 text-green-700' :
            data?.status === 'LUNCH' ? 'bg-orange-100 text-orange-700' :
            data?.status === 'DONE' ? 'bg-gray-200 text-gray-600' :
            'bg-gray-100 text-gray-500'
          }`}>
            {data?.status === 'WORKING' ? 'Em Jornada' :
             data?.status === 'LUNCH' ? 'Em Almoço' :
             data?.status === 'DONE' ? 'Jornada Finalizada' : 'Aguardando Início'}
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleRegister}
          disabled={processing || btnConfig.disabled}
          className={`w-64 h-64 rounded-full shadow-lg flex flex-col items-center justify-center gap-4 text-white transition-transform active:scale-95 ${btnConfig.color} ${processing ? 'opacity-75' : ''}`}
        >
          {processing ? (
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent"></div>
          ) : (
            <>
              <Icon size={64} />
              <span className="text-2xl font-bold">{btnConfig.label}</span>
            </>
          )}
        </button>

        {/* Summary Card */}
        <div className="w-full bg-white rounded-xl shadow-sm p-4 space-y-3">
          <h3 className="font-bold text-gray-700 border-b pb-2 flex items-center gap-2">
            <Clock size={18} /> Resumo do Dia
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Entrada</span>
                {data?.schedule?.startTime && <span className="text-[10px] text-gray-400">Meta: {data.schedule.startTime}</span>}
              </div>
              <p className={`font-mono font-medium ${isLate('ENTRY') ? 'text-red-600' : 'text-gray-800'}`}>
                {data?.summary.entry ? format(new Date(data.summary.entry), 'HH:mm') : '--:--'}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Saída Almoço</span>
                {data?.schedule?.breakStart && <span className="text-[10px] text-gray-400">Meta: {data.schedule.breakStart}</span>}
              </div>
              <p className={`font-mono font-medium ${isLate('LUNCH_START') ? 'text-red-600' : 'text-gray-800'}`}>
                {data?.summary.lunchStart ? format(new Date(data.summary.lunchStart), 'HH:mm') : '--:--'}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Volta Almoço</span>
                {data?.schedule?.breakEnd && <span className="text-[10px] text-gray-400">Meta: {data.schedule.breakEnd}</span>}
              </div>
              <p className={`font-mono font-medium ${isLate('LUNCH_END') ? 'text-red-600' : 'text-gray-800'}`}>
                {data?.summary.lunchEnd ? format(new Date(data.summary.lunchEnd), 'HH:mm') : '--:--'}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">Saída</span>
                {data?.schedule?.endTime && <span className="text-[10px] text-gray-400">Meta: {data.schedule.endTime}</span>}
              </div>
              <p className={`font-mono font-medium ${isLate('EXIT') ? 'text-red-600' : 'text-gray-800'}`}>
                {data?.summary.exit ? format(new Date(data.summary.exit), 'HH:mm') : '--:--'}
              </p>
            </div>
          </div>
        </div>

        {/* History List */}
        <div className="w-full bg-white rounded-xl shadow-sm p-4 space-y-3">
          <h3 className="font-bold text-gray-700 border-b pb-2 flex items-center gap-2">
            <List size={18} /> Histórico Completo
          </h3>
          
          <div className="space-y-3">
            {data?.events && data.events.length > 0 ? (
              data.events.map((event) => (
                <div key={event.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${
                      event.eventType === 'ENTRY' ? 'bg-green-100 text-green-600' :
                      event.eventType === 'EXIT' ? 'bg-red-100 text-red-600' :
                      'bg-orange-100 text-orange-600'
                    }`}>
                      <Clock size={16} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">{getEventLabel(event.eventType)}</p>
                      <p className="text-xs text-gray-500">{format(new Date(event.timestamp), "d 'de' MMMM", { locale: ptBR })}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold font-mono text-gray-800">{format(new Date(event.timestamp), 'HH:mm')}</p>
                    {(event.id.startsWith('pending-') || event.id.startsWith('temp-')) && (
                        <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1 rounded flex items-center justify-end gap-1 mt-1">
                           <Clock size={10} /> Pendente
                        </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-gray-400">
                <p>Nenhum registro hoje.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}