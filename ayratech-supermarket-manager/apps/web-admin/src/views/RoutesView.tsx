import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, MapPinned, Plus, Trash2, CheckCircle, Save, Settings, List, Clock, MoveUp, MoveDown, Copy, FileText, Check, Search, GripVertical, XCircle, UserPlus, Users } from 'lucide-react';
import { useBranding } from '../context/BrandingContext';
// Verified Route Logic
import api from '../api/client';
import { jwtDecode } from "jwt-decode";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent, useDraggable, useDroppable } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SortableRouteItem = ({ id, item, index, onRemove, onUpdate, onOpenProducts, products, disabled, completedProductIds = [] }: any) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ 
      id,
      disabled
  });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: disabled ? 0.9 : 1
  };

  return (
    <div ref={setNodeRef} style={style} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 group transition-all hover:border-blue-200 mb-4 z-10 relative">
      <div className="flex items-start gap-4">
        <div className={`flex flex-col items-center gap-1 touch-none ${disabled ? 'cursor-default opacity-50' : 'cursor-grab active:cursor-grabbing'}`} {...attributes} {...listeners}>
          <div className="h-8 w-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-sm">
            {index + 1}
          </div>
          <div className="mt-2 text-slate-300 hover:text-[color:var(--color-muted)]">
            {!disabled && <GripVertical size={20} />}
          </div>
        </div>

        <div className="flex-1 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-bold text-lg text-[color:var(--color-text)]">{item.supermarket.fantasyName}</h4>
              <p className="text-sm text-slate-400">{item.supermarket.address}, {item.supermarket.city}</p>
            </div>
            <button onClick={() => onRemove(index)} className="text-red-300 hover:text-red-500">
              <Trash2 size={18} />
            </button>
          </div>

          <div className="flex flex-wrap gap-4 p-3 bg-slate-50 rounded-xl">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-slate-400" />
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Início</label>
                <input 
                  type="time" 
                  value={item.startTime || ''}
                  onChange={e => onUpdate(index, 'startTime', e.target.value)}
                  className="bg-transparent font-bold text-sm text-[color:var(--color-text)] outline-none w-24"
                />
              </div>
            </div>
            <div className="w-px bg-slate-200 h-8" />
            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Fim</label>
                <input 
                  type="time" 
                  value={item.endTime || ''}
                  onChange={e => onUpdate(index, 'endTime', e.target.value)}
                  className="bg-transparent font-bold text-sm text-[color:var(--color-text)] outline-none w-24"
                />
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <h5 className="text-xs font-black text-[color:var(--color-muted)] uppercase">Produtos ({item.productIds?.length || 0})</h5>
              <button 
                onClick={() => onOpenProducts(index)}
                className="text-blue-600 hover:text-blue-700 text-xs font-bold flex items-center gap-1"
              >
                <Plus size={14} /> Adicionar/Gerenciar
              </button>
            </div>
            
            <div className="space-y-4">
              {(() => {
                const getBrandKey = (p: any) => p?.brand?.id || p?.brandId || (p?.brand?.name ? `NAME:${p.brand.name}` : 'SEM_MARCA');
                const getBrandLabel = (p: any) => p?.brand?.name || 'Sem Marca';
                const getCategoryLabel = (p: any) => p?.categoryRef?.name || p?.category || 'Sem Categoria';

                const brandMap = new Map<string, { brandKey: string; brandLabel: string; categories: Map<string, any[]> }>();
                item.productIds?.forEach((pid: string) => {
                  const product = products.find((p: any) => p.id === pid);
                  if (product) {
                    const bKey = getBrandKey(product);
                    const bLabel = getBrandLabel(product);
                    const cLabel = getCategoryLabel(product);

                    if (!brandMap.has(bKey)) {
                      brandMap.set(bKey, { brandKey: bKey, brandLabel: bLabel, categories: new Map() });
                    }
                    const b = brandMap.get(bKey)!;
                    if (!b.categories.has(cLabel)) b.categories.set(cLabel, []);
                    b.categories.get(cLabel)!.push(product);
                  }
                });

                const brands = Array.from(brandMap.values()).sort((a, b) => a.brandLabel.localeCompare(b.brandLabel, 'pt-BR'));

                if (brands.length === 0) {
                  return (
                    <p className="text-xs text-slate-400 italic">Nenhum produto selecionado para este ponto.</p>
                  );
                }

                return brands.map((brand, bIndex) => {
                  const categories = Array.from(brand.categories.entries()).sort(([a], [b]) => a.localeCompare(b, 'pt-BR'));
                  return (
                    <div key={brand.brandKey} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h6 className="text-xs font-black text-[color:var(--color-text)] uppercase tracking-wide">{brand.brandLabel}</h6>
                        <span className="text-[10px] text-slate-400 font-bold">{categories.length} categorias</span>
                      </div>

                      <div className="space-y-4">
                        {categories.map(([categoryName, categoryProducts], cIndex) => (
                          <div key={`${brand.brandKey}::${categoryName}`} className="border-l-2 border-slate-200 pl-3">
                            <h6 className="text-xs font-bold text-[color:var(--color-muted)] mb-2 uppercase tracking-wide">{categoryName}</h6>
                            <div className="space-y-2">
                              {categoryProducts
                                .slice()
                                .sort((a: any, b: any) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'))
                                .map((product: any, pIndex: number) => {
                                  const isCompleted = completedProductIds.includes(product.id);
                                  const canRemove = !disabled && !isCompleted;
                                  return (
                                    <div
                                      key={product.id}
                                      className={`flex items-center gap-3 p-2 rounded-lg border ${isCompleted ? 'bg-green-50 border-green-100' : 'bg-slate-50 border-slate-100'}`}
                                    >
                                      <span className={`text-xs font-bold w-10 ${isCompleted ? 'text-green-600' : 'text-slate-400'}`}>
                                        {bIndex + 1}.{cIndex + 1}.{pIndex + 1}
                                      </span>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <p className={`text-sm font-bold truncate ${isCompleted ? 'text-green-800' : 'text-[color:var(--color-text)]'}`}>{product.name}</p>
                                          {isCompleted && <CheckCircle size={14} className="text-green-600 flex-shrink-0" />}
                                        </div>
                                        <p className={`text-xs ${isCompleted ? 'text-green-600' : 'text-slate-400'}`}>{product.ean || product.barcode || ''}</p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (disabled) return;
                                          if (isCompleted) {
                                            alert('Este produto já foi iniciado/concluído e não pode ser removido.');
                                            return;
                                          }
                                          const nextIds = (item.productIds || []).filter((id: string) => id !== product.id);
                                          onUpdate(index, 'productIds', nextIds);
                                        }}
                                        disabled={!canRemove}
                                        title={isCompleted ? 'Produto já realizado/iniciado' : disabled ? 'Edição bloqueada' : 'Remover produto'}
                                        className={`${canRemove ? 'text-red-300 hover:text-red-500' : 'text-slate-300 cursor-not-allowed'}`}
                                      >
                                        <XCircle size={16} />
                                      </button>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const DraggableRouteCard = ({ route, onDoubleClick, onDelete, onDuplicate, onManagePromoters }: any) => {
  const status = route.status?.toUpperCase() || 'DRAFT';
  const hasStartedItems = route.items?.some((i: any) => !!i.startTime || !!i.checkInTime);
  const isDraggable = status !== 'COMPLETED' && status !== 'IN_PROGRESS' && !hasStartedItems;
  
  const {attributes, listeners, setNodeRef, transform} = useDraggable({
    id: route.id,
    data: { route },
    disabled: !isDraggable
  });
  
  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 1000,
  } : undefined;

  const getStatusColor = () => {
    switch (status) {
      case 'CONFIRMED':
        return 'bg-blue-50 border-blue-200'; // Blue for Scheduled/Confirmed
      case 'IN_PROGRESS':
        return 'bg-amber-50 border-amber-200'; // Amber for In Progress
      case 'COMPLETED':
        return 'bg-slate-100 border-slate-300 opacity-80'; // Gray for Completed
      default:
        return 'bg-white border-slate-200';
    }
  };

  const getIconColor = () => {
    switch (status) {
      case 'CONFIRMED':
        return 'bg-blue-200 text-blue-700';
      case 'IN_PROGRESS':
        return 'bg-amber-200 text-amber-700';
      case 'COMPLETED':
        return 'bg-slate-200 text-[color:var(--color-muted)]';
      default:
        return 'bg-slate-100 text-[color:var(--color-muted)]';
    }
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...(isDraggable ? listeners : {})} 
      {...(isDraggable ? attributes : {})}
      onClick={(e) => {
        if (e.detail === 2) {
          onDoubleClick(e);
        }
      }}
      className={`p-3 rounded-xl border transition-all touch-none ${
        isDraggable ? 'cursor-grab active:cursor-grabbing hover:shadow-md' : 'cursor-pointer'
      } ${getStatusColor()}`}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex flex-col gap-1">
            <div className="flex -space-x-2">
                {((route.promoters && route.promoters.length > 0) ? route.promoters : (route.promoter ? [route.promoter] : [])).slice(0, 3).map((p: any) => (
                    <div key={p.id} className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white ${getIconColor()}`} title={p.name}>
                        {p.name?.substring(0, 2).toUpperCase()}
                    </div>
                ))}
                {((route.promoters?.length || 0) > 3) && (
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white bg-slate-200 text-[color:var(--color-muted)]">
                        +{(route.promoters?.length || 0) - 3}
                    </div>
                )}
            </div>
            <p className="text-xs font-bold text-[color:var(--color-text)] truncate max-w-[120px]" title={((route.promoters && route.promoters.length > 0) ? route.promoters : (route.promoter ? [route.promoter] : [])).map((p:any) => p.name).join(', ')}>
                {((route.promoters && route.promoters.length > 0) ? route.promoters : (route.promoter ? [route.promoter] : [])).map((p:any) => (p.name || '').split(' ')[0]).join(', ')}
            </p>
        </div>
        <div className="flex gap-1">
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onManagePromoters(route);
                }}
                className="p-1 hover:bg-slate-200 rounded-full text-[color:var(--color-muted)] transition-colors"
                title="Gerenciar Promotores"
            >
                <UserPlus size={12} />
            </button>
            <button 
                onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate(route);
                }}
                className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                title="Duplicar Rota"
            >
                <Copy size={10} />
                <span className="text-[10px] font-bold">Duplicar</span>
            </button>
            <button 
                onClick={(e) => {
                    e.stopPropagation();
                    onDelete(e, route.id);
                }}
                className="p-1 hover:bg-red-100 rounded-full text-red-500 transition-colors"
                title="Excluir Rota"
            >
                <Trash2 size={12} />
            </button>
        </div>
      </div>
      <p className="text-xs font-bold text-[color:var(--color-muted)] mb-1">{route.items?.length || 0} PDVs</p>
      {route.items && route.items.length > 0 && (
          <p className="text-[10px] text-slate-400 truncate">
              {route.items.map((i: any) => i.supermarket?.fantasyName).join(', ')}
          </p>
      )}
    </div>
  );
};

const DroppableDayColumn = ({ dateStr, children, isToday, onAddRoute }: any) => {
  const {setNodeRef, isOver} = useDroppable({
    id: dateStr,
  });
  
  return (
    <div 
      ref={setNodeRef} 
      className={`space-y-3 min-h-[400px] rounded-2xl p-2 transition-colors ${
        isOver ? 'bg-blue-100 ring-2 ring-blue-300' : 
        isToday ? 'bg-blue-50/50' : ''
      }`}
    >
      {children}
      <button 
        onClick={onAddRoute}
        className="w-full py-2 rounded-lg border-2 border-dashed border-slate-200 text-slate-400 font-bold text-xs hover:border-blue-300 hover:text-blue-500 transition-all flex items-center justify-center gap-1"
      >
        <Plus size={14} /> Nova Rota
      </button>
    </div>
  );
};

const RoutesView: React.FC = () => {
  const { settings } = useBranding();

  const formatDateYMD = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const [activeTab, setActiveTab] = useState<'planner' | 'editor' | 'templates' | 'rules'>('planner');
  const [isAdmin, setIsAdmin] = useState(false);
  const [promoters, setPromoters] = useState<any[]>([]);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [supermarkets, setSupermarkets] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  
  // Filters
  const [filterPromoterId, setFilterPromoterId] = useState<string>('');
  const [filterSupervisorId, setFilterSupervisorId] = useState<string>('');
  const [filterGroupId, setFilterGroupId] = useState<string>('');
  const [filterSupermarketId, setFilterSupermarketId] = useState<string>('');

  // Editor State
  const [selectedPromoters, setSelectedPromoters] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(formatDateYMD(new Date()));
  const [editorBrandId, setEditorBrandId] = useState<string>('');
  const [editorChecklistTemplateId, setEditorChecklistTemplateId] = useState<string>('');
  const [routeItems, setRouteItems] = useState<any[]>([]);
  const [routeStatus, setRouteStatus] = useState<string>('DRAFT');
  const [loading, setLoading] = useState(false);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);

  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [calendarSelectedDates, setCalendarSelectedDates] = useState<string[]>([]);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());

  // Recurrence Edit State
  const [editingRecurrenceGroup, setEditingRecurrenceGroup] = useState<string | null>(null);
  const [recurrenceReplaceFrom, setRecurrenceReplaceFrom] = useState<string | null>(null);
  const [showRecurrenceChoiceModal, setShowRecurrenceChoiceModal] = useState(false);
  const [pendingRouteEdit, setPendingRouteEdit] = useState<any>(null);

  // Search States
  const [promoterSearch, setPromoterSearch] = useState('');
  const [supermarketSearch, setSupermarketSearch] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductSearch, setSelectedProductSearch] = useState('');

  // Product Selection Modal State
  const [showProductModal, setShowProductModal] = useState(false);
  const [currentRouteItemIndex, setCurrentRouteItemIndex] = useState<number | null>(null);
  const [tempSelectedProducts, setTempSelectedProducts] = useState<string[]>([]);
  const [tempProductChecklists, setTempProductChecklists] = useState<Record<string, string>>({});
  const [tempProductChecklistTypes, setTempProductChecklistTypes] = useState<Record<string, string[]>>({});
  const [tempProductRequiresStockPhotos, setTempProductRequiresStockPhotos] = useState<Record<string, boolean>>({});
  const [selectedClientForModal, setSelectedClientForModal] = useState<string | null>(null);

  // Planner State
  const [weekRoutes, setWeekRoutes] = useState<any[]>([]);
  const [weekStart, setWeekStart] = useState<Date>(new Date());
  const [plannerMonth, setPlannerMonth] = useState<Date>(new Date());
  const [showDayModal, setShowDayModal] = useState(false);
  const [dayModalDate, setDayModalDate] = useState<string>('');
  const [dayModalEntries, setDayModalEntries] = useState<any[]>([]);

  // Templates State
  const [templates, setTemplates] = useState<any[]>([]);
  const [checklistTemplates, setChecklistTemplates] = useState<any[]>([]); // Added for Checklist Templates
  const [showSaveTemplateModal, setShowSaveTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState('');

  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [showWeeklyModal, setShowWeeklyModal] = useState(false);
  const [routeToDuplicate, setRouteToDuplicate] = useState<any>(null);
  const [duplicateTargetDates, setDuplicateTargetDates] = useState<string[]>([]);
  const [currentDateInput, setCurrentDateInput] = useState('');
  const [weeklySupervisorId, setWeeklySupervisorId] = useState<string>('');
  const [weeklyWeeks, setWeeklyWeeks] = useState<number>(1);
  const [weeklyRecurrenceType, setWeeklyRecurrenceType] = useState<'weeks' | 'months'>('weeks');
  const [weeklyWizardStep, setWeeklyWizardStep] = useState<number>(1);
  const [weeklyClientId, setWeeklyClientId] = useState<string>('');
  const [weeklyBrandId, setWeeklyBrandId] = useState<string>('');
  const [weeklyChecklistTemplateId, setWeeklyChecklistTemplateId] = useState<string>('');
  const [weeklyChecklistOverrides, setWeeklyChecklistOverrides] = useState<Record<string, string>>({});
  const [weeklyWeekdays, setWeeklyWeekdays] = useState<Record<number, boolean>>({
    1: true, 2: false, 3: true, 4: false, 5: true, 6: false, 0: false
  });
  const toggleWeeklyDay = (day: number) => {
    setWeeklyWeekdays(prev => ({ ...prev, [day]: !prev[day] }));
  };
  const getNextBusinessStart = () => {
    const start = new Date();
    start.setDate(start.getDate() + 1);
    while (start.getDay() === 0 || start.getDay() === 6) {
      start.setDate(start.getDate() + 1);
    }
    start.setHours(0, 0, 0, 0);
    return start;
  };
  const generateWeeklyDates = () => {
    const selectedDays = Object.entries(weeklyWeekdays).filter(([d, v]) => v).map(([d]) => parseInt(d, 10));
    if (selectedDays.length === 0) return [];
    const start = getNextBusinessStart();
    const end = new Date(start);
    if (weeklyRecurrenceType === 'months') {
      end.setMonth(end.getMonth() + Math.max(1, weeklyWeeks || 1));
    } else {
      end.setDate(end.getDate() + 7 * Math.max(1, weeklyWeeks || 1) - 1);
    }
    const dates: string[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      if (selectedDays.includes(cursor.getDay())) {
        dates.push(formatDateYMD(cursor));
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  };

  const timeToMinutes = (timeStr: string) => {
    const [h, m] = String(timeStr || '').split(':').map(Number);
    const hh = Number.isFinite(h) ? h : 0;
    const mm = Number.isFinite(m) ? m : 0;
    return hh * 60 + mm;
  };

  const minutesToTime = (totalMinutes: number) => {
    const safe = Number.isFinite(totalMinutes) ? Math.max(0, Math.floor(totalMinutes)) : 0;
    const hh = Math.floor(safe / 60) % 24;
    const mm = safe % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  };

  const validateAvailabilityForDate = (brand: any, dateStr: string, items: any[]) => {
    const windows = Array.isArray(brand?.availabilityWindows) ? brand.availabilityWindows : [];
    const activeWindows = windows.filter((w: any) => w && w.active !== false);
    if (activeWindows.length === 0) return null;

    const dayOfWeek = new Date(`${dateStr}T12:00:00`).getDay();
    const dayWindow = activeWindows.find((w: any) => Number(w.dayOfWeek) === dayOfWeek);
    if (!dayWindow) return `A marca não atende em ${new Date(`${dateStr}T12:00:00`).toLocaleDateString('pt-BR')}.`;

    const windowStart = timeToMinutes(dayWindow.startTime);
    const windowEnd = timeToMinutes(dayWindow.endTime);

    for (const item of items || []) {
      if (!item?.startTime) continue;
      const start = timeToMinutes(item.startTime);
      const end = item.endTime
        ? timeToMinutes(item.endTime)
        : typeof item.estimatedDuration === 'number'
          ? start + Number(item.estimatedDuration)
          : start;

      if (end < start) return 'Horário inválido no agendamento.';
      if (start < windowStart || end > windowEnd) {
        return `Horário fora do atendimento da marca (${String(dayWindow.startTime)} - ${String(dayWindow.endTime)}).`;
      }
    }

    return null;
  };

  const getClientDisplayName = (c: any) => {
    return c?.nomeFantasia || c?.fantasyName || c?.razaoSocial || c?.nome || 'Cliente';
  };

  const getBrandsForClient = (clientId: string) => {
    if (!clientId) return [];
    return (brands || []).filter((b: any) => (b?.client?.id || b?.clientId) === clientId);
  };

  const getAvailabilityWindowForDay = (brand: any, dayOfWeek: number) => {
    const windows = Array.isArray(brand?.availabilityWindows) ? brand.availabilityWindows : [];
    const activeWindows = windows.filter((w: any) => w && w.active !== false);
    return activeWindows.find((w: any) => Number(w.dayOfWeek) === Number(dayOfWeek)) || null;
  };

  const buildWeekdaysFromBrand = (brand: any) => {
    const next: Record<number, boolean> = { 0: false, 1: false, 2: false, 3: false, 4: false, 5: false, 6: false };
    const windows = Array.isArray(brand?.availabilityWindows) ? brand.availabilityWindows : [];
    const activeWindows = windows.filter((w: any) => w && w.active !== false);
    activeWindows.forEach((w: any) => {
      const d = Number(w.dayOfWeek);
      if (Number.isFinite(d) && d >= 0 && d <= 6) next[d] = true;
    });
    return next;
  };

  const generateRecurrenceGroupId = () => {
    const anyCrypto: any = (globalThis as any).crypto;
    if (anyCrypto?.randomUUID) return anyCrypto.randomUUID();
    return `grp_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
  };

  const openWeeklyWizard = (mode: 'new' | 'edit' = 'new') => {
    setWeeklyWizardStep(1);
    setWeeklyChecklistOverrides({});
    setPromoterSearch('');
    setSupermarketSearch('');
    setWeeklySupervisorId('');
    if (mode === 'new') {
      setEditingRecurrenceGroup(null);
      setRecurrenceReplaceFrom(null);
      setWeeklyClientId('');
      setWeeklyBrandId('');
      setWeeklyChecklistTemplateId('');
      setSelectedPromoters([]);
      setRouteItems([]);
      setWeeklyWeeks(1);
      setWeeklyRecurrenceType('weeks');
      setWeeklyWeekdays({ 0: false, 1: true, 2: false, 3: true, 4: false, 5: true, 6: false });
    }
    setShowWeeklyModal(true);
  };
  const handleRecurrenceOption = (option: 'single' | 'future') => {
    if (!pendingRouteEdit) return;

    if (option === 'single') {
      // Edit just this route
      setRouteStatus(pendingRouteEdit.status);
      setEditingRouteId(pendingRouteEdit.id);
      setActiveTab('editor');
    } else {
      // Edit future series
      setEditingRecurrenceGroup(pendingRouteEdit.recurrenceGroup);
      setRecurrenceReplaceFrom(pendingRouteEdit.date);
      setWeeklyBrandId(pendingRouteEdit.brandId || '');
      setWeeklyChecklistTemplateId(pendingRouteEdit.checklistTemplateId || '');
      
      // Pre-fill Weekly Modal
      const date = new Date(pendingRouteEdit.date);
      const dayOfWeek = date.getDay();
      setWeeklyWeekdays({ 0: false, 1: false, 2: false, 3: false, 4: false, 5: false, 6: false, [dayOfWeek]: true });
      setWeeklyWeeks(1); 
      setWeeklyRecurrenceType('weeks');
      
      openWeeklyWizard('edit');
    }
    
    setShowRecurrenceChoiceModal(false);
    setPendingRouteEdit(null);
  };

  const handleCreateWeeklyRoutes = async () => {
    if (selectedPromoters.length === 0 || routeItems.length === 0) {
      alert('Selecione promotor(es) e adicione pelo menos um PDV.');
      return;
    }
    const dates = generateWeeklyDates();
    if (dates.length === 0) {
      alert('Selecione ao menos um dia da semana e um período válido.');
      return;
    }

    setLoading(true);
    try {
      const brand = weeklyBrandId ? brands.find((b: any) => b.id === weeklyBrandId) : null;
      const recurrenceGroup = editingRecurrenceGroup || generateRecurrenceGroupId();

      const batchesByKey = new Map<string, string[]>();
      for (const date of dates) {
        const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
        const overrideTemplateId = weeklyChecklistOverrides?.[date] || '';
        const templateId = overrideTemplateId || weeklyChecklistTemplateId || '';
        const key = `${templateId}__${dayOfWeek}`;
        const prev = batchesByKey.get(key) || [];
        batchesByKey.set(key, [...prev, date]);
      }

      for (const [key, batchDates] of batchesByKey.entries()) {
        const [templateId, dayStr] = key.split('__');
        const dayOfWeek = Number(dayStr);

        const itemsForDay = routeItems.map((item, index) => {
          const window = brand ? getAvailabilityWindowForDay(brand, dayOfWeek) : null;
          const startTime =
            item.startTime ||
            (window?.startTime ? String(window.startTime) : '');
          const estimatedDuration = item.estimatedDuration ? parseInt(String(item.estimatedDuration), 10) : undefined;

          let endTime = item.endTime || '';
          if (!endTime && startTime && typeof estimatedDuration === 'number' && Number.isFinite(estimatedDuration)) {
            endTime = minutesToTime(timeToMinutes(startTime) + estimatedDuration);
          }

          return {
            supermarketId: item.supermarketId,
            order: index + 1,
            startTime: startTime || undefined,
            endTime: endTime || undefined,
            estimatedDuration,
            productIds: item.productIds || [],
            products: item.products || item.productIds?.map((id: string) => ({ productId: id })) || [],
          };
        });

        if (brand) {
          for (const d of batchDates) {
            const err = validateAvailabilityForDate(brand, d, itemsForDay);
            if (err) {
              alert(err);
              return;
            }
          }
        }

        await api.post('/routes/batch', {
          dates: batchDates,
          promoterIds: selectedPromoters,
          brandId: weeklyBrandId || undefined,
          checklistTemplateId: templateId ? templateId : undefined,
          items: itemsForDay,
          recurrenceGroup,
          replaceFrom: recurrenceReplaceFrom || undefined,
        });
      }

      alert(editingRecurrenceGroup ? 'Série de rotas atualizada com sucesso!' : 'Rotas criadas com sucesso!');
      setShowWeeklyModal(false);
      setEditingRecurrenceGroup(null);
      setRecurrenceReplaceFrom(null);
      fetchRoutesForWeek();
    } catch (error: any) {
      console.error('Error creating weekly routes:', error);
      if (error.response?.status === 401) return;
      const msg = error.response?.data?.message || error.message || 'Erro desconhecido';
      alert(`Erro ao criar rotas: ${Array.isArray(msg) ? msg.join(', ') : msg}`);
    } finally {
      setLoading(false);
    }
  };

  // Promoter Management State
  const [managingPromotersRoute, setManagingPromotersRoute] = useState<any>(null);
  const [managedPromoterIds, setManagedPromoterIds] = useState<string[]>([]);

  // Rules State
  const [rules, setRules] = useState<any[]>([]);
  const [newRule, setNewRule] = useState({ name: '', description: '', value: '' });
  const [completedProductIds, setCompletedProductIds] = useState<string[]>([]);

  useEffect(() => {
    checkAdmin();
    fetchData();
    fetchRoutesForWeek();
  }, []);

  const checkAdmin = () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        const role = decoded.role?.toLowerCase() || '';
        setIsAdmin(['admin', 'manager', 'superadmin', 'administrador do sistema', 'supervisor de operações'].includes(role));
      } catch (e) {
        console.error(e);
      }
    }
  };

  useEffect(() => {
    fetchRoutesForWeek();
  }, [weekStart]);

  const fetchData = async () => {
    try {
      const [employeesRes, supermarketsRes, productsRes, templatesRes, groupsRes, checklistsRes, brandsRes, clientsRes] = await Promise.all([
        api.get('/employees'),
        api.get('/supermarkets'),
        api.get('/products'),
        api.get('/routes/templates/all'),
        api.get('/supermarket-groups'),
        api.get('/checklists'),
        api.get('/brands'),
        api.get('/clients'),
      ]);
      
      const promotersList = employeesRes.data.filter((e: any) => 
        e.role && (e.role.name.toLowerCase() === 'promotor' || e.role.name.toLowerCase() === 'promoter')
      );
      
      const formattedPromoters = promotersList.map((p: any) => ({
        ...p,
        name: p.fullName || p.name || 'Sem Nome'
      }));

      setPromoters(formattedPromoters);
      setAllEmployees(employeesRes.data);
      setSupermarkets(supermarketsRes.data);
      setProducts(productsRes.data);
      setTemplates(templatesRes.data);
      setGroups(groupsRes.data);
      setChecklistTemplates(checklistsRes.data);
      setBrands(Array.isArray(brandsRes.data) ? brandsRes.data : []);
      setClients(Array.isArray(clientsRes.data) ? clientsRes.data : []);
      fetchRules();
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const fetchRoutesForWeek = async () => {
    try {
      const res = await api.get('/routes');
      setWeekRoutes(res.data.filter((r: any) => !r.isTemplate));
    } catch (error) {
      console.error('Error fetching routes:', error);
    }
  };

  const fetchRules = async () => {
    try {
      const res = await api.get('/routes/rules/all');
      setRules(res.data);
    } catch (error) {
      console.error('Error fetching rules:', error);
    }
  };

  // --- Editor Logic ---

  const handleAddSupermarket = async (supermarketId: string) => {
    if (routeItems.find(item => item.supermarketId === supermarketId)) return;
    const supermarket = supermarkets.find(s => s.id === supermarketId);
    if (supermarket) {
      let productIds: string[] = [];
      const brandIdForMix = (activeTab === 'editor' || showCalendarModal) ? editorBrandId : weeklyBrandId;
      if (brandIdForMix) {
        try {
          const res = await api.get(`/brands/${brandIdForMix}/scheduling`, { params: { supermarketId } });
          const list = Array.isArray(res.data?.products) ? res.data.products : [];
          productIds = list.map((p: any) => p.id).filter(Boolean);
        } catch (e) {
          console.error('Error preloading brand mix:', e);
        }
      }

      let startTime = '';
      if (showWeeklyModal && weeklyBrandId) {
        const brand = brands.find((b: any) => b.id === weeklyBrandId);
        const previewDates = generateWeeklyDates();
        const firstDate = previewDates.length > 0 ? previewDates[0] : null;
        if (brand && firstDate) {
          const dayOfWeek = new Date(`${firstDate}T12:00:00`).getDay();
          const w = getAvailabilityWindowForDay(brand, dayOfWeek);
          if (w?.startTime) startTime = String(w.startTime);
        }
      }

      setRouteItems(prev => [
        ...prev,
        {
          supermarketId,
          supermarket,
          startTime,
          estimatedDuration: 30,
          productIds,
          products: productIds.map((id: string) => ({ productId: id })),
        },
      ]);
    }
  };

  const handleUpdateItemTime = (index: number, field: 'startTime' | 'endTime', value: string) => {
    const newItems = [...routeItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setRouteItems(newItems);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = [...routeItems];
    newItems.splice(index, 1);
    setRouteItems(newItems);
  };

  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === routeItems.length - 1) return;
    
    const newItems = [...routeItems];
    const temp = newItems[index];
    newItems[index] = newItems[index + (direction === 'up' ? -1 : 1)];
    newItems[index + (direction === 'up' ? -1 : 1)] = temp;
    setRouteItems(newItems);
  };

  const handleUpdateItem = (index: number, field: string, value: any) => {
    const newItems = [...routeItems];
    const newItem = { ...newItems[index], [field]: value };

    if (field === 'productIds') {
      const nextIds: string[] = Array.isArray(value) ? value : [];
      const existingProducts = Array.isArray(newItem.products) ? newItem.products : [];
      const existingMap = new Map(existingProducts.map((p: any) => [p.productId, p]));
      newItem.products = nextIds.map((productId: string) => {
        const existing = existingMap.get(productId);
        return existing ? existing : { productId };
      });
    }

    // Check for time conflict if time fields are changing
    if ((field === 'startTime' || field === 'estimatedDuration') && newItem.startTime && newItem.estimatedDuration) {
       const newStart = parseInt(newItem.startTime.split(':')[0]) * 60 + parseInt(newItem.startTime.split(':')[1]);
       const newEnd = newStart + parseInt(newItem.estimatedDuration);

       let hasConflict = false;
       for (let i = 0; i < routeItems.length; i++) {
         if (i === index) continue; // Skip self
         const item = routeItems[i];
         if (!item.startTime || !item.estimatedDuration) continue;

         const itemStart = parseInt(item.startTime.split(':')[0]) * 60 + parseInt(item.startTime.split(':')[1]);
         const itemEnd = itemStart + parseInt(item.estimatedDuration);

         // Check overlap: (StartA < EndB) and (EndA > StartB)
         if (newStart < itemEnd && newEnd > itemStart) {
           hasConflict = true;
           break;
         }
       }

       if (hasConflict) {
         if (!window.confirm('Existe um conflito de horário com outro ponto nesta rota. Deseja manter este horário mesmo assim?')) {
           return; // Cancel update
         }
       }
    }

    newItems[index] = newItem;
    setRouteItems(newItems);
  };

  const handleOpenProductModal = (index: number) => {
    setCurrentRouteItemIndex(index);
    const item = routeItems[index];
    setTempSelectedProducts(item.productIds || []);
    
    const checklists: Record<string, string> = {};
    const checklistTypes: Record<string, string[]> = {};
    const requiresStockPhotos: Record<string, boolean> = {};
    
    // Initialize from existing route configuration if available
    if (item.products) {
      item.products.forEach((p: any) => {
        if (p.checklistTemplateId) {
          checklists[p.productId] = p.checklistTemplateId;
        }
        if (Array.isArray(p.checklistTypes) && p.checklistTypes.length > 0) {
          checklistTypes[p.productId] = p.checklistTypes;
        }
        if (p.requiresStockPhotos) {
          requiresStockPhotos[p.productId] = true;
        }
      });
    }

    // For selected products that don't have a specific route checklist, 
    // we can try to find their default checklist to show in UI (optional)
    // But for now, let's just show what's explicitly set for the route.
    
    setTempProductChecklists(checklists);
    setTempProductChecklistTypes(checklistTypes);
    setTempProductRequiresStockPhotos(requiresStockPhotos);
    setShowProductModal(true);
  };

  // Seleciona cliente e pré-seleciona todos os produtos daquele cliente (respeitando o grupo do supermercado)
  const handleSelectClientForModal = (clientId: string) => {
    setSelectedClientForModal(clientId);
    if (currentRouteItemIndex === null) return;
    const currentSupermarket = routeItems[currentRouteItemIndex]?.supermarket || null;
    if (!currentSupermarket) return;
    const allowedProducts = products.filter(p => {
      const hasGroups = p.supermarketGroups && p.supermarketGroups.length > 0;
      const hasSupermarkets = p.supermarkets && p.supermarkets.length > 0;

      if (!hasGroups && !hasSupermarkets) return true;

      const matchesGroup = hasGroups && currentSupermarket?.group && p.supermarketGroups.some((g: any) => g.id === currentSupermarket.group.id);
      const matchesSupermarket = hasSupermarkets && p.supermarkets.some((s: any) => s.id === currentSupermarket.id);

      return matchesGroup || matchesSupermarket;
    });
    const clientProducts = allowedProducts.filter(p => p.client?.id === clientId);
    const clientProductIds = clientProducts.map(p => p.id);
    // União com os já selecionados
    const union = Array.from(new Set([...(tempSelectedProducts || []), ...clientProductIds]));
    setTempSelectedProducts(union);
    // Pré-definir checklist template quando existir
    const newChecklists = { ...tempProductChecklists };
    clientProducts.forEach(p => {
      if (p.checklistTemplate?.id && !newChecklists[p.id]) {
        newChecklists[p.id] = p.checklistTemplate.id;
      }
    });
    setTempProductChecklists(newChecklists);
  };

  const handleToggleProductSelection = (productId: string) => {
    if (completedProductIds.includes(productId)) {
        alert('Este produto já foi iniciado/concluído e não pode ser removido.');
        return;
    }
    if (tempSelectedProducts.includes(productId)) {
      setTempSelectedProducts(tempSelectedProducts.filter(id => id !== productId));
      setTempProductChecklists(prev => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
      setTempProductChecklistTypes(prev => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
      setTempProductRequiresStockPhotos(prev => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
    } else {
      setTempSelectedProducts([...tempSelectedProducts, productId]);
    }
  };

  const handleSaveProductSelection = () => {
    if (currentRouteItemIndex !== null) {
      const newItems = [...routeItems];
      newItems[currentRouteItemIndex].productIds = tempSelectedProducts;
      
      // Save detailed product structure with checklist selection
      newItems[currentRouteItemIndex].products = tempSelectedProducts.map(productId => ({
        productId,
        checklistTemplateId: tempProductChecklists[productId] || undefined,
        checklistTypes: (tempProductChecklistTypes[productId] && tempProductChecklistTypes[productId].length > 0)
          ? tempProductChecklistTypes[productId]
          : undefined,
        requiresStockPhotos: !!tempProductRequiresStockPhotos[productId] || undefined
      }));

      setRouteItems(newItems);
      setShowProductModal(false);
      setCurrentRouteItemIndex(null);
    }
  };

  const handleDeleteRoute = async () => {
    if (!editingRouteId) return;
    
    // Check if route can be deleted (e.g. not COMPLETED)
    if (!isAdmin && (routeStatus === 'COMPLETED' || routeStatus === 'IN_PROGRESS')) {
        alert('Não é possível excluir uma rota que já foi iniciada ou concluída.');
        return;
    }

    if (!window.confirm('Tem certeza que deseja excluir esta rota? Esta ação não pode ser desfeita.')) return;
    
    setLoading(true);
    try {
      await api.delete(`/routes/${editingRouteId}`);
      alert('Rota excluída com sucesso!');
      fetchRoutesForWeek();
      setActiveTab('planner');
      setRouteItems([]);
      setEditingRouteId(null);
      setRouteStatus('DRAFT');
    } catch (error: any) {
      console.error('Error deleting route:', error);
      if (error.response?.status === 401) return;
      alert('Erro ao excluir rota.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRoute = async (status: 'DRAFT' | 'CONFIRMED' | 'COMPLETED' = 'DRAFT') => {
    if (selectedPromoters.length === 0 || !selectedDate || routeItems.length === 0) {
      alert('Selecione pelo menos um promotor, uma data e adicione pontos de venda.');
      return;
    }

    if (editorBrandId) {
      const brand = brands.find((b: any) => b.id === editorBrandId);
      if (brand) {
        const err = validateAvailabilityForDate(brand, selectedDate, routeItems);
        if (err) {
          alert(err);
          return;
        }
      }
    }

    setLoading(true);
    try {
      const payload = {
        promoterIds: selectedPromoters,
        promoterId: selectedPromoters[0],
        brandId: editorBrandId || undefined,
        checklistTemplateId: editorChecklistTemplateId || undefined,
        date: selectedDate,
        status: status,
        items: routeItems.map((item, index) => ({
          supermarketId: item.supermarketId,
          order: index + 1,
          startTime: item.startTime || undefined,
          endTime: item.endTime || undefined,
          estimatedDuration: item.estimatedDuration ? parseInt(String(item.estimatedDuration)) : undefined,
          productIds: item.productIds || [],
          products: item.products || item.productIds?.map((id: string) => ({ productId: id })) || []
        }))
      };

      if (editingRouteId) {
        await api.patch(`/routes/${editingRouteId}`, payload);
      } else {
        await api.post('/routes', payload);
      }
      
      alert(`Rota ${status === 'CONFIRMED' ? 'confirmada' : 'salva'} com sucesso!`);
      fetchRoutesForWeek();
      setActiveTab('planner');
      // Clear form
      setRouteItems([]);
      setEditingRouteId(null);
      setCompletedProductIds([]);
    } catch (error: any) {
      console.error('Error saving route:', error);
      if (error.response?.status === 401) return;
      const errorMsg = error.response?.data?.message || error.message || 'Erro desconhecido';
      alert(`Erro ao salvar rota: ${Array.isArray(errorMsg) ? errorMsg.join('\n') : errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName || routeItems.length === 0) return;
    try {
      await api.post('/routes', {
        isTemplate: true,
        templateName: templateName,
        status: 'DRAFT',
        brandId: editorBrandId || undefined,
        checklistTemplateId: editorChecklistTemplateId || undefined,
        promoterIds: selectedPromoters, // Optional for template
        promoterId: selectedPromoters[0] || null, // Optional for template
        date: selectedDate, // Optional/Dummy
        items: routeItems.map((item, index) => ({
          supermarketId: item.supermarketId,
          order: index + 1,
          startTime: item.startTime,
          estimatedDuration: parseInt(item.estimatedDuration),
          productIds: item.productIds || [],
          products: item.products || item.productIds?.map((id: string) => ({ productId: id })) || []
        }))
      });
      alert('Template salvo!');
      setShowSaveTemplateModal(false);
      setTemplateName('');
      // Refresh templates
      const res = await api.get('/routes/templates/all');
      setTemplates(res.data);
    } catch (error) {
      console.error('Error saving template:', error);
    }
  };

  const handleLoadTemplate = (template: any) => {
    // Load template items into editor
    setEditorBrandId(template.brandId || template.brand?.id || '');
    setEditorChecklistTemplateId(template.checklistTemplateId || template.checklistTemplate?.id || '');
    setCompletedProductIds([]);
    const items = template.items.map((item: any) => ({
      supermarketId: item.supermarket.id,
      supermarket: item.supermarket,
      order: item.order,
      startTime: item.startTime || '',
      endTime: item.endTime || '',
      estimatedDuration: item.estimatedDuration || 30,
      productIds: item.products?.map((p: any) => p.productId) || [],
      products: item.products?.map((p: any) => ({
        productId: p.productId,
        checklistTemplateId: p.checklistTemplateId,
        checklistTypes: p.checklistTypes,
        requiresStockPhotos: p.requiresStockPhotos
      })) || []
    }));
    setRouteItems(items);
    setActiveTab('editor');
  };

  const handleDuplicateRoute = async () => {
    if (!routeToDuplicate || duplicateTargetDates.length === 0) return;
    try {
      await Promise.all(duplicateTargetDates.map(date => 
        api.post(`/routes/${routeToDuplicate.id}/duplicate`, { date })
      ));
      
      alert('Rota duplicada com sucesso!');
      setShowDuplicateModal(false);
      setRouteToDuplicate(null);
      setDuplicateTargetDates([]);
      setCurrentDateInput('');
      fetchRoutesForWeek();
    } catch (error: any) {
      console.error('Error duplicating route:', error);
      if (error.response?.status === 401) return;
      alert('Erro ao duplicar rota.');
    }
  };

  // Recorrência: gerar datas por dias da semana e quantidade de meses/semanas
  const [recurrenceWeekdays, setRecurrenceWeekdays] = useState<Record<number, boolean>>({
    1: false, 2: false, 3: false, 4: false, 5: false, 6: false, 0: false
  });
  const [recurrenceAmount, setRecurrenceAmount] = useState<number>(1);
  const [recurrenceType, setRecurrenceType] = useState<'weeks' | 'months'>('weeks');
  const handleToggleWeekday = (day: number) => {
    setRecurrenceWeekdays(prev => ({ ...prev, [day]: !prev[day] }));
  };
  const handleGenerateRecurrence = () => {
    if (!routeToDuplicate) return;
    const start = new Date(routeToDuplicate.date + 'T00:00:00');
    const amount = Math.max(1, recurrenceAmount || 1);
    const selectedDays = Object.entries(recurrenceWeekdays).filter(([d, v]) => v).map(([d]) => parseInt(d, 10));
    if (selectedDays.length === 0) return;
    const dates: string[] = [];
    const end = new Date(start);
    if (recurrenceType === 'months') {
      end.setMonth(end.getMonth() + amount);
    } else {
      end.setDate(end.getDate() + (7 * amount));
    }
    const cursor = new Date(start);
    while (cursor <= end) {
      if (selectedDays.includes(cursor.getDay())) {
        const iso = formatDateYMD(cursor);
        if (!duplicateTargetDates.includes(iso)) dates.push(iso);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    if (dates.length > 0) {
      setDuplicateTargetDates([...duplicateTargetDates, ...dates]);
    }
  };
  const handleAddDate = () => {
    if (!currentDateInput) return;
    if (duplicateTargetDates.includes(currentDateInput)) {
      alert('Data já adicionada');
      return;
    }
    setDuplicateTargetDates([...duplicateTargetDates, currentDateInput]);
    setCurrentDateInput('');
  };

  const handleRemoveDate = (dateToRemove: string) => {
    setDuplicateTargetDates(duplicateTargetDates.filter(d => d !== dateToRemove));
  };

  const getMonthDays = (month: Date) => {
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const days = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      days.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  };
  const toggleSelectCalendarDate = (d: Date) => {
    const iso = formatDateYMD(d);
    setCalendarSelectedDates(prev => prev.includes(iso) ? prev.filter(x => x !== iso) : [...prev, iso]);
  };
  const handleCreateCalendarRoutes = async () => {
    if (calendarSelectedDates.length === 0 || selectedPromoters.length === 0 || routeItems.length === 0) {
      alert('Selecione promotor(es), itens e datas no calendário.');
      return;
    }

    if (editorBrandId) {
      const brand = brands.find((b: any) => b.id === editorBrandId);
      if (brand) {
        for (const d of calendarSelectedDates) {
          const err = validateAvailabilityForDate(brand, d, routeItems);
          if (err) {
            alert(err);
            return;
          }
        }
      }
    }

    setLoading(true);
    try {
      await api.post('/routes/batch', {
        dates: calendarSelectedDates,
        promoterIds: selectedPromoters,
        brandId: editorBrandId || undefined,
        checklistTemplateId: editorChecklistTemplateId || undefined,
        items: routeItems.map((item, index) => ({
          supermarketId: item.supermarketId,
          order: index + 1,
          startTime: item.startTime || undefined,
          endTime: item.endTime || undefined,
          estimatedDuration: item.estimatedDuration ? parseInt(String(item.estimatedDuration), 10) : undefined,
          productIds: item.productIds || [],
          products: item.products || item.productIds?.map((id: string) => ({ productId: id })) || []
        }))
      });
      alert('Rotas criadas com sucesso!');
      setShowCalendarModal(false);
      setCalendarSelectedDates([]);
      fetchRoutesForWeek();
    } catch (error: any) {
      console.error('Error creating calendar routes:', error);
      if (error.response?.status === 401) return;
      const msg = error.response?.data?.message || error.message || 'Erro desconhecido';
      alert(`Erro ao criar rotas: ${Array.isArray(msg) ? msg.join(', ') : msg}`);
    } finally {
      setLoading(false);
    }
  };
  const handleManagePromoters = (route: any) => {
    setManagingPromotersRoute(route);
    if (route.promoters && route.promoters.length > 0) {
        setManagedPromoterIds(route.promoters.map((p: any) => p.id));
    } else if (route.promoterId) {
        setManagedPromoterIds([route.promoterId]);
    } else if (route.promoter?.id) {
        setManagedPromoterIds([route.promoter.id]);
    } else {
        setManagedPromoterIds([]);
    }
  };

  const handleSaveManagedPromoters = async () => {
    if (!managingPromotersRoute) return;
    setLoading(true);
    try {
        await api.patch(`/routes/${managingPromotersRoute.id}`, {
            promoterIds: managedPromoterIds
        });
        alert('Promotores atualizados com sucesso!');
        setManagingPromotersRoute(null);
        fetchRoutesForWeek();
    } catch (error: any) {
        console.error('Error updating promoters:', error);
        if (error.response?.status === 401) return;
        const msg = error.response?.data?.message || error.message || 'Erro desconhecido';
        alert(`Erro ao atualizar promotores: ${Array.isArray(msg) ? msg.join('\n') : msg}`);
    } finally {
        setLoading(false);
    }
  };

  const handleToggleManagedPromoter = (id: string) => {
    setManagedPromoterIds(prev => {
        if (prev.includes(id)) {
            return prev.filter(pId => pId !== id);
        } else {
            return [...prev, id];
        }
    });
  };

  // --- Planner Logic ---
  const getDaysOfWeek = (startDate: Date) => {
    const days = [];
    const current = new Date(startDate);
    current.setDate(current.getDate() - current.getDay() + 1); // Start Monday
    for (let i = 0; i < 7; i++) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return days;
  };

  const weekDays = getDaysOfWeek(weekStart);

  const getRoutesForDay = (dateStr: string) => {
    return weekRoutes.filter(r => {
      const matchesDate = r.date === dateStr;
      const matchesPromoter = !filterPromoterId || 
        r.promoterId === filterPromoterId || 
        (r.promoters && r.promoters.some((p: any) => p.id === filterPromoterId));
      
      let matchesSupervisor = true;
      if (filterSupervisorId) {
         // Check supervisors of all assigned promoters
         const promotersToCheck = r.promoters && r.promoters.length > 0 
            ? r.promoters.map((p: any) => allEmployees.find(e => e.id === p.id)).filter(Boolean)
            : [allEmployees.find(e => e.id === r.promoterId)].filter(Boolean);
            
         matchesSupervisor = promotersToCheck.some((promoter: any) => 
            promoter && (promoter.supervisorId === filterSupervisorId || (promoter.supervisor && promoter.supervisor.id === filterSupervisorId))
         );
      }

      let matchesGroup = true;
      if (filterGroupId) {
        matchesGroup = r.items?.some((item: any) => 
          item.supermarket?.groupId === filterGroupId || 
          item.supermarket?.group?.id === filterGroupId
        );
      }

      let matchesPDV = true;
      if (filterSupermarketId) {
        matchesPDV = r.items?.some((item: any) => item.supermarket?.id === filterSupermarketId);
      }

      return matchesDate && matchesPromoter && matchesSupervisor && matchesGroup && matchesPDV;
    });
  };

  const openDayModal = (dateStr: string) => {
    const dayRoutes = getRoutesForDay(dateStr);
    const entries: any[] = [];
    dayRoutes.forEach((route: any) => {
      const names: string[] = [];
      if (route.promoter?.fullName || route.promoter?.name) {
        names.push(route.promoter.fullName || route.promoter.name);
      }
      if (route.promoters && route.promoters.length > 0) {
        route.promoters.forEach((p: any) => {
          names.push(p.fullName || p.name);
        });
      }
      route.items.forEach((item: any) => {
        const clientsSet = new Set<string>();
        item.products.forEach((p: any) => {
          const client = p.product?.brand?.client || p.product?.client;
          const cname = client?.nomeFantasia || client?.fantasyName || client?.razaoSocial || client?.nome || '';
          if (cname) clientsSet.add(cname);
        });
        entries.push({
          route,
          item,
          pdvName: item.supermarket?.fantasyName || 'PDV',
          clientsCount: clientsSet.size,
          promoters: names
        });
      });
    });
    setDayModalEntries(entries);
    setDayModalDate(dateStr);
    setShowDayModal(true);
  };

  const handleClearRoutes = async () => {
    if (!window.confirm('ATENÇÃO: Deseja apagar TODAS as rotas futuras (incluindo hoje)?\n\nEsta ação removerá todas as rotas DRAFT e CONFIRMED a partir da data de hoje.\nRotas já iniciadas ou concluídas serão mantidas.')) return;
    
    setLoading(true);
    try {
      const today = formatDateYMD(new Date());
      await api.delete(`/routes/batch?startDate=${today}`);
      alert('Rotas futuras apagadas com sucesso!');
      fetchRoutesForWeek();
    } catch (error: any) {
      console.error('Error clearing routes:', error);
      alert('Erro ao apagar rotas: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDelete = async (e: React.MouseEvent, routeId: string) => {
    e.stopPropagation();
    
    // Check for recurrence
    const route = weekRoutes.find(r => r.id === routeId);
    let deleteSeries = false;

    if (route?.recurrenceGroup) {
       // Simple interaction: Ask if user wants to delete series
       // If Cancel, ask if wants to delete single
       if (window.confirm('Esta rota faz parte de uma série recorrente.\n\nDeseja apagar TODAS as rotas futuras desta série?')) {
           deleteSeries = true;
       } else {
           if (!window.confirm('Deseja apagar APENAS esta rota específica?')) return;
       }
    } else {
       if (!window.confirm('Tem certeza que deseja excluir esta rota?')) return;
    }

    try {
      await api.delete(`/routes/${routeId}${deleteSeries ? '?recurrence=true' : ''}`);
      fetchRoutesForWeek();
    } catch (error: any) {
      console.error('Error deleting route:', error);
      if (error.response?.status === 401) return;
      alert('Erro ao excluir rota.');
    }
  };

  const handleEditRoute = (route: any) => {
    if (route.promoters && route.promoters.length > 0) {
      setSelectedPromoters(route.promoters.map((p: any) => p.id));
    } else if (route.promoterId) {
      setSelectedPromoters([route.promoterId]);
    } else if (route.promoter?.id) {
      setSelectedPromoters([route.promoter.id]);
    } else {
      setSelectedPromoters([]);
    }
    setSelectedDate(route.date.split('T')[0]);
    setEditorBrandId(route.brandId || route.brand?.id || '');
    setEditorChecklistTemplateId(route.checklistTemplateId || route.checklistTemplate?.id || '');
    
    // Identify completed/started products to prevent removal
    const completedIds: string[] = [];
    if (route.items) {
        route.items.forEach((item: any) => {
            if (item.products) {
                item.products.forEach((p: any) => {
                    if (p.checked || p.checkInTime) {
                        completedIds.push(p.productId);
                    }
                });
            }
        });
    }
    setCompletedProductIds(completedIds);

    // Load items
    const items = route.items.map((item: any) => ({
      supermarketId: item.supermarket.id,
      supermarket: item.supermarket,
      order: item.order,
      startTime: item.startTime || '',
      endTime: item.endTime || '',
      estimatedDuration: item.estimatedDuration || 30,
      productIds: item.products?.map((p: any) => p.productId) || [],
      products: item.products?.map((p: any) => ({
        productId: p.productId,
        checklistTemplateId: p.checklistTemplateId,
        checklistTypes: p.checklistTypes,
        requiresStockPhotos: p.requiresStockPhotos
      })) || []
    }));
    setRouteItems(items);

    // Check Recurrence
    if (route.recurrenceGroup) {
      setPendingRouteEdit(route);
      setShowRecurrenceChoiceModal(true);
      return;
    }

    setRouteStatus(route.status);
    setEditingRouteId(route.id);
    setActiveTab('editor');
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/routes/rules', {
        ...newRule,
        value: JSON.parse(newRule.value || '{}')
      });
      alert('Regra criada com sucesso!');
      setNewRule({ name: '', description: '', value: '' });
      fetchRules();
    } catch (error: any) {
      console.error('Error creating rule:', error);
      if (error.response?.status === 401) return;
      alert('Erro ao criar regra. Verifique se o valor é um JSON válido.');
    }
  };

  const pointerSensorOptions = useMemo(() => ({
    activationConstraint: {
      distance: 8,
    },
  }), []);

  const sensors = useSensors(
    useSensor(PointerSensor, pointerSensorOptions),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    // Block reordering if route is started/completed and not admin (or always block if that's preferred, but user said admin can edit)
    // Actually, user said "admin pode editar", so we allow if admin.
    if (!isAdmin && (routeStatus === 'COMPLETED' || routeStatus === 'IN_PROGRESS')) {
        return;
    }

    const { active, over } = event;
    if (active.id !== over?.id) {
      setRouteItems((items) => {
        const oldIndex = items.findIndex((item) => item.supermarketId === active.id);
        const newIndex = items.findIndex((item) => item.supermarketId === over?.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleDragEndPlanner = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // active.id is routeId, over.id is dateStr
    const routeId = active.id as string;
    const newDate = over.id as string;

    const route = weekRoutes.find(r => r.id === routeId);
    if (!route || route.date === newDate) return;

    if (route.status === 'COMPLETED' || route.status === 'IN_PROGRESS') {
        alert('Não é possível mover uma rota que já foi iniciada ou concluída.');
        return;
    }

    // Optimistic Update
    const originalRoutes = [...weekRoutes];
    setWeekRoutes(prev => prev.map(r => 
      r.id === routeId ? { ...r, date: newDate } : r
    ));

    try {
      await api.patch(`/routes/${routeId}`, { date: newDate });
    } catch (error: any) {
      console.error('Error moving route:', error);
      if (error.response?.status === 401) return;
      alert('Erro ao mover rota.');
      setWeekRoutes(originalRoutes);
    }
  };

  const handleTogglePromoter = (id: string) => {
    setSelectedPromoters(prev => {
      if (prev.includes(id)) {
        return prev.filter(pId => pId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-2xl font-black text-[color:var(--color-text)] tracking-tight">Gestão de Rotas</h1>
          <p className="text-[color:var(--color-muted)] font-medium text-lg">Planejamento, Templates e Regras.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto">
          {['planner', 'editor', 'templates', 'rules'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all capitalize ${
                activeTab === tab ? 'bg-white text-[color:var(--color-text)] shadow-sm' : 'text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]'
              }`}
            >
              {tab === 'planner' ? 'Calendário' : tab === 'editor' ? 'Editor de Rota' : tab === 'templates' ? 'Modelos' : 'Regras'}
            </button>
          ))}
        </div>
      </div>

      {/* --- PLANNER TAB --- */}
      {activeTab === 'planner' && (
        <DndContext onDragEnd={handleDragEndPlanner} sensors={sensors}>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 gap-4">
            <div className="flex items-center gap-4">
               <button onClick={() => {
                  const d = new Date(weekStart);
                  d.setDate(d.getDate() - 7);
                  setWeekStart(d);
               }} className="p-2 hover:bg-slate-100 rounded-lg font-bold text-[color:var(--color-muted)]">
                 &larr; Semana Anterior
               </button>
               <h3 className="text-lg font-black text-[color:var(--color-text)]">
                 {weekDays[0].toLocaleDateString()} - {weekDays[6].toLocaleDateString()}
               </h3>
               <button onClick={() => {
                  const d = new Date(weekStart);
                  d.setDate(d.getDate() + 7);
                  setWeekStart(d);
               }} className="p-2 hover:bg-slate-100 rounded-lg font-bold text-[color:var(--color-muted)]">
                 Próxima Semana &rarr;
               </button>
            </div>

            <div className="flex flex-wrap gap-4 w-full md:w-auto">
               <select 
                 value={filterGroupId}
                 onChange={(e) => setFilterGroupId(e.target.value)}
                 className="px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-100 text-sm font-bold text-[color:var(--color-muted)]"
               >
                 <option value="">Todas as Redes</option>
                 {groups.map(g => (
                   <option key={g.id} value={g.id}>{g.name}</option>
                 ))}
               </select>

               <select 
                 value={filterSupermarketId}
                 onChange={(e) => setFilterSupermarketId(e.target.value)}
                 className="px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-100 text-sm font-bold text-[color:var(--color-muted)]"
               >
                 <option value="">Todos os PDVs</option>
                 {supermarkets
                   .filter(s => !filterGroupId || s.groupId === filterGroupId || s.group?.id === filterGroupId)
                   .map(s => (
                   <option key={s.id} value={s.id}>{s.fantasyName}</option>
                 ))}
               </select>

               <select 
                 value={filterPromoterId}
                 onChange={(e) => setFilterPromoterId(e.target.value)}
                 className="px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-100 text-sm font-bold text-[color:var(--color-muted)]"
               >
                 <option value="">Todos os Promotores</option>
                 {promoters.map(p => (
                   <option key={p.id} value={p.id}>{p.name}</option>
                 ))}
               </select>

               <select 
                 value={filterSupervisorId}
                 onChange={(e) => setFilterSupervisorId(e.target.value)}
                 className="px-4 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-100 text-sm font-bold text-[color:var(--color-muted)]"
               >
                 <option value="">Todos os Supervisores</option>
                 {/* Filter employees to show only potential supervisors (e.g., have 'supervisor' in role or are assigned as supervisor) 
                     For simplicity, we'll list all employees or filter by role if possible.
                     Let's assume supervisors have 'Supervisor' in their role name.
                 */}
                 {allEmployees
                   .filter(e => 
                     e.role && (
                       e.role.name.toLowerCase().includes('supervisor') ||
                       e.role.name.toLowerCase().includes('coordenador') ||
                       e.role.name.toLowerCase().includes('gerente')
                     )
                   )
                   .map(s => (
                     <option key={s.id} value={s.id}>{s.fullName || s.name}</option>
                   ))
                 }
               </select>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-4 overflow-x-auto min-w-[1000px]">
            {weekDays.map(day => {
              const dateStr = formatDateYMD(day);
              const dayRoutes = getRoutesForDay(dateStr);
              const isToday = formatDateYMD(new Date()) === dateStr;

              return (
                <DroppableDayColumn 
                    key={dateStr} 
                    dateStr={dateStr} 
                    isToday={isToday}
                    onAddRoute={() => {
                        setSelectedDate(dateStr);
                        setRouteItems([]);
                        setEditingRouteId(null);
                        setCompletedProductIds([]);
                        setRouteStatus('DRAFT');
                        setActiveTab('editor');
                    }}
                >
                  <div className="text-center mb-4">
                    <p className="text-xs font-black text-slate-400 uppercase">{day.toLocaleDateString('pt-BR', { weekday: 'short' })}</p>
                    <p className={`text-xl font-black ${isToday ? 'text-blue-600' : 'text-[color:var(--color-text)]'}`}>{day.getDate()}</p>
                  </div>

                  {dayRoutes.map(route => (
                    <DraggableRouteCard 
                        key={route.id} 
                        route={route} 
                        onDoubleClick={() => handleEditRoute(route)}
                        onDelete={(e: any, id: string) => handleQuickDelete(e, id)}
                        onManagePromoters={handleManagePromoters}
                        onDuplicate={(r: any) => {
                           setRouteToDuplicate(r);
                           setShowDuplicateModal(true);
                           setDuplicateTargetDates([]);
                        }}
                    />
                  ))}
                </DroppableDayColumn>
              );
            })}
          </div>

          {/* Calendário Mensal */}
          <div className="mt-10 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-[color:var(--color-text)]">Calendário Mensal</h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setPlannerMonth(new Date(plannerMonth.getFullYear(), plannerMonth.getMonth() - 1, 1))}
                  className="px-3 py-2 border rounded-lg text-sm"
                >
                  ◀
                </button>
                <span className="font-bold">{plannerMonth.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</span>
                <button 
                  onClick={() => setPlannerMonth(new Date(plannerMonth.getFullYear(), plannerMonth.getMonth() + 1, 1))}
                  className="px-3 py-2 border rounded-lg text-sm"
                >
                  ▶
                </button>
                <button 
                  onClick={() => openWeeklyWizard('new')}
                  className="px-4 py-2 rounded-lg font-bold text-white"
                  style={{ backgroundColor: settings.primaryColor }}
                >
                  Criar por Semana
                </button>
                <button 
                  onClick={() => {
                    setCalendarMonth(new Date(plannerMonth.getFullYear(), plannerMonth.getMonth(), 1));
                    setCalendarSelectedDates([]);
                    setShowCalendarModal(true);
                  }}
                  className="px-4 py-2 rounded-lg font-bold text-white"
                  style={{ backgroundColor: settings.primaryColor }}
                >
                  Criar por Calendário
                </button>
                <button 
                  onClick={handleClearRoutes}
                  className="px-4 py-2 rounded-lg font-bold text-red-600 bg-red-100 hover:bg-red-200 border border-red-200"
                >
                  Limpar Rotas
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-3">
              {['Dom','Seg','Ter','Qua','Qui','Sex','Sab'].map(d => (
                <div key={d} className="text-xs text-slate-400 text-center">{d}</div>
              ))}
              {(() => {
                const days = getMonthDays(plannerMonth);
                const startWeekday = new Date(plannerMonth.getFullYear(), plannerMonth.getMonth(), 1).getDay();
                const blanks = Array.from({ length: startWeekday }).map((_, i) => <div key={`mb-${i}`} />);
                return [
                  ...blanks,
                  ...days.map(day => {
                    const dateStr = formatDateYMD(day);
                    const dayRoutes = getRoutesForDay(dateStr);
                    // Aggregate PDVs and Clients
                    const pdvEntries = [];
                    let totalPdvs = 0;
                    let rupturas = 0;
                    let validadeProx = 0;
                    dayRoutes.forEach((route: any) => {
                      route.items.forEach((item: any) => {
                        totalPdvs += 1;
                        const clientsSet = new Set<string>();
                        item.products.forEach((p: any) => {
                          const client = p.product?.brand?.client || p.product?.client;
                          const cname = client?.nomeFantasia || client?.fantasyName || client?.razaoSocial || client?.nome || '';
                          if (cname) clientsSet.add(cname);
                          if (p.isStockout) rupturas += 1;
                          const overallValidity = (() => {
                            const storeDate = (p as any).validityStoreDate ? String((p as any).validityStoreDate) : '';
                            const storeQty = (p as any).validityStoreQuantity !== null && (p as any).validityStoreQuantity !== undefined ? Number((p as any).validityStoreQuantity) : 0;
                            const stockDate = (p as any).validityStockDate ? String((p as any).validityStockDate) : '';
                            const stockQty = (p as any).validityStockQuantity !== null && (p as any).validityStockQuantity !== undefined ? Number((p as any).validityStockQuantity) : 0;
                            const legacyDate = (p as any).validityDate ? String((p as any).validityDate) : '';
                            const legacyQty = (p as any).validityQuantity !== null && (p as any).validityQuantity !== undefined ? Number((p as any).validityQuantity) : 0;
                            const hasStore = !!(storeDate && storeQty > 0);
                            const hasStock = !!(stockDate && stockQty > 0);
                            if (hasStore && hasStock) return storeDate <= stockDate ? storeDate : stockDate;
                            if (hasStore) return storeDate;
                            if (hasStock) return stockDate;
                            if (legacyDate && legacyQty > 0) return legacyDate;
                            return legacyDate || '';
                          })();
                          if (overallValidity) {
                            const today = new Date();
                            const valDate = new Date(String(overallValidity) + 'T00:00:00');
                            const diffDays = Math.ceil((valDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                            if (diffDays >= 0 && diffDays <= 7) validadeProx += 1;
                          }
                        });
                        pdvEntries.push({
                          name: item.supermarket?.fantasyName || 'PDV',
                          clientsCount: clientsSet.size
                        });
                      });
                    });
                    const topEntries = pdvEntries.slice(0, 3);
                    return (
                      <button key={dateStr} onClick={() => openDayModal(dateStr)} className="border rounded-xl p-2 bg-white text-left hover:border-blue-300 transition">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[color:var(--color-muted)]">{day.toLocaleDateString('pt-BR', { day: '2-digit' })}</span>
                          <span className="text-[10px] text-slate-400">{totalPdvs} PDV(s)</span>
                        </div>
                        <div className="mt-2 space-y-1">
                          {topEntries.length === 0 ? (
                            <div className="text-[11px] text-slate-300 italic">Sem agenda</div>
                          ) : topEntries.map((e, idx) => (
                            <div key={idx} className="flex items-center justify-between text-[11px]">
                              <span className="font-medium text-[color:var(--color-text)] truncate">{e.name}</span>
                              <span className="text-[color:var(--color-muted)]">{e.clientsCount} cliente(s)</span>
                            </div>
                          ))}
                        </div>
                        {(rupturas > 0 || validadeProx > 0) && (
                          <div className="mt-2 flex items-center gap-2">
                            {rupturas > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-100">
                                Rupturas {rupturas}
                              </span>
                            )}
                            {validadeProx > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                                Validade próxima {validadeProx}
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })
                ];
              })()}
            </div>
          </div>
        </div>
        </DndContext>
      )}

      {/* --- EDITOR TAB --- */}
      {activeTab === 'editor' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Settings Panel */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
              <h3 className="text-sm font-black text-[color:var(--color-text)] uppercase tracking-wider">Configuração da Rota</h3>
              
              <div>
                <label className="text-xs font-bold text-[color:var(--color-muted)] block mb-1">Data</label>
                <input 
                  type="date" 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full font-bold text-[color:var(--color-text)] bg-slate-50 p-3 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-[color:var(--color-text)] mb-2">
                  1. Selecione os Promotores *
                </label>
                <div className="mb-2">
                  <input
                    type="text"
                    placeholder="Buscar promotor..."
                    value={promoterSearch}
                    onChange={(e) => setPromoterSearch(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="h-64 overflow-y-auto space-y-2 pr-2">
                  {promoters
                    .filter(p => p.name.toLowerCase().includes(promoterSearch.toLowerCase()))
                    .map(promoter => {
                      const isSelected = selectedPromoters.includes(promoter.id);
                      return (
                        <button 
                          key={promoter.id}
                          onClick={() => handleTogglePromoter(promoter.id)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                              : 'bg-white border border-slate-100 hover:bg-slate-50 text-[color:var(--color-muted)]'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-[color:var(--color-muted)]'
                          }`}>
                            {promoter.name.charAt(0)}
                          </div>
                          <div className="text-left">
                            <p className="font-bold">{promoter.name}</p>
                            <p className={`text-xs ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                              {promoter.email}
                            </p>
                          </div>
                          {isSelected && (
                            <div className="ml-auto">
                              <CheckCircle size={20} className="text-white" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  {promoters.filter(p => p.name.toLowerCase().includes(promoterSearch.toLowerCase())).length === 0 && (
                     <div className="text-center py-4 text-slate-400 text-sm">Nenhum promotor encontrado</div>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[color:var(--color-muted)] block mb-1">Status</label>
                <div className={`inline-flex px-3 py-1 rounded-full text-xs font-black ${
                  routeStatus === 'CONFIRMED' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-[color:var(--color-muted)]'
                }`}>
                  {routeStatus}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 p-6">
              <div>
                <label className="block text-sm font-bold text-[color:var(--color-text)] mb-2">
                  2. Adicionar Supermercados *
                </label>
                <div className="mb-2">
                  <input
                    type="text"
                    placeholder="Buscar supermercado..."
                    value={supermarketSearch}
                    onChange={(e) => setSupermarketSearch(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="h-64 overflow-y-auto space-y-2 pr-2">
                  {supermarkets
                    .filter(s => 
                      s.fantasyName.toLowerCase().includes(supermarketSearch.toLowerCase()) ||
                      s.city.toLowerCase().includes(supermarketSearch.toLowerCase())
                    )
                    .map(s => (
                    <button 
                      key={s.id}
                      onClick={() => handleAddSupermarket(s.id)}
                      disabled={!!routeItems.find(i => i.supermarketId === s.id)}
                      className="w-full flex justify-between items-center p-3 rounded-xl hover:bg-slate-50 border border-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-left"
                    >
                      <div>
                        <p className="text-sm font-bold text-[color:var(--color-text)]">{s.fantasyName}</p>
                        <p className="text-[10px] text-slate-400">{s.city}</p>
                      </div>
                      <Plus size={16} className="text-slate-400" />
                    </button>
                  ))}
                  {supermarkets.filter(s => 
                      s.fantasyName.toLowerCase().includes(supermarketSearch.toLowerCase()) ||
                      s.city.toLowerCase().includes(supermarketSearch.toLowerCase())
                    ).length === 0 && (
                     <div className="text-center py-4 text-slate-400 text-sm">Nenhum supermercado encontrado</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Route Items Panel */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-50 rounded-3xl border border-slate-200 p-8 min-h-[600px]">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-[color:var(--color-text)]">Roteiro de Visitas</h3>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowSaveTemplateModal(true)}
                    className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-[color:var(--color-muted)] hover:bg-slate-50 flex items-center gap-2"
                  >
                    <Copy size={14} /> Salvar como Modelo
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {routeItems.length === 0 ? (
                  <div className="text-center py-20">
                    <MapPinned size={48} className="mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-400 font-medium">Adicione supermercados para montar a rota.</p>
                  </div>
                ) : (
                  <DndContext 
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext 
                      items={routeItems.map(i => i.supermarketId)}
                      strategy={verticalListSortingStrategy}
                    >
                      {routeItems.map((item, index) => (
                        <SortableRouteItem
                          key={item.supermarketId}
                          id={item.supermarketId}
                          item={item}
                          index={index}
                          onRemove={handleRemoveItem}
                          onUpdate={handleUpdateItem}
                          onOpenProducts={handleOpenProductModal}
                          products={products}
                          completedProductIds={completedProductIds}
                          disabled={!isAdmin && (routeStatus === 'COMPLETED' || routeStatus === 'IN_PROGRESS')}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                )}
              </div>

              <div className="flex gap-4 mt-8 pt-8 border-t border-slate-200">
                {editingRouteId && (
                    <button 
                      onClick={handleDeleteRoute}
                      disabled={loading || (!isAdmin && (routeStatus === 'COMPLETED' || routeStatus === 'IN_PROGRESS'))}
                      className="px-6 py-4 bg-red-50 border border-red-100 text-red-600 rounded-xl font-black shadow-sm hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      title="Excluir Rota"
                    >
                      <Trash2 size={20} />
                    </button>
                )}
                <button 
                  onClick={() => handleSaveRoute('DRAFT')}
                  disabled={loading || (!isAdmin && (routeStatus === 'COMPLETED' || routeStatus === 'IN_PROGRESS'))}
                  className="flex-1 py-4 bg-white border border-slate-200 text-[color:var(--color-muted)] rounded-xl font-black shadow-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  {routeStatus === 'CONFIRMED' || routeStatus === 'COMPLETED' ? 'Reverter para Rascunho' : 'Salvar Rascunho'}
                </button>
                <button 
                  onClick={() => handleSaveRoute(routeStatus === 'COMPLETED' ? 'COMPLETED' : 'CONFIRMED')}
                  disabled={loading || (!isAdmin && (routeStatus === 'COMPLETED' || routeStatus === 'IN_PROGRESS'))}
                  className="flex-1 py-4 text-white rounded-xl font-black shadow-lg hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ backgroundColor: settings.primaryColor }}
                >
                  <Check size={20} /> {routeStatus === 'CONFIRMED' || routeStatus === 'COMPLETED' ? 'Salvar Alterações' : 'Confirmar Rota'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TEMPLATES TAB --- */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map(template => (
            <div key={template.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
                  <FileText size={24} />
                </div>
                <button className="text-slate-300 hover:text-red-400"><Trash2 size={18} /></button>
              </div>
              <h3 className="text-lg font-black text-[color:var(--color-text)] mb-2">{template.templateName}</h3>
              <p className="text-sm text-[color:var(--color-muted)] mb-6">{template.items.length} PDVs configurados</p>
              
              <button 
                onClick={() => handleLoadTemplate(template)}
                className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800"
              >
                Usar Modelo
              </button>
            </div>
          ))}
          {templates.length === 0 && (
            <div className="col-span-full text-center py-20 text-slate-400">
              Nenhum modelo salvo. Crie uma rota e salve como modelo.
            </div>
          )}
        </div>
      )}

      {/* --- RULES TAB (Existing) --- */}
      {activeTab === 'rules' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <div className="bg-white rounded-3xl border border-slate-200 p-8">
              <h3 className="text-xl font-black text-[color:var(--color-text)] mb-6 flex items-center gap-2">
                <Settings size={24} className="text-slate-400" />
                Nova Regra
              </h3>
              <form onSubmit={handleCreateRule} className="space-y-4">
                 <div>
                    <label className="text-[11px] font-black text-slate-400 uppercase mb-1 block">Nome da Regra</label>
                    <input 
                      type="text" 
                      required
                      value={newRule.name}
                      onChange={e => setNewRule({...newRule, name: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none focus:ring-2 focus:ring-blue-100 font-bold text-sm"
                    />
                 </div>
                 <div>
                    <label className="text-[11px] font-black text-slate-400 uppercase mb-1 block">Descrição</label>
                    <input 
                      type="text" 
                      required
                      value={newRule.description}
                      onChange={e => setNewRule({...newRule, description: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none focus:ring-2 focus:ring-blue-100 font-bold text-sm"
                    />
                 </div>
                 <div>
                    <label className="text-[11px] font-black text-slate-400 uppercase mb-1 block">Configuração (JSON)</label>
                    <textarea 
                      required
                      value={newRule.value}
                      onChange={e => setNewRule({...newRule, value: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none focus:ring-2 focus:ring-blue-100 font-mono text-sm h-32"
                    />
                 </div>
                 <button 
                    type="submit"
                    className="w-full py-4 rounded-xl text-white font-black shadow-lg hover:opacity-90 transition-all flex items-center justify-center gap-2"
                    style={{ backgroundColor: settings.primaryColor }}
                 >
                    <Save size={20} /> Salvar Regra
                 </button>
              </form>
           </div>
           {/* Rules List (Same as before) */}
           <div className="bg-white rounded-3xl border border-slate-200 p-8">
              <h3 className="text-xl font-black text-[color:var(--color-text)] mb-6 flex items-center gap-2">
                <List size={24} className="text-slate-400" />
                Regras Ativas
              </h3>
              <div className="space-y-4">
                 {rules.map((rule: any) => (
                   <div key={rule.id} className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex justify-between items-start mb-2">
                         <h4 className="font-bold text-[color:var(--color-text)]">{rule.name}</h4>
                         <span className="text-xs font-bold px-2 py-1 rounded bg-green-100 text-green-700">Ativa</span>
                      </div>
                      <p className="text-sm text-[color:var(--color-muted)] mb-3">{rule.description}</p>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      )}

      {/* Product Selection Modal */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[70vh] flex flex-col p-4 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-[color:var(--color-text)]">
                {selectedClientForModal ? (
                  currentRouteItemIndex !== null && routeItems[currentRouteItemIndex] ? (
                    <span>
                      Selecionar Produtos <span className="text-slate-400 text-sm font-normal mx-2">|</span> 
                      {routeItems[currentRouteItemIndex].supermarket.fantasyName}
                      {routeItems[currentRouteItemIndex].supermarket.group && (
                        <span className="ml-2 text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-xs uppercase tracking-wider">
                          {routeItems[currentRouteItemIndex].supermarket.group.name}
                        </span>
                      )}
                    </span>
                  ) : 'Selecionar Produtos'
                ) : 'Selecionar Cliente'}
              </h3>
              <button onClick={() => {
                setShowProductModal(false);
                setSelectedClientForModal(null);
              }} className="text-slate-400 hover:text-[color:var(--color-muted)]">
                <Settings size={20} className="rotate-45" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-2 pr-2 mb-4">
              {!selectedClientForModal ? (
                // Step 1: Select Client
                <div className="space-y-2">
                   <div className="mb-2 sticky top-0 bg-white z-10 pt-1 pb-2">
                     <div className="relative">
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                       <input
                         type="text"
                         placeholder="Buscar cliente..."
                         value={clientSearch}
                         onChange={(e) => setClientSearch(e.target.value)}
                         className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                       />
                     </div>
                   </div>
                   {(() => {
                      const currentSupermarket = currentRouteItemIndex !== null ? routeItems[currentRouteItemIndex].supermarket : null;
                      
                      // Filter products based on group restrictions and PDV restrictions
                      const allowedProducts = products.filter(p => {
                          const hasGroupRestriction = p.supermarketGroups && p.supermarketGroups.length > 0;
                          const hasPdvRestriction = p.supermarkets && p.supermarkets.length > 0;

                          // If no restrictions at all, allow everywhere
                          if (!hasGroupRestriction && !hasPdvRestriction) return true;

                          let allowedByGroup = false;
                          if (hasGroupRestriction && currentSupermarket?.group) {
                              allowedByGroup = p.supermarketGroups.some((g: any) => g.id === currentSupermarket.group.id);
                          }

                          let allowedByPdv = false;
                          if (hasPdvRestriction && currentSupermarket) {
                              allowedByPdv = p.supermarkets.some((s: any) => s.id === currentSupermarket.id);
                          }

                          // Allow if either condition is met (Union/OR logic)
                          return allowedByGroup || allowedByPdv;
                      });

                      // Use supermarket clients if available, otherwise fallback to all clients from ALLOWED products
                      const availableClients = (currentSupermarket?.clients && currentSupermarket.clients.length > 0)
                        ? currentSupermarket.clients
                        : Array.from(new Set(allowedProducts.map(p => p.client?.id).filter(Boolean))).map(id => ({ id }));
                        
                      // Filter out clients that don't have any products in the allowed list
                      const clientsWithProducts = availableClients.filter((c: any) => 
                        allowedProducts.some(p => p.client?.id === c.id)
                      );
                      
                      // Remove duplicates just in case
                      const uniqueClients = Array.from(new Set(clientsWithProducts.map((c: any) => c.id)))
                        .map(id => {
                            // Find full client data either from supermarket.clients or from product.client
                            const fromSup = currentSupermarket?.clients?.find((c: any) => c.id === id);
                            const fromProd = allowedProducts.find(p => p.client?.id === id)?.client;
                            // Prioritize the client object from supermarket relation, then from product
                            return fromSup || fromProd;
                        })
                        .filter(Boolean)
                        .filter((client: any) => {
                           const name = client.nomeFantasia || client.fantasyName || client.razaoSocial || client.nome || '';
                           return name.toLowerCase().includes(clientSearch.toLowerCase());
                        });

                      if (uniqueClients.length === 0) {
                        return <div className="text-center py-4 text-slate-400 text-sm">Nenhum cliente encontrado</div>;
                      }

                      return uniqueClients.map((client: any) => {
                        const clientId = client.id;
                        const clientProducts = allowedProducts.filter(p => p.client?.id === clientId);
                        const selectedCount = clientProducts.filter(p => tempSelectedProducts.includes(p.id)).length;
                        
                        return (
                          <button
                            key={clientId}
                            onClick={() => handleSelectClientForModal(clientId)}
                            className="w-full p-3 rounded-xl border border-slate-100 hover:bg-slate-50 flex items-center justify-between group text-left transition-all"
                          >
                            <div>
                              <p className="font-bold text-[color:var(--color-text)]">{client.nomeFantasia || client.fantasyName || client.razaoSocial || client.nome || 'Cliente sem Nome'}</p>
                              <p className="text-xs text-[color:var(--color-muted)]">{clientProducts.length} produtos disponíveis</p>
                            </div>
                            {selectedCount > 0 && (
                              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">
                                {selectedCount} selecionados
                              </span>
                            )}
                          </button>
                        );
                      });
                   })()}
                </div>
              ) : (
                // Step 2: Select Products for selected client (Transfer List Pattern)
                <div className="flex flex-col h-[60vh]">
                   {/* Header / Search */}
                   <div className="flex flex-col gap-2 mb-4">
                     <button 
                       onClick={() => setSelectedClientForModal(null)}
                       className="text-xs text-blue-600 font-bold hover:underline flex items-center gap-1 self-start"
                     >
                       ← Voltar para Clientes
                     </button>
                     <div className="relative w-full">
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                       <input
                         type="text"
                         placeholder="Buscar produto (Nome ou SKU)..."
                         value={productSearch}
                         onChange={(e) => setProductSearch(e.target.value)}
                         className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                       />
                     </div>
                   </div>
                   
                   {/* Transfer List Grid */}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-hidden">
                      {/* Left: Available */}
                      <div className="flex flex-col border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                        <div className="p-3 bg-white border-b border-slate-200 flex justify-between items-center">
                            <span className="text-xs font-black text-[color:var(--color-muted)] uppercase">Disponíveis</span>
                            <button 
                                onClick={() => {
                                    // Logic to add all visible products
                                    const productsToAdd = products
                                        .filter(p => p.client?.id === selectedClientForModal && !tempSelectedProducts.includes(p.id))
                                        .filter(p => {
                                            // Search Filter
                                            const search = productSearch.toLowerCase();
                                            const matchesSearch = p.name.toLowerCase().includes(search) || (p.sku && p.sku.toLowerCase().includes(search));
                                            if (!matchesSearch) return false;

                                            // Supermarket/Group Filter
                                            const currentSupermarket = currentRouteItemIndex !== null && routeItems[currentRouteItemIndex] 
                                                ? routeItems[currentRouteItemIndex].supermarket 
                                                : null;

                                            if (!currentSupermarket) return true;

                                            // Find the full supermarket object from the state to ensure we have relations
                                            const fullSupermarket = supermarkets.find(s => s.id === currentSupermarket.id);
                                            const targetSupermarket = fullSupermarket || currentSupermarket;

                                            // Check Mix first
                                            if (targetSupermarket.products && targetSupermarket.products.length > 0) {
                                                return targetSupermarket.products.some((mp: any) => mp.id === p.id);
                                            }

                                            const hasGroups = p.supermarketGroups && p.supermarketGroups.length > 0;
                                            const hasSupermarkets = p.supermarkets && p.supermarkets.length > 0;

                                            if (!hasGroups && !hasSupermarkets) return true;

                                            const matchesGroup = hasGroups && targetSupermarket.group && p.supermarketGroups.some((g: any) => g.id === targetSupermarket.group.id);
                                            const matchesSupermarket = hasSupermarkets && p.supermarkets.some((s: any) => s.id === targetSupermarket.id);

                                            // Also check if the Product's Client (Brand Owner) is linked to this Supermarket
                                            // This allows products to appear if the PDV is linked to the Client, even if not explicitly in product's list
                                            const productClientId = p.client?.id || p.brand?.client?.id;
                                            const matchesClient = productClientId && targetSupermarket.clients?.some((c: any) => c.id === productClientId);

                                            return matchesGroup || matchesSupermarket || matchesClient;
                                        });
                                    setTempSelectedProducts(prev => [...prev, ...productsToAdd.map(p => p.id)]);
                                }}
                                className="text-xs font-bold text-blue-600 hover:text-blue-700"
                            >
                                Adicionar Todos
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                           {products
                             .filter(p => p.client?.id === selectedClientForModal && !tempSelectedProducts.includes(p.id))
                             .filter(p => {
                                // Search Filter
                                const search = productSearch.toLowerCase();
                                const matchesSearch = p.name.toLowerCase().includes(search) || (p.sku && p.sku.toLowerCase().includes(search));
                                if (!matchesSearch) return false;

                                // Supermarket/Group Filter
                                const currentSupermarket = currentRouteItemIndex !== null && routeItems[currentRouteItemIndex] 
                                    ? routeItems[currentRouteItemIndex].supermarket 
                                    : null;

                                if (!currentSupermarket) return true;

                                // Find the full supermarket object from the state to ensure we have relations
                                const fullSupermarket = supermarkets.find(s => s.id === currentSupermarket.id);
                                const targetSupermarket = fullSupermarket || currentSupermarket;

                                // Check Mix first
                                if (targetSupermarket.products && targetSupermarket.products.length > 0) {
                                    return targetSupermarket.products.some((mp: any) => mp.id === p.id);
                                }

                                const hasGroups = p.supermarketGroups && p.supermarketGroups.length > 0;
                                const hasSupermarkets = p.supermarkets && p.supermarkets.length > 0;

                                if (!hasGroups && !hasSupermarkets) return true;

                                const matchesGroup = hasGroups && targetSupermarket.group && p.supermarketGroups.some((g: any) => g.id === targetSupermarket.group.id);
                                const matchesSupermarket = hasSupermarkets && p.supermarkets.some((s: any) => s.id === targetSupermarket.id);

                                // Also check if the Product's Client (Brand Owner) is linked to this Supermarket
                                // This allows products to appear if the PDV is linked to the Client, even if not explicitly in product's list
                                const productClientId = p.client?.id || p.brand?.client?.id;
                                const matchesClient = productClientId && targetSupermarket.clients?.some((c: any) => c.id === productClientId);

                                return matchesGroup || matchesSupermarket || matchesClient;
                             })
                             .map(product => (
                                <div 
                                    key={product.id}
                                    onClick={() => handleToggleProductSelection(product.id)}
                                    className="p-3 bg-white rounded-lg border border-slate-200 hover:border-blue-300 cursor-pointer transition-all group"
                                >
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="text-sm font-bold text-[color:var(--color-text)] group-hover:text-blue-700">{product.name}</p>
                                            <p className="text-xs text-slate-400">{product.sku}</p>
                                            {product.category && <p className="text-[10px] text-slate-400 uppercase mt-1">{product.categoryRef?.name || product.category}</p>}
                                        </div>
                                        <Plus size={16} className="text-slate-300 group-hover:text-blue-500" />
                                    </div>
                                </div>
                             ))}
                             {/* Empty state for available */}
                             {products.filter(p => p.client?.id === selectedClientForModal && !tempSelectedProducts.includes(p.id)).length === 0 && (
                                 <div className="text-center py-8 text-slate-400 text-xs">
                                     Nenhum produto disponível.
                                 </div>
                             )}
                        </div>
                      </div>

                      {/* Right: Selected */}
                      <div className="flex flex-col border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                        <div className="p-3 bg-white border-b border-slate-200 flex flex-col gap-2">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-black text-[color:var(--color-muted)] uppercase">Selecionados ({tempSelectedProducts.length})</span>
                                <button 
                                    onClick={() => {
                                      setTempSelectedProducts([]);
                                      setTempProductChecklists({});
                                      setTempProductChecklistTypes({});
                                      setTempProductRequiresStockPhotos({});
                                    }}
                                    className="text-xs font-bold text-red-500 hover:text-red-600"
                                >
                                    Remover Todos
                                </button>
                            </div>
                            <div className="relative w-full">
                               <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                               <input
                                 type="text"
                                 placeholder="Buscar selecionados..."
                                 value={selectedProductSearch}
                                 onChange={(e) => setSelectedProductSearch(e.target.value)}
                                 className="w-full pl-7 pr-2 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:border-blue-500 bg-slate-50"
                               />
                             </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                           {products
                             .filter(p => tempSelectedProducts.includes(p.id))
                             .filter(p => {
                                const search = selectedProductSearch.toLowerCase();
                                return !search || p.name.toLowerCase().includes(search) || (p.sku && p.sku.toLowerCase().includes(search));
                             })
                             .map(product => {
                                const forcedTypes = tempProductChecklistTypes[product.id] || [];
                                const hasForcedTypes = forcedTypes.length > 0;
                                const stockCountChecked = forcedTypes.includes('STOCK_COUNT');
                                const validityChecked = forcedTypes.includes('VALIDITY_CHECK');
                                const stockPhotosChecked = !!tempProductRequiresStockPhotos[product.id];

                                return (
                                <div
                                  key={product.id}
                                  className="p-3 bg-white rounded-lg border border-blue-200 shadow-sm"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <p className="text-sm font-bold text-[color:var(--color-text)]">{product.name}</p>
                                            <p className="text-xs text-[color:var(--color-muted)]">{product.sku}</p>
                                        </div>
                                        <button 
                                            onClick={() => handleToggleProductSelection(product.id)}
                                            className={`${completedProductIds.includes(product.id) ? 'text-slate-300 cursor-not-allowed' : 'text-red-300 hover:text-red-500'}`}
                                            disabled={completedProductIds.includes(product.id)}
                                            title={completedProductIds.includes(product.id) ? 'Produto já realizado/iniciado' : 'Remover produto'}
                                        >
                                            {completedProductIds.includes(product.id) ? <CheckCircle size={16} /> : <Trash2 size={16} />}
                                        </button>
                                    </div>
                                    
                                    {/* Checklist Selector */}
                                    <div className="mt-2 pt-2 border-t border-slate-50">
                                         <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Checklist</label>
                                         <select
                                           value={tempProductChecklists[product.id] || ''}
                                           onChange={(e) => setTempProductChecklists({
                                             ...tempProductChecklists,
                                             [product.id]: e.target.value
                                           })}
                                           disabled={hasForcedTypes}
                                           className="w-full text-xs border border-slate-200 rounded p-1.5 outline-none focus:border-blue-400 bg-slate-50"
                                         >
                                           <option value="">
                                             {product.checklistTemplate 
                                               ? `Padrão (${product.checklistTemplate.name})` 
                                               : 'Checklist Padrão'}
                                           </option>
                                           {checklistTemplates.map(t => (
                                             <option key={t.id} value={t.id}>{t.name}</option>
                                           ))}
                                         </select>

                                         <div className="mt-2 grid grid-cols-3 gap-2">
                                           <label className="flex items-center gap-2 text-[11px] font-bold text-[color:var(--color-muted)]">
                                             <input
                                               type="checkbox"
                                               checked={stockCountChecked}
                                               onChange={(e) => {
                                                 const checked = e.target.checked;
                                                 setTempProductChecklistTypes(prev => {
                                                   const curr = prev[product.id] || [];
                                                   const set = new Set(curr.map(x => String(x).toUpperCase()));
                                                   if (checked) set.add('STOCK_COUNT');
                                                   else set.delete('STOCK_COUNT');
                                                   const nextArr = Array.from(set);
                                                   if (nextArr.length === 0) {
                                                     const next = { ...prev };
                                                     delete next[product.id];
                                                     return next;
                                                   }
                                                   return { ...prev, [product.id]: nextArr };
                                                 });
                                               }}
                                               className="w-4 h-4"
                                             />
                                             Contagem
                                           </label>

                                           <label className="flex items-center gap-2 text-[11px] font-bold text-[color:var(--color-muted)]">
                                             <input
                                               type="checkbox"
                                               checked={validityChecked}
                                               onChange={(e) => {
                                                 const checked = e.target.checked;
                                                 setTempProductChecklistTypes(prev => {
                                                   const curr = prev[product.id] || [];
                                                   const set = new Set(curr.map(x => String(x).toUpperCase()));
                                                   if (checked) set.add('VALIDITY_CHECK');
                                                   else set.delete('VALIDITY_CHECK');
                                                   const nextArr = Array.from(set);
                                                   if (nextArr.length === 0) {
                                                     const next = { ...prev };
                                                     delete next[product.id];
                                                     return next;
                                                   }
                                                   return { ...prev, [product.id]: nextArr };
                                                 });
                                               }}
                                               className="w-4 h-4"
                                             />
                                             Validade
                                           </label>

                                           <label className="flex items-center gap-2 text-[11px] font-bold text-[color:var(--color-muted)]">
                                             <input
                                               type="checkbox"
                                               checked={stockPhotosChecked}
                                               onChange={(e) => {
                                                 const checked = e.target.checked;
                                                 setTempProductRequiresStockPhotos(prev => {
                                                   const next = { ...prev };
                                                   if (!checked) {
                                                     delete next[product.id];
                                                     return next;
                                                   }
                                                   next[product.id] = true;
                                                   return next;
                                                 });
                                               }}
                                               className="w-4 h-4"
                                             />
                                             Foto Estoque
                                           </label>
                                         </div>
                                    </div>
                                </div>
                              );
                             })}
                             {tempSelectedProducts.length === 0 && (
                                 <div className="text-center py-8 text-slate-400 text-xs">
                                     Nenhum produto selecionado.
                                 </div>
                             )}
                        </div>
                      </div>
                   </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
              <button onClick={() => {
                setShowProductModal(false);
                setSelectedClientForModal(null);
              }} className="px-4 py-2 rounded-lg font-bold text-[color:var(--color-muted)] hover:bg-slate-100 text-sm">Cancelar</button>
              <button 
                onClick={handleSaveProductSelection}
                className="px-4 py-2 rounded-lg font-bold text-white shadow-lg text-sm"
                style={{ backgroundColor: settings.primaryColor }}
              >
                Confirmar ({tempSelectedProducts.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Template Modal */}
      {showSaveTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-[color:var(--color-text)] mb-4">Salvar como Modelo</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[color:var(--color-muted)] block mb-1">Nome do Modelo</label>
                <input 
                  type="text" 
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  placeholder="Ex: Rota Segunda-feira Zona Sul"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none font-bold"
                />
              </div>
              <div className="flex gap-3 justify-end pt-4">
                <button onClick={() => setShowSaveTemplateModal(false)} className="px-6 py-2 rounded-lg font-bold text-[color:var(--color-muted)] hover:bg-slate-100">Cancelar</button>
                <button 
                  onClick={handleSaveTemplate}
                  disabled={!templateName}
                  className="px-6 py-2 rounded-lg font-bold text-white shadow-lg disabled:opacity-50"
                  style={{ backgroundColor: settings.primaryColor }}
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manage Promoters Modal */}
      {managingPromotersRoute && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-[color:var(--color-text)] mb-4">Gerenciar Promotores</h3>
            <div className="space-y-4">
              <p className="text-sm text-[color:var(--color-muted)]">
                Adicione ou remova promotores para esta rota em execução.
              </p>
              
              <div className="h-64 overflow-y-auto space-y-2 pr-2 border border-slate-100 rounded-xl p-2">
                  {promoters
                    .map(promoter => {
                      const isSelected = managedPromoterIds.includes(promoter.id);
                      return (
                        <button 
                          key={promoter.id}
                          onClick={() => handleToggleManagedPromoter(promoter.id)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                              : 'bg-white border border-slate-100 hover:bg-slate-50 text-[color:var(--color-muted)]'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-[color:var(--color-muted)]'
                          }`}>
                            {promoter.name.charAt(0)}
                          </div>
                          <div className="text-left">
                            <p className="font-bold">{promoter.name}</p>
                            <p className={`text-xs ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                              {promoter.email}
                            </p>
                          </div>
                          {isSelected && (
                            <div className="ml-auto">
                              <CheckCircle size={20} className="text-white" />
                            </div>
                          )}
                        </button>
                      );
                    })}
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button onClick={() => {
                  setManagingPromotersRoute(null);
                  setManagedPromoterIds([]);
                }} className="px-6 py-2 rounded-lg font-bold text-[color:var(--color-muted)] hover:bg-slate-100">Cancelar</button>
                <button 
                  onClick={handleSaveManagedPromoters}
                  className="px-6 py-2 rounded-lg font-bold text-white shadow-lg"
                  style={{ backgroundColor: settings.primaryColor }}
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDayModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-[color:var(--color-text)]">Agenda de {new Date(dayModalDate + 'T00:00:00').toLocaleDateString('pt-BR')}</h3>
              <button onClick={() => setShowDayModal(false)} className="px-3 py-1 rounded-lg font-bold text-[color:var(--color-muted)] hover:bg-slate-100">Fechar</button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-2">
              {dayModalEntries.length === 0 ? (
                <div className="text-sm text-slate-400">Sem rotas para este dia.</div>
              ) : dayModalEntries.map((entry, idx) => {
                const promoterText = entry.promoters && entry.promoters.length > 0 ? entry.promoters.join(', ') : 'Sem promotor';
                return (
                  <div key={idx} className="border border-slate-200 rounded-xl p-3 bg-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold text-[color:var(--color-text)]">{entry.pdvName}</div>
                        <div className="text-xs text-[color:var(--color-muted)]">{entry.clientsCount} cliente(s) • {promoterText}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => { setShowDayModal(false); handleEditRoute(entry.route); }} 
                          className="px-3 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100"
                        >
                          Editar
                        </button>
                        <button 
                          onClick={() => { setShowDayModal(false); setRouteToDuplicate(entry.route); setShowDuplicateModal(true); }} 
                          className="px-3 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100"
                        >
                          Duplicar
                        </button>
                        <button 
                          onClick={() => { 
                            setShowDayModal(false); 
                            handleManagePromoters(entry.route); 
                          }} 
                          className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 hover:bg-emerald-100"
                        >
                          Transferir Promotor
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Route Modal */}
      {showDuplicateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-[color:var(--color-text)] mb-4">Duplicar Rota</h3>
            <div className="space-y-4">
              <p className="text-sm text-[color:var(--color-muted)]">
                Duplicando rota de <b>{routeToDuplicate?.promoter?.name}</b> do dia <b>{new Date(routeToDuplicate?.date).toLocaleDateString()}</b>.
              </p>
              <div>
                <label className="text-xs font-bold text-[color:var(--color-muted)] block mb-2">Adicionar Dias</label>
                
                <div className="flex gap-2 mb-4">
                  <input 
                    type="date" 
                    value={currentDateInput}
                    onChange={e => setCurrentDateInput(e.target.value)}
                    className="flex-1 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none font-bold"
                  />
                  <button 
                    onClick={handleAddDate}
                    disabled={!currentDateInput}
                    className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold hover:bg-blue-100 disabled:opacity-50"
                  >
                    <Plus size={20} />
                  </button>
                </div>

                <div className="mt-4 border-t pt-4">
                  <label className="text-xs font-bold text-[color:var(--color-muted)] block mb-2">Recorrência por Dias da Semana</label>
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {[
                      { d:1, label:'Seg' }, { d:2, label:'Ter' }, { d:3, label:'Qua' }, { d:4, label:'Qui' },
                      { d:5, label:'Sex' }, { d:6, label:'Sab' }, { d:0, label:'Dom' },
                    ].map(({ d, label }) => (
                      <button
                        key={d}
                        onClick={() => handleToggleWeekday(d)}
                        className={`px-3 py-2 rounded-lg border text-sm ${recurrenceWeekdays[d] ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-200 text-[color:var(--color-muted)]'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2 items-center">
                    <label className="text-xs font-bold text-[color:var(--color-muted)]">Por quantos meses?</label>
                    <input 
                      type="number" 
                      min={1}
                      value={recurrenceMonths}
                      onChange={e => setRecurrenceMonths(parseInt(e.target.value || '1', 10))}
                      className="w-20 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                    />
                    <button 
                      onClick={handleGenerateRecurrence}
                      className="flex-1 py-2 bg-emerald-50 text-emerald-600 rounded-xl font-bold hover:bg-emerald-100 flex items-center justify-center gap-2 border border-emerald-100"
                    >
                      <Copy size={16} />
                      Gerar Datas
                    </button>
                  </div>
                </div>

                <button 
                    onClick={() => {
                        if (!routeToDuplicate) return;
                        const sourceDate = new Date(routeToDuplicate.date);
                        const dates = [];
                        let current = new Date(sourceDate);
                        // Generate for next 4 weeks
                        for (let i = 0; i < 4; i++) {
                            current.setDate(current.getDate() + 7);
                            dates.push(formatDateYMD(current));
                        }
                        const newDates = dates.filter(d => !duplicateTargetDates.includes(d));
                        setDuplicateTargetDates([...duplicateTargetDates, ...newDates]);
                    }}
                    className="w-full py-3 bg-indigo-50 text-indigo-600 rounded-xl font-bold hover:bg-indigo-100 flex items-center justify-center gap-2 border border-indigo-100 mb-2"
                >
                    <Copy size={16} />
                    Repetir nas Próximas 4 Semanas
                </button>
              </div>

              {duplicateTargetDates.length > 0 && (
                <div className="bg-slate-50 rounded-xl p-3 max-h-40 overflow-y-auto space-y-2">
                  <p className="text-xs font-bold text-slate-400 mb-2">Dias Selecionados ({duplicateTargetDates.length})</p>
                  {duplicateTargetDates.map(date => (
                    <div key={date} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                      <span className="text-sm font-bold text-[color:var(--color-text)]">
                        {new Date(date + 'T12:00:00').toLocaleDateString()}
                      </span>
                      <button 
                        onClick={() => handleRemoveDate(date)}
                        className="text-red-400 hover:text-red-600 p-1"
                      >
                        <XCircle size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 justify-end pt-4">
                <button onClick={() => {
                  setShowDuplicateModal(false);
                  setRouteToDuplicate(null);
                  setDuplicateTargetDates([]);
                  setCurrentDateInput('');
                }} className="px-6 py-2 rounded-lg font-bold text-[color:var(--color-muted)] hover:bg-slate-100">Cancelar</button>
                <button 
                  onClick={handleDuplicateRoute}
                  disabled={duplicateTargetDates.length === 0}
                  className="px-6 py-2 rounded-lg font-bold text-white shadow-lg disabled:opacity-50"
                  style={{ backgroundColor: settings.primaryColor }}
                >
                  Duplicar ({duplicateTargetDates.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {showWeeklyModal && !showProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-xl font-bold text-[color:var(--color-text)]">Criar Rotas por Semana</h3>
              <button onClick={() => { setShowWeeklyModal(false); }} className="px-3 py-1 rounded-lg font-bold text-[color:var(--color-muted)] hover:bg-slate-100">Fechar</button>
            </div>
            <div className="px-6 pt-4">
              <div className="flex items-center gap-2 text-xs font-bold text-[color:var(--color-muted)]">
                <div className={`px-2 py-1 rounded-lg border ${weeklyWizardStep === 1 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200'}`}>1. Cliente</div>
                <div className={`px-2 py-1 rounded-lg border ${weeklyWizardStep === 2 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200'}`}>2. Promotor</div>
                <div className={`px-2 py-1 rounded-lg border ${weeklyWizardStep === 3 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200'}`}>3. Agenda</div>
                <div className={`px-2 py-1 rounded-lg border ${weeklyWizardStep === 4 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200'}`}>4. PDVs</div>
              </div>
            </div>

            <div className="p-6 max-h-[75vh] overflow-y-auto">
              {weeklyWizardStep === 1 && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="text-xs font-bold text-[color:var(--color-muted)] block mb-1">Cliente</label>
                      <select
                        value={weeklyClientId}
                        onChange={(e) => {
                          const clientId = e.target.value;
                          setWeeklyClientId(clientId);
                          setSelectedPromoters([]);
                          setRouteItems([]);
                          setWeeklyChecklistOverrides({});

                          const client = clients.find((c: any) => c.id === clientId);
                          const clientBrands = getBrandsForClient(clientId);
                          if (clientBrands.length === 1) {
                            const b = clientBrands[0];
                            setWeeklyBrandId(b.id);
                            setWeeklyChecklistTemplateId(b?.checklistTemplateId || client?.defaultVisitChecklistTemplateId || '');
                            setWeeklyWeekdays(buildWeekdaysFromBrand(b));
                          } else {
                            setWeeklyBrandId('');
                            setWeeklyChecklistTemplateId(client?.defaultVisitChecklistTemplateId || '');
                          }
                        }}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      >
                        <option value="">Selecione...</option>
                        {[...clients]
                          .sort((a: any, b: any) => getClientDisplayName(a).localeCompare(getClientDisplayName(b), 'pt-BR'))
                          .map((c: any) => (
                            <option key={c.id} value={c.id}>{getClientDisplayName(c)}</option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-[color:var(--color-muted)] block mb-1">Marca (do cliente)</label>
                      <select
                        value={weeklyBrandId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setWeeklyBrandId(val);
                          const client = clients.find((c: any) => c.id === weeklyClientId);
                          const b = brands.find((x: any) => x.id === val);
                          setWeeklyChecklistTemplateId(b?.checklistTemplateId || client?.defaultVisitChecklistTemplateId || '');
                          setWeeklyWeekdays(buildWeekdaysFromBrand(b));
                          setSelectedPromoters([]);
                          setRouteItems([]);
                          setWeeklyChecklistOverrides({});
                        }}
                        disabled={!weeklyClientId}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm disabled:bg-slate-50"
                      >
                        <option value="">Selecione...</option>
                        {getBrandsForClient(weeklyClientId).map((b: any) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-[color:var(--color-muted)] block mb-1">Checklist (padrão)</label>
                      <select
                        value={weeklyChecklistTemplateId}
                        onChange={(e) => setWeeklyChecklistTemplateId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      >
                        <option value="">(Auto)</option>
                        {checklistTemplates.map((t: any) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {weeklyWizardStep === 2 && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-[color:var(--color-muted)] block mb-1">Supervisor</label>
                      <select
                        value={weeklySupervisorId}
                        onChange={(e) => setWeeklySupervisorId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      >
                        <option value="">Todos</option>
                        {allEmployees
                          .filter(e => e.role && (
                            e.role.name.toLowerCase().includes('supervisor') ||
                            e.role.name.toLowerCase().includes('gerente')
                          ))
                          .map(s => (
                            <option key={s.id} value={s.id}>{s.fullName || s.name}</option>
                          ))
                        }
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-[color:var(--color-muted)] block mb-1">Buscar</label>
                      <input
                        type="text"
                        placeholder="Buscar promotor..."
                        value={promoterSearch}
                        onChange={(e) => setPromoterSearch(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-[color:var(--color-text)] mb-2">Promotores (vinculados ao cliente)</label>
                    <div className="h-72 overflow-y-auto space-y-2 pr-2 border border-slate-100 rounded-xl p-2">
                      {promoters
                        .filter(p => {
                          const matchesSearch = p.name.toLowerCase().includes(promoterSearch.toLowerCase());
                          if (!matchesSearch) return false;
                          if (weeklyBrandId) {
                            const brand = brands.find((b: any) => b.id === weeklyBrandId);
                            const allowed = new Set((brand?.promoters || []).map((x: any) => x.id));
                            if (allowed.size > 0 && !allowed.has(p.id)) return false;
                          }
                          if (!weeklySupervisorId) return true;
                          const full = allEmployees.find(e => e.id === p.id);
                          return full && (full.supervisorId === weeklySupervisorId || (full.supervisor && full.supervisor.id === weeklySupervisorId));
                        })
                        .map(promoter => {
                          const isSelected = selectedPromoters.includes(promoter.id);
                          return (
                            <button
                              key={promoter.id}
                              onClick={() => handleTogglePromoter(promoter.id)}
                              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${isSelected ? 'bg-blue-600 text-white' : 'bg-white border border-slate-100 text-[color:var(--color-muted)]'}`}
                            >
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-[color:var(--color-muted)]'}`}>
                                {promoter.name.charAt(0)}
                              </div>
                              <div className="text-left">
                                <p className="text-sm font-bold">{promoter.name}</p>
                                <p className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>{promoter.email}</p>
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                </div>
              )}

              {weeklyWizardStep === 3 && (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6">
                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-bold text-[color:var(--color-text)] mb-2">Dias da Semana</label>
                      <div className="flex flex-wrap gap-2">
                        {[{d:1,t:'Seg'},{d:2,t:'Ter'},{d:3,t:'Qua'},{d:4,t:'Qui'},{d:5,t:'Sex'},{d:6,t:'Sáb'},{d:0,t:'Dom'}].map(({d,t}) => (
                          <button
                            key={d}
                            onClick={() => toggleWeeklyDay(d)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold ${weeklyWeekdays[d] ? 'bg-blue-600 text-white' : 'bg-slate-100 text-[color:var(--color-muted)]'}`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="text-xs font-bold text-[color:var(--color-muted)] block mb-1">Tipo de Recorrência</label>
                        <select
                          value={weeklyRecurrenceType}
                          onChange={(e) => setWeeklyRecurrenceType(e.target.value as 'weeks' | 'months')}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
                        >
                          <option value="weeks">Semanas</option>
                          <option value="months">Meses</option>
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="text-xs font-bold text-[color:var(--color-muted)] block mb-1">Quantidade</label>
                        <input
                          type="number"
                          min={1}
                          value={weeklyWeeks}
                          onChange={(e) => setWeeklyWeeks(parseInt(e.target.value || '1', 10))}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                        />
                      </div>
                    </div>

                    {weeklyBrandId && (() => {
                      const b = brands.find((x: any) => x.id === weeklyBrandId);
                      const windows = Array.isArray(b?.availabilityWindows) ? b.availabilityWindows : [];
                      const activeWindows = windows.filter((w: any) => w && w.active !== false);
                      if (!b || activeWindows.length === 0) return null;
                      return (
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                          <div className="text-xs font-black text-[color:var(--color-muted)] uppercase mb-2">Horários do Cliente</div>
                          <div className="space-y-1 text-sm">
                            {activeWindows
                              .sort((a: any, b: any) => Number(a.dayOfWeek) - Number(b.dayOfWeek))
                              .map((w: any) => (
                                <div key={`${w.dayOfWeek}-${w.startTime}-${w.endTime}`} className="flex items-center justify-between">
                                  <span className="font-bold text-[color:var(--color-text)]">{['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][Number(w.dayOfWeek)]}</span>
                                  <span className="text-[color:var(--color-muted)]">{String(w.startTime)} - {String(w.endTime)}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="space-y-4">
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-black text-[color:var(--color-muted)] uppercase">Datas Geradas</div>
                        <button
                          onClick={() => setWeeklyChecklistOverrides({})}
                          className="text-xs font-bold text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]"
                        >
                          Limpar Overrides
                        </button>
                      </div>
                      {(() => {
                        const previewDates = generateWeeklyDates();
                        if (previewDates.length === 0) {
                          return <div className="text-sm text-slate-400">Selecione os dias para ver as datas.</div>;
                        }
                        return (
                          <div className="max-h-72 overflow-y-auto space-y-2">
                            {previewDates.slice(0, 90).map((d) => (
                              <div key={d} className="bg-white border border-slate-100 rounded-lg p-2">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-sm font-bold text-[color:var(--color-text)]">
                                    {new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')}
                                  </div>
                                  <div className="w-64">
                                    <select
                                      value={weeklyChecklistOverrides[d] || ''}
                                      onChange={(e) => setWeeklyChecklistOverrides(prev => ({ ...prev, [d]: e.target.value }))}
                                      className="w-full px-2 py-1 border border-slate-200 rounded-lg text-xs bg-slate-50"
                                    >
                                      <option value="">Padrão</option>
                                      {checklistTemplates.map((t: any) => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              </div>
                            ))}
                            {previewDates.length > 90 && (
                              <div className="text-xs text-slate-400">
                                Mostrando 90 datas (o restante será criado normalmente).
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs font-bold text-[color:var(--color-muted)]">Promotores Selecionados</div>
                      <div className="text-sm">{selectedPromoters.length} promotor(es)</div>
                      <div className="text-xs font-bold text-[color:var(--color-muted)]">Dias Selecionados</div>
                      <div className="text-sm">
                        {Object.entries(weeklyWeekdays).filter(([,v])=>v).map(([d]) => ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][parseInt(d,10)]).join(', ') || 'Nenhum'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {weeklyWizardStep === 4 && (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-bold text-[color:var(--color-text)] mb-2">Adicionar PDVs</label>
                      <div className="mb-2">
                        <input
                          type="text"
                          placeholder="Buscar supermercado..."
                          value={supermarketSearch}
                          onChange={(e) => setSupermarketSearch(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                        />
                      </div>
                      <div className="h-56 overflow-y-auto space-y-2 pr-2 border border-slate-100 rounded-xl p-2">
                        {supermarkets
                          .filter(s =>
                            (s.fantasyName || '').toLowerCase().includes(supermarketSearch.toLowerCase()) ||
                            (s.city || '').toLowerCase().includes(supermarketSearch.toLowerCase())
                          )
                          .filter(s => {
                            if (!weeklyBrandId) return true;
                            const brand = brands.find((b: any) => b.id === weeklyBrandId);
                            const allowed = new Set((brand?.supermarkets || []).map((x: any) => x.id));
                            if (allowed.size === 0) return true;
                            return allowed.has(s.id);
                          })
                          .map(s => (
                            <button
                              key={s.id}
                              onClick={() => handleAddSupermarket(s.id)}
                              disabled={!!routeItems.find(i => i.supermarketId === s.id)}
                              className="w-full flex justify-between items-center p-3 rounded-xl hover:bg-slate-50 border border-slate-100 disabled:opacity-50 text-left"
                            >
                              <div>
                                <p className="text-sm font-bold text-[color:var(--color-text)]">{s.fantasyName}</p>
                                <p className="text-[10px] text-slate-400">{s.city}</p>
                              </div>
                              <Plus size={16} className="text-slate-400" />
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-bold text-[color:var(--color-text)]">PDVs Selecionados</label>
                      <div className="space-y-2 max-h-64 overflow-y-auto border border-slate-100 rounded-xl p-2">
                        {routeItems.length === 0 ? (
                          <div className="text-center py-6 text-slate-400 text-sm">Nenhum PDV selecionado</div>
                        ) : routeItems.map((item, index) => (
                          <div key={item.supermarketId} className="border border-slate-100 rounded-xl p-3 bg-white">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-sm font-bold text-[color:var(--color-text)]">{item.supermarket?.fantasyName || 'PDV'}</div>
                                <div className="text-[10px] text-slate-400">{item.supermarket?.city}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button onClick={() => handleOpenProductModal(index)} className="px-3 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100">Produtos</button>
                                <button onClick={() => handleRemoveItem(index)} className="px-3 py-1 rounded-lg text-xs font-bold bg-red-50 text-red-700 border border-red-100 hover:bg-red-100">Remover</button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              <div>
                                <label className="text-[10px] font-bold text-[color:var(--color-muted)] block mb-1">Início</label>
                                <input
                                  type="time"
                                  value={item.startTime || ''}
                                  onChange={(e) => handleUpdateItem(index, 'startTime', e.target.value)}
                                  className="w-full px-2 py-1 rounded-lg border border-slate-200 text-xs"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-[color:var(--color-muted)] block mb-1">Fim</label>
                                <input
                                  type="time"
                                  value={item.endTime || ''}
                                  onChange={(e) => handleUpdateItem(index, 'endTime', e.target.value)}
                                  className="w-full px-2 py-1 rounded-lg border border-slate-200 text-xs"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs font-bold text-[color:var(--color-muted)]">Promotores Selecionados</div>
                      <div className="text-sm">{selectedPromoters.length} promotor(es)</div>
                      <div className="text-xs font-bold text-[color:var(--color-muted)]">PDVs Selecionados</div>
                      <div className="text-sm">{routeItems.length} PDV(s)</div>
                      <div className="text-xs font-bold text-[color:var(--color-muted)]">Datas (prévia)</div>
                      <div className="text-sm">{generateWeeklyDates().length} dia(s)</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-between px-6 py-4 border-t border-slate-200">
              <button
                onClick={() => { setShowWeeklyModal(false); }}
                className="px-6 py-2 rounded-lg font-bold text-[color:var(--color-muted)] hover:bg-slate-100"
              >
                Cancelar
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setWeeklyWizardStep((s) => Math.max(1, s - 1))}
                  disabled={weeklyWizardStep === 1}
                  className="px-6 py-2 rounded-lg font-bold text-[color:var(--color-muted)] hover:bg-slate-100 disabled:opacity-50"
                >
                  Voltar
                </button>
                {weeklyWizardStep < 4 ? (
                  <button
                    onClick={() => setWeeklyWizardStep((s) => Math.min(4, s + 1))}
                    disabled={
                      (weeklyWizardStep === 1 && (!weeklyClientId || (getBrandsForClient(weeklyClientId).length > 0 && !weeklyBrandId))) ||
                      (weeklyWizardStep === 2 && selectedPromoters.length === 0) ||
                      (weeklyWizardStep === 3 && generateWeeklyDates().length === 0)
                    }
                    className="px-6 py-2 rounded-lg font-bold text-white disabled:opacity-50"
                    style={{ backgroundColor: settings.primaryColor }}
                  >
                    Próximo
                  </button>
                ) : (
                  <button
                    onClick={handleCreateWeeklyRoutes}
                    disabled={selectedPromoters.length === 0 || routeItems.length === 0 || generateWeeklyDates().length === 0}
                    className="px-6 py-2 rounded-lg font-bold text-white disabled:opacity-50"
                    style={{ backgroundColor: settings.primaryColor }}
                  >
                    {editingRecurrenceGroup ? 'Atualizar Série' : 'Criar Rotas'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showCalendarModal && !showProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
          <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-xl font-bold text-[color:var(--color-text)]">Criar Rotas por Calendário</h3>
              <button
                onClick={() => {
                  setShowCalendarModal(false);
                  setCalendarSelectedDates([]);
                }}
                className="px-3 py-1 rounded-lg font-bold text-[color:var(--color-muted)] hover:bg-slate-100"
              >
                Fechar
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6 p-6 max-h-[75vh] overflow-y-auto">
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="text-xs font-bold text-[color:var(--color-muted)] block mb-1">Marca</label>
                    <select
                      value={editorBrandId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditorBrandId(val);
                        const b = brands.find((x: any) => x.id === val);
                        setEditorChecklistTemplateId(b?.checklistTemplateId || '');
                        setSelectedPromoters([]);
                        setRouteItems([]);
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    >
                      <option value="">(Opcional) Sem marca</option>
                      {brands.map((b: any) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[color:var(--color-muted)] block mb-1">Checklist (padrão da marca)</label>
                    <select
                      value={editorChecklistTemplateId}
                      onChange={(e) => setEditorChecklistTemplateId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                    >
                      <option value="">(Auto)</option>
                      {checklistTemplates.map((t: any) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-[color:var(--color-text)] mb-2">Promotores</label>
                  <div className="mb-2">
                    <input
                      type="text"
                      placeholder="Buscar promotor..."
                      value={promoterSearch}
                      onChange={(e) => setPromoterSearch(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="h-44 overflow-y-auto space-y-2 pr-2 border border-slate-100 rounded-xl p-2">
                    {promoters
                      .filter(p => {
                        const matchesSearch = p.name.toLowerCase().includes(promoterSearch.toLowerCase());
                        if (!matchesSearch) return false;
                        if (editorBrandId) {
                          const brand = brands.find((b: any) => b.id === editorBrandId);
                          const allowed = new Set((brand?.promoters || []).map((x: any) => x.id));
                          if (allowed.size > 0 && !allowed.has(p.id)) return false;
                        }
                        return true;
                      })
                      .map(promoter => {
                        const isSelected = selectedPromoters.includes(promoter.id);
                        return (
                          <button
                            key={promoter.id}
                            onClick={() => handleTogglePromoter(promoter.id)}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${isSelected ? 'bg-blue-600 text-white' : 'bg-white border border-slate-100 text-[color:var(--color-muted)]'}`}
                          >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-[color:var(--color-muted)]'}`}>
                              {promoter.name.charAt(0)}
                            </div>
                            <div className="text-left">
                              <p className="text-sm font-bold">{promoter.name}</p>
                              <p className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>{promoter.email}</p>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-[color:var(--color-text)] mb-2">Adicionar PDVs</label>
                  <div className="mb-2">
                    <input
                      type="text"
                      placeholder="Buscar supermercado..."
                      value={supermarketSearch}
                      onChange={(e) => setSupermarketSearch(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="h-44 overflow-y-auto space-y-2 pr-2 border border-slate-100 rounded-xl p-2">
                    {supermarkets
                      .filter(s =>
                        (s.fantasyName || '').toLowerCase().includes(supermarketSearch.toLowerCase()) ||
                        (s.city || '').toLowerCase().includes(supermarketSearch.toLowerCase())
                      )
                      .filter(s => {
                        if (!editorBrandId) return true;
                        const brand = brands.find((b: any) => b.id === editorBrandId);
                        const allowed = new Set((brand?.supermarkets || []).map((x: any) => x.id));
                        if (allowed.size === 0) return true;
                        return allowed.has(s.id);
                      })
                      .map(s => (
                        <button
                          key={s.id}
                          onClick={() => handleAddSupermarket(s.id)}
                          disabled={!!routeItems.find(i => i.supermarketId === s.id)}
                          className="w-full flex justify-between items-center p-3 rounded-xl hover:bg-slate-50 border border-slate-100 disabled:opacity-50 text-left"
                        >
                          <div>
                            <p className="text-sm font-bold text-[color:var(--color-text)]">{s.fantasyName}</p>
                            <p className="text-[10px] text-slate-400">{s.city}</p>
                          </div>
                          <Plus size={16} className="text-slate-400" />
                        </button>
                      ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-[color:var(--color-text)]">PDVs Selecionados</label>
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-100 rounded-xl p-2">
                    {routeItems.length === 0 ? (
                      <div className="text-center py-6 text-slate-400 text-sm">Nenhum PDV selecionado</div>
                    ) : routeItems.map((item, index) => (
                      <div key={item.supermarketId} className="border border-slate-100 rounded-xl p-3 bg-white">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-bold text-[color:var(--color-text)]">{item.supermarket?.fantasyName || 'PDV'}</div>
                            <div className="text-[10px] text-slate-400">{item.supermarket?.city}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleOpenProductModal(index)} className="px-3 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100">Produtos</button>
                            <button onClick={() => handleRemoveItem(index)} className="px-3 py-1 rounded-lg text-xs font-bold bg-red-50 text-red-700 border border-red-100 hover:bg-red-100">Remover</button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div>
                            <label className="text-[10px] font-bold text-[color:var(--color-muted)] block mb-1">Início</label>
                            <input
                              type="time"
                              value={item.startTime || ''}
                              onChange={(e) => handleUpdateItem(index, 'startTime', e.target.value)}
                              className="w-full px-2 py-1 rounded-lg border border-slate-200 text-xs"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-[color:var(--color-muted)] block mb-1">Fim</label>
                            <input
                              type="time"
                              value={item.endTime || ''}
                              onChange={(e) => handleUpdateItem(index, 'endTime', e.target.value)}
                              className="w-full px-2 py-1 rounded-lg border border-slate-200 text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-[color:var(--color-text)]">
                    {calendarMonth.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                      className="px-3 py-2 border rounded-lg text-sm"
                    >
                      ◀
                    </button>
                    <button
                      onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                      className="px-3 py-2 border rounded-lg text-sm"
                    >
                      ▶
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {['Dom','Seg','Ter','Qua','Qui','Sex','Sab'].map(d => (
                    <div key={d} className="text-[11px] text-slate-400 text-center font-bold">{d}</div>
                  ))}
                  {(() => {
                    const days = getMonthDays(calendarMonth);
                    const startWeekday = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay();
                    const blanks = Array.from({ length: startWeekday }).map((_, i) => <div key={`cb-${i}`} />);
                    return [
                      ...blanks,
                      ...days.map(day => {
                        const dateStr = formatDateYMD(day);
                        const isSelected = calendarSelectedDates.includes(dateStr);
                        return (
                          <button
                            key={dateStr}
                            onClick={() => toggleSelectCalendarDate(day)}
                            className={`border rounded-lg p-2 text-center text-sm font-bold transition ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-[color:var(--color-text)] hover:border-blue-300'}`}
                            title={day.toLocaleDateString('pt-BR')}
                          >
                            {day.getDate()}
                          </button>
                        );
                      })
                    ];
                  })()}
                </div>

                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-black text-[color:var(--color-muted)] uppercase">Datas Selecionadas</div>
                    <button
                      onClick={() => setCalendarSelectedDates([])}
                      className="text-xs font-bold text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]"
                    >
                      Limpar
                    </button>
                  </div>
                  {calendarSelectedDates.length === 0 ? (
                    <div className="text-sm text-slate-400">Nenhuma data selecionada</div>
                  ) : (
                    <div className="max-h-40 overflow-y-auto space-y-2">
                      {[...calendarSelectedDates]
                        .sort()
                        .map(d => (
                          <div key={d} className="flex items-center justify-between bg-white p-2 rounded-lg border border-slate-100">
                            <span className="text-sm font-bold text-[color:var(--color-text)]">{new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                            <button onClick={() => setCalendarSelectedDates(prev => prev.filter(x => x !== d))} className="text-red-400 hover:text-red-600 p-1">
                              <XCircle size={16} />
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-bold text-[color:var(--color-muted)]">Promotores Selecionados</div>
                  <div className="text-sm">{selectedPromoters.length} promotor(es)</div>
                  <div className="text-xs font-bold text-[color:var(--color-muted)]">PDVs Selecionados</div>
                  <div className="text-sm">{routeItems.length} PDV(s)</div>
                  <div className="text-xs font-bold text-[color:var(--color-muted)]">Datas Selecionadas</div>
                  <div className="text-sm">{calendarSelectedDates.length} dia(s)</div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end px-6 py-4 border-t border-slate-200">
              <button
                onClick={() => {
                  setShowCalendarModal(false);
                  setCalendarSelectedDates([]);
                }}
                className="px-6 py-2 rounded-lg font-bold text-[color:var(--color-muted)] hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateCalendarRoutes}
                className="px-6 py-2 rounded-lg font-bold text-white"
                style={{ backgroundColor: settings.primaryColor }}
              >
                Criar Rotas ({calendarSelectedDates.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {showRecurrenceChoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95">
            <h3 className="text-xl font-black text-[color:var(--color-text)] mb-2">Editar Rota Recorrente</h3>
            <p className="text-[color:var(--color-muted)] mb-6">
              Esta rota faz parte de uma série recorrente. Você deseja editar apenas esta rota específica ou todas as rotas futuras desta série?
            </p>
            
            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleRecurrenceOption('single')}
                className="w-full py-3 px-4 rounded-xl border-2 border-slate-200 font-bold text-[color:var(--color-muted)] hover:border-slate-300 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
              >
                <Calendar size={18} />
                Apenas Esta Rota {pendingRouteEdit?.date ? `(${new Date(pendingRouteEdit.date).toLocaleDateString('pt-BR')})` : ''}
              </button>
              
              <button
                onClick={() => handleRecurrenceOption('future')}
                className="w-full py-3 px-4 rounded-xl font-bold text-white shadow-lg shadow-blue-200 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                style={{ backgroundColor: settings.primaryColor }}
              >
                <List size={18} />
                Todas as Futuras (Série)
              </button>
              
              <button
                onClick={() => {
                  setShowRecurrenceChoiceModal(false);
                  setPendingRouteEdit(null);
                }}
                className="mt-2 text-sm font-bold text-slate-400 hover:text-[color:var(--color-muted)]"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoutesView;
