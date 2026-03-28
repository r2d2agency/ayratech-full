import React, { useState, useEffect } from 'react';
import { useBranding } from '../context/BrandingContext';
import { Save, Shield, Palette, Users, Trash2, Edit, Upload, AlertTriangle } from 'lucide-react';
import SectionHeader from '../components/SectionHeader';
import api from '../api/client';
import { getImageUrl } from '../utils/image';

const AdminView: React.FC = () => {
  const { settings, updateSettings } = useBranding();
  const [activeTab, setActiveTab] = useState<'branding' | 'users' | 'permissions' | 'reasons'>('branding');

  // Local state for branding form
  const [brandingForm, setBrandingForm] = useState(settings);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [loginLogoFile, setLoginLogoFile] = useState<File | null>(null);
  const [systemLogoFile, setSystemLogoFile] = useState<File | null>(null);
  const [splashScreenFile, setSplashScreenFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [pwaIconFile, setPwaIconFile] = useState<File | null>(null);
  const [siteIconFile, setSiteIconFile] = useState<File | null>(null);

  useEffect(() => {
      setBrandingForm(settings);
  }, [settings]);

  // Users state
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [userForm, setUserForm] = useState({ name: '', username: '', password: '', role: 'user', clientIds: [] as string[] });
  const [allClients, setAllClients] = useState<any[]>([]);

  // Permissions state
  const [editingPermissions, setEditingPermissions] = useState<string | null>(null);
  const [roles, setRoles] = useState<any[]>([]);
  const [incidentReasons, setIncidentReasons] = useState<any[]>([]);
  const [loadingIncidentReasons, setLoadingIncidentReasons] = useState(false);
  const [incidentReasonTypeFilter, setIncidentReasonTypeFilter] = useState<'ALL' | 'RUPTURE' | 'BREAKAGE'>('ALL');
  const [editingIncidentReason, setEditingIncidentReason] = useState<any | null>(null);
  const [incidentReasonForm, setIncidentReasonForm] = useState<{ type: 'RUPTURE' | 'BREAKAGE'; label: string; isActive: boolean }>({
    type: 'RUPTURE',
    label: '',
    isActive: true,
  });

  useEffect(() => {
    fetchRoles();
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const res = await api.get('/clients');
      setAllClients(res.data);
    } catch (err) {
      console.error('Erro ao buscar clientes:', err);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await api.get('/roles');
      // Map backend roles to frontend structure
      const rolesWithPermissions = res.data.map((r: any) => ({
        ...r,
        permissions: r.permissions || [] // Ensure permissions array exists
      }));
      setRoles(rolesWithPermissions);
    } catch (err) {
      console.error('Erro ao buscar cargos:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'reasons') {
      fetchIncidentReasons();
    }
  }, [activeTab, incidentReasonTypeFilter]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err) {
      console.error('Erro ao buscar usuários:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userForm.role) {
      alert('Por favor, selecione um cargo.');
      return;
    }

    try {
      const payload: any = {
        email: userForm.username,
        roleId: userForm.role,
        clientIds: userForm.clientIds, // Add clientIds to payload
      };

      if (editingUser) {
        // Edit existing user
        if (userForm.password) {
          payload.password = userForm.password;
        }
        await api.patch(`/users/${editingUser.id}`, payload);
        alert('Usuário atualizado com sucesso!');
      } else {
        // Create new user
        payload.password = userForm.password;
        await api.post('/users', payload);
        alert('Usuário criado com sucesso!');
      }
      resetUserForm();
      fetchUsers();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao salvar usuário: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleEditUser = (user: any) => {
    setEditingUser(user);
    setUserForm({
      name: user.name || '',
      username: user.email || '',
      password: '', // Password is blank on edit
      role: user.roleId || (roles.length > 0 ? roles[0].id : '')
    });
  };

  const resetUserForm = () => {
    setEditingUser(null);
    setUserForm({ name: '', username: '', password: '', role: roles.length > 0 ? roles[0].id : '' });
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;
    try {
      await api.delete(`/users/${id}`);
      fetchUsers();
    } catch (err) {
      alert('Erro ao excluir usuário');
    }
  };

  const fetchIncidentReasons = async () => {
    setLoadingIncidentReasons(true);
    try {
      const params: any = { all: 'true' };
      if (incidentReasonTypeFilter !== 'ALL') params.type = incidentReasonTypeFilter;
      const res = await api.get('/incident-reasons', { params });
      setIncidentReasons(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Erro ao buscar motivos:', err);
      setIncidentReasons([]);
    } finally {
      setLoadingIncidentReasons(false);
    }
  };

  const handleIncidentReasonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!incidentReasonForm.label.trim()) {
      alert('Informe o rótulo do motivo.');
      return;
    }

    try {
      const payload = {
        type: incidentReasonForm.type,
        label: incidentReasonForm.label.trim(),
        isActive: incidentReasonForm.isActive,
      };

      if (editingIncidentReason) {
        await api.patch(`/incident-reasons/${editingIncidentReason.id}`, payload);
        alert('Motivo atualizado com sucesso!');
      } else {
        await api.post('/incident-reasons', payload);
        alert('Motivo criado com sucesso!');
      }

      resetIncidentReasonForm();
      fetchIncidentReasons();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao salvar motivo: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleEditIncidentReason = (reason: any) => {
    setEditingIncidentReason(reason);
    setIncidentReasonForm({
      type: reason.type === 'BREAKAGE' ? 'BREAKAGE' : 'RUPTURE',
      label: reason.label || '',
      isActive: reason.isActive !== false,
    });
  };

  const resetIncidentReasonForm = () => {
    setEditingIncidentReason(null);
    setIncidentReasonForm({
      type: 'RUPTURE',
      label: '',
      isActive: true,
    });
  };

  const handleDeleteIncidentReason = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este motivo?')) return;
    try {
      await api.delete(`/incident-reasons/${id}`);
      fetchIncidentReasons();
    } catch (err: any) {
      console.error(err);
      alert('Erro ao excluir motivo: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleBrandingSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
        const formData = new FormData();
        formData.append('companyName', brandingForm.companyName);
        formData.append('primaryColor', brandingForm.primaryColor);
        if (brandingForm.logoUrl) formData.append('logoUrl', brandingForm.logoUrl);
        if (brandingForm.loginLogoUrl) formData.append('loginLogoUrl', brandingForm.loginLogoUrl);
        if (brandingForm.systemLogoUrl) formData.append('systemLogoUrl', brandingForm.systemLogoUrl);
        if (brandingForm.splashScreenUrl) formData.append('splashScreenUrl', brandingForm.splashScreenUrl);
        formData.append('blurThreshold', String(brandingForm.blurThreshold || 8));

        if (logoFile) formData.append('logo', logoFile);
        if (loginLogoFile) formData.append('loginLogo', loginLogoFile);
        if (systemLogoFile) formData.append('systemLogo', systemLogoFile);
        if (splashScreenFile) formData.append('splashScreen', splashScreenFile);
        if (faviconFile) formData.append('favicon', faviconFile);
        if (pwaIconFile) formData.append('pwaIcon', pwaIconFile);
        if (siteIconFile) formData.append('siteIcon', siteIconFile);

        const response = await api.patch('/settings', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });

        updateSettings(response.data);
        alert('Configurações de Branding salvas!');
        
        // Clear file inputs
        setLogoFile(null);
        setLoginLogoFile(null);
        setSystemLogoFile(null);
        setSplashScreenFile(null);
        setFaviconFile(null);
        setPwaIconFile(null);
        setSiteIconFile(null);
    } catch (error) {
        console.error('Erro ao salvar branding:', error);
        alert('Erro ao salvar configurações.');
    }
  };

  const togglePermission = (roleId: string, permission: string) => {
    setRoles(roles.map(r => {
      if (r.id === roleId) {
        const has = r.permissions.includes(permission);
        return {
          ...r,
          permissions: has 
            ? r.permissions.filter((p: string) => p !== permission)
            : [...r.permissions, permission]
        };
      }
      return r;
    }));
  };

  const handleSavePermissions = async (role: any) => {
    try {
      await api.patch(`/roles/${role.id}`, {
        permissions: role.permissions
      });
      setEditingPermissions(null);
      alert('Permissões atualizadas com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar permissões.');
    }
  };

  const getRoleName = (roleId: string) => {
    if (!roleId) return 'Usuário Comum';
    const role = roles.find(r => r.id === roleId);
    return role ? (role.description || role.name) : 'Usuário Comum';
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-[color:var(--color-text)] tracking-tight">Administração</h1>
          <p className="text-[color:var(--color-muted)] font-medium text-lg">Configurações globais do sistema.</p>
        </div>
      </div>

      <div className="flex gap-4 border-b border-slate-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('branding')}
          className={`pb-4 px-4 font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'branding' ? 'text-[var(--primary-color)] border-b-2 border-[var(--primary-color)]' : 'text-slate-400 hover:text-[color:var(--color-muted)]'}`}
        >
          Branding & Identidade
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`pb-4 px-4 font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'users' ? 'text-[var(--primary-color)] border-b-2 border-[var(--primary-color)]' : 'text-slate-400 hover:text-[color:var(--color-muted)]'}`}
        >
          Usuários
        </button>
        <button
          onClick={() => setActiveTab('permissions')}
          className={`pb-4 px-4 font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'permissions' ? 'text-[var(--primary-color)] border-b-2 border-[var(--primary-color)]' : 'text-slate-400 hover:text-[color:var(--color-muted)]'}`}
        >
          Permissões & Cargos
        </button>
        <button
          onClick={() => setActiveTab('reasons')}
          className={`pb-4 px-4 font-bold text-sm transition-all whitespace-nowrap ${activeTab === 'reasons' ? 'text-[var(--primary-color)] border-b-2 border-[var(--primary-color)]' : 'text-slate-400 hover:text-[color:var(--color-muted)]'}`}
        >
          Motivos
        </button>
      </div>

      {activeTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 bg-white rounded-3xl border border-slate-200 p-8 shadow-sm h-fit">
            <SectionHeader icon={<Users className="text-[var(--primary-color)]" size={22} />} title={editingUser ? "Editar Usuário" : "Novo Usuário"} />
            <form onSubmit={handleUserSubmit} className="mt-6 space-y-4">
              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase mb-1 block">Email (Login)</label>
                <input 
                  type="email" 
                  required
                  value={userForm.username}
                  onChange={e => setUserForm({...userForm, username: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none focus:ring-2 focus:ring-blue-100 font-bold text-sm"
                  placeholder="email@exemplo.com"
                />
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase mb-1 block">Senha {editingUser && '(Deixe em branco para manter)'}</label>
                <input 
                  type="password" 
                  required={!editingUser}
                  value={userForm.password}
                  onChange={e => setUserForm({...userForm, password: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none focus:ring-2 focus:ring-blue-100 font-bold text-sm"
                />
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase mb-1 block">Cargo</label>
                <select 
                  value={userForm.role}
                  onChange={e => setUserForm({...userForm, role: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none focus:ring-2 focus:ring-blue-100 font-bold text-sm"
                >
                  <option value="">Selecione um cargo...</option>
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>{role.description || role.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase mb-1 block">Clientes Vinculados (Supervisores)</label>
                <div className="border border-slate-200 rounded-xl bg-slate-50 p-4 max-h-48 overflow-y-auto grid grid-cols-1 gap-2">
                    {allClients.map(client => (
                        <label key={client.id} className="flex items-center gap-2 text-sm font-bold text-[color:var(--color-text)] cursor-pointer hover:bg-slate-100 p-1 rounded transition-colors">
                            <input 
                                type="checkbox"
                                checked={userForm.clientIds?.includes(client.id)}
                                onChange={(e) => {
                                    const current = userForm.clientIds || [];
                                    if (e.target.checked) {
                                        setUserForm({...userForm, clientIds: [...current, client.id]});
                                    } else {
                                        setUserForm({...userForm, clientIds: current.filter(id => id !== client.id)});
                                    }
                                }}
                                className="rounded text-[var(--primary-color)] focus:ring-[var(--primary-color)] w-4 h-4"
                            />
                            <span className="truncate">{client.tradeName || client.companyName}</span>
                        </label>
                    ))}
                    {allClients.length === 0 && <span className="text-slate-400 text-xs">Nenhum cliente disponível.</span>}
                </div>
                <p className="text-[10px] text-slate-400 mt-1 font-medium">Selecione os clientes que este usuário pode acessar (apenas para Supervisores).</p>
              </div>

              <div className="flex gap-2">
                <button type="submit" className="flex-1 py-3 bg-[var(--primary-color)] text-white rounded-xl font-black shadow-lg hover:opacity-90 transition-all mt-4">
                  {editingUser ? 'Atualizar Usuário' : 'Criar Usuário'}
                </button>
                {editingUser && (
                  <button 
                    type="button" 
                    onClick={resetUserForm}
                    className="flex-1 py-3 bg-slate-100 text-[color:var(--color-muted)] rounded-xl font-black hover:bg-slate-200 transition-all mt-4"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
            <SectionHeader icon={<Users className="text-[var(--primary-color)]" size={22} />} title="Lista de Usuários" />
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-black text-slate-400 uppercase border-b border-slate-100">
                    <th className="pb-3 px-4">Email / Login</th>
                    <th className="pb-3 px-4">Cargo</th>
                    <th className="pb-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map(user => (
                    <tr key={user.id} className="group hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-4 font-bold text-[color:var(--color-text)]">
                        {user.email}
                        {user.employee?.name && <span className="block text-xs text-slate-400 font-normal">{user.employee.name}</span>}
                      </td>
                      <td className="py-4 px-4">
                        <span className="px-3 py-1 rounded-lg bg-blue-50 text-blue-600 text-xs font-black uppercase">
                          {getRoleName(user.roleId)}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => handleEditUser(user)}
                            className="p-2 text-slate-400 hover:text-[var(--primary-color)] hover:bg-blue-50 rounded-lg transition-all"
                            title="Editar usuário"
                          >
                            <Edit size={18} />
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(user.id)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="Excluir usuário"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && !loadingUsers && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400 font-medium">Nenhum usuário encontrado.</td>
                    </tr>
                  )}
                  {loadingUsers && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400 font-medium">Carregando...</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'reasons' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 bg-white rounded-3xl border border-slate-200 p-8 shadow-sm h-fit">
            <SectionHeader icon={<AlertTriangle className="text-[var(--primary-color)]" size={22} />} title={editingIncidentReason ? 'Editar Motivo' : 'Novo Motivo'} />
            <form onSubmit={handleIncidentReasonSubmit} className="mt-6 space-y-4">
              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase mb-1 block">Tipo</label>
                <select
                  value={incidentReasonForm.type}
                  onChange={(e) => setIncidentReasonForm({ ...incidentReasonForm, type: e.target.value as any })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none focus:ring-2 focus:ring-blue-100 font-bold text-sm"
                >
                  <option value="RUPTURE">Ruptura</option>
                  <option value="BREAKAGE">Avaria</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-black text-slate-400 uppercase mb-1 block">Rótulo</label>
                <input
                  type="text"
                  value={incidentReasonForm.label}
                  onChange={(e) => setIncidentReasonForm({ ...incidentReasonForm, label: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none focus:ring-2 focus:ring-blue-100 font-bold text-sm"
                  placeholder="Ex.: Sem reposição"
                />
              </div>

              <label className="flex items-center gap-2 text-sm font-bold text-[color:var(--color-text)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={incidentReasonForm.isActive}
                  onChange={(e) => setIncidentReasonForm({ ...incidentReasonForm, isActive: e.target.checked })}
                  className="rounded text-[var(--primary-color)] focus:ring-[var(--primary-color)] w-4 h-4"
                />
                Ativo
              </label>

              <div className="flex gap-2">
                <button type="submit" className="flex-1 py-3 bg-[var(--primary-color)] text-white rounded-xl font-black shadow-lg hover:opacity-90 transition-all mt-4">
                  {editingIncidentReason ? 'Atualizar' : 'Criar'}
                </button>
                {editingIncidentReason && (
                  <button
                    type="button"
                    onClick={resetIncidentReasonForm}
                    className="flex-1 py-3 border border-slate-200 text-[color:var(--color-muted)] rounded-xl font-black hover:bg-slate-50 transition-all mt-4"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-black text-[color:var(--color-text)]">Motivos</h2>
                <p className="text-[color:var(--color-muted)] text-sm font-medium">Ruptura e Avaria (pré-cadastrado).</p>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={incidentReasonTypeFilter}
                  onChange={(e) => setIncidentReasonTypeFilter(e.target.value as any)}
                  className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 outline-none focus:ring-2 focus:ring-blue-100 font-bold text-sm"
                >
                  <option value="ALL">Todos</option>
                  <option value="RUPTURE">Ruptura</option>
                  <option value="BREAKAGE">Avaria</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-black text-slate-400 uppercase">
                    <th className="pb-3 px-4">Tipo</th>
                    <th className="pb-3 px-4">Motivo</th>
                    <th className="pb-3 px-4">Status</th>
                    <th className="pb-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {incidentReasons.map((r: any) => (
                    <tr key={r.id} className="group hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-4">
                        <span className="px-3 py-1 rounded-lg bg-slate-100 text-[color:var(--color-text)] text-xs font-black uppercase">
                          {r.type === 'BREAKAGE' ? 'Avaria' : 'Ruptura'}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-bold text-[color:var(--color-text)]">{r.label}</td>
                      <td className="py-4 px-4">
                        <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase ${r.isActive ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-[color:var(--color-muted)]'}`}>
                          {r.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEditIncidentReason(r)}
                            className="p-2 text-slate-400 hover:text-[var(--primary-color)] hover:bg-blue-50 rounded-lg transition-all"
                            title="Editar motivo"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleDeleteIncidentReason(r.id)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="Excluir motivo"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {incidentReasons.length === 0 && !loadingIncidentReasons && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400 font-medium">Nenhum motivo encontrado.</td>
                    </tr>
                  )}
                  {loadingIncidentReasons && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400 font-medium">Carregando...</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'branding' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm max-w-2xl">
          <SectionHeader icon={<Palette className="text-[var(--primary-color)]" size={22} />} title="Identidade Visual" />
          
          <form onSubmit={handleBrandingSave} className="mt-8 space-y-6">
            <div>
              <label className="text-[11px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Nome da Empresa (Sistema)</label>
              <input 
                type="text" 
                value={brandingForm.companyName}
                onChange={e => setBrandingForm({...brandingForm, companyName: e.target.value})}
                className="w-full h-12 px-4 rounded-xl bg-slate-50 border border-slate-200 outline-none focus:ring-4 focus:ring-blue-100 transition-all font-bold text-[color:var(--color-text)]"
              />
            </div>
            
            <div>
              <label className="text-[11px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Cor Primária</label>
              <div className="flex items-center gap-4">
                <input 
                  type="color" 
                  value={brandingForm.primaryColor}
                  onChange={e => setBrandingForm({...brandingForm, primaryColor: e.target.value})}
                  className="h-12 w-24 rounded-xl cursor-pointer"
                />
                <span className="font-mono text-[color:var(--color-muted)]">{brandingForm.primaryColor}</span>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Logo da Marca</label>
              <div className="flex flex-col gap-4">
                  {brandingForm.logoUrl && (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 w-fit">
                      <img 
                        src={logoFile ? URL.createObjectURL(logoFile) : getImageUrl(brandingForm.logoUrl)} 
                        alt="Logo Preview" 
                        className="h-12 object-contain" 
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[color:var(--color-muted)] rounded-lg cursor-pointer transition-colors font-bold text-sm">
                          <Upload size={16} />
                          Escolher Arquivo
                          <input 
                              type="file" 
                              accept="image/*"
                              className="hidden"
                              onChange={e => e.target.files && setLogoFile(e.target.files[0])}
                          />
                      </label>
                      {logoFile && <span className="text-sm text-[color:var(--color-muted)]">{logoFile.name}</span>}
                  </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Logo Login */}
                <div>
                    <label className="text-[11px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Logo Login</label>
                    <div className="flex flex-col gap-4">
                        {brandingForm.loginLogoUrl && (
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 w-fit">
                            <img 
                                src={loginLogoFile ? URL.createObjectURL(loginLogoFile) : getImageUrl(brandingForm.loginLogoUrl)} 
                                alt="Login Logo Preview" 
                                className="h-12 object-contain" 
                            />
                            </div>
                        )}
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[color:var(--color-muted)] rounded-lg cursor-pointer transition-colors font-bold text-sm">
                                <Upload size={16} />
                                Arquivo
                                <input 
                                    type="file" 
                                    accept="image/*"
                                    className="hidden"
                                    onChange={e => e.target.files && setLoginLogoFile(e.target.files[0])}
                                />
                            </label>
                            {loginLogoFile && <span className="text-sm text-[color:var(--color-muted)] truncate max-w-[100px]">{loginLogoFile.name}</span>}
                        </div>
                    </div>
                </div>

                {/* Logo Sistema */}
                <div>
                    <label className="text-[11px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Logo Sistema (Header)</label>
                    <div className="flex flex-col gap-4">
                        {brandingForm.systemLogoUrl && (
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 w-fit">
                            <img 
                                src={systemLogoFile ? URL.createObjectURL(systemLogoFile) : getImageUrl(brandingForm.systemLogoUrl)} 
                                alt="System Logo Preview" 
                                className="h-12 object-contain" 
                            />
                            </div>
                        )}
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[color:var(--color-muted)] rounded-lg cursor-pointer transition-colors font-bold text-sm">
                                <Upload size={16} />
                                Arquivo
                                <input 
                                    type="file" 
                                    accept="image/*"
                                    className="hidden"
                                    onChange={e => e.target.files && setSystemLogoFile(e.target.files[0])}
                                />
                            </label>
                            {systemLogoFile && <span className="text-sm text-[color:var(--color-muted)] truncate max-w-[100px]">{systemLogoFile.name}</span>}
                        </div>
                    </div>
                </div>

                {/* Splash Screen */}
                <div>
                    <label className="text-[11px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Logo App Iniciar</label>
                    <div className="flex flex-col gap-4">
                        {brandingForm.splashScreenUrl && (
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 w-fit">
                            <img 
                                src={splashScreenFile ? URL.createObjectURL(splashScreenFile) : getImageUrl(brandingForm.splashScreenUrl)} 
                                alt="Splash Preview" 
                                className="h-12 object-contain" 
                            />
                            </div>
                        )}
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[color:var(--color-muted)] rounded-lg cursor-pointer transition-colors font-bold text-sm">
                                <Upload size={16} />
                                Arquivo
                                <input 
                                    type="file" 
                                    accept="image/*"
                                    className="hidden"
                                    onChange={e => e.target.files && setSplashScreenFile(e.target.files[0])}
                                />
                            </label>
                            {splashScreenFile && <span className="text-sm text-[color:var(--color-muted)] truncate max-w-[100px]">{splashScreenFile.name}</span>}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Favicon */}
                <div>
                    <label className="text-[11px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Favicon (Site)</label>
                    <div className="flex flex-col gap-4">
                        {brandingForm.faviconUrl && (
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 w-fit">
                            <img 
                                src={faviconFile ? URL.createObjectURL(faviconFile) : getImageUrl(brandingForm.faviconUrl)} 
                                alt="Favicon Preview" 
                                className="w-8 h-8 object-contain" 
                            />
                            </div>
                        )}
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[color:var(--color-muted)] rounded-lg cursor-pointer transition-colors font-bold text-sm">
                                <Upload size={16} />
                                Arquivo
                                <input 
                                    type="file" 
                                    accept="image/x-icon,image/png"
                                    className="hidden"
                                    onChange={e => e.target.files && setFaviconFile(e.target.files[0])}
                                />
                            </label>
                            {faviconFile && <span className="text-sm text-[color:var(--color-muted)] truncate max-w-[100px]">{faviconFile.name}</span>}
                        </div>
                    </div>
                </div>

                {/* PWA Icon */}
                <div>
                    <label className="text-[11px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Ícone App (PWA)</label>
                    <div className="flex flex-col gap-4">
                        {brandingForm.pwaIconUrl && (
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 w-fit">
                            <img 
                                src={pwaIconFile ? URL.createObjectURL(pwaIconFile) : getImageUrl(brandingForm.pwaIconUrl)} 
                                alt="PWA Icon Preview" 
                                className="w-12 h-12 object-contain rounded-lg" 
                            />
                            </div>
                        )}
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[color:var(--color-muted)] rounded-lg cursor-pointer transition-colors font-bold text-sm">
                                <Upload size={16} />
                                Arquivo
                                <input 
                                    type="file" 
                                    accept="image/png"
                                    className="hidden"
                                    onChange={e => e.target.files && setPwaIconFile(e.target.files[0])}
                                />
                            </label>
                            {pwaIconFile && <span className="text-sm text-[color:var(--color-muted)] truncate max-w-[100px]">{pwaIconFile.name}</span>}
                        </div>
                    </div>
                </div>

                {/* Site Icon */}
                <div>
                    <label className="text-[11px] font-black text-slate-400 uppercase mb-2 block tracking-widest">Ícone Site (Header)</label>
                    <div className="flex flex-col gap-4">
                        {brandingForm.siteIconUrl && (
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 w-fit">
                            <img 
                                src={siteIconFile ? URL.createObjectURL(siteIconFile) : getImageUrl(brandingForm.siteIconUrl)} 
                                alt="Site Icon Preview" 
                                className="w-12 h-12 object-contain" 
                            />
                            </div>
                        )}
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[color:var(--color-muted)] rounded-lg cursor-pointer transition-colors font-bold text-sm">
                                <Upload size={16} />
                                Arquivo
                                <input 
                                    type="file" 
                                    accept="image/*"
                                    className="hidden"
                                    onChange={e => e.target.files && setSiteIconFile(e.target.files[0])}
                                />
                            </label>
                            {siteIconFile && <span className="text-sm text-[color:var(--color-muted)] truncate max-w-[100px]">{siteIconFile.name}</span>}
                        </div>
                    </div>
                </div>
            </div>

            <div className="pt-6 border-t border-slate-100">
                <label className="text-[11px] font-black text-slate-400 uppercase mb-2 block tracking-widest">
                  Sensibilidade de Foto Borrada (Blur Threshold)
                </label>
                <div className="flex items-center gap-4">
                  <input 
                    type="range" 
                    min="0" 
                    max="20" 
                    step="0.5"
                    value={brandingForm.blurThreshold || 8}
                    onChange={e => setBrandingForm({...brandingForm, blurThreshold: Number(e.target.value)})}
                    className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[var(--primary-color)]"
                  />
                  <div className="flex flex-col items-center min-w-[3rem]">
                    <span className="font-bold text-[color:var(--color-text)] text-lg">{brandingForm.blurThreshold || 8}</span>
                    <span className="text-[10px] text-slate-400 font-medium uppercase">Valor</span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  Ajuste o nível de exigência para fotos borradas. <br/>
                  <span className="font-bold text-[color:var(--color-muted)]">Menor (0-5):</span> Aceita mais fotos (menos rigoroso). <br/>
                  <span className="font-bold text-[color:var(--color-muted)]">Maior (10+):</span> Exige fotos muito nítidas (mais rigoroso). <br/>
                  <span className="font-bold text-[var(--primary-color)]">Recomendado: 8</span>
                </p>
            </div>

            <div className="pt-6 border-t border-slate-100 flex justify-end">
              <button type="submit" className="flex items-center gap-2 bg-[var(--primary-color)] text-white px-8 py-3 rounded-2xl font-black shadow-xl hover:opacity-90 transition-all">
                <Save size={18} /> Salvar Alterações
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'permissions' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
          <SectionHeader icon={<Shield className="text-[var(--primary-color)]" size={22} />} title="Gestão de Acesso" />
          
          <div className="mt-8 space-y-4">
             {roles.map(role => (
               <div key={role.id} className="p-4 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-all flex flex-col gap-4">
                 <div className="flex justify-between items-center w-full">
                   <div>
                     <h3 className="font-black text-[color:var(--color-text)]">{role.name}</h3>
                     <p className="text-xs text-[color:var(--color-muted)] font-bold mt-1">{role.permissions.length} permissões ativas</p>
                   </div>
                   <button 
                    onClick={() => setEditingPermissions(editingPermissions === role.id ? null : role.id)}
                    className="text-[var(--primary-color)] font-bold text-sm hover:underline"
                   >
                     {editingPermissions === role.id ? 'Fechar Edição' : 'Editar Permissões'}
                   </button>
                 </div>
                 
                 {editingPermissions === role.id && (
                   <div className="pt-4 border-t border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-2 animate-in slide-in-from-top-2 duration-200">
                      {['view_dashboard', 'manage_users', 'manage_routes', 'view_reports', 'submit_checklist', 'all'].map(perm => (
                        <label key={perm} className="flex items-center gap-2 text-sm text-[color:var(--color-muted)] font-medium cursor-pointer hover:bg-slate-100 p-2 rounded-lg">
                          <input 
                            type="checkbox" 
                            checked={role.permissions.includes(perm)}
                            onChange={() => togglePermission(role.id, perm)}
                            className="rounded text-[var(--primary-color)] focus:ring-[var(--primary-color)]"
                          />
                          {perm}
                        </label>
                      ))}
                      <div className="col-span-full flex justify-end mt-4">
                        <button 
                          onClick={() => handleSavePermissions(role)}
                          className="px-6 py-2 bg-[var(--primary-color)] text-white rounded-lg font-bold shadow-md hover:opacity-90 transition-all"
                        >
                          Salvar Permissões
                        </button>
                      </div>
                   </div>
                 )}
               </div>
             ))}
             <button 
              onClick={() => alert('Em breve: Criação de novos cargos personalizados.')}
              className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold hover:border-[var(--primary-color)] hover:text-[var(--primary-color)] transition-all"
             >
               + Criar Novo Cargo
             </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminView;
