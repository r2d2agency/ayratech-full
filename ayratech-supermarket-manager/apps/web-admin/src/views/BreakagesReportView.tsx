import React, { useState, useEffect } from 'react';
import { Search, Filter, AlertTriangle, FileText, Calendar, CheckCircle, Clock, X } from 'lucide-react';
import api from '../api/client';
import { toast } from 'react-hot-toast';
import { resolveImageUrl } from '../utils/image';

interface BreakageReport {
  id: string;
  product: {
    name: string;
    ean?: string;
    barcode?: string;
    sku?: string;
  };
  quantity: number;
  description?: string;
  supermarket: {
    fantasyName: string;
    name?: string;
  };
  promoter: {
    fullName: string;
    name?: string;
  };
  createdAt: string;
  photos: string[];
  status: 'PENDING_INVOICE' | 'COMPLETED';
  invoiceNumber?: string;
  invoiceDate?: string;
  invoicePhoto?: string;
}

const BreakagesReportView = () => {
  const [reports, setReports] = useState<BreakageReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    startDate: '',
    endDate: '',
    promoterId: ''
  });
  const [selectedReport, setSelectedReport] = useState<BreakageReport | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; date: string; pdv: string } | null>(null);

  useEffect(() => {
    fetchReports();
  }, [filters]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filters.status) params.status = filters.status;
      // Backend needs implementation for date range filtering if not already present
      // For now, we'll fetch all and filter client-side if needed or rely on backend implementation
      
      const response = await api.get('/breakages', { params });
      setReports(response.data);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar relatório de avarias.');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <AlertTriangle className="text-red-600" />
            Relatório de Avarias
          </h1>
          <p className="text-gray-500">Gestão de produtos avariados e notas de devolução</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 min-w-[150px]"
          >
            <option value="">Todos</option>
            <option value="PENDING_INVOICE">Pendente Nota</option>
            <option value="COMPLETED">Concluído</option>
          </select>
        </div>
        
        {/* Date filters would go here */}

        <button 
          onClick={() => fetchReports()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors ml-auto"
        >
          Filtrar
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-600 font-medium text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Data</th>
                <th className="px-6 py-4">Produto</th>
                <th className="px-6 py-4">Quantidade</th>
                <th className="px-6 py-4">Supermercado</th>
                <th className="px-6 py-4">Promotor</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                    Carregando...
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                    Nenhuma avaria encontrada.
                  </td>
                </tr>
              ) : (
                reports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(report.createdAt).toLocaleDateString()}
                      <div className="text-xs text-gray-400">
                        {new Date(report.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{report.product.name}</div>
                      <div className="text-xs text-gray-500">{report.product.ean}</div>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-red-600">
                      {report.quantity} un.
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {report.supermarket.fantasyName || report.supermarket.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {report.promoter.fullName || report.promoter.name}
                    </td>
                    <td className="px-6 py-4">
                      {report.status === 'COMPLETED' ? (
                        <div>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle size={12} className="mr-1" />
                            Concluído
                          </span>
                          {report.invoiceNumber && (
                            <div className="text-xs text-gray-500 mt-1">NF: {report.invoiceNumber}</div>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          <Clock size={12} className="mr-1" />
                          Pendente Nota
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedReport(report)}
                        className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                      >
                        Detalhes
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-[9999] bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-xl overflow-hidden flex flex-col animate-in zoom-in duration-200 relative">
            <div className="p-6 border-b flex items-center justify-between bg-gray-50">
              <h3 className="font-bold text-xl text-gray-800">Detalhes da Avaria</h3>
              <button onClick={() => setSelectedReport(null)} className="text-gray-500 hover:text-gray-700">
                ×
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Info */}
              <div className="space-y-6">
                <div>
                  <h4 className="font-bold text-gray-700 mb-2 border-b pb-1">Produto</h4>
                  <p className="text-lg text-gray-900">{selectedReport.product.name}</p>
                  <p className="text-sm text-gray-500">EAN: {selectedReport.product.ean}</p>
                  <p className="text-sm text-gray-500">Qtd Avariada: <span className="font-bold text-red-600">{selectedReport.quantity}</span></p>
                </div>

                <div>
                  <h4 className="font-bold text-gray-700 mb-2 border-b pb-1">Descrição / Motivo</h4>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {selectedReport.description || '—'}
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-gray-700 mb-2 border-b pb-1">Local e Responsável</h4>
                  <p className="text-sm text-gray-600"><span className="font-medium">Supermercado:</span> {selectedReport.supermarket.fantasyName || selectedReport.supermarket.name}</p>
                  <p className="text-sm text-gray-600"><span className="font-medium">Promotor:</span> {selectedReport.promoter.fullName || selectedReport.promoter.name}</p>
                  <p className="text-sm text-gray-600"><span className="font-medium">Data:</span> {new Date(selectedReport.createdAt).toLocaleString()}</p>
                </div>

                {selectedReport.status === 'COMPLETED' && (
                  <div>
                    <h4 className="font-bold text-gray-700 mb-2 border-b pb-1">Nota Fiscal de Devolução</h4>
                    <p className="text-sm text-gray-600"><span className="font-medium">Número:</span> {selectedReport.invoiceNumber}</p>
                    <p className="text-sm text-gray-600"><span className="font-medium">Emissão:</span> {selectedReport.invoiceDate ? new Date(selectedReport.invoiceDate).toLocaleDateString() : '-'}</p>
                  </div>
                )}
              </div>

              {/* Photos */}
              <div className="space-y-6">
                <div>
                  <h4 className="font-bold text-gray-700 mb-3 border-b pb-1">
                    Fotos da Avaria
                  </h4>
                  {selectedReport.photos && selectedReport.photos.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4">
                      {selectedReport.photos.map((photo, idx) => (
                        <div 
                          key={idx} 
                          className="relative group rounded-lg overflow-hidden border bg-gray-100 cursor-pointer hover:shadow-lg transition-all"
                          onClick={() => setSelectedPhoto({
                            url: resolveImageUrl(photo),
                            date: new Date(selectedReport.createdAt).toLocaleString(),
                            pdv: selectedReport.supermarket.fantasyName || selectedReport.supermarket.name || ''
                          })}
                        >
                          <div className="aspect-square">
                            <img src={resolveImageUrl(photo)} alt={`Avaria ${idx + 1}`} className="w-full h-full object-cover" />
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white text-[10px] p-2">
                            <div className="font-medium truncate">{selectedReport.supermarket.fantasyName || selectedReport.supermarket.name}</div>
                            <div className="text-gray-300 truncate">{new Date(selectedReport.createdAt).toLocaleString()}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 italic text-sm">Nenhuma foto registrada.</p>
                  )}
                </div>

                {selectedReport.invoicePhoto && (
                  <div>
                    <h4 className="font-bold text-gray-700 mb-3 border-b pb-1 flex items-center gap-2">
                      <FileText size={18} />
                      Foto da Nota Fiscal
                    </h4>
                    <div 
                      className="cursor-pointer rounded-lg overflow-hidden border bg-gray-100 hover:opacity-90 transition-opacity aspect-video relative"
                      onClick={() => setSelectedPhoto({
                        url: resolveImageUrl(selectedReport.invoicePhoto!),
                        date: selectedReport.invoiceDate ? new Date(selectedReport.invoiceDate).toLocaleDateString() : '-',
                        pdv: selectedReport.supermarket.fantasyName || selectedReport.supermarket.name || ''
                      })}
                    >
                      <img src={resolveImageUrl(selectedReport.invoicePhoto)} alt="Nota Fiscal" className="w-full h-full object-contain" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photo Lightbox */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 z-[10000] bg-black bg-opacity-95 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] w-full flex flex-col items-center" onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setSelectedPhoto(null)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
            >
              <X size={32} />
            </button>
            
            <div className="bg-white rounded-lg overflow-hidden shadow-2xl max-h-[80vh] flex flex-col">
              <div className="relative flex-1 overflow-hidden bg-black flex items-center justify-center">
                <img 
                  src={selectedPhoto.url} 
                  alt="Detalhe" 
                  className="max-w-full max-h-[75vh] object-contain"
                />
              </div>
              <div className="bg-gray-900 text-white p-4 flex justify-between items-center text-sm border-t border-gray-800">
                <div>
                  <p className="font-medium text-gray-300 text-xs uppercase tracking-wider mb-1">Local</p>
                  <p className="font-bold text-lg">{selectedPhoto.pdv}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-300 text-xs uppercase tracking-wider mb-1">Data e Hora</p>
                  <p className="font-bold text-lg">{selectedPhoto.date}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BreakagesReportView;
