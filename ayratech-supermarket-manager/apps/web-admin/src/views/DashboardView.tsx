import React, { useEffect, useState } from 'react';
import { 
 MapPinned, Camera, Activity, Target, TrendingUp, RefreshCw, Package
} from 'lucide-react';
import SectionHeader from '../components/SectionHeader';
import StatCard from '../components/StatCard';
import { ViewType } from '../types';
import api from '../api/client';
import { useBranding } from '../context/BrandingContext';
import { getImageUrl } from '../utils/image';

interface DashboardViewProps {
 onNavigate: (view: ViewType) => void;
}

interface DashboardStats {
 visits: { value: string; trend: string };
 photos: { value: string; trend: string };
 execution: { value: string; trend: string };
 ruptures: { value: string; sub: string };
 clients: Array<{
 id: string;
 name: string;
 logo: string;
 percentage: number;
 }>;
}

const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
 const { settings } = useBranding();
 const [stats, setStats] = useState<DashboardStats | null>(null);
 const [loading, setLoading] = useState(true);
 const [period, setPeriod] = useState<'today' | 'week'>('today');
 const [aggregate, setAggregate] = useState<any[]>([]);

 useEffect(() => {
 fetchDashboardStats();
 }, [period]);

 const fetchDashboardStats = async () => {
 try {
 setLoading(true);
 const res = await api.get(`/dashboard/stats?period=${period}`);
 setStats(res.data);
 const agg = await api.get(`/dashboard/aggregate?period=${period}`);
 setAggregate(agg.data || []);
 } catch (error) {
 console.error('Error fetching dashboard stats:', error);
 } finally {
 setLoading(false);
 }
 };

 if (loading && !stats) {
 return (
 <div className="flex items-center justify-center h-full">
 <RefreshCw className="animate-spin text-slate-400" size={32} />
 </div>
 );
 }

 return (
 <div className="space-y-8 animate-in fade-in duration-500 pb-20">
 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
 <div>
 <h1 className="text-xl font-semibold tracking-tight text-[color:var(--color-text)]">Dashboard Operacional</h1>
 <p className="text-[color:var(--color-muted)] font-medium text-sm">Seu hub de controle Ayratech.</p>
 </div>
 <div className="p-1 rounded-full border border-[color:var(--color-border)] flex gap-1 shadow-sm bg-[color:var(--surface-container-low)]">
 <button 
 onClick={() => setPeriod('today')}
 className={`px-5 py-1.5 text-[11px] font-medium rounded-full transition-all ${
 period === 'today' 
 ? 'text-[color:var(--surface)] bg-gradient-to-r from-[color:var(--color-primary)] to-[color:var(--color-primary)] shadow-[0_0_15px_rgba(253,0,255,0.3)]' 
 : 'text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]'
 }`}
 >
 HOJE
 </button>
 <button 
 onClick={() => setPeriod('week')}
 className={`px-5 py-1.5 text-[11px] font-medium rounded-full transition-all ${
 period === 'week' 
 ? 'text-[color:var(--surface)] bg-gradient-to-r from-[color:var(--color-primary)] to-[color:var(--color-primary)] shadow-[0_0_15px_rgba(253,0,255,0.3)]' 
 : 'text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]'
 }`}
 >
 ESTA SEMANA
 </button>
 </div>
 </div>

 <div className="rounded-xl border border-[color:var(--color-border)] p-6 shadow-sm bg-[color:var(--surface-container-low)]">
 <SectionHeader icon={<Package style={{ color: settings.primaryColor }} size={22} />} title="Resumo por Cliente/Categoria" />
 <div className="mt-6 overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="bg-[color:var(--surface-container-highest)] text-[color:var(--color-muted)]">
 <th className="p-3 text-left">Cliente</th>
 <th className="p-3 text-left">Categoria</th>
 <th className="p-3 text-right">Loja</th>
 <th className="p-3 text-right">Estoque</th>
 <th className="p-3 text-right">Total</th>
 <th className="p-3 text-right">Validade Próxima</th>
 <th className="p-3 text-right">Rupturas</th>
 </tr>
 </thead>
 <tbody>
 {aggregate.length === 0 ? (
 <tr>
 <td className="p-4 text-[color:var(--color-muted)] italic" colSpan={7}>Sem dados</td>
 </tr>
 ) : aggregate.map((row, idx) => (
 <tr key={idx} className="border-t border-[color:var(--color-border)]">
 <td className="p-3">{row.clientName}</td>
 <td className="p-3">{row.category}</td>
 <td className="p-3 text-right">{row.gondola}</td>
 <td className="p-3 text-right">{row.inventory}</td>
 <td className="p-3 text-right">{row.total}</td>
 <td className="p-3 text-right text-orange-600">{row.validitySoon}</td>
 <td className="p-3 text-right text-red-600">{row.ruptures}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
 <StatCard 
 icon={<MapPinned className="text-blue-600" />} 
 label="Visitas Realizadas" 
 value={stats?.visits.value || '0'} 
 trend={stats?.visits.trend} 
 color="bg-blue-50" 
 />
 <StatCard 
 icon={<Camera className="text-purple-600" />} 
 label="Fotos Enviadas" 
 value={stats?.photos.value || '0'} 
 trend={stats?.photos.trend} 
 color="bg-purple-50" 
 />
 <StatCard 
 icon={<Activity className="text-emerald-600" />} 
 label="Execução Perfeita" 
 value={stats?.execution.value || '0%'} 
 trend={stats?.execution.trend} 
 color="bg-emerald-50" 
 />
 <StatCard 
 icon={<Target className="text-amber-600" />} 
 label="Rupturas Alertas" 
 value={stats?.ruptures.value || '00'} 
 sub={stats?.ruptures.sub} 
 color="bg-amber-50" 
 />
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
 <div className="bg-[color:var(--surface-container-low)] rounded-xl border border-[color:var(--color-border)] p-6 shadow-sm">
 <SectionHeader icon={<TrendingUp style={{ color: settings.primaryColor }} size={22} />} title="Performance por Marca" />
 <div className="mt-8 space-y-6">
 {stats?.clients.length === 0 ? (
 <div className="text-center py-10 text-[color:var(--color-muted)]">
 Nenhuma marca com dados no período.
 </div>
 ) : (
 stats?.clients.map(c => (
 <div key={c.id} className="group">
 <div className="flex items-center gap-5 mb-3">
 <div className="w-12 h-12 rounded-xl border border-[color:var(--color-border)] flex items-center justify-center p-2 bg-[color:var(--surface-container-highest)] transition-all group-hover:scale-110">
 {c.logo ? (
 <img src={getImageUrl(c.logo)} alt={c.name} className="object-contain w-full h-full" />
 ) : (
 <div className="text-xs font-medium text-[color:var(--color-muted)]">{c.name.substring(0, 2).toUpperCase()}</div>
 )}
 </div>
 <div className="flex-1">
 <div className="flex justify-between items-end">
 <span className="text-base font-semibold text-[color:var(--color-text)] ">{c.name}</span>
 <span className="text-sm font-semibold " style={{ color: settings.primaryColor }}>{c.percentage}%</span>
 </div>
 </div>
 </div>
 <div className="w-full bg-[color:var(--surface-container-highest)] h-2.5 rounded-full overflow-hidden">
 <div 
 className="h-full transition-all duration-1000 shadow-[0_0_10px_rgba(253,0,255,0.5)]" 
 style={{ width: `${c.percentage}%`, backgroundColor: settings.primaryColor }} 
 />
 </div>
 </div>
 ))
 )}
 </div>
 </div>
 
 <div className="bg-[color:var(--surface-container-low)] rounded-xl border border-[color:var(--color-border)] p-6 shadow-sm">
 <SectionHeader icon={<MapPinned style={{ color: settings.primaryColor }} size={22} />} title="Mapa Rápido" />
 <div className="mt-8 rounded-xl bg-[color:var(--surface-container-highest)] h-64 border border-[color:var(--color-border)] flex items-center justify-center relative overflow-hidden group shadow-inner">
 <img src="https://picsum.photos/800/400?grayscale" className="absolute inset-0 w-full h-full object-cover opacity-30 transition-all duration-700 group-hover:scale-105" alt="Map" />
 <button 
 onClick={() => onNavigate('live_map')}
 className="relative z-10 bg-[color:var(--surface-container-low)] px-6 py-2.5 rounded-xl shadow-md border border-[color:var(--color-border)] font-semibold hover:scale-105 transition-all text-sm uppercase tracking-wide"
 style={{ color: settings.primaryColor }}
 >
 Abrir Monitoramento Full
 </button>
 </div>
 </div>
 </div>
 </div>
 );
};

export default DashboardView;
