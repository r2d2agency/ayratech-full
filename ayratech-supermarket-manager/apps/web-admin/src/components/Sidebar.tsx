import React, { useState, useEffect } from 'react';
import { 
  LayoutGrid, 
  MapPinned, 
  Store, 
  Briefcase, 
  Package, 
  Users, 
  Calendar, 
  Camera, 
  ChevronDown, 
  ChevronRight,
  Settings,
  LogOut,
  ChevronLeft,
  Shield,
  FileText,
  Map,
  Clock,
  Wand2,
  CheckSquare,
  ClipboardCheck,
  Image as ImageIcon,
  AlertTriangle
} from 'lucide-react';
import { ViewType } from '../types';
import { useBranding } from '../context/BrandingContext';
import { getImageUrl } from '../utils/image';
import { WhatsappStatus } from './WhatsappStatus';

interface SidebarProps {
  activeView: ViewType;
  onNavigate: (view: ViewType) => void;
  expanded: boolean;
  setExpanded: (val: boolean) => void;
  userRole?: string;
  onLogout?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, onNavigate, expanded, setExpanded, userRole, onLogout }) => {
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const { settings } = useBranding();
  
  const canViewEmployees = userRole && ['admin', 'rh', 'manager', 'superadmin', 'administrador do sistema', 'supervisor de operações'].includes(userRole.toLowerCase());
  const isClient = userRole === 'client';

  const toggleSubmenu = (id: string) => {
    if (!expanded) {
      setExpanded(true);
      setOpenSubmenu(id);
      return;
    }
    setOpenSubmenu(openSubmenu === id ? null : id);
  };

  useEffect(() => {
    if (window.innerWidth < 768) {
      setExpanded(false);
    }
  }, [activeView]);

  const navItem = (id: ViewType, icon: React.ReactNode, label: string) => (
    <button
      onClick={() => onNavigate(id)}
      className={`w-full flex items-center gap-3 px-4 py-3 transition-all relative group text-sm ${
        activeView === id 
          ? 'text-[color:var(--color-primary)] bg-[color:var(--color-primary)]/10 border-r-2 border-[color:var(--color-primary)]' 
          : 'text-[color:var(--color-muted)] hover:text-[color:var(--color-text)] hover:bg-black/5 dark:hover:bg-black/5 dark:hover:bg-white/5'
      }`}
    >
      <div className="min-w-[24px] flex justify-center">{icon}</div>
      <span className={`font-medium transition-all duration-300 overflow-hidden whitespace-nowrap ${
        expanded ? 'w-auto opacity-100' : 'w-0 opacity-0'
      }`}>
        {label}
      </span>
      {!expanded && (
        <div className="absolute left-16 bg-[color:var(--surface-container-highest)] text-[color:var(--color-text)] text-xs py-1.5 px-3 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap border border-[color:var(--color-border)]">
          {label}
        </div>
      )}
    </button>
  );

  return (
    <aside 
      className={`fixed left-0 top-0 h-full bg-[color:var(--surface)] border-r border-[color:var(--color-border)] shadow-[20px_0_48px_rgba(0,0,0,0.5)] transition-all duration-300 z-[60] flex flex-col ${
        expanded ? 'w-64' : 'w-20'
      }`}
    >
      {/* Header / Logo */}
      <div className="p-6 h-16 flex items-center gap-3 mb-4">
        {settings.systemLogoUrl ? (
             <div 
               onClick={() => onNavigate('dashboard')}
               className="flex h-10 w-auto min-w-[40px] items-center justify-center cursor-pointer"
             >
                <img 
                  src={getImageUrl(settings.systemLogoUrl)} 
                  alt="System Logo" 
                  className="h-10 object-contain" 
                />
             </div>
        ) : (
          <div 
            onClick={() => onNavigate('dashboard')}
            className="flex h-10 w-10 min-w-[40px] items-center justify-center rounded-full text-[color:var(--on-background)] cursor-pointer shadow-[0_0_15px_rgba(253,0,255,0.25)] bg-gradient-to-tr from-[color:var(--color-primary)] to-[color:var(--color-secondary)]"
          >
            {settings.logoUrl ? (
               <img 
                 src={getImageUrl(settings.logoUrl)} 
                 alt="" 
                 className="w-6 h-6 object-contain brightness-0 invert" 
               />
            ) : (
               <LayoutGrid size={24} />
            )}
          </div>
        )}
        <span className={`text-xl font-bold text-[color:var(--color-primary)] tracking-tighter transition-all duration-300 truncate  ${
          expanded ? 'opacity-100' : 'opacity-0 w-0'
        }`}>
          {settings.companyName}
        </span>
      </div>

      {/* Navigation */}
      <div className="flex-1 px-2 space-y-1 overflow-y-auto">
        {isClient ? (
          <>
            <p className={`text-xs font-semibold uppercase tracking-wide px-4 mb-2 h-4 overflow-hidden transition-all text-[color:var(--color-muted)] ${expanded ? 'opacity-100' : 'opacity-0'}`}>
              Cliente
            </p>
            {navItem('client_dashboard', <LayoutGrid size={20} />, 'Dashboard')}
          </>
        ) : (
          <>
        <p className={`text-xs font-semibold uppercase tracking-wide px-4 mb-2 h-4 overflow-hidden transition-all text-[color:var(--color-muted)] ${expanded ? 'opacity-100' : 'opacity-0'}`}>
          Principal
        </p>
        {navItem('dashboard', <LayoutGrid size={20} />, 'Dashboard')}
        {canViewEmployees && navItem('rh_dashboard', <Users size={20} />, 'Dashboard RH')}
        {navItem('live_map', <MapPinned size={20} />, 'Monitoramento')}

        <div className="pt-4" />
        <p className={`text-xs font-semibold uppercase tracking-wide px-4 mb-2 h-4 overflow-hidden transition-all text-[color:var(--color-muted)] ${expanded ? 'opacity-100' : 'opacity-0'}`}>
          Cadastros
        </p>
        
        {/* Gestão Submenu */}
        <div>
          <button
            onClick={() => toggleSubmenu('gestao')}
            className="w-full flex items-center gap-3 px-4 py-3 transition-all text-[color:var(--color-muted)] hover:text-[color:var(--color-text)] hover:bg-black/5 dark:hover:bg-white/5 relative group text-sm"
          >
            <div className="min-w-[24px] flex justify-center"><Briefcase size={20} /></div>
            <span className={`font-medium flex-1 text-left transition-all duration-300 overflow-hidden whitespace-nowrap ${
              expanded ? 'w-auto opacity-100' : 'w-0 opacity-0'
            }`}>
              Gestão
            </span>
            {expanded && (
              openSubmenu === 'gestao' ? <ChevronDown size={16} /> : <ChevronRight size={16} />
            )}
            {!expanded && (
              <div className="absolute left-16 bg-[color:var(--surface-container-highest)] text-[color:var(--color-text)] text-xs py-1.5 px-3 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap border border-[color:var(--color-border)]">
                Gestão
              </div>
            )}
          </button>

          {(openSubmenu === 'gestao' && expanded) && (
            <div className="mt-1 ml-4 space-y-1 border-l border-[color:var(--color-border)] pl-4 animate-in slide-in-from-top-2 duration-200">
              <button 
                onClick={() => onNavigate('clients')}
                className={`w-full text-left p-2 rounded-lg text-xs font-medium transition-all ${activeView === 'clients' ? 'text-[color:var(--color-primary)] bg-white/5' : 'text-[color:var(--color-muted)] hover:text-[color:var(--color-primary)]'}`}
              >
                Clientes / Indústrias
              </button>
              <button 
                onClick={() => onNavigate('products')}
                className={`w-full text-left p-2 rounded-lg text-xs font-medium transition-all ${activeView === 'products' ? 'text-[color:var(--color-primary)] bg-white/5' : 'text-[color:var(--color-muted)] hover:text-[color:var(--color-primary)]'}`}
              >
                Produtos
              </button>
              <button 
                onClick={() => onNavigate('categories')}
                className={`w-full text-left p-2 rounded-lg text-xs font-medium transition-all ${activeView === 'categories' ? 'text-[color:var(--color-primary)] bg-white/5' : 'text-[color:var(--color-muted)] hover:text-[color:var(--color-primary)]'}`}
              >
                Categorias
              </button>
              <button 
                onClick={() => onNavigate('brands')}
                className={`w-full text-left p-2 rounded-lg text-xs font-medium transition-all ${activeView === 'brands' ? 'text-[color:var(--color-primary)] bg-white/5' : 'text-[color:var(--color-muted)] hover:text-[color:var(--color-primary)]'}`}
              >
                Marcas
              </button>
              <button 
                onClick={() => onNavigate('competitors')}
                className={`w-full text-left p-2 rounded-lg text-xs font-medium transition-all ${activeView === 'competitors' ? 'text-[color:var(--color-primary)] bg-white/5' : 'text-[color:var(--color-muted)] hover:text-[color:var(--color-primary)]'}`}
              >
                Concorrentes
              </button>
              <button 
                onClick={() => onNavigate('supermarkets_list')}
                className={`w-full text-left p-2 rounded-lg text-xs font-medium transition-all ${activeView === 'supermarkets_list' ? 'text-[color:var(--color-primary)] bg-white/5' : 'text-[color:var(--color-muted)] hover:text-[color:var(--color-primary)]'}`}
              >
                Supermercados
              </button>
              <button 
                onClick={() => onNavigate('supermarket_groups_list')}
                className={`w-full text-left p-2 rounded-lg text-xs font-medium transition-all ${activeView === 'supermarket_groups_list' ? 'text-[color:var(--color-primary)] bg-white/5' : 'text-[color:var(--color-muted)] hover:text-[color:var(--color-primary)]'}`}
              >
                Redes / Grupos
              </button>
            </div>
          )}
        </div>

        {/* HR Module */}
        {canViewEmployees && (
          <>
            <div className={`px-4 mt-6 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider transition-all duration-300 ${
              expanded ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden'
            }`}>
              Recursos Humanos
            </div>
            <div className="px-3 space-y-1">
              {navItem('employees', <Users size={20} />, 'Colaboradores')}
              {navItem('supervisors', <Users size={20} />, 'Supervisores')}
              {navItem('time_clock', <Clock size={20} />, 'Ponto Eletrônico')}
            </div>
          </>
        )}

        {canViewEmployees && navItem('app_access', <Shield size={20} />, 'Gestão de Acesso')}
        {canViewEmployees && navItem('documents', <FileText size={20} />, 'Documentos')}

        <div className="pt-4" />
        <p className={`text-xs font-semibold uppercase tracking-wide px-4 mb-2 h-4 overflow-hidden transition-all text-[color:var(--color-muted)] ${expanded ? 'opacity-100' : 'opacity-0'}`}>
          Operação
        </p>
        {navItem('routes', <Map size={20} />, 'Rotas e Visitas')}
        {navItem('checklist_templates', <CheckSquare size={20} />, 'Modelos de Checklist')}
        {navItem('stock_approvals', <ClipboardCheck size={20} />, 'Aprovações de Estoque')}
        {navItem('breakages_report', <AlertTriangle size={20} />, 'Avarias')}
        
        <div className="pt-4" />
        <p className={`text-xs font-semibold uppercase tracking-wide px-4 mb-2 h-4 overflow-hidden transition-all text-[color:var(--color-muted)] ${expanded ? 'opacity-100' : 'opacity-0'}`}>
          Relatórios
        </p>
        {navItem('reports_routes', <FileText size={20} />, 'Relatório de Rotas')}
        {navItem('reports_evidence', <ImageIcon size={20} />, 'Relatório de Evidências')}
        {navItem('gallery', <Camera size={20} />, 'Galeria de Fotos')}

        <div className="pt-4" />
        <p className={`text-xs font-semibold uppercase tracking-wide px-4 mb-2 h-4 overflow-hidden transition-all text-[color:var(--color-muted)] ${expanded ? 'opacity-100' : 'opacity-0'}`}>
          Inteligência Artificial
        </p>
        {navItem('photo_processing', <Wand2 size={20} />, 'Processamento')}
        {['admin', 'superadmin', 'administrador do sistema'].includes(userRole?.toLowerCase() || '') && navItem('ai_prompts', <FileText size={20} />, 'Prompts IA')}
        {['admin', 'superadmin', 'administrador do sistema'].includes(userRole?.toLowerCase() || '') && navItem('ai_config', <Settings size={20} />, 'Configuração IA')}

        <div className="pt-4" />
        <p className={`text-xs font-semibold uppercase tracking-wide px-4 mb-2 h-4 overflow-hidden transition-all text-[color:var(--color-muted)] ${expanded ? 'opacity-100' : 'opacity-0'}`}>
          Sistema
        </p>
        {navItem('admin', <Settings size={20} />, 'Configurações')}
        
        {['admin', 'superadmin', 'administrador do sistema'].includes(userRole?.toLowerCase() || '') && (
          <>
            <div className="h-px bg-[color:var(--color-border)] my-2 mx-4" />
            {navItem('logs', <Shield size={20} />, 'Logs do Sistema')}
          </>
        )}
          </>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-4 space-y-1">
        {['admin', 'superadmin', 'administrador do sistema', 'supervisor de operações'].includes(userRole?.toLowerCase() || '') && (
          <WhatsappStatus expanded={expanded} />
        )}
        
        <button 
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-3 px-4 py-3 text-[color:var(--color-muted)] hover:text-[color:var(--color-text)] hover:bg-black/5 dark:hover:bg-white/5 transition-all text-sm"
        >
          <div className="min-w-[24px] flex justify-center">
            {expanded ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </div>
          <span className={`font-medium transition-all ${expanded ? 'opacity-100' : 'opacity-0 w-0'}`}>Recolher Menu</span>
        </button>
        <button 
          onClick={() => {
            if (onLogout) onLogout();
          }}
          className="w-full flex items-center gap-3 px-4 py-3 text-[color:var(--color-tertiary)] hover:bg-[color:var(--color-tertiary)]/10 transition-all text-sm"
        >
          <div className="min-w-[24px] flex justify-center"><LogOut size={20} /></div>
          <span className={`font-medium transition-all ${expanded ? 'opacity-100' : 'opacity-0 w-0'}`}>Sair</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
