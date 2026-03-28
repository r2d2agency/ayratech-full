import React, { useState, useRef, useEffect } from 'react';
import { AlertTriangle, ArrowLeft, Camera, CheckCircle, Circle, MoreVertical, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ProductCountModal } from './ProductCountModal';
import { BreakageReportModal } from './BreakageReportModal';
import { offlineService } from '../services/offline.service';
import client from '../api/client';
import { processImage } from '../utils/image-processor';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import { resolveImageUrl } from '../utils/image';

type CategoryFlowMode = 'FULL' | 'ITEMS' | 'PHOTOS';
type PointType = 'natural' | 'extra';
type IncidentType = 'RUPTURE' | 'DEGUSTATION' | 'VALIDITY';

interface CategoryTaskFlowProps {
  routeItem: any;
  category?: string;
  categoryKey?: string;
  categoryLabel?: string;
  brandLabel?: string;
  products: any[];
  photoConfig?: {
    labels?: {
      before?: string;
      storage?: string;
      after?: string;
    };
    categories?: {
      [key: string]: {
        labels?: {
          before?: string;
          storage?: string;
          after?: string;
        };
      };
    };
  };
  onUpdateItem: (itemId: string, data: any, skipSync?: boolean) => Promise<void>;
  onUpdateProduct: (productId: string, data: any) => Promise<void>;
  onFinish: () => void;
  onBack: () => void;
  mode?: CategoryFlowMode;
  readOnly?: boolean;
}

const STEPS = {
  BEFORE_PHOTO: 0,
  PRODUCTS: 1,
  STOCK_PHOTOS: 2,
  AFTER_PHOTO: 3
};

export const CategoryTaskFlow: React.FC<CategoryTaskFlowProps> = ({
  routeItem,
  category,
  categoryKey,
  categoryLabel,
  brandLabel,
  products,
  photoConfig,
  onUpdateItem,
  onUpdateProduct,
  onFinish,
  onBack,
  mode = 'FULL',
  readOnly = false
}) => {
  const MIN_BEFORE_PHOTOS = 1;
  const [step, setStep] = useState(mode === 'ITEMS' ? STEPS.PRODUCTS : STEPS.BEFORE_PHOTO);
  const [selectedProduct, setSelectedProduct] = useState<{ pointType: 'natural' | 'extra'; product: any } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { branding } = useBranding();
  const [validationError, setValidationError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const initializedRef = useRef<string | null>(null);
  const [actionProduct, setActionProduct] = useState<any>(null);
  const [breakageProduct, setBreakageProduct] = useState<any>(null);
  const [incidentProduct, setIncidentProduct] = useState<any>(null);
  const [incidentType, setIncidentType] = useState<IncidentType | null>(null);
  const [incidentReasons, setIncidentReasons] = useState<Array<{ id: string; label: string }>>([]);
  const [incidentReasonId, setIncidentReasonId] = useState<string>('');
  const [incidentQuantity, setIncidentQuantity] = useState<number | ''>('');
  const [incidentDescription, setIncidentDescription] = useState<string>('');
  const [incidentLoading, setIncidentLoading] = useState(false);
  const [validityStoreDate, setValidityStoreDate] = useState<string>('');
  const [validityStoreQuantity, setValidityStoreQuantity] = useState<number | ''>('');
  const [validityStockDate, setValidityStockDate] = useState<string>('');
  const [validityStockQuantity, setValidityStockQuantity] = useState<number | ''>('');

  const [pointType, setPointType] = useState<PointType>('natural');
  const [extraSearch, setExtraSearch] = useState('');
  const [extraSelectedProductIds, setExtraSelectedProductIds] = useState<string[]>([]);
  const [extraProductChecks, setExtraProductChecks] = useState<Record<string, any>>({});

  const photosKey = categoryKey || categoryLabel || category || 'Categoria';
  const extraPhotosKey = `${photosKey}::EXTRA`;
  const stockPhotosRequired = (products || []).some((p: any) => !!p?.requiresStockPhotos);

  useEffect(() => {
    const key = `${categoryKey || ''}-${categoryLabel || category || ''}-${mode}`;
    if (initializedRef.current === key) return;
    initializedRef.current = key;

    setPointType('natural');
    setExtraSearch('');
    const storedExtra = routeItem?.categoryPhotos?.[`${photosKey}::EXTRA`]?.extraProducts;
    if (Array.isArray(storedExtra)) {
      setExtraSelectedProductIds(storedExtra.map((x: any) => String(x)));
    } else {
      setExtraSelectedProductIds([]);
    }
    const storedExtraChecks = routeItem?.categoryPhotos?.[`${photosKey}::EXTRA`]?.extraProductChecks;
    if (storedExtraChecks && typeof storedExtraChecks === 'object') {
      setExtraProductChecks(storedExtraChecks as Record<string, any>);
    } else {
      setExtraProductChecks({});
    }

    if (mode === 'ITEMS') {
      setStep(STEPS.PRODUCTS);
      return;
    }

    setStep(STEPS.BEFORE_PHOTO);
  }, [category, categoryKey, categoryLabel, mode, routeItem?.id]);

  useEffect(() => {
    if (!incidentProduct || !incidentType || readOnly) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await client.get('/incident-reasons', { params: { type: incidentType } });
        const list = Array.isArray(res.data) ? res.data : [];
        const normalized = list
          .filter((r: any) => r && r.id && r.label)
          .map((r: any) => ({ id: String(r.id), label: String(r.label) }));

        if (cancelled) return;
        setIncidentReasons(normalized);
      } catch {
        if (cancelled) return;
        setIncidentReasons([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [incidentProduct, incidentType, readOnly]);

  const categoryTitle = (() => {
    const label = categoryLabel || category || 'Categoria';
    if (brandLabel) return `${brandLabel} • ${label}`;
    return label;
  })();

  const getLabel = (type: 'before' | 'storage' | 'after') => {
    const categoryConfig = photoConfig?.categories?.[categoryLabel || category || ''];
    const defaultLabels = photoConfig?.labels;
    
    if (categoryConfig?.labels?.[type]) return categoryConfig.labels[type];
    if (defaultLabels?.[type]) return defaultLabels[type];
    
    switch(type) {
      case 'before': return 'Foto Antes';
      case 'storage': return 'Fotos do Estoque';
      case 'after': return 'Foto Depois';
      default: return 'Foto';
    }
  };

  const getCategoryPhotos = (keyOverride?: string) => {
    const key = keyOverride || photosKey;
    return routeItem.categoryPhotos?.[key] || {};
  };

  const isStockCountRequired = (p: any) => {
    const hasStockInChecklists =
      Array.isArray(p.checklists) &&
      p.checklists.some((c: any) => c?.type === 'STOCK_COUNT');

    return hasStockInChecklists;
  };

  const getChecklists = (p: any) => (Array.isArray(p?.checklists) ? p.checklists : []);

  const isExtraSelected = (p: any) => extraSelectedProductIds.includes(String(p?.productId));

  const getProductForPoint = (p: any, pt: 'natural' | 'extra') => {
    if (pt === 'natural') return p;
    const pid = String(p?.productId);
    const stored = extraProductChecks?.[pid];

    const baseChecklists = Array.isArray(p?.checklists)
      ? p.checklists.map((c: any) => ({ ...c, isChecked: false, value: undefined }))
      : p?.checklists;

    const base = {
      ...p,
      checked: false,
      isStockout: false,
      ruptureReason: undefined,
      gondolaCount: undefined,
      inventoryCount: undefined,
      stockCount: undefined,
      validityDate: undefined,
      validityQuantity: undefined,
      validityStoreDate: undefined,
      validityStoreQuantity: undefined,
      validityStockDate: undefined,
      validityStockQuantity: undefined,
      checklists: baseChecklists,
    };

    if (!stored) return base;
    return { ...base, ...stored, product: p.product };
  };

  const isValidityChecklistItem = (item: any) => {
    const desc = (item?.description || '').toLowerCase();
    if (item?.type === 'VALIDITY_CHECK') return true;
    if (desc.includes('vencimento') || desc.includes('venci') || desc.includes('validade')) return true;
    return false;
  };

  const isIgnoredChecklistItem = (item: any) => {
    if (item?.type === 'PHOTO') return true;
    const desc = (item?.description || '').toLowerCase();
    if (desc.includes('gondola') && desc.includes('foto')) return true;
    return false;
  };

  const hasNonStockChecklist = (p: any) => {
    const cl = getChecklists(p);
    return cl.some((c: any) => c?.type !== 'STOCK_COUNT' && !isIgnoredChecklistItem(c));
  };

  const hasInteractiveChecklist = (p: any) => {
    const cl = getChecklists(p);
    return cl.some((c: any) => {
      if (c?.type === 'STOCK_COUNT') return false;
      if (isIgnoredChecklistItem(c)) return false;
      if (isValidityChecklistItem(c)) return true;
      return c?.type === 'PRICE_CHECK';
    });
  };

  const canOpenProduct = (p: any) => isStockCountRequired(p) || hasInteractiveChecklist(p);

  const isProductRequiredForProgress = (p: any) => isStockCountRequired(p) || hasNonStockChecklist(p);

  const getProductProgressFraction = (p: any) => {
    const cl = getChecklists(p);
    const requiresStockCount = cl.some((c: any) => c?.type === 'STOCK_COUNT');
    if (requiresStockCount) {
      const storeDone = p.gondolaCount !== null && p.gondolaCount !== undefined;
      const stockDone = p.inventoryCount !== null && p.inventoryCount !== undefined;
      return (Number(storeDone) + Number(stockDone)) / 2;
    }
    return isProductCountComplete(p) ? 1 : 0;
  };

  const isProductCountComplete = (p: any) => {
    const cl = getChecklists(p);
    const requiresStockCount = cl.some((c: any) => c?.type === 'STOCK_COUNT');

    const hasNonStock = cl.some((c: any) => c?.type !== 'STOCK_COUNT');

    if (!requiresStockCount && !hasNonStock) return !!p.checked;

    if (requiresStockCount) {
      const gDone = p.gondolaCount !== null && p.gondolaCount !== undefined;
      const iDone = p.inventoryCount !== null && p.inventoryCount !== undefined;
      if (!gDone || !iDone) return false;
      const totalCount = Number(p.gondolaCount || 0) + Number(p.inventoryCount || 0);
      const hasRupture = !!p.ruptureReason || !!p.isStockout;
      return totalCount > 0 ? true : hasRupture;
    }

    const requiredChecklists = cl.filter((c: any) => c?.type !== 'STOCK_COUNT' && !isIgnoredChecklistItem(c));
    const allChecked = requiredChecklists.every((c: any) => !!c?.isChecked);
    if (!allChecked) return false;

    const needsValidity = cl.some((c: any) => isValidityChecklistItem(c));
    if (needsValidity) {
      if (!p.validityDate) return false;
      if (p.validityQuantity === null || p.validityQuantity === undefined || p.validityQuantity <= 0) return false;
    }

    return true;
  };

  const areAllProductsComplete = () => {
    const catProducts = products || [];
    if (!catProducts.length) return true;
    return catProducts.every((p: any) => {
      if (isProductRequiredForProgress(p) && !isProductCountComplete(p)) return false;
      if (isExtraSelected(p)) {
        const extraView = getProductForPoint(p, 'extra');
        if (!isProductCountComplete(extraView)) return false;
      }
      return true;
    });
  };

  const getBeforeCount = (keyOverride?: string) => {
    const photos = getCategoryPhotos(keyOverride);
    return Array.isArray(photos.before) ? photos.before.length : (photos.before ? 1 : 0);
  };

  const getAfterCount = (keyOverride?: string) => {
    const photos = getCategoryPhotos(keyOverride);
    return Array.isArray(photos.after) ? photos.after.length : (photos.after ? 1 : 0);
  };

  const getStorageCount = (keyOverride?: string) => {
    const photos = getCategoryPhotos(keyOverride);
    const storage = (photos as any).storage;
    return Array.isArray(storage) ? storage.length : (storage ? 1 : 0);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'before' | 'after' | 'storage') => {
    if (readOnly) return;
    if (!e.target.files || !e.target.files[0]) return;
    
    setUploading(true);
    const file = e.target.files[0];
    const storageKey = pointType === 'extra' ? extraPhotosKey : photosKey;

    try {
      const supermarketName = routeItem.supermarket?.fantasyName || routeItem.supermarket?.name || 'PDV';
      const promoterName = user?.name || 'Promotor';

      const { blob, previewUrl } = await processImage(file, {
        supermarketName,
        promoterName,
        timestamp: new Date(),
        blurThreshold: branding?.blurThreshold
      });

      const formData = new FormData();
            formData.append('type', type);
            formData.append('category', storageKey);
            formData.append('file', blob, 'photo.jpg');

      try {
        const res = await client.post(`/routes/items/${routeItem.id}/photos`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        const photoUrl = res.data.url || res.data.path || previewUrl;

        const currentPhotos = getCategoryPhotos(storageKey);
        const currentList = Array.isArray(currentPhotos[type]) ? currentPhotos[type] : (currentPhotos[type] ? [currentPhotos[type]] : []);
        const updatedPhotos = {
          ...routeItem.categoryPhotos,
          [storageKey]: {
            ...currentPhotos,
            [type]: [...currentList, photoUrl]
          }
        };

        if (storageKey === extraPhotosKey) {
          updatedPhotos[extraPhotosKey] = {
            ...updatedPhotos[extraPhotosKey],
            extraProducts: extraSelectedProductIds
          };
        }

        await onUpdateItem(routeItem.id, { categoryPhotos: updatedPhotos });
        toast.success('Foto salva!');
      } catch (uploadError: any) {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const base64data = String(reader.result);
          const currentPhotos = getCategoryPhotos(storageKey);
          const currentList = Array.isArray(currentPhotos[type]) ? currentPhotos[type] : (currentPhotos[type] ? [currentPhotos[type]] : []);
          const updatedPhotos = {
            ...routeItem.categoryPhotos,
            [storageKey]: {
              ...currentPhotos,
              [type]: [...currentList, base64data]
            }
          };
          await onUpdateItem(routeItem.id, { categoryPhotos: updatedPhotos }, true);
          if (storageKey === extraPhotosKey) {
            updatedPhotos[extraPhotosKey] = {
              ...updatedPhotos[extraPhotosKey],
              extraProducts: extraSelectedProductIds
            };
          }

          await offlineService.addPendingAction(
            'PHOTO',
            `/routes/items/${routeItem.id}/photos`,
            'POST',
            {
              fileBase64: base64data,
              filename: 'photo.jpg',
              photoType: type,
              category: storageKey
            }
          );
          // Toast feedback is handled by offlineService
        };
      }
    } catch (error: any) {
      const message = error?.message || 'Erro ao processar foto.';
      if (message.includes('borrada') || message.includes('escura') || message.includes('clara')) {
        setValidationError(message);
      } else {
        toast.error(message);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };
  
  const handlePhotoRemove = async (type: 'before' | 'after' | 'storage', index: number) => {
    const storageKey = pointType === 'extra' ? extraPhotosKey : photosKey;
    const currentPhotos = getCategoryPhotos(storageKey);
    const currentList = Array.isArray(currentPhotos[type]) ? currentPhotos[type] : (currentPhotos[type] ? [currentPhotos[type]] : []);
    const newList = currentList.filter((_: string, i: number) => i !== index);
    const updatedPhotos = {
      ...routeItem.categoryPhotos,
      [storageKey]: {
        ...currentPhotos,
        [type]: newList
      }
    };
    if (storageKey === extraPhotosKey) {
      updatedPhotos[extraPhotosKey] = {
        ...updatedPhotos[extraPhotosKey],
        extraProducts: extraSelectedProductIds
      };
    }
    await onUpdateItem(routeItem.id, { categoryPhotos: updatedPhotos });
    toast.success('Foto removida.');
  };

  const handleProductSave = async (productId: string, data: any) => {
    try {
      const pt = selectedProduct?.pointType || 'natural';
      if (pt === 'extra') {
        const pid = String(productId);
        const nextChecks = {
          ...extraProductChecks,
          [pid]: { ...(extraProductChecks?.[pid] || {}), ...data }
        };
        setExtraProductChecks(nextChecks);

        const currentExtra = getCategoryPhotos(extraPhotosKey);
        const updatedPhotos: any = {
          ...(routeItem.categoryPhotos || {}),
          [extraPhotosKey]: {
            ...currentExtra,
            extraProducts: extraSelectedProductIds,
            extraProductChecks: nextChecks
          }
        };
        await onUpdateItem(routeItem.id, { categoryPhotos: updatedPhotos });
      } else {
        await onUpdateProduct(productId, data);
      }
      setSelectedProduct(null);
      toast.success('Salvo com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar produto:', error);
      toast.error('Erro ao salvar. Tente novamente.');
    }
  };

  const prevStep = () => {
    if (mode === 'ITEMS') {
      onBack();
      return;
    }

    if (step === STEPS.BEFORE_PHOTO) {
      onBack();
      return;
    }

    if (step === STEPS.PRODUCTS) {
      setStep(STEPS.BEFORE_PHOTO);
      return;
    }

    if (step === STEPS.STOCK_PHOTOS) {
      setStep(STEPS.PRODUCTS);
      return;
    }

    setStep(stockPhotosRequired ? STEPS.STOCK_PHOTOS : STEPS.PRODUCTS);
  };

  const finalizeCategory = () => {
    const beforeOk = getBeforeCount(photosKey) >= MIN_BEFORE_PHOTOS;
    const productsOk = mode === 'FULL' ? areAllProductsComplete() : true;
    const storageOk = !stockPhotosRequired ? true : getStorageCount(photosKey) >= 2;
    const afterOk = getAfterCount(photosKey) > 0;
    const extraActive = extraSelectedProductIds.length > 0;
    const extraAfterOk = !extraActive ? true : getAfterCount(extraPhotosKey) > 0;

    if (!beforeOk) {
      toast.error('Faça a Foto Antes para finalizar.');
      setStep(STEPS.BEFORE_PHOTO);
      return;
    }
    if (mode === 'FULL' && !productsOk) {
      toast.error('Conclua os produtos para finalizar.');
      setStep(STEPS.PRODUCTS);
      return;
    }
    if (!storageOk) {
      toast.error('Registre as Fotos do Estoque (Antes / Depois) para finalizar.');
      setStep(STEPS.STOCK_PHOTOS);
      return;
    }
    if (!afterOk) {
      toast.error('Registre a Foto Depois para finalizar.');
      setStep(STEPS.AFTER_PHOTO);
      return;
    }
    if (!extraAfterOk) {
      toast.error('Registre a Foto Depois do Ponto Extra para finalizar.');
      setPointType('extra');
      setStep(STEPS.AFTER_PHOTO);
      return;
    }

    onFinish();
  };

  useEffect(() => {
    if (mode === 'ITEMS') return;

    const beforeOk = getBeforeCount(photosKey) >= MIN_BEFORE_PHOTOS;
    const productsOk = mode === 'FULL' ? areAllProductsComplete() : true;
    const storageOk = !stockPhotosRequired ? true : getStorageCount(photosKey) >= 2;

    if (step === STEPS.PRODUCTS && !beforeOk) {
      setStep(STEPS.BEFORE_PHOTO);
      return;
    }

    if (step === STEPS.STOCK_PHOTOS && (!beforeOk || !productsOk)) {
      setStep(beforeOk ? STEPS.PRODUCTS : STEPS.BEFORE_PHOTO);
      return;
    }

    if (step === STEPS.AFTER_PHOTO && (!beforeOk || !productsOk || !storageOk)) {
      setStep(!beforeOk ? STEPS.BEFORE_PHOTO : !productsOk ? STEPS.PRODUCTS : STEPS.STOCK_PHOTOS);
    }
  }, [mode, step, routeItem.categoryPhotos, products, stockPhotosRequired]);

  const renderPhotoStep = (type: 'before' | 'after', title: string, description: string) => {
    const beforeOk = getBeforeCount(photosKey) >= MIN_BEFORE_PHOTOS;
    const productsOk = mode === 'FULL' ? areAllProductsComplete() : true;

    if (type === 'after' && (!beforeOk || !productsOk)) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center gap-3">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center text-orange-600">
            <AlertTriangle size={28} />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-gray-900">Etapa bloqueada</h2>
            <p className="text-sm text-gray-600">
              Envie a Foto Antes e conclua os produtos obrigatórios para liberar a Foto Depois.
            </p>
          </div>
          <div className="w-full max-w-sm flex gap-3">
            <button
              type="button"
              onClick={() => setStep(STEPS.BEFORE_PHOTO)}
              className="flex-1 py-3 bg-white text-gray-700 border border-gray-300 rounded-xl font-bold shadow-sm hover:bg-gray-50 transition-colors"
            >
              Foto Antes
            </button>
            <button
              type="button"
              onClick={() => setStep(beforeOk ? STEPS.PRODUCTS : STEPS.BEFORE_PHOTO)}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-sm hover:bg-blue-700 transition-colors"
            >
              Produtos
            </button>
          </div>
        </div>
      );
    }

    const storageKey = pointType === 'extra' ? extraPhotosKey : photosKey;
    const isExtra = pointType === 'extra';
    const photos = getCategoryPhotos(storageKey);
    const currentUrl = photos[type];
    const urls = Array.isArray(currentUrl) ? currentUrl : (currentUrl ? [currentUrl] : []);

    return (
      <>
      <div className="flex flex-col items-center h-full p-4 space-y-4 pb-48 overflow-y-auto">
        <div className="text-center space-y-1">
          <h2 className="text-xl font-bold text-gray-800">{title}</h2>
          <p className="text-sm text-gray-500">{description}</p>
        </div>

        <div className="w-full bg-white rounded-xl border border-gray-200 p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPointType('natural')}
              disabled={readOnly}
              className={`py-2 rounded-lg text-xs font-bold border ${
                pointType === 'natural'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Ponto Natural
            </button>
            <button
              type="button"
              onClick={() => setPointType('extra')}
              disabled={readOnly}
              className={`py-2 rounded-lg text-xs font-bold border ${
                pointType === 'extra'
                  ? 'bg-orange-600 text-white border-orange-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Ponto Extra
            </button>
          </div>

          {isExtra && type === 'before' && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-gray-700">Produtos no Ponto Extra</div>
              <input
                value={extraSearch}
                onChange={(e) => setExtraSearch(e.target.value)}
                placeholder="Pesquisar produto..."
                disabled={readOnly}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 outline-none disabled:bg-gray-100"
              />
              <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                {(products || [])
                  .slice()
                  .sort((a: any, b: any) =>
                    String(a?.product?.name || '').localeCompare(String(b?.product?.name || ''), 'pt-BR')
                  )
                  .filter((p: any) => {
                    const q = extraSearch.trim().toLowerCase();
                    if (!q) return true;
                    const name = String(p?.product?.name || '').toLowerCase();
                    const ean = String(p?.product?.ean || p?.product?.barcode || '');
                    return name.includes(q) || ean.includes(q);
                  })
                  .map((p: any) => {
                    const pid = String(p.productId);
                    const selected = extraSelectedProductIds.includes(pid);
                    return (
                      <button
                        key={pid}
                        type="button"
                        disabled={readOnly}
                        onClick={async () => {
                          if (readOnly) return;
                          const next = selected
                            ? extraSelectedProductIds.filter((x) => x !== pid)
                            : [...extraSelectedProductIds, pid];
                          setExtraSelectedProductIds(next);

                          const currentExtra = getCategoryPhotos(extraPhotosKey);
                          const updatedPhotos = {
                            ...routeItem.categoryPhotos,
                            [extraPhotosKey]: {
                              ...currentExtra,
                              extraProducts: next
                            }
                          };
                          await onUpdateItem(routeItem.id, { categoryPhotos: updatedPhotos });
                        }}
                        className="w-full text-left px-3 py-2 flex items-center justify-between gap-2 hover:bg-gray-50"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{p?.product?.name}</div>
                          <div className="text-[10px] text-gray-500 truncate">{p?.product?.ean || p?.product?.barcode || 'Sem EAN'}</div>
                        </div>
                        <div className="text-xs font-bold">
                          {selected ? (
                            <span className="text-orange-700">Selecionado</span>
                          ) : (
                            <span className="text-gray-400">Selecionar</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
              </div>
              <div className="text-[11px] text-gray-500">
                {extraSelectedProductIds.length > 0
                  ? `${extraSelectedProductIds.length} selecionados`
                  : 'Selecione os produtos que estão no ponto extra.'}
              </div>
            </div>
          )}
        </div>

        <div className="w-full grid grid-cols-2 gap-3">
            {urls.map((u: string, i: number) => (
              <div key={i} className="relative w-full aspect-square rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                <img
                  src={resolveImageUrl(u)}
                  alt={`${title} ${i + 1}`}
                  className="w-full h-full object-cover"
                  onClick={() => setPreviewUrl(u)}
                />
                <button
                  onClick={() => handlePhotoRemove(type, i)}
                  className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full shadow-md hover:bg-red-600"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            
            <label
              htmlFor={`category-photo-${type}`}
              className="flex flex-col items-center justify-center border-2 border-dashed border-blue-300 rounded-lg aspect-square text-blue-500 cursor-pointer bg-blue-50 hover:bg-blue-100 transition-colors"
            >
              {uploading ? (
                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              ) : (
                <>
                  <Camera size={32} className="mb-2" />
                  <span className="text-xs font-bold">Adicionar Foto</span>
                </>
              )}
            </label>
        </div>

        <input 
          type="file" 
          accept="image/*" 
          capture="environment"
          className="hidden"
          id={`category-photo-${type}`} 
          ref={fileInputRef}
          onChange={(e) => handlePhotoUpload(e, type)}
        />

      </div>
      <div
        className="fixed left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-lg z-60"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 72px)' }}
      >
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              if (!beforeOk) {
                toast.error('Faça a Foto Antes para liberar os produtos.');
                return;
              }
              setStep(STEPS.PRODUCTS);
            }}
            disabled={type === 'before' && !beforeOk}
            className={`flex-1 py-4 border rounded-xl font-bold text-lg shadow-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99] ${
              type === 'before' && !beforeOk
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            Produtos
          </button>
          <button
            type="button"
            onClick={() => {
              if (type === 'after') {
                finalizeCategory();
                return;
              }

              if (!beforeOk) {
                toast.error('Faça a Foto Antes para continuar.');
                return;
              }

              setStep(STEPS.PRODUCTS);
            }}
            disabled={type === 'before' && !beforeOk}
            className={`flex-1 py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.99] ${
              type === 'before' && !beforeOk
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {type === 'after' ? 'Finalizar Categoria' : 'Continuar'}
          </button>
        </div>
      </div>
      </>
    );
  };

  const renderStockPhotosStep = () => {
    const beforeOk = getBeforeCount(photosKey) >= MIN_BEFORE_PHOTOS;
    const productsOk = mode === 'FULL' ? areAllProductsComplete() : true;

    if (!beforeOk || !productsOk) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center gap-3">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center text-orange-600">
            <AlertTriangle size={28} />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-gray-900">Etapa bloqueada</h2>
            <p className="text-sm text-gray-600">
              Envie a Foto Antes e conclua os produtos obrigatórios para liberar as Fotos do Estoque.
            </p>
          </div>
          <div className="w-full max-w-sm flex gap-3">
            <button
              type="button"
              onClick={() => setStep(STEPS.BEFORE_PHOTO)}
              className="flex-1 py-3 bg-white text-gray-700 border border-gray-300 rounded-xl font-bold shadow-sm hover:bg-gray-50 transition-colors"
            >
              Foto Antes
            </button>
            <button
              type="button"
              onClick={() => setStep(beforeOk ? STEPS.PRODUCTS : STEPS.BEFORE_PHOTO)}
              className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-sm hover:bg-blue-700 transition-colors"
            >
              Produtos
            </button>
          </div>
        </div>
      );
    }

    const photos = getCategoryPhotos(photosKey);
    const current = (photos as any).storage;
    const urls = Array.isArray(current) ? current : (current ? [current] : []);
    const storageOk = urls.length >= 2;

    return (
      <>
        <div className="flex flex-col items-center h-full p-4 space-y-4 pb-48 overflow-y-auto">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold text-gray-800">{getLabel('storage')}</h2>
            <p className="text-sm text-gray-500">Registre Estoque Antes e Depois.</p>
          </div>

          <div className="w-full grid grid-cols-2 gap-3">
            {urls.map((u: string, i: number) => (
              <div key={i} className="relative w-full aspect-square rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                <img
                  src={resolveImageUrl(u)}
                  alt={`Fotos do Estoque ${i + 1}`}
                  className="w-full h-full object-cover"
                  onClick={() => setPreviewUrl(u)}
                />
                {!readOnly && (
                  <button
                    onClick={() => handlePhotoRemove('storage', i)}
                    className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full shadow-md hover:bg-red-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}

            {!readOnly && (
              <label
                htmlFor="category-photo-storage"
                className="flex flex-col items-center justify-center border-2 border-dashed border-blue-300 rounded-lg aspect-square text-blue-500 cursor-pointer bg-blue-50 hover:bg-blue-100 transition-colors"
              >
                {uploading ? (
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                ) : (
                  <>
                    <Camera size={32} className="mb-2" />
                    <span className="text-xs font-bold">Adicionar Foto</span>
                  </>
                )}
              </label>
            )}
          </div>

          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            id="category-photo-storage"
            ref={fileInputRef}
            onChange={(e) => handlePhotoUpload(e, 'storage')}
          />
        </div>

        <div
          className="fixed left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-lg z-60"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 72px)' }}
        >
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                if (!beforeOk) {
                  toast.error('Faça a Foto Antes para liberar os produtos.');
                  return;
                }
                setStep(STEPS.PRODUCTS);
              }}
              className="flex-1 py-4 border rounded-xl font-bold text-lg shadow-sm flex items-center justify-center gap-2 transition-all active:scale-[0.99] bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            >
              Produtos
            </button>
            <button
              type="button"
              onClick={() => {
                if (!storageOk) {
                  toast.error('Registre 2 fotos do estoque (Antes / Depois) para continuar.');
                  return;
                }
                setStep(STEPS.AFTER_PHOTO);
              }}
              className="flex-1 py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.99] bg-blue-600 text-white hover:bg-blue-700"
            >
              Foto Depois
            </button>
          </div>
        </div>
      </>
    );
  };

  const renderProductsStep = () => {
    const naturalProducts = products || [];
    const extraProducts = naturalProducts.filter(isExtraSelected).map((p: any) => getProductForPoint(p, 'extra'));
    const entries = [...extraProducts, ...naturalProducts];
    const total = entries.length;
    const completed = entries.filter(isProductCountComplete).length;
    const fractionSum = entries.reduce((acc: number, p: any) => acc + getProductProgressFraction(p), 0);
    const progress = total > 0 ? Math.round((fractionSum / total) * 100) : 0;
    const productsOk = mode === 'FULL' ? areAllProductsComplete() : true;
    const beforeOk = getBeforeCount(photosKey) >= MIN_BEFORE_PHOTOS;

    const renderProductRow = (p: any, pt: 'natural' | 'extra') => {
      const required = isStockCountRequired(p);
      const rowCompleted = isProductCountComplete(p);
      const openModal = canOpenProduct(p);
      const productProgress = Math.round(getProductProgressFraction(p) * 100);
      const isSimpleChecklist =
        hasNonStockChecklist(p) && !isStockCountRequired(p) && !hasInteractiveChecklist(p);

      return (
        <div
          key={`${pt}-${p.productId}`}
          onClick={async () => {
            if (readOnly) return;
            if (openModal) {
              setSelectedProduct({ pointType: pt, product: p });
              return;
            }
            try {
              const cl = getChecklists(p);
              const nextCheckedValueForSimple = (() => {
                const anyChecked = cl.some((c: any) => c?.type !== 'STOCK_COUNT' && !isIgnoredChecklistItem(c) && !!c?.isChecked);
                return !anyChecked;
              })();

              const nextChecklistsForSimple = cl.map((c: any) => {
                if (c?.type === 'STOCK_COUNT') return c;
                if (isValidityChecklistItem(c)) return c;
                if (isIgnoredChecklistItem(c)) return c;
                if (c?.type === 'PRICE_CHECK') return c;
                return { ...c, isChecked: nextCheckedValueForSimple };
              });

              if (pt === 'extra') {
                const pid = String(p.productId);
                const current = extraProductChecks?.[pid] || {};
                const nextChecked = isSimpleChecklist ? nextCheckedValueForSimple : !(current.checked ?? false);
                const nextChecks = {
                  ...extraProductChecks,
                  [pid]: {
                    ...current,
                    checked: nextChecked,
                    ...(isSimpleChecklist ? { checklists: nextChecklistsForSimple } : {})
                  }
                };
                setExtraProductChecks(nextChecks);

                const currentExtra = getCategoryPhotos(extraPhotosKey);
                const updatedPhotos: any = {
                  ...(routeItem.categoryPhotos || {}),
                  [extraPhotosKey]: {
                    ...currentExtra,
                    extraProducts: extraSelectedProductIds,
                    extraProductChecks: nextChecks
                  }
                };
                await onUpdateItem(routeItem.id, { categoryPhotos: updatedPhotos });
                toast.success(nextChecked ? 'Marcado como concluído.' : 'Desmarcado.');
                return;
              }

              const nextChecked = isSimpleChecklist ? nextCheckedValueForSimple : !p.checked;
              const payload: any = isSimpleChecklist
                ? { checked: nextChecked, checklists: nextChecklistsForSimple }
                : { checked: nextChecked };
              await onUpdateProduct(p.productId, payload);
              toast.success(nextChecked ? 'Marcado como concluído.' : 'Desmarcado.');
            } catch {
              toast.error('Não foi possível atualizar.');
            }
          }}
          className="bg-white p-4 rounded-lg shadow border border-gray-100 flex items-start gap-3 active:scale-[0.98] transition-transform"
        >
          <div className="pt-0.5">
            {rowCompleted ? (
              <CheckCircle size={20} className="text-green-600" />
            ) : (
              <Circle size={20} className="text-gray-300" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-medium text-gray-900 truncate">{p.product.name}</h3>
                <p className="text-xs text-gray-500 truncate">{p.product.ean || 'Sem EAN'}</p>
                {required && productProgress > 0 && productProgress < 100 && (
                  <span className="text-[10px] bg-orange-50 text-orange-700 px-1 rounded">{productProgress}% parcial</span>
                )}
                {!required && !hasNonStockChecklist(p) && pt !== 'extra' && (
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-1 rounded">Sem obrigatoriedade</span>
                )}
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActionProduct(p);
                }}
                className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                disabled={readOnly}
                title="Ações"
              >
                <MoreVertical size={18} />
              </button>
            </div>

            <div className="mt-2 flex items-center justify-between text-xs">
              <span className={rowCompleted ? 'text-green-700 font-medium' : 'text-orange-600 font-medium'}>
                {rowCompleted ? 'Concluído' : openModal ? 'Toque para abrir' : 'Toque para marcar'}
              </span>
              {!readOnly && openModal && (
                <span className="text-gray-400">{productProgress > 0 && !rowCompleted ? `${productProgress}%` : 'Pendente'}</span>
              )}
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className="flex flex-col h-full">
        <div className="p-4 bg-white shadow-sm z-10">
          <h2 className="text-xl font-bold text-gray-800 mb-1">Produtos</h2>
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>{categoryTitle}</span>
            <span>{completed} / {total} concluídos</span>
          </div>
          <div className="w-full bg-gray-200 h-2 rounded-full mt-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-20">
          {extraProducts.length > 0 && (
            <div className="pt-1">
              <div className="text-[11px] font-bold text-orange-700 px-1 mb-2">Ponto Extra</div>
              <div className="space-y-3">{extraProducts.map((p: any) => renderProductRow(p, 'extra'))}</div>
            </div>
          )}

          <div className="pt-1">
            <div className="text-[11px] font-bold text-slate-700 px-1 mb-2">
              {extraProducts.length > 0 ? 'Ponto Natural (Todos)' : 'Lista de Produtos'}
            </div>
            <div className="space-y-3">{naturalProducts.map((p: any) => renderProductRow(p, 'natural'))}</div>
          </div>
        </div>

        <div className="p-4 bg-white border-t">
          {!productsOk && mode === 'FULL' && (
            <div className="mb-3 text-xs text-orange-600 bg-orange-50 p-2 rounded flex items-center gap-2">
              <AlertTriangle size={14} />
              <span>Conclua os produtos para liberar a Foto Depois.</span>
            </div>
          )}
          <div className="flex gap-3">
            {mode !== 'ITEMS' && (
              <button
                type="button"
                onClick={() => setStep(STEPS.BEFORE_PHOTO)}
                className="flex-1 py-3 bg-white text-gray-700 border border-gray-200 rounded-lg font-bold hover:bg-gray-50"
              >
                Fotos
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (mode === 'ITEMS') {
                  onBack();
                  return;
                }
                if (!beforeOk) {
                  toast.error('Faça a Foto Antes para liberar os produtos.');
                  setStep(STEPS.BEFORE_PHOTO);
                  return;
                }
                if (!productsOk) {
                  toast.error('Conclua os produtos antes de ir para a Foto Depois.');
                  return;
                }
              setStep(stockPhotosRequired ? STEPS.STOCK_PHOTOS : STEPS.AFTER_PHOTO);
              }}
              className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700"
            >
              {mode === 'ITEMS' ? 'Concluir' : stockPhotosRequired ? 'Fotos Estoque' : 'Foto Depois'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderPreviewModal = () => {
    if (!previewUrl) return null;
    return (
      <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4">
        <div className="relative w-full max-w-md">
          <img
            src={resolveImageUrl(previewUrl)}
            alt="Preview"
            className="w-full max-h-[80vh] object-contain rounded-lg bg-black"
          />
          <button
            onClick={() => setPreviewUrl(null)}
            className="absolute top-3 right-3 bg-black bg-opacity-60 text-white rounded-full p-2"
          >
            <X size={20} />
          </button>
        </div>
      </div>
    );
  };

  const beforeOkNow = getBeforeCount(photosKey) >= MIN_BEFORE_PHOTOS;
  const productsOkNow = mode === 'FULL' ? areAllProductsComplete() : true;
  const storageOkNow = !stockPhotosRequired ? true : getStorageCount(photosKey) >= 2;
  const canGoProductsNow = beforeOkNow;
  const canGoStockNow = beforeOkNow && productsOkNow;
  const canGoAfterNow = beforeOkNow && productsOkNow && storageOkNow;

  return (
    <div className="fixed inset-0 bg-gray-50 z-[100] flex flex-col animate-slideUp">
      <div className="bg-white border-b p-4 shadow-sm z-20">
        <div className="flex items-center justify-between">
          <button onClick={prevStep} className="text-gray-600 p-2">
            <ArrowLeft />
          </button>
          <h1 className="font-bold text-lg">{categoryTitle}</h1>
          <div className="w-10" />
        </div>

        {mode !== 'ITEMS' && (
          <div className={`mt-3 grid gap-2 ${stockPhotosRequired ? 'grid-cols-4' : 'grid-cols-3'}`}>
            <button
              type="button"
              onClick={() => setStep(STEPS.BEFORE_PHOTO)}
              className={`py-2 rounded-lg text-xs font-bold border ${
                step === STEPS.BEFORE_PHOTO
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Foto Antes
            </button>
            <button
              type="button"
              onClick={() => {
                if (!canGoProductsNow) {
                  toast.error('Faça a Foto Antes para liberar os produtos.');
                  return;
                }
                setStep(STEPS.PRODUCTS);
              }}
              disabled={!canGoProductsNow}
              className={`py-2 rounded-lg text-xs font-bold border ${
                !canGoProductsNow
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  : step === STEPS.PRODUCTS
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Produtos
            </button>
            {stockPhotosRequired && (
              <button
                type="button"
                onClick={() => {
                  if (!canGoStockNow) {
                    toast.error('Conclua a Foto Antes e os produtos obrigatórios para liberar as Fotos do Estoque.');
                    return;
                  }
                  setStep(STEPS.STOCK_PHOTOS);
                }}
                disabled={!canGoStockNow}
                className={`py-2 rounded-lg text-xs font-bold border ${
                  !canGoStockNow
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    : step === STEPS.STOCK_PHOTOS
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                Estoque
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (!canGoAfterNow) {
                  toast.error(stockPhotosRequired
                    ? 'Conclua a Foto Antes, os produtos obrigatórios e as Fotos do Estoque para liberar a Foto Depois.'
                    : 'Conclua a Foto Antes e os produtos obrigatórios para liberar a Foto Depois.'
                  );
                  return;
                }
                setStep(STEPS.AFTER_PHOTO);
              }}
              disabled={!canGoAfterNow}
              className={`py-2 rounded-lg text-xs font-bold border ${
                !canGoAfterNow
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                  : step === STEPS.AFTER_PHOTO
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              Foto Depois
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden relative">
        {step === STEPS.BEFORE_PHOTO && renderPhotoStep('before', getLabel('before'), 'Registre o estado inicial.')}
        {step === STEPS.STOCK_PHOTOS && renderStockPhotosStep()}
        {step === STEPS.AFTER_PHOTO && renderPhotoStep('after', getLabel('after'), 'Registre o resultado final.')}
        {step === STEPS.PRODUCTS && renderProductsStep()}
      </div>

      {selectedProduct && (
        <ProductCountModal
          isOpen={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
          product={selectedProduct.product}
          onSave={handleProductSave}
          mode="BOTH"
          readOnly={readOnly}
          requireStockCount={isStockCountRequired(selectedProduct.product)}
          routeItemId={routeItem?.id}
          supermarketId={routeItem?.supermarket?.id || routeItem?.supermarketId}
        />
      )}

      {actionProduct && (
        <div
          className="fixed inset-0 z-[70] bg-black bg-opacity-40 flex items-end justify-center p-4"
          onClick={() => setActionProduct(null)}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-sm font-bold text-gray-900 truncate">Ações</div>
                <div className="text-xs text-gray-500 truncate">{actionProduct.product?.name}</div>
              </div>
              <button onClick={() => setActionProduct(null)} className="text-gray-500">
                <X size={20} />
              </button>
            </div>
            <div className="p-2">
              <button
                type="button"
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 text-left"
                onClick={() => {
                  setBreakageProduct(actionProduct);
                  setActionProduct(null);
                }}
                disabled={readOnly}
              >
                <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
                  <AlertTriangle size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-gray-900">Avaria</div>
                  <div className="text-xs text-gray-500">Registrar motivo, quantidade e descrição</div>
                </div>
              </button>
              <button
                type="button"
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-purple-50 text-left"
                onClick={() => {
                  setIncidentType('DEGUSTATION');
                  setIncidentProduct(actionProduct);
                  setIncidentReasonId('');
                  setIncidentQuantity('');
                  setIncidentDescription('');
                  setActionProduct(null);
                }}
                disabled={readOnly}
              >
                <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
                  <AlertTriangle size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-gray-900">Degustação</div>
                  <div className="text-xs text-gray-500">Registrar motivo, quantidade e descrição</div>
                </div>
              </button>
              <button
                type="button"
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-orange-50 text-left"
                onClick={() => {
                  setIncidentType('RUPTURE');
                  setIncidentProduct(actionProduct);
                  setIncidentReasonId('');
                  setIncidentQuantity('');
                  setIncidentDescription('');
                  setActionProduct(null);
                }}
                disabled={readOnly}
              >
                <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center">
                  <AlertTriangle size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-gray-900">Ruptura</div>
                  <div className="text-xs text-gray-500">Registrar motivo, quantidade e descrição</div>
                </div>
              </button>
              <button
                type="button"
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50 text-left"
                onClick={() => {
                  setIncidentType('VALIDITY');
                  setIncidentProduct(actionProduct);
                  setIncidentReasonId('');
                  setIncidentQuantity('');
                  setIncidentDescription('');
                  setValidityStoreDate('');
                  setValidityStoreQuantity('');
                  setValidityStockDate('');
                  setValidityStockQuantity('');
                  setActionProduct(null);
                }}
                disabled={readOnly}
              >
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                  <AlertTriangle size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-gray-900">Validade do Produto</div>
                  <div className="text-xs text-gray-500">Registrar loja/estoque, data e quantidade</div>
                </div>
              </button>
              <button
                type="button"
                className="w-full p-3 rounded-xl text-gray-600 font-medium hover:bg-gray-50"
                onClick={() => setActionProduct(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {breakageProduct && (
        <BreakageReportModal
          isOpen={!!breakageProduct}
          onClose={() => setBreakageProduct(null)}
          product={{
            ...breakageProduct,
            supermarketName: routeItem?.supermarket?.fantasyName || routeItem?.supermarket?.name || 'Supermercado'
          }}
          routeItemId={routeItem?.id}
          supermarketId={routeItem?.supermarket?.id || routeItem?.supermarketId}
        />
      )}

      {incidentProduct && incidentType && (
        <div className="fixed inset-0 z-[75] bg-black bg-opacity-50 p-4 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-sm font-black text-gray-900 truncate">
                  {incidentType === 'RUPTURE'
                    ? 'Ruptura'
                    : incidentType === 'DEGUSTATION'
                      ? 'Degustação'
                      : 'Validade do Produto'}
                </div>
                <div className="text-xs text-gray-500 truncate">{incidentProduct.product?.name}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIncidentProduct(null);
                  setIncidentType(null);
                }}
                className="text-gray-500"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="space-y-1">
                <div className="text-xs font-bold text-gray-700">Motivo</div>
                <select
                  value={incidentReasonId}
                  onChange={(e) => setIncidentReasonId(e.target.value)}
                  disabled={readOnly || incidentLoading}
                  className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100"
                >
                  <option value="">Selecionar motivo...</option>
                  {incidentReasons.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                  <option value="__OTHER__">Outro (descrever)</option>
                </select>
              </div>

              {incidentType !== 'VALIDITY' && (
                <div className="space-y-1">
                  <div className="text-xs font-bold text-gray-700">Quantidade</div>
                  <input
                    type="number"
                    min={0}
                    value={incidentQuantity}
                    onChange={(e) =>
                      setIncidentQuantity(e.target.value === '' ? '' : parseInt(e.target.value) || 0)
                    }
                    disabled={readOnly || incidentLoading}
                    className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100"
                  />
                </div>
              )}

              {incidentType === 'VALIDITY' && (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-gray-700">Loja</div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={validityStoreDate}
                      onChange={(e) => setValidityStoreDate(e.target.value)}
                      disabled={readOnly || incidentLoading}
                      className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100"
                    />
                    <input
                      type="number"
                      min={0}
                      value={validityStoreQuantity}
                      onChange={(e) =>
                        setValidityStoreQuantity(e.target.value === '' ? '' : parseInt(e.target.value) || 0)
                      }
                      disabled={readOnly || incidentLoading}
                      placeholder="Qtd"
                      className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100"
                    />
                  </div>

                  <div className="text-xs font-bold text-gray-700">Estoque</div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={validityStockDate}
                      onChange={(e) => setValidityStockDate(e.target.value)}
                      disabled={readOnly || incidentLoading}
                      className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100"
                    />
                    <input
                      type="number"
                      min={0}
                      value={validityStockQuantity}
                      onChange={(e) =>
                        setValidityStockQuantity(e.target.value === '' ? '' : parseInt(e.target.value) || 0)
                      }
                      disabled={readOnly || incidentLoading}
                      placeholder="Qtd"
                      className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <div className="text-xs font-bold text-gray-700">Descrição</div>
                <textarea
                  value={incidentDescription}
                  onChange={(e) => setIncidentDescription(e.target.value)}
                  rows={3}
                  disabled={readOnly || incidentLoading}
                  placeholder="Descreva..."
                  className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100"
                />
              </div>
            </div>

            <div className="p-4 border-t bg-white flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setIncidentProduct(null);
                  setIncidentType(null);
                }}
                className="flex-1 py-3 bg-white text-gray-700 border border-gray-200 rounded-lg font-bold hover:bg-gray-50"
                disabled={incidentLoading}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (incidentReasons.length > 0 && !incidentReasonId) {
                    toast.error('Selecione o motivo.');
                    return;
                  }
                  if (!incidentDescription.trim()) {
                    toast.error('Informe a descrição.');
                    return;
                  }

                  if (incidentType !== 'VALIDITY') {
                    if (!incidentQuantity || incidentQuantity <= 0) {
                      toast.error('Informe a quantidade.');
                      return;
                    }
                  } else {
                    const storeFilled = !!validityStoreDate || validityStoreQuantity !== '';
                    const stockFilled = !!validityStockDate || validityStockQuantity !== '';
                    if (!storeFilled && !stockFilled) {
                      toast.error('Informe ao menos uma validade (Loja ou Estoque).');
                      return;
                    }
                    if (storeFilled) {
                      if (!validityStoreDate) {
                        toast.error('Informe a data de validade (Loja).');
                        return;
                      }
                      if (!validityStoreQuantity || validityStoreQuantity <= 0) {
                        toast.error('Informe a quantidade (Loja).');
                        return;
                      }
                    }
                    if (stockFilled) {
                      if (!validityStockDate) {
                        toast.error('Informe a data de validade (Estoque).');
                        return;
                      }
                      if (!validityStockQuantity || validityStockQuantity <= 0) {
                        toast.error('Informe a quantidade (Estoque).');
                        return;
                      }
                    }
                  }

                  const selectedReasonLabel = (() => {
                    if (!incidentReasonId) return null;
                    if (incidentReasonId === '__OTHER__') return 'Outro';
                    const found = incidentReasons.find((r) => r.id === incidentReasonId);
                    return found?.label || null;
                  })();

                  const createdBy = user?.id || user?.employee?.id || null;
                  const basePayload = {
                    type: incidentType,
                    productId: incidentProduct.productId,
                    routeItemId: routeItem?.id,
                    supermarketId: routeItem?.supermarket?.id || routeItem?.supermarketId,
                    quantity: incidentType === 'VALIDITY' ? null : Number(incidentQuantity),
                    description: incidentDescription.trim(),
                    reasonId: incidentReasonId && incidentReasonId !== '__OTHER__' ? incidentReasonId : null,
                    reasonLabel: selectedReasonLabel,
                    createdBy,
                    createdAt: new Date().toISOString(),
                  };

                  const actions: any[] = [];

                  if (incidentType === 'VALIDITY') {
                    if (validityStoreDate && validityStoreQuantity) {
                      actions.push({
                        ...basePayload,
                        location: 'STORE',
                        validityDate: validityStoreDate,
                        quantity: Number(validityStoreQuantity),
                      });
                    }
                    if (validityStockDate && validityStockQuantity) {
                      actions.push({
                        ...basePayload,
                        location: 'STOCK',
                        validityDate: validityStockDate,
                        quantity: Number(validityStockQuantity),
                      });
                    }
                  } else {
                    actions.push(basePayload);
                  }

                  try {
                    setIncidentLoading(true);

                    for (const payload of actions) {
                      if (!navigator.onLine) {
                        await offlineService.addPendingAction('FORM', '/product-incidents', 'POST', payload);
                      } else {
                        await client.post('/product-incidents', payload);
                      }
                    }

                    if (incidentType === 'RUPTURE') {
                      const composedReason = (() => {
                        const label = selectedReasonLabel && selectedReasonLabel !== 'Outro' ? selectedReasonLabel : null;
                        const details = incidentDescription.trim();
                        const qty = Number(incidentQuantity);
                        if (label) return `${label} - ${details} (Qtd: ${qty})`;
                        return `${details} (Qtd: ${qty})`;
                      })();

                      const required = isStockCountRequired(incidentProduct);
                      const update: any = {
                        isStockout: true,
                        ruptureReason: composedReason,
                        checked: true,
                      };
                      if (required) {
                        update.gondolaCount = 0;
                        update.inventoryCount = 0;
                        update.stockCount = 0;
                      }
                      await onUpdateProduct(incidentProduct.productId, update);
                    }

                    if (incidentType === 'VALIDITY') {
                      const prevStoreDate = String((incidentProduct as any)?.validityStoreDate || '');
                      const prevStoreQty = Number((incidentProduct as any)?.validityStoreQuantity || 0);
                      const prevStockDate = String((incidentProduct as any)?.validityStockDate || '');
                      const prevStockQty = Number((incidentProduct as any)?.validityStockQuantity || 0);

                      const computeNext = (prevDate: string, prevQty: number, nextDate: string, nextQty: number) => {
                        if (!nextDate || nextQty <= 0) return { date: prevDate, qty: prevQty };
                        if (!prevDate || prevQty <= 0) return { date: nextDate, qty: nextQty };
                        if (nextDate < prevDate) return { date: nextDate, qty: nextQty };
                        if (nextDate === prevDate) return { date: prevDate, qty: prevQty + nextQty };
                        return { date: prevDate, qty: prevQty };
                      };

                      const storeAction = actions.find((a) => a.location === 'STORE');
                      const stockAction = actions.find((a) => a.location === 'STOCK');

                      const nextStore = computeNext(
                        prevStoreDate,
                        prevStoreQty,
                        String(storeAction?.validityDate || ''),
                        Number(storeAction?.quantity || 0)
                      );
                      const nextStock = computeNext(
                        prevStockDate,
                        prevStockQty,
                        String(stockAction?.validityDate || ''),
                        Number(stockAction?.quantity || 0)
                      );

                      const overall = (() => {
                        const hasStore = !!(nextStore.date && nextStore.qty > 0);
                        const hasStock = !!(nextStock.date && nextStock.qty > 0);
                        if (hasStore && hasStock) return nextStore.date <= nextStock.date ? { date: nextStore.date, qty: nextStore.qty } : { date: nextStock.date, qty: nextStock.qty };
                        if (hasStore) return { date: nextStore.date, qty: nextStore.qty };
                        if (hasStock) return { date: nextStock.date, qty: nextStock.qty };
                        return null;
                      })();

                      const update: any = {};
                      if (nextStore.date && nextStore.qty > 0) {
                        update.validityStoreDate = nextStore.date;
                        update.validityStoreQuantity = nextStore.qty;
                      }
                      if (nextStock.date && nextStock.qty > 0) {
                        update.validityStockDate = nextStock.date;
                        update.validityStockQuantity = nextStock.qty;
                      }
                      if (overall) {
                        update.validityDate = overall.date;
                        update.validityQuantity = overall.qty;
                      }
                      if (Object.keys(update).length > 0) {
                        await onUpdateProduct(incidentProduct.productId, update);
                      }
                    }

                    toast.success(
                      incidentType === 'RUPTURE'
                        ? 'Ruptura registrada!'
                        : incidentType === 'DEGUSTATION'
                          ? 'Degustação registrada!'
                          : 'Validade registrada!'
                    );

                    setIncidentProduct(null);
                    setIncidentType(null);
                  } catch (e) {
                    console.error(e);
                    toast.error('Erro ao salvar.');
                  } finally {
                    setIncidentLoading(false);
                  }
                }}
                disabled={readOnly || incidentLoading}
                className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {validationError && (
        <div className="fixed inset-0 z-[60] bg-black bg-opacity-70 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 flex flex-col items-center gap-4 animate-in zoom-in duration-200">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-2">
              <Camera size={32} />
            </div>
            
            <h3 className="text-xl font-bold text-gray-900 text-center">Foto Recusada</h3>
            
            <p className="text-center text-gray-600">
              {validationError}
            </p>

            <div className="bg-orange-50 p-3 rounded-lg border border-orange-100 w-full text-xs text-orange-800 mt-2">
              <p className="font-bold mb-1">Dicas para uma boa foto:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>Segure o celular com firmeza</li>
                <li>Limpe a lente da câmera</li>
                <li>Garanta boa iluminação</li>
                <li>Evite tirar foto de telas</li>
              </ul>
            </div>

            <button 
              onClick={() => setValidationError(null)}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors mt-2"
            >
              Entendi, vou tentar novamente
            </button>
          </div>
        </div>
      )}
      {renderPreviewModal()}
    </div>
  );
};
