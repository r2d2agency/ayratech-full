import React, { useState, useEffect, useMemo } from 'react';
import { useBranding } from '../context/BrandingContext';
import { getImageUrl } from '../utils/image';
import SectionHeader from '../components/SectionHeader';
import StatCard from '../components/StatCard';
import { 
  RefreshCw,
  BarChart2, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Calendar, 
  Filter, 
  Download, 
  Users,
  X,
  MapPin,
  Clock,
  User,
  Image as ImageIcon,
  Upload,
  Camera,
  Save,
  Edit,
  Shield,
  Monitor,
  LayoutGrid,
  List,
  Store,
  Package
} from 'lucide-react';
import { jwtDecode } from "jwt-decode";
import api from '../api/client';
import { processImage } from '../utils/image-processor';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer
} from 'recharts';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';

const ProductImage = ({ src, alt }: { src: string, alt?: string }) => {
  const [error, setError] = useState(false);
  
  if (!src || error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-50 text-slate-300">
        <ImageIcon size={14} />
      </div>
    );
  }
  
  return (
    <img 
      src={src} 
      alt={alt || ""} 
      className="w-full h-full object-cover"
      onError={() => setError(true)}
    />
  );
};

interface RouteReportItem {
  id: string;
  date: string;
  status: string;
  promoterId?: string;
  promoter: {
    id: string;
    fullName: string;
    supervisor?: {
      id: string;
      fullName: string;
    };
  };
  promoters?: Array<{
    id: string;
    fullName: string;
  }>;
  items: Array<{
    id: string;
    status: string;
    checkInTime?: string;
    checkOutTime?: string;
    manualEntryBy?: string;
    manualEntryAt?: string;
    supermarket: {
      id: string;
      fantasyName: string;
      city?: string;
      state?: string;
    };
    categoryPhotos?: Record<string, string[] | string | { before?: string[] | string, after?: string[] | string }>;
    products: Array<{
      id: string;
      isStockout: boolean;
      checked: boolean;
      observation?: string;
      photos?: string[];
      checkInTime?: string;
      checkOutTime?: string;
      validityDate?: string;
      validityQuantity?: number;
      validityStoreDate?: string;
      validityStoreQuantity?: number;
      validityStockDate?: string;
      validityStockQuantity?: number;
      stockCount?: number;
      gondolaCount?: number;
      inventoryCount?: number;
      product: {
        id: string;
        name: string;
        image?: string;
        sku?: string;
        brand?: {
          name: string;
        };
        checklistTemplate?: {
            id: string;
            title: string;
            items: Array<{
                id: string;
                description: string;
                type: string;
                competitors?: Array<{ id: string; name: string }>;
            }>;
        };
      };
      validityDate?: string;
      validityQuantity?: number;
      validityStoreDate?: string;
      validityStoreQuantity?: number;
      validityStockDate?: string;
      validityStockQuantity?: number;
      stockCount?: number | '';
      gondolaCount?: number | '';
      inventoryCount?: number | '';
      checklists?: Array<{
          id: string;
          type: string;
          value?: string;
          isChecked: boolean;
          competitorName?: string;
          description: string;
      }>;
      completedBy?: {
        id: string;
        name: string;
      };
    }>;
  }>;
}

const RoutesReportView: React.FC = () => {
  const { settings } = useBranding();
  const [loading, setLoading] = useState(false);
  const [routes, setRoutes] = useState<RouteReportItem[]>([]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split('T')[0];
  });
  const [selectedRoute, setSelectedRoute] = useState<RouteReportItem | null>(null);

  // Filter State
  const [selectedSupervisor, setSelectedSupervisor] = useState('');
  const [selectedPromoter, setSelectedPromoter] = useState('');
  const [selectedClient, setSelectedClient] = useState(''); // Brand
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedPDV, setSelectedPDV] = useState('');
  const [onlyRuptures, setOnlyRuptures] = useState(false);
  const [validityStart, setValidityStart] = useState('');
  const [validityEnd, setValidityEnd] = useState('');
  
  // View Mode
  const [groupBy, setGroupBy] = useState<'route' | 'pdv' | 'validity'>('route');
  
  // Computed stats
  const [stats, setStats] = useState({
    total: 0,
    executed: 0,
    notExecuted: 0,
    withIssues: 0,
    nearExpiry: 0
  });

  const [supervisorData, setSupervisorData] = useState<any[]>([]);
  const [promoterData, setPromoterData] = useState<any[]>([]);

  // Manual Entry State
  const [isAdmin, setIsAdmin] = useState(false);
  const [promotersList, setPromotersList] = useState<any[]>([]);
  const [manualForm, setManualForm] = useState<{
    itemId: string;
    checkInTime: string;
    checkOutTime: string;
    promoterId: string;
    observation: string;
    products: { 
      productId: string; 
      checked: boolean; 
      isStockout: boolean; 
      observation: string; 
      photos: string[];
      productName: string;
      validityDate?: string;
      validityQuantity?: number;
      validityStoreDate?: string;
      validityStoreQuantity?: number;
      validityStockDate?: string;
      validityStockQuantity?: number;
      stockCount?: number;
      checklists?: Array<{
        description: string;
        type: string;
        value?: string;
        isChecked: boolean;
        competitorName?: string;
      }>;
      checklistTemplate?: any;
    }[];
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Photo Processing State
  const [photoMeta, setPhotoMeta] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    promoterName: '',
    pdvName: ''
  });
  const [processing, setProcessing] = useState(false);

  const [activeProductIndex, setActiveProductIndex] = useState<number | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkAdmin();
    fetchRoutes();
  }, [startDate, endDate]);

  const getOverallValidity = (p: any) => {
    const storeDate = p?.validityStoreDate ? String(p.validityStoreDate) : '';
    const storeQty =
      p?.validityStoreQuantity !== null && p?.validityStoreQuantity !== undefined
        ? Number(p.validityStoreQuantity)
        : 0;
    const stockDate = p?.validityStockDate ? String(p.validityStockDate) : '';
    const stockQty =
      p?.validityStockQuantity !== null && p?.validityStockQuantity !== undefined
        ? Number(p.validityStockQuantity)
        : 0;
    const legacyDate = p?.validityDate ? String(p.validityDate) : '';
    const legacyQty =
      p?.validityQuantity !== null && p?.validityQuantity !== undefined ? Number(p.validityQuantity) : 0;

    const hasStore = !!(storeDate && storeQty > 0);
    const hasStock = !!(stockDate && stockQty > 0);

    if (hasStore && hasStock) {
      return storeDate <= stockDate ? { date: storeDate, qty: storeQty } : { date: stockDate, qty: stockQty };
    }
    if (hasStore) return { date: storeDate, qty: storeQty };
    if (hasStock) return { date: stockDate, qty: stockQty };
    if (legacyDate && legacyQty > 0) return { date: legacyDate, qty: legacyQty };
    if (legacyDate) return { date: legacyDate, qty: legacyQty };
    return null;
  };

  const getValidityMeta = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const valDate = new Date(dateStr);
    const userTimezoneOffset = valDate.getTimezoneOffset() * 60000;
    const adjustedDate = new Date(valDate.getTime() + userTimezoneOffset);
    const diffTime = adjustedDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return { adjustedDate, diffDays };
  };

  const renderValidityLine = (label: string, date?: string, qty?: number) => {
    if (!date) {
      return (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-slate-400">{label}</span>
          <span className="text-slate-300">-</span>
        </div>
      );
    }

    const { adjustedDate, diffDays } = getValidityMeta(date);
    const color =
      diffDays < 0 ? 'text-red-600' : diffDays <= 30 ? 'text-amber-600' : 'text-[color:var(--color-muted)]';
    const headline =
      diffDays < 0 ? 'VENCIDO' : diffDays <= 30 ? `Vence em ${diffDays}d` : adjustedDate.toLocaleDateString('pt-BR');

    return (
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] text-slate-400">{label}</div>
          <div className={`font-bold ${color}`}>
            {diffDays <= 30 ? (
              <span className="flex items-center gap-1">
                <AlertTriangle size={12} />
                {headline} ({adjustedDate.toLocaleDateString('pt-BR')})
              </span>
            ) : (
              <span>{headline}</span>
            )}
          </div>
        </div>
        <div className="text-[10px] text-[color:var(--color-muted)] whitespace-nowrap">
          Qtd: {qty && qty > 0 ? qty : '-'}
        </div>
      </div>
    );
  };

  // Extract unique values for filters
  const uniqueOptions = useMemo(() => {
    const supervisors = new Set<string>();
    const promoters = new Set<string>();
    const clients = new Set<string>();
    const products = new Set<string>();
    const pdvs = new Set<string>();

    routes.forEach(r => {
      if (r.promoter?.supervisor?.fullName) supervisors.add(r.promoter.supervisor.fullName);
      if (r.promoter?.fullName) promoters.add(r.promoter.fullName);
      if (r.promoters && r.promoters.length > 0) {
        r.promoters.forEach(p => {
          if (p.fullName) promoters.add(p.fullName);
        });
      }
      
      r.items.forEach(i => {
        if (i.supermarket.fantasyName) pdvs.add(i.supermarket.fantasyName);
        i.products.forEach(p => {
          if (p.product.name) products.add(p.product.name);
          if (p.product.brand?.name) clients.add(p.product.brand.name);
        });
      });
    });

    return {
      supervisors: Array.from(supervisors).sort(),
      promoters: Array.from(promoters).sort(),
      clients: Array.from(clients).sort(),
      products: Array.from(products).sort(),
      pdvs: Array.from(pdvs).sort()
    };
  }, [routes]);

  // Filter Logic
  const filteredRoutes = useMemo(() => {
    return routes.filter(r => {
      // Route-level filters
      if (selectedSupervisor && r.promoter?.supervisor?.fullName !== selectedSupervisor) return false;
      if (selectedPromoter) {
        const mainPromoterMatch = r.promoter?.fullName === selectedPromoter;
        const sharedPromoterMatch = r.promoters?.some(p => p.fullName === selectedPromoter);
        if (!mainPromoterMatch && !sharedPromoterMatch) return false;
      }
      
      // Item-level filters (Check if ANY item matches)
      // If a filter is set, the route must contain at least one item that satisfies the criteria
      // However, for correct reporting, we might want to filter the items inside the route too?
      // For now, we'll just filter which Routes show up.
      
      // Filter by Ruptures
      if (onlyRuptures) {
        const hasRuptures = r.items.some(i => i.products.some(p => p.isStockout));
        if (!hasRuptures) return false;
      }

      const hasPDV = !selectedPDV || r.items.some(i => i.supermarket.fantasyName === selectedPDV);
      if (!hasPDV) return false;

      if (selectedProduct || selectedClient) {
        const hasProductOrClient = r.items.some(i => 
          i.products.some(p => 
            (!selectedProduct || p.product.name === selectedProduct) &&
            (!selectedClient || p.product.brand?.name === selectedClient)
          )
        );
        if (!hasProductOrClient) return false;
      }
      
      return true;
    });
  }, [routes, selectedSupervisor, selectedPromoter, selectedClient, selectedProduct, selectedPDV, onlyRuptures]);

  // Recalculate Stats when filteredRoutes changes
  useEffect(() => {
    processData(filteredRoutes);
  }, [filteredRoutes]);

  // Group By PDV Logic
  const pdvReport = useMemo(() => {
    if (groupBy !== 'pdv') return [];

    const pdvMap = new Map<string, {
      id: string;
      name: string;
      city: string;
      address: string;
      visits: number;
      productsChecked: number;
      ruptures: number;
      promoters: Set<string>;
      supervisors: Set<string>;
      items: any[];
    }>();

    filteredRoutes.forEach(r => {
      r.items.forEach(i => {
        // Apply item-level filters again for aggregation correctness
        if (selectedPDV && i.supermarket.fantasyName !== selectedPDV) return;
        
        // Filter by Ruptures (Item Level)
        if (onlyRuptures) {
          const hasRuptures = i.products.some(p => p.isStockout);
          if (!hasRuptures) return;
        }

        const hasMatchingProduct = i.products.some(p => 
          (!selectedProduct || p.product.name === selectedProduct) &&
          (!selectedClient || p.product.brand?.name === selectedClient)
        );
        if (!hasMatchingProduct) return;

        // Key by Supermarket ID
        const key = i.supermarket.id;
        if (!pdvMap.has(key)) {
          pdvMap.set(key, {
            id: i.supermarket.id,
            name: i.supermarket.fantasyName,
            city: `${i.supermarket.city || ''} - ${i.supermarket.state || ''}`,
            address: `${i.supermarket.street || ''}, ${i.supermarket.number || ''} - ${i.supermarket.neighborhood || ''}`,
            visits: 0,
            productsChecked: 0,
            ruptures: 0,
            promoters: new Set(),
            supervisors: new Set(),
            items: []
          });
        }

        const entry = pdvMap.get(key)!;
        
        // Only count if executed
        const isExecuted = ['CHECKOUT', 'COMPLETED'].includes(i.status);
        if (isExecuted) {
          entry.visits++;
          entry.items.push({ ...i, date: r.date, promoter: r.promoter });
          
          // Count products (respecting filters)
          const relevantProducts = i.products.filter(p => 
            (!selectedProduct || p.product.name === selectedProduct) &&
            (!selectedClient || p.product.brand?.name === selectedClient)
          );
          
          entry.productsChecked += relevantProducts.filter(p => p.checked).length;
          entry.ruptures += relevantProducts.filter(p => p.isStockout).length;
          
          // Add actual completers
          relevantProducts.forEach(p => {
              if (p.completedBy?.fullName) {
                  entry.promoters.add(p.completedBy.fullName);
              }
          });

          if (r.promoter.fullName) entry.promoters.add(r.promoter.fullName);
          if (r.promoters && r.promoters.length > 0) {
            r.promoters.forEach(p => {
              if (p.fullName) entry.promoters.add(p.fullName);
            });
          }
          if (r.promoter.supervisor?.fullName) entry.supervisors.add(r.promoter.supervisor.fullName);
        }
      });
    });

    return Array.from(pdvMap.values()).sort((a, b) => b.visits - a.visits);
  }, [filteredRoutes, groupBy, selectedPDV, selectedProduct, selectedClient, onlyRuptures]);

  // Group By Validity (Product focused, grouped by PDV)
  const validityReport = useMemo(() => {
    if (groupBy !== 'validity') return [];

    const pdvMap = new Map<string, {
      id: string;
      name: string;
      items: {
        productName: string;
        productImage?: string;
        brandName: string;
        validityDate?: string;
        validityQuantity?: number;
        validityStoreDate?: string;
        validityStoreQuantity?: number;
        validityStockDate?: string;
        validityStockQuantity?: number;
        checked: boolean;
        checkInTime?: string;
        promoterName: string;
        date: string;
      }[]
    }>();

    filteredRoutes.forEach(r => {
      r.items.forEach(i => {
        // Apply filters
        if (selectedPDV && i.supermarket.fantasyName !== selectedPDV) return;

        i.products.forEach(p => {
            // Apply product/brand filters
            if (selectedProduct && p.product.name !== selectedProduct) return;
            if (selectedClient && p.product.brand?.name !== selectedClient) return;

            // Apply validity filter if set
            if (validityStart || validityEnd) {
                 const overall = getOverallValidity(p);
                 if (!overall?.date) return;
                 const vDate = overall.date;
                 if (validityStart && vDate < validityStart) return;
                 if (validityEnd && vDate > validityEnd) return;
            }

            // Group by PDV
            const key = i.supermarket.id;
            if (!pdvMap.has(key)) {
                pdvMap.set(key, {
                    id: i.supermarket.id,
                    name: i.supermarket.fantasyName,
                    items: []
                });
            }
            
            pdvMap.get(key)!.items.push({
                productName: p.product.name,
                productImage: p.product.image,
                brandName: p.product.brand?.name || '-',
                validityDate: getOverallValidity(p)?.date,
                validityQuantity: getOverallValidity(p)?.qty,
                validityStoreDate: p.validityStoreDate,
                validityStoreQuantity: p.validityStoreQuantity,
                validityStockDate: p.validityStockDate,
                validityStockQuantity: p.validityStockQuantity,
                checked: p.checked,
                checkInTime: p.checkInTime,
                promoterName: p.completedBy?.fullName || r.promoter.fullName || 'N/A',
                date: r.date
            });
        });
      });
    });

    return Array.from(pdvMap.values());
  }, [filteredRoutes, groupBy, selectedPDV, selectedProduct, selectedClient, validityStart, validityEnd]);


  const checkAdmin = () => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        const role = decoded.role?.toLowerCase() || '';
        const admin = ['admin', 'manager', 'superadmin', 'administrador do sistema', 'supervisor de operações'].includes(role);
        setIsAdmin(admin);
        if (admin) fetchPromoters();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const fetchPromoters = async () => {
    try {
      const res = await api.get('/employees');
      setPromotersList(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const openPhotoModal = (index: number) => {
    setActiveProductIndex(index);
    
    const currentPromoterId = manualForm?.promoterId;
    const currentPromoter = promotersList.find(p => p.id === currentPromoterId);
    
    let pdvName = 'PDV';
    if (selectedRoute) {
        const item = selectedRoute.items.find(i => i.id === manualForm?.itemId);
        if (item) pdvName = item.supermarket.fantasyName;
    }

    // Default to current time, but prefer manualForm.checkInTime if available
    let initialDate = new Date().toISOString().split('T')[0];
    let initialTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    if (manualForm?.checkInTime) {
        const checkIn = new Date(manualForm.checkInTime);
        if (!isNaN(checkIn.getTime())) {
            initialDate = checkIn.toISOString().split('T')[0];
            const hours = checkIn.getHours().toString().padStart(2, '0');
            const minutes = checkIn.getMinutes().toString().padStart(2, '0');
            initialTime = `${hours}:${minutes}`;
        }
    }

    setPhotoMeta({
        date: initialDate,
        time: initialTime,
        promoterName: currentPromoter?.fullName || currentPromoter?.name || '',
        pdvName: pdvName
    });

    setShowPhotoModal(true);
  };

  const handlePhotoModalConfirm = () => {
    setShowPhotoModal(false);
    if (fileInputRef.current) {
        fileInputRef.current.click();
    }
  };

  const handleFileSelect = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || activeProductIndex === null) return;
    const files = Array.from(fileList);
    processAndUploadPhotos(files, activeProductIndex);
  };

  const processAndUploadPhotos = async (files: File[], productIndex: number) => {
    setProcessing(true);
    try {
        const newPhotos: string[] = [];
        
        // Combine Date and Time
        const timestamp = new Date(`${photoMeta.date}T${photoMeta.time}`);

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const processed = await processImage(file, {
                supermarketName: photoMeta.pdvName,
                promoterName: photoMeta.promoterName,
                timestamp: timestamp
            });

            const formData = new FormData();
            formData.append('file', processed);

            const res = await api.post('/upload', formData);
            const url = res.data.path || res.data.url;
            newPhotos.push(url);
        }

        if (manualForm) {
            const newProducts = [...manualForm.products];
            newProducts[productIndex].photos = [...(newProducts[productIndex].photos || []), ...newPhotos];
            setManualForm({ ...manualForm, products: newProducts });
        }
    } catch (err) {
        console.error('Processing/Upload failed', err);
        alert('Erro ao processar/enviar foto(s).');
    } finally {
        setProcessing(false);
        setActiveProductIndex(null);
    }
  };

  const openManualEntry = (item: any, routePromoterId: string) => {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    
    const toLocalISO = (date: Date) => {
      const pad = (n: number) => n < 10 ? '0' + n : n;
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    const initialCheckIn = item.checkInTime ? new Date(item.checkInTime) : now;
    const initialCheckOut = item.checkOutTime ? new Date(item.checkOutTime) : oneHourLater;

    setManualForm({
      itemId: item.id,
      checkInTime: toLocalISO(initialCheckIn),
      checkOutTime: toLocalISO(initialCheckOut),
      promoterId: routePromoterId,
      observation: item.observation || '',
      products: item.products.map((p: any) => {
        // Prepare initial checklists based on template or existing data
        let initialChecklists = [];
        if (p.checklists && p.checklists.length > 0) {
             initialChecklists = p.checklists.map((c: any) => ({
                 description: c.description,
                 type: c.type,
                 value: c.value,
                 isChecked: c.isChecked,
                 competitorName: c.competitorName
             }));
        } else if (p.product.checklistTemplate?.items) {
             // Initialize from template if no data exists
             initialChecklists = p.product.checklistTemplate.items.flatMap((tmplItem: any) => {
                 if (tmplItem.competitors && tmplItem.competitors.length > 0) {
                     return tmplItem.competitors.map((comp: any) => ({
                         description: tmplItem.description,
                         type: tmplItem.type,
                         value: '',
                         isChecked: false,
                         competitorName: comp.name
                     }));
                 }
                 return [{
                     description: tmplItem.description,
                     type: tmplItem.type,
                     value: '',
                     isChecked: false,
                     competitorName: undefined
                 }];
             });
        }

        return {
            productId: p.product.id,
            checked: p.checked || false,
            isStockout: p.isStockout || false,
            observation: p.observation || '',
            photos: p.photos || [],
            productName: p.product.name,
            validityDate: p.validityDate || '',
            validityQuantity: (p as any).validityQuantity || undefined,
            validityStoreDate: (p as any).validityStoreDate || '',
            validityStoreQuantity: (p as any).validityStoreQuantity || undefined,
            validityStockDate: (p as any).validityStockDate || '',
            validityStockQuantity: (p as any).validityStockQuantity || undefined,
            stockCount: p.stockCount || '',
            checklistTemplate: p.product.checklistTemplate,
            checklists: initialChecklists
        };
      })
    });
  };

  const submitManualEntry = async () => {
    if (!manualForm) return;
    setSubmitting(true);
    try {
      await api.post(`/routes/items/${manualForm.itemId}/manual-execution`, {
        checkInTime: manualForm.checkInTime,
        checkOutTime: manualForm.checkOutTime,
        promoterId: manualForm.promoterId,
        products: manualForm.products
      });
      alert('Lançamento realizado com sucesso!');
      setManualForm(null);
      setSelectedRoute(null);
      fetchRoutes();
    } catch (err) {
      console.error(err);
      alert('Erro ao realizar lançamento manual.');
    } finally {
      setSubmitting(false);
    }
  };

  const fetchRoutes = async () => {
    setLoading(true);
    try {
      const res = await api.get('/routes');
      const allRoutes: RouteReportItem[] = res.data;

      const filtered = allRoutes.filter(r => {
        const routeDate = r.date.split('T')[0];
        return routeDate >= startDate && routeDate <= endDate;
      });
      
      setRoutes(filtered);
    } catch (err) {
      console.error('Error fetching routes report:', err);
    } finally {
      setLoading(false);
    }
  };

  const processData = (data: RouteReportItem[]) => {
    let executedCount = 0;
    let issuesCount = 0;
    let nearExpiryCount = 0;
    
    const supervisors: Record<string, { name: string, executed: number, total: number }> = {};
    const promoters: Record<string, { name: string, executed: number, total: number }> = {};

    data.forEach(route => {
      const isExecuted = route.items.some(i => ['CHECKOUT', 'COMPLETED'].includes(i.status));
      if (isExecuted) executedCount++;

      const hasIssues = route.items.some(i => i.products.some(p => p.isStockout));
      if (hasIssues) issuesCount++;

      const hasNearExpiry = route.items.some(i => i.products.some(p => {
        const overall = getOverallValidity(p);
        if (!overall?.date) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const valDate = new Date(overall.date);
        // Fix timezone offset issue for calculation
        const userTimezoneOffset = valDate.getTimezoneOffset() * 60000;
        const adjustedDate = new Date(valDate.getTime() + userTimezoneOffset);
        
        const diffTime = adjustedDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 30;
      }));
      if (hasNearExpiry) nearExpiryCount++;

      const supName = route.promoter?.supervisor?.fullName || 'Sem Supervisor';
      if (!supervisors[supName]) supervisors[supName] = { name: supName, executed: 0, total: 0 };
      supervisors[supName].total++;
      if (isExecuted) supervisors[supName].executed++;

      // Count for Main Promoter
      const mainPromName = route.promoter?.fullName || 'Sem Nome';
      if (!promoters[mainPromName]) promoters[mainPromName] = { name: mainPromName, executed: 0, total: 0 };
      promoters[mainPromName].total++;
      if (isExecuted) promoters[mainPromName].executed++;

      // Count for Shared Promoters (if any, preventing double counting if same as main - though shouldn't happen)
      if (route.promoters && route.promoters.length > 0) {
        route.promoters.forEach(p => {
          if (p.id === route.promoter.id) return; // Skip if same as main (just in case)
          const pName = p.fullName || 'Sem Nome';
          if (!promoters[pName]) promoters[pName] = { name: pName, executed: 0, total: 0 };
          promoters[pName].total++;
          if (isExecuted) promoters[pName].executed++;
        });
      }
    });

    setStats({
      total: data.length,
      executed: executedCount,
      notExecuted: data.length - executedCount,
      withIssues: issuesCount,
      nearExpiry: nearExpiryCount
    });

    setSupervisorData(Object.values(supervisors));
    setPromoterData(Object.values(promoters));
  };

  const getStatusBadge = (route: RouteReportItem) => {
    const isExecuted = route.items.some(i => ['CHECKOUT', 'COMPLETED'].includes(i.status));
    const isInProgress = route.items.some(i => i.checkInTime && !i.checkOutTime);
    const hasIssues = route.items.some(i => i.products.some(p => p.isStockout));

    if (isInProgress) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-yellow-50 text-yellow-600 border border-yellow-200">
          <Clock size={14} />
          Em Visita
        </span>
      );
    }

    if (!isExecuted) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-slate-100 text-[color:var(--color-muted)] border border-slate-200">
          <XCircle size={14} />
          Não Executado
        </span>
      );
    }
    
    if (hasIssues) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-600 border border-amber-200">
          <AlertTriangle size={14} />
          Com Ruptura
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
        <CheckCircle2 size={14} />
        Verificado
      </span>
    );
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (start?: string, end?: string) => {
    if (!start || !end) return null;
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    const diff = endTime - startTime;
    if (diff < 0) return null;
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  const calculateTotalRouteDuration = (items: RouteReportItem['items']) => {
    let totalMs = 0;
    
    items.forEach(item => {
      if (item.checkInTime && item.checkOutTime) {
        const start = new Date(item.checkInTime).getTime();
        const end = new Date(item.checkOutTime).getTime();
        if (end > start) {
          totalMs += (end - start);
        }
      }
    });

    if (totalMs === 0) return null;

    const hours = Math.floor(totalMs / (1000 * 60 * 60));
    const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatRouteDate = (dateString: string) => {
    if (!dateString) return '-';
    
    // Check if it's a simple YYYY-MM-DD string
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return dateString.split('-').reverse().join('/');
    }

    // Check if it's an ISO string (YYYY-MM-DDTHH:mm:ss...)
    if (/^\d{4}-\d{2}-\d{2}T/.test(dateString)) {
        return dateString.split('T')[0].split('-').reverse().join('/');
    }

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString;
      }
      // If we are here, it might be some other format, but usually we want to avoid timezone shifts for dates
      // that are meant to be absolute (like route dates). 
      // However, if it's a full timestamp we might want local time.
      // But for "Route Date", it's usually just YYYY-MM-DD.
      // Let's stick to UTC or string split if possible.
      
      // Fallback to string manipulation if possible to match YYYY-MM-DD pattern inside
      const match = dateString.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
          return `${match[3]}/${match[2]}/${match[1]}`;
      }

      return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' }); // Try forcing UTC if it's a date object
    } catch (e) {
      return dateString;
    }
  };

  const handleExport = () => {
    if (filteredRoutes.length === 0) {
      alert('Não há dados para exportar.');
      return;
    }

    const data: any[] = [];

    filteredRoutes.forEach(route => {
      const date = formatRouteDate(route.date);
      
      // Combine all promoters
      let allPromoters = [route.promoter.fullName];
      if (route.promoters && route.promoters.length > 0) {
        const otherPromoters = route.promoters
          .filter(p => p.id !== route.promoter.id)
          .map(p => p.fullName);
        allPromoters = [...allPromoters, ...otherPromoters];
      }
      const promoterStr = allPromoters.join(', ');
      
      const supervisor = route.promoter.supervisor?.fullName || '-';

      route.items.forEach(item => {
        // Apply item level filters if needed
        if (selectedPDV && item.supermarket.fantasyName !== selectedPDV) return;

        const pdv = item.supermarket.fantasyName;
        const city = item.supermarket.city || '';

        item.products.forEach(p => {
          // Apply product level filters
          if (selectedProduct && p.product.name !== selectedProduct) return;
          if (selectedClient && p.product.brand?.name !== selectedClient) return;

          const overall = getOverallValidity(p);
          const row = {
            'Data': date,
            'Promotor(es)': promoterStr,
            'Supervisor': supervisor,
            'PDV': pdv,
            'Cidade': city,
            'Produto': p.product.name,
            'Categoria': (p.product as any).category || (p.product as any).categoria || '-',
            'Marca': p.product.brand?.name || '-',
            'Status': item.status,
            'Quem Realizou': p.completedBy?.fullName || '-',
            'Check-in': item.checkInTime ? new Date(item.checkInTime).toLocaleTimeString('pt-BR') : '-',
            'Check-out': item.checkOutTime ? new Date(item.checkOutTime).toLocaleTimeString('pt-BR') : '-',
            'Ruptura': p.isStockout ? 'Sim' : 'Não',
            'Verificado': p.checked ? 'Sim' : 'Não',
            'Validade': overall?.date ? formatRouteDate(overall.date) : '-',
            'Qtd. Validade': overall?.qty && overall.qty > 0 ? overall.qty : '-',
            'Validade (Loja)': (p as any).validityStoreDate ? formatRouteDate((p as any).validityStoreDate) : '-',
            'Qtd. Validade (Loja)': (p as any).validityStoreQuantity && (p as any).validityStoreQuantity > 0 ? (p as any).validityStoreQuantity : '-',
            'Validade (Estoque)': (p as any).validityStockDate ? formatRouteDate((p as any).validityStockDate) : '-',
            'Qtd. Validade (Estoque)': (p as any).validityStockQuantity && (p as any).validityStockQuantity > 0 ? (p as any).validityStockQuantity : '-',
            'Loja': p.gondolaCount !== undefined && p.gondolaCount !== null ? p.gondolaCount : '-',
            'Estoque': p.inventoryCount !== undefined && p.inventoryCount !== null ? p.inventoryCount : '-',
            'Total Estoque': p.stockCount !== undefined && p.stockCount !== null ? p.stockCount : '-',
            'Observação': p.observation || ''
          };
          
          data.push(row);
        });

        // Add Category Photos rows
        if (item.categoryPhotos) {
          Object.entries(item.categoryPhotos).forEach(([category, photos]) => {
            const processPhotos = (photoList: string[] | string, type: string) => {
              const list = Array.isArray(photoList) ? photoList : [photoList];
              list.forEach(photoUrl => {
                 if (!photoUrl) return;
                 const photoRow = {
                  'Data': date,
                  'Promotor(es)': promoterStr,
                  'Supervisor': supervisor,
                  'PDV': pdv,
                  'Cidade': city,
                  'Produto': `FOTO: ${category} - ${type}`,
                  'Categoria': category,
                  'Marca': '-',
                  'Status': item.status,
                  'Quem Realizou': '-',
                  'Check-in': item.checkInTime ? new Date(item.checkInTime).toLocaleTimeString('pt-BR') : '-',
                  'Check-out': item.checkOutTime ? new Date(item.checkOutTime).toLocaleTimeString('pt-BR') : '-',
                  'Ruptura': '-',
                  'Verificado': 'Sim',
                  'Validade': '-',
                  'Qtd. Validade': '-',
                  'Loja': '-',
                  'Estoque': '-',
                  'Total Estoque': '-',
                  'Observação': photoUrl
                };
                data.push(photoRow);
              });
            };

            if (Array.isArray(photos)) {
              processPhotos(photos, 'Geral');
            } else if (typeof photos === 'string') {
               processPhotos(photos, 'Geral');
            } else if (typeof photos === 'object' && photos !== null) {
              if (photos.before) processPhotos(photos.before, 'Antes');
              if (photos.after) processPhotos(photos.after, 'Depois');
              if (photos.storage) processPhotos(photos.storage, 'Estoque');
            }
          });
        }
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Relatório");
    XLSX.writeFile(workbook, `relatorio_rotas_${startDate}_${endDate}.xlsx`);
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8 pb-32">
      <SectionHeader 
        icon={<BarChart2 className="text-blue-600" />}
        title="Relatório de Rotas"
        subtitle="Análise de execução, performance e rupturas"
      />

      {/* Filters & Actions */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4 items-end">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase">Supervisor</label>
              <select 
                value={selectedSupervisor}
                onChange={e => setSelectedSupervisor(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[color:var(--color-text)] outline-none focus:border-blue-500 transition-colors"
              >
                <option value="">Todos</option>
                {uniqueOptions.supervisors.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase">Promotor</label>
              <select 
                value={selectedPromoter}
                onChange={e => setSelectedPromoter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[color:var(--color-text)] outline-none focus:border-blue-500 transition-colors"
              >
                <option value="">Todos</option>
                {uniqueOptions.promoters.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase">Cliente (Marca)</label>
              <select 
                value={selectedClient}
                onChange={e => setSelectedClient(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[color:var(--color-text)] outline-none focus:border-blue-500 transition-colors"
              >
                <option value="">Todos</option>
                {uniqueOptions.clients.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase">PDV</label>
              <select 
                value={selectedPDV}
                onChange={e => setSelectedPDV(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[color:var(--color-text)] outline-none focus:border-blue-500 transition-colors"
              >
                <option value="">Todos</option>
                {uniqueOptions.pdvs.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

             <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase">Produto</label>
              <select 
                value={selectedProduct}
                onChange={e => setSelectedProduct(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[color:var(--color-text)] outline-none focus:border-blue-500 transition-colors"
              >
                <option value="">Todos</option>
                {uniqueOptions.products.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase">De</label>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[color:var(--color-text)] outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase">Até</label>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-[color:var(--color-text)] outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            
            <button
              onClick={() => setOnlyRuptures(!onlyRuptures)}
              className={`w-full px-3 py-2 rounded-xl text-sm font-bold border transition-all flex items-center justify-center gap-2 h-[38px] ${
                onlyRuptures 
                  ? 'bg-red-50 border-red-200 text-red-600' 
                  : 'bg-white border-slate-200 text-[color:var(--color-muted)] hover:bg-slate-50'
              }`}
            >
              <AlertTriangle size={16} />
              {onlyRuptures ? 'Com Rupturas' : 'Rupturas'}
            </button>
        </div>
      </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            <StatCard 
              icon={<Calendar />}
              label="Total de Rotas"
              value={stats.total.toString()}
              color="bg-blue-50 text-blue-600"
            />
            <StatCard 
              icon={<CheckCircle2 />}
              label="Executadas"
              value={stats.executed.toString()}
              sub={`${((stats.executed / (stats.total || 1)) * 100).toFixed(1)}% do total`}
              color="bg-emerald-50 text-emerald-600"
            />
            <StatCard 
              icon={<XCircle />}
              label="Não Executadas"
              value={stats.notExecuted.toString()}
              color="bg-rose-50 text-rose-600"
            />
            <StatCard 
              icon={<AlertTriangle />}
              label="Com Ruptura"
              value={stats.withIssues.toString()}
              color="bg-amber-50 text-amber-600"
            />
            <StatCard 
              icon={<Clock />}
              label="Vencendo (<30d)"
              value={stats.nearExpiry.toString()}
              color="bg-orange-50 text-orange-600"
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="font-black text-lg text-[color:var(--color-text)] mb-6 flex items-center gap-2">
                <Users size={20} className="text-slate-400" />
                Execução por Supervisor
              </h3>
              <div style={{ width: '100%', height: '320px', minHeight: '320px' }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <BarChart data={supervisorData} layout="vertical" margin={{ left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={false} />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="executed" name="Executadas" fill="#10B981" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="total" name="Total" fill="#E2E8F0" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="font-black text-lg text-[color:var(--color-text)] mb-6 flex items-center gap-2">
                <Users size={20} className="text-slate-400" />
                Execução por Promotor
              </h3>
              <div style={{ width: '100%', height: '320px', minHeight: '320px' }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <BarChart data={promoterData.slice(0, 10)} layout="vertical" margin={{ left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={false} />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="executed" name="Executadas" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="total" name="Total" fill="#E2E8F0" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* View Toggle & List */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <h3 className="font-black text-lg text-[color:var(--color-text)]">
                  {groupBy === 'route' ? 'Detalhamento das Rotas' : 'Relatório por PDV'}
                </h3>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button 
                    onClick={() => setGroupBy('route')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      groupBy === 'route' ? 'bg-white text-blue-600 shadow-sm' : 'text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]'
                    }`}
                  >
                    <List size={14} />
                    Por Rota
                  </button>
                  <button 
                    onClick={() => setGroupBy('pdv')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      groupBy === 'pdv' ? 'bg-white text-blue-600 shadow-sm' : 'text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]'
                    }`}
                  >
                    <Store size={14} />
                    Por PDV
                  </button>
                  <button 
                    onClick={() => setGroupBy('validity')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      groupBy === 'validity' ? 'bg-white text-blue-600 shadow-sm' : 'text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]'
                    }`}
                  >
                    <Clock size={14} />
                    Validade
                  </button>
                </div>
              </div>
              <button 
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-colors">
                <Download size={16} />
                Exportar CSV
              </button>
            </div>
            
            <div className="overflow-x-auto">
              {groupBy === 'route' ? (
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="p-4 font-black text-xs text-slate-400 uppercase tracking-wider">Data</th>
                      <th className="p-4 font-black text-xs text-slate-400 uppercase tracking-wider">Equipe</th>
                      <th className="p-4 font-black text-xs text-slate-400 uppercase tracking-wider">Supervisor</th>
                      <th className="p-4 font-black text-xs text-slate-400 uppercase tracking-wider">PDVs</th>
                      <th className="p-4 font-black text-xs text-slate-400 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRoutes.map((route) => (
                      <tr 
                        key={route.id} 
                        onClick={() => setSelectedRoute(route)}
                        className="hover:bg-slate-50 transition-colors group cursor-pointer"
                      >
                        <td className="p-4">
                          <span className="font-bold text-[color:var(--color-text)] text-sm">
                            {formatRouteDate(route.date)}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="flex -space-x-2">
                                {((route.promoters && route.promoters.length > 0) ? route.promoters : (route.promoter ? [route.promoter] : [])).slice(0, 3).map((p: any) => (
                                    <div key={p.id} className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs border-2 border-white" title={p.fullName || p.name}>
                                        {(p.fullName || p.name || '?').substring(0, 2).toUpperCase()}
                                    </div>
                                ))}
                                {((route.promoters?.length || 0) > 3) && (
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[color:var(--color-muted)] font-bold text-xs border-2 border-white">
                                        +{(route.promoters?.length || 0) - 3}
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col">
                                <span className="font-bold text-[color:var(--color-text)] text-sm">
                                    {((route.promoters && route.promoters.length > 0) ? route.promoters : (route.promoter ? [route.promoter] : [])).map((p: any) => (p?.fullName || p?.name || '').split(' ')[0]).join(', ')}
                                </span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="text-sm font-medium text-[color:var(--color-muted)]">
                            {route.promoter.supervisor?.fullName || '-'}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-sm font-medium text-[color:var(--color-muted)]">
                            {route.items.length} lojas
                          </span>
                        </td>
                        <td className="p-4">
                          {getStatusBadge(route)}
                        </td>
                      </tr>
                    ))}
                    {filteredRoutes.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">
                          Nenhuma rota encontrada para os filtros selecionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : groupBy === 'pdv' ? (
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="p-4 font-black text-xs text-slate-400 uppercase tracking-wider">PDV</th>
                      <th className="p-4 font-black text-xs text-slate-400 uppercase tracking-wider">Localização</th>
                      <th className="p-4 font-black text-xs text-slate-400 uppercase tracking-wider text-center">Visitas</th>
                      <th className="p-4 font-black text-xs text-slate-400 uppercase tracking-wider text-center">Prod. Verificados</th>
                      <th className="p-4 font-black text-xs text-slate-400 uppercase tracking-wider text-center">Rupturas</th>
                      <th className="p-4 font-black text-xs text-slate-400 uppercase tracking-wider">Promotores</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pdvReport.map((pdv) => (
                      <tr 
                        key={pdv.id} 
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-xs">
                              <Store size={14} />
                            </div>
                            <div className="flex flex-col">
                                <span className="font-bold text-[color:var(--color-text)] text-sm">{pdv.name}</span>
                                <span className="text-[10px] text-slate-400">{pdv.address}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="text-sm font-medium text-[color:var(--color-muted)]">
                            {pdv.city}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span className="font-bold text-[color:var(--color-text)] bg-slate-100 px-2 py-1 rounded-lg text-xs">
                            {pdv.visits}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg text-xs">
                            {pdv.productsChecked}
                          </span>
                        </td>
                         <td className="p-4 text-center">
                          {pdv.ruptures > 0 ? (
                            <span className="font-bold text-red-600 bg-red-50 px-2 py-1 rounded-lg text-xs">
                              {pdv.ruptures}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1">
                            {Array.from(pdv.promoters).map((prom, i) => (
                              <span key={i} className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-1 rounded-full border border-blue-100">
                                {prom}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {pdvReport.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400 font-medium">
                          Nenhum dado de PDV encontrado para os filtros selecionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="p-4 font-black text-xs text-slate-400 uppercase tracking-wider">PDV</th>
                      <th className="p-4 font-black text-xs text-slate-400 uppercase tracking-wider">Imagem</th>
                      <th className="p-4 font-black text-xs text-slate-400 uppercase tracking-wider">Produto</th>
                      <th className="p-4 font-black text-xs text-slate-400 uppercase tracking-wider">Marca</th>
                      <th className="p-4 font-black text-xs text-slate-400 uppercase tracking-wider">Validade</th>
                      <th className="p-4 font-black text-xs text-slate-400 uppercase tracking-wider">Quem Realizou</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {validityReport.map((pdv) => (
                      <React.Fragment key={pdv.id}>
                        <tr className="bg-slate-50/50">
                          <td colSpan={6} className="p-3 font-bold text-[color:var(--color-text)] border-y border-slate-100">
                             <div className="flex items-center gap-2">
                               <Store size={14} className="text-blue-500" />
                               {pdv.name}
                             </div>
                          </td>
                        </tr>
                        {pdv.items.map((item, idx) => (
                           <tr key={idx} className="hover:bg-slate-50 transition-colors">
                             <td className="p-3 pl-8 text-slate-400 text-xs">
                               -
                             </td>
                             <td className="p-3">
                                <div className="w-10 h-10 rounded-lg overflow-hidden border border-slate-100 bg-white">
                                  <ProductImage src={getImageUrl(item.productImage)} alt="" />
                                </div>
                              </td>
                             <td className="p-3 font-medium text-[color:var(--color-text)] text-sm">
                               {item.productName}
                             </td>
                             <td className="p-3 text-[color:var(--color-muted)] text-sm">
                               {item.brandName}
                             </td>
                             <td className="p-3 text-sm">
                                <div className="space-y-1.5">
                                  {renderValidityLine('Loja', (item as any).validityStoreDate, (item as any).validityStoreQuantity)}
                                  {renderValidityLine('Estoque', (item as any).validityStockDate, (item as any).validityStockQuantity)}
                                  {!(item as any).validityStoreDate && !(item as any).validityStockDate && (
                                    <div className="pt-1 border-t border-slate-100">
                                      {renderValidityLine('Geral', item.validityDate, item.validityQuantity)}
                                    </div>
                                  )}
                                </div>
                             </td>
                             <td className="p-3 text-sm text-[color:var(--color-muted)]">
                               {item.promoterName}
                               <div className="text-[10px] text-slate-400">
                                 {formatRouteDate(item.date)}
                               </div>
                             </td>
                           </tr>
                        ))}
                      </React.Fragment>
                    ))}
                    {validityReport.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">
                          Nenhum registro de validade encontrado para os filtros selecionados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

      {/* Detail Modal */}
      {selectedRoute && (
        <div className="fixed inset-0 bg-slate-900/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50/50 sticky top-0 z-10">
              <div>
                <h2 className="text-xl font-black text-[color:var(--color-text)]">Detalhes da Rota</h2>
                <div className="flex items-center gap-4 mt-2 text-sm text-[color:var(--color-muted)] flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <Calendar size={14} />
                    {formatRouteDate(selectedRoute.date)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <User size={14} />
                    Equipe: <strong className="text-[color:var(--color-text)]">
                      {((selectedRoute.promoters && selectedRoute.promoters.length > 0) ? selectedRoute.promoters : (selectedRoute.promoter ? [selectedRoute.promoter] : [])).map((p: any) => p.fullName || p.name).join(', ')}
                    </strong>
                  </span>
                  {selectedRoute.promoter.supervisor && (
                    <span className="flex items-center gap-1.5">
                      <Users size={14} />
                    Supervisor: <strong className="text-[color:var(--color-text)]">{selectedRoute.promoter.supervisor.fullName}</strong>
                  </span>
                )}
                {calculateTotalRouteDuration(selectedRoute.items) && (
                  <span className="flex items-center gap-1.5 ml-4 px-3 py-1 bg-blue-50 text-blue-700 rounded-lg font-bold border border-blue-100">
                    <Clock size={14} />
                    Tempo Total: {calculateTotalRouteDuration(selectedRoute.items)}
                  </span>
                )}
              </div>
            </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      setLoading(true);
                      const loadingToast = toast.loading('Atualizando dados da rota...');
                      
                      fetchRoutes().then(() => {
                        api.get(`/routes/${selectedRoute.id}`).then(res => {
                             console.log('Route updated:', res.data);
                             if (res.data.items) {
                               res.data.items.forEach((i: any) => console.log(`Item ${i.id} categoryPhotos:`, i.categoryPhotos));
                             }
                             setSelectedRoute(res.data);
                             setLoading(false);
                             toast.success('Dados atualizados com sucesso!', { id: loadingToast });
                        }).catch(err => {
                            console.error('Error updating route details:', err);
                            setLoading(false);
                            toast.error('Erro ao atualizar detalhes da rota.', { id: loadingToast });
                        });
                      }).catch(err => {
                          console.error('Error fetching routes list:', err);
                          setLoading(false);
                          toast.error('Erro ao atualizar lista de rotas.', { id: loadingToast });
                      });
                    }}
                    className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-[color:var(--color-muted)] hover:bg-slate-50 hover:text-blue-500 transition-all flex-shrink-0"
                    title="Atualizar dados da rota"
                  >
                    <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                  </button>
                  <button 
                    onClick={() => setSelectedRoute(null)}
                    className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-[color:var(--color-muted)] hover:bg-slate-50 hover:text-red-500 transition-all flex-shrink-0"
                  >
                    <X size={20} />
                  </button>
                </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-8 bg-slate-50/30 flex-1">
              {selectedRoute.items.map((item, index) => (
                <div key={item.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
                  item.products.some(p => p.isStockout) 
                    ? 'border-red-200 ring-2 ring-red-100 shadow-red-50' 
                    : 'border-slate-200'
                }`}>
                  {/* Item Header */}
                  <div className={`p-4 border-b flex flex-wrap items-center gap-4 ${
                    item.products.some(p => p.isStockout)
                      ? 'bg-red-50/30 border-red-100'
                      : 'bg-slate-50/50 border-slate-100'
                  }`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      item.products.some(p => p.isStockout)
                        ? 'bg-red-600 text-white'
                        : 'bg-slate-900 text-white'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-[color:var(--color-text)]">{item.supermarket.fantasyName}</h3>
                      <div className="flex items-center gap-2 text-xs text-[color:var(--color-muted)] mt-0.5">
                        <MapPin size={12} />
                        {(() => {
                           const s = item.supermarket;
                           const parts = [
                             s.street, 
                             s.number, 
                             s.neighborhood,
                             s.city,
                             s.state
                           ].filter(Boolean);
                           return parts.length > 0 ? parts.join(', ') : `${s.city || 'Cidade não inf.'} - ${s.state || 'UF'}`;
                        })()}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {isAdmin && (
                         <button 
                           onClick={() => openManualEntry(item, selectedRoute.promoterId || selectedRoute.promoter.id)}
                           className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors"
                         >
                           <Edit size={14} />
                           {['CHECKOUT', 'COMPLETED'].includes(item.status) ? 'Editar Execução' : 'Lançamento Manual'}
                         </button>
                      )}

                      <div className="flex items-center gap-2 text-xs font-bold text-[color:var(--color-muted)] bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                        <Clock size={14} className="text-slate-400" />
                        <span>In: {formatTime(item.checkInTime)}</span>
                        <span className="text-slate-300">|</span>
                        <span>Out: {formatTime(item.checkOutTime)}</span>
                      </div>
                      
                      {item.manualEntryBy && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200" title={`Lançado manualmente por ${item.manualEntryBy} em ${new Date(item.manualEntryAt!).toLocaleString('pt-BR')}`}>
                          <Monitor size={14} />
                          Verificado por {item.manualEntryBy} em {new Date(item.manualEntryAt!).toLocaleString('pt-BR')}
                        </div>
                      )}

                      <div className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                        ['CHECKOUT', 'COMPLETED'].includes(item.status) 
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                          : 'bg-slate-100 text-[color:var(--color-muted)] border-slate-200'
                      }`}>
                        {item.status}
                      </div>
                    </div>
                  </div>

                  {/* Category Photos Section */}
                  {item.categoryPhotos && Object.keys(item.categoryPhotos).length > 0 && (
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                      <h4 className="text-xs font-bold text-[color:var(--color-muted)] uppercase tracking-wider mb-2 flex items-center gap-2">
                        <ImageIcon size={14} />
                        Fotos da Gôndola / Categoria
                      </h4>
                      <div className="space-y-4">
                        {Object.entries(item.categoryPhotos).map(([catId, photosData]) => {
                           if (!photosData) return null;
                           
                           // Extract photos by type
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

                           // Helper to render photo list
                           const renderPhotoList = (photos: string[], label: string) => (
                             photos.length > 0 && (
                               <div className="mb-2 last:mb-0">
                                 <span className="text-[10px] font-bold text-slate-400 uppercase mb-1 block pl-1">{label}</span>
                                 <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                                   {photos.map((photo, idx) => (
                                      <a 
                                        key={`${catId}-${label}-${idx}`}
                                        href={getImageUrl(photo)} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="block w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden border border-slate-200 shadow-sm hover:ring-2 ring-blue-500 transition-all group relative"
                                      >
                                        <img src={getImageUrl(photo)} alt={`${catId} ${label}`} className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                      </a>
                                   ))}
                                 </div>
                               </div>
                             )
                           );

                           return (
                             <div key={catId} className="border-l-2 border-slate-300 pl-3 py-1">
                               <h5 className="font-bold text-sm text-[color:var(--color-text)] mb-2 bg-slate-100 px-2 py-1 rounded inline-block">{catId}</h5>
                               {renderPhotoList(beforePhotos, 'Antes')}
                               {renderPhotoList(afterPhotos, 'Depois')}
                               {renderPhotoList(storagePhotos, 'Estoque')}
                               {renderPhotoList(legacyPhotos, 'Geral')}
                             </div>
                           );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Products Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm min-w-[1200px]">
                      <thead className="bg-slate-50 text-[color:var(--color-muted)] font-bold text-xs uppercase border-b border-slate-100">
                        <tr>
                          <th className="p-3 w-10">#</th>
                          <th className="p-3 w-[200px]">Produto</th>
                          <th className="p-3 w-[120px]">Marca</th>
                          <th className="p-3 w-[100px]">Quem</th>
                          <th className="p-3 w-[120px]">Estoque</th>
                          <th className="p-3 w-[80px]">Total</th>
                          <th className="p-3 w-[180px]">Checklist</th>
                          <th className="p-3 w-[120px]">Validade</th>
                          <th className="p-3 w-[120px]">Status</th>
                          <th className="p-3 w-[150px]">Fotos</th>
                          <th className="p-3 min-w-[200px]">Observação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {item.products.map((p, pIndex) => (
                          <tr key={p.id} className={p.isStockout ? 'bg-red-50/30' : ''}>
                            <td className="p-3 text-slate-400 text-xs">{pIndex + 1}</td>
                            <td className="p-3 font-medium text-[color:var(--color-text)]">
                                <div className="line-clamp-2" title={p.product.name}>{p.product.name}</div>
                            </td>
                            <td className="p-3 text-[color:var(--color-muted)]">
                                <div className="truncate max-w-[120px]" title={p.product.brand?.name}>{p.product.brand?.name || '-'}</div>
                            </td>
                            <td className="p-3 text-xs font-bold text-[color:var(--color-muted)]">
            {p.completedBy ? (
                <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-md border border-blue-100 whitespace-nowrap">
                    {p.completedBy.fullName}
                </span>
            ) : '-'}
        </td>
                            <td className="p-3 text-xs">
                              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                                <div>
                                  <span className="block text-[10px] text-slate-400">Loja</span>
                                  <span className="font-bold">{p.gondolaCount ?? '-'}</span>
                                </div>
                                <div>
                                  <span className="block text-[10px] text-slate-400">Estoque</span>
                                  <span className="font-bold">{p.inventoryCount ?? '-'}</span>
                                </div>
                              </div>
                            </td>
                            <td className="p-3 text-xs font-bold text-[color:var(--color-text)]">
                                {((p.gondolaCount !== undefined && p.gondolaCount !== null) || (p.inventoryCount !== undefined && p.inventoryCount !== null)) ? 
                                  ((Number(p.gondolaCount) || 0) + (Number(p.inventoryCount) || 0)) 
                                  : (p.stockCount !== undefined && p.stockCount !== null ? p.stockCount : '-')}
                            </td>
                            <td className="p-3 text-xs text-[color:var(--color-text)]">
                                {p.product.checklistTemplate?.title && (
                                    <div className="mb-1 pb-1 border-b border-slate-100">
                                        <span className="text-[10px] font-bold text-[color:var(--color-text)] bg-slate-200 px-1 rounded block w-fit truncate max-w-full">
                                            {p.product.checklistTemplate.title}
                                        </span>
                                    </div>
                                )}
                                {p.checklists && p.checklists.length > 0 ? (
                                    <div className="flex flex-col gap-1 max-h-[100px] overflow-y-auto">
                                        {p.checklists.map((c: any, cIdx: number) => (
                                            <div key={c.id || cIdx} className="flex flex-col border-b last:border-0 border-slate-100 pb-1 last:pb-0">
                                                <span className="font-semibold text-[10px] text-[color:var(--color-muted)] truncate" title={c.description}>{c.description}</span>
                                                {c.competitorName && (
                                                    <span className="text-[10px] text-orange-600 font-bold truncate">{c.competitorName}</span>
                                                )}
                                                <div className="flex items-center gap-1">
                                                    {c.type === 'BINARY' ? (
                                                        c.isChecked ? 
                                                            <span className="text-emerald-600 font-bold flex items-center gap-1 text-[10px]"><CheckCircle2 size={10}/> Sim</span> : 
                                                            <span className="text-red-500 font-bold flex items-center gap-1 text-[10px]"><XCircle size={10}/> Não</span>
                                                    ) : (
                                                        <span className="font-mono bg-slate-100 px-1 rounded text-[color:var(--color-text)] text-[10px]">
                                                            {c.type === 'PRICE_CHECK' ? 'R$ ' : ''}{c.value || '-'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-slate-300">-</span>
                                )}
                            </td>
                            <td className="p-3 text-xs">
                              <div className="space-y-1.5">
                                {renderValidityLine('Loja', (p as any).validityStoreDate, (p as any).validityStoreQuantity)}
                                {renderValidityLine('Estoque', (p as any).validityStockDate, (p as any).validityStockQuantity)}
                                {!(p as any).validityStoreDate && !(p as any).validityStockDate && (
                                  <div className="pt-1 border-t border-slate-100">
                                    {renderValidityLine('Geral', p.validityDate, (p as any).validityQuantity ?? p.validityQuantity)}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-xs">
                              <div className="space-y-1.5">
                                {p.checkInTime && p.checkOutTime && (
                                    <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-[10px] font-bold block w-fit">
                                      {formatDuration(p.checkInTime, p.checkOutTime)}
                                    </span>
                                )}
                                {p.isStockout ? (
                                    <span className="inline-flex items-center gap-1 text-red-600 font-bold">
                                      <AlertTriangle size={12} /> Ruptura
                                    </span>
                                ) : p.checked ? (
                                    <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                                      <CheckCircle2 size={12} /> Verificado
                                    </span>
                                ) : (
                                    <span className="text-slate-400">-</span>
                                )}
                              </div>
                            </td>
                            <td className="p-3">
                              {p.photos && p.photos.length > 0 ? (
                                <div className="flex gap-1 overflow-x-auto max-w-[150px] py-1 scrollbar-thin">
                                  {p.photos.map((photo, i) => (
                                    <a 
                                      key={i} 
                                      href={getImageUrl(photo)} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="block w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden border border-slate-200 shadow-sm hover:ring-2 ring-blue-500 transition-all"
                                      onClick={(e) => e.stopPropagation()} // Prevent row click if any
                                    >
                                      <img src={getImageUrl(photo)} alt="Produto" className="w-full h-full object-cover" />
                                    </a>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-300 text-xs">-</span>
                              )}
                            </td>
                            <td className="p-3 text-[color:var(--color-muted)] italic text-xs">
                              <div className="max-w-[200px] truncate" title={p.observation || ''}>
                                {p.observation || '-'}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Manual Entry Modal */}
      {manualForm && (
        <div className="fixed inset-0 bg-slate-900/50 z-[110] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white w-full max-w-3xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
               <h2 className="text-xl font-black text-[color:var(--color-text)]">Lançamento Manual de Visita</h2>
               <button 
                  onClick={() => setManualForm(null)}
                  className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-[color:var(--color-muted)] hover:bg-slate-50 transition-all"
                >
                  <X size={20} />
                </button>
             </div>
             
             <div className="flex-1 overflow-y-auto p-6 space-y-6">
               {/* Header Inputs */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[color:var(--color-muted)] mb-1">Horário Entrada</label>
                    <input 
                      type="datetime-local" 
                      value={manualForm.checkInTime}
                      onChange={e => setManualForm({...manualForm, checkInTime: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[color:var(--color-muted)] mb-1">Horário Saída</label>
                    <input 
                      type="datetime-local" 
                      value={manualForm.checkOutTime}
                      onChange={e => setManualForm({...manualForm, checkOutTime: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-[color:var(--color-muted)] mb-1">Promotor Responsável</label>
                    <select 
                      value={manualForm.promoterId}
                      onChange={e => setManualForm({...manualForm, promoterId: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500"
                    >
                      <option value="">Selecione um promotor...</option>
                      {promotersList.map(p => (
                        <option key={p.id} value={p.id}>{p.fullName}</option>
                      ))}
                    </select>
                  </div>
               </div>

               {/* Products List */}
               <div className="space-y-4">
                 <h3 className="font-bold text-[color:var(--color-text)]">Produtos da Rota</h3>
                 {manualForm.products.map((prod, idx) => (
                   <div key={prod.productId} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                     <div className="flex items-center justify-between">
                        <span className="font-bold text-[color:var(--color-text)]">{prod.productName}</span>
                        <div className="flex items-center gap-4">
                         <div className="flex items-center gap-2">
                           <label className="text-xs font-bold text-[color:var(--color-muted)]">Validade Loja:</label>
                           <input
                             type="date"
                             value={(prod as any).validityStoreDate || ''}
                             onChange={e => {
                               const newProds = [...manualForm.products];
                               (newProds[idx] as any).validityStoreDate = e.target.value;
                               const overall = getOverallValidity(newProds[idx] as any);
                               newProds[idx].validityDate = overall?.date || '';
                               newProds[idx].validityQuantity = overall?.qty || undefined;
                               setManualForm({ ...manualForm, products: newProds });
                             }}
                             className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 w-32"
                           />
                           <span className="text-xs font-bold text-[color:var(--color-muted)] ml-2">Qtd:</span>
                           <input
                             type="number"
                             min={0}
                             value={(prod as any).validityStoreQuantity ?? ''}
                             onChange={e => {
                               const newProds = [...manualForm.products];
                               const val = e.target.value === '' ? undefined : parseInt(e.target.value || '0') || 0;
                               (newProds[idx] as any).validityStoreQuantity = val;
                               const overall = getOverallValidity(newProds[idx] as any);
                               newProds[idx].validityDate = overall?.date || '';
                               newProds[idx].validityQuantity = overall?.qty || undefined;
                               setManualForm({ ...manualForm, products: newProds });
                             }}
                             className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 w-20"
                           />
                         </div>
                         <div className="flex items-center gap-2">
                           <label className="text-xs font-bold text-[color:var(--color-muted)]">Validade Estoque:</label>
                           <input
                             type="date"
                             value={(prod as any).validityStockDate || ''}
                             onChange={e => {
                               const newProds = [...manualForm.products];
                               (newProds[idx] as any).validityStockDate = e.target.value;
                               const overall = getOverallValidity(newProds[idx] as any);
                               newProds[idx].validityDate = overall?.date || '';
                               newProds[idx].validityQuantity = overall?.qty || undefined;
                               setManualForm({ ...manualForm, products: newProds });
                             }}
                             className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 w-32"
                           />
                           <span className="text-xs font-bold text-[color:var(--color-muted)] ml-2">Qtd:</span>
                           <input
                             type="number"
                             min={0}
                             value={(prod as any).validityStockQuantity ?? ''}
                             onChange={e => {
                               const newProds = [...manualForm.products];
                               const val = e.target.value === '' ? undefined : parseInt(e.target.value || '0') || 0;
                               (newProds[idx] as any).validityStockQuantity = val;
                               const overall = getOverallValidity(newProds[idx] as any);
                               newProds[idx].validityDate = overall?.date || '';
                               newProds[idx].validityQuantity = overall?.qty || undefined;
                               setManualForm({ ...manualForm, products: newProds });
                             }}
                             className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 w-20"
                           />
                         </div>
                         <div className="flex items-center gap-2">
                           <label className="text-xs font-bold text-[color:var(--color-muted)]">Estoque:</label>
                           <input 
                             type="number" 
                             placeholder="Qtd"
                             value={prod.stockCount ?? ''}
                             onChange={e => {
                               const newProds = [...manualForm.products];
                               newProds[idx].stockCount = e.target.value ? parseInt(e.target.value) : '';
                               setManualForm({...manualForm, products: newProds});
                             }}
                             className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 w-20"
                           />
                         </div>
                         <label className="flex items-center gap-2 text-sm font-medium text-[color:var(--color-muted)] cursor-pointer">
                           <input 
                             type="checkbox" 
                             checked={prod.checked}
                              onChange={e => {
                                const newProds = [...manualForm.products];
                                newProds[idx].checked = e.target.checked;
                                setManualForm({...manualForm, products: newProds});
                              }}
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                            />
                            Conferido
                          </label>
                          <label className="flex items-center gap-2 text-sm font-medium text-red-600 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={prod.isStockout}
                              onChange={e => {
                                const newProds = [...manualForm.products];
                                newProds[idx].isStockout = e.target.checked;
                                setManualForm({...manualForm, products: newProds});
                              }}
                              className="w-4 h-4 rounded text-red-600 focus:ring-red-500"
                            />
                            Ruptura
                          </label>
                        </div>
                     </div>
                     
                     {/* Checklist Items */}
                     {prod.checklists && prod.checklists.length > 0 && (
                        <div className="bg-slate-100 p-4 rounded-xl space-y-3 border border-slate-200">
                            <h4 className="text-xs font-bold text-[color:var(--color-muted)] uppercase flex items-center gap-2">
                                <List size={14} /> Checklist / Detalhes
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {prod.checklists.map((checkItem, cIdx) => (
                                <div key={cIdx} className="flex flex-col gap-1.5 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                                    <div className="flex justify-between items-start">
                                        <span className="text-sm font-medium text-[color:var(--color-text)] leading-tight">
                                            {checkItem.description} 
                                            {checkItem.competitorName && <span className="text-orange-600 font-bold ml-1 text-xs">({checkItem.competitorName})</span>}
                                        </span>
                                    </div>
                                    {checkItem.type === 'BINARY' ? (
                                        <div className="flex items-center gap-4 mt-1">
                                            <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-emerald-50 px-2 py-1 rounded transition-colors">
                                                <input 
                                                    type="radio"
                                                    name={`check_${idx}_${cIdx}`}
                                                    checked={checkItem.isChecked}
                                                    onChange={() => {
                                                        const newProds = [...manualForm.products];
                                                        if (newProds[idx].checklists) {
                                                            newProds[idx].checklists![cIdx].isChecked = true;
                                                        }
                                                        setManualForm({...manualForm, products: newProds});
                                                    }}
                                                    className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                                                />
                                                <span className={checkItem.isChecked ? 'font-bold text-emerald-700' : 'text-[color:var(--color-muted)]'}>Sim</span>
                                            </label>
                                            <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-red-50 px-2 py-1 rounded transition-colors">
                                                <input 
                                                    type="radio"
                                                    name={`check_${idx}_${cIdx}`}
                                                    checked={!checkItem.isChecked}
                                                    onChange={() => {
                                                        const newProds = [...manualForm.products];
                                                        if (newProds[idx].checklists) {
                                                            newProds[idx].checklists![cIdx].isChecked = false;
                                                        }
                                                        setManualForm({...manualForm, products: newProds});
                                                    }}
                                                    className="w-4 h-4 text-red-600 focus:ring-red-500"
                                                />
                                                <span className={!checkItem.isChecked ? 'font-bold text-red-700' : 'text-[color:var(--color-muted)]'}>Não</span>
                                            </label>
                                        </div>
                                    ) : (
                                        <div className="mt-1">
                                            <input 
                                                type="text" 
                                                placeholder={checkItem.type === 'PRICE_CHECK' ? 'R$ 0,00' : 'Valor'}
                                                value={checkItem.value || ''}
                                                onChange={e => {
                                                    const newProds = [...manualForm.products];
                                                    if (newProds[idx].checklists) {
                                                        newProds[idx].checklists![cIdx].value = e.target.value;
                                                    }
                                                    setManualForm({...manualForm, products: newProds});
                                                }}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:bg-white transition-colors"
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                            </div>
                        </div>
                     )}
                     
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <input 
                          type="text" 
                          placeholder="Observação (opcional)"
                          value={prod.observation}
                          onChange={e => {
                            const newProds = [...manualForm.products];
                            newProds[idx].observation = e.target.value;
                            setManualForm({...manualForm, products: newProds});
                          }}
                          className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500"
                       />
                       <div className="flex items-center gap-2">
                         <button 
                           onClick={() => openPhotoModal(idx)}
                           className="flex-1 flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-[color:var(--color-muted)] hover:bg-slate-50 transition-colors"
                         >
                           <Camera size={16} />
                           <span className="truncate">Adicionar Fotos</span>
                         </button>
                       </div>
                     </div>

                     {/* Thumbnails */}
                    {prod.photos && prod.photos.length > 0 && (
                      <div className="grid grid-cols-4 gap-2 py-1">
                        {prod.photos.map((pUrl, pIdx) => (
                          <div key={pIdx} className="aspect-square w-full rounded-lg overflow-hidden border border-slate-200 relative group">
                             <img 
                               src={getImageUrl(pUrl)} 
                               alt="" 
                               className="w-full h-full object-cover" 
                             />
                             <button 
                              onClick={() => {
                                const newProds = [...manualForm.products];
                                newProds[idx].photos = newProds[idx].photos.filter((_, i) => i !== pIdx);
                                setManualForm({...manualForm, products: newProds});
                              }}
                              className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                   </div>
                 ))}
               </div>
             </div>

             <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
               <button 
                 onClick={() => setManualForm(null)}
                 className="px-4 py-2 text-[color:var(--color-muted)] font-bold hover:bg-slate-200 rounded-xl transition-colors"
               >
                 Cancelar
               </button>
               <button 
                 onClick={submitManualEntry}
                 disabled={submitting}
                 className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 {submitting ? 'Salvando...' : 'Salvar Lançamento'}
                 <Save size={18} />
               </button>
             </div>
           </div>
        </div>
      )}
      {/* Photo Processing Modal */}
      {showPhotoModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-[120] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
               <h2 className="text-xl font-black text-[color:var(--color-text)]">Dados da Foto</h2>
               <button 
                  onClick={() => setShowPhotoModal(false)}
                  className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-[color:var(--color-muted)] hover:bg-slate-50 transition-all"
                >
                  <X size={20} />
                </button>
             </div>
             
             <div className="p-6 space-y-4">
                <p className="text-sm text-[color:var(--color-muted)]">
                  Informe os dados que serão estampados na marca d'água das fotos.
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[color:var(--color-muted)] mb-1">Data</label>
                    <input 
                      type="date"
                      value={photoMeta.date}
                      onChange={e => setPhotoMeta({...photoMeta, date: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[color:var(--color-muted)] mb-1">Hora</label>
                    <input 
                      type="time"
                      value={photoMeta.time}
                      onChange={e => setPhotoMeta({...photoMeta, time: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[color:var(--color-muted)] mb-1">Promotor</label>
                  <select 
                    value={photoMeta.promoterName}
                    onChange={e => setPhotoMeta({...photoMeta, promoterName: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500"
                  >
                    <option value="">Selecione um promotor...</option>
                    {promotersList.map(p => (
                        <option key={p.id} value={p.fullName || p.name}>{p.fullName || p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[color:var(--color-muted)] mb-1">PDV</label>
                  <input 
                    type="text"
                    value={photoMeta.pdvName}
                    readOnly
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-sm outline-none text-[color:var(--color-muted)] cursor-not-allowed"
                  />
                </div>
             </div>

             <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
               <button 
                 onClick={() => setShowPhotoModal(false)}
                 className="px-4 py-2 text-[color:var(--color-muted)] font-bold hover:bg-slate-200 rounded-xl transition-colors"
               >
                 Cancelar
               </button>
               <button 
                 onClick={handlePhotoModalConfirm}
                 className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2"
               >
                 Selecionar Fotos
                 <Camera size={18} />
               </button>
             </div>
           </div>
        </div>
      )}

      {/* Hidden File Input */}
      <input 
        type="file"
        ref={fileInputRef}
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
            handleFileSelect(e.target.files);
            e.target.value = '';
        }}
      />
      
      {/* Processing Indicator */}
      {processing && (
        <div className="fixed inset-0 bg-black/50 z-[130] flex items-center justify-center backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <div className="text-center">
                    <h3 className="text-lg font-bold text-[color:var(--color-text)]">Processando Fotos...</h3>
                    <p className="text-[color:var(--color-muted)] text-sm">Aguarde enquanto adicionamos a marca d'água.</p>
                </div>
            </div>
        </div>
      )}

      {groupBy === 'validity' && (
            <div className="divide-y divide-slate-100">
                {validityReport.map(pdv => (
                    <div key={pdv.id} className="p-6">
                        <h4 className="font-bold text-lg text-[color:var(--color-text)] mb-4 flex items-center gap-2">
                            <Store size={18} className="text-blue-500" />
                            {pdv.name}
                            <span className="text-sm font-normal text-[color:var(--color-muted)] ml-2">({pdv.items.length} produtos)</span>
                        </h4>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-[color:var(--color-muted)] font-bold">
                                    <tr>
                                        <th className="px-4 py-3 rounded-l-lg">Produto</th>
                                        <th className="px-4 py-3">Marca</th>
                                        <th className="px-4 py-3">Validade</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3">Verificado em</th>
                                        <th className="px-4 py-3 rounded-r-lg">Promotor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {pdv.items.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 font-medium text-[color:var(--color-text)]">{item.productName}</td>
                                            <td className="px-4 py-3 text-[color:var(--color-muted)]">{item.brandName}</td>
                                            <td className="px-4 py-3">
                                                {item.validityDate ? (
                                                    <span className={`font-bold ${
                                                        new Date(item.validityDate) < new Date() ? 'text-red-600' : 
                                                        new Date(item.validityDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) ? 'text-orange-600' : 'text-green-600'
                                                    }`}>
                                                        {new Date(item.validityDate).toLocaleDateString('pt-BR')}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {item.checked ? (
                                                    <span className="text-emerald-600 font-bold text-xs bg-emerald-50 px-2 py-1 rounded">Verificado</span>
                                                ) : (
                                                    <span className="text-slate-400 text-xs">Pendente</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-[color:var(--color-muted)]">
                                                {new Date(item.date).toLocaleDateString('pt-BR')}
                                            </td>
                                            <td className="px-4 py-3 text-[color:var(--color-muted)]">{item.promoterName}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
                {validityReport.length === 0 && (
                    <div className="p-12 text-center text-[color:var(--color-muted)]">
                        Nenhum registro de validade encontrado para os filtros selecionados.
                    </div>
                )}
            </div>
          )}
    </div>
  );
};

export default RoutesReportView;
