
export type ViewState = 
  | 'Dashboard' 
  | 'Tasks' 
  | 'Financial' 
  | 'Documents' 
  | 'Clients' 
  | 'Settings' 
  | 'Timeline';

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
