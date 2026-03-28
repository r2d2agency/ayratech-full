import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'react-hot-toast';
import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

export function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered');
      if (r) {
        // Check for updates every minute
        setInterval(() => {
          r.update();
        }, 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  useEffect(() => {
    if (needRefresh) {
      toast(
        (t) => (
          <div className="flex flex-col gap-3 min-w-[200px]">
            <div className="flex items-center gap-2 font-semibold text-gray-800">
              <RefreshCw className="animate-spin text-blue-600" size={18} />
              Nova versão disponível
            </div>
            <div className="text-sm text-gray-600">
              Uma nova versão do app está pronta. Atualize para ver as mudanças.
            </div>
            <div className="flex gap-2 mt-1">
              <button
                className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                onClick={() => updateServiceWorker(true)}
              >
                Atualizar Agora
              </button>
              <button
                className="px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                onClick={() => {
                    close();
                    toast.dismiss(t.id);
                }}
              >
                Depois
              </button>
            </div>
          </div>
        ),
        {
          duration: Infinity, // Keep open until action
          position: 'bottom-center',
          id: 'pwa-update-toast',
          style: {
            background: 'white',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            padding: '16px',
            borderRadius: '12px',
          },
        }
      );
    }
  }, [needRefresh, updateServiceWorker]);

  return null;
}
