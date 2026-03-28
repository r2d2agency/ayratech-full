import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import client from '../api/client';
import { Calendar as CalendarIcon, ChevronRight, MapPin, Filter, CheckCircle2, UserCheck } from 'lucide-react';
import { format, parseISO, isSameDay, isSameWeek, isSameMonth, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../context/AuthContext';

type FilterType = 'day' | 'week' | 'month';

const CalendarView = () => {
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>('day');
  const [showOnlyMyCheckins, setShowOnlyMyCheckins] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    const fetchRoutes = async () => {
      const today = new Date();
      const toYmd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const weekStart = startOfWeek(today, { locale: ptBR });
      const weekEnd = endOfWeek(today, { locale: ptBR });
      const monthStart = startOfMonth(today);
      const monthEnd = endOfMonth(today);

      const params =
        activeFilter === 'day'
          ? { date: toYmd(today) }
          : activeFilter === 'week'
            ? { startDate: toYmd(weekStart), endDate: toYmd(weekEnd) }
            : { startDate: toYmd(monthStart), endDate: toYmd(monthEnd) };

      setLoading(true);
      try {
        const response = await client.get('/routes/summary', { params });
        // Sort by date ASC
        const sorted = response.data
          .filter((r: any) => !r.isTemplate)
          .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setRoutes(sorted);
      } catch (error) {
        console.error('Error fetching routes:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchRoutes();
  }, [activeFilter, location]);

  const filteredRoutes = useMemo(() => {
    const today = new Date();
    return routes.filter(route => {
      const routeDate = parseISO(route.date);

      // Filtro por período (dia / semana / mês)
      const matchesPeriod =
        activeFilter === 'day'
          ? isSameDay(routeDate, today)
          : activeFilter === 'week'
          ? isSameWeek(routeDate, today, { locale: ptBR })
          : isSameMonth(routeDate, today);

      if (!matchesPeriod) return false;

      // Filtro "apenas rotas em que tive check-in"
      if (showOnlyMyCheckins && user?.employee?.id) {
        const employeeId = user.employee.id;
        const participated = (route.items || []).some((item: any) =>
          (item.checkins || []).some(
            (c: any) =>
              (c.promoterId === employeeId || c.promoter?.id === employeeId) &&
              !!c.checkInTime
          )
        );
        if (!participated) return false;
      }

      return true;
    });
  }, [routes, activeFilter, showOnlyMyCheckins, user]);

  // Group routes by month (only for week/month views or all)
  const groupedRoutes = useMemo(() => {
    return filteredRoutes.reduce((acc: any, route) => {
      const month = format(parseISO(route.date), 'MMMM yyyy', { locale: ptBR });
      if (!acc[month]) acc[month] = [];
      acc[month].push(route);
      return acc;
    }, {});
  }, [filteredRoutes]);

  return (
    <div className="p-4 space-y-4 pb-24">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Minha Agenda</h1>
        <button
          type="button"
          onClick={() => setShowOnlyMyCheckins(!showOnlyMyCheckins)}
          className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
            showOnlyMyCheckins
              ? 'bg-blue-50 text-blue-700 border-blue-200'
              : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
          }`}
        >
          <UserCheck size={14} />
          {showOnlyMyCheckins ? 'Apenas rotas que participei' : 'Todas as rotas'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex p-1 bg-gray-100 rounded-lg mb-6">
        <button 
          onClick={() => setActiveFilter('day')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
            activeFilter === 'day' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Dia
        </button>
        <button 
          onClick={() => setActiveFilter('week')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
            activeFilter === 'week' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Semana
        </button>
        <button 
          onClick={() => setActiveFilter('month')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
            activeFilter === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Mês
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8">Carregando...</div>
      ) : Object.keys(groupedRoutes).length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          <CalendarIcon className="mx-auto h-12 w-12 text-gray-300 mb-2" />
          <p>Nenhum agendamento para {activeFilter === 'day' ? 'hoje' : activeFilter === 'week' ? 'esta semana' : 'este período'}.</p>
        </div>
      ) : (
        Object.entries(groupedRoutes).map(([month, monthRoutes]: [string, any]) => (
          <div key={month} className="space-y-3">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider sticky top-14 bg-gray-50 py-2 z-0">
              {month}
            </h2>
            <div className="space-y-3">
              {monthRoutes.map((route: any) => {
                const completedCount = route.items.filter((i: any) => ['CHECKOUT', 'COMPLETED', 'DONE'].includes(i.status)).length;
                const totalCount = route.items.length;
                const isFullyCompleted = completedCount === totalCount && totalCount > 0;
                const today = new Date();
                const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                const routeStr = String(route.date).split('T')[0];
                const isToday = routeStr === todayStr;
                const isPast = routeStr < todayStr;
                const isFuture = routeStr > todayStr;

                const cardBorder =
                  isToday ? 'border-blue-500 ring-1 ring-blue-200' :
                  isPast ? 'border-gray-200 opacity-80' :
                  'border-purple-200';

                const dayColor =
                  isToday ? 'text-blue-600' :
                  isPast ? 'text-gray-400' :
                  'text-purple-600';

                const badge =
                  isToday ? 'Hoje' :
                  isPast ? 'Passado' :
                  'Futuro';

                const supermarketNames = route.items.map((i: any) => i.supermarket?.fantasyName || i.supermarket?.name || 'PDV sem nome').join(', ');
  return (
    <div 
      key={route.id}
      onClick={() => navigate(`/routes/${route.id}`)}
      className={`bg-white p-4 rounded-xl shadow-sm border flex items-center gap-4 active:scale-[0.98] transition-transform ${cardBorder} ${isFullyCompleted ? 'border-l-4 border-l-emerald-500' : ''}`}
    >
      <div className="flex flex-col items-center justify-center text-center min-w-[3rem] border-r border-gray-100 pr-4">
        <span className={`block text-2xl font-bold ${isFullyCompleted ? 'text-emerald-600' : 'text-blue-600'}`}>
          {format(parseISO(route.date), 'dd')}
        </span>
        <span className="block text-xs text-gray-400 uppercase">
          {format(parseISO(route.date), 'EEE', { locale: ptBR })}
        </span>
      </div>
      
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-gray-900 truncate text-sm mb-1">
          {supermarketNames || 'Sem PDV definido'}
        </h3>
        <p className={`text-xs font-medium truncate flex items-center gap-1.5 ${isFullyCompleted ? 'text-emerald-600' : 'text-gray-500'}`}>
          {isFullyCompleted ? (
            <>
              <CheckCircle2 size={14} className="text-emerald-500" />
              <span>Concluída</span>
            </>
          ) : (
            <>
              <MapPin size={14} className="text-gray-400" />
              <span>{completedCount}/{totalCount} visitas</span>
            </>
          )}
        </p>
      </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      isToday ? 'bg-blue-50 text-blue-700' :
                      isPast ? 'bg-gray-100 text-gray-500' :
                      'bg-purple-50 text-purple-700'
                    }`}>
                      {badge}
                    </span>
                    <ChevronRight className="text-gray-300" size={20} />
                  </div>
                </div>
              )})}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default CalendarView;
