import React, { useState, useEffect, useMemo } from 'react';
import { format, parseISO, isValid, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, User, Clock, Plus, Filter, Search, FileText, Download, AlertTriangle, X, Smartphone, Monitor } from 'lucide-react';
import api, { API_URL } from '../api/client';
import SectionHeader from '../components/SectionHeader';
import { toast } from 'react-hot-toast';
import { io } from 'socket.io-client';

interface Alert {
  id: string;
  employeeName: string;
  label: string;
  scheduledTime: string;
  delayMinutes: number;
  message: string;
  timestamp: Date;
}

const TimeClockManagementView = () => {
  const [events, setEvents] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [rhTab, setRhTab] = useState<'eventos' | 'ponto_diario' | 'ocorrencias' | 'manuais' | 'impares' | 'faltas' | 'extras' | 'banco'>('eventos');
  const [filters, setFilters] = useState({
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    employeeId: ''
  });
  const [reportDate, setReportDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [occurrenceDate, setOccurrenceDate] = useState(format(subDays(new Date(), 1), 'yyyy-MM-dd'));
  const [competence, setCompetence] = useState(format(new Date(), 'yyyy-MM'));

  const [dailySheet, setDailySheet] = useState<any[]>([]);
  const [occurrences, setOccurrences] = useState<any[]>([]);
  const [manualMarks, setManualMarks] = useState<any[]>([]);
  const [oddMarks, setOddMarks] = useState<any[]>([]);
  const [overtimeSummary, setOvertimeSummary] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [balanceAdjustment, setBalanceAdjustment] = useState({
    employeeId: '',
    competence: format(new Date(), 'yyyy-MM'),
    deltaHours: 0,
    reason: '',
  });
  const [showModal, setShowModal] = useState(false);
  const initialEventState = {
    employeeId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '08:00',
    eventType: 'ENTRY',
    observation: ''
  };

  const [newEvent, setNewEvent] = useState(initialEventState);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    fetchEmployees();
    fetchEvents();

    const socket = io(API_URL + '/time-clock');

    socket.on('connect', () => {
      console.log('Connected to TimeClock WebSocket');
    });

    socket.on('hr-alert', (alert: any) => {
      console.log('Received HR Alert:', alert);
      toast((t) => (
        <div className="flex items-start gap-2">
           <AlertTriangle className="text-red-500" size={24} />
           <div>
             <p className="font-bold">Alerta de Ponto</p>
             <p className="text-sm">{alert.message}</p>
           </div>
        </div>
      ), { duration: 5000 });

      setAlerts(prev => [{ ...alert, id: Math.random().toString(36).substr(2, 9), timestamp: new Date() }, ...prev]);
    });

    return () => {
      socket.disconnect();
    };
  }, []); // Initial load

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm) {
        setIsSearching(true);
        try {
          const response = await api.get(`/employees?search=${searchTerm}`);
          setFilteredEmployees(response.data);
        } catch (error) {
          console.error('Error searching employees', error);
        } finally {
          setIsSearching(false);
        }
      } else {
        setFilteredEmployees([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/employees');
      setEmployees(response.data);
    } catch (error) {
      console.error('Erro ao buscar funcionários', error);
      toast.error('Erro ao carregar funcionários');
    }
  };

  const fetchDailySheet = async () => {
    try {
      const res = await api.get('/time-clock/reports/daily', {
        params: { date: reportDate, employeeId: filters.employeeId || undefined },
      });
      setDailySheet(res.data || []);
    } catch (error) {
      toast.error('Erro ao carregar ponto diário');
    }
  };

  const fetchOccurrences = async () => {
    try {
      const res = await api.get('/time-clock/reports/occurrences', {
        params: { date: occurrenceDate, employeeId: filters.employeeId || undefined },
      });
      setOccurrences(res.data || []);
    } catch (error) {
      toast.error('Erro ao carregar ocorrências');
    }
  };

  const fetchManualMarks = async () => {
    try {
      const res = await api.get('/time-clock/reports/manual', {
        params: { date: reportDate, employeeId: filters.employeeId || undefined },
      });
      setManualMarks(res.data || []);
    } catch (error) {
      toast.error('Erro ao carregar marcações manuais');
    }
  };

  const fetchOddMarks = async () => {
    try {
      const res = await api.get('/time-clock/reports/odd', {
        params: { date: reportDate, employeeId: filters.employeeId || undefined },
      });
      setOddMarks(res.data || []);
    } catch (error) {
      toast.error('Erro ao carregar marcações ímpares');
    }
  };

  const fetchOvertimeSummary = async () => {
    try {
      const res = await api.get('/time-clock/reports/overtime', {
        params: { startDate: filters.startDate, endDate: filters.endDate, employeeId: filters.employeeId || undefined },
      });
      setOvertimeSummary(res.data || []);
    } catch (error) {
      toast.error('Erro ao carregar relatório de horas');
    }
  };

  const fetchBalances = async () => {
    try {
      const res = await api.get('/time-clock/balances', {
        params: { competence, employeeId: filters.employeeId || undefined },
      });
      setBalances(res.data || []);
    } catch (error) {
      toast.error('Erro ao carregar banco de horas');
    }
  };

  const handleAdjustBalance = async () => {
    try {
      if (!balanceAdjustment.employeeId) {
        toast.error('Selecione um colaborador');
        return;
      }
      await api.post('/time-clock/balances/adjust', {
        employeeId: balanceAdjustment.employeeId,
        competence: balanceAdjustment.competence,
        deltaHours: Number(balanceAdjustment.deltaHours),
        reason: balanceAdjustment.reason || undefined,
      });
      toast.success('Saldo ajustado');
      fetchBalances();
    } catch (error) {
      toast.error('Erro ao ajustar saldo');
    }
  };

  const handleExport = async () => {
    try {
      const response = await api.get('/time-clock/export', {
        params: {
          startDate: filters.startDate,
          endDate: filters.endDate,
          employeeId: filters.employeeId
        },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `relatorio_ponto_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Erro ao exportar relatório', error);
      toast.error('Erro ao exportar relatório');
    }
  };

  const handleExportGeneralTimesheet = async () => {
    try {
      const response = await api.get('/employees/documents/timesheets/general/export', {
        params: { competence },
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `folha_ponto_geral_${competence}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error('Erro ao baixar folha geral');
    }
  };

  const handleGenerateMonthlyTimesheets = async () => {
    try {
      const res = await api.post('/employees/documents/timesheets/generate', {
        competence,
        sendToAll: true,
        skipIfExists: true,
      });
      const affected = res?.data?.affected ?? 0;
      toast.success(`Folhas geradas: ${affected}`);
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Erro ao gerar folhas do mês';
      toast.error(Array.isArray(msg) ? msg.join(', ') : String(msg));
    }
  };

  const handleApproveTimesheets = async () => {
    try {
      const res = await api.post('/employees/documents/timesheets/approve', null, {
        params: { competence },
      });
      const affected = res?.data?.affected ?? 0;
      toast.success(`Folhas aprovadas e notificadas: ${affected}`);
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Erro ao aprovar folhas';
      toast.error(Array.isArray(msg) ? msg.join(', ') : String(msg));
    }
  };

  const fetchEvents = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.employeeId) params.append('employeeId', filters.employeeId);
      
      const res = await api.get(`/time-clock?${params.toString()}`);
      setEvents(res.data);
    } catch (error) {
      toast.error('Erro ao carregar registros de ponto');
    }
  };

  const handleManualEntry = async () => {
    try {
        if (!newEvent.employeeId || !newEvent.date || !newEvent.time) {
            toast.error('Preencha todos os campos obrigatórios');
            return;
        }

        const timestamp = new Date(`${newEvent.date}T${newEvent.time}:00`);
        
        const payload = {
          employeeId: newEvent.employeeId,
          eventType: newEvent.eventType,
          timestamp: timestamp.toISOString(),
          observation: newEvent.observation
        };
        
        console.log('Sending manual entry payload:', JSON.stringify(payload, null, 2));

        if (editingEventId) {
            await api.patch(`/time-clock/${editingEventId}`, payload);
            toast.success('Registro atualizado com sucesso!');
        } else {
            await api.post('/time-clock/entry/manual', payload);
            toast.success('Registro manual adicionado com sucesso!');
        }

      setShowModal(false);
      setNewEvent(initialEventState);
      setEditingEventId(null);
      setSearchTerm('');
      setFilteredEmployees([]);
      fetchEvents();
    } catch (error: any) {
      console.error('Erro ao registrar ponto manual:', error);
      
      if (error.response) {
          console.error('Error Response Data:', JSON.stringify(error.response.data, null, 2));
          console.error('Error Status:', error.response.status);
      }

      let errorMessage = 'Erro ao adicionar registro manual';
      
      if (error.response?.data?.message) {
        const msg = error.response.data.message;
        errorMessage = Array.isArray(msg) ? msg.join(', ') : msg;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(`Erro: ${errorMessage}`);
    }
  };

  const removeAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const groupedEvents = useMemo(() => {
    const groups: any = {};
    
    events.forEach((event: any) => {
        if (!event.timestamp) return;
        const dateKey = format(parseISO(event.timestamp), 'yyyy-MM-dd');
        const key = `${event.employeeId}-${dateKey}`;
        
        if (!groups[key]) {
            groups[key] = {
                id: key,
                employee: event.employee,
                date: dateKey,
                entries: {
                    ENTRY: null,
                    LUNCH_START: null,
                    LUNCH_END: null,
                    EXIT: null
                }
            };
        }
        
        // If there's already an entry for this type, we might want to handle it (e.g., multiple entries)
        // For now, we'll just overwrite or keep the latest, but ideally we'd show all if needed.
        // A simple approach for the requested table view is to map the standard 4 slots.
        if (groups[key].entries[event.eventType] === null || new Date(event.timestamp) > new Date(groups[key].entries[event.eventType].timestamp)) {
             groups[key].entries[event.eventType] = event;
        }
    });
    
    return Object.values(groups).sort((a: any, b: any) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return (a.employee?.fullName || '').localeCompare(b.employee?.fullName || '');
    });
  }, [events]);

  const calculateTotalHours = (entries: any) => {
    let totalMs = 0;
    const getMs = (e: any) => e ? new Date(e.timestamp).getTime() : 0;
    
    const entry = entries.ENTRY;
    const lunchStart = entries.LUNCH_START;
    const lunchEnd = entries.LUNCH_END;
    const exit = entries.EXIT;

    if (entry && lunchStart) {
        totalMs += getMs(lunchStart) - getMs(entry);
    }
    if (lunchEnd && exit) {
        totalMs += getMs(exit) - getMs(lunchEnd);
    }
    // Continuous shift fallback (if no lunch recorded but has exit)
    if (entry && exit && !lunchStart && !lunchEnd) {
        totalMs += getMs(exit) - getMs(entry);
    }
    
    if (totalMs <= 0) return '-';
    
    const hours = Math.floor(totalMs / (1000 * 60 * 60));
    const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const formatMinutes = (minutes?: number | null) => {
    if (minutes === null || minutes === undefined || Number.isNaN(Number(minutes))) return '-';
    const sign = Number(minutes) < 0 ? '-' : '';
    const abs = Math.abs(Number(minutes));
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const handleEditEvent = (event: any) => {
      if (!event) return;
      
      setEditingEventId(event.id);
      const date = format(parseISO(event.timestamp), 'yyyy-MM-dd');
      const time = format(parseISO(event.timestamp), 'HH:mm');
      
      setNewEvent({
          employeeId: event.employee?.id || event.employeeId,
          date,
          time,
          eventType: event.eventType,
          observation: event.validationReason || '' // Assuming reason holds observation
      });
      
      // Pre-fill search term for UI
      if (event.employee) {
          setSearchTerm(event.employee.fullName);
      }
      
      setShowModal(true);
  };

  const renderTimeCell = (event: any) => {
    if (!event) return <span className="text-slate-300 text-sm">-</span>;
    
    const time = format(parseISO(event.timestamp), 'HH:mm');
    const isManual = event.isManual;
    
    return (
        <div 
            className="flex flex-col items-start cursor-pointer group relative"
            onClick={() => handleEditEvent(event)}
            title="Clique para editar"
        >
            <div className="flex items-center gap-2">
                <span className={`font-semibold ${isManual ? 'text-purple-700' : 'text-[color:var(--color-text)]'}`}>
                    {time}
                </span>
                <span className="opacity-0 group-hover:opacity-100 text-blue-600 transition-opacity">
                    <FileText size={12} />
                </span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
                {isManual ? (
                    <span className="flex items-center gap-1 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded" title={`Editado por: ${event.editedBy}`}>
                        <Monitor size={10} /> Manual
                    </span>
                ) : (
                    <span className="flex items-center gap-1 text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                        <Smartphone size={10} /> App
                    </span>
                )}
            </div>
        </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
        <div className="flex justify-between items-center">
            <SectionHeader 
                icon={<Clock size={24} className="text-blue-600" />} 
                title="Gestão de Ponto Eletrônico" 
                subtitle="Visualize e gerencie os registros de ponto dos colaboradores."
            />
            <div className="flex gap-2">
          <button
            onClick={handleGenerateMonthlyTimesheets}
            className="bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 flex items-center gap-2 font-medium"
          >
            <FileText size={20} /> Gerar folhas (mês)
          </button>
          <button
            onClick={handleApproveTimesheets}
            className="bg-indigo-700 text-white px-4 py-2 rounded-lg hover:bg-indigo-800 flex items-center gap-2 font-medium"
          >
            <FileText size={20} /> Aprovar/Enviar
          </button>
          <button
            onClick={handleExportGeneralTimesheet}
            className="bg-emerald-700 text-white px-4 py-2 rounded-lg hover:bg-emerald-800 flex items-center gap-2 font-medium"
          >
            <Download size={20} /> Folha geral
          </button>
          <button 
            onClick={handleExport}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 font-medium"
          >
            <Download size={20} /> Exportar Excel
          </button>
          <button 
            onClick={() => {
                setNewEvent(initialEventState);
                setEditingEventId(null);
                setSearchTerm('');
                setFilteredEmployees([]);
                setShowModal(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium"
          >
            <Plus size={20} /> Lançamento Manual
          </button>
        </div>
        </div>

        <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-2">
          <button onClick={() => setRhTab('eventos')} className={`px-3 py-2 rounded-lg text-sm font-semibold ${rhTab === 'eventos' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-[color:var(--color-text)] hover:bg-slate-200'}`}>Eventos</button>
          <button onClick={() => setRhTab('ponto_diario')} className={`px-3 py-2 rounded-lg text-sm font-semibold ${rhTab === 'ponto_diario' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-[color:var(--color-text)] hover:bg-slate-200'}`}>Ponto diário</button>
          <button onClick={() => setRhTab('ocorrencias')} className={`px-3 py-2 rounded-lg text-sm font-semibold ${rhTab === 'ocorrencias' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-[color:var(--color-text)] hover:bg-slate-200'}`}>Ocorrências</button>
          <button onClick={() => setRhTab('manuais')} className={`px-3 py-2 rounded-lg text-sm font-semibold ${rhTab === 'manuais' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-[color:var(--color-text)] hover:bg-slate-200'}`}>Manuais</button>
          <button onClick={() => setRhTab('impares')} className={`px-3 py-2 rounded-lg text-sm font-semibold ${rhTab === 'impares' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-[color:var(--color-text)] hover:bg-slate-200'}`}>Ímpares</button>
          <button onClick={() => setRhTab('faltas')} className={`px-3 py-2 rounded-lg text-sm font-semibold ${rhTab === 'faltas' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-[color:var(--color-text)] hover:bg-slate-200'}`}>Faltas</button>
          <button onClick={() => setRhTab('extras')} className={`px-3 py-2 rounded-lg text-sm font-semibold ${rhTab === 'extras' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-[color:var(--color-text)] hover:bg-slate-200'}`}>Horas</button>
          <button onClick={() => setRhTab('banco')} className={`px-3 py-2 rounded-lg text-sm font-semibold ${rhTab === 'banco' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-[color:var(--color-text)] hover:bg-slate-200'}`}>Banco</button>
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold text-red-600 flex items-center gap-2">
              <AlertTriangle size={20} />
              Alertas de Ponto ({alerts.length})
            </h3>
            <div className="grid gap-2">
              {alerts.map(alert => (
                <div key={alert.id} className="bg-red-50 border border-red-200 p-4 rounded-lg flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-red-100 rounded-full text-red-600">
                      <AlertTriangle size={20} />
                    </div>
                    <div>
                      <p className="font-medium text-red-900">{alert.message}</p>
                      <p className="text-sm text-red-700">
                        {format(new Date(alert.timestamp), "HH:mm")} - {alert.employeeName} ({alert.label} agendado para {alert.scheduledTime})
                      </p>
                    </div>
                  </div>
                  <button onClick={() => removeAlert(alert.id)} className="text-red-400 hover:text-red-600">
                    <X size={20} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {rhTab === 'eventos' && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-end">
            <div>
                <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Colaborador</label>
                <select 
                    className="border border-slate-300 rounded-lg p-2 w-64 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={filters.employeeId}
                    onChange={(e) => setFilters({...filters, employeeId: e.target.value})}
                >
                    <option value="">Todos</option>
                    {employees.map((emp: any) => (
                        <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                    ))}
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Data Início</label>
                <input 
                    type="date" 
                    className="border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={filters.startDate}
                    onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Data Fim</label>
                <input 
                    type="date" 
                    className="border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={filters.endDate}
                    onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                />
            </div>
            <button 
                onClick={fetchEvents}
                className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 flex items-center gap-2"
            >
                <Filter size={18} /> Filtrar
            </button>
        </div>
        )}

        {rhTab === 'ponto_diario' && (
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Colaborador</label>
              <select
                className="border border-slate-300 rounded-lg p-2 w-64 focus:ring-2 focus:ring-blue-500 outline-none"
                value={filters.employeeId}
                onChange={(e) => setFilters({ ...filters, employeeId: e.target.value })}
              >
                <option value="">Todos</option>
                {employees.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Data</label>
              <input
                type="date"
                className="border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
              />
            </div>
            <button onClick={fetchDailySheet} className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 flex items-center gap-2">
              <Filter size={18} /> Gerar
            </button>
          </div>
        )}

        {rhTab === 'ocorrencias' && (
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Colaborador</label>
              <select
                className="border border-slate-300 rounded-lg p-2 w-64 focus:ring-2 focus:ring-blue-500 outline-none"
                value={filters.employeeId}
                onChange={(e) => setFilters({ ...filters, employeeId: e.target.value })}
              >
                <option value="">Todos</option>
                {employees.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Data</label>
              <input
                type="date"
                className="border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                value={occurrenceDate}
                onChange={(e) => setOccurrenceDate(e.target.value)}
              />
            </div>
            <button onClick={fetchOccurrences} className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 flex items-center gap-2">
              <Filter size={18} /> Gerar
            </button>
          </div>
        )}

        {rhTab === 'manuais' && (
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Colaborador</label>
              <select
                className="border border-slate-300 rounded-lg p-2 w-64 focus:ring-2 focus:ring-blue-500 outline-none"
                value={filters.employeeId}
                onChange={(e) => setFilters({ ...filters, employeeId: e.target.value })}
              >
                <option value="">Todos</option>
                {employees.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Data</label>
              <input
                type="date"
                className="border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
              />
            </div>
            <button onClick={fetchManualMarks} className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 flex items-center gap-2">
              <Filter size={18} /> Gerar
            </button>
          </div>
        )}

        {rhTab === 'impares' && (
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Colaborador</label>
              <select
                className="border border-slate-300 rounded-lg p-2 w-64 focus:ring-2 focus:ring-blue-500 outline-none"
                value={filters.employeeId}
                onChange={(e) => setFilters({ ...filters, employeeId: e.target.value })}
              >
                <option value="">Todos</option>
                {employees.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Data</label>
              <input
                type="date"
                className="border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
              />
            </div>
            <button onClick={fetchOddMarks} className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 flex items-center gap-2">
              <Filter size={18} /> Gerar
            </button>
          </div>
        )}

        {rhTab === 'faltas' && (
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Colaborador</label>
              <select
                className="border border-slate-300 rounded-lg p-2 w-64 focus:ring-2 focus:ring-blue-500 outline-none"
                value={filters.employeeId}
                onChange={(e) => setFilters({ ...filters, employeeId: e.target.value })}
              >
                <option value="">Todos</option>
                {employees.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Data</label>
              <input
                type="date"
                className="border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
              />
            </div>
            <button onClick={fetchDailySheet} className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 flex items-center gap-2">
              <Filter size={18} /> Gerar
            </button>
          </div>
        )}

        {rhTab === 'extras' && (
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Colaborador</label>
              <select
                className="border border-slate-300 rounded-lg p-2 w-64 focus:ring-2 focus:ring-blue-500 outline-none"
                value={filters.employeeId}
                onChange={(e) => setFilters({ ...filters, employeeId: e.target.value })}
              >
                <option value="">Todos</option>
                {employees.map((emp: any) => (
                  <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Data Início</label>
              <input
                type="date"
                className="border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Data Fim</label>
              <input
                type="date"
                className="border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              />
            </div>
            <button onClick={fetchOvertimeSummary} className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 flex items-center gap-2">
              <Filter size={18} /> Gerar
            </button>
          </div>
        )}

        {rhTab === 'banco' && (
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Colaborador</label>
                <select
                  className="border border-slate-300 rounded-lg p-2 w-64 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={filters.employeeId}
                  onChange={(e) => setFilters({ ...filters, employeeId: e.target.value })}
                >
                  <option value="">Todos</option>
                  {employees.map((emp: any) => (
                    <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Competência</label>
                <input
                  type="month"
                  className="border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={competence}
                  onChange={(e) => setCompetence(e.target.value)}
                />
              </div>
              <button onClick={fetchBalances} className="bg-slate-800 text-white px-4 py-2 rounded-lg hover:bg-slate-900 flex items-center gap-2">
                <Filter size={18} /> Carregar
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Colaborador</label>
                <select
                  className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={balanceAdjustment.employeeId}
                  onChange={(e) => setBalanceAdjustment(prev => ({ ...prev, employeeId: e.target.value }))}
                >
                  <option value="">Selecione</option>
                  {employees.map((emp: any) => (
                    <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Competência</label>
                <input
                  type="month"
                  className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={balanceAdjustment.competence}
                  onChange={(e) => setBalanceAdjustment(prev => ({ ...prev, competence: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Delta (horas)</label>
                <input
                  type="number"
                  step="0.25"
                  className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={balanceAdjustment.deltaHours as any}
                  onChange={(e) => setBalanceAdjustment(prev => ({ ...prev, deltaHours: Number(e.target.value) }))}
                />
              </div>
              <div className="md:col-span-4">
                <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Motivo</label>
                <input
                  type="text"
                  className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={balanceAdjustment.reason}
                  onChange={(e) => setBalanceAdjustment(prev => ({ ...prev, reason: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={handleAdjustBalance} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium">Salvar ajuste</button>
            </div>
          </div>
        )}

        {rhTab === 'eventos' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                        <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Colaborador</th>
                        <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Data</th>
                        <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Entrada</th>
                        <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Início Almoço</th>
                        <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Fim Almoço</th>
                        <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Saída</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {groupedEvents.length === 0 ? (
                        <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-400">Nenhum registro encontrado.</td>
                        </tr>
                    ) : (
                        groupedEvents.map((group: any) => (
                            <tr key={group.id} className="hover:bg-slate-50">
                                <td className="p-4">
                                    <div className="font-medium text-[color:var(--color-text)]">{group.employee?.fullName}</div>
                                    <div className="text-xs text-[color:var(--color-muted)]">{group.employee?.email}</div>
                                </td>
                                <td className="p-4 text-[color:var(--color-text)] font-medium">
                                    {format(parseISO(group.date), "dd/MM/yyyy", { locale: ptBR })}
                                </td>
                                <td className="p-4 bg-green-50/30">
                                    {renderTimeCell(group.entries.ENTRY)}
                                </td>
                                <td className="p-4 bg-yellow-50/30">
                                    {renderTimeCell(group.entries.LUNCH_START)}
                                </td>
                                <td className="p-4 bg-orange-50/30">
                                    {renderTimeCell(group.entries.LUNCH_END)}
                                </td>
                                <td className="p-4 bg-red-50/30">
                                    {renderTimeCell(group.entries.EXIT)}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
        )}

        {rhTab === 'ponto_diario' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Colaborador</th>
                  <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Escala</th>
                  <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Entrada</th>
                  <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Almoço</th>
                  <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Saída</th>
                  <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Trabalhadas</th>
                  <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Previstas</th>
                  <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Extras</th>
                  <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Faltas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dailySheet.length === 0 ? (
                  <tr><td colSpan={9} className="p-8 text-center text-slate-400">Nenhum resultado.</td></tr>
                ) : (
                  dailySheet.map((r: any) => (
                    <tr key={`${r.employeeId}-${r.date}`} className="hover:bg-slate-50">
                      <td className="p-4">
                        <div className="font-medium text-[color:var(--color-text)]">{r.employeeName}</div>
                        <div className="text-xs text-[color:var(--color-muted)]">
                          {r.hasManual ? 'Manual' : 'App'} {r.hasOddPunches ? '• Ímpar' : ''} {Array.isArray(r.absences) && r.absences.length ? `• ${r.absences[0].type}` : ''}
                        </div>
                      </td>
                      <td className="p-4 text-[color:var(--color-text)]">{r.schedule || '-'}</td>
                      <td className="p-4 text-[color:var(--color-text)]">{r.entry || '-'}</td>
                      <td className="p-4 text-[color:var(--color-text)]">{r.lunchStart || '-'} / {r.lunchEnd || '-'}</td>
                      <td className="p-4 text-[color:var(--color-text)]">{r.exit || '-'}</td>
                      <td className="p-4 font-semibold text-[color:var(--color-text)]">{formatMinutes(r.workedMinutes)}</td>
                      <td className="p-4 text-[color:var(--color-text)]">{formatMinutes(r.expectedMinutes)}</td>
                      <td className="p-4 text-[color:var(--color-text)]">{formatMinutes(r.overtimeMinutes)}</td>
                      <td className="p-4 text-[color:var(--color-text)]">{formatMinutes(r.missingMinutes)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {rhTab === 'ocorrencias' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Colaborador</th>
                  <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Tipo</th>
                  <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Detalhe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {occurrences.length === 0 ? (
                  <tr><td colSpan={3} className="p-8 text-center text-slate-400">Nenhum resultado.</td></tr>
                ) : (
                  occurrences.map((o: any, idx: number) => (
                    <tr key={`${o.employeeId}-${idx}`} className="hover:bg-slate-50">
                      <td className="p-4 font-medium text-[color:var(--color-text)]">{o.employeeName}</td>
                      <td className="p-4 text-[color:var(--color-text)]">{o.type}</td>
                      <td className="p-4 text-[color:var(--color-text)]">{o.detail}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {rhTab === 'manuais' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Colaborador</th>
                  <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Data/Hora</th>
                  <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Tipo</th>
                  <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Editado por</th>
                  <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {manualMarks.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-400">Nenhum resultado.</td></tr>
                ) : (
                  manualMarks.map((e: any) => (
                    <tr key={e.id} className="hover:bg-slate-50">
                      <td className="p-4 font-medium text-[color:var(--color-text)]">{e.employee?.fullName}</td>
                      <td className="p-4 text-[color:var(--color-text)]">{isValid(parseISO(e.timestamp)) ? format(parseISO(e.timestamp), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '-'}</td>
                      <td className="p-4 text-[color:var(--color-text)]">{e.eventType}</td>
                      <td className="p-4 text-[color:var(--color-text)]">{e.editedBy || '-'}</td>
                      <td className="p-4 text-[color:var(--color-text)]">{e.validationReason || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {rhTab === 'impares' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Colaborador</th>
                  <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Marcações</th>
                  <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Entrada</th>
                  <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Saída</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {oddMarks.length === 0 ? (
                  <tr><td colSpan={4} className="p-8 text-center text-slate-400">Nenhum resultado.</td></tr>
                ) : (
                  oddMarks.map((r: any) => (
                    <tr key={`${r.employeeId}-${r.date}`} className="hover:bg-slate-50">
                      <td className="p-4 font-medium text-[color:var(--color-text)]">{r.employeeName}</td>
                      <td className="p-4 text-[color:var(--color-text)]">{r.punchesCount}</td>
                      <td className="p-4 text-[color:var(--color-text)]">{r.entry || '-'}</td>
                      <td className="p-4 text-[color:var(--color-text)]">{r.exit || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {rhTab === 'faltas' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Colaborador</th>
                  <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Escala</th>
                  <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Previstas</th>
                  <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Justificativa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dailySheet.filter((r: any) => r.expectedMinutes != null && r.punchesCount === 0 && (!Array.isArray(r.absences) || r.absences.length === 0)).length === 0 ? (
                  <tr><td colSpan={4} className="p-8 text-center text-slate-400">Nenhum resultado.</td></tr>
                ) : (
                  dailySheet
                    .filter((r: any) => r.expectedMinutes != null && r.punchesCount === 0 && (!Array.isArray(r.absences) || r.absences.length === 0))
                    .map((r: any) => (
                      <tr key={`${r.employeeId}-${r.date}`} className="hover:bg-slate-50">
                        <td className="p-4 font-medium text-[color:var(--color-text)]">{r.employeeName}</td>
                        <td className="p-4 text-[color:var(--color-text)]">{r.schedule || '-'}</td>
                        <td className="p-4 text-[color:var(--color-text)]">{formatMinutes(r.expectedMinutes)}</td>
                        <td className="p-4 text-[color:var(--color-text)]">-</td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {rhTab === 'extras' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Colaborador</th>
                  <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Extra 50%</th>
                  <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Extra 100%</th>
                  <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Adic. Noturno</th>
                  <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Banco</th>
                  <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Horas faltas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {overtimeSummary.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-400">Nenhum resultado.</td></tr>
                ) : (
                  overtimeSummary.map((r: any) => (
                    <tr key={r.employeeId} className="hover:bg-slate-50">
                      <td className="p-4 font-medium text-[color:var(--color-text)]">{r.employeeName}</td>
                      <td className="p-4 text-[color:var(--color-text)]">{r.overtime50Hours}</td>
                      <td className="p-4 text-[color:var(--color-text)]">{r.overtime100Hours}</td>
                      <td className="p-4 text-[color:var(--color-text)]">{r.nightHours}</td>
                      <td className="p-4 text-[color:var(--color-text)]">{r.bankHours}</td>
                      <td className="p-4 text-[color:var(--color-text)]">{r.missingHours}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {rhTab === 'banco' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Colaborador</th>
                  <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Competência</th>
                  <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Saldo banco</th>
                  <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Previstas</th>
                  <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Trabalhadas</th>
                  <th className="text-left p-4 text-sm font-semibold text-[color:var(--color-muted)]">Extras</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {balances.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-400">Nenhum resultado.</td></tr>
                ) : (
                  balances.map((b: any) => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="p-4 font-medium text-[color:var(--color-text)]">{b.employee?.fullName || '-'}</td>
                      <td className="p-4 text-[color:var(--color-text)]">{b.competence}</td>
                      <td className="p-4 text-[color:var(--color-text)]">{b.balanceHours}</td>
                      <td className="p-4 text-[color:var(--color-text)]">{b.expectedHours}</td>
                      <td className="p-4 text-[color:var(--color-text)]">{b.workedHours}</td>
                      <td className="p-4 text-[color:var(--color-text)]">{b.overtimeHours}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal */}
        {showModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl">
                    <h2 className="text-xl font-bold mb-4">Lançamento Manual de Ponto</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Colaborador</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Digite para buscar..."
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setNewEvent({ ...newEvent, employeeId: '' });
                                        setIsDropdownOpen(true);
                                    }}
                                    onFocus={() => setIsDropdownOpen(true)}
                                />
                                {isSearching && (
                                    <div className="absolute right-3 top-3">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                                    </div>
                                )}
                                {isDropdownOpen && filteredEmployees.length > 0 && (
                                    <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
                                        {filteredEmployees.map((emp: any) => (
                                            <div
                                                key={emp.id}
                                                className="p-2 hover:bg-gray-50 cursor-pointer flex flex-col"
                                                onClick={() => {
                                                    setNewEvent({ ...newEvent, employeeId: emp.id });
                                                    setSearchTerm(emp.fullName);
                                                    setIsDropdownOpen(false);
                                                }}
                                            >
                                                <span className="font-medium">{emp.fullName}</span>
                                                <span className="text-xs text-gray-500">{emp.email}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {newEvent.employeeId && !isDropdownOpen && (
                                    <div className="text-xs text-green-600 mt-1 font-medium">
                                        Selecionado: {filteredEmployees.find((e: any) => e.id === newEvent.employeeId)?.fullName || searchTerm}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Data</label>
                                <input 
                                    type="date" 
                                    className="w-full border rounded-lg p-2"
                                    value={newEvent.date}
                                    onChange={(e) => setNewEvent({...newEvent, date: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Hora</label>
                                <input 
                                    type="time" 
                                    className="w-full border rounded-lg p-2"
                                    value={newEvent.time}
                                    onChange={(e) => setNewEvent({...newEvent, time: e.target.value})}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Tipo de Evento</label>
                            <select 
                                className="w-full border rounded-lg p-2"
                                value={newEvent.eventType}
                                onChange={(e) => setNewEvent({...newEvent, eventType: e.target.value})}
                            >
                                <option value="ENTRY">Entrada</option>
                                <option value="LUNCH_START">Início Almoço</option>
                                <option value="LUNCH_END">Fim Almoço</option>
                                <option value="EXIT">Saída</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Observação / Justificativa</label>
                            <textarea 
                                className="w-full border rounded-lg p-2"
                                rows={3}
                                value={newEvent.observation}
                                onChange={(e) => setNewEvent({...newEvent, observation: e.target.value})}
                                placeholder="Ex: Esqueceu de bater o ponto..."
                            />
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end gap-3">
                        <button 
                            onClick={() => setShowModal(false)}
                            className="px-4 py-2 text-[color:var(--color-muted)] hover:bg-slate-100 rounded-lg font-medium"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={handleManualEntry}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                        >
                            Salvar Registro
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default TimeClockManagementView;
