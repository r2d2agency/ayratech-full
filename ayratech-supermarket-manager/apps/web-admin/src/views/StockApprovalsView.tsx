import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { Check, X, CheckSquare } from 'lucide-react';
import toast from 'react-hot-toast';

interface PendingApproval {
  id: string;
  stockCount: number;
  stockCountStatus: string;
  checkInTime: string;
  product: {
    id: string;
    name: string;
    brand: {
      name: string;
    };
  };
  routeItem: {
    supermarket: {
      fantasyName: string;
    };
    route: {
      date: string;
    };
  };
}

const StockApprovalsView: React.FC = () => {
  const [items, setItems] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchApprovals();
  }, []);

  const fetchApprovals = async () => {
    try {
      setLoading(true);
      const response = await api.get('/routes/approvals/pending');
      setItems(response.data);
    } catch (error) {
      console.error('Error fetching approvals:', error);
      toast.error('Erro ao carregar aprovações pendentes.');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id: string, action: 'APPROVE' | 'REJECT') => {
    if (!confirm(`Tem certeza que deseja ${action === 'APPROVE' ? 'APROVAR' : 'REJEITAR'} este estoque?`)) return;

    try {
      setProcessing(id);
      await api.post(`/routes/approvals/${id}`, { action });
      toast.success(action === 'APPROVE' ? 'Aprovado!' : 'Rejeitado!');
      setItems(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error('Error processing approval:', error);
      toast.error('Erro ao processar.');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--color-text)]">Aprovações de Estoque</h1>
          <p className="text-[color:var(--color-muted)]">Valide as contagens de estoque pendentes</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {items.length === 0 ? (
          <div className="p-12 text-center text-[color:var(--color-muted)]">
            <CheckSquare className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p>Nenhuma aprovação pendente no momento.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-semibold text-[color:var(--color-text)]">Data/Hora</th>
                  <th className="px-6 py-4 font-semibold text-[color:var(--color-text)]">Produto</th>
                  <th className="px-6 py-4 font-semibold text-[color:var(--color-text)]">Marca</th>
                  <th className="px-6 py-4 font-semibold text-[color:var(--color-text)]">PDV</th>
                  <th className="px-6 py-4 font-semibold text-[color:var(--color-text)] text-center">Contagem</th>
                  <th className="px-6 py-4 font-semibold text-[color:var(--color-text)] text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-[color:var(--color-text)]">
                        {new Date(item.checkInTime).toLocaleDateString('pt-BR')}
                      </div>
                      <div className="text-xs text-[color:var(--color-muted)]">
                        {new Date(item.checkInTime).toLocaleTimeString('pt-BR')}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-[color:var(--color-text)]">
                      {item.product.name}
                    </td>
                    <td className="px-6 py-4 text-[color:var(--color-muted)]">
                      {item.product.brand.name}
                    </td>
                    <td className="px-6 py-4 text-[color:var(--color-muted)]">
                      {item.routeItem.supermarket.fantasyName}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
                        {item.stockCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleAction(item.id, 'APPROVE')}
                          disabled={processing === item.id}
                          className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50"
                          title="Aprovar"
                        >
                          <Check size={18} />
                        </button>
                        <button
                          onClick={() => handleAction(item.id, 'REJECT')}
                          disabled={processing === item.id}
                          className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50"
                          title="Rejeitar"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default StockApprovalsView;
