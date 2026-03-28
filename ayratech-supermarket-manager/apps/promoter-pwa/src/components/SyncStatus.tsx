import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, WifiOff, CheckCircle } from 'lucide-react';
import { db } from '../db/db';
import { offlineService } from '../services/offline.service';
import toast from 'react-hot-toast';

const SyncStatus = () => {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showSuccess, setShowSuccess] = useState(false);

  // Function to check pending count
  const checkPending = useCallback(async () => {
    try {
      const count = await db.pendingActions
        .where('status')
        .anyOf('PENDING', 'ERROR')
        .count();
      
      setPendingCount(prev => {
        // If we went from having pending items to 0, and we are not syncing, show success
        if (prev > 0 && count === 0) {
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 5000);
        }
        return count;
      });
    } catch (error) {
      console.error('Error checking pending actions:', error);
    }
  }, []);

  // Function to perform sync
  const performSync = useCallback(async () => {
    // Allow manual sync attempt even if navigator says offline
    // because navigator.onLine can be unreliable
    
    setIsSyncing(true);
    try {
      // Force sync attempt
      await offlineService.syncPendingActions(true);
      await checkPending(); // Update count after sync
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Erro ao sincronizar. Tente novamente.');
    } finally {
      setIsSyncing(false);
    }
  }, [checkPending]);

  // Effect for online/offline status and auto-sync
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      performSync(); // Auto-sync when coming online
    };
    
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('sync-complete', checkPending); // Listen for sync completion

    // Initial check
    checkPending();
    
    // Poll pending count every 5s
    const interval = setInterval(checkPending, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('sync-complete', checkPending);
      clearInterval(interval);
    };
  }, [performSync, checkPending]);

  // Render logic
  // Always render to provide reassurance
  return (
    <div className="fixed top-4 right-4 z-40 animate-in fade-in slide-in-from-top-4 duration-300">
      <button
        onClick={performSync}
        disabled={isSyncing || (pendingCount === 0 && isOnline)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full shadow-lg transition-all border ${
          showSuccess
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : isSyncing 
             ? 'bg-blue-50 border-blue-200 text-blue-700 cursor-wait'
             : !isOnline
               ? 'bg-slate-800 border-slate-700 text-slate-300'
               : pendingCount > 0
                 ? 'bg-amber-50 border-amber-200 text-amber-700'
                 : 'bg-white/90 backdrop-blur border-slate-200 text-slate-600'
        }`}
      >
        {showSuccess ? (
            <>
              <CheckCircle size={14} className="text-emerald-500" />
              <span className="text-xs font-semibold">Salvo no Servidor</span>
            </>
        ) : isSyncing ? (
            <>
              <RefreshCw size={14} className="animate-spin text-blue-500" />
              <span className="text-xs font-semibold">Sincronizando...</span>
            </>
        ) : !isOnline ? (
            <>
              <WifiOff size={14} className="text-slate-400" />
              <span className="text-xs font-semibold">Offline ({pendingCount})</span>
            </>
        ) : pendingCount > 0 ? (
            <>
              <RefreshCw size={14} className="text-amber-500" />
              <span className="text-xs font-semibold">Pendente ({pendingCount})</span>
            </>
        ) : (
            <>
               <div className="relative">
                 <CheckCircle size={14} className="text-emerald-500" />
                 <span className="absolute inset-0 rounded-full animate-ping bg-emerald-400 opacity-20"></span>
               </div>
               <span className="text-xs font-semibold">Sincronizado</span>
            </>
        )}
      </button>
    </div>
  );
};

export default SyncStatus;
