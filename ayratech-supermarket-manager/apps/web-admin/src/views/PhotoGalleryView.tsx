import React, { useState, useEffect, useMemo } from 'react';
import { useBranding } from '../context/BrandingContext';
import SectionHeader from '../components/SectionHeader';
import { 
  Image as ImageIcon,
  Calendar, 
  Filter, 
  User,
  Search,
  Grid,
  MapPin,
  Clock,
  X,
  ChevronRight
} from 'lucide-react';
import api from '../api/client';
import { getImageUrl } from '../utils/image';

interface RouteReportItem {
  id: string;
  date: string;
  status: string;
  promoter: {
    id: string;
    fullName: string;
    supervisor?: {
      id: string;
      fullName: string;
    };
  };
  items: Array<{
    id: string;
    status: string;
    checkInTime?: string;
    checkOutTime?: string;
    supermarket: {
      id: string;
      fantasyName: string;
      city?: string;
      state?: string;
    };
    categoryPhotos?: Record<string, string[] | string | { before?: string[] | string, after?: string[] | string }>;
    products: Array<{
      id: string;
      photos?: string[];
      product: {
        id: string;
        name: string;
        sku?: string;
        brand?: {
          name: string;
        };
      };
    }>;
  }>;
}

const PhotoGalleryView: React.FC = () => {
  const { settings } = useBranding();
  const [loading, setLoading] = useState(false);
  const [routes, setRoutes] = useState<RouteReportItem[]>([]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedVisit, setSelectedVisit] = useState<{route: RouteReportItem, item: RouteReportItem['items'][0]} | null>(null);
  
  // Gallery Filters
  const [galleryFilters, setGalleryFilters] = useState({
    pdv: '',
    promoter: '',
    supervisor: ''
  });

  useEffect(() => {
    fetchRoutes();
  }, [startDate, endDate]);

  const fetchRoutes = async () => {
    setLoading(true);
    try {
      const res = await api.get('/routes');
      const allRoutes: RouteReportItem[] = res.data;
      const filtered = allRoutes.filter(r => {
        const rDate = r.date.split('T')[0];
        return rDate >= startDate && rDate <= endDate;
      });
      setRoutes(filtered);
    } catch (err) {
      console.error('Error fetching routes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutes();
  }, [startDate, endDate]);
  const visitsWithPhotos = useMemo(() => {
    const visits: { route: RouteReportItem, item: RouteReportItem['items'][0], photoCount: number, previewPhotos: string[] }[] = [];

    routes.forEach(route => {
      route.items.forEach(item => {
        // Extract Product Photos
        const productPhotos = item.products.flatMap(p => p.photos || []);
        
        // Extract Category Photos
        const categoryPhotosRaw = Object.values(item.categoryPhotos || {});
        const categoryPhotos = categoryPhotosRaw.flatMap(photosData => {
            if (!photosData) return [];
            
            // Handle legacy string array or single string
            if (Array.isArray(photosData) || typeof photosData === 'string') {
                const list = Array.isArray(photosData) ? photosData : [photosData];
                return list.filter((p): p is string => typeof p === 'string');
            }
            
            // Handle structured object { before?: string[], after?: string[] }
            const structuredPhotos: string[] = [];
            if (typeof photosData === 'object') {
                const pd = photosData as any;
                if (pd.before) {
                    const beforeList = Array.isArray(pd.before) ? pd.before : [pd.before];
                    structuredPhotos.push(...beforeList.filter((p: any) => typeof p === 'string'));
                }
                if (pd.after) {
                    const afterList = Array.isArray(pd.after) ? pd.after : [pd.after];
                    structuredPhotos.push(...afterList.filter((p: any) => typeof p === 'string'));
                }
                if (pd.storage) {
                    const storageList = Array.isArray(pd.storage) ? pd.storage : [pd.storage];
                    structuredPhotos.push(...storageList.filter((p: any) => typeof p === 'string'));
                }
            }
            return structuredPhotos;
        });

        const itemPhotos = [...categoryPhotos, ...productPhotos];

        if (itemPhotos.length > 0) {
          // Check Filters
          if (galleryFilters.pdv && !item.supermarket.fantasyName?.toLowerCase()?.includes(galleryFilters.pdv.toLowerCase())) return;
          if (galleryFilters.promoter && !route.promoter?.fullName?.toLowerCase()?.includes(galleryFilters.promoter.toLowerCase())) return;
          if (galleryFilters.supervisor && !route.promoter?.supervisor?.fullName?.toLowerCase()?.includes(galleryFilters.supervisor.toLowerCase())) return;

          visits.push({
            route,
            item,
            photoCount: itemPhotos.length,
            previewPhotos: itemPhotos.slice(0, 4)
          });
        }
      });
    });

    return visits;
  }, [routes, galleryFilters]);

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8">
      <SectionHeader 
        icon={<ImageIcon className="text-blue-600" />}
        title="Galeria de Fotos por Visita"
        subtitle="Visualize as fotos agrupadas por visita ao PDV"
      />

      {/* Filters */}
      <div className="space-y-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-[color:var(--color-muted)]">
            <Filter size={20} />
            <span className="font-bold text-sm">Filtros:</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-400 uppercase">De</label>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[color:var(--color-text)] outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-400 uppercase">Até</label>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[color:var(--color-text)] outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              placeholder="Buscar PDV / Loja..." 
              value={galleryFilters.pdv}
              onChange={e => setGalleryFilters({...galleryFilters, pdv: e.target.value})}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div className="relative">
             <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
             <input 
              placeholder="Buscar Promotor..." 
              value={galleryFilters.promoter}
              onChange={e => setGalleryFilters({...galleryFilters, promoter: e.target.value})}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div className="relative">
             <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
             <input 
              placeholder="Buscar Supervisor..." 
              value={galleryFilters.supervisor}
              onChange={e => setGalleryFilters({...galleryFilters, supervisor: e.target.value})}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Visits Grid */}
      {loading ? (
        <div className="flex justify-center p-12">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {visitsWithPhotos.map((visit, i) => (
            <div 
              key={i} 
              onClick={() => setSelectedVisit(visit)}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-blue-200 transition-all cursor-pointer overflow-hidden group flex flex-col"
            >
              {/* Card Header */}
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex justify-between items-start mb-2">
                   <h3 className="font-bold text-[color:var(--color-text)] line-clamp-1" title={visit.item.supermarket.fantasyName}>
                     {visit.item.supermarket.fantasyName}
                   </h3>
                   <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-white px-2 py-1 rounded-full border border-slate-100">
                     <ImageIcon size={10} />
                     {visit.photoCount}
                   </span>
                </div>
                
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-[color:var(--color-muted)]">
                    <MapPin size={12} className="text-slate-400" />
                    <span className="truncate">{visit.item.supermarket.city || 'Cidade não inf.'} - {visit.item.supermarket.state || 'UF'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[color:var(--color-muted)]">
                    <Calendar size={12} className="text-slate-400" />
                    <span>{new Date(visit.route.date).toLocaleDateString('pt-BR')}</span>
                    {visit.item.checkInTime && (
                      <>
                        <span className="text-slate-300">|</span>
                        <Clock size={12} className="text-slate-400" />
                        <span>{new Date(visit.item.checkInTime).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[color:var(--color-muted)]">
                    <User size={12} className="text-slate-400" />
                    <span className="truncate">{visit.route.promoter?.fullName || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Preview Grid */}
              <div className="p-2 grid grid-cols-2 gap-1.5 bg-slate-50/30 flex-1 content-start">
                {visit.previewPhotos.map((url, idx) => (
                  <div key={idx} className="aspect-square rounded-lg overflow-hidden border border-slate-100 relative">
                    <img src={getImageUrl(url)} className="w-full h-full object-cover" alt="" />
                    {idx === 3 && visit.photoCount > 4 && (
                      <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center text-white font-bold text-sm">
                        +{visit.photoCount - 4}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="p-3 border-t border-slate-100 flex justify-center text-blue-600 text-xs font-bold group-hover:bg-blue-50 transition-colors">
                Ver Detalhes e Fotos
              </div>
            </div>
          ))}
          
          {visitsWithPhotos.length === 0 && (
              <div className="col-span-full p-12 text-center text-slate-400 flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-300">
                  <ImageIcon size={32} />
                </div>
                <p>Nenhuma visita com fotos encontrada para os filtros selecionados.</p>
              </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {selectedVisit && (
        <div className="fixed inset-0 bg-slate-900/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-6xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
              <div>
                <h2 className="text-2xl font-black text-[color:var(--color-text)]">{selectedVisit.item.supermarket.fantasyName}</h2>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-[color:var(--color-muted)]">
                  <span className="flex items-center gap-1.5">
                    <Calendar size={14} />
                    {new Date(selectedVisit.route.date).toLocaleDateString('pt-BR')}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <User size={14} />
                    Promotor: <strong className="text-[color:var(--color-text)]">{selectedVisit.route.promoter?.fullName || 'N/A'}</strong>
                  </span>
                  {selectedVisit.route.promoter?.supervisor && (
                    <span className="flex items-center gap-1.5">
                      <User size={14} />
                      Supervisor: <strong className="text-[color:var(--color-text)]">{selectedVisit.route.promoter.supervisor.fullName}</strong>
                    </span>
                  )}
                </div>
              </div>
              <button 
                onClick={() => setSelectedVisit(null)}
                className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-[color:var(--color-muted)] hover:bg-slate-50 hover:text-red-500 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30 space-y-8">
              
              {/* Category Photos Section */}
              {selectedVisit.item.categoryPhotos && Object.keys(selectedVisit.item.categoryPhotos).length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                      <h3 className="font-bold text-[color:var(--color-text)] flex items-center gap-2">
                        <ImageIcon size={18} className="text-blue-500"/>
                        Fotos da Gôndola / Categoria
                      </h3>
                      <div className="text-xs text-[color:var(--color-muted)] mt-0.5">Visão Geral por Categoria</div>
                    </div>
                  </div>
                  <div className="p-4 space-y-6">
                     {Object.entries(selectedVisit.item.categoryPhotos).map(([catId, photosData]) => {
                       if (!photosData) return null;

                       const beforePhotos: string[] = [];
                       const afterPhotos: string[] = [];
                       const storagePhotos: string[] = [];
                       const legacyPhotos: string[] = [];

                       if (Array.isArray(photosData) || typeof photosData === 'string') {
                           const list = Array.isArray(photosData) ? photosData : [photosData];
                           legacyPhotos.push(...list.filter((p): p is string => typeof p === 'string'));
                       } else if (typeof photosData === 'object') {
                           const pd = photosData as any;
                           if (pd.before) {
                               const list = Array.isArray(pd.before) ? pd.before : [pd.before];
                               beforePhotos.push(...list.filter((p: any) => typeof p === 'string'));
                           }
                           if (pd.after) {
                               const list = Array.isArray(pd.after) ? pd.after : [pd.after];
                               afterPhotos.push(...list.filter((p: any) => typeof p === 'string'));
                           }
                           if (pd.storage) {
                               const list = Array.isArray(pd.storage) ? pd.storage : [pd.storage];
                               storagePhotos.push(...list.filter((p: any) => typeof p === 'string'));
                           }
                       }

                       if (beforePhotos.length === 0 && afterPhotos.length === 0 && storagePhotos.length === 0 && legacyPhotos.length === 0) return null;

                       const renderPhotoGrid = (photos: string[], label: string) => (
                         photos.length > 0 && (
                           <div className="mb-4 last:mb-0">
                             <span className="text-xs font-bold text-slate-400 uppercase mb-2 block">{label}</span>
                             <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                               {photos.map((photo, pIdx) => (
                                 <a 
                                   key={`${catId}-${label}-${pIdx}`}
                                   href={getImageUrl(photo)}
                                   target="_blank"
                                   rel="noopener noreferrer"
                                   className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 shadow-sm hover:ring-4 ring-blue-100 transition-all"
                                 >
                                   <img 
                                     src={getImageUrl(photo)} 
                                     alt={`${catId} ${label}`} 
                                     className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                                   />
                                   <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                 </a>
                               ))}
                             </div>
                           </div>
                         )
                       );

                       return (
                         <div key={catId} className="border-l-4 border-blue-500 pl-4 py-2 bg-slate-50/30 rounded-r-xl">
                           <h4 className="font-bold text-base text-[color:var(--color-text)] mb-3">{catId}</h4>
                           {renderPhotoGrid(beforePhotos, 'Antes')}
                           {renderPhotoGrid(afterPhotos, 'Depois')}
                           {renderPhotoGrid(storagePhotos, 'Estoque')}
                           {renderPhotoGrid(legacyPhotos, 'Geral')}
                         </div>
                       );
                     })}
                  </div>
                </div>
              )}

              {selectedVisit.item.products
                .filter(p => p.photos && p.photos.length > 0)
                .map((product, idx) => (
                <div key={idx} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                      <h3 className="font-bold text-[color:var(--color-text)]">{product.product.name}</h3>
                      <div className="text-xs text-[color:var(--color-muted)] mt-0.5">{product.product.brand?.name}</div>
                    </div>
                    <span className="text-xs font-bold text-slate-400 bg-white px-2 py-1 rounded-lg border border-slate-200">
                      {product.photos?.length} foto(s)
                    </span>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {product.photos?.map((photo, pIdx) => (
                        <a 
                          key={pIdx}
                          href={getImageUrl(photo)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 shadow-sm hover:ring-4 ring-blue-100 transition-all"
                        >
                          <img 
                            src={getImageUrl(photo)} 
                            alt="" 
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotoGalleryView;
