import { db, PendingAction } from '../db/db';
import client from '../api/client';
import toast from 'react-hot-toast';

class OfflineService {
  private normalizePayload(action: PendingAction) {
    if (action.type === 'PRODUCT_CHECK' && action.method === 'PATCH') {
      const payload = action.payload || {};

      const hasSplit =
        Object.prototype.hasOwnProperty.call(payload, 'validityStoreDate') ||
        Object.prototype.hasOwnProperty.call(payload, 'validityStoreQuantity') ||
        Object.prototype.hasOwnProperty.call(payload, 'validityStockDate') ||
        Object.prototype.hasOwnProperty.call(payload, 'validityStockQuantity');

      if (!hasSplit) {
        const legacyDate = payload.validityDate ? String(payload.validityDate) : '';
        const legacyQtyRaw = payload.validityQuantity;
        const legacyQty =
          legacyQtyRaw !== null && legacyQtyRaw !== undefined ? Number(legacyQtyRaw) : undefined;

        if (legacyDate) {
          return {
            ...payload,
            validityStoreDate: legacyDate,
            validityStoreQuantity: legacyQty,
            validityStockDate: payload.validityStockDate ?? null,
            validityStockQuantity: payload.validityStockQuantity ?? null,
          };
        }
      }

      return payload;
    }

    return action.payload;
  }

  async saveRoute(route: any) {
    try {
      const existing = await db.routes.get(route.id);

      const mergeArrayById = (prevArr: any[] | undefined, nextArr: any[] | undefined) => {
        const prev = Array.isArray(prevArr) ? prevArr : [];
        const next = Array.isArray(nextArr) ? nextArr : [];
        const byId = new Map<string, any>();

        for (const p of prev) {
          if (p && p.id) byId.set(p.id, p);
        }
        for (const n of next) {
          if (!n || !n.id) continue;
          const old = byId.get(n.id);
          byId.set(n.id, old ? { ...old, ...n } : n);
        }

        return Array.from(byId.values());
      };

      const mergedItems = (() => {
        const prevItems = Array.isArray(existing?.items) ? existing.items : [];
        const nextItems = Array.isArray(route?.items) ? route.items : [];

        const byId = new Map<string, any>();
        for (const p of prevItems) {
          if (p && p.id) byId.set(p.id, p);
        }

        for (const n of nextItems) {
          if (!n || !n.id) continue;
          const old = byId.get(n.id);
          if (!old) {
            byId.set(n.id, n);
            continue;
          }

          const merged = { ...old, ...n };
          merged.supermarket = n.supermarket ?? old.supermarket;
          merged.products = Array.isArray(n.products) && n.products.length > 0 ? n.products : old.products;
          merged.checkins = mergeArrayById(old.checkins, n.checkins);
          merged.categoryPhotos = n.categoryPhotos ?? old.categoryPhotos;
          merged.observation = n.observation ?? old.observation;
          byId.set(n.id, merged);
        }

        return Array.from(byId.values());
      })();

      await db.routes.put({
        id: route.id,
        date: route.date,
        promoterId: route.promoter?.id,
        promoters: Array.isArray(route.promoters) ? route.promoters : existing?.promoters,
        items: mergedItems,
        status: route.status ?? existing?.status,
        syncedAt: new Date()
      });
      console.log('Route cached offline:', route.id);
    } catch (error) {
      console.error('Error caching route:', error);
    }
  }

  async getRoute(routeId: string) {
    return await db.routes.get(routeId);
  }

  async getRoutesByDate(date: string) {
    // Busca rotas que começam com a data (YYYY-MM-DD)
    return await db.routes
      .where('date')
      .startsWith(date)
      .toArray();
  }

  async getAllRoutes() {
    return await db.routes.toArray();
  }

  async addPendingAction(
    type: PendingAction['type'],
    url: string,
    method: PendingAction['method'],
    payload: any
  ) {
    try {
      await db.pendingActions.add({
        type,
        url,
        method,
        payload,
        createdAt: new Date(),
        status: 'PENDING',
        retryCount: 0
      });
      
      if (navigator.onLine) {
        // If online, don't show "Saved offline" toast, just let the sync start
        // The sync process will show "Synchronizing..."
        this.syncPendingActions();
      } else {
        toast.success('Salvo no dispositivo. Será enviado quando houver conexão.', {
            icon: '💾',
            duration: 4000
        });
      }
    } catch (error) {
      console.error('Error saving pending action:', error);
      toast.error('Erro ao salvar ação offline.');
    }
  }

  async syncPendingActions(force: boolean = false) {
    if (!navigator.onLine && !force) return;

    // Fetch both PENDING and ERROR status to retry failed attempts
    const pendingActions = await db.pendingActions
      .where('status')
      .anyOf('PENDING', 'ERROR')
      .toArray();

    if (pendingActions.length === 0) return;

    // Sort by createdAt to ensure correct order (Entry -> Lunch -> Exit)
    pendingActions.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const toastId = toast.loading(`Sincronizando ${pendingActions.length} ações pendentes...`);

    let successCount = 0;
    let failCount = 0;

    for (const action of pendingActions) {
      try {
        await db.pendingActions.update(action.id!, { status: 'SYNCING' });

        const normalizedPayload = this.normalizePayload(action);
        if (normalizedPayload !== action.payload) {
          await db.pendingActions.update(action.id!, { payload: normalizedPayload });
          action.payload = normalizedPayload;
        }

        console.log(`Syncing action ${action.type}: ${action.url}`, action.payload);

        // Execute API call
        if (action.type === 'DOCUMENT_UPLOAD') {
             // Reconstruct FormData for file upload
             const formData = new FormData();
             const { fileBase64, filename, type, description } = action.payload;
             
             // Convert Base64 to Blob
             const res = await fetch(fileBase64);
             const blob = await res.blob();
             
             formData.append('file', blob, filename);
             formData.append('type', type || 'Outros');
             formData.append('description', description || '');
             
             await client.post(action.url, formData);

        } else if (action.type === 'PHOTO') {
             const formData = new FormData();
             const { fileBase64, filename, photoType, category } = action.payload;
             const res = await fetch(fileBase64);
             const blob = await res.blob();
             if (photoType) formData.append('type', photoType);
             if (category !== undefined && category !== null) formData.append('category', category);
             formData.append('file', blob, filename || 'photo.jpg');
             await client.post(action.url, formData);

        } else if (action.type === 'BREAKAGE_REPORT') {
             const { productId, routeItemId, supermarketId, quantity, photos, description } = action.payload;
             const uploadedPhotoUrls: string[] = [];

             if (photos && Array.isArray(photos)) {
                 for (const photo of photos) {
                     // 1. Convert base64 to Blob
                     const res = await fetch(photo.base64);
                     const blob = await res.blob();

                     // 2. Upload to /upload
                     const formData = new FormData();
                     formData.append('file', blob, photo.filename || 'breakage.jpg');
                     
                     const uploadRes = await client.post('/upload', formData);
                     const url = uploadRes?.data?.path || uploadRes?.data?.url;
                     if (url) {
                         uploadedPhotoUrls.push(url);
                     }
                 }
             }

             // 3. Post JSON to /breakages
             const breakagePayload = {
                 productId,
                 routeItemId,
                 supermarketId,
                 quantity: Number(quantity),
                 photos: uploadedPhotoUrls,
                 description,
             };

             await client.post(action.url, breakagePayload);

        } else if (action.method === 'POST') {
          await client.post(action.url, action.payload);
        } else if (action.method === 'PUT') {
          await client.put(action.url, action.payload);
        } else if (action.method === 'PATCH') {
          await client.patch(action.url, action.payload);
        }

        // Remove from DB on success
        await db.pendingActions.delete(action.id!);
        successCount++;
        
      } catch (error: any) {
        console.error(`Error syncing action ${action.id}:`, error);
        const errorMessage = error.response?.data?.message || error.message || 'Erro desconhecido';
        const statusCode = error.response?.status;

        console.error(`Sync failure details for ${action.type}:`, errorMessage, statusCode);
        
        // Se for 400 (Bad Request), o erro pode ser fatal (dados inválidos)
        // Se for "Usuário não vinculado", precisamos avisar o usuário para relogar
        if (statusCode === 400 && errorMessage.includes('não vinculado')) {
             toast.error('Sessão inválida: Faça logout e login novamente.', { duration: 5000 });
        }

        // Exception: 409 Conflict (already exists) -> treat as success
        if (statusCode === 409) {
             console.warn('Action conflict (already exists), removing from queue:', action.id);
             await db.pendingActions.delete(action.id!);
             successCount++;
        } 
        // Auth Errors (401/403) -> Fatal, requires login
        else if (statusCode === 401 || statusCode === 403) {
             console.error(`Auth error ${statusCode} for action ${action.id}.`);
             toast.error('Sessão expirada. Faça login novamente.');
             // Don't delete, let user retry after login? Or delete?
             // Usually retry after login works.
             await db.pendingActions.update(action.id!, { 
               status: 'ERROR', 
               error: 'Sessão expirada. Faça login novamente.',
               retryCount: (action.retryCount || 0) + 1 
             });
             failCount++;
        }
        // Client Errors (4xx) -> Log but DO NOT DELETE automatically to prevent data loss
        // Unless it's clearly invalid data that will never succeed
        else if (statusCode && statusCode >= 400 && statusCode < 500 && statusCode !== 408 && statusCode !== 429) {
             console.error(`Client error ${statusCode} for action ${action.id}. Keeping in queue as ERROR.`);
             
             let errorMsg = `${errorMessage} (${statusCode})`;
             
             // Handle Payload Too Large specifically
             if (statusCode === 413) {
                 errorMsg = 'Foto muito grande para envio. Tente tirar uma foto com menor resolução.';
                 // In this case, retrying won't help unless we resize. 
                 // Ideally we should resize on client before sending, but here we are stuck with the payload.
                 // We could try to compress the base64 if it's an image action?
                 // For now, just mark as specific error so user knows.
             }

             await db.pendingActions.update(action.id!, { 
               status: 'ERROR', 
               error: errorMsg,
               retryCount: (action.retryCount || 0) + 1 
             });
             failCount++;
        }
        else {
             // Server Errors (5xx) or Network Errors -> Retry later
             await db.pendingActions.update(action.id!, { 
               status: 'ERROR', 
               error: errorMessage,
               retryCount: (action.retryCount || 0) + 1 
             });
             failCount++;
        }
      }
    }

    toast.dismiss(toastId);
    
    if (failCount === 0) {
      toast.success('Sincronização concluída com sucesso!');
      window.dispatchEvent(new Event('sync-complete'));
    } else {
      // Get the last error message to show to the user
      // Recarrega as ações para pegar o erro atualizado do DB
      const failedActions = await db.pendingActions.where('status').equals('ERROR').toArray();
      const lastErrorAction = failedActions[failedActions.length - 1];
      
      const errorMsg = lastErrorAction?.error || 'Verifique sua conexão e tente novamente.';
      
      // Toast persistente se for erro de validação
      toast.error(`${failCount} falhas: ${errorMsg}`, {
        duration: 6000,
        style: { maxWidth: '500px' }
      });
    }
    
    // Refresh pending count UI
    // We can emit an event or rely on components polling/checking
  }

  async getPendingCount() {
    return await db.pendingActions.where('status').anyOf('PENDING', 'ERROR', 'SYNCING').count();
  }

  async getPendingActionsByType(type: PendingAction['type']) {
    return await db.pendingActions
      .where('type')
      .equals(type)
      .filter(item => item.status === 'PENDING' || item.status === 'ERROR' || item.status === 'SYNCING')
      .toArray();
  }
}

export const offlineService = new OfflineService();
