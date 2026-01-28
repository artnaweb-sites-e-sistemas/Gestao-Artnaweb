
import React, { useState, useEffect, useRef } from 'react';
import { ViewState, Workspace } from '../types';
import { subscribeToWorkspaces, addWorkspace, deleteWorkspace } from '../firebase/services';

interface SidebarProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
  isOpen: boolean;
  onCreateProject?: () => void;
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  onWorkspaceChange: (workspace: Workspace | null) => void;
  onWorkspacesChange: (workspaces: Workspace[]) => void;
  userId?: string | null;
  theme?: 'light' | 'dark';
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  setView,
  isOpen,
  onCreateProject,
  currentWorkspace,
  workspaces,
  onWorkspaceChange,
  onWorkspacesChange,
  userId,
  theme
}) => {
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [showAddWorkspace, setShowAddWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(null);
  const currentWorkspaceRef = useRef(currentWorkspace);
  const isInitialLoadRef = useRef(true);

  // ... (Efeitos e handlers permanecem iguais para manter funcionalidade)
  useEffect(() => {
    currentWorkspaceRef.current = currentWorkspace;
  }, [currentWorkspace]);

  useEffect(() => {
    if (!userId) return;
    const unsubscribe = subscribeToWorkspaces((fetchedWorkspaces) => {
      onWorkspacesChange(fetchedWorkspaces);
      const current = currentWorkspaceRef.current;
      if (fetchedWorkspaces.length === 0 && isInitialLoadRef.current) {
        isInitialLoadRef.current = false;
        addWorkspace({ name: 'Workspace da Agência' }, userId).catch(console.error);
        return;
      }
      if (fetchedWorkspaces.length > 0) isInitialLoadRef.current = false;
      if (!current && fetchedWorkspaces.length > 0) {
        onWorkspaceChange(fetchedWorkspaces[0]);
        return;
      }
      if (current && fetchedWorkspaces.length > 0) {
        const workspaceExists = fetchedWorkspaces.find(w => w.id === current.id);
        if (!workspaceExists) {
          onWorkspaceChange(fetchedWorkspaces[0]);
          return;
        }
        const updatedWorkspace = fetchedWorkspaces.find(w => w.id === current.id);
        if (updatedWorkspace && updatedWorkspace.name !== current.name) {
          onWorkspaceChange(updatedWorkspace);
        }
      }
    }, userId);
    return () => unsubscribe();
  }, [userId]);

  const handleAddWorkspace = async () => {
    if (!newWorkspaceName.trim()) return;
    const workspaceName = newWorkspaceName.trim();
    setNewWorkspaceName('');
    setShowAddWorkspace(false);
    try {
      const id = await addWorkspace({ name: workspaceName }, userId);
      onWorkspaceChange({ id, name: workspaceName, createdAt: new Date() });
    } catch (error) {
      console.error('Error adding workspace:', error);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!workspaceToDelete || workspaces.length <= 1) return;
    const workspaceId = workspaceToDelete.id;
    setWorkspaceToDelete(null);
    try {
      await deleteWorkspace(workspaceId);
      if (currentWorkspace?.id === workspaceId) {
        const remainingWorkspaces = workspaces.filter(w => w.id !== workspaceId);
        onWorkspaceChange(remainingWorkspaces.length > 0 ? remainingWorkspaces[0] : null);
      }
    } catch (error) {
      console.error('Error deleting workspace:', error);
    }
  };

  const menuItems: { id: ViewState; label: string; icon: string }[] = [
    { id: 'Dashboard', label: 'Painel', icon: 'dashboard' },
    { id: 'Timeline', label: 'Cronograma', icon: 'calendar_month' },
    { id: 'Financial', label: 'Financeiro', icon: 'payments' },
    { id: 'Clients', label: 'Clientes', icon: 'group' },
    { id: 'Settings', label: 'Configurações', icon: 'settings' },
  ];

  if (!isOpen) return null;

  return (
    <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col transition-all z-20">
      <div className="p-8 flex items-center gap-4">
        <div className="bg-primary size-10 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/30 rotate-3">
          <span className="material-symbols-outlined text-[24px]">auto_awesome</span>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-black tracking-tight font-display text-slate-900 dark:text-white">CRM PRO</h1>
          <div className="relative">
            <button
              onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
              className="text-[10px] text-slate-500 font-bold uppercase tracking-widest hover:text-primary transition-colors flex items-center gap-1 group"
            >
              <span className="truncate max-w-[100px]">{currentWorkspace?.name || 'Workspace'}</span>
              <span className="material-symbols-outlined text-xs transition-transform group-hover:translate-y-0.5">expand_more</span>
            </button>

            {showWorkspaceMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowWorkspaceMenu(false)} />
                <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl z-20 p-2 animate-fade-in overflow-hidden">
                  <div className="max-h-64 overflow-y-auto custom-scrollbar">
                    {workspaces.map((workspace) => (
                      <div
                        key={workspace.id}
                        className={`flex items-center justify-between p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-all ${currentWorkspace?.id === workspace.id ? 'bg-primary/5 text-primary' : 'text-slate-600 dark:text-slate-400'
                          }`}
                        onClick={() => {
                          onWorkspaceChange(workspace);
                          setShowWorkspaceMenu(false);
                        }}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`size-2 rounded-full ${currentWorkspace?.id === workspace.id ? 'bg-primary animate-pulse' : 'bg-slate-300'}`} />
                          <span className="text-xs font-bold truncate">{workspace.name}</span>
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => { setShowAddWorkspace(true); setShowWorkspaceMenu(false); }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-primary mt-1 border-t border-slate-50 dark:border-slate-800"
                    >
                      <span className="material-symbols-outlined text-lg">add_circle</span>
                      Novo Workspace
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1.5 mt-2">
        {menuItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-bold relative group ${isActive
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              <span className={`material-symbols-outlined text-[20px] transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}`}>
                {item.icon}
              </span>
              <span>{item.label}</span>
              {isActive && (
                <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-white/50" />
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-6">
        <button
          onClick={onCreateProject}
          className="w-full h-12 flex items-center justify-center gap-3 bg-slate-900 dark:bg-slate-800 text-white dark:text-slate-200 border border-transparent dark:border-slate-700/50 rounded-2xl text-sm font-black hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl dark:shadow-black/20 active:opacity-90"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          <span>CRIAR PROJETO</span>
        </button>
      </div>

      {/* Modals mantidos com estilos refinados */}
      {showAddWorkspace && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-md shadow-2xl overflow-hidden p-8">
            <h3 className="text-xl font-black mb-1">Novo Workspace</h3>
            <p className="text-sm text-slate-500 mb-8 font-medium">Como se chama sua nova área de trabalho?</p>
            <input
              type="text"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              className="w-full px-5 py-4 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary outline-none transition-all mb-8"
              placeholder="Ex: Artnaweb Brasil"
              autoFocus
            />
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowAddWorkspace(false)}
                className="px-6 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddWorkspace}
                disabled={!newWorkspaceName.trim()}
                className="px-8 py-3 text-sm font-black bg-primary text-white rounded-xl hover:opacity-90 transition-all disabled:opacity-50"
              >
                CRIAR
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
