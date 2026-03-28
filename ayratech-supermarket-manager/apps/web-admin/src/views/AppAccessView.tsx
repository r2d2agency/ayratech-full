import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Search, 
  Clock, 
  Check, 
  X, 
  AlertCircle,
  Smartphone,
  Calendar
} from 'lucide-react';
import api from '../api/client';

interface Employee {
  id: string;
  fullName: string;
  email: string;
  role?: {
    name: string;
  };
  appAccessEnabled?: boolean;
  workSchedules?: WorkSchedule[];
}

interface WorkSchedule {
  id: string;
  validFrom: string;
  validTo?: string;
  weeklyHours: number;
  days: WorkScheduleDay[];
}

interface WorkScheduleDay {
  dayOfWeek: number;
  active: boolean;
  startTime: string;
  endTime: string;
  breakStart?: string;
  breakEnd?: string;
  toleranceMinutes: number;
}

const WEEK_DAYS = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado'
];

const AppAccessView: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Schedule Modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [scheduleForm, setScheduleForm] = useState<WorkScheduleDay[]>([]);
  const [savingSchedule, setSavingSchedule] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const response = await api.get('/employees');
      setEmployees(response.data);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAccess = async (employee: Employee) => {
    try {
      // Toggle access by updating the employee
      // We need to send createAccess parameter
      const newAccessState = !employee.appAccessEnabled;
      
      await api.patch(`/employees/${employee.id}`, {
        createAccess: newAccessState ? 'true' : 'false'
      });

      // Update local state
      setEmployees(prev => prev.map(emp => 
        emp.id === employee.id 
          ? { ...emp, appAccessEnabled: newAccessState }
          : emp
      ));

    } catch (error: any) {
      console.error('Error toggling app access:', error);
      const msg = error.response?.data?.message || error.message || 'Erro ao alterar acesso do aplicativo.';
      alert(`Erro: ${Array.isArray(msg) ? msg.join(', ') : msg}`);
    }
  };

  const openScheduleModal = async (employee: Employee) => {
    setSelectedEmployee(employee);
    
    // Fetch latest schedule details to be sure
    try {
        const response = await api.get(`/employees/${employee.id}`);
        const fullEmp = response.data;
        
        // Find active schedule
        let currentDays: WorkScheduleDay[] = [];
        
        if (fullEmp.workSchedules && fullEmp.workSchedules.length > 0) {
            // Sort by validFrom desc
            const sorted = fullEmp.workSchedules.sort((a: any, b: any) => 
                new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime()
            );
            const latest = sorted[0];
            if (latest.days && latest.days.length > 0) {
                currentDays = latest.days;
            }
        }

        // Initialize form with 7 days
        const formDays = Array.from({ length: 7 }, (_, i) => {
            const existingDay = currentDays.find(d => d.dayOfWeek === i);
            return existingDay ? { ...existingDay } : {
                dayOfWeek: i,
                active: i > 0 && i < 6, // Default Mon-Fri
                startTime: '08:00',
                endTime: '17:00',
                breakStart: '12:00',
                breakEnd: '13:00',
                toleranceMinutes: 10
            };
        });

        setScheduleForm(formDays);
        setShowScheduleModal(true);
    } catch (error: any) {
        console.error('Error loading schedule:', error);
        const msg = error.response?.data?.message || error.message || 'Erro ao carregar horários.';
        alert(`Erro: ${Array.isArray(msg) ? msg.join(', ') : msg}`);
    }
  };

  const handleSaveSchedule = async () => {
    if (!selectedEmployee) return;

    try {
        setSavingSchedule(true);

        // Create new schedule
        const payload = {
            employeeId: selectedEmployee.id,
            validFrom: new Date(),
            weeklyHours: 44, // Default or calculated
            days: scheduleForm
        };

        await api.post('/work-schedules', payload);
        
        setShowScheduleModal(false);
        fetchEmployees(); // Refresh to get updated data
        alert('Horários atualizados com sucesso!');

    } catch (error: any) {
        console.error('Error saving schedule:', error);
        const msg = error.response?.data?.message || error.message || 'Erro ao salvar horários.';
        alert(`Erro: ${Array.isArray(msg) ? msg.join(', ') : msg}`);
    } finally {
        setSavingSchedule(false);
    }
  };

  const filteredEmployees = employees.filter(emp => 
    emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--color-text)]">Gestão de Acesso ao App</h1>
          <p className="text-[color:var(--color-muted)]">Controle quem pode acessar o aplicativo e os horários permitidos.</p>
        </div>
        
        <div className="relative w-full md:w-64">
            <input
                type="text"
                placeholder="Buscar funcionário..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="bg-slate-50 text-[color:var(--color-muted)] text-sm font-semibold">
                    <tr>
                        <th className="p-4 text-left">Funcionário</th>
                        <th className="p-4 text-left">Cargo</th>
                        <th className="p-4 text-center">Acesso ao App</th>
                        <th className="p-4 text-center">Horários</th>
                        <th className="p-4 text-right">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {filteredEmployees.map((emp) => (
                        <tr key={emp.id} className="hover:bg-slate-50">
                            <td className="p-4">
                                <div className="font-medium text-[color:var(--color-text)]">{emp.fullName}</div>
                                <div className="text-xs text-[color:var(--color-muted)]">{emp.email}</div>
                            </td>
                            <td className="p-4 text-[color:var(--color-muted)]">{emp.role?.name || '-'}</td>
                            <td className="p-4 text-center">
                                <button
                                    onClick={() => handleToggleAccess(emp)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                                        emp.appAccessEnabled ? 'bg-blue-600' : 'bg-slate-200'
                                    }`}
                                >
                                    <span
                                        className={`${
                                            emp.appAccessEnabled ? 'translate-x-6' : 'translate-x-1'
                                        } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                                    />
                                </button>
                                <div className="text-xs text-slate-400 mt-1">
                                    {emp.appAccessEnabled ? 'Permitido' : 'Bloqueado'}
                                </div>
                            </td>
                            <td className="p-4 text-center">
                                <button
                                    onClick={() => openScheduleModal(emp)}
                                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-[color:var(--color-text)] rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
                                >
                                    <Clock size={16} />
                                    Configurar Horários
                                </button>
                            </td>
                            <td className="p-4 text-right">
                                {emp.appAccessEnabled ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">
                                        <Check size={12} />
                                        Ativo
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-[color:var(--color-muted)] bg-slate-100 px-2 py-1 rounded-full">
                                        <X size={12} />
                                        Inativo
                                    </span>
                                )}
                            </td>
                        </tr>
                    ))}
                    {filteredEmployees.length === 0 && (
                        <tr>
                            <td colSpan={5} className="p-8 text-center text-[color:var(--color-muted)]">
                                Nenhum funcionário encontrado.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <h2 className="text-xl font-bold text-[color:var(--color-text)]">Configurar Horários Permitidos</h2>
                        <p className="text-sm text-[color:var(--color-muted)]">Defina quando {selectedEmployee.fullName} pode usar o aplicativo.</p>
                    </div>
                    <button 
                        onClick={() => setShowScheduleModal(false)}
                        className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                    >
                        <X size={20} className="text-[color:var(--color-muted)]" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    <div className="space-y-4">
                        {scheduleForm.map((day, index) => (
                            <div key={day.dayOfWeek} className={`p-4 rounded-xl border ${day.active ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200 bg-slate-50'} transition-all`}>
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="flex items-center gap-3 w-40">
                                        <input
                                            type="checkbox"
                                            checked={day.active}
                                            onChange={(e) => {
                                                const newForm = [...scheduleForm];
                                                newForm[index].active = e.target.checked;
                                                setScheduleForm(newForm);
                                            }}
                                            className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className={`font-semibold ${day.active ? 'text-[color:var(--color-text)]' : 'text-slate-400'}`}>
                                            {WEEK_DAYS[day.dayOfWeek]}
                                        </span>
                                    </div>
                                    
                                    {!day.active && (
                                        <span className="text-sm text-slate-400 italic">Sem acesso neste dia</span>
                                    )}
                                </div>

                                {day.active && (
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pl-8">
                                        <div>
                                            <label className="block text-xs font-medium text-[color:var(--color-muted)] mb-1">Início Jornada</label>
                                            <input
                                                type="time"
                                                value={day.startTime}
                                                onChange={(e) => {
                                                    const newForm = [...scheduleForm];
                                                    newForm[index].startTime = e.target.value;
                                                    setScheduleForm(newForm);
                                                }}
                                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-[color:var(--color-muted)] mb-1">Início Intervalo</label>
                                            <input
                                                type="time"
                                                value={day.breakStart || ''}
                                                onChange={(e) => {
                                                    const newForm = [...scheduleForm];
                                                    newForm[index].breakStart = e.target.value;
                                                    setScheduleForm(newForm);
                                                }}
                                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-[color:var(--color-muted)] mb-1">Fim Intervalo</label>
                                            <input
                                                type="time"
                                                value={day.breakEnd || ''}
                                                onChange={(e) => {
                                                    const newForm = [...scheduleForm];
                                                    newForm[index].breakEnd = e.target.value;
                                                    setScheduleForm(newForm);
                                                }}
                                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-[color:var(--color-muted)] mb-1">Fim Jornada</label>
                                            <input
                                                type="time"
                                                value={day.endTime}
                                                onChange={(e) => {
                                                    const newForm = [...scheduleForm];
                                                    newForm[index].endTime = e.target.value;
                                                    setScheduleForm(newForm);
                                                }}
                                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 shrink-0">
                    <button
                        onClick={() => setShowScheduleModal(false)}
                        className="px-4 py-2 text-[color:var(--color-muted)] hover:bg-slate-100 rounded-lg font-medium"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSaveSchedule}
                        disabled={savingSchedule}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {savingSchedule ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Salvando...
                            </>
                        ) : (
                            'Salvar Alterações'
                        )}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default AppAccessView;
