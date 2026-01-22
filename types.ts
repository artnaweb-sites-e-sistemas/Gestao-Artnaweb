
export type ViewState = 
  | 'Dashboard' 
  | 'Tasks' 
  | 'Financial' 
  | 'Documents' 
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
  type: string;
  status: 'Lead' | 'Active' | 'Completed' | 'Review' | 'Finished';
  stageId?: string; // ID da etapa para filtragem correta
  progress: number;
  tagColor: string;
  avatar: string;
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
