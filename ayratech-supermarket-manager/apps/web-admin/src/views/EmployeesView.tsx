import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, CheckCircle, XCircle, ChevronDown, ChevronUp, Clock, FileText, Upload } from 'lucide-react';
import api from '../api/client';
import { useBranding } from '../context/BrandingContext';
import { getImageUrl } from '../utils/image';

interface Employee {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  cpf: string;
  role?: { id: string; name: string };
  status: string;
  createdAt: string;
  facialPhotoUrl?: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
}

interface EmployeeDocument {
  id: string;
  type: string;
  fileUrl: string;
  description?: string;
  createdAt: string;
  sentAt?: string;
  senderId?: string;
  sender?: {
    id: string;
    email: string;
    employee?: { id: string; fullName: string };
  };
}

interface AbsenceRequest {
  id: string;
  type: string;
  status: string;
  startDate: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  reason?: string;
  medicalCid?: string;
  medicalProfessionalName?: string;
  medicalServiceLocation?: string;
  medicalLicenseType?: string;
  medicalLicenseNumber?: string;
  fileUrl?: string;
  employeeDocumentId?: string;
  createdAt: string;
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

const EmployeesView: React.FC = () => {
  const { settings } = useBranding();
  const [activeTab, setActiveTab] = useState<'employees' | 'roles'>('employees');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);

  // Schedule Modal State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedEmployeeForSchedule, setSelectedEmployeeForSchedule] = useState<Employee | null>(null);
  const [scheduleForm, setScheduleForm] = useState<WorkScheduleDay[]>([]);

  // Forms
  const [employeeForm, setEmployeeForm] = useState({
    fullName: '',
    cpf: '',
    rg: '',
    birthDate: '',
    email: '',
    phone: '',
    addressStreet: '',
    addressNumber: '',
    addressDistrict: '',
    addressCity: '',
    addressState: '',
    addressZip: '',
    internalCode: '',
    roleId: '',
    supervisorId: '',
    contractType: 'clt',
    admissionDate: '',
    status: 'active',
    // Compensation (simplified for now)
    baseSalary: '',
    hourlyRate: '',
    dailyRate: '',
    visitRate: '',
    monthlyAllowance: '',
    transportVoucher: '',
    mealVoucher: '',
    chargesPercentage: '',
    // Schedule (simplified)
    weeklyHours: 44,
    facialPhotoUrl: '',
    createAccess: false,
    appPassword: ''
  });

  const [facialPhotoFile, setFacialPhotoFile] = useState<File | null>(null);
  const [facialPhotoPreview, setFacialPhotoPreview] = useState<string>('');

  const [roleForm, setRoleForm] = useState({
    name: '',
    description: '',
    accessLevel: 'basic'
  });

  const [formTab, setFormTab] = useState<'general' | 'address' | 'contract' | 'schedule' | 'absences'>('general');
  const [cpfError, setCpfError] = useState<string>('');
  const [cepError, setCepError] = useState<string>('');

  const [employeeDocuments, setEmployeeDocuments] = useState<EmployeeDocument[]>([]);
  const [employeeAbsences, setEmployeeAbsences] = useState<AbsenceRequest[]>([]);
  const [loadingAbsences, setLoadingAbsences] = useState(false);
  const [documentSearch, setDocumentSearch] = useState('');
  const [previewDoc, setPreviewDoc] = useState<EmployeeDocument | null>(null);
  const [vacationAlert, setVacationAlert] = useState<{ applicable: boolean; level?: string; label?: string; concessiveEnd?: string; daysToExpire?: number } | null>(null);
  const [showVacationAlert, setShowVacationAlert] = useState(false);
  const [absenceForm, setAbsenceForm] = useState({
    type: 'atestado',
    status: 'approved',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    reason: '',
    medicalCid: '',
    medicalProfessionalName: '',
    medicalServiceLocation: '',
    medicalLicenseType: 'CRM',
    medicalLicenseNumber: '',
    employeeDocumentId: '',
    fileUrl: '',
  });
  const [absenceFile, setAbsenceFile] = useState<File | null>(null);

  const isImageFileUrl = (url: string) => {
    const u = String(url || '').toLowerCase();
    return u.endsWith('.png') || u.endsWith('.jpg') || u.endsWith('.jpeg') || u.endsWith('.webp') || u.endsWith('.gif');
  };

  const filteredDocsForLink = employeeDocuments.filter(doc => {
    const q = documentSearch.trim().toLowerCase();
    if (!q) return true;
    const hay = [
      doc.type,
      doc.description,
      doc.fileUrl,
      doc.sender?.email,
      doc.sender?.employee?.fullName,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });

  // Helper functions
  const formatCPF = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };
  const formatCEP = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .slice(0, 9);
  };

  const validateCPF = (cpf: string) => {
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false;
    
    let sum = 0;
    let remainder;
    
    for (let i = 1; i <= 9; i++) sum = sum + parseInt(cpf.substring(i - 1, i)) * (11 - i);
    remainder = (sum * 10) % 11;
    if ((remainder === 10) || (remainder === 11)) remainder = 0;
    if (remainder !== parseInt(cpf.substring(9, 10))) return false;
    
    sum = 0;
    for (let i = 1; i <= 10; i++) sum = sum + parseInt(cpf.substring(i - 1, i)) * (12 - i);
    remainder = (sum * 10) % 11;
    if ((remainder === 10) || (remainder === 11)) remainder = 0;
    if (remainder !== parseInt(cpf.substring(10, 11))) return false;
    
    return true;
  };

  const handleCepLookup = async () => {
    const cepDigits = employeeForm.addressZip.replace(/\D/g, '');
    if (cepDigits.length !== 8) {
      setCepError(cepDigits.length > 0 ? 'CEP deve ter 8 dígitos' : '');
      return;
    }
    setCepError('');
    
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
      const data = await response.json();
      if (!data.erro) {
        setEmployeeForm(prev => ({
          ...prev,
          addressStreet: data.logradouro,
          addressDistrict: data.bairro,
          addressCity: data.localidade,
          addressState: data.uf
        }));
      } else {
        setCepError('CEP não encontrado');
      }
    } catch (error) {
      console.error('Error fetching CEP:', error);
      setCepError('Erro ao consultar CEP');
    }
  };

  useEffect(() => {
    fetchEmployees();
    fetchRoles();
  }, []);
  useEffect(() => {
    const digits = employeeForm.addressZip.replace(/\D/g, '');
    if (digits.length === 8) {
      handleCepLookup();
    }
  }, [employeeForm.addressZip]);

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/employees');
      setEmployees(response.data);
    } catch (error) {
      if ((error as any)?.response?.status === 401) {
        alert('Sessão expirada ou não autenticado. Faça login para continuar.');
      } else {
        console.error('Error fetching employees:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await api.get('/roles');
      setRoles(response.data);
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const fetchEmployeeDocuments = async (employeeId: string) => {
    if (!employeeId) return;
    try {
      const response = await api.get(`/employees/${employeeId}/documents`);
      const docs = Array.isArray(response.data) ? response.data : [];
      setEmployeeDocuments(docs);
    } catch (error) {
      console.error('Error fetching employee documents:', error);
      setEmployeeDocuments([]);
    }
  };

  const fetchEmployeeAbsences = async (employeeId: string) => {
    if (!employeeId) return;
    setLoadingAbsences(true);
    try {
      const response = await api.get('/absences', { params: { employeeId } });
      const absences = Array.isArray(response.data) ? response.data : [];
      setEmployeeAbsences(absences);
    } catch (error) {
      console.error('Error fetching absences:', error);
      setEmployeeAbsences([]);
    } finally {
      setLoadingAbsences(false);
    }
  };

  useEffect(() => {
    if (!showEmployeeModal) return;
    const employeeId = editingEmployee?.id;
    if (!employeeId) return;
    if (formTab !== 'absences') return;

    fetchEmployeeAbsences(employeeId);
    fetchEmployeeDocuments(employeeId);
    (async () => {
      try {
        const res = await api.get(`/employees/${employeeId}/vacation-alert`);
        const alertData = res.data || null;
        setVacationAlert(alertData);
        if (alertData?.applicable && (alertData.level === 'warning' || alertData.level === 'due' || alertData.level === 'expired')) {
          setShowVacationAlert(true);
        } else {
          setShowVacationAlert(false);
        }
      } catch (e) {
        setVacationAlert(null);
        setShowVacationAlert(false);
      }
    })();
  }, [showEmployeeModal, editingEmployee?.id, formTab]);

  const handleUploadAbsenceDocument = async () => {
    if (!editingEmployee?.id || !absenceFile) return;
    try {
      const formData = new FormData();
      formData.append('file', absenceFile);
      formData.append('type', absenceForm.type || 'documento');
      if (absenceForm.reason) {
        formData.append('description', absenceForm.reason);
      }

      const response = await api.post(`/employees/${editingEmployee.id}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const doc = response.data;
      if (doc?.id) {
        setAbsenceForm(prev => ({
          ...prev,
          employeeDocumentId: doc.id,
          fileUrl: doc.fileUrl || prev.fileUrl,
        }));
      } else if (doc?.fileUrl) {
        setAbsenceForm(prev => ({ ...prev, fileUrl: doc.fileUrl }));
      }

      setAbsenceFile(null);
      await fetchEmployeeDocuments(editingEmployee.id);
      alert('Documento enviado e vinculado com sucesso!');
    } catch (error: any) {
      console.error('Error uploading document:', error);
      const msg = error.response?.data?.message || error.message || 'Erro ao enviar documento.';
      alert(`Erro: ${Array.isArray(msg) ? msg.join(', ') : msg}`);
    }
  };

  const handleCreateAbsence = async () => {
    if (!editingEmployee?.id) {
      alert('Salve o funcionário antes de registrar afastamentos/férias/atestado.');
      return;
    }
    if (!absenceForm.type || !absenceForm.startDate) {
      alert('Informe o tipo e a data de início.');
      return;
    }

    try {
      const isPartialVacation = absenceForm.type === 'ferias_parcial';
      if (isPartialVacation) {
        if (!absenceForm.startTime || !absenceForm.endTime) {
          alert('Para férias parciais, informe hora de início e hora de fim.');
          return;
        }
        if (absenceForm.startTime >= absenceForm.endTime) {
          alert('Hora de início deve ser menor que a hora de fim.');
          return;
        }
      }
      const isMedicalCertificate = absenceForm.type === 'atestado';
      if (isMedicalCertificate) {
        if (!absenceForm.medicalCid || !absenceForm.medicalProfessionalName || !absenceForm.medicalServiceLocation || !absenceForm.medicalLicenseNumber) {
          alert('Para atestado, informe CID, nome do médico, local de atendimento e CRM.');
          return;
        }
      }

      const payloadEndDate = isPartialVacation
        ? absenceForm.startDate
        : absenceForm.endDate || undefined;

      await api.post('/absences', {
        employeeId: editingEmployee.id,
        type: absenceForm.type,
        status: absenceForm.status,
        startDate: absenceForm.startDate,
        startTime: absenceForm.startTime || undefined,
        endDate: payloadEndDate,
        endTime: absenceForm.endTime || undefined,
        reason: absenceForm.reason || undefined,
        medicalCid: absenceForm.medicalCid || undefined,
        medicalProfessionalName: absenceForm.medicalProfessionalName || undefined,
        medicalServiceLocation: absenceForm.medicalServiceLocation || undefined,
        medicalLicenseType: isMedicalCertificate ? 'CRM' : absenceForm.medicalLicenseType || undefined,
        medicalLicenseNumber: absenceForm.medicalLicenseNumber || undefined,
        employeeDocumentId: absenceForm.employeeDocumentId || undefined,
        fileUrl: absenceForm.fileUrl || undefined,
      });

      setAbsenceForm({
        type: 'atestado',
        status: 'approved',
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
        reason: '',
        medicalCid: '',
        medicalProfessionalName: '',
        medicalServiceLocation: '',
        medicalLicenseType: 'CRM',
        medicalLicenseNumber: '',
        employeeDocumentId: '',
        fileUrl: '',
      });
      setAbsenceFile(null);
      await fetchEmployeeAbsences(editingEmployee.id);
      alert('Registro salvo com sucesso!');
    } catch (error: any) {
      console.error('Error creating absence:', error);
      const msg = error.response?.data?.message || error.message || 'Erro ao registrar.';
      alert(`Erro: ${Array.isArray(msg) ? msg.join(', ') : msg}`);
    }
  };

  const handleDeleteAbsence = async (absenceId: string) => {
    if (!absenceId) return;
    if (!confirm('Remover este registro?')) return;
    try {
      await api.delete(`/absences/${absenceId}`);
      if (editingEmployee?.id) {
        await fetchEmployeeAbsences(editingEmployee.id);
      }
    } catch (error: any) {
      console.error('Error deleting absence:', error);
      const msg = error.response?.data?.message || error.message || 'Erro ao remover.';
      alert(`Erro: ${Array.isArray(msg) ? msg.join(', ') : msg}`);
    }
  };

  const filteredEmployees = employees.filter(emp => 
    emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (emp.role && emp.role.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cpfError) {
      alert('Corrija o CPF antes de salvar.');
      return;
    }

    if (!employeeForm.roleId) {
      alert('Selecione um cargo para o funcionário.');
      return;
    }

    try {
      const formData = new FormData();
      
      // Append all form fields
      Object.keys(employeeForm).forEach(key => {
        const value = (employeeForm as any)[key];
        if (value !== null && value !== undefined && value !== '') {
            formData.append(key, value);
        }
      });

      if (facialPhotoFile) {
        formData.append('facialPhoto', facialPhotoFile);
      }

      if (editingEmployee) {
        await api.patch(`/employees/${editingEmployee.id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        alert('Funcionário atualizado com sucesso!');
      } else {
        await api.post('/employees', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        alert('Funcionário cadastrado com sucesso!');
      }
      setShowEmployeeModal(false);
      fetchEmployees();
    } catch (error: any) {
      console.error('Error saving employee:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Erro ao salvar funcionário.';
      alert(`Erro: ${errorMessage}`);
    }
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/roles', roleForm);
      setShowRoleModal(false);
      setRoleForm({ name: '', description: '', accessLevel: 'basic' });
      fetchRoles();
    } catch (error: any) {
      console.error('Error saving role:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Erro ao salvar cargo.';
      alert(`Erro: ${Array.isArray(errorMessage) ? errorMessage.join(', ') : errorMessage}`);
    }
  };

  const resetEmployeeForm = () => {
    setEmployeeForm({
      fullName: '',
      cpf: '',
      rg: '',
      birthDate: '',
      email: '',
      phone: '',
      addressStreet: '',
      addressNumber: '',
      addressDistrict: '',
      addressCity: '',
      addressState: '',
      addressZip: '',
      internalCode: '',
      roleId: '',
      supervisorId: '',
      contractType: 'clt',
      admissionDate: '',
      status: 'active',
      baseSalary: '',
      transportVoucher: '',
      mealVoucher: '',
      weeklyHours: 44
    });
    setFormTab('general');
    setFacialPhotoFile(null);
    setFacialPhotoPreview('');
    setEmployeeDocuments([]);
    setEmployeeAbsences([]);
    setLoadingAbsences(false);
    setAbsenceForm({
      type: 'atestado',
      status: 'approved',
      startDate: '',
      startTime: '',
      endDate: '',
      endTime: '',
      reason: '',
      employeeDocumentId: '',
      fileUrl: '',
    });
    setAbsenceFile(null);
  };

  const openEditEmployee = async (emp: any) => {
    setEditingEmployee(emp);
    
    try {
      // Load basic data first to open modal quickly or just wait? 
      // Let's fetch first to ensure data is there.
      const response = await api.get(`/employees/${emp.id}`);
      const fullEmp = response.data;

      // Extract latest compensation
      let baseSalary = '';
      let hourlyRate = '';
      let dailyRate = '';
      let visitRate = '';
      let monthlyAllowance = '';
      let transportVoucher = '';
      let mealVoucher = '';
      let chargesPercentage = '';

      if (fullEmp.compensations && fullEmp.compensations.length > 0) {
        // Sort by validFrom descending to get the most recent
        const sortedComp = fullEmp.compensations.sort((a: any, b: any) => 
          new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime()
        );
        const currentComp = sortedComp[0];
        baseSalary = currentComp.baseSalary;
        hourlyRate = currentComp.hourlyRate;
        dailyRate = currentComp.dailyRate;
        visitRate = currentComp.visitRate;
        monthlyAllowance = currentComp.monthlyAllowance;
        transportVoucher = currentComp.transportVoucher;
        mealVoucher = currentComp.mealVoucher;
        chargesPercentage = currentComp.chargesPercentage;
      }

      // Extract latest schedule
      let weeklyHours = 44;
      if (fullEmp.workSchedules && fullEmp.workSchedules.length > 0) {
        const sortedSched = fullEmp.workSchedules.sort((a: any, b: any) => 
          new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime()
        );
        weeklyHours = sortedSched[0].weeklyHours;
      }

      // Handle Photo
      if (fullEmp.facialPhotoUrl) {
          setFacialPhotoPreview(getImageUrl(fullEmp.facialPhotoUrl));
      } else {
          setFacialPhotoPreview('');
      }

      setEmployeeForm({
        ...fullEmp,
        roleId: fullEmp.role?.id || '',
        supervisorId: fullEmp.supervisor?.id || '',
        birthDate: fullEmp.birthDate ? fullEmp.birthDate.split('T')[0] : '',
        admissionDate: fullEmp.admissionDate ? fullEmp.admissionDate.split('T')[0] : '',
        baseSalary: baseSalary || '',
        hourlyRate: hourlyRate || '',
        dailyRate: dailyRate || '',
        visitRate: visitRate || '',
        monthlyAllowance: monthlyAllowance || '',
        transportVoucher: transportVoucher || '',
        mealVoucher: mealVoucher || '',
        chargesPercentage: chargesPercentage || '',
        weeklyHours: weeklyHours || 44,
        createAccess: !!fullEmp.appAccessEnabled,
        appPassword: ''
      });
    } catch (error) {
      console.error('Error fetching employee details:', error);
      // Fallback to basic info if fetch fails
      setEmployeeForm({
        ...emp,
        roleId: emp.role?.id || '',
        supervisorId: emp.supervisor?.id || '',
        birthDate: emp.birthDate ? emp.birthDate.split('T')[0] : '',
        admissionDate: emp.admissionDate ? emp.admissionDate.split('T')[0] : '',
      });
    }

    setShowEmployeeModal(true);
  };

  const openScheduleModal = async (employee: Employee) => {
    setSelectedEmployeeForSchedule(employee);
    
    try {
        const response = await api.get(`/employees/${employee.id}`);
        const fullEmp = response.data;
        
        let currentDays: WorkScheduleDay[] = [];
        
        if (fullEmp.workSchedules && fullEmp.workSchedules.length > 0) {
            const sorted = fullEmp.workSchedules.sort((a: any, b: any) => 
                new Date(b.validFrom).getTime() - new Date(a.validFrom).getTime()
            );
            const latest = sorted[0];
            if (latest.days && latest.days.length > 0) {
                currentDays = latest.days;
            }
        }

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
        alert('Erro ao carregar horários.');
    }
  };

  const handleSaveSchedule = async () => {
      if (!selectedEmployeeForSchedule) return;

      try {
          const payload = {
              employeeId: selectedEmployeeForSchedule.id,
              validFrom: new Date().toISOString().split('T')[0],
              weeklyHours: 44, // Calculate dynamically if needed
              days: scheduleForm.map(day => ({
                  dayOfWeek: day.dayOfWeek,
                  active: !!day.active,
                  startTime: day.startTime || '08:00',
                  endTime: day.endTime || '17:00',
                  breakStart: day.breakStart || null,
                  breakEnd: day.breakEnd || null,
                  toleranceMinutes: Number(day.toleranceMinutes) || 0
              }))
          };

          await api.post('/work-schedules', payload);
          alert('Escala de trabalho salva com sucesso!');
          setShowScheduleModal(false);
          fetchEmployees(); // Refresh to update any summary info if present
      } catch (error: any) {
          console.error('Error saving schedule:', error);
          alert('Erro ao salvar escala.');
      }
  };

  return (
    <div className="space-y-6">
                        {vacationAlert?.applicable && (vacationAlert.level === 'warning' || vacationAlert.level === 'due' || vacationAlert.level === 'expired') && (
                          <div className={`p-3 rounded-lg border ${vacationAlert.level === 'expired' ? 'bg-red-50 border-red-200 text-red-800' : vacationAlert.level === 'due' ? 'bg-orange-50 border-orange-200 text-orange-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                            <div className="text-sm font-semibold">{vacationAlert.label}</div>
                            <div className="text-xs mt-1">Prazo concessivo até {vacationAlert.concessiveEnd}. {typeof vacationAlert.daysToExpire === 'number' && vacationAlert.daysToExpire > 0 ? `Faltam ${vacationAlert.daysToExpire} dia(s).` : ''}</div>
                          </div>
                        )}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[color:var(--color-text)]">Gestão de Pessoas</h1>
          <p className="text-[color:var(--color-muted)]">Gerencie funcionários, cargos e escalas</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setActiveTab('employees')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'employees' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-[color:var(--color-muted)] hover:bg-slate-50'
            }`}
          >
            Funcionários
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'roles' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-[color:var(--color-muted)] hover:bg-slate-50'
            }`}
          >
            Cargos
          </button>
        </div>
      </div>

      {/* Employees Tab */}
      {activeTab === 'employees' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row justify-between items-center bg-slate-50 gap-4">
            <h2 className="font-semibold text-[color:var(--color-text)]">Lista de Funcionários</h2>
            
            <div className="flex flex-1 w-full md:w-auto gap-4 justify-end">
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
              
              <button
                onClick={() => {
                  setEditingEmployee(null);
                  resetEmployeeForm();
                  setShowEmployeeModal(true);
                }}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shrink-0"
              >
                <Plus size={20} />
                Novo Funcionário
              </button>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 text-[color:var(--color-muted)] text-sm font-semibold">
                <tr>
                  <th className="p-4 text-left">Nome</th>
                  <th className="p-4 text-left">Cargo</th>
                  <th className="p-4 text-left">Contato</th>
                  <th className="p-4 text-left">Status</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-slate-100 overflow-hidden flex-shrink-0">
                          {emp.facialPhotoUrl ? (
                            <img 
                              src={getImageUrl(emp.facialPhotoUrl)} 
                              alt="" 
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-slate-400 font-medium">
                              {emp.fullName.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-[color:var(--color-text)]">{emp.fullName}</div>
                          <div className="text-xs text-[color:var(--color-muted)]">CPF: {emp.cpf}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-[color:var(--color-muted)]">{emp.role?.name || '-'}</td>
                    <td className="p-4">
                      <div className="text-sm text-[color:var(--color-muted)]">{emp.email}</div>
                      <div className="text-xs text-[color:var(--color-muted)]">{emp.phone}</div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        emp.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {emp.status === 'active' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => openScheduleModal(emp)}
                          className="text-purple-600 hover:text-purple-800 p-1"
                          title="Configurar Escala"
                        >
                          <Clock size={18} />
                        </button>
                        <button 
                          onClick={() => openEditEmployee(emp)}
                          className="text-blue-600 hover:text-blue-800 p-1"
                          title="Editar"
                        >
                          <Edit size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {employees.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-[color:var(--color-muted)]">
                      Nenhum funcionário cadastrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Roles Tab */}
      {activeTab === 'roles' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
            <h2 className="font-semibold text-[color:var(--color-text)]">Cargos e Permissões</h2>
            <button
              onClick={() => setShowRoleModal(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={20} />
              Novo Cargo
            </button>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map((role) => (
              <div key={role.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <h3 className="font-bold text-[color:var(--color-text)]">{role.name}</h3>
                <p className="text-sm text-[color:var(--color-muted)] mt-1">{role.description}</p>
              </div>
            ))}
            {roles.length === 0 && (
              <p className="text-[color:var(--color-muted)] col-span-3 text-center py-8">Nenhum cargo cadastrado.</p>
            )}
          </div>
        </div>
      )}

      {/* Role Modal */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-[color:var(--color-text)]">Novo Cargo</h3>
              <button onClick={() => setShowRoleModal(false)} className="text-slate-400 hover:text-[color:var(--color-muted)]">
                <XCircle size={24} />
              </button>
            </div>
            <form onSubmit={handleSaveRole} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Nome do Cargo</label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={roleForm.name}
                  onChange={e => setRoleForm({...roleForm, name: e.target.value})}
                  placeholder="Ex: Promotor, Supervisor"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Descrição</label>
                <textarea
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={roleForm.description}
                  onChange={e => setRoleForm({...roleForm, description: e.target.value})}
                  rows={3}
                />
              </div>
              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="px-4 py-2 text-[color:var(--color-muted)] hover:bg-slate-100 rounded-lg mr-2"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-xl font-bold text-[color:var(--color-text)]">
                Escala de Trabalho - {selectedEmployeeForSchedule?.fullName}
              </h3>
              <button onClick={() => setShowScheduleModal(false)} className="text-slate-400 hover:text-[color:var(--color-muted)]">
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
                <div className="bg-blue-50 p-4 rounded-lg text-blue-800 text-sm">
                    Configure os horários de entrada, saída e intervalo para cada dia da semana.
                    Dias desmarcados serão considerados folgas.
                </div>

                <div className="space-y-4">
                    {scheduleForm.map((day, index) => {
                        const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
                        
                        return (
                            <div key={day.dayOfWeek} className={`p-4 rounded-lg border ${day.active ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200 bg-slate-50'}`}>
                                <div className="flex flex-col md:flex-row md:items-center gap-4">
                                    <div className="w-32 flex items-center gap-2">
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
                                        <span className={`font-medium ${day.active ? 'text-[color:var(--color-text)]' : 'text-[color:var(--color-muted)]'}`}>
                                            {dayNames[day.dayOfWeek]}
                                        </span>
                                    </div>

                                    {day.active && (
                                        <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-[color:var(--color-muted)] mb-1">Entrada</label>
                                                <input
                                                    type="time"
                                                    value={day.startTime}
                                                    onChange={(e) => {
                                                        const newForm = [...scheduleForm];
                                                        newForm[index].startTime = e.target.value;
                                                        setScheduleForm(newForm);
                                                    }}
                                                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-[color:var(--color-muted)] mb-1">Início Almoço</label>
                                                <input
                                                    type="time"
                                                    value={day.breakStart || ''}
                                                    onChange={(e) => {
                                                        const newForm = [...scheduleForm];
                                                        newForm[index].breakStart = e.target.value;
                                                        setScheduleForm(newForm);
                                                    }}
                                                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-[color:var(--color-muted)] mb-1">Fim Almoço</label>
                                                <input
                                                    type="time"
                                                    value={day.breakEnd || ''}
                                                    onChange={(e) => {
                                                        const newForm = [...scheduleForm];
                                                        newForm[index].breakEnd = e.target.value;
                                                        setScheduleForm(newForm);
                                                    }}
                                                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-[color:var(--color-muted)] mb-1">Saída</label>
                                                <input
                                                    type="time"
                                                    value={day.endTime}
                                                    onChange={(e) => {
                                                        const newForm = [...scheduleForm];
                                                        newForm[index].endTime = e.target.value;
                                                        setScheduleForm(newForm);
                                                    }}
                                                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-[color:var(--color-muted)] mb-1">Tol. (min)</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={day.toleranceMinutes}
                                                    onChange={(e) => {
                                                        const newForm = [...scheduleForm];
                                                        newForm[index].toleranceMinutes = parseInt(e.target.value) || 0;
                                                        setScheduleForm(newForm);
                                                    }}
                                                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="p-6 border-t border-slate-200 flex justify-end gap-3 sticky bottom-0 bg-white">
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="px-4 py-2 text-[color:var(--color-text)] hover:bg-slate-100 rounded-lg font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveSchedule}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm"
              >
                Salvar Escala
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Employee Modal */}
      {showEmployeeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="font-bold text-lg text-[color:var(--color-text)]">
                {editingEmployee ? 'Editar Funcionário' : 'Novo Funcionário'}
              </h3>
              <button onClick={() => setShowEmployeeModal(false)} className="text-slate-400 hover:text-[color:var(--color-muted)]">
                <XCircle size={24} />
              </button>
            </div>

            {/* Form Tabs */}
            <div className="flex border-b border-slate-200 px-6 shrink-0">
              <button
                onClick={() => setFormTab('general')}
                className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                  formTab === 'general' ? 'border-blue-600 text-blue-600' : 'border-transparent text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]'
                }`}
              >
                Dados Gerais
              </button>
              <button
                onClick={() => setFormTab('address')}
                className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                  formTab === 'address' ? 'border-blue-600 text-blue-600' : 'border-transparent text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]'
                }`}
              >
                Endereço
              </button>
              <button
                onClick={() => setFormTab('contract')}
                className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                  formTab === 'contract' ? 'border-blue-600 text-blue-600' : 'border-transparent text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]'
                }`}
              >
                Contrato & Vínculo
              </button>
              <button
                onClick={() => setFormTab('schedule')}
                className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                  formTab === 'schedule' ? 'border-blue-600 text-blue-600' : 'border-transparent text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]'
                }`}
              >
                Escala
              </button>
              <button
                type="button"
                disabled={!editingEmployee}
                onClick={() => setFormTab('absences')}
                className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                  formTab === 'absences' ? 'border-blue-600 text-blue-600' : 'border-transparent text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]'
                } ${!editingEmployee ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={!editingEmployee ? 'Salve o funcionário primeiro' : ''}
              >
                Afastamentos
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="overflow-y-auto p-6 flex-1">
              {formTab === 'general' && (
                <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Nome Completo</label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      value={employeeForm.fullName}
                      onChange={e => setEmployeeForm({...employeeForm, fullName: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">CPF</label>
                    <input
                      type="text"
                      required
                      maxLength={14}
                      className={`w-full px-3 py-2 border rounded-lg ${cpfError ? 'border-red-500' : 'border-slate-300'}`}
                      value={employeeForm.cpf}
                      onChange={e => setEmployeeForm({...employeeForm, cpf: formatCPF(e.target.value)})}
                      onBlur={() => setCpfError(validateCPF(employeeForm.cpf) ? '' : 'CPF inválido')}
                      placeholder="000.000.000-00"
                    />
                    {cpfError && <p className="text-red-600 text-xs mt-1">{cpfError}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">RG</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      value={employeeForm.rg}
                      onChange={e => setEmployeeForm({...employeeForm, rg: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Data de Nascimento</label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      value={employeeForm.birthDate}
                      onChange={e => setEmployeeForm({...employeeForm, birthDate: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Email</label>
                    <input
                      type="email"
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      value={employeeForm.email}
                      onChange={e => setEmployeeForm({...employeeForm, email: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Telefone</label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      value={employeeForm.phone}
                      onChange={e => setEmployeeForm({...employeeForm, phone: e.target.value})}
                    />
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mt-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-4">Foto Facial</h3>
                  <div className="flex items-start gap-4">
                    {facialPhotoPreview ? (
                      <div className="relative">
                        <img 
                          src={facialPhotoPreview} 
                          alt="Preview" 
                          className="w-32 h-32 object-cover rounded-lg border border-gray-300"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setFacialPhotoPreview('');
                            setFacialPhotoFile(null);
                            setEmployeeForm({ ...employeeForm, facialPhotoUrl: '' });
                          }}
                          className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1 hover:bg-red-200"
                        >
                          <XCircle size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-white text-gray-400 overflow-hidden">
                        {employeeForm.facialPhotoUrl ? (
                           <img 
                             src={getImageUrl(employeeForm.facialPhotoUrl)} 
                             alt="Atual" 
                             className="w-full h-full object-cover" 
                           />
                        ) : (
                          <span className="text-xs text-center p-2">Sem foto</span>
                        )}
                      </div>
                    )}
                    
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Carregar Foto
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 5 * 1024 * 1024) {
                                alert('Arquivo muito grande. Máximo 5MB.');
                                return;
                            }
                            setFacialPhotoFile(file);
                            const reader = new FileReader();
                            reader.onloadend = () => {
                                setFacialPhotoPreview(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="block w-full text-sm text-gray-500
                          file:mr-4 file:py-2 file:px-4
                          file:rounded-md file:border-0
                          file:text-sm file:font-semibold
                          file:bg-blue-50 file:text-blue-700
                          hover:file:bg-blue-100"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        PNG, JPG ou JPEG até 5MB.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mt-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-gray-900">Acesso ao Aplicativo</h3>
                    <div className="flex items-center">
                      <input
                        id="createAccess"
                        type="checkbox"
                        checked={(employeeForm as any).createAccess || false}
                        onChange={(e) => setEmployeeForm({ ...employeeForm, createAccess: e.target.checked } as any)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="createAccess" className="ml-2 block text-sm text-gray-900">
                        Habilitar acesso
                      </label>
                    </div>
                  </div>
                  
                  {(employeeForm as any).createAccess && (
                    <div className="grid grid-cols-1 gap-6">
                       <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                          <div className="flex">
                            <div className="ml-3">
                              <p className="text-sm text-yellow-700">
                                Isso criará um usuário vinculado a este funcionário com perfil de <strong>Promotor</strong>.
                                O funcionário poderá usar o email cadastrado e a senha abaixo para acessar o App.
                              </p>
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">
                            Senha de Acesso
                          </label>
                          <input
                            type="text"
                            value={(employeeForm as any).appPassword || ''}
                            onChange={(e) => setEmployeeForm({ ...employeeForm, appPassword: e.target.value } as any)}
                            className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                            placeholder="Digite uma senha inicial"
                          />
                        </div>
                    </div>
                  )}
                </div>
                </>
              )}

              {formTab === 'address' && (
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">CEP *</label>
                    <input
                      type="text"
                      required
                      className={`w-full px-3 py-2 border rounded-lg ${cepError ? 'border-red-500' : 'border-slate-300'}`}
                      value={employeeForm.addressZip}
                      onChange={e => setEmployeeForm({...employeeForm, addressZip: formatCEP(e.target.value)})}
                      onBlur={handleCepLookup}
                      placeholder="00000-000"
                    />
                    {cepError && <p className="text-red-600 text-xs mt-1">{cepError}</p>}
                  </div>
                  <div className="md:col-span-4">
                    <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Logradouro *</label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      value={employeeForm.addressStreet}
                      onChange={e => setEmployeeForm({...employeeForm, addressStreet: e.target.value})}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Número *</label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      value={employeeForm.addressNumber}
                      onChange={e => setEmployeeForm({...employeeForm, addressNumber: e.target.value})}
                    />
                  </div>
                  <div className="md:col-span-4">
                    <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Bairro *</label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      value={employeeForm.addressDistrict}
                      onChange={e => setEmployeeForm({...employeeForm, addressDistrict: e.target.value})}
                    />
                  </div>
                  <div className="md:col-span-4">
                    <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Cidade *</label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      value={employeeForm.addressCity}
                      onChange={e => setEmployeeForm({...employeeForm, addressCity: e.target.value})}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Estado *</label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      value={employeeForm.addressState}
                      onChange={e => setEmployeeForm({...employeeForm, addressState: e.target.value})}
                    />
                  </div>
                </div>
              )}

              {formTab === 'contract' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Matrícula Interna</label>
                    <input
                      type="text"
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      value={employeeForm.internalCode}
                      onChange={e => setEmployeeForm({...employeeForm, internalCode: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Cargo</label>
                    <select
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      value={employeeForm.roleId}
                      onChange={e => setEmployeeForm({...employeeForm, roleId: e.target.value})}
                    >
                      <option value="">Selecione...</option>
                      {roles.map(role => (
                        <option key={role.id} value={role.id}>{role.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Supervisor</label>
                    <select
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      value={employeeForm.supervisorId}
                      onChange={e => setEmployeeForm({...employeeForm, supervisorId: e.target.value})}
                    >
                      <option value="">Nenhum</option>
                      {employees
                        .filter(e => 
                          e.id !== editingEmployee?.id && 
                          e.role && 
                          (e.role.name.toLowerCase().includes('supervisor') || e.role.name.toLowerCase().includes('coordenador'))
                        )
                        .map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                        ))
                      }
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Tipo de Contrato</label>
                    <select
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      value={employeeForm.contractType}
                      onChange={e => setEmployeeForm({...employeeForm, contractType: e.target.value})}
                    >
                      <option value="clt">CLT</option>
                      <option value="pj">PJ</option>
                      <option value="temporario">Temporário</option>
                      <option value="estagio">Estágio</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Data de Admissão</label>
                    <input
                      type="date"
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      value={employeeForm.admissionDate}
                      onChange={e => setEmployeeForm({...employeeForm, admissionDate: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Status</label>
                    <select
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      value={employeeForm.status}
                      onChange={e => setEmployeeForm({...employeeForm, status: e.target.value})}
                    >
                      <option value="active">Ativo</option>
                      <option value="inactive">Inativo/Desligado</option>
                      <option value="vacation">Férias/Afastado</option>
                    </select>
                  </div>
                  
                  <div className="col-span-2 mt-4">
                    <h4 className="font-semibold text-[color:var(--color-text)] border-b pb-2 mb-4">Remuneração (Estimativa)</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Salário Base</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                        value={employeeForm.baseSalary}
                        onChange={e => setEmployeeForm({...employeeForm, baseSalary: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Valor Hora</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                        value={employeeForm.hourlyRate}
                        onChange={e => setEmployeeForm({...employeeForm, hourlyRate: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Valor Diária</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                        value={employeeForm.dailyRate}
                        onChange={e => setEmployeeForm({...employeeForm, dailyRate: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Valor Visita</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                        value={employeeForm.visitRate}
                        onChange={e => setEmployeeForm({...employeeForm, visitRate: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Ajuda de Custo (Mensal)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                        value={employeeForm.monthlyAllowance}
                        onChange={e => setEmployeeForm({...employeeForm, monthlyAllowance: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Vale Transporte</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                        value={employeeForm.transportVoucher}
                        onChange={e => setEmployeeForm({...employeeForm, transportVoucher: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Vale Refeição/Alimentação</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                        value={employeeForm.mealVoucher}
                        onChange={e => setEmployeeForm({...employeeForm, mealVoucher: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Encargos (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                        value={employeeForm.chargesPercentage}
                        onChange={e => setEmployeeForm({...employeeForm, chargesPercentage: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              )}

              {formTab === 'schedule' && (
                <div className="space-y-4">
                  <p className="text-sm text-[color:var(--color-muted)]">Configuração simplificada de jornada.</p>
                  <div>
                    <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Carga Horária Semanal</label>
                    <input
                      type="number"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      value={employeeForm.weeklyHours}
                      onChange={e => setEmployeeForm({...employeeForm, weeklyHours: Number(e.target.value)})}
                    />
                  </div>
                  {/* Future: Add day-by-day schedule here */}
                </div>
              )}

              {formTab === 'absences' && (
                <div className="space-y-4">
                  {!editingEmployee ? (
                    <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-4 text-sm">
                      Salve o funcionário para registrar e gerenciar afastamentos/férias/atestado.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
                        <div className="flex items-center gap-2 text-[color:var(--color-text)] font-semibold">
                          <FileText size={18} />
                          Novo registro
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Tipo</label>
                            <select
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                              value={absenceForm.type}
                              onChange={e => setAbsenceForm(prev => ({ ...prev, type: e.target.value }))}
                            >
                              <option value="atestado">Atestado</option>
                              <option value="ferias">Férias</option>
                              <option value="ferias_parcial">Férias (parcial)</option>
                              <option value="afastamento">Afastamento</option>
                              <option value="folga">Folga</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Status</label>
                            <select
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                              value={absenceForm.status}
                              onChange={e => setAbsenceForm(prev => ({ ...prev, status: e.target.value }))}
                            >
                              <option value="approved">Aprovado</option>
                              <option value="pending">Pendente</option>
                              <option value="rejected">Rejeitado</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Data início</label>
                            <input
                              type="date"
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                              value={absenceForm.startDate}
                              onChange={e => setAbsenceForm(prev => ({ ...prev, startDate: e.target.value }))}
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Hora início</label>
                            <input
                              type="time"
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                              value={absenceForm.startTime}
                              onChange={e => setAbsenceForm(prev => ({ ...prev, startTime: e.target.value }))}
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Data fim</label>
                            <input
                              type="date"
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                              value={absenceForm.endDate}
                              onChange={e => setAbsenceForm(prev => ({ ...prev, endDate: e.target.value }))}
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Hora fim</label>
                            <input
                              type="time"
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                              value={absenceForm.endTime}
                              onChange={e => setAbsenceForm(prev => ({ ...prev, endTime: e.target.value }))}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Motivo/Observação</label>
                          <textarea
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                            rows={3}
                            value={absenceForm.reason}
                            onChange={e => setAbsenceForm(prev => ({ ...prev, reason: e.target.value }))}
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-[color:var(--color-text)]">Documento</label>
                            <input
                              type="text"
                              placeholder="Pesquisar documento (tipo, descrição, remetente...)"
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                              value={documentSearch}
                              onChange={e => setDocumentSearch(e.target.value)}
                            />
                          <select
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                            value={absenceForm.employeeDocumentId}
                            onChange={e => {
                              const docId = e.target.value;
                                const doc = employeeDocuments.find(d => d.id === docId);
                              setAbsenceForm(prev => ({
                                ...prev,
                                employeeDocumentId: docId,
                                fileUrl: doc?.fileUrl || prev.fileUrl,
                              }));
                            }}
                          >
                            <option value="">Nenhum</option>
                              {filteredDocsForLink.map(doc => (
                              <option key={doc.id} value={doc.id}>
                                  {doc.type} - {doc.description || doc.sender?.employee?.fullName || doc.sender?.email || doc.fileUrl}
                              </option>
                            ))}
                          </select>

                            {filteredDocsForLink.length > 0 && (
                              <div className="grid grid-cols-3 gap-2">
                                {filteredDocsForLink.slice(0, 12).map(doc => {
                                  const selected = doc.id === absenceForm.employeeDocumentId;
                                  return (
                                    <button
                                      key={doc.id}
                                      type="button"
                                      onClick={() => setPreviewDoc(doc)}
                                      className={`border rounded-lg p-2 text-left overflow-hidden ${selected ? 'border-blue-600 ring-2 ring-blue-100' : 'border-slate-200 hover:border-slate-300'}`}
                                      title={doc.description || doc.type}
                                    >
                                      <div className="w-full h-20 bg-slate-50 rounded-md flex items-center justify-center overflow-hidden">
                                        {isImageFileUrl(doc.fileUrl) ? (
                                          <img src={getImageUrl(doc.fileUrl)} alt={doc.type} className="w-full h-full object-cover" />
                                        ) : (
                                          <FileText size={26} className="text-slate-400" />
                                        )}
                                      </div>
                                      <div className="text-xs text-[color:var(--color-text)] mt-2 truncate">{doc.type}</div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                          <div className="flex items-center gap-3">
                            <input
                              type="file"
                              onChange={e => setAbsenceFile(e.target.files?.[0] || null)}
                              className="block w-full text-sm text-gray-500
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-md file:border-0
                                file:text-sm file:font-semibold
                                file:bg-blue-50 file:text-blue-700
                                hover:file:bg-blue-100"
                            />
                            <button
                              type="button"
                              onClick={handleUploadAbsenceDocument}
                              disabled={!absenceFile}
                              className={`shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white ${
                                absenceFile ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-300 cursor-not-allowed'
                              }`}
                            >
                              <Upload size={16} />
                              Enviar
                            </button>
                          </div>

                          {absenceForm.fileUrl && (
                            <a
                              href={getImageUrl(absenceForm.fileUrl)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm text-blue-600 hover:text-blue-800"
                            >
                              Ver documento vinculado
                            </a>
                          )}
                        </div>

                        {absenceForm.type === 'atestado' && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">CID</label>
                              <input
                                type="text"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                value={absenceForm.medicalCid}
                                onChange={e => setAbsenceForm(prev => ({ ...prev, medicalCid: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Nome do médico</label>
                              <input
                                type="text"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                value={absenceForm.medicalProfessionalName}
                                onChange={e => setAbsenceForm(prev => ({ ...prev, medicalProfessionalName: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">Local de atendimento</label>
                              <input
                                type="text"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                value={absenceForm.medicalServiceLocation}
                                onChange={e => setAbsenceForm(prev => ({ ...prev, medicalServiceLocation: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-[color:var(--color-text)] mb-1">CRM</label>
                              <input
                                type="text"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                                value={absenceForm.medicalLicenseNumber}
                                onChange={e => setAbsenceForm(prev => ({ ...prev, medicalLicenseNumber: e.target.value }))}
                              />
                            </div>
                          </div>
                        )}

                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={handleCreateAbsence}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                          >
                            Salvar registro
                          </button>
                        </div>

                        {previewDoc && (
                          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-xl w-full max-w-3xl overflow-hidden">
                              <div className="flex items-center justify-between px-4 py-3 border-b">
                                <div className="text-sm font-semibold text-[color:var(--color-text)] truncate">
                                  {previewDoc.type} {previewDoc.description ? `- ${previewDoc.description}` : ''}
                                </div>
                                <button type="button" onClick={() => setPreviewDoc(null)} className="text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]">
                                  <XCircle size={20} />
                                </button>
                              </div>
                              <div className="p-4">
                                <div className="w-full h-[60vh] bg-slate-50 rounded-lg overflow-hidden flex items-center justify-center">
                                  {isImageFileUrl(previewDoc.fileUrl) ? (
                                    <img src={getImageUrl(previewDoc.fileUrl)} alt={previewDoc.type} className="max-w-full max-h-full object-contain" />
                                  ) : (
                                    <iframe src={getImageUrl(previewDoc.fileUrl)} title={previewDoc.type} className="w-full h-full" />
                                  )}
                                </div>
                                <div className="flex items-center justify-end gap-2 mt-4">
                                  <a
                                    href={getImageUrl(previewDoc.fileUrl)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-3 py-2 border border-slate-300 rounded-lg text-[color:var(--color-text)] hover:bg-slate-50"
                                  >
                                    Abrir em nova aba
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAbsenceForm(prev => ({ ...prev, employeeDocumentId: previewDoc.id, fileUrl: previewDoc.fileUrl }));
                                      setPreviewDoc(null);
                                    }}
                                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                  >
                                    Vincular ao afastamento
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {showVacationAlert && vacationAlert && (
                          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-xl w-full max-w-md overflow-hidden">
                              <div className={`px-4 py-3 border-b ${vacationAlert.level === 'expired' ? 'bg-red-600 text-white' : vacationAlert.level === 'due' ? 'bg-orange-600 text-white' : 'bg-amber-500 text-white'}`}>
                                <div className="text-sm font-semibold">{vacationAlert.label}</div>
                              </div>
                              <div className="p-4 space-y-2">
                                <div className="text-sm text-[color:var(--color-text)]">Prazo concessivo até <span className="font-semibold">{vacationAlert.concessiveEnd}</span>.</div>
                                {typeof vacationAlert.daysToExpire === 'number' && (
                                  <div className="text-xs text-[color:var(--color-muted)]">{vacationAlert.daysToExpire > 0 ? `Faltam ${vacationAlert.daysToExpire} dia(s)` : vacationAlert.daysToExpire === 0 ? 'Vence hoje' : 'Já vencido'}</div>
                                )}
                                <div className="pt-2 flex justify-end">
                                  <button type="button" onClick={() => setShowVacationAlert(false)} className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Entendi</button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-[color:var(--color-text)]">Registros</div>
                          <button
                            type="button"
                            onClick={() => {
                              if (editingEmployee?.id) {
                                fetchEmployeeAbsences(editingEmployee.id);
                              }
                            }}
                            className="text-sm text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]"
                          >
                            Atualizar
                          </button>
                        </div>

                        {loadingAbsences ? (
                          <div className="text-sm text-[color:var(--color-muted)]">Carregando...</div>
                        ) : employeeAbsences.length === 0 ? (
                          <div className="text-sm text-[color:var(--color-muted)]">Nenhum registro.</div>
                        ) : (
                          <div className="space-y-3">
                            {employeeAbsences.map(a => {
                              const startDate = a.startDate ? String(a.startDate).split('T')[0] : '';
                              const endDate = a.endDate ? String(a.endDate).split('T')[0] : '';
                              const startTime = a.startTime ? String(a.startTime).slice(0, 5) : '';
                              const endTime = a.endTime ? String(a.endTime).slice(0, 5) : '';
                              const period =
                                endDate && endDate !== startDate
                                  ? `${startDate} - ${endDate}`
                                  : startTime || endTime
                                    ? `${startDate} ${startTime || '00:00'} - ${endTime || '23:59'}`
                                    : startDate;

                              return (
                                <div key={a.id} className="border border-slate-200 rounded-lg p-3">
                                  <div className="flex justify-between gap-4">
                                    <div className="min-w-0">
                                      <div className="font-medium text-[color:var(--color-text)] capitalize">
                                        {a.type} <span className="text-xs text-[color:var(--color-muted)]">({a.status})</span>
                                      </div>
                                      <div className="text-sm text-[color:var(--color-muted)]">{period}</div>
                                      {a.reason && <div className="text-sm text-[color:var(--color-muted)] mt-1">{a.reason}</div>}
                                      {a.type === 'atestado' && (a.medicalCid || a.medicalProfessionalName || a.medicalLicenseNumber) && (
                                        <div className="text-sm text-[color:var(--color-muted)] mt-1">
                                          {[
                                            a.medicalCid ? `CID ${a.medicalCid}` : '',
                                            a.medicalProfessionalName || '',
                                            a.medicalServiceLocation ? `Local: ${a.medicalServiceLocation}` : '',
                                            a.medicalLicenseNumber ? `CRM ${a.medicalLicenseNumber}` : '',
                                          ]
                                            .filter(Boolean)
                                            .join(' • ')}
                                        </div>
                                      )}
                                      {a.fileUrl && (
                                        <a
                                          href={getImageUrl(a.fileUrl)}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-block text-sm text-blue-600 hover:text-blue-800 mt-1"
                                        >
                                          Ver documento
                                        </a>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteAbsence(a.id)}
                                      className="text-red-600 hover:text-red-800 p-1 shrink-0"
                                      title="Remover"
                                    >
                                      <Trash2 size={18} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </form>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowEmployeeModal(false)}
                className="px-4 py-2 text-[color:var(--color-muted)] hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEmployee}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Salvar Funcionário
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeesView;
