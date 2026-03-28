import React, { useState, useEffect } from 'react';
import { X, Save, AlertTriangle, Package, Layers, Info } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { BreakageReportModal } from './BreakageReportModal';
import api from '../api/client';

interface ProductCountModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: any;
  onSave: (productId: string, data: any) => Promise<void>;
  mode: 'GONDOLA' | 'INVENTORY' | 'BOTH'; // Context of where we are opening it from
  readOnly?: boolean;
  requireStockCount?: boolean;
  routeItemId?: string;
  supermarketId?: string;
}

export const ProductCountModal: React.FC<ProductCountModalProps> = ({
  isOpen,
  onClose,
  product,
  onSave,
  mode,
  readOnly = false,
  requireStockCount = true,
  routeItemId,
  supermarketId
}) => {
  const [gondolaCount, setGondolaCount] = useState<number | ''>('');
  const [inventoryCount, setInventoryCount] = useState<number | ''>('');
  const [ruptureReason, setRuptureReason] = useState('');
  const [isStockout, setIsStockout] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ruptureReasons, setRuptureReasons] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedRuptureReasonId, setSelectedRuptureReasonId] = useState<string>('');
  const [ruptureDetails, setRuptureDetails] = useState<string>('');

  const [validityStoreDate, setValidityStoreDate] = useState('');
  const [validityStoreQuantity, setValidityStoreQuantity] = useState<number | ''>('');
  const [validityStockDate, setValidityStockDate] = useState('');
  const [validityStockQuantity, setValidityStockQuantity] = useState<number | ''>('');
  const [isBreakageModalOpen, setIsBreakageModalOpen] = useState(false);

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

  const [checklistState, setChecklistState] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    if (product) {
      setGondolaCount(product.gondolaCount ?? '');
      setInventoryCount(product.inventoryCount ?? '');
      setRuptureReason(product.ruptureReason || '');
      setIsStockout(product.isStockout || false);
      setSelectedRuptureReasonId('');
      setRuptureDetails(product.ruptureReason || '');
      setValidityStoreDate(product.validityStoreDate || '');
      setValidityStoreQuantity(
        product.validityStoreQuantity !== null && product.validityStoreQuantity !== undefined
          ? product.validityStoreQuantity
          : ''
      );
      setValidityStockDate(product.validityStockDate || '');
      setValidityStockQuantity(
        product.validityStockQuantity !== null && product.validityStockQuantity !== undefined
          ? product.validityStockQuantity
          : ''
      );
      
      // Initialize checklist state
      if (Array.isArray(product.checklists)) {
        const initialChecklistState: { [key: string]: boolean } = {};
        product.checklists.forEach((c: any) => {
          initialChecklistState[c.id] = c.isChecked || false;
        });
        setChecklistState(initialChecklistState);
      }
    }
  }, [product]);

  useEffect(() => {
    if (!isOpen) return;
    if (readOnly) return;
    if (!requireStockCount) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await api.get('/incident-reasons', {
          params: { type: 'RUPTURE' }
        });
        const list = Array.isArray(res.data) ? res.data : [];
        const normalized = list
          .filter((r: any) => r && r.id && r.label)
          .map((r: any) => ({ id: String(r.id), label: String(r.label) }));

        if (cancelled) return;
        setRuptureReasons(normalized);

        const existing = (product?.ruptureReason || '').trim();
        if (!existing || selectedRuptureReasonId) return;

        const match = normalized.find(r => existing === r.label || existing.startsWith(`${r.label} - `));
        if (match) {
          setSelectedRuptureReasonId(match.id);
          if (existing !== match.label) {
            setRuptureDetails(existing.slice(`${match.label} - `.length));
          }
        } else {
          setSelectedRuptureReasonId('__OTHER__');
          setRuptureDetails(existing);
        }
      } catch {
        if (cancelled) return;
        setRuptureReasons([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, readOnly, requireStockCount, product, selectedRuptureReasonId]);

  // Calculate total
  const g = typeof gondolaCount === 'number' ? gondolaCount : 0;
  const i = typeof inventoryCount === 'number' ? inventoryCount : 0;
  const total = g + i;

  const handleChecklistToggle = (id: string) => {
    setChecklistState(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const hasValidityChecklist =
        Array.isArray(product.checklists) &&
        product.checklists.some((c: any) => isValidityChecklistItem(c));

      if (hasValidityChecklist) {
        const storeFilled = !!validityStoreDate || validityStoreQuantity !== '';
        const stockFilled = !!validityStockDate || validityStockQuantity !== '';
        if (!storeFilled && !stockFilled) {
          toast.error('Informe ao menos uma validade (Loja ou Estoque).');
          setSaving(false);
          return;
        }
        if (storeFilled) {
          if (!validityStoreDate) {
            toast.error('Informe a data de validade (Loja).');
            setSaving(false);
            return;
          }
          if (!validityStoreQuantity || validityStoreQuantity <= 0) {
            toast.error('Informe a quantidade (Loja).');
            setSaving(false);
            return;
          }
        }
        if (stockFilled) {
          if (!validityStockDate) {
            toast.error('Informe a data de validade (Estoque).');
            setSaving(false);
            return;
          }
          if (!validityStockQuantity || validityStockQuantity <= 0) {
            toast.error('Informe a quantidade (Estoque).');
            setSaving(false);
            return;
          }
        }
      }

      const composedRuptureReason = (() => {
        if (!requireStockCount) return null;
        const storeEntered = typeof gondolaCount === 'number';
        const inventoryEntered = typeof inventoryCount === 'number';
        if (!storeEntered || !inventoryEntered) return null;
        if (total !== 0) return null;

        if (!selectedRuptureReasonId) {
          const freeText = ruptureDetails.trim() || ruptureReason.trim();
          return freeText.length > 0 ? freeText : null;
        }

        if (selectedRuptureReasonId === '__OTHER__') {
          const freeText = ruptureDetails.trim() || ruptureReason.trim();
          return freeText.length > 0 ? freeText : null;
        }

        const selected = ruptureReasons.find(r => r.id === selectedRuptureReasonId);
        if (!selected?.label) return null;

        const details = ruptureDetails.trim();
        return details.length > 0 ? `${selected.label} - ${details}` : selected.label;
      })();

      // Validation
      const storeEntered = typeof gondolaCount === 'number';
      const inventoryEntered = typeof inventoryCount === 'number';
      const countsComplete = !requireStockCount
        ? true
        : storeEntered && inventoryEntered && (total > 0 || !!composedRuptureReason);

      if (requireStockCount && storeEntered && inventoryEntered && total === 0 && !composedRuptureReason) {
        toast.error('Se o estoque é 0, descreva o motivo da ruptura.');
        setSaving(false);
        return;
      }

      const overallValidity = hasValidityChecklist
        ? (() => {
            const storeOk = !!(validityStoreDate && validityStoreQuantity && validityStoreQuantity > 0);
            const stockOk = !!(validityStockDate && validityStockQuantity && validityStockQuantity > 0);
            if (storeOk && stockOk) {
              return validityStoreDate <= validityStockDate
                ? { date: validityStoreDate, qty: Number(validityStoreQuantity) }
                : { date: validityStockDate, qty: Number(validityStockQuantity) };
            }
            if (storeOk) return { date: validityStoreDate, qty: Number(validityStoreQuantity) };
            if (stockOk) return { date: validityStockDate, qty: Number(validityStockQuantity) };
            return null;
          })()
        : null;

      const nonStockRequiredChecklists = Array.isArray(product.checklists)
        ? product.checklists.filter((c: any) => {
            if (c?.type === 'STOCK_COUNT') return false;
            if (isValidityChecklistItem(c)) return false;
            if (isIgnoredChecklistItem(c)) return false;
            return true;
          })
        : [];

      const nonStockOk = nonStockRequiredChecklists.every((c: any) => {
        const isChecked = checklistState[c.id] ?? c.isChecked ?? false;
        return !!isChecked;
      });

      const validityOk = !hasValidityChecklist || !!overallValidity;
      const isComplete = !!(countsComplete && nonStockOk && validityOk);

      const payload: any = {
        checked: isComplete,
        checklists: Array.isArray(product.checklists)
          ? product.checklists.map((c: any) => {
              if (isValidityChecklistItem(c) && overallValidity?.date) {
                return {
                  ...c,
                  id: c.id,
                  isChecked: true,
                  value: overallValidity.date,
                };
              }

              const isChecked = checklistState[c.id] ?? c.isChecked ?? false;
              return {
                ...c,
                id: c.id,
                isChecked: !!isChecked,
                value: c.value,
              };
            })
          : []
      };

      if (requireStockCount) {
        if (storeEntered) payload.gondolaCount = gondolaCount;
        if (inventoryEntered) payload.inventoryCount = inventoryCount;
        if (storeEntered && inventoryEntered) {
          payload.stockCount = total;
          payload.isStockout = total === 0;
          payload.ruptureReason = total === 0 ? composedRuptureReason : null;
        }
      }

      if (hasValidityChecklist) {
        payload.validityStoreDate = validityStoreDate || null;
        payload.validityStoreQuantity = validityStoreQuantity === '' ? null : validityStoreQuantity;
        payload.validityStockDate = validityStockDate || null;
        payload.validityStockQuantity = validityStockQuantity === '' ? null : validityStockQuantity;
        payload.validityDate = overallValidity?.date || null;
        payload.validityQuantity = overallValidity?.qty ?? null;
      }

      await onSave(product.productId, payload);
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="font-bold text-lg text-gray-800 line-clamp-1">{product.product.name}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {!readOnly && (
            <div className="flex justify-end">
              <button
                onClick={() => setIsBreakageModalOpen(true)}
                className="text-red-600 border border-red-200 bg-red-50 px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium hover:bg-red-100 transition-colors"
              >
                <AlertTriangle size={16} />
                Reportar Avaria
              </button>
            </div>
          )}

          {/* Checklist Items Display (Simple Tasks) */}
          {Array.isArray(product.checklists) && product.checklists.length > 0 && (
             <div className="space-y-2">
                {product.checklists.map((item: any) => {
                    // Skip STOCK_COUNT (handled by inputs) and VALIDITY_CHECK (handled by its own section)
                    if (item.type === 'STOCK_COUNT') return null;
                    if (isValidityChecklistItem(item)) return null;
                    if (isIgnoredChecklistItem(item)) return null;

                    return (
                        <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border hover:bg-gray-100 transition-colors">
                            <input
                                type="checkbox"
                                checked={checklistState[item.id] || false}
                                onChange={() => handleChecklistToggle(item.id)}
                                disabled={readOnly}
                                className="w-6 h-6 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                            />
                            <span 
                              className="text-base font-medium text-gray-800 flex-1 cursor-pointer select-none" 
                              onClick={() => !readOnly && handleChecklistToggle(item.id)}
                            >
                                {item.description || 'Checklist'}
                            </span>
                        </div>
                    );
                })}
             </div>
          )}
          
          {/* Total Display - Only if stock count required */}
          {requireStockCount && (
            <div className="bg-blue-50 p-4 rounded-lg flex items-center justify-between">
              <span className="font-semibold text-blue-800">Total Contado:</span>
              <span className="text-2xl font-bold text-blue-600">{total}</span>
            </div>
          )}

          {requireStockCount && (
          <div className="grid grid-cols-2 gap-4">
            {/* Gondola Input */}
            <div className={`space-y-2 ${(mode === 'INVENTORY' && !mode.includes('BOTH')) ? 'opacity-50' : ''}`}>
              <label className="flex items-center text-sm font-medium text-gray-700">
                <Package size={16} className="mr-1" />
                Loja
              </label>
              <input
                type="number"
                value={gondolaCount}
                onChange={(e) => setGondolaCount(e.target.value === '' ? '' : parseInt(e.target.value))}
                className="w-full border rounded-lg p-3 text-lg text-center focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:text-gray-500"
                placeholder="0"
                autoFocus={mode === 'GONDOLA' && !readOnly}
                disabled={readOnly}
              />
            </div>

            {/* Inventory Input */}
            <div className={`space-y-2 ${(mode === 'GONDOLA' && !mode.includes('BOTH')) ? 'opacity-50' : ''}`}>
              <label className="flex items-center text-sm font-medium text-gray-700">
                <Layers size={16} className="mr-1" />
                Estoque
              </label>
              <input
                type="number"
                value={inventoryCount}
                onChange={(e) => setInventoryCount(e.target.value === '' ? '' : parseInt(e.target.value))}
                className="w-full border rounded-lg p-3 text-lg text-center focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:text-gray-500"
                placeholder="0"
                autoFocus={mode === 'INVENTORY' && !readOnly}
                disabled={readOnly}
              />
            </div>
          </div>
          )}

          {/* Validity Fields (if there is a validity-related checklist) */}
          {Array.isArray(product.checklists) &&
           product.checklists.some((c: any) => isValidityChecklistItem(c)) && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3">
                <div className="rounded-lg border border-slate-200 p-3 space-y-3">
                  <div className="text-sm font-bold text-slate-800">Validade (Loja)</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-600">Data</label>
                      <input
                        type="date"
                        value={validityStoreDate}
                        onChange={(e) => setValidityStoreDate(e.target.value)}
                        className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100"
                        disabled={readOnly}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-600">Quantidade</label>
                      <input
                        type="number"
                        min={0}
                        value={validityStoreQuantity}
                        onChange={(e) =>
                          setValidityStoreQuantity(e.target.value === '' ? '' : parseInt(e.target.value) || 0)
                        }
                        className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100"
                        disabled={readOnly}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 p-3 space-y-3">
                  <div className="text-sm font-bold text-slate-800">Validade (Estoque)</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-600">Data</label>
                      <input
                        type="date"
                        value={validityStockDate}
                        onChange={(e) => setValidityStockDate(e.target.value)}
                        className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100"
                        disabled={readOnly}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-gray-600">Quantidade</label>
                      <input
                        type="number"
                        min={0}
                        value={validityStockQuantity}
                        onChange={(e) =>
                          setValidityStockQuantity(e.target.value === '' ? '' : parseInt(e.target.value) || 0)
                        }
                        className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100"
                        disabled={readOnly}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Rupture Reason - Only if Total is 0 */}
          {requireStockCount && total === 0 && (
            <div className="space-y-2 animate-fadeIn">
              <label className="flex items-center text-sm font-medium text-red-600">
                <AlertTriangle size={16} className="mr-1" />
                Motivo da Ruptura
              </label>
              <select
                value={selectedRuptureReasonId}
                onChange={(e) => {
                  const next = e.target.value;
                  setSelectedRuptureReasonId(next);
                  if (next === '__OTHER__') return;
                  setRuptureDetails('');
                }}
                className="w-full border border-red-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none bg-red-50 disabled:bg-gray-100 disabled:border-gray-200 disabled:text-gray-500"
                disabled={readOnly}
              >
                <option value="">Selecionar motivo...</option>
                {ruptureReasons.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
                <option value="__OTHER__">Outro (descrever)</option>
              </select>

              <textarea
                value={ruptureDetails}
                onChange={(e) => setRuptureDetails(e.target.value)}
                className="w-full border border-red-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none bg-red-50 disabled:bg-gray-100 disabled:border-gray-200 disabled:text-gray-500"
                placeholder={selectedRuptureReasonId && selectedRuptureReasonId !== '__OTHER__' ? 'Complemento (opcional)...' : 'Descreva o motivo...'}
                rows={3}
                disabled={readOnly}
              />
            </div>
          )}

          {/* Product Info / EAN */}
          <div className="text-xs text-gray-500 flex items-center justify-center">
             <Info size={12} className="mr-1" />
             EAN: {product.product.ean || 'N/A'}
          </div>

        </div>

        <div className="p-4 border-t flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 border rounded-lg text-gray-600 font-medium hover:bg-gray-50"
          >
            {readOnly ? 'Fechar' : 'Cancelar'}
          </button>
          {!readOnly && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 flex items-center justify-center disabled:opacity-50"
            >
              {saving ? 'Salvando...' : (
                  <>
                      <Save size={18} className="mr-2" />
                      Salvar
                  </>
              )}
            </button>
          )}
        </div>
      </div>

      <BreakageReportModal
        isOpen={isBreakageModalOpen}
        onClose={() => setIsBreakageModalOpen(false)}
        product={product}
        routeItemId={routeItemId || ''}
        supermarketId={supermarketId || ''}
      />
    </div>
  );
};
