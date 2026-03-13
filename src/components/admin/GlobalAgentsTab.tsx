import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { API_URL, getAuthToken } from '@/lib/api';
import { toast } from 'sonner';
import { Bot, Plus, Trash2, Loader2, Pencil, Building2, X } from 'lucide-react';

interface GlobalAgent {
  id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  ai_provider: string;
  ai_model: string;
  ai_api_key?: string;
  system_prompt: string;
  temperature: number;
  max_tokens: number;
  context_window: number;
  custom_fields: any[];
  capabilities: string[];
  handoff_message: string;
  handoff_keywords: string[];
  greeting_message?: string;
  is_active: boolean;
  org_count?: number;
  active_count?: number;
  created_at: string;
}

interface Org {
  id: string;
  name: string;
  slug: string;
}

interface CustomField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select';
  required: boolean;
  placeholder?: string;
  options?: string[];
}

const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getAuthToken()}`
});

export function GlobalAgentsTab() {
  const [agents, setAgents] = useState<GlobalAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<GlobalAgent | null>(null);
  const [orgsDialogOpen, setOrgsDialogOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [allOrgs, setAllOrgs] = useState<Org[]>([]);
  const [assignedOrgIds, setAssignedOrgIds] = useState<string[]>([]);
  const [savingOrgs, setSavingOrgs] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    ai_provider: 'openai',
    ai_model: 'gpt-4o-mini',
    ai_api_key: '',
    system_prompt: 'Você é um assistente virtual profissional.',
    temperature: 0.7,
    max_tokens: 1000,
    context_window: 20,
    greeting_message: '',
    handoff_message: 'Vou transferir você para um atendente humano. Aguarde um momento.',
    handoff_keywords: 'humano,atendente,pessoa',
    is_active: true,
  });
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  const loadAgents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/global-agents/admin/list`, { headers: headers() });
      if (res.ok) setAgents(await res.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  const handleEdit = (agent: GlobalAgent) => {
    setEditingAgent(agent);
    setFormData({
      name: agent.name,
      description: agent.description || '',
      ai_provider: agent.ai_provider,
      ai_model: agent.ai_model,
      ai_api_key: agent.ai_api_key || '',
      system_prompt: agent.system_prompt,
      temperature: agent.temperature,
      max_tokens: agent.max_tokens,
      context_window: agent.context_window,
      greeting_message: agent.greeting_message || '',
      handoff_message: agent.handoff_message,
      handoff_keywords: Array.isArray(agent.handoff_keywords) ? agent.handoff_keywords.join(',') : '',
      is_active: agent.is_active,
    });
    setCustomFields(agent.custom_fields || []);
    setEditorOpen(true);
  };

  const handleCreate = () => {
    setEditingAgent(null);
    setFormData({
      name: '', description: '', ai_provider: 'openai', ai_model: 'gpt-4o-mini',
      ai_api_key: '', system_prompt: 'Você é um assistente virtual profissional.\n\nInformações da empresa:\n- Nome: {{company_name}}\n- Produtos: {{products}}',
      temperature: 0.7, max_tokens: 1000, context_window: 20,
      greeting_message: 'Olá! Sou o assistente virtual. Como posso ajudar?',
      handoff_message: 'Vou transferir você para um atendente humano. Aguarde um momento.',
      handoff_keywords: 'humano,atendente,pessoa', is_active: true,
    });
    setCustomFields([
      { key: 'company_name', label: 'Nome da Empresa', type: 'text', required: true, placeholder: 'Ex: Acme Corp' },
      { key: 'products', label: 'Produtos/Serviços', type: 'textarea', required: false, placeholder: 'Descreva seus produtos...' },
    ]);
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) { toast.error('Nome é obrigatório'); return; }
    setSaving(true);
    try {
      const payload = {
        ...formData,
        handoff_keywords: formData.handoff_keywords.split(',').map(k => k.trim()).filter(Boolean),
        custom_fields: customFields,
      };
      const url = editingAgent
        ? `${API_URL}/api/global-agents/admin/${editingAgent.id}`
        : `${API_URL}/api/global-agents/admin`;
      const res = await fetch(url, {
        method: editingAgent ? 'PATCH' : 'POST',
        headers: headers(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Erro');
      toast.success(editingAgent ? 'Agente atualizado!' : 'Agente criado!');
      setEditorOpen(false);
      loadAgents();
    } catch (err: any) {
      toast.error(err.message);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza? Isso removerá o agente de todas as organizações.')) return;
    try {
      await fetch(`${API_URL}/api/global-agents/admin/${id}`, { method: 'DELETE', headers: headers() });
      toast.success('Agente removido');
      loadAgents();
    } catch { toast.error('Erro ao remover'); }
  };

  const handleOpenOrgs = async (agentId: string) => {
    setSelectedAgentId(agentId);
    try {
      const [orgsRes, assignedRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/organizations`, { headers: headers() }),
        fetch(`${API_URL}/api/global-agents/admin/${agentId}/organizations`, { headers: headers() }),
      ]);
      if (orgsRes.ok) setAllOrgs(await orgsRes.json());
      if (assignedRes.ok) {
        const assigned = await assignedRes.json();
        setAssignedOrgIds(assigned.map((o: any) => o.id));
      }
    } catch { /* ignore */ }
    setOrgsDialogOpen(true);
  };

  const handleSaveOrgs = async () => {
    if (!selectedAgentId) return;
    setSavingOrgs(true);
    try {
      const res = await fetch(`${API_URL}/api/global-agents/admin/${selectedAgentId}/organizations`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify({ organization_ids: assignedOrgIds }),
      });
      if (!res.ok) throw new Error('Erro');
      toast.success('Organizações atualizadas!');
      setOrgsDialogOpen(false);
      loadAgents();
    } catch { toast.error('Erro ao salvar'); }
    finally { setSavingOrgs(false); }
  };

  const toggleOrg = (orgId: string) => {
    setAssignedOrgIds(prev =>
      prev.includes(orgId) ? prev.filter(id => id !== orgId) : [...prev, orgId]
    );
  };

  const addCustomField = () => {
    setCustomFields([...customFields, { key: '', label: '', type: 'text', required: false }]);
  };

  const updateCustomField = (idx: number, field: Partial<CustomField>) => {
    const updated = [...customFields];
    updated[idx] = { ...updated[idx], ...field };
    // Auto-generate key from label
    if (field.label && !customFields[idx].key) {
      updated[idx].key = field.label.toLowerCase().replace(/[^a-z0-9]/g, '_');
    }
    setCustomFields(updated);
  };

  const removeCustomField = (idx: number) => {
    setCustomFields(customFields.filter((_, i) => i !== idx));
  };

  if (loading) {
    return (
      <TabsContent value="global-agents" className="space-y-4">
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      </TabsContent>
    );
  }

  return (
    <TabsContent value="global-agents" className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Agentes IA Globais</h2>
        <Button onClick={handleCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Agente Global
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Crie agentes de IA e disponibilize para organizações. Os clientes podem ativar nas conexões e configurar horários.
      </p>

      {agents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Bot className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum agente global criado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map(agent => (
            <Card key={agent.id}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-base">{agent.name}</CardTitle>
                    {agent.description && <CardDescription className="text-xs">{agent.description}</CardDescription>}
                  </div>
                  <Badge variant={agent.is_active ? 'default' : 'secondary'}>
                    {agent.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{agent.ai_provider}/{agent.ai_model}</span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <Badge variant="outline" className="gap-1">
                    <Building2 className="h-3 w-3" />
                    {agent.org_count || 0} orgs
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Bot className="h-3 w-3" />
                    {agent.active_count || 0} ativas
                  </Badge>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => handleEdit(agent)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => handleOpenOrgs(agent.id)}>
                    <Building2 className="h-3.5 w-3.5 mr-1" /> Orgs
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(agent.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Editor Dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingAgent ? 'Editar' : 'Criar'} Agente Global</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="basic" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid grid-cols-4 shrink-0">
              <TabsTrigger value="basic">Básico</TabsTrigger>
              <TabsTrigger value="ai">IA</TabsTrigger>
              <TabsTrigger value="fields">Campos</TabsTrigger>
              <TabsTrigger value="messages">Mensagens</TabsTrigger>
            </TabsList>
            <div className="flex-1 overflow-y-auto mt-4 space-y-4">
              <TabsContent value="basic" className="m-0 space-y-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="SDR Noturno" />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Agente para atendimento fora do horário comercial" />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={formData.is_active} onCheckedChange={v => setFormData({...formData, is_active: v})} />
                  <Label>Ativo</Label>
                </div>
              </TabsContent>

              <TabsContent value="ai" className="m-0 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Provedor</Label>
                    <Select value={formData.ai_provider} onValueChange={v => setFormData({...formData, ai_provider: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="gemini">Google Gemini</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Modelo</Label>
                    <Input value={formData.ai_model} onChange={e => setFormData({...formData, ai_model: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input type="password" value={formData.ai_api_key} onChange={e => setFormData({...formData, ai_api_key: e.target.value})} placeholder="sk-..." />
                  <p className="text-xs text-muted-foreground">Se vazio, usa a configuração global da organização.</p>
                </div>
                <div className="space-y-2">
                  <Label>System Prompt</Label>
                  <Textarea rows={8} value={formData.system_prompt} onChange={e => setFormData({...formData, system_prompt: e.target.value})}
                    placeholder="Use {{campo}} para injetar valores dos campos personalizados" />
                  <p className="text-xs text-muted-foreground">Use {'{{nome_do_campo}}'} para inserir valores preenchidos pelo cliente.</p>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Temperatura</Label>
                    <Input type="number" step="0.1" min="0" max="2" value={formData.temperature}
                      onChange={e => setFormData({...formData, temperature: parseFloat(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Tokens</Label>
                    <Input type="number" value={formData.max_tokens}
                      onChange={e => setFormData({...formData, max_tokens: parseInt(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Contexto</Label>
                    <Input type="number" value={formData.context_window}
                      onChange={e => setFormData({...formData, context_window: parseInt(e.target.value)})} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="fields" className="m-0 space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <Label>Campos personalizáveis pelo cliente</Label>
                    <p className="text-xs text-muted-foreground">Defina campos que o cliente preencherá (ex: nome da empresa, produtos)</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={addCustomField} className="gap-1">
                    <Plus className="h-3.5 w-3.5" /> Campo
                  </Button>
                </div>

                {customFields.map((field, idx) => (
                  <Card key={idx} className="p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs">Campo {idx + 1}</Label>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeCustomField(idx)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Input placeholder="Label" value={field.label} onChange={e => updateCustomField(idx, { label: e.target.value })} />
                      <Input placeholder="Chave (auto)" value={field.key} onChange={e => updateCustomField(idx, { key: e.target.value })} />
                      <Select value={field.type} onValueChange={v => updateCustomField(idx, { type: v as any })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Texto</SelectItem>
                          <SelectItem value="textarea">Texto longo</SelectItem>
                          <SelectItem value="select">Seleção</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-3">
                      <Input placeholder="Placeholder" value={field.placeholder || ''} onChange={e => updateCustomField(idx, { placeholder: e.target.value })} className="flex-1" />
                      <div className="flex items-center gap-1.5">
                        <Checkbox checked={field.required} onCheckedChange={v => updateCustomField(idx, { required: !!v })} />
                        <Label className="text-xs">Obrigatório</Label>
                      </div>
                    </div>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="messages" className="m-0 space-y-4">
                <div className="space-y-2">
                  <Label>Mensagem de boas-vindas</Label>
                  <Textarea rows={3} value={formData.greeting_message} onChange={e => setFormData({...formData, greeting_message: e.target.value})}
                    placeholder="Olá! Sou o assistente virtual..." />
                </div>
                <div className="space-y-2">
                  <Label>Mensagem de handoff</Label>
                  <Textarea rows={3} value={formData.handoff_message} onChange={e => setFormData({...formData, handoff_message: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Palavras-chave de handoff (separadas por vírgula)</Label>
                  <Input value={formData.handoff_keywords} onChange={e => setFormData({...formData, handoff_keywords: e.target.value})} />
                </div>
              </TabsContent>
            </div>
          </Tabs>
          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingAgent ? 'Salvar' : 'Criar Agente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Organization Assignment Dialog */}
      <Dialog open={orgsDialogOpen} onOpenChange={setOrgsDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Distribuir para Organizações</DialogTitle>
            <DialogDescription>Selecione quais organizações podem usar este agente</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-2">
            {allOrgs.map(org => (
              <div key={org.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer" onClick={() => toggleOrg(org.id)}>
                <Checkbox checked={assignedOrgIds.includes(org.id)} />
                <div>
                  <p className="text-sm font-medium">{org.name}</p>
                  <p className="text-xs text-muted-foreground">{org.slug}</p>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setOrgsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveOrgs} disabled={savingOrgs}>
              {savingOrgs && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar ({assignedOrgIds.length} selecionadas)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TabsContent>
  );
}
