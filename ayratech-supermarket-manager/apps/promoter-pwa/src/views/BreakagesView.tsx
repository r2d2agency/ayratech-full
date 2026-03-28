import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, CheckCircle, AlertTriangle, Camera, FileText, Search, Filter, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import api from '../api/client';
import { resolveImageUrl } from '../utils/image';
import { processImage } from '../utils/image-processor';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';

interface BreakageItem {
  id: string;
  product: {
    name: string;
    barcode?: string;
    sku?: string;
    image?: string;
  };
  quantity: number;
  supermarket: {
    id: string;
    fantasyName: string;
    name?: string; // Fallback
  };
  createdAt: string;
  photos: string[];
  description?: string;
  status?: 'PENDING_INVOICE' | 'COMPLETED';
  invoiceNumber?: string;
  invoiceDate?: string;
  invoicePhoto?: string;
}

export const BreakagesView = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<BreakageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'PENDING' | 'COMPLETED'>('PENDING');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  
  // Invoice Form
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoicePhoto, setInvoicePhoto] = useState<{ url: string; blob: Blob } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedItemDetails, setSelectedItemDetails] = useState<BreakageItem | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { settings } = useBranding();

  useEffect(() => {
    fetchItems();
  }, [activeTab]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const status = activeTab === 'PENDING' ? 'PENDING_INVOICE' : 'COMPLETED';
      const response = await api.get('/breakages', {
        params: { status }
      });
      setItems(response.data);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar avarias.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleInvoicePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { blob, previewUrl } = await processImage(file, {
        supermarketName: 'Nota Fiscal',
        promoterName: user?.name || 'Promotor',
        timestamp: new Date(),
        blurThreshold: settings.blurThreshold
      });
      setInvoicePhoto({ url: previewUrl, blob });
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleSubmitInvoice = async () => {
    if (!invoiceNumber) {
      toast.error('Informe o número da nota.');
      return;
    }
    if (!invoicePhoto) {
      toast.error('Adicione uma foto da nota fiscal.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Upload Invoice Photo
      const formData = new FormData();
      formData.append('file', invoicePhoto.blob, 'invoice.jpg');
      const uploadRes = await api.post('/upload', formData); // Changed from /upload/photo to /upload
      const photoUrl = uploadRes.data.url;

      // 2. Update Breakages
      await api.patch('/breakages/invoice', {
        ids: selectedIds,
        invoiceData: {
          invoiceNumber,
          invoiceDate,
          invoicePhoto: photoUrl
        }
      });

      toast.success('Nota fiscal vinculada com sucesso!');
      setShowInvoiceModal(false);
      setSelectedIds([]);
      setInvoicePhoto(null);
      setInvoiceNumber('');
      fetchItems(); // Refresh list
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar nota fiscal.');
    } finally {
      setSubmitting(false);
    }
  };

  // Group items by supermarket
  const groupedItems = items.reduce((acc, item) => {
    const key = item.supermarket?.fantasyName || item.supermarket?.name || 'Outros';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, BreakageItem[]>);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white p-4 shadow-sm flex items-center gap-4 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="text-gray-600">
          <ArrowLeft />
        </button>
        <h1 className="font-bold text-lg">Gestão de Avarias</h1>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b flex px-4">
        <button
          onClick={() => setActiveTab('PENDING')}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'PENDING'
              ? 'border-red-600 text-red-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Pendentes
        </button>
        <button
          onClick={() => setActiveTab('COMPLETED')}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'COMPLETED'
              ? 'border-green-600 text-green-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Concluídas
        </button>
      </div>

      <div className="flex-1 p-4 space-y-6 overflow-y-auto pb-32">
        {loading ? (
          <div className="text-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-2"></div>
            <p className="text-gray-500">Carregando...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <CheckCircle size={48} className="mx-auto mb-2 text-green-500 opacity-50" />
            <p>Nenhuma avaria pendente de nota.</p>
          </div>
        ) : (
          Object.entries(groupedItems).map(([supermarketName, groupItems]) => (
            <div key={supermarketName} className="space-y-2">
              <h2 className="font-bold text-gray-700 text-sm uppercase tracking-wide px-1">
                {supermarketName}
              </h2>
              {groupItems.map(item => {
                const isSelected = selectedIds.includes(item.id);
                const isPending = activeTab === 'PENDING';
                
                return (
                  <div 
                    key={item.id}
                    onClick={() => setSelectedItemDetails(item)}
                    className={`bg-white p-4 rounded-xl border shadow-sm flex items-center gap-3 transition-colors ${
                      'cursor-pointer'
                    } ${
                      isSelected ? 'border-red-500 bg-red-50' : 'border-gray-100'
                    }`}
                  >
                    {isPending && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelection(item.id);
                        }}
                        className={`w-5 h-5 rounded border flex items-center justify-center ${
                        isSelected ? 'bg-red-500 border-red-500 text-white' : 'border-gray-300'
                      }`}>
                        {isSelected && <CheckCircle size={14} />}
                      </button>
                    )}
                    
                    <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                      {item.product.image ? (
                        <img src={resolveImageUrl(item.product.image)} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <AlertTriangle size={20} />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-800 text-sm truncate">{item.product.name}</h3>
                      <p className="text-xs text-gray-500">{item.product.barcode || item.product.sku}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                           isPending ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {item.quantity} un.
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                        {!isPending && item.invoiceNumber && (
                           <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">
                             NF: {item.invoiceNumber}
                           </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {selectedIds.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t shadow-lg z-[60] pb-8 animate-slideUp">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 font-medium">
              {selectedIds.length} itens selecionados
            </span>
            <button 
              onClick={() => setSelectedIds([])}
              className="text-xs text-red-600 font-bold"
            >
              Limpar
            </button>
          </div>
          <button
            onClick={() => setShowInvoiceModal(true)}
            className="w-full bg-red-600 text-white py-3 rounded-xl font-bold text-lg shadow-md hover:bg-red-700 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          >
            <FileText size={20} />
            Registrar Nota Fiscal
          </button>
        </div>
      )}

      {showInvoiceModal && (
        <div className="fixed inset-0 z-[70] bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-4 border-b flex items-center justify-between bg-gray-50">
              <h3 className="font-bold text-lg">Dados da Nota Fiscal</h3>
              <button onClick={() => setShowInvoiceModal(false)} className="text-gray-500">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número da Nota</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full border rounded-lg p-3 outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Ex: 123456"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data de Emissão</label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full border rounded-lg p-3 outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Foto da Nota</label>
                {invoicePhoto ? (
                  <div className="relative aspect-video rounded-lg overflow-hidden border bg-black">
                    <img src={invoicePhoto.url} className="w-full h-full object-contain" />
                    <button
                      onClick={() => setInvoicePhoto(null)}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 shadow-sm"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full aspect-video rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:bg-gray-50 hover:border-red-300 hover:text-red-500 transition-colors"
                  >
                    <Camera size={32} />
                    <span className="text-xs font-bold mt-2">Tirar Foto da Nota</span>
                  </button>
                )}
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  capture="environment"
                  onChange={handleInvoicePhoto}
                />
              </div>
            </div>

            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={handleSubmitInvoice}
                disabled={submitting}
                className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {submitting ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" /> : <CheckCircle size={20} />}
                Confirmar Vinculação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Details Modal */}
      {selectedItemDetails && (
        <div className="fixed inset-0 z-[80] bg-black bg-opacity-90 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
            <div className="p-4 border-b flex items-center justify-between bg-gray-50 shrink-0">
              <h3 className="font-bold text-lg text-gray-800">Detalhes da Avaria</h3>
              <button 
                onClick={() => setSelectedItemDetails(null)} 
                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto space-y-6">
              {/* Product Info */}
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden shrink-0 border border-gray-200">
                  {selectedItemDetails.product.image ? (
                    <img src={resolveImageUrl(selectedItemDetails.product.image)} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <AlertTriangle size={24} />
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">{selectedItemDetails.product.name}</h4>
                  <p className="text-sm text-gray-500 mt-1">EAN: {selectedItemDetails.product.barcode || selectedItemDetails.product.sku}</p>
                  <div className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    Qtd: {selectedItemDetails.quantity} un.
                  </div>
                </div>
              </div>

              {/* Invoice Info */}
              {selectedItemDetails.invoiceNumber && (
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                    <FileText size={18} />
                    Nota Fiscal de Devolução
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-blue-600 block text-xs">Número</span>
                      <span className="font-medium text-blue-900">{selectedItemDetails.invoiceNumber}</span>
                    </div>
                    <div>
                      <span className="text-blue-600 block text-xs">Emissão</span>
                      <span className="font-medium text-blue-900">
                        {selectedItemDetails.invoiceDate ? new Date(selectedItemDetails.invoiceDate).toLocaleDateString() : '-'}
                      </span>
                    </div>
                  </div>
                  
                  {selectedItemDetails.invoicePhoto && (
                    <div className="mt-3">
                      <span className="text-blue-600 block text-xs mb-1">Foto da Nota</span>
                      <div className="rounded-lg overflow-hidden border border-blue-200">
                        <img 
                          src={resolveImageUrl(selectedItemDetails.invoicePhoto)} 
                          className="w-full h-auto object-contain bg-black"
                          alt="Nota Fiscal"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <h4 className="font-bold text-gray-800 mb-2">Descrição / Motivo</h4>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {selectedItemDetails.description || '—'}
                </p>
              </div>

              {/* Breakage Photos */}
              <div>
                <h4 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <Camera size={18} />
                  Fotos da Avaria
                </h4>
                {selectedItemDetails.photos && selectedItemDetails.photos.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {selectedItemDetails.photos.map((photo, idx) => (
                      <div key={idx} className="aspect-square rounded-lg overflow-hidden border bg-gray-100">
                        <img 
                          src={resolveImageUrl(photo)} 
                          className="w-full h-full object-cover"
                          alt={`Avaria ${idx + 1}`} 
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm italic">Nenhuma foto registrada.</p>
                )}
              </div>

              <div className="text-xs text-gray-400 text-center pt-4 border-t">
                Registrado em {new Date(selectedItemDetails.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
