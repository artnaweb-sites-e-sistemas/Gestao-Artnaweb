
import React from 'react';
import { Project } from '../types';

const pipelineProjects: Project[] = [
  {
    id: '1',
    name: 'TechStart Inc.',
    client: 'TechStart Inc.',
    description: 'Refresh completo de identidade de marca e documentação de diretrizes.',
    type: 'Identidade Visual',
    status: 'Lead',
    progress: 0,
    tagColor: 'amber',
    avatar: 'https://picsum.photos/seed/tech/40/40',
    deadline: 'Follow up 2d'
  },
  {
    id: '2',
    name: 'Solar Solutions',
    client: 'Solar Solutions',
    description: 'Landing page corporativa para nova linha de produtos solares.',
    type: 'Redesign Web',
    status: 'Lead',
    progress: 0,
    tagColor: 'blue',
    avatar: 'https://picsum.photos/seed/solar/40/40',
    urgency: true
  },
  {
    id: '3',
    name: 'Global Logistics',
    client: 'Global Logistics',
    description: 'Sistema ERP personalizado para rastreamento de armazém.',
    type: 'App Dev',
    status: 'Active',
    progress: 65,
    tagColor: 'emerald',
    avatar: 'https://picsum.photos/seed/global/40/40'
  },
  {
    id: '4',
    name: 'FinEdge Banking',
    client: 'FinEdge Banking',
    description: 'Interface de dashboard bancário de próxima geração.',
    type: 'SaaS UI Kit',
    status: 'Review',
    progress: 90,
    tagColor: 'indigo',
    avatar: 'https://picsum.photos/seed/finedge/40/40'
  }
];

export const Dashboard: React.FC = () => {
  return (
    <div className="flex flex-col h-full">
      <div className="px-8 py-6 bg-white dark:bg-slate-900/50">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Pipeline de Clientes</h2>
            <p className="text-sm text-slate-500">Gerencie seu fluxo de trabalho criativo</p>
          </div>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <button className="px-4 py-1.5 text-xs font-semibold rounded-md bg-white dark:bg-slate-700 shadow-sm">Quadro</button>
            <button className="px-4 py-1.5 text-xs font-semibold rounded-md text-slate-500">Lista</button>
            <button className="px-4 py-1.5 text-xs font-semibold rounded-md text-slate-500">Cronograma</button>
          </div>
        </div>
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-8">
          <a className="border-b-2 border-primary text-primary pb-3 text-sm font-semibold" href="#">Todos os Projetos</a>
          <a className="border-b-2 border-transparent text-slate-500 pb-3 text-sm font-semibold hover:text-slate-800" href="#">Web Design</a>
          <a className="border-b-2 border-transparent text-slate-500 pb-3 text-sm font-semibold hover:text-slate-800" href="#">App Dev</a>
          <a className="border-b-2 border-transparent text-slate-500 pb-3 text-sm font-semibold hover:text-slate-800" href="#">Identidade Visual</a>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto p-8 bg-slate-50 dark:bg-slate-900/20">
        <div className="flex gap-6 h-full min-w-max">
          <Column title="Leads (Proposta Enviada)" count={3} projects={pipelineProjects.filter(p => p.status === 'Lead')} />
          <Column title="Desenvolvimento Ativo" count={4} projects={pipelineProjects.filter(p => p.status === 'Active')} isActive />
          <Column title="Projetos Concluídos" count={82} projects={pipelineProjects.filter(p => p.status === 'Completed')} />
        </div>
      </div>
    </div>
  );
};

const Column: React.FC<{ title: string; count: number; projects: Project[]; isActive?: boolean }> = ({ title, count, projects, isActive }) => (
  <div className="w-80 flex flex-col gap-4">
    <div className="flex items-center justify-between px-1">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">{title}</h3>
        <span className={`${isActive ? 'bg-primary/10 text-primary' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'} px-2 py-0.5 rounded-full text-[10px] font-bold`}>{count}</span>
      </div>
      <button className="material-symbols-outlined text-slate-400 hover:text-primary transition-colors">more_horiz</button>
    </div>
    <div className="flex-1 space-y-4">
      {projects.map(project => (
        <Card key={project.id} project={project} />
      ))}
      {title === "Projetos Concluídos" && (
        <button className="w-full py-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-center gap-2 text-slate-400 hover:border-primary hover:text-primary transition-all">
          <span className="material-symbols-outlined">add</span>
          <span className="text-xs font-bold uppercase tracking-wider">Arquivar Novo</span>
        </button>
      )}
    </div>
  </div>
);

const Card: React.FC<{ project: Project }> = ({ project }) => (
  <div className={`bg-white dark:bg-slate-900 p-4 rounded-xl border ${project.status === 'Active' ? 'border-l-4 border-l-primary' : ''} border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow cursor-pointer group`}>
    <div className="flex justify-between items-start mb-3">
      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded ${
        project.tagColor === 'amber' ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' :
        project.tagColor === 'blue' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' :
        project.tagColor === 'emerald' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' :
        'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
      }`}>
        {project.type}
      </span>
      {project.status === 'Active' ? (
        <div className="bg-primary size-2 rounded-full animate-pulse"></div>
      ) : (
        <span className="material-symbols-outlined text-slate-300 group-hover:text-slate-500 transition-colors">edit</span>
      )}
    </div>
    <h4 className="font-bold text-slate-900 dark:text-white text-base mb-1">{project.name}</h4>
    <p className="text-xs text-slate-500 mb-3 line-clamp-2">{project.description}</p>
    
    {project.progress > 0 && (
      <div className="space-y-1.5 mb-4">
        <div className="flex justify-between text-[10px] font-bold text-slate-400">
          <span>{project.status === 'Active' ? 'Fase de Codificação' : 'Testes'}</span>
          <span>{project.progress}%</span>
        </div>
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
          <div className={`h-full ${project.tagColor === 'emerald' ? 'bg-emerald-500' : 'bg-primary'}`} style={{ width: `${project.progress}%` }}></div>
        </div>
      </div>
    )}

    <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-50 dark:border-slate-800">
      <div className="flex -space-x-2">
        <div className="size-6 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200" style={{ backgroundImage: `url(${project.avatar})`, backgroundSize: 'cover' }}></div>
      </div>
      {project.urgency ? (
        <div className="flex items-center gap-1 text-rose-500">
          <span className="material-symbols-outlined text-sm">priority_high</span>
          <span className="text-[10px] font-bold">Urgente</span>
        </div>
      ) : project.deadline ? (
        <div className="flex items-center gap-1 text-slate-400">
          <span className="material-symbols-outlined text-sm">schedule</span>
          <span className="text-[10px] font-medium">{project.deadline}</span>
        </div>
      ) : null}
    </div>
  </div>
);
