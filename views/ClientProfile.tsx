import React, { useEffect, useMemo, useState } from 'react';
import { Project, Workspace } from '../types';
import { subscribeToProjects } from '../firebase/services';

interface ClientProfileProps {
  currentWorkspace?: Workspace | null;
  onProjectClick?: (project: Project) => void;
}

export const ClientProfile: React.FC<ClientProfileProps> = ({ currentWorkspace, onProjectClick }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');

  // Gerar URL de avatar do cliente baseado no nome
  const getClientAvatar = (clientName: string) => {
    const seed = clientName.toLowerCase().replace(/\s+/g, '');
    return `https://picsum.photos/seed/${seed}/80/80`;
  };

  // Gerar URL de avatar do projeto baseado no nome do projeto
  const getProjectAvatar = (projectName: string) => {
    const seed = projectName.toLowerCase().replace(/\s+/g, '');
    return `https://picsum.photos/seed/${seed}/80/80`;
  };

  useEffect(() => {
    if (!currentWorkspace?.id) {
      setProjects([]);
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToProjects((fetchedProjects) => {
      const workspaceProjects = fetchedProjects.filter(p => p.workspaceId === currentWorkspace.id);
      setProjects(workspaceProjects);
      setLoading(false);
    }, currentWorkspace.id);

    return () => unsubscribe();
  }, [currentWorkspace?.id]);

  // Filtrar projetos por status
  const filteredProjects = useMemo(() => {
    return projects.filter(project => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'active') return project.status === 'Lead' || project.status === 'Active' || project.status === 'Review';
      if (statusFilter === 'completed') return project.status === 'Completed' || project.status === 'Finished';
      return true;
    });
  }, [projects, statusFilter]);

  const groupedClients = useMemo(() => {
    const groups: Record<string, Project[]> = {};
    filteredProjects.forEach(project => {
      const clientName = (project.client || 'Sem cliente').trim() || 'Sem cliente';
      if (!groups[clientName]) groups[clientName] = [];
      groups[clientName].push(project);
    });

    return Object.entries(groups)
      .map(([client, items]) => ({
        client,
        projects: items.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
          const dateB = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        })
      }))
      .filter(group => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        return (
          group.client.toLowerCase().includes(query) ||
          group.projects.some(p => p.name.toLowerCase().includes(query))
        );
      })
      .sort((a, b) => {
        if (a.client === 'Sem cliente') return 1;
        if (b.client === 'Sem cliente') return -1;
        return a.client.localeCompare(b.client);
      });
  }, [filteredProjects, searchQuery]);

  // Contadores
  const activeCount = projects.filter(p => p.status === 'Lead' || p.status === 'Active' || p.status === 'Review').length;
  const completedCount = projects.filter(p => p.status === 'Completed' || p.status === 'Finished').length;

  const totalClients = groupedClients.length;
  const totalProjects = projects.length;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex flex-wrap justify-between items-end gap-4 mb-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black leading-tight tracking-tight">Clientes</h1>
          <p className="text-slate-500 text-base font-normal">Veja todos os clientes e seus projetos vinculados</p>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-2 px-4 h-10 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold">
            <span className="material-symbols-outlined text-lg text-primary">groups</span>
            {totalClients} clientes
          </div>
          <div className="flex items-center gap-2 px-4 h-10 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold">
            <span className="material-symbols-outlined text-lg text-primary">folder_open</span>
            {totalProjects} projetos
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 mb-8">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[240px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar cliente ou projeto..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-sm font-semibold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none"
            />
          </div>

          {/* Filtro de Status */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Todos
              <span className="ml-1.5 px-1.5 py-0.5 rounded bg-slate-200/50 dark:bg-slate-600/50 text-[10px]">
                {projects.length}
              </span>
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
                statusFilter === 'active'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Ativos
              <span className="ml-1.5 px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 text-[10px]">
                {activeCount}
              </span>
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
                statusFilter === 'completed'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Concluídos
              <span className="ml-1.5 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 text-[10px]">
                {completedCount}
              </span>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : groupedClients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <span className="material-symbols-outlined text-5xl mb-3">group_off</span>
          <p className="text-base font-medium">Nenhum cliente encontrado</p>
          <p className="text-sm">Crie projetos para começar a ver clientes aqui</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {groupedClients.map(({ client, projects: clientProjects }) => {
            // Pegar a foto do cliente do primeiro projeto que tiver avatar
            const clientAvatar = clientProjects.find(p => p.avatar)?.avatar || getClientAvatar(client);
            
            return (
            <div key={client} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  {/* Avatar do Cliente */}
                  <div 
                    className="size-12 rounded-xl bg-slate-200 ring-2 ring-white dark:ring-slate-800 shadow-sm"
                    style={{ 
                      backgroundImage: `url('${clientAvatar}')`, 
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}
                  />
                  <div>
                    <h3 className="text-lg font-bold">{client}</h3>
                    <p className="text-xs text-slate-500">{clientProjects.length} projeto{clientProjects.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Indicador de projetos ativos/concluídos */}
                  {clientProjects.some(p => p.status === 'Active' || p.status === 'Lead' || p.status === 'Review') && (
                    <span className="px-2 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                      {clientProjects.filter(p => p.status === 'Active' || p.status === 'Lead' || p.status === 'Review').length} ativo{clientProjects.filter(p => p.status === 'Active' || p.status === 'Lead' || p.status === 'Review').length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {clientProjects.map(project => (
                  <div 
                    key={project.id} 
                    onClick={() => onProjectClick?.(project)}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 cursor-pointer hover:border-primary/30 hover:bg-primary/5 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      {/* Foto do Projeto */}
                      <div 
                        className="size-8 rounded-lg bg-slate-200"
                        style={{ 
                          backgroundImage: project.projectImage 
                            ? `url('${project.projectImage}')` 
                            : `url('${getProjectAvatar(project.name)}')`, 
                          backgroundSize: 'cover',
                          backgroundPosition: 'center'
                        }}
                      />
                      <div className="flex flex-col gap-0.5">
                        <p className="text-sm font-bold group-hover:text-primary transition-colors">{project.name}</p>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <span className="material-symbols-outlined text-xs">
                            {project.status === 'Completed' || project.status === 'Finished' ? 'check_circle' : 'progress_activity'}
                          </span>
                          <span>{project.type}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={project.status} />
                      <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors">
                        chevron_right
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
          })}
        </div>
      )}
    </div>
  );
};

const StatusBadge: React.FC<{ status: Project['status'] }> = ({ status }) => {
  const styles: Record<Project['status'], string> = {
    Lead: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    Active: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    Review: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    Completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    Finished: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  };

  const labels: Record<Project['status'], string> = {
    Lead: 'Lead',
    Active: 'Ativo',
    Review: 'Revisão',
    Completed: 'Concluído',
    Finished: 'Finalizado',
  };

  return (
    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${styles[status]}`}>
      {labels[status]}
    </span>
  );
};

