
export type ViewState = 
  | 'Dashboard' 
  | 'Financial' 
  | 'Clients' 
  | 'Settings' 
  | 'Timeline'
  | 'ProjectDetails'
  | 'ProjectBilling'
  | 'ProjectRoadmap'
  | 'CreateInvoice'
  | 'CreateTask'
  | 'ClientBilling'
  | 'ClientRoadmap'
  | 'ClientActivityLog';

export interface Project {
  id: string;
  name: string;
  client: string;
  description: string;
  type: string; // @deprecated - usar types[] para novos projetos
  types?: string[]; // Array de serviços associados ao projeto
  status: 'Lead' | 'Active' | 'Completed' | 'Review' | 'Finished';
  stageId?: string; // ID da etapa para filtragem correta
  progress: number;
  tagColor: string;
  avatar: string; // Foto do cliente
  projectImage?: string; // Foto do projeto
  deadline?: string;
  maintenanceDate?: string; // Data da Manutenção (para projetos recorrentes em Manutenção)
  reportDate?: string; // Data do Relatório (para projetos recorrentes em Manutenção)
  urgency?: boolean;
  budget?: number;
  recurringAmount?: number; // Valor da mensalidade para projetos recorrentes
  isPaid?: boolean;
  isImplementationPaid?: boolean; // Status de pagamento da implementação (projetos recorrentes)
  isRecurringPaid?: boolean; // Status de pagamento da mensalidade (projetos recorrentes)
  workspaceId?: string;
  createdAt?: Date | any;
  updatedAt?: Date | any;
}

// Helper para obter os tipos de um projeto (compatibilidade com projetos antigos)
export const getProjectTypes = (project: Project): string[] => {
  if (project.types && project.types.length > 0) {
    return project.types;
  }
  return project.type ? [project.type] : [];
};

// Helper para verificar se um projeto pertence a uma categoria
export const projectHasType = (project: Project, typeName: string): boolean => {
  const types = getProjectTypes(project);
  return types.includes(typeName);
};

// Helper para verificar se algum tipo do projeto é recorrente
export const projectHasRecurringType = (project: Project, categories: Category[]): boolean => {
  const types = getProjectTypes(project);
  return types.some(typeName => {
    const category = categories.find(cat => cat.name === typeName);
    return category?.isRecurring || false;
  });
};

export interface Transaction {
  id: string;
  client: string;
  project: string;
  type: string;
  date: string;
  value: number;
  status: 'Paid' | 'Pending' | 'Overdue';
  initials: string;
  color: string;
}

export interface Activity {
  id: string;
  projectId: string;
  text: string;
  icon: string;
  createdAt: Date | any;
  userId?: string;
  userName?: string;
}

export interface TeamMember {
  id: string;
  projectId: string;
  name: string;
  role?: string;
  avatar: string;
  email?: string;
  addedAt: Date | any;
}

export interface Stage {
  id: string;
  title: string;
  status: string;
  order: number;
  progress: number;
  isFixed?: boolean;
  workspaceId?: string;
}

export interface StageTask {
  id: string;
  stageId: string;
  title: string;
  order: number;
  createdAt: Date | any;
}

export interface ProjectStageTask {
  id: string;
  projectId: string;
  stageTaskId: string;
  stageId: string;
  completed: boolean;
  completedAt?: Date | any;
  createdAt: Date | any;
}

export interface ProjectFile {
  id: string;
  projectId: string;
  name: string;
  url: string;
  type: 'image' | 'document' | 'video' | 'other';
  size: number;
  uploadedBy?: string;
  uploadedAt: Date | any;
}

export interface Workspace {
  id: string;
  name: string;
  avatar?: string; // Foto do workspace
  description?: string; // Descrição do workspace
  color?: string; // Cor tema do workspace
  userId?: string; // ID do usuário proprietário
  createdAt: Date | any;
  updatedAt?: Date | any;
}

export interface Category {
  id: string;
  name: string;
  isRecurring?: boolean;
  workspaceId?: string;
  order?: number; // Ordem de exibição das categorias
  createdAt?: Date | any;
}

export interface Invoice {
  id: string;
  projectId: string;
  number: string;
  description: string;
  amount: number;
  date: Date | any;
  status: 'Paid' | 'Pending' | 'Overdue';
  workspaceId?: string;
  createdAt?: Date | any;
  updatedAt?: Date | any;
}
