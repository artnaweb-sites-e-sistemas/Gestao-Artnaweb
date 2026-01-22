
import React, { useState, useEffect } from 'react';
import { Project } from '../types';
import { subscribeToProject } from '../firebase/services';

interface ProjectDetailsProps {
  project: Project;
  onNavigate?: (view: string) => void;
  onClose?: () => void;
}

export const ProjectDetails: React.FC<ProjectDetailsProps> = ({ project, onNavigate, onClose }) => {
  const [currentProject, setCurrentProject] = useState<Project>(project);

  // Subscrever atualizações do projeto em tempo real
  useEffect(() => {
    if (!project.id) return;

    const unsubscribe = subscribeToProject(project.id, (updatedProject) => {
      if (updatedProject) {
        setCurrentProject(updatedProject);
      }
    });

    return () => unsubscribe();
  }, [project.id]);

  // Sincronizar projeto inicial
  useEffect(() => {
    setCurrentProject(project);
  }, [project]);

  const formatCurrency = (value?: number) => {
    if (!value) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (date?: string | Date) => {
    if (!date) return 'Não definido';
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(dateObj);
  };

  return (
    <div className="flex h-full">
      <aside className="w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between p-6 overflow-y-auto">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-primary/10 rounded-xl p-2">
                <div 
                  className="size-12 rounded-lg bg-slate-200" 
                  style={{ backgroundImage: `url(${currentProject.avatar})`, backgroundSize: 'cover' }}
                ></div>
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight">{currentProject.name}</h1>
                <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">{currentProject.client}</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <span className={`px-2 py-1 text-[10px] font-bold rounded uppercase ${
                currentProject.status === 'Active' ? 'bg-green-100 text-green-700' :
                currentProject.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                currentProject.status === 'Lead' ? 'bg-amber-100 text-amber-700' :
                'bg-indigo-100 text-indigo-700'
              }`}>
                {currentProject.status === 'Lead' ? 'Proposta Enviada' : 
                 currentProject.status === 'Active' ? 'Em Desenvolvimento' :
                 currentProject.status === 'Completed' ? 'Concluído' : 'Em Revisão'}
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded ${
                currentProject.tagColor === 'amber' ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' :
                currentProject.tagColor === 'blue' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' :
                currentProject.tagColor === 'emerald' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' :
                'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
              }`}>
                {currentProject.type}
              </span>
            </div>
          </div>
          
          <nav className="flex flex-col gap-1">
            <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest mb-2">Gestão</p>
            <NavBtn icon="description" label="Visão Geral" active onClick={() => onNavigate?.('ProjectDetails')} />
            <NavBtn icon="payments" label="Faturamento e Notas" onClick={() => onNavigate?.('ProjectBilling')} />
            <NavBtn icon="rocket_launch" label="Roteiro do Projeto" onClick={() => onNavigate?.('ProjectRoadmap')} />
          </nav>
        </div>
        <button 
          onClick={onClose}
          className="flex w-full cursor-pointer items-center justify-center rounded-lg h-11 px-4 bg-primary text-white text-sm font-bold shadow-lg shadow-primary/20 hover:bg-blue-700 transition-all mt-8"
        >
          Voltar
        </button>
      </aside>

      <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900/10 p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 text-slate-500 mb-4">
            <button 
              onClick={onClose}
              className="flex items-center gap-2 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              <span className="text-xs font-bold uppercase tracking-wider">Painel</span>
            </button>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">/</span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{currentProject.name}</span>
          </div>
          
          <div className="flex flex-wrap justify-between items-end gap-3 border-b border-slate-200 dark:border-slate-800 pb-6 mb-6">
            <div className="flex flex-col gap-1">
              <h1 className="text-3xl font-black leading-tight tracking-tight">Visão Geral do Projeto</h1>
              <p className="text-slate-500 text-sm">Informações e detalhes do projeto</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary">info</span>
                </div>
                <h3 className="text-sm font-bold">Informações do Projeto</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Cliente</p>
                  <p className="text-sm font-semibold">{currentProject.client}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tipo de Serviço</p>
                  <p className="text-sm font-semibold">{currentProject.type}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Status</p>
                  <p className="text-sm font-semibold">
                    {currentProject.status === 'Lead' ? 'Proposta Enviada' : 
                     currentProject.status === 'Active' ? 'Em Desenvolvimento' :
                     currentProject.status === 'Completed' ? 'Concluído' : 'Em Revisão'}
                  </p>
                </div>
                {currentProject.deadline && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Prazo</p>
                    <p className="text-sm font-semibold">{formatDate(currentProject.deadline)}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400">trending_up</span>
                </div>
                <h3 className="text-sm font-bold">Progresso</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Conclusão</p>
                    <p className="text-lg font-black">{currentProject.progress}%</p>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-primary h-full rounded-full transition-all"
                      style={{ width: `${currentProject.progress}%` }}
                    ></div>
                  </div>
                </div>
                {currentProject.budget && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Orçamento</p>
                    <p className="text-lg font-black">{formatCurrency(currentProject.budget)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {currentProject.description && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="size-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">description</span>
                </div>
                <h3 className="text-sm font-bold">Descrição</h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                {currentProject.description}
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

const NavBtn: React.FC<{ icon: string; label: string; active?: boolean; onClick?: () => void }> = ({ icon, label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
      active ? 'bg-primary/10 text-primary font-bold' : 'text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
    }`}
  >
    <span className="material-symbols-outlined text-[20px]">{icon}</span>
    {label}
  </button>
);
