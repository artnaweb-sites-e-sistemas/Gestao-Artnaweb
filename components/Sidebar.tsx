
import React from 'react';
import { ViewState } from '../types';

interface SidebarProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
  isOpen: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, isOpen }) => {
  const menuItems: { id: ViewState; label: string; icon: string }[] = [
    { id: 'Dashboard', label: 'Painel', icon: 'dashboard' },
    { id: 'Tasks', label: 'Tarefas', icon: 'check_box' },
    { id: 'Financial', label: 'Financeiro', icon: 'payments' },
    { id: 'Documents', label: 'Documentos', icon: 'description' },
  ];

  const teamItems: { id: ViewState; label: string; icon: string }[] = [
    { id: 'Clients', label: 'Clientes', icon: 'group' },
    { id: 'Settings', label: 'Configurações', icon: 'settings' },
  ];

  if (!isOpen) return null;

  return (
    <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col transition-all">
      <div className="p-6 flex items-center gap-3">
        <div className="bg-primary size-8 rounded flex items-center justify-center text-white">
          <span className="material-symbols-outlined">auto_awesome</span>
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight">CRM Criativo</h1>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest">Workspace da Agência</p>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
              currentView === item.id
                ? 'bg-primary/10 text-primary'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}

        <div className="pt-4 pb-2 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Equipe</div>
        
        {teamItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
              currentView === item.id
                ? 'bg-primary/10 text-primary'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
        
        {/* Additional View for Timeline which wasn't in original sidebar list but exists in UI */}
        <button
          onClick={() => setView('Timeline')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
            currentView === 'Timeline'
              ? 'bg-primary/10 text-primary'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <span className="material-symbols-outlined">calendar_today</span>
          <span>Cronograma</span>
        </button>
      </nav>

      <div className="p-4 mt-auto">
        <button className="w-full flex items-center justify-center gap-2 bg-primary text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
          <span className="material-symbols-outlined text-lg">add</span>
          <span>Novo Projeto</span>
        </button>
      </div>
    </aside>
  );
};
