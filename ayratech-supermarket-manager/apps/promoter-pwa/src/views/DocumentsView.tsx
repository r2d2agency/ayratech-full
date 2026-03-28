import React, { useEffect, useState } from 'react';
import client, { API_URL } from '../api/client';
import { offlineService } from '../services/offline.service';
import { FileText, Download, Upload, X, Check, Eye, PenLine } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast, Toaster } from 'react-hot-toast';
import { format } from 'date-fns';

const DocumentsView = () => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [showSignModal, setShowSignModal] = useState(false);
  const [docToSign, setDocToSign] = useState<any | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (user) {
      fetchDocuments();
    }
  }, [user]);

  const fetchDocuments = async () => {
    try {
      const response = await client.get(`/employees/me/documents`);
      setDocuments(response.data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      // Only show error toast if not 404 (handled by empty state)
      if ((error as any).response?.status !== 404) {
          toast.error('Erro ao carregar documentos');
      }
    } finally {
      setLoading(false);
    }
  };

  const getDownloadUrl = (url: string) => {
    if (!url) return '#';
    if (url.startsWith('http')) return url;
    // Remove leading slash if present to avoid double slash issues
    const cleanUrl = url.startsWith('/') ? url.substring(1) : url;
    // Construct full URL using API base URL
    return `${API_URL}/${cleanUrl}`;
  };

  const getDeviceInfo = () => {
    const nav = navigator as any;
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      vendor: navigator.vendor,
      appVersion: navigator.appVersion,
      // Optional fields if available in some browsers/environments:
      hardwareConcurrency: nav?.hardwareConcurrency,
      deviceMemory: nav?.deviceMemory,
    };
  };

  const requestGeolocation = (): Promise<{ latitude?: number; longitude?: number; accuracy?: number } | null> => {
    return new Promise(resolve => {
      if (!('geolocation' in navigator)) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        pos => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    });
  };

  const getCanvasDataUrl = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.toDataURL('image/png');
  };

  const handleSign = async (doc: any, signatureImage?: string | null) => {
    try {
      const location = await requestGeolocation();
      const device = getDeviceInfo();
      const timestamp = new Date().toISOString();
      const signer = {
        fullName: user?.employee?.fullName || user?.name || '',
        cpf: (user as any)?.employee?.cpf || (user as any)?.cpf || undefined,
      };

      const res = await client.patch(`/employees/me/documents/${doc.id}/sign`, {
        timestamp,
        device,
        location,
        signer,
        signatureImage,
      });

      const signed = res?.data;
      setDocuments(prev =>
        prev.map(d =>
          d.id === doc.id
            ? {
                ...d,
                signedAt: signed?.signedAt || timestamp,
                signedFileUrl: signed?.signedFileUrl || d.signedFileUrl,
                readAt: d.readAt || signed?.readAt || timestamp,
              }
            : d,
        ),
      );
      toast.success('Documento assinado com sucesso');
      setShowSignModal(false);
      setDocToSign(null);
    } catch (e) {
      console.error('Sign error:', e);
      toast.error('Não foi possível assinar o documento');
    }
  };

  const handleMarkAsRead = async (docId: string, url: string) => {
    try {
        // Mark as read in backend (fire and forget mostly, or update state)
        await client.patch(`/employees/documents/${docId}/read`);
        
        // Update local state to reflect change immediately
        setDocuments(prev => prev.map(d => 
            d.id === docId ? { ...d, readAt: new Date().toISOString() } : d
        ));

        // Open file
        window.open(getDownloadUrl(url), '_blank');
    } catch (error) {
        console.error('Error marking document as read:', error);
        // Still open the file even if marking as read fails
        window.open(getDownloadUrl(url), '_blank');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setIsModalOpen(true);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) return;

    setUploading(true);
    try {
      // Offline Handling
      if (!navigator.onLine) {
         const base64 = await fileToBase64(selectedFile);
         await offlineService.addPendingAction(
            'DOCUMENT_UPLOAD',
            `/employees/me/documents`,
            'POST',
            {
                fileBase64: base64,
                filename: selectedFile.name,
                type: 'Outros',
                description: description
            }
         );
         
         toast.success('Documento salvo offline! Será enviado quando houver conexão.');
         setIsModalOpen(false);
         setSelectedFile(null);
         setDescription('');
         setUploading(false);
         return;
      }

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('type', 'Outros'); // Default type
      formData.append('description', description); // Add description

      await client.post(`/employees/me/documents`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Documento enviado com sucesso!');
      fetchDocuments();
      setIsModalOpen(false);
      setSelectedFile(null);
      setDescription('');
      
    } catch (error: any) {
      console.error('Upload error:', error);
      
      // Fallback for network errors when navigator.onLine was true but request failed
      const isNetworkError = !error.response || error.code === 'ERR_NETWORK';
      const isServer5xx = error.response && error.response.status >= 500;

      if (isNetworkError || isServer5xx) {
          try {
             const base64 = await fileToBase64(selectedFile);
             await offlineService.addPendingAction(
                'DOCUMENT_UPLOAD',
                `/employees/me/documents`,
                'POST',
                {
                    fileBase64: base64,
                    filename: selectedFile.name,
                    type: 'Outros',
                    description: description
                }
             );
             toast.success('Erro de conexão. Documento salvo para envio posterior!');
             setIsModalOpen(false);
             setSelectedFile(null);
             setDescription('');
             return;
          } catch (offlineError) {
              console.error('Failed to save offline fallback', offlineError);
          }
      }

      toast.error('Erro ao enviar documento');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-4 pb-20 space-y-4">
      <Toaster position="top-center" />
      <h1 className="text-2xl font-bold text-gray-800">Meus Arquivos</h1>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center gap-4">
        <div className="bg-blue-100 p-3 rounded-full">
          <Upload className="text-blue-600" size={24} />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-blue-900">Enviar Arquivo</h3>
          <p className="text-xs text-blue-700">Envie comprovantes ou relatórios</p>
        </div>
        <label className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-blue-700 transition-colors">
          Upload
          <input type="file" className="hidden" onChange={handleFileSelect} />
        </label>
      </div>

      {/* Upload Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">Enviar Documento</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-500">
                <X size={24} />
              </button>
            </div>
            
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Arquivo Selecionado:</p>
              <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-100 p-2 rounded">
                <FileText size={16} />
                <span className="truncate">{selectedFile?.name}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrição / Observação</label>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Comprovante de vacinação..."
                className="w-full border rounded-lg p-2 text-sm h-24"
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
               <button 
                 onClick={() => setIsModalOpen(false)}
                 className="px-4 py-2 text-gray-600 font-medium"
               >
                 Cancelar
               </button>
               <button 
                 onClick={handleUpload}
                 disabled={uploading}
                 className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
               >
                 {uploading ? 'Enviando...' : 'Enviar'}
               </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="font-semibold text-gray-700 ml-1">Arquivos Recebidos</h3>
        
        {loading ? (
           <div className="text-center py-8">Carregando...</div>
        ) : documents.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-xl border border-gray-100 shadow-sm">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Nenhum arquivo encontrado.</p>
          </div>
        ) : (
          documents.map((doc) => (
            <div key={doc.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
               <div className="flex items-center gap-3 overflow-hidden">
                 <div className={`p-2 rounded-lg shrink-0 ${doc.readAt ? 'bg-green-100' : 'bg-blue-100'}`}>
                   {doc.readAt ? (
                     <Check size={20} className="text-green-600" />
                   ) : (
                     <FileText size={20} className="text-blue-600" />
                   )}
                 </div>
                 <div className="min-w-0">
                   <p className="font-medium text-gray-800 truncate">{doc.type}</p>
                   <p className="text-xs text-gray-500 truncate">{doc.description || doc.filename}</p>
                   <div className="flex items-center gap-2 mt-0.5">
                     <p className="text-[10px] text-gray-400">
                       {format(new Date(doc.sentAt), 'dd/MM/yyyy HH:mm')}
                     </p>
                     {doc.readAt && (
                       <span className="text-[10px] text-green-600 font-medium bg-green-50 px-1.5 py-0.5 rounded">
                         Lido
                       </span>
                     )}
                     {doc.requiresSignature && !doc.signedAt && (
                        <span className="text-[10px] text-amber-700 font-medium bg-amber-100 px-1.5 py-0.5 rounded">
                          Assinatura pendente
                        </span>
                      )}
                      {doc.signedAt && (
                        <span className="text-[10px] text-emerald-700 font-medium bg-emerald-100 px-1.5 py-0.5 rounded">
                          Assinado
                        </span>
                      )}
                   </div>
                 </div>
               </div>
               <div className="flex items-center gap-2">
                 {doc.requiresSignature && !doc.signedAt && (
                   <button
                     onClick={() => { setDocToSign(doc); setShowSignModal(true); }}
                     className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                     title="Assinar documento"
                   >
                     <PenLine size={20} />
                   </button>
                 )}
                 {doc.signedFileUrl && (
                   <button
                     onClick={() => window.open(getDownloadUrl(doc.signedFileUrl), '_blank')}
                     className="p-2 text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                     title="Baixar PDF assinado"
                   >
                     <FileText size={20} />
                   </button>
                 )}
                 <button 
                   onClick={() => handleMarkAsRead(doc.id, doc.fileUrl)}
                   className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                   title={doc.readAt ? "Baixar novamente" : "Ler documento"}
                 >
                   {doc.readAt ? <Download size={20} /> : <Eye size={20} />}
                 </button>
               </div>
            </div>
          ))
        )}
      </div>
      {showSignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">Assinar Documento</h3>
              <button onClick={() => { setShowSignModal(false); setDocToSign(null); }} className="text-gray-500">
                <X size={24} />
              </button>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">Assine no quadro abaixo com o dedo ou caneta.</p>
              <div 
                className="border rounded-lg bg-gray-50"
                style={{ touchAction: 'none' }}
              >
                <canvas
                  ref={canvasRef}
                  width={500}
                  height={200}
                  className="w-full h-[200px]"
                  onMouseDown={(e) => {
                    setIsDrawing(true);
                    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
                    setLastPoint({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                  }}
                  onMouseMove={(e) => {
                    if (!isDrawing || !canvasRef.current || !lastPoint) return;
                    const ctx = canvasRef.current.getContext('2d');
                    if (!ctx) return;
                    const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    ctx.strokeStyle = '#111827';
                    ctx.lineWidth = 2;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(lastPoint.x, lastPoint.y);
                    ctx.lineTo(x, y);
                    ctx.stroke();
                    setLastPoint({ x, y });
                  }}
                  onMouseUp={() => { setIsDrawing(false); setLastPoint(null); }}
                  onMouseLeave={() => { setIsDrawing(false); setLastPoint(null); }}
                  onTouchStart={(e) => {
                    setIsDrawing(true);
                    const canvas = canvasRef.current!;
                    const rect = canvas.getBoundingClientRect();
                    const t = e.touches[0];
                    setLastPoint({ x: t.clientX - rect.left, y: t.clientY - rect.top });
                  }}
                  onTouchMove={(e) => {
                    if (!isDrawing || !canvasRef.current || !lastPoint) return;
                    const canvas = canvasRef.current!;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return;
                    const rect = canvas.getBoundingClientRect();
                    const t = e.touches[0];
                    const x = t.clientX - rect.left;
                    const y = t.clientY - rect.top;
                    ctx.strokeStyle = '#111827';
                    ctx.lineWidth = 2;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(lastPoint.x, lastPoint.y);
                    ctx.lineTo(x, y);
                    ctx.stroke();
                    setLastPoint({ x, y });
                  }}
                  onTouchEnd={() => { setIsDrawing(false); setLastPoint(null); }}
                />
              </div>
              <div className="flex justify-between mt-2">
                <button
                  onClick={() => {
                    if (canvasRef.current) {
                      const ctx = canvasRef.current.getContext('2d');
                      if (ctx) {
                        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                      }
                    }
                  }}
                  className="px-3 py-2 border rounded-lg text-sm"
                >
                  Limpar
                </button>
                <button
                  onClick={() => {
                    const dataUrl = getCanvasDataUrl();
                    if (!dataUrl) return;
                    if (docToSign) handleSign(docToSign, dataUrl);
                  }}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
                >
                  Confirmar Assinatura
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentsView;
