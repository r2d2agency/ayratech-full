import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Send, 
  Search, 
  Filter, 
  Download, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Plus
} from 'lucide-react';
import api from '../api/client';
import { getImageUrl } from '../utils/image';

interface Employee {
  id: string;
  name: string;
  fullName: string;
  position?: string;
}

interface Document {
  id: string;
  type: string;
  description: string;
  fileUrl: string;
  signedFileUrl?: string;
  signedAt?: string;
  sentAt: string;
  readAt?: string;
  senderId?: string;
  employee: {
    id: string;
    name: string;
    fullName: string;
  };
}

const DocumentsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'send' | 'history'>('history');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Filter States
  const [showFilters, setShowFilters] = useState(false);
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterEmployeeId, setFilterEmployeeId] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Form State
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [docType, setDocType] = useState('Holerite');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // New State for Bulk/Search
  const [sendToAll, setSendToAll] = useState(false);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);

  useEffect(() => {
    fetchEmployees();
    fetchDocuments();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/employees');
      setEmployees(response.data);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/employees/documents/all');
      setDocuments(response.data);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!selectedEmployeeId && !sendToAll) || !file) {
      alert('Selecione um funcionário (ou enviar para todos) e um arquivo.');
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append('type', docType);
    formData.append('description', description);
    formData.append('file', file);
    
    if (sendToAll) {
      formData.append('sendToAll', 'true');
    } else {
      formData.append('employeeIds', selectedEmployeeId);
    }

    try {
      const response = await api.post(`/employees/documents/bulk`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      const results = response.data;
      // Check if results is an array and has errors
      if (Array.isArray(results)) {
           const errors = results.filter((r: any) => r.status === 'error');
           if (errors.length > 0) {
               console.error('Failed documents details:', JSON.stringify(errors, null, 2));
               const errorMsg = errors.map((e: any) => `Func. ID ${e.employeeId.substring(0,8)}... : ${e.error}`).join('\n');
               alert(`Alguns documentos não puderam ser enviados:\n${errorMsg}\n\nVerifique os dados e tente novamente.`);
           } else {
               setSuccessMessage('Documento(s) enviado(s) com sucesso!');
           }
       } else {
          setSuccessMessage('Documento(s) enviado(s) com sucesso!');
      }
      
      setFile(null);
      setDescription('');
      setSelectedEmployeeId('');
      setEmployeeSearchQuery('');
      setSendToAll(false);
      fetchDocuments(); // Refresh history
      
      setTimeout(() => {
        setSuccessMessage('');
        setActiveTab('history');
      }, 2000);
    } catch (error) {
      console.error('Error sending document:', error);
      alert('Erro ao enviar documento. Verifique se o arquivo é válido e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkAsRead = async (doc: Document) => {
    // Open file immediately
    if (doc.fileUrl) {
      window.open(getImageUrl(doc.fileUrl), '_blank');
    }

    // Mark as read in background if not already read
    if (!doc.readAt) {
      try {
        const response = await api.patch(`/employees/documents/${doc.id}/read`);
        
        // Update local state
        setDocuments(prevDocs => 
          prevDocs.map(d => 
            d.id === doc.id 
              ? { ...d, readAt: response.data.readAt || new Date().toISOString() } 
              : d
          )
        );
      } catch (error) {
        console.error('Error marking document as read:', error);
      }
    }
  };

  const filteredDocuments = documents.filter(doc => {
    // Search Term
    const matchesSearch = 
      (doc.employee?.fullName || doc.employee?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.description || '').toLowerCase().includes(searchTerm.toLowerCase());

    // Filters
    const docDate = new Date(doc.sentAt);
    const matchesStartDate = !filterStartDate || docDate >= new Date(filterStartDate);
    
    // For end date, we set it to the end of the day
    let endDate = null;
    if (filterEndDate) {
        endDate = new Date(filterEndDate);
        endDate.setHours(23, 59, 59, 999);
    }
    const matchesEndDate = !endDate || docDate <= endDate;

    const matchesType = !filterType || doc.type === filterType;
    const matchesEmployee = !filterEmployeeId || doc.employee?.id === filterEmployeeId;

    return matchesSearch && matchesStartDate && matchesEndDate && matchesType && matchesEmployee;
  }).sort((a, b) => {
    const dateA = new Date(a.sentAt).getTime();
    const dateB = new Date(b.sentAt).getTime();
    return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--color-text)]">Gestão de Documentos</h1>
          <p className="text-[color:var(--color-muted)] mt-1">Envie holerites, comunicados e outros documentos para os funcionários.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === 'history' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white text-[color:var(--color-muted)] border border-slate-200 hover:bg-slate-50'}`}
          >
            <Clock size={18} className="inline mr-2" />
            Histórico
          </button>
          <button 
            onClick={() => setActiveTab('send')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeTab === 'send' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white text-[color:var(--color-muted)] border border-slate-200 hover:bg-slate-50'}`}
          >
            <Send size={18} className="inline mr-2" />
            Novo Envio
          </button>
        </div>
      </div>

      {activeTab === 'send' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h2 className="text-lg font-bold text-[color:var(--color-text)] mb-6 flex items-center gap-2">
            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
              <Send size={20} />
            </div>
            Enviar Novo Documento
          </h2>
          
          {successMessage && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl flex items-center gap-2">
              <CheckCircle size={20} />
              {successMessage}
            </div>
          )}

          <form onSubmit={handleSendDocument} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 relative z-20">
                <label className="text-sm font-medium text-[color:var(--color-text)]">Funcionário</label>
                
                <div className="flex items-center gap-2 mb-2 p-3 bg-slate-50 rounded-xl border border-slate-100 transition-colors hover:bg-slate-100">
                   <input 
                     type="checkbox" 
                     id="sendToAll"
                     checked={sendToAll}
                     onChange={(e) => {
                       setSendToAll(e.target.checked);
                       if (e.target.checked) {
                         setSelectedEmployeeId('');
                         setEmployeeSearchQuery('');
                         setIsEmployeeDropdownOpen(false);
                       }
                     }}
                     className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                   />
                   <label htmlFor="sendToAll" className="text-sm font-medium text-[color:var(--color-text)] cursor-pointer select-none flex-1">Enviar para todos os funcionários</label>
                </div>

                {!sendToAll && (
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="text"
                        placeholder="Buscar funcionário..."
                        className={`w-full h-11 rounded-xl border bg-white pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all ${!selectedEmployeeId && isSubmitting ? 'border-red-300' : 'border-slate-200'}`}
                        value={employeeSearchQuery}
                        onChange={(e) => {
                          setEmployeeSearchQuery(e.target.value);
                          setIsEmployeeDropdownOpen(true);
                          setSelectedEmployeeId('');
                        }}
                        onFocus={() => setIsEmployeeDropdownOpen(true)}
                        onBlur={() => {
                          // Delayed close to allow clicking items
                          setTimeout(() => setIsEmployeeDropdownOpen(false), 200);
                        }}
                      />
                      {selectedEmployeeId && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 animate-in fade-in zoom-in duration-200">
                           <CheckCircle size={18} />
                        </div>
                      )}
                    </div>
                    
                    {isEmployeeDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                        {employees
                          .filter(emp => (emp.fullName || emp.name).toLowerCase().includes(employeeSearchQuery.toLowerCase()))
                          .map(emp => (
                            <button
                              key={emp.id}
                              type="button"
                              onClick={() => {
                                setSelectedEmployeeId(emp.id);
                                setEmployeeSearchQuery(emp.fullName || emp.name);
                                setIsEmployeeDropdownOpen(false);
                              }}
                              className={`w-full text-left px-4 py-3 hover:bg-slate-50 text-sm border-b border-slate-50 last:border-0 transition-colors flex items-center justify-between group ${selectedEmployeeId === emp.id ? 'bg-blue-50 text-blue-700' : 'text-[color:var(--color-text)]'}`}
                            >
                              <span className="font-medium">{emp.fullName || emp.name}</span>
                              {selectedEmployeeId === emp.id && <CheckCircle size={16} />}
                            </button>
                          ))}
                        {employees.filter(emp => (emp.fullName || emp.name).toLowerCase().includes(employeeSearchQuery.toLowerCase())).length === 0 && (
                          <div className="px-4 py-3 text-sm text-[color:var(--color-muted)] text-center">Nenhum funcionário encontrado.</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-[color:var(--color-text)]">Tipo de Documento</label>
                <select 
                  className="w-full h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  required
                >
                  <option value="Holerite">Holerite</option>
                  <option value="Comunicado">Comunicado</option>
                  <option value="Ata">Ata</option>
                  <option value="Solicitação de Documentos">Solicitação de Documentos</option>
                  <option value="Contrato">Contrato</option>
                  <option value="Advertência">Advertência</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[color:var(--color-text)]">Descrição / Observação</label>
              <textarea 
                className="w-full h-24 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all resize-none"
                placeholder="Adicione uma nota ou descrição para o funcionário..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[color:var(--color-text)]">Arquivo</label>
              <div className="relative border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors">
                <input 
                  type="file" 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                  required
                />
                <div className="flex flex-col items-center gap-2 text-[color:var(--color-muted)]">
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-full">
                    <Plus size={24} />
                  </div>
                  <span className="font-medium text-[color:var(--color-text)]">
                    {file ? file.name : 'Clique para selecionar ou arraste o arquivo'}
                  </span>
                  <span className="text-xs">PDF, JPG, PNG (Max. 10MB)</span>
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-medium shadow-lg shadow-blue-600/20 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>Sending...</>
                ) : (
                  <>
                    <Send size={18} />
                    Enviar Documento
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="p-4 border-b border-slate-100 flex gap-4 bg-slate-50">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Buscar por funcionário, tipo..." 
                className="w-full h-10 rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`h-10 px-4 rounded-xl border transition-colors flex items-center gap-2 text-sm font-medium ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white text-[color:var(--color-muted)] border-slate-200 hover:bg-slate-50'}`}
            >
              <Filter size={18} />
              Filtros
            </button>
          </div>

          {showFilters && (
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 grid grid-cols-1 md:grid-cols-5 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="space-y-1">
                <label className="text-xs font-medium text-[color:var(--color-muted)]">Data Inicial</label>
                <input 
                  type="date" 
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[color:var(--color-muted)]">Data Final</label>
                <input 
                  type="date" 
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[color:var(--color-muted)]">Tipo</label>
                <select 
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  <option value="">Todos</option>
                  <option value="Holerite">Holerite</option>
                  <option value="Comunicado">Comunicado</option>
                  <option value="Ata">Ata</option>
                  <option value="Solicitação de Documentos">Solicitação de Documentos</option>
                  <option value="Contrato">Contrato</option>
                  <option value="Advertência">Advertência</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[color:var(--color-muted)]">Funcionário</label>
                <select 
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                  value={filterEmployeeId}
                  onChange={(e) => setFilterEmployeeId(e.target.value)}
                >
                  <option value="">Todos</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.fullName || emp.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[color:var(--color-muted)]">Ordenação</label>
                <select 
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                >
                  <option value="desc">Mais recentes</option>
                  <option value="asc">Mais antigos</option>
                </select>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[color:var(--color-muted)] uppercase tracking-wider">Data</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[color:var(--color-muted)] uppercase tracking-wider">Enviado Por</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[color:var(--color-muted)] uppercase tracking-wider">Funcionário</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[color:var(--color-muted)] uppercase tracking-wider">Tipo</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[color:var(--color-muted)] uppercase tracking-wider">Descrição</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-[color:var(--color-muted)] uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-[color:var(--color-muted)] uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-[color:var(--color-muted)]">Carregando...</td>
                  </tr>
                ) : filteredDocuments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-[color:var(--color-muted)]">Nenhum documento encontrado.</td>
                  </tr>
                ) : (
                  filteredDocuments.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-[color:var(--color-text)]">
                          {new Date(doc.sentAt).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-[color:var(--color-muted)]">
                          {new Date(doc.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-[color:var(--color-text)]">
                          {doc.sender?.employee?.fullName || doc.sender?.employee?.name || doc.sender?.email || 'Sistema'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-[color:var(--color-text)]">{doc.employee?.fullName || doc.employee?.name || 'Desconhecido'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {doc.type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-[color:var(--color-muted)] truncate max-w-xs">{doc.description || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {doc.readAt ? (
                          <div>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 mb-1">
                              <CheckCircle size={12} />
                              Lido
                            </span>
                            <div className="text-xs text-[color:var(--color-muted)]">
                              {new Date(doc.readAt).toLocaleString()}
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <Clock size={12} />
                            Pendente
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          {doc.signedFileUrl && (
                            <button
                              onClick={() => window.open(getImageUrl(doc.signedFileUrl!), '_blank')}
                              className="text-emerald-700 hover:text-emerald-900 px-3 py-2 hover:bg-emerald-50 rounded-lg transition-colors inline-flex items-center gap-2"
                              title="Baixar PDF assinado"
                            >
                              <FileText size={18} />
                              <span className="text-xs font-semibold">PDF assinado</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleMarkAsRead(doc)}
                            className="text-blue-600 hover:text-blue-800 px-3 py-2 hover:bg-blue-50 rounded-lg transition-colors inline-flex items-center gap-2"
                            title="Abrir e Marcar como Lido"
                          >
                            <Download size={18} />
                            <span className="text-xs font-semibold">Abrir</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentsView;
