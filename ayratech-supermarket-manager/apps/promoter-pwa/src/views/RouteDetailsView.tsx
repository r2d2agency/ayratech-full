import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { offlineService } from '../services/offline.service';
import { processImage } from '../utils/image-processor';
import { useBranding } from '../context/BrandingContext';
// Import helper for image URLs
import { resolveImageUrl } from '../utils/image';
import { MapPin, ArrowLeft, CheckCircle, Circle, Camera, Navigation, Wifi, WifiOff, RefreshCw, X, ChevronRight, Clock, ListTodo, AlertTriangle, LogOut } from 'lucide-react';
import { CategoryTaskFlow } from '../components/CategoryTaskFlow';
import { format } from 'date-fns';
import { toast, Toaster } from 'react-hot-toast';

// Helper function to calculate distance
function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d * 1000; // Distance in meters
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

function formatDuration(start?: string | Date, end?: string | Date) {
  if (!start || !end) return null;
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  const diff = endTime - startTime;
  if (diff < 0) return null;
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

const RouteDetailsView = () => {
  const { user } = useAuth();
  const { branding } = useBranding();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [route, setRoute] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [currentPhoto, setCurrentPhoto] = useState<{blob: Blob, url: string} | null>(null);
  const [showPhotoPreview, setShowPhotoPreview] = useState(false);
  const [showTasksModal, setShowTasksModal] = useState(false);
  const [selectedBrandKey, setSelectedBrandKey] = useState<string | null>(null);
  const [selectedBrandLabel, setSelectedBrandLabel] = useState<string | null>(null);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string | null>(null);
  const [selectedCategoryLabel, setSelectedCategoryLabel] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const todayDate = new Date();
  const todayStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;
  const routeDateStr = route?.date
    ? (route.date instanceof Date ? route.date.toISOString().split('T')[0] : String(route.date).split('T')[0])
    : null;
  const isTodayRoute = routeDateStr === todayStr;
  const isPastRoute = !!routeDateStr && routeDateStr < todayStr;
  const isFutureRoute = !!routeDateStr && routeDateStr > todayStr;
  
  // Find item where CURRENT user is checked in (Independent of global status)
  const userActiveItem = route?.items?.find((item: any) => 
    item.checkins?.some((c: any) => {
      const pId = c.promoterId || c.promoter?.id;
      const uId = user?.employee?.id || user?.id;
      return pId === uId && !c.checkOutTime;
    })
  );

  // Find globally active item (fallback)
  const globalActiveItem = route?.items?.find((i: any) => i.status === 'CHECKIN');
  
  // Use userActiveItem if available, otherwise globalActiveItem (for view only)
  const activeItem = userActiveItem || globalActiveItem || null;
  
  // Shim setActiveItem to avoid breaking existing calls
  const setActiveItem = (val: any) => {};

  // Scroll to target item when route loads
  useEffect(() => {
    if (route && !loading) {
      const targetId = location.state?.targetItemId;
      const openTasks = location.state?.openTasks;

      // Auto-open tasks modal if requested AND user is checked in
      if (openTasks && activeItem) {
          // Verify if user is checked in to this active item
          const isCheckedIn = activeItem.checkins?.some((c: any) => {
              const pId = c.promoterId || c.promoter?.id;
              const uId = user?.employee?.id || user?.id;
              return pId === uId && !c.checkOutTime;
          });

          if (isCheckedIn) {
             setShowTasksModal(true);
          }
      }

      if (targetId) {
        setTimeout(() => {
          const element = document.getElementById(`item-${targetId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Highlight it temporarily?
            element.classList.add('ring-2', 'ring-blue-500');
            setTimeout(() => element.classList.remove('ring-2', 'ring-blue-500'), 2000);
          }
        }, 500); // Small delay to ensure render
      }
    }
  }, [route, loading, location.state, activeItem]);

  // Photo Capture State
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Removed duplicate state declarations (moved to top)

  useEffect(() => {
    fetchRoute();
    updatePendingCount();
    
    // Network listeners
    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOnlineStatus);

    // Start watching position for distance updates
    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => console.error('Error watching position:', error),
        { enableHighAccuracy: true }
      );
      return () => {
        navigator.geolocation.clearWatch(watchId);
        window.removeEventListener('online', handleOnlineStatus);
        window.removeEventListener('offline', handleOnlineStatus);
      };
    }
  }, [id]);

  const handleOnlineStatus = () => {
    setIsOnline(navigator.onLine);
    if (navigator.onLine) {
      offlineService.syncPendingActions().then(() => {
        fetchRoute();
        updatePendingCount();
      });
    }
  };

  const handlePhotoCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !activeItem) return;
    
    const file = event.target.files[0];
    setProcessing(true);

    try {
        const promoterName = user?.name || 'Promotor';

        const result = await processImage(file, {
            supermarketName: activeItem.supermarket?.fantasyName || activeItem.supermarket?.name || 'PDV',
            promoterName: promoterName,
            timestamp: new Date(),
            blurThreshold: branding?.blurThreshold
        });
        
        setCurrentPhoto({ blob: result.blob, url: result.previewUrl });
        setShowPhotoPreview(true);
    } catch (error: any) {
        const msg = error?.message || 'Erro ao processar foto.';
        if (msg.includes('borrada') || msg.includes('escura') || msg.includes('clara')) {
          setValidationError(msg);
        } else {
          toast.error('Erro ao processar foto: ' + msg);
        }
    } finally {
        setProcessing(false);
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const confirmPhotoUpload = async () => {
    if (!currentPhoto || !activeItem) return;

    setProcessing(true);
    try {
        // In a real implementation, we would upload the blob.
        // For offline support, we need to convert blob to base64 or store blob in IndexedDB.
        // Dexie supports Blobs.
        
        // However, standard JSON payloads don't support Blobs. 
        // If online: Use FormData.
        // If offline: Store in IndexedDB pending actions. 
        // NOTE: PendingAction in db.ts stores 'payload' as any. 
        // We can store the blob directly if we handle it in sync.
        // But JSON.stringify (often used in logs/debug) fails on Blobs.
        // Let's convert to Base64 for simplicity in "payload" field, 
        // or ensure our offline service handles FormData reconstruction.
        
        // Strategy: 
        // 1. Try online upload via FormData.
        // 2. If offline/fail, convert to Base64 and store in pending action.

        if (isOnline) {
             const formData = new FormData();
             formData.append('file', currentPhoto.blob, 'photo.jpg');
             formData.append('type', 'BEFORE'); // Example type
             
             await client.post(`/routes/items/${activeItem.id}/photos`, formData, {
                 headers: { 'Content-Type': 'multipart/form-data' }
             });
             toast.success('Foto enviada com sucesso!');
        } else {
             const reader = new FileReader();
             reader.readAsDataURL(currentPhoto.blob);
             reader.onloadend = async () => {
                 const base64data = String(reader.result);
                 await offlineService.addPendingAction(
                     'PHOTO',
                     `/routes/items/${activeItem.id}/photos`,
                     'POST',
                     { 
                         fileBase64: base64data,
                         filename: 'photo.jpg',
                         photoType: 'BEFORE',
                         category: null
                     }
                 );
                 toast.success('Foto salva (Offline). Será enviada quando houver conexão.');
                 updatePendingCount();
             };
        }
        
        setShowPhotoPreview(false);
        setCurrentPhoto(null);

    } catch (error) {
        console.error(error);
        // Fallback to offline if API error
        const reader = new FileReader();
        reader.readAsDataURL(currentPhoto.blob);
        reader.onloadend = async () => {
             const base64data = String(reader.result);
             await offlineService.addPendingAction(
                 'PHOTO',
                 `/routes/items/${activeItem.id}/photos`,
                 'POST',
                 { 
                     fileBase64: base64data,
                     filename: 'photo.jpg',
                     photoType: 'BEFORE',
                     category: null
                 }
             );
             toast.success('Foto salva para envio posterior.');
             updatePendingCount();
        };
        setShowPhotoPreview(false);
        setCurrentPhoto(null);
    } finally {
        setProcessing(false);
    }
  };

  const updatePendingCount = async () => {
    const count = await offlineService.getPendingCount();
    setPendingCount(count);
  };

  const fetchRoute = async () => {
    try {
      const response = await client.get(`/routes/${id}`);
      setRoute(response.data);
      offlineService.saveRoute(response.data); // Cache for offline
      
      // Find active item (status CHECKIN)
      const active = response.data.items.find((i: any) => i.status === 'CHECKIN');
      setActiveItem(active || null);
    } catch (error: any) {
      // Fix: If 4xx error, do not treat as offline
      if (error.response && error.response.status >= 400 && error.response.status < 500) {
           console.error('Error fetching route (4xx):', error.response.data);
           toast.error(`Erro ao carregar rota: ${error.response.data?.message || 'Dados inválidos'}`);
           setLoading(false);
           return;
      }

      console.error('Error fetching route from API, trying offline cache:', error);
      const cachedRoute = await offlineService.getRoute(id!);
      if (cachedRoute) {
        setRoute(cachedRoute);
        const active = cachedRoute.items.find((i: any) => i.status === 'CHECKIN');
        setActiveItem(active || null);
        toast('Modo Offline: Exibindo dados em cache', { icon: '📡' });
      } else {
        toast.error('Erro ao carregar rota e sem cache offline');
      }
    } finally {
      setLoading(false);
    }
  };

  // Photo Action State
  const actionFileInputRef = useRef<HTMLInputElement>(null);
  const [pendingAction, setPendingAction] = useState<{ type: 'CHECKIN' | 'CHECKOUT', itemId: string, location: { lat: number, lng: number } } | null>(null);

  const executeCheckIn = async (itemId: string, lat: number, lng: number, entryPhoto?: string) => {
        try {
            const res = await client.post(`/routes/items/${itemId}/check-in`, {
              lat,
              lng,
              timestamp: new Date().toISOString(),
              entryPhoto
            });
            const apiItem = res.data;

            const updatedItems = route.items.map((i: any) => {
              if (i.id !== itemId) return i;
              return {
                ...i,
                ...apiItem,
                supermarket: i.supermarket || apiItem?.supermarket,
                products: apiItem?.products || i.products,
                checkins: apiItem?.checkins || i.checkins,
              };
            });

            const nextRoute = { ...route, items: updatedItems };
            setRoute(nextRoute);
            offlineService.saveRoute(nextRoute);
            toast.success('Check-in realizado!');
        } catch (err: any) {
            if (err.response && err.response.status >= 400 && err.response.status < 500) {
                 console.error('Check-in failed with 4xx:', err.response.data);
                 toast.error(`Erro: ${err.response.data?.message || 'Check-in não permitido'}`);
                 return;
            }

            console.error('API failed, saving offline action', err);
            await offlineService.addPendingAction(
                'CHECKIN', 
                `/routes/items/${itemId}/check-in`, 
                'POST', 
                { lat, lng, timestamp: new Date().toISOString(), entryPhoto }
            );
            
            // Optimistic update
            const updatedItems = route.items.map((i: any) => {
                if (i.id === itemId) {
                    const promoterId = user?.employee?.id || user?.id;
                    const newCheckin = {
                        id: 'temp-' + Date.now(),
                        promoterId: promoterId,
                        checkInTime: new Date().toISOString(),
                        checkOutTime: null,
                        entryPhoto: entryPhoto || null
                    };
                    const existingCheckins = i.checkins || [];
                    return { ...i, status: 'CHECKIN', checkins: [...existingCheckins, newCheckin] };
                }
                return i;
            });

            const nextRoute = { ...route, items: updatedItems };
            setRoute(nextRoute);
            offlineService.saveRoute(nextRoute);
            updatePendingCount();
        } finally {
            setProcessing(false);
        }
  };

  const executeCheckOut = async (itemId: string, lat: number, lng: number, exitPhoto?: string) => {
        try {
          const nowIso = new Date().toISOString();
          const promoterId = user?.employee?.id || user?.id;
          const res = await client.post(`/routes/items/${itemId}/check-out`, {
            lat,
            lng,
            timestamp: nowIso,
            exitPhoto
          });
          toast.success('Visita finalizada!');
          const apiItem = res.data;
          
          const updatedItems = route.items.map((i: any) => {
            if (i.id !== itemId) return i;
            const incomingCheckins = apiItem?.checkins || i.checkins || [];
            const mergedCheckins = Array.isArray(incomingCheckins)
              ? incomingCheckins.map((c: any) => {
                  const cPid = c.promoterId || c.promoter?.id;
                  if (cPid === promoterId) {
                    return {
                      ...c,
                      checkOutTime: c.checkOutTime || nowIso,
                      exitPhoto: c.exitPhoto || exitPhoto || null,
                    };
                  }
                  return c;
                })
              : incomingCheckins;

            return {
              ...i,
              ...apiItem,
              status: apiItem?.status || 'CHECKOUT',
              checkOutTime: apiItem?.checkOutTime || nowIso,
              supermarket: i.supermarket || apiItem?.supermarket,
              products: apiItem?.products || i.products,
              checkins: mergedCheckins,
            };
          });
          
          const allDone = updatedItems.every((i: any) => i.status === 'CHECKOUT' || i.status === 'COMPLETED');
          const nextRoute = { ...route, status: allDone ? 'COMPLETED' : route.status, items: updatedItems };
          setRoute(nextRoute);
          offlineService.saveRoute(nextRoute);
        } catch (err: any) {
          if (err.response && err.response.status >= 400 && err.response.status < 500) {
               console.error('Checkout failed with 4xx:', err.response.data);
               const item = route.items.find((i: any) => i.id === itemId);
               const v = validateRouteItemCompletion(item);
               const msg = !v.valid && v.message ? v.message : `Erro: ${err.response.data?.message || 'Erro ao finalizar visita'}`;
               toast.error(msg);
               return;
          }

          console.error('API failed, saving offline action', err);
          await offlineService.addPendingAction(
            'CHECKOUT',
            `/routes/items/${itemId}/check-out`,
            'POST',
            { lat, lng, timestamp: new Date().toISOString(), exitPhoto }
          );

          const updatedItems = route.items.map((i: any) => {
            if (i.id === itemId) {
                const updatedCheckins = (i.checkins || []).map((c: any) => {
                    const cPid = c.promoterId || c.promoter?.id;
                    if (cPid === promoterId && !c.checkOutTime) {
                        return { ...c, checkOutTime: new Date().toISOString(), exitPhoto: exitPhoto || c.exitPhoto || null };
                    }
                    return c;
                });
                return { ...i, status: 'CHECKOUT', checkOutTime: new Date().toISOString(), checkins: updatedCheckins };
            }
            return i;
          });
          
          const allDone = updatedItems.every((i: any) => i.status === 'CHECKOUT' || i.status === 'COMPLETED');
          const nextRoute = { ...route, status: allDone ? 'COMPLETED' : route.status, items: updatedItems };
          setRoute(nextRoute);
          offlineService.saveRoute(nextRoute);
          updatePendingCount();
        } finally {
          setProcessing(false);
        }
  };

  const [permissionError, setPermissionError] = useState<string | null>(null);

  const handleActionPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !pendingAction) return;
    
    const file = event.target.files[0];
    setProcessing(true);
    
    try {
        const item = route.items.find((i: any) => i.id === pendingAction.itemId);
        const promoterName = user?.name || 'Promotor';
        const supermarketName = item?.supermarket?.fantasyName || item?.supermarket?.name || 'PDV';
        
        const result = await processImage(file, {
            supermarketName,
            promoterName,
            timestamp: new Date(),
            blurThreshold: branding?.blurThreshold
        });
        
        const reader = new FileReader();
        reader.readAsDataURL(result.blob);
        reader.onloadend = async () => {
            const base64data = String(reader.result);
            
            if (pendingAction.type === 'CHECKIN') {
                await executeCheckIn(pendingAction.itemId, pendingAction.location.lat, pendingAction.location.lng, base64data);
            } else {
                await executeCheckOut(pendingAction.itemId, pendingAction.location.lat, pendingAction.location.lng, base64data);
            }
            
            setPendingAction(null);
            if (actionFileInputRef.current) actionFileInputRef.current.value = '';
        };
        
    } catch (error: any) {
        toast.error('Erro ao processar foto: ' + (error?.message || 'Erro desconhecido'));
        setProcessing(false);
    }
  };

  const handleCheckIn = async (itemId: string) => {
    // Check if route date is today
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    // Use string manipulation to avoid timezone shifts (e.g. UTC midnight becoming previous day)
    const routeDateStr = String(route.date).split('T')[0];
    
    if (todayStr !== routeDateStr) {
        toast.error('Check-in permitido apenas na data agendada da visita.');
        return;
    }

    // Find the item to check coordinates
    const itemToCheck = route.items.find((i: any) => i.id === itemId);
    if (!itemToCheck) return;

    // Check camera permission passively
    if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'camera' as PermissionName }).then((permissionStatus) => {
            if (permissionStatus.state === 'denied') {
                setPermissionError('Acesso à câmera está bloqueado nas configurações do navegador.');
            }
        }).catch(() => {
            // Ignore if permission query is not supported
        });
    }

    setProcessing(true);
    
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLat = position.coords.latitude;
                const userLng = position.coords.longitude;

                // Validate Distance (Max 300 meters)
                if (itemToCheck.supermarket?.latitude && itemToCheck.supermarket?.longitude) {
                  const distance = getDistanceFromLatLonInM(
                    userLat,
                    userLng,
                    Number(itemToCheck.supermarket.latitude),
                    Number(itemToCheck.supermarket.longitude)
                  );

                  if (distance > 300) {
                    toast.error(`Você está a ${Math.round(distance)}m do local. Aproxime-se para fazer check-in (Max: 300m).`);
                    setProcessing(false);
                    return;
                  }
                }
                
                // Request Photo instead of proceeding immediately
                setPendingAction({ type: 'CHECKIN', itemId, location: { lat: userLat, lng: userLng } });
                setProcessing(false);
                // setTimeout(() => actionFileInputRef.current?.click(), 100); // Removed auto-trigger to ensure user reads the modal
                // toast('Por favor, tire uma foto da fachada da loja para iniciar.', { icon: '📸' }); // Toast moved to modal logic if needed
            },
            (error) => {
               console.warn('Geolocation error:', error);
               toast.error('Erro de geolocalização: ' + (error.message || 'Tempo esgotado'));
               setProcessing(false);
            }, 
            { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 }
        );
    } else {
        toast.error('Geolocalização não suportada');
        setProcessing(false);
    }
  };

    const getBrandKey = (p: any) => p?.product?.brand?.id || (p?.product?.brand?.name || 'SEM_MARCA');
    const getBrandLabel = (p: any) => p?.product?.brand?.name || 'Sem Marca';
    const getCatLabel = (p: any) => p?.product?.categoryRef?.name || p?.product?.category || 'Geral';
    const getBrandCategoryKey = (p: any) => `${getBrandKey(p)}::${getCatLabel(p)}`;
    const isProductComplete = (p: any) => {
      if (p.isStockout) return !!(p.ruptureReason && String(p.ruptureReason).trim());
  
      const cl = Array.isArray(p.checklists) ? p.checklists : [];
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
  
      const stockCountItems = cl.filter((c: any) => c?.type === 'STOCK_COUNT').length;
      const hasStockCount = stockCountItems > 0;
      const hasNonStock = cl.some((c: any) => c?.type !== 'STOCK_COUNT' && !isIgnoredChecklistItem(c));
      const hasValidity = cl.some((c: any) => isValidityChecklistItem(c));
  
      if (!hasStockCount && !hasNonStock) return true;
  
      const invPolicy = !!p.product?.client?.requiresInventoryCount;
      if (hasStockCount) {
        if (p.gondolaCount == null) return false;
        if ((stockCountItems >= 2 || invPolicy) && p.inventoryCount == null) return false;
      }
  
      const nonStockRequiredChecklists = cl.filter((c: any) => {
        if (c?.type === 'STOCK_COUNT') return false;
        if (isValidityChecklistItem(c)) return false;
        if (isIgnoredChecklistItem(c)) return false;
        return true;
      });
      const nonStockOk = nonStockRequiredChecklists.every((c: any) => !!c?.isChecked);
      if (!nonStockOk) return false;
  
      if (hasValidity) {
        const legacyOk = !!(p.validityDate && p.validityQuantity && p.validityQuantity > 0);
        const storeOk = !!(p.validityStoreDate && p.validityStoreQuantity && p.validityStoreQuantity > 0);
        const stockOk = !!(p.validityStockDate && p.validityStockQuantity && p.validityStockQuantity > 0);
        if (!legacyOk && !storeOk && !stockOk) return false;
      }
  
      return true;
    };
  
    const validateRouteItemCompletion = (item: any) => {
      if (!item?.products) return { valid: false, message: 'Dados inválidos' };
  
      const groups = Array.from(new Set(item.products.map((p: any) => getBrandCategoryKey(p))));
  
      for (const key of groups) {
        const groupProducts = item.products.filter((p: any) => getBrandCategoryKey(p) === key);
        const brandLabel = getBrandLabel(groupProducts[0]);
        const catLabel = getCatLabel(groupProducts[0]);
  
        const photos = item.categoryPhotos?.[key] || {};
        const beforeCount = Array.isArray(photos.before) ? photos.before.length : (photos.before ? 1 : 0);
        const hasBefore = beforeCount >= 1;
        const hasAfter = Array.isArray(photos.after) ? photos.after.length > 0 : !!photos.after;
  
        if (!hasBefore) return { valid: false, message: `Foto de 'Antes' pendente em ${brandLabel} • ${catLabel}.` };
        if (!hasAfter) return { valid: false, message: `Foto de 'Depois' pendente em ${brandLabel} • ${catLabel}.` };

        const extra = item.categoryPhotos?.[`${key}::EXTRA`] || {};
        const extraProducts = Array.isArray(extra.extraProducts) ? extra.extraProducts : [];
        const extraAfter = Array.isArray(extra.after) ? extra.after.length > 0 : !!extra.after;
        if (extraProducts.length > 0 && !extraAfter) {
          return { valid: false, message: `Foto de 'Depois' pendente no Ponto Extra em ${brandLabel} • ${catLabel}.` };
        }
  
        const p = groupProducts.find((p: any) => !isProductComplete(p));
        if (p) return { valid: false, message: `Pendência em ${p.product?.name || 'Produto'} (${brandLabel} • ${catLabel}).` };
      }
  
      return { valid: true };
    };
  
  const handleCheckOut = async (itemId: string) => {
    // Validate Checklist Completion
    const item = route.items.find((i: any) => i.id === itemId);
    const validation = validateRouteItemCompletion(item);
    if (!validation.valid) { const msg = validation.message || 'Complete todas as tarefas antes de finalizar.'; toast.error(msg); return; }

    setProcessing(true);
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLat = position.coords.latitude;
                const userLng = position.coords.longitude;
                
                // Request Photo instead of proceeding immediately
                setPendingAction({ type: 'CHECKOUT', itemId, location: { lat: userLat, lng: userLng } });
                setProcessing(false);
                // setTimeout(() => actionFileInputRef.current?.click(), 100);
                // toast('Por favor, tire uma foto final da loja para encerrar.', { icon: '📸' });
            },
            (error) => {
                console.error('Geolocation error on checkout', error);
                toast.error('Erro de geolocalização: ' + (error.message || 'Não foi possível obter sua localização.'));
                setProcessing(false);
                // Strict mode: Do not proceed if geo fails
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    } else {
        toast.error('Geolocalização não suportada neste dispositivo.');
        setProcessing(false);
    }
  };

  const handleProductCheck = async (itemId: string, productId: string, checked: boolean) => {
    try {
      await client.patch(`/routes/items/${itemId}/products/${productId}/check`, {
        checked
      });
      fetchRoute();
    } catch (error) {
       console.error('API failed, saving offline action', error);
       await offlineService.addPendingAction(
         'FORM',
         `/routes/items/${itemId}/products/${productId}/check`,
         'PATCH',
         { checked }
       );
       
       // Optimistic UI update
       const updatedItems = route.items.map((item: any) => {
         if (item.id === itemId) {
             const updatedProducts = item.products.map((p: any) => 
                 p.productId === productId ? { ...p, checked } : p
             );
             return { ...item, products: updatedProducts };
         }
         return item;
       });
       setRoute({ ...route, items: updatedItems });
       updatePendingCount();
    }
  };

  const openGoogleMaps = (lat?: number, lng?: number) => {
    if (!lat || !lng) {
      toast.error('Localização do supermercado não disponível');
      return;
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank');
  };

  if (loading) return <div className="p-8 text-center">Carregando...</div>;
  if (!route) return <div className="p-8 text-center">Rota não encontrada</div>;

  const totalDurationMs = route.items.reduce((acc: number, item: any) => {
      if (item.checkInTime && item.checkOutTime) {
          return acc + (new Date(item.checkOutTime).getTime() - new Date(item.checkInTime).getTime());
      }
      return acc;
  }, 0);

  const hours = Math.floor(totalDurationMs / (1000 * 60 * 60));
  const minutes = Math.floor((totalDurationMs % (1000 * 60 * 60)) / (1000 * 60));
  const totalDurationStr = `${hours}h ${minutes}m`;

  return (
    <div className="bg-gray-50 min-h-screen pb-32">
      <Toaster position="top-center" />
      
      {/* Header */}
      <div className="bg-white px-4 py-3 shadow-sm flex flex-col gap-2 sticky top-0 z-10">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <button onClick={() => navigate('/')} className="p-1">
                <ArrowLeft size={24} className="text-gray-600" />
                </button>
                <div>
                <h1 className="font-bold text-gray-800">Detalhes da Rota</h1>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{String(route.date).split('T')[0].split('-').reverse().join('/')}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1"><Clock size={10} /> {totalDurationStr}</span>
                </div>
                </div>
            </div>
            
            <div className="flex items-center gap-2">
                {pendingCount > 0 && (
                    <button 
                        onClick={() => offlineService.syncPendingActions(true)}
                        className="p-2 bg-orange-100 text-orange-600 rounded-full animate-pulse"
                        title={`${pendingCount} ações pendentes. Clique para forçar sincronização.`}
                    >
                        <RefreshCw size={20} />
                    </button>
                )}
                {isOnline ? (
                    <Wifi size={20} className="text-green-500" title="Online" />
                ) : (
                    <WifiOff size={20} className="text-red-500" title="Offline" />
                )}
            </div>
        </div>

        {((route.promoters && route.promoters.length > 0) || route.promoter) && (
            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <span className="text-xs font-bold text-gray-500">Equipe:</span>
                <div className="flex -space-x-2">
                    {((route.promoters && route.promoters.length > 0) ? route.promoters : (route.promoter ? [route.promoter] : [])).map((p: any) => {
                      const displayName = (p.fullName || p.name || p.email || '').trim() || 'Promotor';
                      return (
                        <div
                          key={p.id}
                          className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 border-2 border-white flex items-center justify-center text-[10px] font-bold"
                          title={displayName}
                        >
                          {displayName.charAt(0).toUpperCase()}
                        </div>
                      );
                    })}
                </div>
                <span className="text-xs text-gray-400 ml-1">
                    {((route.promoters && route.promoters.length > 0) ? route.promoters : (route.promoter ? [route.promoter] : [])).map((p: any) => {
                      const displayName = (p.fullName || p.name || p.email || '').trim() || 'Promotor';
                      return displayName.split(' ')[0];
                    }).join(', ')}
                </span>
            </div>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Deduplicate items just in case */}
        {Array.from(new Map(route.items.map((item: any) => [item.id, item])).values())
            .sort((a: any, b: any) => a.order - b.order)
            .map((item: any, index: number) => {
           const isActive = activeItem?.id === item.id;
           const isCompleted = item.status === 'CHECKOUT' || item.status === 'COMPLETED';
           // const isPending = item.status === 'PENDING' || !item.status;
           
           const itemDuration = formatDuration(item.checkInTime, item.checkOutTime);
           
           let distanceText = '';
           if (userLocation && item.supermarket?.latitude && item.supermarket?.longitude) {
             const dist = getDistanceFromLatLonInM(
               userLocation.lat,
               userLocation.lng,
               Number(item.supermarket.latitude),
               Number(item.supermarket.longitude)
             );
             distanceText = dist > 1000 ? `${(dist/1000).toFixed(1)}km` : `${Math.round(dist)}m`;
           }

           // Check if current user is checked in
           const currentUserCheckin = item.checkins?.find((c: any) => {
             const pId = c.promoterId || c.promoter?.id;
             const uId = user?.employee?.id || user?.id;
             return pId === uId && !c.checkOutTime;
           });
           const isCurrentUserCheckedIn = !!currentUserCheckin;

  // Determine effective status for current user
  // If user is checked in, treat as Active for them regardless of route item status
  // If route item is Active but user not checked in, treat as Pendng (needs Checkin)
  const isUserActive = isCurrentUserCheckedIn;
  const isItemActiveGlobal = isActive; // Existing isActive is based on item.status === 'CHECKIN'
  const isRouteCompleted = route.status === 'COMPLETED';

  // If item is globally active but user hasn't checked in, we want to show CHECKIN button.
  // If item is NOT active globally, but user hasn't checked in, show CHECKIN button (standard flow).

  const showCheckInButton = !isCurrentUserCheckedIn && !isCompleted && !isRouteCompleted;
  const showActions = isCurrentUserCheckedIn && !isRouteCompleted; 
  // Wait, if item is completed, we don't show checkin.
  
  // Refined Logic:
  // Show Check-in if: Not Completed AND Not Checked In (regardless of Global Active status) AND Route Not Completed
  // Show Actions if: Checked In (regardless of Global Active status) AND Route Not Completed

  return (
    <div id={`item-${item.id}`} key={item.id} className={`bg-white rounded-xl shadow-sm border overflow-hidden ${isUserActive ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-100'} ${isRouteCompleted ? 'opacity-75' : ''}`}>
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-3 flex-1">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
              isCompleted ? 'bg-green-100 text-green-600' : 
              isUserActive ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
            }`}>
              {isCompleted ? <CheckCircle size={16} /> : <span className="text-xs font-bold">{index + 1}</span>}
            </div>
            <div className="flex-1 min-w-0" onClick={() => openGoogleMaps(item.supermarket?.latitude, item.supermarket?.longitude)}>
            <h3 className="font-bold text-gray-800 truncate">{item.supermarket?.fantasyName || item.supermarket?.name || 'Supermercado sem nome'}</h3>
            <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
              <MapPin size={10} /> {item.supermarket?.address || `${item.supermarket?.street || ''}, ${item.supermarket?.number || ''}`}
            </p>
            {distanceText && (
              <p className="text-xs text-blue-600 font-medium mt-1 flex items-center gap-1">
                <Navigation size={10} /> {distanceText}
              </p>
            )}
            {itemDuration && (
              <p className="text-xs text-green-600 font-medium mt-1 flex items-center gap-1">
                <Clock size={10} /> {itemDuration}
              </p>
            )}
          </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${
              isCompleted ? 'bg-green-50 text-green-700' :
              isUserActive ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {isUserActive ? 'Em Andamento (Você)' : isItemActiveGlobal ? 'Em Andamento (Equipe)' : isCompleted ? 'Concluído' : 'Pendente'}
            </span>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                openGoogleMaps(item.supermarket?.latitude, item.supermarket?.longitude);
              }}
              className="p-1.5 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors"
              title="Abrir no Google Maps"
            >
              <Navigation size={14} />
            </button>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-gray-50">
          {showActions ? (
            <div className="space-y-3">
              <button
                onClick={() => setShowTasksModal(true)}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium shadow-sm flex items-center justify-center gap-2 mb-2"
              >
                <ListTodo size={20} />
                Ver Lista de Tarefas
              </button>

              <div className="flex gap-2 flex-col">
                {!validateRouteItemCompletion(item).valid && (
                  <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded border border-orange-100 mb-1">
                    {validateRouteItemCompletion(item).message || 'Complete todas as tarefas para finalizar.'}
                  </div>
                )}
                <button 
                  onClick={() => handleCheckOut(item.id)}
                  disabled={processing || !validateRouteItemCompletion(item).valid}
                  className={`flex-1 py-3 text-white rounded-lg font-bold shadow-sm flex items-center justify-center gap-2 transition-all ${
                    processing || !validateRouteItemCompletion(item).valid
                      ? 'bg-gray-300 cursor-not-allowed text-gray-500' 
                      : 'bg-green-600 hover:bg-green-700 animate-pulse'
                  }`}
                >
                  <CheckCircle size={20} />
                  Finalizar Visita
                </button>
              </div>

            </div>
          ) : isCompleted ? (
            <div className="flex flex-col items-start gap-1 text-sm">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle size={16} />
                <span>Visita realizada</span>
                {item.checkOutTime && (
                  <span className="text-xs text-gray-400">
                    ({format(new Date(item.checkOutTime), 'HH:mm')})
                  </span>
                )}
              </div>
              {item.manualEntryBy && (
                <div className="flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
                  <AlertTriangle size={12} />
                  <span>Fechamento manual</span>
                </div>
              )}
            </div>
          ) : isRouteCompleted ? (
             <div className="flex items-center gap-2 text-gray-500 text-sm bg-gray-50 p-2 rounded">
                <CheckCircle size={16} />
                <span>Rota Finalizada</span>
             </div>
          ) : isFutureRoute ? (
             <div className="flex items-center gap-2 text-gray-500 text-sm bg-gray-50 p-2 rounded">
                <Clock size={16} />
                <span>Rota futura. Check-in liberado apenas no dia da visita.</span>
             </div>
          ) : isPastRoute ? (
             <div className="flex flex-col gap-1 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                <span>Rota de data anterior. Novo check-in não é permitido.</span>
                <span>Use o painel web para ajustes ou lançamentos manuais.</span>
             </div>
          ) : (
            <div className="space-y-2">
                {/* Visual block for checklist if team is active but user hasn't joined */}
                {isItemActiveGlobal && (
                    <button
                        disabled
                        className="w-full py-3 bg-gray-100 text-gray-400 rounded-lg font-medium shadow-sm flex items-center justify-center gap-2 cursor-not-allowed border border-gray-200 mb-2"
                    >
                        <ListTodo size={20} />
                        Checklist Bloqueado (Necessário Entrar na Equipe)
                    </button>
                )}
                <button 
                  onClick={() => handleCheckIn(item.id)}
                  disabled={processing}
                  className={`w-full py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2 text-white ${
                      isItemActiveGlobal 
                        ? 'bg-orange-600 hover:bg-orange-700 shadow-md' 
                        : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  <MapPin size={16} />
                  {isItemActiveGlobal ? 'Entrar na Equipe' : 'Fazer Check-in'}
                </button>
            </div>
          )}
                 </div>
               </div>
             </div>
           );
        })}
      </div>

      {/* Tasks Modal */}
      {showTasksModal && activeItem && (
        selectedCategoryKey && selectedCategoryLabel && selectedBrandKey && selectedBrandLabel ? (
          <CategoryTaskFlow
            routeItem={activeItem}
            categoryKey={selectedCategoryKey}
            categoryLabel={selectedCategoryLabel}
            brandLabel={selectedBrandLabel}
            products={activeItem.products.filter((p: any) => getBrandKey(p) === selectedBrandKey && getCatLabel(p) === selectedCategoryLabel)}
            photoConfig={
              activeItem.products.find(
                (p: any) => getBrandKey(p) === selectedBrandKey && getCatLabel(p) === selectedCategoryLabel
              )?.product?.client?.photoConfig
            }
            onUpdateItem={async (itemId, data, skipSync) => {
              const updatedItems = route.items.map((i: any) =>
                i.id === itemId ? { ...i, ...data } : i
              );
              setRoute({ ...route, items: updatedItems });
              if (!skipSync) {
                  await client.patch(`/routes/items/${itemId}`, data);
              }
            }}
            onUpdateProduct={async (productId, data) => {
              const updatedItems = route.items.map((i: any) => {
                if (i.id === activeItem.id) {
                  return {
                    ...i,
                    products: i.products.map((p: any) =>
                      p.productId === productId ? { ...p, ...data } : p
                    ),
                  };
                }
                return i;
              });
              setRoute({ ...route, items: updatedItems });
              await client.patch(
                `/routes/items/${activeItem.id}/products/${productId}/check`,
                data
              );
            }}
            onFinish={() => {
              setSelectedBrandKey(null);
              setSelectedBrandLabel(null);
              setSelectedCategoryKey(null);
              setSelectedCategoryLabel(null);
            }}
            onBack={() => {
              setSelectedBrandKey(null);
              setSelectedBrandLabel(null);
              setSelectedCategoryKey(null);
              setSelectedCategoryLabel(null);
            }}
            mode="FULL"
            readOnly={isPastRoute || activeItem.status === 'CHECKOUT' || activeItem.status === 'COMPLETED'}
          />
        ) : (
            <div className="fixed inset-0 z-60 bg-black bg-opacity-50 flex flex-col justify-end sm:justify-center" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
                <div className="bg-white rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col w-full sm:max-w-md mx-auto">
                    <div className="p-4 border-b flex justify-between items-center" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
                        <div>
                            <h3 className="font-bold text-lg text-gray-800">Tarefas da Visita</h3>
                            <p className="text-xs text-gray-500">{activeItem.supermarket.name}</p>
                        </div>
                        <button onClick={() => setShowTasksModal(false)} className="p-2 bg-gray-100 rounded-full">
                            <X size={20} />
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
                        {/* Registro de Visita Card */}
                        <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
                            <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                                <MapPin size={18} className="text-blue-600" />
                                Registro de Visita
                            </h4>
                            
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <span className="text-xs font-medium text-gray-500 block">Entrada (Check-in)</span>
                                    {activeItem.checkins?.find((c: any) => (c.promoterId || c.promoter?.id) === (user?.employee?.id || user?.id))?.entryPhoto ? (
                                        <div 
                                            className="aspect-square rounded-lg overflow-hidden border border-gray-200 relative group cursor-pointer"
                                            onClick={() => {
                                                const checkin = activeItem.checkins?.find((c: any) => (c.promoterId || c.promoter?.id) === (user?.employee?.id || user?.id));
                                                if (checkin?.entryPhoto) {
                                                    setCurrentPhoto({ blob: new Blob(), url: resolveImageUrl(checkin.entryPhoto) });
                                                    setShowPhotoPreview(true);
                                                }
                                            }}
                                        >
                                            <img 
                                                src={resolveImageUrl(activeItem.checkins?.find((c: any) => (c.promoterId || c.promoter?.id) === (user?.employee?.id || user?.id))?.entryPhoto)} 
                                                alt="Check-in" 
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all flex items-center justify-center">
                                                <Camera size={20} className="text-white opacity-0 group-hover:opacity-100 drop-shadow-md" />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="aspect-square rounded-lg bg-gray-50 border border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400">
                                            <Camera size={24} className="mb-1" />
                                            <span className="text-[10px]">Sem foto</span>
                                        </div>
                                    )}
                                    <div className="text-xs text-gray-600">
                                        {activeItem.checkins?.find((c: any) => (c.promoterId || c.promoter?.id) === (user?.employee?.id || user?.id))?.checkInTime ? 
                                            format(new Date(activeItem.checkins?.find((c: any) => (c.promoterId || c.promoter?.id) === (user?.employee?.id || user?.id))?.checkInTime), 'HH:mm') : '--:--'}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <span className="text-xs font-medium text-gray-500 block">Saída (Check-out)</span>
                                    {activeItem.checkins?.find((c: any) => (c.promoterId || c.promoter?.id) === (user?.employee?.id || user?.id))?.exitPhoto ? (
                                         <div 
                                            className="aspect-square rounded-lg overflow-hidden border border-gray-200 relative group cursor-pointer"
                                            onClick={() => {
                                                const checkin = activeItem.checkins?.find((c: any) => (c.promoterId || c.promoter?.id) === (user?.employee?.id || user?.id));
                                                if (checkin?.exitPhoto) {
                                                    setCurrentPhoto({ blob: new Blob(), url: resolveImageUrl(checkin.exitPhoto) });
                                                    setShowPhotoPreview(true);
                                                }
                                            }}
                                         >
                                            <img 
                                                src={resolveImageUrl(activeItem.checkins?.find((c: any) => (c.promoterId || c.promoter?.id) === (user?.employee?.id || user?.id))?.exitPhoto)} 
                                                alt="Check-out" 
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    ) : (
                                        <div className="aspect-square rounded-lg bg-gray-50 border border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400">
                                            <LogOut size={24} className="mb-1" />
                                            <span className="text-[10px]">Pendente</span>
                                        </div>
                                    )}
                                     <div className="text-xs text-gray-600">
                                        {activeItem.checkins?.find((c: any) => (c.promoterId || c.promoter?.id) === (user?.employee?.id || user?.id))?.checkOutTime ? 
                                            format(new Date(activeItem.checkins?.find((c: any) => (c.promoterId || c.promoter?.id) === (user?.employee?.id || user?.id))?.checkOutTime), 'HH:mm') : '--:--'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {(() => {
                          const products = (activeItem.products || []) as any[];
                          const brandMap = new Map<string, { brandKey: string; brandLabel: string; categories: Map<string, any[]> }>();

                          for (const p of products) {
                            const bKey = getBrandKey(p);
                            const bLabel = getBrandLabel(p);
                            const cLabel = getCatLabel(p);

                            if (!brandMap.has(bKey)) {
                              brandMap.set(bKey, { brandKey: bKey, brandLabel: bLabel, categories: new Map() });
                            }
                            const b = brandMap.get(bKey)!;
                            if (!b.categories.has(cLabel)) b.categories.set(cLabel, []);
                            b.categories.get(cLabel)!.push(p);
                          }

                          const brands = Array.from(brandMap.values()).sort((a, b) => a.brandLabel.localeCompare(b.brandLabel, 'pt-BR'));

                          return brands.map((brand) => {
                            const cats = Array.from(brand.categories.entries()).sort(([a], [b]) => a.localeCompare(b, 'pt-BR'));
                            return (
                              <div key={brand.brandKey} className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-black text-slate-800">{brand.brandLabel}</h4>
                                  <span className="text-[10px] text-slate-500 font-semibold">{cats.length} categorias</span>
                                </div>

                                <div className="space-y-3">
                                  {cats.map(([catLabel, catProducts]) => {
                                    const groupKey = `${brand.brandKey}::${catLabel}`;
                                    const total = catProducts.length;
                                    const completed = catProducts.filter((p: any) => isProductComplete(p)).length;
                                    const photos = activeItem.categoryPhotos?.[groupKey] || {};
                                    const beforeCount = Array.isArray(photos.before) ? photos.before.length : (photos.before ? 1 : 0);
                                    const afterCount = Array.isArray(photos.after) ? photos.after.length : (photos.after ? 1 : 0);
                                    const extra = activeItem.categoryPhotos?.[`${groupKey}::EXTRA`] || {};
                                    const extraProducts = Array.isArray(extra.extraProducts) ? extra.extraProducts : [];
                                    const extraAfterCount = Array.isArray(extra.after) ? extra.after.length : (extra.after ? 1 : 0);

                                    const beforeOk = beforeCount >= 1;
                                    const afterOk = afterCount > 0;
                                    const extraOk = extraProducts.length === 0 || extraAfterCount > 0;
                                    const isDone = completed === total && total > 0 && beforeOk && afterOk && extraOk;
                                    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
                                    const productNames = catProducts
                                      .slice()
                                      .sort((a: any, b: any) =>
                                        String(a?.product?.name || '').localeCompare(String(b?.product?.name || ''), 'pt-BR')
                                      )
                                      .map((p: any) => String(p?.product?.name || '').trim())
                                      .filter(Boolean);
                                    const previewNames = productNames.slice(0, 4);
                                    const remainingCount = Math.max(0, productNames.length - previewNames.length);

                                    return (
                                      <button
                                        key={groupKey}
                                        onClick={() => {
                                          setSelectedBrandKey(brand.brandKey);
                                          setSelectedBrandLabel(brand.brandLabel);
                                          setSelectedCategoryKey(groupKey);
                                          setSelectedCategoryLabel(catLabel);
                                        }}
                                        className="w-full text-left bg-white p-4 rounded-xl border border-gray-200 shadow-sm active:scale-[0.99] transition-transform"
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                              <h5 className="font-bold text-gray-800 truncate">{catLabel}</h5>
                                              <ChevronRight size={18} className="text-gray-300 flex-shrink-0" />
                                            </div>

                                            <div className="flex items-center gap-2 mt-1 mb-1">
                                              <span className="text-xs text-gray-500">{completed}/{total} itens</span>
                                              {isDone && (
                                                <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                                                  Concluído
                                                </span>
                                              )}
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                              <span
                                                className={`text-[10px] px-2 py-0.5 rounded-full ${
                                                  beforeOk ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                                                }`}
                                              >
                                                {beforeOk ? `Foto Antes OK (${beforeCount}/3)` : `Foto Antes ${beforeCount}/3`}
                                              </span>
                                              <span
                                                className={`text-[10px] px-2 py-0.5 rounded-full ${
                                                  afterOk ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                                                }`}
                                              >
                                                {afterOk ? `Foto Final OK (${afterCount})` : 'Foto Final pendente'}
                                              </span>
                                            </div>

                                            {previewNames.length > 0 && (
                                              <div className="mt-2 text-[11px] text-gray-500 line-clamp-2">
                                                {previewNames.join(' • ')}
                                                {remainingCount > 0 ? ` • +${remainingCount}` : ''}
                                              </div>
                                            )}

                                            <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden mt-2">
                                              <div
                                                className={`h-full rounded-full ${progress === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                                                style={{ width: `${progress}%` }}
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          });
                        })()}
                        {(!activeItem.products || activeItem.products.length === 0) && (
                            <div className="text-center py-8 text-gray-500">
                                <ListTodo size={48} className="mx-auto mb-2 opacity-20" />
                                <p>Nenhuma tarefa listada.</p>
                            </div>
                        )}
                    </div>
                    
                    <div
                      className="sticky bg-white border-t p-4"
                      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 72px)' }}
                    >
                        {(() => {
                          const validation = validateRouteItemCompletion(activeItem);
                          return (
                            <button
                              onClick={() => handleCheckOut(activeItem.id)}
                              className={`w-full py-3 rounded-lg font-bold transition-all ${
                                validation.valid 
                                  ? 'bg-green-600 text-white hover:bg-green-700 shadow-lg animate-pulse' 
                                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              }`}
                              disabled={processing || !validation.valid}
                            >
                              Finalizar Visita
                            </button>
                          );
                        })()}
                    </div>
                </div>
            </div>
        )
      )}

      {/* Modal Preview Photo */}
      {showPhotoPreview && currentPhoto && (
        <div className="fixed inset-0 z-60 bg-black bg-opacity-90 flex flex-col items-center justify-center p-4">
            <div className="bg-white p-2 rounded-lg max-w-full max-h-[80vh] overflow-hidden flex flex-col gap-4">
                <img src={currentPhoto.url} alt="Preview" className="max-w-full max-h-[60vh] object-contain" />
                <div className="flex gap-2 justify-between">
                    <button 
                        onClick={() => { setShowPhotoPreview(false); setCurrentPhoto(null); }}
                        className="flex-1 py-3 bg-gray-200 text-gray-800 rounded-lg font-medium flex items-center justify-center gap-2"
                    >
                        <X size={20} /> Cancelar
                    </button>
                    <button 
                        onClick={confirmPhotoUpload}
                        className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                        disabled={processing}
                    >
                        {processing ? <RefreshCw className="animate-spin" /> : <CheckCircle size={20} />} 
                        Confirmar Envio
                    </button>
                </div>
            </div>
        </div>
      )}

      <input 
        type="file" 
        ref={fileInputRef}
        accept="image/*"
        capture="environment"
        className="fixed top-0 left-0 opacity-0 w-1 h-1 -z-10"
        onChange={handlePhotoCapture}
      />

      <input 
        type="file" 
        ref={actionFileInputRef}
        accept="image/*"
        capture="environment"
        className="fixed top-0 left-0 opacity-0 w-1 h-1 -z-10"
        onChange={handleActionPhoto}
      />

      {/* Camera Trigger Modal - Fallback if auto-open fails */}
      {pendingAction && (
        <div className="fixed inset-0 z-[70] bg-black bg-opacity-80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 flex flex-col items-center gap-6 shadow-2xl">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 animate-pulse">
              <Camera size={40} />
            </div>
            
            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {pendingAction.type === 'CHECKIN' ? 'Foto da Fachada' : 'Foto de Saída'}
              </h3>
              <p className="text-gray-600">
                {pendingAction.type === 'CHECKIN' 
                  ? 'Para confirmar sua chegada, precisamos de uma foto da frente da loja.' 
                  : 'Para finalizar, tire uma foto para comprovar o término do trabalho.'}
              </p>
            </div>

            <button 
              onClick={() => {
                setPermissionError(null);
                // Directly trigger input click to avoid losing user activation context
                // The browser will handle permissions for file input with capture="environment"
                actionFileInputRef.current?.click();
              }}
              className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg shadow-lg hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <Camera size={24} />
              Tirar Foto Agora
            </button>

            {/* Helper text for permissions */}
            <div className="text-xs text-gray-500 text-center mt-2 px-4">
              <p>Se a câmera não abrir, verifique se o navegador tem permissão de acesso à câmera nas configurações do site.</p>
            </div>

            {permissionError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 w-full text-center animate-shake">
                    <p className="font-bold flex items-center justify-center gap-1">
                        <AlertTriangle size={16} /> Permissão Negada
                    </p>
                    <p>{permissionError}</p>
                    <p className="text-xs mt-1 text-red-500">Verifique: Configurações &gt; Permissões do Site &gt; Câmera</p>
                </div>
            )}

            <button 
              onClick={() => {
                setPendingAction(null);
                setProcessing(false);
                setPermissionError(null);
              }}
              className="text-gray-500 font-medium text-sm hover:text-gray-700 py-2"
            >
              Cancelar
            </button>
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

      {/* Bottom Actions Bar (Only if checked in) */}
      {activeItem && (activeItem.checkins?.some((c: any) => {
          const pId = c.promoterId || c.promoter?.id;
          const uId = user?.employee?.id || user?.id;
          return pId === uId && !c.checkOutTime;
      })) && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 flex justify-around items-center z-60">
          {/* <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-1 text-blue-600"
            disabled={processing}
          >
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <Camera size={24} />
            </div>
            <span className="text-xs font-medium">Fotos</span>
          </button> */}

          <button 
            className="flex flex-col items-center gap-1 text-blue-600"
            onClick={() => setShowTasksModal(true)}
          >
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
              <ListTodo size={24} />
            </div>
            <span className="text-xs font-medium">Tarefas</span>
          </button>

          <button 
            onClick={() => handleCheckOut(activeItem.id)}
            className="flex flex-col items-center gap-1 text-red-600"
            disabled={processing}
          >
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <LogOut size={24} />
            </div>
            <span className="text-xs font-medium">Saída</span>
          </button>
        </div>
      )}
    </div>
  );
};

// Helper icon
function LogOut(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  );
}

export default RouteDetailsView;
                                                                                                
