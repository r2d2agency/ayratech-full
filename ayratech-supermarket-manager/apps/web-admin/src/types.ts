
export interface Client {
  id: string;
  nome: string;
  cnpj?: string;
  logo: string;
  totalProdutos: number;
  status: boolean;
  address?: string;
  city?: string;
  state?: string;
  responsibleName?: string;
  responsibleContact?: string;
  email?: string;
}

export interface Product {
  id: string;
  nome: string;
  sku: string;
  categoria: string;
  clientId: string;
  imagem: string;
}

export interface RouteAssignment {
  id: string;
  promoterId: string;
  data: string;
  periodo: 'Manhã' | 'Tarde' | 'Integral';
  supermarketId: string;
  clientsIds: string[]; // Marcas que ele vai atender nessa visita
  status: 'Pendente' | 'Em Andamento' | 'Concluído';
}

export interface SupermarketData {
  id: string;
  nomeFantasia: string;
  razaoSocial: string;
  cnpj: string;
  redeFranquia: string;
  classificacao: 'Ouro' | 'Prata' | 'Bronze';
  status: boolean;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  nomeGerente: string;
  email: string;
  telefone: string;
  horarioAbertura: string;
  horarioFechamento: string;
  observacoes: string;
  marcasVinculadas: string[];
}

export interface Promoter {
  id: string;
  nome: string;
  status: 'Em Rota' | 'Pausa' | 'Offline';
  ultimaVisita: string;
  totalVisitasHoje: number;
  foto: string;
  lat?: number;
  lng?: number;
  atividadeAtual?: string;
}

export interface SupermarketGroup {
  id: string;
  name: string;
  status: boolean;
}

export type ViewType = 'dashboard' | 'rh_dashboard' | 'client_dashboard' | 'supermarkets_list' | 'supermarket_form' | 'supermarket_groups_list' | 'supermarket_group_form' | 'promoters' | 'clients' | 'products' | 'categories' | 'brands' | 'competitors' | 'routes' | 'live_map' | 'admin' | 'employees' | 'supervisors' | 'app_access' | 'documents' | 'logs' | 'reports_routes' | 'reports_evidence' | 'gallery' | 'time_clock' | 'photo_processing' | 'ai_config' | 'ai_prompts' | 'checklist_templates' | 'stock_approvals' | 'breakages_report';

export const INITIAL_DATA: SupermarketData = {
  id: '',
  fantasyName: '',
  cnpj: '',
  classification: 'Ouro',
  status: true,
  zipCode: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
};
