import React, { useEffect, useState, useRef } from 'react';
import { Camera, Save, X, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../api/client';
import { processImage } from '../utils/image-processor';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import { db } from '../db/db';

interface BreakageReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: any;
  routeItemId?: string;
  supermarketId?: string;
}

export const BreakageReportModal: React.FC<BreakageReportModalProps> = ({
  isOpen,
  onClose,
  product,
  routeItemId,
  supermarketId,
}) => {
  const [quantity, setQuantity] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [reasons, setReasons] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedReasonId, setSelectedReasonId] = useState<string>('');
  const [photos, setPhotos] = useState<{ url: string; blob: Blob }[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { settings } = useBranding();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await api.get('/incident-reasons', { params: { type: 'BREAKAGE' } });
        const list = Array.isArray(res.data) ? res.data : [];
        const normalized = list
          .filter((r: any) => r && r.id && r.label)
          .map((r: any) => ({ id: String(r.id), label: String(r.label) }));

        if (cancelled) return;
        setReasons(normalized);
      } catch {
        if (cancelled) return;
        setReasons([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!isOpen) return null;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { blob, previewUrl } = await processImage(file, {
        supermarketName: product.supermarketName || 'Supermercado',
        promoterName: user?.name || 'Promotor',
        timestamp: new Date(),
        blurThreshold: settings.blurThreshold
      });

      setPhotos(prev => [...prev, { url: previewUrl, blob }]);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao processar imagem');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!quantity || quantity <= 0) {
      toast.error('Informe a quantidade de itens com avaria.');
      return;
    }
    if (!description.trim()) {
      toast.error('Informe a descrição da avaria.');
      return;
    }

    const composedDescription = (() => {
      const details = description.trim();
      if (!selectedReasonId) return details;
      if (selectedReasonId === '__OTHER__') return details;

      const selected = reasons.find(r => r.id === selectedReasonId);
      if (!selected?.label) return details;
      return `${selected.label} - ${details}`;
    })();

    setLoading(true);

    // Offline check
    if (!navigator.onLine) {
        try {
            const offlinePhotos = await Promise.all(photos.map(async (p, idx) => {
                const reader = new FileReader();
                const base64 = await new Promise<string>((resolve) => {
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(p.blob);
                });
                return { base64, filename: `breakage_${Date.now()}_${idx}.jpg` };
            }));

            await db.pendingActions.add({
                type: 'BREAKAGE_REPORT',
                url: '/breakages',
                method: 'POST',
                payload: {
                    productId: product.productId || product.id,
                    routeItemId,
                    supermarketId,
                    quantity: Number(quantity),
                    photos: offlinePhotos,
                    description: composedDescription,
                },
                createdAt: new Date(),
                status: 'PENDING',
                retryCount: 0
            });

            toast.success('Avaria salva offline. Será sincronizada quando houver conexão.', { icon: '💾' });
            onClose();
            setLoading(false);
            return;
        } catch (error) {
            console.error(error);
            toast.error('Erro ao salvar offline.');
            setLoading(false);
            return;
        }
    }

    try {
      // 1. Upload photos
      const photoUrls: string[] = [];
      if (photos.length > 0) {
        for (const photo of photos) {
          const formData = new FormData();
          formData.append('file', photo.blob, 'breakage.jpg');
          const uploadRes = await api.post('/upload', formData);
          photoUrls.push(uploadRes.data.path || uploadRes.data.url);
        }
      }

      // 2. Create Breakage Report
      await api.post('/breakages', {
        productId: product.productId || product.id,
        routeItemId,
        supermarketId,
        quantity: Number(quantity),
        photos: photoUrls,
        description: composedDescription,
      });

      toast.success('Avaria registrada com sucesso!');
      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error('Erro ao salvar avaria. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b flex items-center justify-between bg-red-50">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle size={20} />
            <h2 className="font-bold">Reportar Avaria</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-4">
          <div>
            <h3 className="font-medium text-gray-900">{product.product?.name || product.name}</h3>
            <p className="text-xs text-gray-500">{product.product?.ean || product.ean}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantidade Avariada
            </label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full border rounded-lg p-3 text-lg font-bold text-center focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo
            </label>
            <select
              value={selectedReasonId}
              onChange={(e) => setSelectedReasonId(e.target.value)}
              className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none bg-white disabled:bg-gray-100 disabled:border-gray-200 disabled:text-gray-500"
              disabled={loading}
            >
              <option value="">Selecionar motivo (opcional)...</option>
              {reasons.map(r => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
              <option value="__OTHER__">Outro (descrever)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descrição
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none min-h-[90px]"
              placeholder="Ex.: embalagem amassada, produto quebrado, vencido, etc."
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fotos da Avaria
            </label>
            
            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo, idx) => (
                <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border">
                  <img src={photo.url} alt={`Avaria ${idx}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removePhoto(idx)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow-sm"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}

              <button
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:bg-gray-50 hover:border-red-300 hover:text-red-500 transition-colors"
              >
                <Camera size={24} />
                <span className="text-[10px] mt-1">Adicionar</span>
              </button>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoUpload}
            />
          </div>
        </div>

        <div className="p-4 border-t bg-gray-50">
          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
            ) : (
              <>
                <Save size={20} />
                Registrar Avaria
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
