
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
  userEmail?: string | null;
  theme?: 'light' | 'dark';
  permissions?: {
    canView: (module: string) => boolean;
  } | null;
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
  userEmail,
  theme,
  permissions
}) => {
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [showAddWorkspace, setShowAddWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(null);
  const [workspaceSearch, setWorkspaceSearch] = useState('');
  const currentWorkspaceRef = useRef(currentWorkspace);
  const isInitialLoadRef = useRef(true);

  // Helper para iniciais do workspace
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Filtragem de workspaces
  const filteredWorkspaces = workspaces.filter(w =>
    w.name.toLowerCase().includes(workspaceSearch.toLowerCase())
  );

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
        // Sincronizar se houver qualquer mudança relevante (nome ou avatar)
        if (updatedWorkspace && (
          updatedWorkspace.name !== current.name ||
          updatedWorkspace.avatar !== current.avatar
        )) {
          onWorkspaceChange(updatedWorkspace);
        }
      }
    }, userId, userEmail);
    return () => unsubscribe();
  }, [userId, userEmail, onWorkspaceChange, onWorkspacesChange]);

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

  const menuItems: { id: ViewState; label: string; icon: string; requiredPermission?: string }[] = [
    { id: 'Dashboard', label: 'Painel', icon: 'dashboard', requiredPermission: 'pipeline' }, // Dashboard sempre visível ou atrelado ao pipeline? Vamos assumir que pipeline 'none' = sem acesso a projetos
    { id: 'Timeline', label: 'Cronograma', icon: 'calendar_month', requiredPermission: 'timeline' },
    { id: 'Financial', label: 'Financeiro', icon: 'payments', requiredPermission: 'financial' },
    { id: 'Clients', label: 'Clientes', icon: 'group', requiredPermission: 'clients' },
    { id: 'Settings', label: 'Configurações', icon: 'settings', requiredPermission: 'settings' },
  ];

  if (!isOpen) return null;

  return (
    <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col transition-all z-20">
      {/* Premium Workspace Switcher Trigger */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800/50">
        <div className="relative">
          <button
            onClick={() => {
              setShowWorkspaceMenu(!showWorkspaceMenu);
              setWorkspaceSearch('');
            }}
            className={`w-full flex items-center gap-3 p-2 rounded-2xl transition-all hover:bg-slate-100 dark:hover:bg-slate-800 group ${showWorkspaceMenu ? 'bg-slate-100 dark:bg-slate-800 shadow-sm' : ''}`}
          >
            {currentWorkspace?.avatar ? (
              <div
                className="size-10 rounded-xl shadow-lg shadow-primary/20 rotate-3 group-hover:rotate-0 transition-transform flex-shrink-0 bg-cover bg-center"
                style={{ backgroundImage: `url("${currentWorkspace.avatar}")` }}
              />
            ) : (
              <div className="size-10 rounded-xl bg-primary flex items-center justify-center text-white text-xs font-black shadow-lg shadow-primary/20 rotate-3 group-hover:rotate-0 transition-transform flex-shrink-0">
                {currentWorkspace ? getInitials(currentWorkspace.name) : <span className="material-symbols-outlined text-[20px]">auto_awesome</span>}
              </div>
            )}
            <div className="flex-1 text-left min-w-0 pr-1">
              <h2 className="text-xs font-black text-slate-900 dark:text-white truncate leading-tight">
                {currentWorkspace?.name || 'Carregando...'}
              </h2>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Workspace</span>
                <span className="material-symbols-outlined text-xs text-slate-400 group-hover:text-primary transition-colors">unfold_more</span>
              </div>
            </div>
          </button>

          {/* Premium Dropdown Menu */}
          {showWorkspaceMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowWorkspaceMenu(false)} />
              <div className="absolute top-full left-0 mt-2 w-72 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl z-40 p-3 animate-[slideUp_0.2s_ease-out] overflow-hidden">
                {/* Search Header */}
                <div className="relative mb-3 group px-1">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg group-focus-within:text-primary transition-colors">search</span>
                  <input
                    type="text"
                    value={workspaceSearch}
                    onChange={(e) => setWorkspaceSearch(e.target.value)}
                    placeholder="Buscar workspace..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-slate-400"
                    autoFocus
                  />
                </div>

                <div className="max-h-72 overflow-y-auto custom-scrollbar px-1 space-y-1">
                  <div className="px-2 mb-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Meus Workspaces</span>
                  </div>

                  {filteredWorkspaces.map((workspace) => {
                    const isActive = currentWorkspace?.id === workspace.id;
                    return (
                      <button
                        key={workspace.id}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all group/item ${isActive
                          ? 'bg-primary/10 text-primary shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        onClick={() => {
                          onWorkspaceChange(workspace);
                          setShowWorkspaceMenu(false);
                        }}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {workspace.avatar ? (
                            <div
                              className="size-8 rounded-lg flex-shrink-0 bg-cover bg-center shadow-sm"
                              style={{ backgroundImage: `url("${workspace.avatar}")` }}
                            />
                          ) : (
                            <div className={`size-8 rounded-lg flex items-center justify-center text-[10px] font-black transition-all ${isActive
                              ? 'bg-primary text-white shadow-md shadow-primary/20'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover/item:bg-primary/20 group-hover/item:text-primary'
                              }`}>
                              {getInitials(workspace.name)}
                            </div>
                          )}
                          <div className="text-left min-w-0">
                            <p className="text-xs font-bold truncate">{workspace.name}</p>
                            {isActive && <p className="text-[9px] font-bold text-primary/70">Ativo agora</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isActive && (
                            <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onWorkspaceChange(workspace);
                              setView('Settings');
                              setShowWorkspaceMenu(false);
                            }}
                            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-primary transition-colors"
                            title="Configurações do Workspace"
                          >
                            <span className="material-symbols-outlined text-lg">settings</span>
                          </button>
                        </div>
                      </button>
                    );
                  })}

                  {filteredWorkspaces.length === 0 && (
                    <div className="text-center py-6">
                      <p className="text-xs text-slate-400 italic">Nenhum workspace encontrado</p>
                    </div>
                  )}

                  <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800/50">
                    <button
                      onClick={() => { setShowAddWorkspace(true); setShowWorkspaceMenu(false); }}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-primary hover:text-white transition-all text-xs font-bold text-primary group"
                    >
                      <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                        <span className="material-symbols-outlined text-lg">add</span>
                      </div>
                      Criar Novo Workspace
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1.5 mt-2">
        {menuItems.filter(item => !item.requiredPermission || !permissions || permissions.canView(item.requiredPermission)).map((item) => {
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
