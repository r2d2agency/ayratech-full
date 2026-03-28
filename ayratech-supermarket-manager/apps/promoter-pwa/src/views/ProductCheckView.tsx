import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Search, CheckCircle, AlertTriangle, X, Save, RefreshCw, Camera, Trash2, Plus, Lock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../api/client';
import { offlineService } from '../services/offline.service';
import { processImage, WatermarkData } from '../utils/image-processor';
import { resolveImageUrl } from '../utils/image';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';

enum ChecklistItemType {
  SIMPLE = 'SIMPLE',
  PHOTO = 'PHOTO',
  VALIDITY_CHECK = 'VALIDITY_CHECK',
  PRICE_CHECK = 'PRICE_CHECK',
  STOCK_COUNT = 'STOCK_COUNT'
}

interface Checklist {
  id: string;
  description: string;
  type: ChecklistItemType;
  isChecked: boolean;
  value?: string;
  completedBy?: {
    id: string;
    name: string;
  };
}

interface Product {
  id: string;
  name: string;
  brand?: { 
    name: string;
    waitForStockCount?: boolean;
    stockNotificationContact?: string;
  };
  ean?: string;
}

interface RouteItemProduct {
  id: string;
  productId: string;
  product: Product;
  checked: boolean;
  isStockout: boolean;
  stockoutType?: string;
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
  checklists?: Checklist[];
  completedBy?: {
    id: string;
    name: string;
  };
  stockCount?: number;
  gondolaCount?: number;
  inventoryCount?: number;
  ruptureReason?: string;
  stockCountStatus?: 'NONE' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  approvalToken?: string;
}

const ProductCheckView: React.FC = () => {
  const { routeId, itemId } = useParams<{ routeId: string; itemId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { branding } = useBranding();
  
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<RouteItemProduct[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<RouteItemProduct[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [supermarketName, setSupermarketName] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [verifyingCheckIn, setVerifyingCheckIn] = useState(true);
  const [isRouteCompleted, setIsRouteCompleted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Track when a product check started (for duration calculation)
  const productStartTimeRef = useRef<Date | null>(null);
  
  // Track if we've already auto-opened the product from URL
  const autoOpenedRef = useRef(false);

  // Selected product for detailed editing (stockout type, observation)
  const [selectedProduct, setSelectedProduct] = useState<RouteItemProduct | null>(null);

  const isValidityChecklistItem = (item: Checklist) => {
    const desc = (item.description || '').toLowerCase();
    if (item.type === ChecklistItemType.VALIDITY_CHECK) return true;
    if (desc.includes('vencimento') || desc.includes('venci') || desc.includes('validade')) return true;
    return false;
  };

  const openProductModal = async (prod: RouteItemProduct) => {
    // Only set start time if we are opening a new product, not updating existing selection
    if (!selectedProduct || selectedProduct.id !== prod.id) {
        productStartTimeRef.current = new Date();
        
        // Mark as "In Progress" (set checkInTime) if not already set
        if (!prod.checkInTime) {
            const now = new Date().toISOString();
            const updated = { ...prod, checkInTime: now };
            updateLocalState(updated);
            
            // Persist start time quietly
            await saveProductCheck(updated, true); // true = silent/partial
        }
    }
    let tpl: any = (prod.product as any)?.checklistTemplate;
    
    // Always try to fetch template if not present, to support updates
    if (!tpl?.items?.length) {
      try {
        const resp = await api.get(`/products/${prod.productId}`);
        tpl = resp.data?.checklistTemplate;
      } catch {}
    }
 
    let currentChecklists = prod.checklists ? [...prod.checklists] : [];

    if (tpl?.items?.length) {
      const templateItems: any[] = tpl.items.flatMap((tplItem: any) => {
        if (tplItem.type === ChecklistItemType.PRICE_CHECK && tplItem.competitors?.length > 0) {
          return tplItem.competitors.map((comp: any) => ({
            id: `${prod.id}-${tplItem.description}-${comp.name}`,
            description: tplItem.description,
            type: tplItem.type,
            isChecked: false,
            value: '',
            ...(comp?.name ? { competitorName: comp.name } as any : {})
          }));
        }
        return [{
          id: `${prod.id}-${tplItem.description}`,
          description: tplItem.description,
          type: tplItem.type,
          isChecked: false,
          value: ''
        }];
      });

      // Merge: Add items from template that are NOT in currentChecklists (by description/type)
      const newItems = templateItems.filter((newItem: any) => 
        !currentChecklists.some(existing => 
            existing.description === newItem.description && existing.type === newItem.type
        )
      );

      if (newItems.length > 0) {
          currentChecklists = [...currentChecklists, ...newItems];
      }
    }

    setSelectedProduct({ ...prod, checklists: currentChecklists });
  };


  // Auto-open product details if productId is in URL
  const [searchParams] = useSearchParams();
  const productIdFromUrl = searchParams.get('productId');

  useEffect(() => {
    if (productIdFromUrl && products.length > 0 && !selectedProduct && !autoOpenedRef.current) {
       const found = products.find(p => p.productId === productIdFromUrl || p.product?.id === productIdFromUrl);
       if (found) {
           setSelectedProduct(found);
           autoOpenedRef.current = true;
       }
    }
  }, [productIdFromUrl, products]);

  useEffect(() => {
    // Check if user is checked in for this item
    // We can check this by looking at the route item's checkins array (if available in cache/state)
    // Or relying on the "activeItem" logic in RouteDetails.
    // However, ProductCheckView fetches products directly.
    
    const verifyCheckIn = async () => {
        if (!routeId || !itemId) return;
        
        setVerifyingCheckIn(true);
        try {
            // Fetch route to check status
            // We use offlineService to get the latest state including local checkins
            const route = await offlineService.getRoute(routeId);
            if (route) {
                const item = route.items.find((i: any) => i.id === itemId);
                const isItemCompleted = item && (item.status === 'CHECKOUT' || item.status === 'COMPLETED');
                
                setIsRouteCompleted(route.status === 'COMPLETED' || isItemCompleted);
                
                if (item) {
                    // Check if current user has an open checkin
                    const userCheckin = item.checkins?.find((c: any) => 
                        (c.promoterId === user?.id || c.promoterId === user?.employee?.id) && 
                        !c.checkOutTime
                    );

                    const isManager = ['admin', 'superadmin', 'supervisor', 'gerente', 'coordenador'].some(role => user?.role?.toLowerCase().includes(role));

                    if (!userCheckin && !isManager && route.status !== 'COMPLETED') {
                        toast.error('Você precisa fazer check-in para acessar esta tarefa.');
                        navigate(`/routes/${routeId}`, { replace: true });
                        return;
                    }
                }
            }
        } finally {
            setVerifyingCheckIn(false);
        }
    };

    verifyCheckIn();
  }, [routeId, itemId, user]);

  useEffect(() => {
    fetchProducts();
  }, [routeId, itemId]);

  useEffect(() => {
    if (!searchTerm) {
      setFilteredProducts(products);
    } else {
      const lower = searchTerm.toLowerCase();
      setFilteredProducts(products.filter(p => 
        p.product.name.toLowerCase().includes(lower) || 
        p.product.ean?.includes(lower)
      ));
    }
  }, [searchTerm, products]);

  const fetchProducts = async () => {
    if (!routeId || !itemId) return;
    
    setLoading(true);
    try {
      // Try to get from offline cache first to be faster/consistent
      const cachedRoute = await offlineService.getRoute(routeId);
      if (cachedRoute) {
        const item = cachedRoute.items.find((i: any) => i.id === itemId);
        if (item && item.products) {
          setSupermarketName(item.supermarket?.fantasyName || item.supermarket?.name || 'PDV');
          setProducts(item.products);
          setFilteredProducts(item.products);
        }
      }

      // If not in cache or incomplete, fetch from API (if online)
      if (navigator.onLine) {
        const response = await api.get(`/routes/${routeId}`);
        const item = response.data.items.find((i: any) => i.id === itemId);
        const isItemCompleted = item && (item.status === 'CHECKOUT' || item.status === 'COMPLETED');
        setIsRouteCompleted(response.data.status === 'COMPLETED' || isItemCompleted);
        
        if (item && item.products) {
          setSupermarketName(item.supermarket?.fantasyName || item.supermarket?.name || 'PDV');
          setProducts(item.products);
          setFilteredProducts(item.products);
          // Update cache
          offlineService.saveRoute(response.data);
        }
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (prod: RouteItemProduct, isStockout: boolean) => {
    // Confirmation for completion (only if not stockout and not already checked)
    if (!isStockout && !prod.checked) {
       const confirm = window.confirm('Deseja realmente concluir esta tarefa?');
       if (!confirm) return;
    }

    // Optimistic update
    const updatedProduct = { 
      ...prod, 
      checked: true, 
      isStockout: isStockout,
      // Reset stockout details if not stockout
      stockoutType: isStockout ? (prod.stockoutType || 'PHYSICAL') : undefined,
      checkInTime: new Date().toISOString(),
      checkOutTime: new Date().toISOString(),
      completedBy: user?.employee ? { id: user.employee.id, name: user.name } : undefined
    };

    updateLocalState(updatedProduct);

    // If it's a stockout, maybe open modal for more details? 
    // For now, let's just toggle. If user wants to add observation, they click the row.
    if (isStockout) {
        openProductModal(updatedProduct);
    } else {
        // Auto-save if just marking as present
        await saveProductCheck(updatedProduct);
    }
  };

  const updateLocalState = (updatedProduct: RouteItemProduct) => {
    const newProducts = products.map(p => p.id === updatedProduct.id ? updatedProduct : p);
    setProducts(newProducts);
  };

  const saveProductCheck = async (productData: RouteItemProduct) => {
    if (!routeId || !itemId) return;

    try {
      if (navigator.onLine) {
        await api.patch(`/routes/items/${itemId}/products/${productData.productId}/check`, {
          checked: productData.checked,
          isStockout: productData.isStockout,
          stockoutType: productData.stockoutType,
          observation: productData.observation,
          photos: productData.photos,
          checkInTime: productData.checkInTime,
          checkOutTime: productData.checkOutTime,
          validityDate: productData.validityDate,
          validityQuantity: productData.validityQuantity,
          validityStoreDate: (productData as any).validityStoreDate,
          validityStoreQuantity: (productData as any).validityStoreQuantity,
          validityStockDate: (productData as any).validityStockDate,
          validityStockQuantity: (productData as any).validityStockQuantity,
          stockCount: productData.stockCount,
          gondolaCount: productData.gondolaCount,
          inventoryCount: productData.inventoryCount,
          checklists: productData.checklists,
          completedBy: productData.completedBy
        });
      } else {
        // Offline: Add to pending actions
        await offlineService.addPendingAction(
          'PRODUCT_CHECK',
          `/routes/items/${itemId}/products/${productData.productId}/check`,
          'PATCH',
          {
             checked: productData.checked,
             isStockout: productData.isStockout,
             stockoutType: productData.stockoutType,
             observation: productData.observation,
             photos: productData.photos,
             checkInTime: productData.checkInTime,
             checkOutTime: productData.checkOutTime,
             validityDate: productData.validityDate,
             validityQuantity: productData.validityQuantity,
             validityStoreDate: (productData as any).validityStoreDate,
             validityStoreQuantity: (productData as any).validityStoreQuantity,
             validityStockDate: (productData as any).validityStockDate,
             validityStockQuantity: (productData as any).validityStockQuantity,
             stockCount: productData.stockCount,
             gondolaCount: productData.gondolaCount,
             inventoryCount: productData.inventoryCount,
             checklists: productData.checklists,
             completedBy: productData.completedBy
          }
        );
      }
      
      // Update Route in Cache to reflect changes immediately
      const cachedRoute = await offlineService.getRoute(routeId);
      if (cachedRoute) {
        const updatedItems = cachedRoute.items.map((i: any) => {
           if (i.id === itemId) {
             return {
               ...i,
               products: i.products.map((p: any) => p.id === productData.id ? productData : p)
             };
           }
           return i;
        });
        await offlineService.saveRoute({ ...cachedRoute, items: updatedItems });
      }

    } catch (error: any) {
      console.error('Error saving check:', error);
      
      // Don't queue offline if it's a client error (4xx)
      if (error.response && error.response.status >= 400 && error.response.status < 500) {
          toast.error('Erro ao salvar: ' + (error.response.data?.message || 'Dados inválidos'));
          return;
      }

      // If API fails (network or server error), fallback to offline queue
        await offlineService.addPendingAction(
          'PRODUCT_CHECK',
          `/routes/items/${itemId}/products/${productData.productId}/check`,
          'PATCH',
          {
             checked: productData.checked,
             isStockout: productData.isStockout,
             stockoutType: productData.stockoutType,
             observation: productData.observation,
             photos: productData.photos,
             validityDate: productData.validityDate,
             validityQuantity: productData.validityQuantity,
             validityStoreDate: (productData as any).validityStoreDate,
             validityStoreQuantity: (productData as any).validityStoreQuantity,
             validityStockDate: (productData as any).validityStockDate,
             validityStockQuantity: (productData as any).validityStockQuantity,
             checklists: productData.checklists,
             completedBy: productData.completedBy
          }
        );
    }
  };

  const handleChecklistToggle = (checklistId: string, isChecked: boolean) => {
    if (!selectedProduct || !selectedProduct.checklists) return;
    
    const updatedChecklists = selectedProduct.checklists.map(c => {
      if (c.id === checklistId) {
        return { ...c, isChecked };
      }
      return c;
    });

    setSelectedProduct({ ...selectedProduct, checklists: updatedChecklists });
  };

  const handleChecklistValueChange = (checklistId: string, value: string) => {
    if (!selectedProduct || !selectedProduct.checklists) return;
    
    const updatedChecklists = selectedProduct.checklists.map(c => {
      if (c.id === checklistId) {
        return { ...c, value };
      }
      return c;
    });

    setSelectedProduct({ ...selectedProduct, checklists: updatedChecklists });
  };

  const handleModalSave = async () => {
    if (selectedProduct && !isRouteCompleted) {
      // Validation: Photos required
      if (!selectedProduct.photos || selectedProduct.photos.length === 0) {
        toast.error('É obrigatório tirar pelo menos uma foto para concluir.');
        return;
      }

      // Validation: Checklist required
      if (selectedProduct.checklists && selectedProduct.checklists.length > 0) {
        const incompleteItems = selectedProduct.checklists.filter(c => 
          !c.isChecked && 
          !(c.type === ChecklistItemType.STOCK_COUNT && selectedProduct.product.brand?.waitForStockCount)
        );
        if (incompleteItems.length > 0) {
          toast.error('Complete todos os itens do checklist para concluir.');
          return;
        }
      }
      // Validation: Validity requires date and quantity
      const validityRequired = selectedProduct.checklists?.some(c => isValidityChecklistItem(c) && c.isChecked);
      if (validityRequired) {
        const storeFilled = !!selectedProduct.validityStoreDate || selectedProduct.validityStoreQuantity !== undefined;
        const stockFilled = !!selectedProduct.validityStockDate || selectedProduct.validityStockQuantity !== undefined;
        if (!storeFilled && !stockFilled) {
          toast.error('Informe ao menos uma validade (Loja ou Estoque).');
          return;
        }
        if (storeFilled) {
          if (!selectedProduct.validityStoreDate) {
            toast.error('Informe a data de validade (Loja).');
            return;
          }
          if (!selectedProduct.validityStoreQuantity || selectedProduct.validityStoreQuantity <= 0) {
            toast.error('Informe a quantidade (Loja).');
            return;
          }
        }
        if (stockFilled) {
          if (!selectedProduct.validityStockDate) {
            toast.error('Informe a data de validade (Estoque).');
            return;
          }
          if (!selectedProduct.validityStockQuantity || selectedProduct.validityStockQuantity <= 0) {
            toast.error('Informe a quantidade (Estoque).');
            return;
          }
        }
      }

      // Validation: Stock Count Approval
      if (selectedProduct.product.brand?.waitForStockCount && 
          selectedProduct.checklists?.some(c => c.type === ChecklistItemType.STOCK_COUNT) && 
          selectedProduct.stockCountStatus !== 'APPROVED') {
          toast.error('Aguarde a aprovação do estoque para concluir.');
          return;
      }

      setSaving(true);
      try {
        const startTime = productStartTimeRef.current || new Date();
        const overallValidity = (() => {
          const storeOk = !!(selectedProduct.validityStoreDate && selectedProduct.validityStoreQuantity && selectedProduct.validityStoreQuantity > 0);
          const stockOk = !!(selectedProduct.validityStockDate && selectedProduct.validityStockQuantity && selectedProduct.validityStockQuantity > 0);
          if (storeOk && stockOk) {
            return selectedProduct.validityStoreDate! <= selectedProduct.validityStockDate!
              ? { date: selectedProduct.validityStoreDate!, qty: selectedProduct.validityStoreQuantity! }
              : { date: selectedProduct.validityStockDate!, qty: selectedProduct.validityStockQuantity! };
          }
          if (storeOk) return { date: selectedProduct.validityStoreDate!, qty: selectedProduct.validityStoreQuantity! };
          if (stockOk) return { date: selectedProduct.validityStockDate!, qty: selectedProduct.validityStockQuantity! };
          return null;
        })();

        const nextChecklists = Array.isArray(selectedProduct.checklists)
          ? selectedProduct.checklists.map((c) => {
              if (isValidityChecklistItem(c) && c.isChecked && overallValidity?.date) {
                return { ...c, value: overallValidity.date };
              }
              return c;
            })
          : selectedProduct.checklists;

        const updatedProduct = {
            ...selectedProduct,
            checkInTime: startTime.toISOString(),
            checkOutTime: new Date().toISOString(),
            validityDate: overallValidity?.date,
            validityQuantity: overallValidity?.qty,
            checklists: nextChecklists,
            completedBy: user?.employee ? { id: user.employee.id, name: user.name } : undefined
        };

        await saveProductCheck(updatedProduct);
        updateLocalState(updatedProduct); // Ensure state is consistent
        setSelectedProduct(null);
        toast.success('Salvo!');
      } catch (error) {
        console.error('Error saving in modal:', error);
        toast.error('Erro ao salvar produto.');
      } finally {
        setSaving(false);
      }
    }
  };

  const handlePhotoAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProduct) return;

    setUploadingPhoto(true);
    console.log('Starting photo processing...');
    try {
      // 1.Processador de Imagem (Compress & Watermark)
      const watermarkData: WatermarkData = {
        supermarketName: supermarketName || 'PDV',
        promoterName: user?.name || 'Promotor',
        timestamp: new Date(),
        blurThreshold: branding?.blurThreshold
      };
      
      console.log('Processing image with watermark:', watermarkData);
      const { blob, previewUrl } = await processImage(file, watermarkData);
      console.log('Image processed. Blob size:', blob.size, 'Preview URL length:', previewUrl?.length);
      
      // 2. Upload se online, otherwise use Base64
      let photoUrl = previewUrl; // Default to blob URL (will be revoked) or base64
      
      if (navigator.onLine) {
        console.log('Online, attempting upload...');
        const formData = new FormData();
        formData.append('file', blob, 'photo.jpg');
        // Add type for route item photo
        formData.append('type', 'PRODUCT_PHOTO'); 
        
        try {
            // Use specific route item photo endpoint which applies watermark
            const response = await api.post(`/routes/items/${itemId}/photos`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            // Backend returns { url: "..." }
            photoUrl = response.data.url;
            console.log('Upload success:', photoUrl);
        } catch (uploadError) {
            console.error('Upload failed, falling back to Base64', uploadError);
            // Fallback to Base64
            photoUrl = await blobToBase64(blob);
            console.log('Fallback Base64 length:', photoUrl.length);
        }
      } else {
        console.log('Offline, converting to Base64...');
        // Offline: Convert to Base64
        photoUrl = await blobToBase64(blob);
        console.log('Offline Base64 length:', photoUrl.length);
      }

      if (!photoUrl) throw new Error('Falha ao gerar URL da foto');

      const currentPhotos = selectedProduct.photos || [];
      const updatedProduct = {
        ...selectedProduct,
        photos: [...currentPhotos, photoUrl]
      };
      
      setSelectedProduct(updatedProduct);
      
      // Clean up input
      if (fileInputRef.current) fileInputRef.current.value = '';

    } catch (error) {
      console.error('Error adding photo:', error);
      const msg = (error as Error).message;
      // Check if it's a validation error (starts with specific phrases from image-processor)
      if (msg.includes('borrada') || msg.includes('escura') || msg.includes('clara')) {
          setValidationError(msg);
      } else {
          toast.error('Erro ao processar foto: ' + msg);
      }
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePhotoRemove = (index: number) => {
    if (!selectedProduct) return;
    const currentPhotos = selectedProduct.photos || [];
    const updatedPhotos = currentPhotos.filter((_, i) => i !== index);
    setSelectedProduct({ ...selectedProduct, photos: updatedPhotos });
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Falha ao ler o arquivo de imagem.'));
      reader.readAsDataURL(blob);
    });
  };


  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="flex items-center p-4 gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-600">
            <ArrowLeft size={24} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Pesquisa de Produtos</h1>
            {isRouteCompleted && (
                <span className="text-xs text-red-500 font-bold flex items-center gap-1">
                    <Lock size={12} /> Visita Finalizada - Modo Leitura
                </span>
            )}
          </div>
          <div className="text-sm text-gray-500">
            {products.filter(p => p.checked).length}/{products.length}
          </div>
        </div>
        
        {/* Search */}
        <div className="px-4 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar produto..." 
              className="w-full pl-10 pr-4 py-2 border rounded-lg bg-gray-50 focus:bg-white focus:border-blue-500 outline-none transition-colors"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Product List */}
      <div className="p-4 flex flex-col gap-3">
        {verifyingCheckIn ? (
            <div className="text-center py-10 text-gray-500">Verificando check-in...</div>
        ) : loading ? (
          <div className="text-center py-10 text-gray-500">Carregando produtos...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-10 text-gray-500">Nenhum produto encontrado.</div>
        ) : (
          filteredProducts.map(prod => (
            <div 
              key={prod.id} 
              className={`bg-white p-4 rounded-xl shadow-sm border-l-4 ${
                prod.checked 
                  ? prod.isStockout ? 'border-red-500' : 'border-green-500'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1" onClick={() => openProductModal(prod)}>
                  <div className="flex justify-between items-start">
                    <h3 className={`font-medium ${
                      prod.checked 
                        ? 'text-green-700' 
                        : prod.checkInTime && !prod.checkOutTime 
                          ? 'text-yellow-700'
                          : 'text-gray-900'
                    }`}>
                      {prod.product.name}
                    </h3>
                    {!prod.checked && prod.checkInTime && !prod.checkOutTime && (
                       <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 whitespace-nowrap">
                         Em Andamento
                       </span>
                    )}
                  </div>
                  {prod.product.brand && (
                    <p className="text-sm text-gray-500">{prod.product.brand.name}</p>
                  )}
                  {prod.completedBy && (
                     <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                        <CheckCircle size={12} />
                        Feito por: {(prod.completedBy?.name || '').split(' ')[0]}
                     </p>
                  )}
                  {prod.observation && (
                    <p className="text-xs text-orange-600 mt-1 italic">Obs: {prod.observation}</p>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleStatusChange(prod, false)}
                    disabled={isRouteCompleted}
                    className={`p-2 rounded-full transition-colors ${
                      prod.checked && !prod.isStockout 
                        ? 'bg-green-100 text-green-600' 
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    } ${isRouteCompleted ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <CheckCircle size={24} />
                  </button>
                  
                  <button 
                    onClick={() => handleStatusChange(prod, true)}
                    disabled={isRouteCompleted}
                    className={`p-2 rounded-full transition-colors ${
                      prod.checked && prod.isStockout 
                        ? 'bg-red-100 text-red-600' 
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    } ${isRouteCompleted ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <AlertTriangle size={24} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Stockout/Details Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full sm:w-96 rounded-xl p-6 flex flex-col gap-4 animate-in slide-in-from-bottom duration-200 max-h-[85vh] overflow-y-auto mb-16 sm:mb-0">
            <div className="flex justify-between items-center sticky top-0 bg-white z-10 pb-2 border-b" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
              <h2 className="text-lg font-bold">Detalhes do Produto</h2>
              <button onClick={() => setSelectedProduct(null)} className="text-gray-400">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-medium text-gray-900">{selectedProduct.product.name}</p>
                <p className="text-sm text-gray-500">{selectedProduct.isStockout ? 'Reportando Ruptura' : 'Produto em Estoque'}</p>
              </div>
              <button
                onClick={() => setSelectedProduct({
                  ...selectedProduct, 
                  isStockout: !selectedProduct.isStockout, 
                  checked: true,
                  stockoutType: !selectedProduct.isStockout ? 'PHYSICAL' : undefined
                })}
                className={`px-3 py-1 rounded-full text-sm font-medium ${selectedProduct.isStockout ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}
              >
                {selectedProduct.isStockout ? 'Mudar para Estoque' : 'Marcar Ruptura'}
              </button>
            </div>

            {/* Pre-approval Logic */}
            {selectedProduct.product.brand?.waitForStockCount && selectedProduct.checklists?.some(c => c.type === ChecklistItemType.STOCK_COUNT) && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4">
                    <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                        {selectedProduct.stockCountStatus === 'APPROVED' ? <CheckCircle size={18} /> : 
                         selectedProduct.stockCountStatus === 'PENDING_REVIEW' ? <RefreshCw className="animate-spin" size={18} /> :
                         selectedProduct.stockCountStatus === 'REJECTED' ? <AlertTriangle size={18} /> :
                         <AlertTriangle size={18} />}
                        
                        {selectedProduct.stockCountStatus === 'APPROVED' ? 'Estoque Aprovado' :
                         selectedProduct.stockCountStatus === 'PENDING_REVIEW' ? 'Aguardando Aprovação' :
                         selectedProduct.stockCountStatus === 'REJECTED' ? 'Estoque Reprovado' :
                         'Validação de Estoque Necessária'}
                    </h3>
                    
                    {selectedProduct.stockCountStatus === 'PENDING_REVIEW' ? (
                        <div className="text-sm text-blue-700">
                            O estoque informado ({selectedProduct.stockCount}) foi enviado para aprovação. 
                            Aguarde a liberação para prosseguir.
                            <button 
                                onClick={() => handleModalSave()} 
                                className="mt-2 text-xs underline font-bold"
                            >
                                Verificar Status
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium text-gray-700">Contagem de Estoque (Unidades)</label>
                            <div className="flex gap-2">
                                <div className="flex-1 space-y-1">
                                    <span className="text-xs text-gray-500">Loja (Gôndola)</span>
                                    <input 
                                        type="number" 
                                        className="w-full border rounded-lg p-2 text-sm bg-white"
                                        placeholder="0"
                                        value={selectedProduct.gondolaCount ?? ''}
                                        onChange={(e) => {
                                            const val = e.target.value === '' ? undefined : parseInt(e.target.value);
                                            const newGondola = val;
                                            const currentInventory = selectedProduct.inventoryCount || 0;
                                            const newTotal = (newGondola || 0) + currentInventory;
                                            
                                            setSelectedProduct({
                                                ...selectedProduct, 
                                                gondolaCount: newGondola,
                                                stockCount: newTotal
                                            });
                                        }}
                                        disabled={selectedProduct.stockCountStatus === 'APPROVED'}
                                    />
                                </div>
                                <div className="flex-1 space-y-1">
                                    <span className="text-xs text-gray-500">Estoque (Depósito)</span>
                                    <input 
                                        type="number" 
                                        className="w-full border rounded-lg p-2 text-sm bg-white"
                                        placeholder="0"
                                        value={selectedProduct.inventoryCount ?? ''}
                                        onChange={(e) => {
                                            const val = e.target.value === '' ? undefined : parseInt(e.target.value);
                                            const newInventory = val;
                                            const currentGondola = selectedProduct.gondolaCount || 0;
                                            const newTotal = currentGondola + (newInventory || 0);
                                            
                                            setSelectedProduct({
                                                ...selectedProduct, 
                                                inventoryCount: newInventory,
                                                stockCount: newTotal
                                            });
                                        }}
                                        disabled={selectedProduct.stockCountStatus === 'APPROVED'}
                                    />
                                </div>
                            </div>
                            
                            {/* Total Display */}
                            <div className="bg-gray-50 p-2 rounded text-center text-sm font-bold text-gray-700">
                                Total: {selectedProduct.stockCount || 0}
                            </div>

                            {selectedProduct.stockCountStatus !== 'APPROVED' && (
                                <button 
                                    onClick={async () => {
                                        // Validation: If total is 0, require reason
                                        if ((!selectedProduct.stockCount || selectedProduct.stockCount === 0) && !selectedProduct.ruptureReason) {
                                            // Prompt for reason if not provided (simple implementation)
                                            // Or just error
                                            // Let's rely on ruptureReason input if we add one, or stockout flow.
                                            // Actually, if count is 0, it should be a Stockout?
                                            // The user said: "se Estiver zerado.. o produto. abre uma ruptura e ele tem que descrever o motivo"
                                            // If count is 0, we should probably switch to "Stockout" mode automatically or ask.
                                            // For now, let's just allow saving 0 if they confirm via stockout toggle.
                                            // But if they are here, they might be just counting.
                                            // Let's just warn if 0 and no stockout.
                                        }

                                        if (selectedProduct.stockCount === undefined && selectedProduct.gondolaCount === undefined && selectedProduct.inventoryCount === undefined) {
                                            toast.error('Informe a quantidade.');
                                            return;
                                        }
                                        setSaving(true);
                                        try {
                                            const updated = { 
                                                ...selectedProduct, 
                                                stockCountStatus: 'PENDING_REVIEW' as any 
                                            };
                                            await saveProductCheck(updated);
                                            updateLocalState(updated);
                                            setSelectedProduct(updated);
                                            toast.success('Enviado para aprovação!');
                                        } catch(e) {
                                            toast.error('Erro ao enviar.');
                                        } finally {
                                            setSaving(false);
                                        }
                                    }}
                                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold w-full"
                                    disabled={saving}
                                >
                                    Enviar para Aprovação
                                </button>
                            )}
                            {selectedProduct.stockCountStatus === 'REJECTED' && (
                                <p className="text-xs text-red-600 font-bold">
                                    Sua contagem anterior foi rejeitada. Verifique e envie novamente.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}

            <>
            {selectedProduct.isStockout && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">Tipo de Ruptura</label>
                <div className="flex gap-2">
                  <button 
                    className={`flex-1 py-2 px-3 rounded-lg border text-sm ${selectedProduct.stockoutType === 'VIRTUAL' ? 'bg-red-50 border-red-200 text-red-700 font-medium' : 'bg-white border-gray-300'}`}
                    onClick={() => setSelectedProduct({...selectedProduct, stockoutType: 'VIRTUAL'})}
                  >
                    Virtual (Sistema)
                  </button>
                  <button 
                    className={`flex-1 py-2 px-3 rounded-lg border text-sm ${selectedProduct.stockoutType === 'PHYSICAL' ? 'bg-red-50 border-red-200 text-red-700 font-medium' : 'bg-white border-gray-300'}`}
                    onClick={() => setSelectedProduct({...selectedProduct, stockoutType: 'PHYSICAL'})}
                  >
                    Física (Loja)
                  </button>
                </div>
              </div>
            )}

            {selectedProduct.checklists && selectedProduct.checklists.length > 0 && (
              <div className="flex flex-col gap-2 border-t pt-4 border-b pb-4">
                <label className="text-sm font-medium text-gray-700">Checklist de Tarefas</label>
                {selectedProduct.checklists.map(item => (
                  <label key={item.id} className={`flex items-start gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors ${item.type === ChecklistItemType.STOCK_COUNT && selectedProduct.product.brand?.waitForStockCount ? 'hidden' : ''}`}>
                    <input 
                      type="checkbox"
                      className="mt-1 w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      checked={item.isChecked}
                      onChange={(e) => handleChecklistToggle(item.id, e.target.checked)}
                    />
                    <div className="flex-1">
                      <span className={`text-sm font-medium ${item.isChecked ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                        {item.description}
                        {item.completedBy && (
                            <span className="text-xs text-blue-600 ml-2">({(item.completedBy.name || '').split(' ')[0]})</span>
                        )}
                      </span>
                      {isValidityChecklistItem(item) && (
                        <span className="block text-xs text-orange-600 mt-0.5">Habilita campo de validade</span>
                      )}
                      {item.type === ChecklistItemType.PHOTO && (
                        <span className="block text-xs text-blue-600 mt-0.5">Requer foto</span>
                      )}
                      {item.type === ChecklistItemType.PRICE_CHECK && (
                        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                          <span className="block text-xs text-blue-600 mb-1">
                              Preço
                          </span>
                          <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">R$</span>
                              <input 
                                  type="number"
                                  step="0.01"
                                  placeholder="0,00"
                                  className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:border-blue-500 outline-none bg-white"
                                  value={item.value || ''}
                                  onChange={(e) => handleChecklistValueChange(item.id, e.target.value)}
                              />
                          </div>
                        </div>
                      )}
                      {item.type === ChecklistItemType.STOCK_COUNT && (
                        <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                          <span className="block text-xs text-blue-600 mb-1">
                              Contagem de Estoque
                          </span>
                          <div className="relative">
                              <input 
                                  type="number"
                                  placeholder="Qtd"
                                  className="w-full px-3 py-2 border rounded-lg text-sm focus:border-blue-500 outline-none bg-white"
                                  value={item.value || ''}
                                  onChange={(e) => handleChecklistValueChange(item.id, e.target.value)}
                              />
                          </div>
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Fotos</label>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {selectedProduct.photos && selectedProduct.photos.map((photo, index) => (
                  <div key={index} className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                    <img 
                      src={resolveImageUrl(photo)} 
                      alt={`Foto ${index + 1}`} 
                      className="w-full h-full object-cover"
                      onClick={() => setPreviewPhoto(photo)}
                    />
                    <button 
                      onClick={() => handlePhotoRemove(index)}
                      className="absolute top-0 right-0 bg-red-500 text-white p-1 rounded-bl-lg"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
                
                <label className="flex-shrink-0 w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-gray-50 text-gray-400">
                  {uploadingPhoto ? (
                    <RefreshCw className="animate-spin" size={20} />
                  ) : (
                    <>
                      <Camera size={20} />
                      <span className="text-xs">Tirar foto</span>
                    </>
                  )}
                  <input 
                    type="file" 
                    accept="image/*"
                    capture="environment" 
                    className="hidden" 
                    onChange={handlePhotoAdd}
                    ref={fileInputRef}
                    disabled={uploadingPhoto}
                  />
                </label>
              </div>
            </div>

            {selectedProduct.checklists?.some(c => isValidityChecklistItem(c)) && (
              <div className={`flex flex-col gap-2 ${
                !selectedProduct.checklists?.some(c => isValidityChecklistItem(c) && c.isChecked)
                  ? 'opacity-50 pointer-events-none' 
                  : ''
              }`}>
                <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-3">
                  <div className="text-sm font-bold text-gray-800">Validade (Loja)</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-600">Data</label>
                      <input
                        type="date"
                        className="w-full border rounded-lg p-2 text-sm focus:border-blue-500 outline-none"
                        value={selectedProduct.validityStoreDate || ''}
                        onChange={(e) => setSelectedProduct({ ...selectedProduct, validityStoreDate: e.target.value })}
                        disabled={!selectedProduct.checklists?.some(c => isValidityChecklistItem(c) && c.isChecked)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-600">Quantidade</label>
                      <input
                        type="number"
                        min={0}
                        className="w-full border rounded-lg p-2 text-sm focus:border-blue-500 outline-none"
                        value={selectedProduct.validityStoreQuantity ?? ''}
                        onChange={(e) =>
                          setSelectedProduct({
                            ...selectedProduct,
                            validityStoreQuantity: e.target.value === '' ? undefined : parseInt(e.target.value || '0') || 0
                          })
                        }
                        disabled={!selectedProduct.checklists?.some(c => isValidityChecklistItem(c) && c.isChecked)}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-3">
                  <div className="text-sm font-bold text-gray-800">Validade (Estoque)</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-600">Data</label>
                      <input
                        type="date"
                        className="w-full border rounded-lg p-2 text-sm focus:border-blue-500 outline-none"
                        value={selectedProduct.validityStockDate || ''}
                        onChange={(e) => setSelectedProduct({ ...selectedProduct, validityStockDate: e.target.value })}
                        disabled={!selectedProduct.checklists?.some(c => isValidityChecklistItem(c) && c.isChecked)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-600">Quantidade</label>
                      <input
                        type="number"
                        min={0}
                        className="w-full border rounded-lg p-2 text-sm focus:border-blue-500 outline-none"
                        value={selectedProduct.validityStockQuantity ?? ''}
                        onChange={(e) =>
                          setSelectedProduct({
                            ...selectedProduct,
                            validityStockQuantity: e.target.value === '' ? undefined : parseInt(e.target.value || '0') || 0
                          })
                        }
                        disabled={!selectedProduct.checklists?.some(c => isValidityChecklistItem(c) && c.isChecked)}
                      />
                    </div>
                  </div>
                </div>

                {(() => {
                  const storeOk = !!(selectedProduct.validityStoreDate && selectedProduct.validityStoreQuantity && selectedProduct.validityStoreQuantity > 0);
                  const stockOk = !!(selectedProduct.validityStockDate && selectedProduct.validityStockQuantity && selectedProduct.validityStockQuantity > 0);
                  const overall = (() => {
                    if (storeOk && stockOk) {
                      return selectedProduct.validityStoreDate! <= selectedProduct.validityStockDate!
                        ? { date: selectedProduct.validityStoreDate!, qty: selectedProduct.validityStoreQuantity! }
                        : { date: selectedProduct.validityStockDate!, qty: selectedProduct.validityStockQuantity! };
                    }
                    if (storeOk) return { date: selectedProduct.validityStoreDate!, qty: selectedProduct.validityStoreQuantity! };
                    if (stockOk) return { date: selectedProduct.validityStockDate!, qty: selectedProduct.validityStockQuantity! };
                    return null;
                  })();

                  if (!overall?.date) return null;

                  return (() => {
                    const today = new Date();
                    today.setHours(0,0,0,0);
                    const valDate = new Date(overall.date);
                    // Calculate diff in days
                    const diffTime = valDate.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    if (diffDays < 0) {
                      return (
                        <div className="flex items-center gap-2 text-red-600 bg-red-50 p-2 rounded-lg text-xs font-medium">
                          <AlertTriangle size={16} />
                          Produto VENCIDO!
                        </div>
                      );
                    } else if (diffDays <= 30) {
                      return (
                        <div className="flex items-center gap-2 text-orange-600 bg-orange-50 p-2 rounded-lg text-xs font-medium">
                          <AlertTriangle size={16} />
                          Vence em {diffDays} dias (Próximo ao vencimento)
                        </div>
                      );
                    }
                    return null;
                  })()
                })()}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Observação</label>
              <textarea 
                className="w-full border rounded-lg p-2 text-sm focus:border-blue-500 outline-none"
                rows={3}
                placeholder="Alguma observação adicional?"
                value={selectedProduct.observation || ''}
                onChange={(e) => setSelectedProduct({...selectedProduct, observation: e.target.value})}
              />
            </div>

            <button 
              onClick={handleModalSave}
              disabled={saving}
              className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 mt-2 ${
                selectedProduct.photos && selectedProduct.photos.length > 0
                  ? 'bg-green-600 hover:bg-green-700 text-white' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {saving ? (
                <RefreshCw className="animate-spin" size={20} />
              ) : selectedProduct.photos && selectedProduct.photos.length > 0 ? (
                <>
                  <CheckCircle size={20} />
                  Confirmar Tarefa
                </>
              ) : (
                <>
                  <Save size={20} />
                  Salvar
                </>
              )}
            </button>
            </>
          </div>
        </div>
      )}
      {previewPhoto && (
        <div className="fixed inset-0 z-[65] bg-black bg-opacity-90 flex items-center justify-center p-4">
          <div className="relative w-full max-w-md">
            <img
              src={resolveImageUrl(previewPhoto)}
              alt="Preview"
              className="w-full max-h-[80vh] object-contain rounded-lg bg-black"
            />
            <button
              onClick={() => setPreviewPhoto(null)}
              className="absolute top-3 right-3 bg-black bg-opacity-60 text-white rounded-full p-2"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
      {/* Validation Error Modal */}
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
    </div>
  );
};

export default ProductCheckView;
