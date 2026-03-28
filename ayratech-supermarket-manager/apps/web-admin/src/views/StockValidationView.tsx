import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client'; // Assuming there is a client.ts or similar
import { Check, X, Package, Store, Calendar, Info } from 'lucide-react';
import toast from 'react-hot-toast';

interface ValidationInfo {
  id: string;
  productName: string;
  brandName: string;
  supermarketName: string;
  stockCount: number;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  timestamp: string;
  observation?: string;
}

const StockValidationView: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<ValidationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [observation, setObservation] = useState('');
  const [action, setAction] = useState<'APPROVE' | 'REJECT' | null>(null);

  useEffect(() => {
    if (token) {
      loadValidationInfo();
    }
  }, [token]);

  const loadValidationInfo = async () => {
    try {
      // Using direct axios call or a public client instance if needed
      // Assuming api.get can handle public routes if they don't require auth header or if it's optional
      // But usually api client attaches token. We might need a clean axios instance or just use fetch.
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/public/routes/validate-stock/${token}`);
      
      if (!response.ok) {
        throw new Error('Falha ao carregar informações');
      }
      
      const data = await response.json();
      setInfo(data);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar dados da validação. Link pode ser inválido ou expirado.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (selectedAction: 'APPROVE' | 'REJECT') => {
    if (!token) return;
    
    setProcessing(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/public/routes/validate-stock/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: selectedAction,
          observation: observation
        }),
      });

      if (!response.ok) {
        throw new Error('Falha ao processar validação');
      }

      toast.success(selectedAction === 'APPROVE' ? 'Estoque aprovado com sucesso!' : 'Estoque reprovado.');
      
      // Refresh info
      loadValidationInfo();
      setAction(null);
      setObservation('');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao processar sua solicitação.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
            <X className="h-6 w-6 text-red-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">Link Inválido</h3>
          <p className="mt-2 text-sm text-gray-500">
            Não foi possível encontrar a solicitação de validação. O link pode ter expirado ou já ter sido processado.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden md:max-w-2xl">
        <div className="md:flex">
          <div className="p-8 w-full">
            <div className="uppercase tracking-wide text-sm text-indigo-500 font-semibold mb-1">
              Validação de Estoque
            </div>
            <h1 className="block mt-1 text-lg leading-tight font-medium text-black">
              {info.productName}
            </h1>
            <p className="mt-2 text-gray-500">
              {info.brandName}
            </p>

            <div className="mt-6 border-t border-gray-100 pt-6 space-y-4">
              <div className="flex items-start">
                <Store className="h-5 w-5 text-gray-400 mr-3 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900">PDV</p>
                  <p className="text-sm text-gray-500">{info.supermarketName}</p>
                </div>
              </div>

              <div className="flex items-start">
                <Package className="h-5 w-5 text-gray-400 mr-3 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Estoque Informado</p>
                  <p className="text-2xl font-bold text-gray-900">{info.stockCount}</p>
                </div>
              </div>

              <div className="flex items-start">
                <Calendar className="h-5 w-5 text-gray-400 mr-3 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Data da Coleta</p>
                  <p className="text-sm text-gray-500">
                    {new Date(info.timestamp).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>

              {info.observation && (
                <div className="flex items-start">
                  <Info className="h-5 w-5 text-gray-400 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Observação do Promotor</p>
                    <p className="text-sm text-gray-500">{info.observation}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-8">
              {info.status === 'PENDING_REVIEW' ? (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="observation" className="block text-sm font-medium text-gray-700">
                      Observação (opcional)
                    </label>
                    <textarea
                      id="observation"
                      rows={3}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                      placeholder="Adicione um comentário..."
                      value={observation}
                      onChange={(e) => setObservation(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-4">
                    <button
                      onClick={() => handleSubmit('APPROVE')}
                      disabled={processing}
                      className="flex-1 flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                    >
                      {processing ? 'Processando...' : (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Aprovar
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleSubmit('REJECT')}
                      disabled={processing}
                      className="flex-1 flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                    >
                      {processing ? 'Processando...' : (
                        <>
                          <X className="h-4 w-4 mr-2" />
                          Reprovar
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className={`rounded-md p-4 ${info.status === 'APPROVED' ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className="flex">
                    <div className="flex-shrink-0">
                      {info.status === 'APPROVED' ? (
                        <Check className="h-5 w-5 text-green-400" />
                      ) : (
                        <X className="h-5 w-5 text-red-400" />
                      )}
                    </div>
                    <div className="ml-3">
                      <h3 className={`text-sm font-medium ${info.status === 'APPROVED' ? 'text-green-800' : 'text-red-800'}`}>
                        {info.status === 'APPROVED' ? 'Aprovado' : 'Reprovado'}
                      </h3>
                      <p className={`mt-2 text-sm ${info.status === 'APPROVED' ? 'text-green-700' : 'text-red-700'}`}>
                        Esta solicitação já foi {info.status === 'APPROVED' ? 'aprovada' : 'reprovada'}.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockValidationView;
