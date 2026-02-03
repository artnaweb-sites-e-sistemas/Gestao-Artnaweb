
import React, { useState, useCallback, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './views/Dashboard';
import { Financial } from './views/Financial';
import { Timeline } from './views/Timeline';
import { Settings } from './views/Settings';
import { ClientProfile } from './views/ClientProfile';
import { ProjectDetails } from './views/ProjectDetails';
import { CreateInvoice } from './views/CreateInvoice';
import { CreateTask } from './views/CreateTask';
import { ClientBilling } from './views/ClientBilling';
import { ClientRoadmap } from './views/ClientRoadmap';
import { ClientActivityLog } from './views/ClientActivityLog';
import { ProjectBilling } from './views/ProjectBilling';
import { ProjectRoadmap } from './views/ProjectRoadmap';
import { Login } from './views/Login';
import { ViewState, Project, Workspace } from './types';
import { getProjects, onAuthStateChange, signOut } from './firebase/services';
import { useAccessControl } from './hooks/useAccessControl';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ViewState>('Dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [previousView, setPreviousView] = useState<ViewState>('Dashboard');
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [dashboardInitialFilter, setDashboardInitialFilter] = useState<string | undefined>(undefined);
  const [dashboardHighlightedProjectId, setDashboardHighlightedProjectId] = useState<string | undefined>(undefined);
  const [dashboardSearchQuery, setDashboardSearchQuery] = useState<string>('');
  const [openAddProjectModal, setOpenAddProjectModal] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || savedTheme === 'light') return savedTheme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // Controle de Acesso
  const { permissions } = useAccessControl({ user, workspace: currentWorkspace });

  // Observar estado de autenticação
  useEffect(() => {
    const unsubscribe = onAuthStateChange((currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Efeito para persistência do tema e aplicação da classe dark
  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  }, []);

  const handleWorkspaceChange = useCallback((workspace: Workspace | null) => {
    console.log('Mudando workspace para:', workspace);
    setCurrentWorkspace(workspace);
    // Salvar o último workspace acessado no localStorage
    if (workspace && user) {
      const storageKey = `lastWorkspace_${user.uid}`;
      localStorage.setItem(storageKey, workspace.id);
    }
  }, [user]);

  const handleWorkspacesChange = useCallback((newWorkspaces: Workspace[]) => {
    console.log('Atualizando lista de workspaces:', newWorkspaces.length);
    setWorkspaces(newWorkspaces);
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  const navigateToView = useCallback((view: ViewState, project?: Project) => {
    if (view !== currentView) {

      // Verificação de permissão
      if (permissions) {
        if (view === 'Financial' && !permissions.canView('financial')) return;
        if (view === 'Timeline' && !permissions.canView('timeline')) return;
        if (view === 'Clients' && !permissions.canView('clients')) return;
        if (view === 'Settings' && !permissions.canView('settings')) return;
        if (view === 'Dashboard' && !permissions.canView('pipeline')) return;
      }

      // Se estiver navegando entre views de projeto, mantém o previousView como ProjectDetails
      if (currentView === 'ProjectDetails' || currentView === 'ProjectBilling' || currentView === 'ProjectRoadmap') {
        if (view === 'ProjectDetails' || view === 'ProjectBilling' || view === 'ProjectRoadmap') {
          // Mantém o previousView atual (não muda)
        } else {
          setPreviousView(currentView);
        }
      } else {
        setPreviousView(currentView);
      }
    }
    setCurrentView(view);
    if (project) {
      setSelectedProject(project);
    }
  }, [currentView]);

  const goBack = useCallback(() => {
    // Se estiver em uma view de projeto (Billing ou Roadmap), volta para ProjectDetails
    if (currentView === 'ProjectBilling' || currentView === 'ProjectRoadmap') {
      setCurrentView('ProjectDetails');
    } else {
      setCurrentView(previousView);
      setSelectedProject(null);
    }
    // Limpar filtros de busca
    setDashboardInitialFilter(undefined);
    setDashboardHighlightedProjectId(undefined);
  }, [previousView, currentView]);

  const handleSearch = useCallback(async (query: string) => {
    setDashboardSearchQuery(query);
    if (query.trim()) {
      setCurrentView('Dashboard');
      // Limpar filtros de categoria para permitir busca global
      setDashboardInitialFilter(undefined);
      setDashboardHighlightedProjectId(undefined);
    }
  }, []);

  const handleCreateProject = useCallback(() => {
    if (permissions && !permissions.canEdit('pipeline')) {
      setToast({ message: 'Você não tem permissão para criar projetos.', type: 'error' });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    setOpenAddProjectModal(true);
    setCurrentView('Dashboard');
  }, [permissions]);

  const renderView = () => {
    switch (currentView) {
      case 'Dashboard': return <Dashboard
        onProjectClick={(project) => navigateToView('ProjectDetails', project)}
        currentWorkspace={currentWorkspace}
        initialFilter={dashboardInitialFilter}
        highlightedProjectId={dashboardHighlightedProjectId}
        openAddProjectModal={openAddProjectModal}
        onAddProjectModalClose={() => setOpenAddProjectModal(false)}
        userId={user?.uid}
        searchQuery={dashboardSearchQuery}
        canEdit={permissions?.canEdit('pipeline')}
      />;
      case 'Financial': return <Financial
        currentWorkspace={currentWorkspace}
        onCreateInvoice={() => navigateToView('CreateInvoice')}
        onProjectClick={(project) => navigateToView('ProjectDetails', project)}
        canEdit={permissions?.canEdit('financial')}
      />;
      case 'Timeline': return <Timeline currentWorkspace={currentWorkspace} onProjectClick={(project) => navigateToView('ProjectDetails', project)} />;
      case 'Settings': return <Settings
        currentWorkspace={currentWorkspace}
        onWorkspaceUpdate={(updatedWorkspace) => {
          setWorkspaces(prev => prev.map(w => w.id === updatedWorkspace.id ? updatedWorkspace : w));
          if (currentWorkspace?.id === updatedWorkspace.id) {
            setCurrentWorkspace(updatedWorkspace);
          }
        }}
        userId={user?.uid}
        canEdit={permissions?.canEdit('settings')}
      />;
      case 'Clients': return <ClientProfile
        currentWorkspace={currentWorkspace}
        onProjectClick={(project) => navigateToView('ProjectDetails', project)}
      />;
      case 'ProjectDetails': return selectedProject ? (
        <ProjectDetails
          project={selectedProject}
          onClose={goBack}
          onNavigate={(view) => navigateToView(view as ViewState, selectedProject)}
          canEdit={permissions?.canEdit('pipeline')}
          canViewFinancial={permissions?.canView('financial')}
          currentWorkspace={currentWorkspace}
        />
      ) : <Dashboard onProjectClick={(project) => navigateToView('ProjectDetails', project)} />;
      case 'ProjectBilling': return selectedProject ? (
        <ProjectBilling
          project={selectedProject}
          onClose={goBack}
          onNavigate={(view) => navigateToView(view as ViewState, selectedProject)}
        />
      ) : <Dashboard onProjectClick={(project) => navigateToView('ProjectDetails', project)} />;
      case 'ProjectRoadmap': return selectedProject ? (
        <ProjectRoadmap
          project={selectedProject}
          onClose={goBack}
          onNavigate={(view) => navigateToView(view as ViewState, selectedProject)}
        />
      ) : <Dashboard onProjectClick={(project) => navigateToView('ProjectDetails', project)} />;
      case 'CreateInvoice': return <CreateInvoice onClose={goBack} />;
      case 'CreateTask': return <CreateTask onClose={goBack} />;
      case 'ClientBilling': return <ClientBilling onNavigate={(view) => navigateToView(view as ViewState)} />;
      case 'ClientRoadmap': return <ClientRoadmap onNavigate={(view) => navigateToView(view as ViewState)} />;
      case 'ClientActivityLog': return <ClientActivityLog onNavigate={(view) => navigateToView(view as ViewState)} />;
      default: return <Dashboard onProjectClick={(project) => navigateToView('ProjectDetails', project)} />;
    }
  };

  // Tela de carregamento
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="bg-primary size-16 rounded-2xl flex items-center justify-center text-white animate-pulse">
            <span className="material-symbols-outlined text-3xl">auto_awesome</span>
          </div>
          <div className="size-8 border-2 border-slate-700 border-t-primary rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  // Tela de login
  if (!user) {
    return <Login onLoginSuccess={() => { }} />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background-light dark:bg-background-dark">
      <Sidebar
        currentView={currentView}
        setView={(view) => navigateToView(view)}
        isOpen={isSidebarOpen}
        onCreateProject={handleCreateProject}
        currentWorkspace={currentWorkspace}
        workspaces={workspaces}
        onWorkspaceChange={handleWorkspaceChange}
        onWorkspacesChange={setWorkspaces}
        userId={user.uid}
        userEmail={user.email}
        theme={theme}
        permissions={permissions}
      />


      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          onToggleSidebar={toggleSidebar}
          onSearch={handleSearch}
          currentWorkspace={currentWorkspace}
          user={user}
          onLogout={handleLogout}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        <main className="flex-1 overflow-y-auto bg-background-light dark:bg-background-dark">
          {renderView()}
        </main>
      </div>

      {/* Toast Notification */}
      {
        toast && (
          <div className="fixed top-4 right-4 z-[60] animate-[slideIn_0.3s_ease-out]">
            <div className={`flex items-center gap-3 px-5 py-4 rounded-xl shadow-xl border backdrop-blur-sm min-w-[360px] max-w-[480px] ${toast.type === 'success'
              ? 'bg-white/95 dark:bg-slate-900/95 border-emerald-200 dark:border-emerald-800/50'
              : toast.type === 'error'
                ? 'bg-white/95 dark:bg-slate-900/95 border-red-200 dark:border-red-800/50'
                : 'bg-white/95 dark:bg-slate-900/95 border-amber-200 dark:border-amber-800/50'
              }`}>
              <div className={`flex-shrink-0 size-10 rounded-full flex items-center justify-center ${toast.type === 'success'
                ? 'bg-emerald-100 dark:bg-emerald-900/30'
                : toast.type === 'error'
                  ? 'bg-red-100 dark:bg-red-900/30'
                  : 'bg-amber-100 dark:bg-amber-900/30'
                }`}>
                <span className={`material-symbols-outlined text-xl ${toast.type === 'success'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : toast.type === 'error'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-amber-600 dark:text-amber-400'
                  }`}>
                  {toast.type === 'success' ? 'check_circle' : toast.type === 'error' ? 'error' : 'warning'}
                </span>
              </div>
              <p className={`text-sm font-semibold flex-1 leading-relaxed ${toast.type === 'success'
                ? 'text-emerald-900 dark:text-emerald-100'
                : toast.type === 'error'
                  ? 'text-red-900 dark:text-red-100'
                  : 'text-amber-900 dark:text-amber-100'
                }`}>
                {toast.message}
              </p>
              <button
                onClick={() => setToast(null)}
                className="ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors flex-shrink-0 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Fechar"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default App;
