import React, { useEffect, useMemo, useState } from 'react';
import { 
  Users, Calendar, Clock, AlertTriangle, FileText, CalendarClock, ChevronRight, TrendingUp
} from 'lucide-react';
import SectionHeader from '../components/SectionHeader';
import StatCard from '../components/StatCard';
import api from '../api/client';

type DateFilterId =
  | 'hoje'
  | 'amanha'
  | 'esta_semana'
  | 'ultima_semana'
  | 'este_mes'
  | 'proximos_15_dias';

type DateRange = { start: Date; end: Date };

type AbsenceItem = {
  id: string;
  name: string;
  role: string;
  reason: string;
  days: number;
  startDate: string;
  endDate: string;
};

type VacationItem = {
  id: string;
  name: string;
  role: string;
  status: 'Vencida' | 'A Vencer';
  dueDate: string;
};

type OvertimeItem = {
  id: string;
  name: string;
  role: string;
  date: string;
  total: string;
  p50: string;
  p100: string;
};

type LateClockItem = {
  id: string;
  name: string;
  role: string;
  timestamp: string;
  minutesLate: number;
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

const addDays = (d: Date, days: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
};

const parseYmd = (ymd: string) => {
  const [y, m, day] = ymd.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, day ?? 1);
};

const startOfWeekMonday = (d: Date) => {
  const day = d.getDay();
  const diff = (day + 6) % 7;
  return startOfDay(addDays(d, -diff));
};

const endOfWeekSunday = (d: Date) => endOfDay(addDays(startOfWeekMonday(d), 6));

const startOfMonth = (d: Date) => startOfDay(new Date(d.getFullYear(), d.getMonth(), 1));
const endOfMonth = (d: Date) => endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0));

const getRange = (filterId: DateFilterId, now: Date): DateRange => {
  if (filterId === 'hoje') return { start: startOfDay(now), end: endOfDay(now) };
  if (filterId === 'amanha') {
    const tomorrow = addDays(now, 1);
    return { start: startOfDay(tomorrow), end: endOfDay(tomorrow) };
  }
  if (filterId === 'esta_semana') return { start: startOfWeekMonday(now), end: endOfWeekSunday(now) };
  if (filterId === 'ultima_semana') {
    const lastWeekRef = addDays(now, -7);
    return { start: startOfWeekMonday(lastWeekRef), end: endOfWeekSunday(lastWeekRef) };
  }
  if (filterId === 'proximos_15_dias') return { start: startOfDay(now), end: endOfDay(addDays(now, 14)) };
  return { start: startOfMonth(now), end: endOfMonth(now) };
};

const hoursToNumber = (value: string) => Number(String(value).replace('h', '').replace(',', '.')) || 0;
const formatHours = (n: number) => `${Math.round(n * 10) / 10}h`;

interface RHDashboardViewProps {}

const RHDashboardView: React.FC<RHDashboardViewProps> = () => {
  const [dateFilter, setDateFilter] = useState<DateFilterId>('este_mes');
  const [selectedAlert, setSelectedAlert] = useState<any | null>(null);
  const [timesheetCompetence, setTimesheetCompetence] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [timesheetSummary, setTimesheetSummary] = useState<any | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await api.get('/employees/documents/timesheets/status-summary', {
          params: { competence: timesheetCompetence },
        });
        setTimesheetSummary(res.data || null);
      } catch (e) {
        setTimesheetSummary(null);
      }
    };
    run();
  }, [timesheetCompetence]);

  // Mocks para o dashboard de RH
  const absencesList: AbsenceItem[] = [
    { id: '1', name: 'João Silva', role: 'Promotor', reason: 'Atestado Médico (CID J01)', days: 2, startDate: '2026-03-26', endDate: '2026-03-27' },
    { id: '2', name: 'Maria Souza', role: 'Promotora', reason: 'Licença Maternidade', days: 120, startDate: '2026-02-01', endDate: '2026-05-31' },
  ];

  const vacationsList: VacationItem[] = [
    { id: '3', name: 'Carlos Oliveira', role: 'Supervisor', status: 'Vencida', dueDate: '2026-03-01' },
    { id: '4', name: 'Ana Costa', role: 'Promotora', status: 'A Vencer', dueDate: '2026-04-15' },
  ];

  const overtimesList: OvertimeItem[] = [
    { id: '5', name: 'Pedro Santos', role: 'Promotor', date: '2026-03-26', total: '10h', p50: '8h', p100: '2h' },
    { id: '6', name: 'Lucas Pereira', role: 'Promotor', date: '2026-03-12', total: '5h', p50: '5h', p100: '0h' },
  ];

  const lateClocksList: LateClockItem[] = [
    { id: '7', name: 'Pedro Santos', role: 'Promotor', timestamp: '2026-03-26T08:17:00', minutesLate: 17 },
    { id: '8', name: 'Lucas Pereira', role: 'Promotor', timestamp: '2026-03-26T08:09:00', minutesLate: 9 },
    { id: '9', name: 'Ana Costa', role: 'Promotora', timestamp: '2026-03-12T08:23:00', minutesLate: 23 },
  ];

  const now = useMemo(() => new Date(), []);
  const range = useMemo(() => getRange(dateFilter, now), [dateFilter, now]);

  const filteredAbsences = useMemo(() => {
    return absencesList.filter((a) => {
      const s = startOfDay(parseYmd(a.startDate));
      const e = endOfDay(parseYmd(a.endDate));
      return s <= range.end && e >= range.start;
    });
  }, [absencesList, range.end, range.start]);

  const filteredVacations = useMemo(() => {
    return vacationsList.filter((v) => {
      if (v.status === 'Vencida') return true;
      const due = parseYmd(v.dueDate);
      return due >= range.start && due <= range.end;
    });
  }, [range.end, range.start, vacationsList]);

  const filteredOvertimes = useMemo(() => {
    return overtimesList.filter((o) => {
      const d = parseYmd(o.date);
      return d >= range.start && d <= range.end;
    });
  }, [overtimesList, range.end, range.start]);

  const filteredLateClocks = useMemo(() => {
    return lateClocksList.filter((l) => {
      const t = new Date(l.timestamp);
      return t >= range.start && t <= range.end;
    });
  }, [lateClocksList, range.end, range.start]);

  const overtimeTotals = useMemo(() => {
    const total = filteredOvertimes.reduce((acc, o) => acc + hoursToNumber(o.total), 0);
    const p50 = filteredOvertimes.reduce((acc, o) => acc + hoursToNumber(o.p50), 0);
    const p100 = filteredOvertimes.reduce((acc, o) => acc + hoursToNumber(o.p100), 0);
    return { total, p50, p100 };
  }, [filteredOvertimes]);

  const rhStats = useMemo(() => {
    const vacationsExpired = vacationsList.filter((v) => v.status === 'Vencida').length;
    const vacationsExpiring = filteredVacations.filter((v) => v.status !== 'Vencida').length;

    return {
      vacationsExpiring: { value: String(vacationsExpiring), trend: dateFilter === 'proximos_15_dias' ? 'Próx. 15 dias' : 'No período' },
      vacationsExpired: { value: String(vacationsExpired), trend: 'Atrasadas' },
      absences: { value: String(filteredAbsences.length), sub: 'No período' },
      lateClocks: { value: String(filteredLateClocks.length), sub: 'No período' },
      overtimeTotal: { value: formatHours(overtimeTotals.total), sub: `50%: ${formatHours(overtimeTotals.p50)} | 100%: ${formatHours(overtimeTotals.p100)}` },
    };
  }, [dateFilter, filteredAbsences.length, filteredLateClocks.length, filteredVacations, overtimeTotals.p100, overtimeTotals.p50, overtimeTotals.total, vacationsList]);

  const overtimeBreakdown = useMemo(() => {
    const total = Math.max(0.0001, overtimeTotals.total);
    return {
      p50Pct: Math.min(100, Math.max(0, (overtimeTotals.p50 / total) * 100)),
      p100Pct: Math.min(100, Math.max(0, (overtimeTotals.p100 / total) * 100)),
    };
  }, [overtimeTotals.p100, overtimeTotals.p50, overtimeTotals.total]);

  return (
    <div className="space-y-6">
      <SectionHeader 
        title="Dashboard de Recursos Humanos" 
        subtitle="Visão geral de colaboradores, atestados, férias e ponto"
        icon={<Users className="text-[color:var(--color-primary)]" />}
      />

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {[
          { id: 'hoje', label: 'Hoje' },
          { id: 'amanha', label: 'Amanhã' },
          { id: 'esta_semana', label: 'Esta Semana' },
          { id: 'ultima_semana', label: 'Última Semana' },
          { id: 'este_mes', label: 'Este Mês' },
          { id: 'proximos_15_dias', label: 'Próximos 15 Dias' },
        ].map((filter) => (
          <button
            key={filter.id}
            onClick={() => setDateFilter(filter.id as DateFilterId)}
            className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
              dateFilter === filter.id
                ? 'bg-[color:var(--color-primary)] text-white border-[color:var(--color-primary)] shadow-sm'
                : 'bg-[color:var(--surface-container-low)] text-[color:var(--color-muted)] border-[color:var(--color-border)] hover:border-[color:var(--color-primary)]/40'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <StatCard 
          icon={<AlertTriangle />}
          label="Atestados / Afastados"
          value={rhStats.absences.value}
          sub={rhStats.absences.sub}
          color="bg-red-50 text-red-500 border-red-100"
        />
        <StatCard 
          icon={<Calendar />}
          label="Férias a Vencer"
          value={rhStats.vacationsExpiring.value}
          trend={rhStats.vacationsExpiring.trend}
          color="bg-amber-50 text-amber-500 border-amber-100"
        />
        <StatCard 
          icon={<CalendarClock />}
          label="Férias Vencidas"
          value={rhStats.vacationsExpired.value}
          trend={rhStats.vacationsExpired.trend}
          color="bg-rose-50 text-rose-500 border-rose-100"
        />
        <StatCard
          icon={<TrendingUp />}
          label="Horas Extras"
          value={rhStats.overtimeTotal.value}
          sub={rhStats.overtimeTotal.sub}
          color="bg-blue-50 text-blue-500 border-blue-100"
        />
        <StatCard 
          icon={<Clock />}
          label="Pontos Atrasados"
          value={rhStats.lateClocks.value}
          sub={rhStats.lateClocks.sub}
          color="bg-orange-50 text-orange-500 border-orange-100"
        />
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-[10px] font-semibold text-[color:var(--color-muted)] uppercase tracking-wider">Folha (comp.)</label>
            <input
              value={timesheetCompetence}
              onChange={(e) => setTimesheetCompetence(e.target.value)}
              className="w-[110px] text-xs px-2 py-1 rounded-md border border-[color:var(--color-border)] bg-[color:var(--surface-container-low)]"
              placeholder="YYYY-MM"
            />
          </div>
          <StatCard
            icon={<FileText />}
            label="Folhas de Ponto"
            value={`${timesheetSummary?.pending ?? 0} / ${timesheetSummary?.validated ?? 0}`}
            sub={`Aguardando / Validadas | A assinar: ${timesheetSummary?.validatedUnsigned ?? 0}`}
            color="bg-slate-50 text-slate-700 border-slate-200"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Afastamentos */}
        <div className="panel-ayra rounded-xl border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[color:var(--color-text)] flex items-center gap-2">
              <FileText size={16} className="text-red-500" />
              Colaboradores Afastados
            </h3>
            <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-md font-medium">{filteredAbsences.length} registros</span>
          </div>
          <div className="space-y-3">
            {filteredAbsences.map((item) => (
              <div 
                key={item.id} 
                className="flex items-center justify-between p-3 rounded-lg border border-[color:var(--color-border)] hover:border-red-200 hover:bg-red-50/40 cursor-pointer transition-colors"
                onClick={() => setSelectedAlert({ type: 'absence', data: item })}
              >
                <div>
                  <p className="text-sm font-medium text-[color:var(--color-text)]">{item.name}</p>
                  <p className="text-xs text-[color:var(--color-muted)]">{item.reason}</p>
                  <p className="text-[10px] text-[color:var(--color-muted)] mt-1">{item.startDate} até {item.endDate} ({item.days} dias)</p>
                </div>
                <ChevronRight size={16} className="text-[color:var(--color-muted)]/50" />
              </div>
            ))}
            {filteredAbsences.length === 0 && (
              <p className="text-xs text-[color:var(--color-muted)] text-center py-4">Nenhum colaborador afastado no período.</p>
            )}
          </div>
        </div>

        {/* Férias */}
        <div className="panel-ayra rounded-xl border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[color:var(--color-text)] flex items-center gap-2">
              <CalendarClock size={16} className="text-amber-500" />
              Alertas de Férias
            </h3>
          </div>
          <div className="space-y-3">
            {filteredVacations.map((item) => (
              <div 
                key={item.id} 
                className="flex items-center justify-between p-3 rounded-lg border border-[color:var(--color-border)] hover:border-amber-200 hover:bg-amber-50/40 cursor-pointer transition-colors"
                onClick={() => setSelectedAlert({ type: 'vacation', data: item })}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[color:var(--color-text)]">{item.name}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${item.status === 'Vencida' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                      {item.status}
                    </span>
                  </div>
                  <p className="text-xs text-[color:var(--color-muted)]">{item.role}</p>
                  <p className="text-[10px] text-[color:var(--color-muted)] mt-1">Limite: {item.dueDate}</p>
                </div>
                <ChevronRight size={16} className="text-[color:var(--color-muted)]/50" />
              </div>
            ))}
            {filteredVacations.length === 0 && (
              <p className="text-xs text-[color:var(--color-muted)] text-center py-4">Nenhum alerta de férias no período.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="panel-ayra rounded-xl border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[color:var(--color-text)] flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-500" />
              Horas Extras (50% / 100%)
            </h3>
            <span className="text-xs text-[color:var(--color-muted)]">{rhStats.overtimeTotal.value}</span>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[color:var(--color-muted)]">50%</span>
              <span className="text-[color:var(--color-text)] font-medium">{formatHours(overtimeTotals.p50)}</span>
            </div>
            <div className="h-2 rounded-full bg-[color:var(--surface-container-highest)] overflow-hidden border border-[color:var(--color-border)]">
              <div className="h-full bg-blue-500/70" style={{ width: `${overtimeBreakdown.p50Pct}%` }} />
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-[color:var(--color-muted)]">100%</span>
              <span className="text-[color:var(--color-text)] font-medium">{formatHours(overtimeTotals.p100)}</span>
            </div>
            <div className="h-2 rounded-full bg-[color:var(--surface-container-highest)] overflow-hidden border border-[color:var(--color-border)]">
              <div className="h-full bg-indigo-500/70" style={{ width: `${overtimeBreakdown.p100Pct}%` }} />
            </div>
          </div>
        </div>

        <div className="panel-ayra rounded-xl border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[color:var(--color-text)] flex items-center gap-2">
              <Clock size={16} className="text-orange-500" />
              Pontos Atrasados
            </h3>
            <span className="text-xs text-[color:var(--color-muted)]">{filteredLateClocks.length} ocorrências</span>
          </div>

          <div className="space-y-3">
            {filteredLateClocks.slice(0, 6).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-lg border border-[color:var(--color-border)] hover:border-orange-200 hover:bg-orange-50/40 cursor-pointer transition-colors"
                onClick={() => setSelectedAlert({ type: 'late_clock', data: item })}
              >
                <div>
                  <p className="text-sm font-medium text-[color:var(--color-text)]">{item.name}</p>
                  <p className="text-xs text-[color:var(--color-muted)]">{item.role}</p>
                  <p className="text-[10px] text-[color:var(--color-muted)] mt-1">{new Date(item.timestamp).toLocaleString()}</p>
                </div>
                <span className="text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-100 px-2 py-1 rounded-md">
                  +{item.minutesLate}min
                </span>
              </div>
            ))}
            {filteredLateClocks.length === 0 && (
              <p className="text-xs text-[color:var(--color-muted)] text-center py-4">Nenhum ponto atrasado no período.</p>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Detalhes */}
      {selectedAlert && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-[color:var(--surface-container-low)] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 border border-[color:var(--color-border)]">
            <div className="p-5 border-b border-[color:var(--color-border)] flex justify-between items-center bg-[color:var(--surface-container-highest)]">
              <h2 className="text-lg font-semibold text-[color:var(--color-text)] flex items-center gap-2">
                {selectedAlert.type === 'absence' ? (
                  <FileText className="text-red-500" />
                ) : selectedAlert.type === 'vacation' ? (
                  <CalendarClock className="text-amber-500" />
                ) : (
                  <Clock className="text-orange-500" />
                )}
                Detalhes do Registro
              </h2>
              <button onClick={() => setSelectedAlert(null)} className="p-2 hover:bg-black/5 rounded-full transition-colors text-[color:var(--color-muted)]">
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-[color:var(--color-muted)] uppercase">Colaborador</label>
                <p className="text-base font-medium text-[color:var(--color-text)]">{selectedAlert.data.name}</p>
                <p className="text-sm text-[color:var(--color-muted)]">{selectedAlert.data.role}</p>
              </div>
              
              {selectedAlert.type === 'absence' && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-[color:var(--color-muted)] uppercase">Motivo</label>
                    <p className="text-sm font-medium text-red-600 bg-red-50 p-2 rounded mt-1 border border-red-100">{selectedAlert.data.reason}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-[color:var(--color-muted)] uppercase">Período</label>
                      <p className="text-sm text-[color:var(--color-text)]">{selectedAlert.data.startDate} a {selectedAlert.data.endDate}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-[color:var(--color-muted)] uppercase">Duração</label>
                      <p className="text-sm text-[color:var(--color-text)]">{selectedAlert.data.days} dias</p>
                    </div>
                  </div>
                </>
              )}

              {selectedAlert.type === 'vacation' && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-[color:var(--color-muted)] uppercase">Status</label>
                    <p className={`text-sm font-medium p-2 rounded mt-1 border inline-block ${selectedAlert.data.status === 'Vencida' ? 'text-red-600 bg-red-50 border-red-100' : 'text-amber-600 bg-amber-50 border-amber-100'}`}>
                      {selectedAlert.data.status}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[color:var(--color-muted)] uppercase">Data Limite</label>
                    <p className="text-sm text-[color:var(--color-text)]">{selectedAlert.data.dueDate}</p>
                  </div>
                </>
              )}

              {selectedAlert.type === 'late_clock' && (
                <>
                  <div>
                    <label className="text-xs font-semibold text-[color:var(--color-muted)] uppercase">Data/Hora</label>
                    <p className="text-sm text-[color:var(--color-text)]">{new Date(selectedAlert.data.timestamp).toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[color:var(--color-muted)] uppercase">Atraso</label>
                    <p className="text-sm font-medium text-orange-600 bg-orange-50 p-2 rounded mt-1 border border-orange-100 inline-block">
                      +{selectedAlert.data.minutesLate} minutos
                    </p>
                  </div>
                </>
              )}
            </div>
            <div className="p-4 border-t border-[color:var(--color-border)] bg-[color:var(--surface-container-highest)] flex justify-end gap-3">
              <button 
                onClick={() => setSelectedAlert(null)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-[color:var(--color-muted)] hover:bg-black/5 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default RHDashboardView;
