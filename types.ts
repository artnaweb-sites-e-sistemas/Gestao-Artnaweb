
export type ViewState = 
  | 'Dashboard' 
  | 'Tasks' 
  | 'Financial' 
  | 'Documents' 
  | 'Clients' 
  | 'Settings' 
  | 'Timeline'
  | 'ProjectDetails'
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
  status: 'Lead' | 'Active' | 'Completed' | 'Review';
  progress: number;
  tagColor: string;
  avatar: string;
  deadline?: string;
  urgency?: boolean;
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
