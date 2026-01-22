
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
  const [openAddProjectModal, setOpenAddProjectModal] = useState(false);

  // Observar estado de autenticação
  useEffect(() => {
    const unsubscribe = onAuthStateChange((currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
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
  }, []);

  const handleWorkspacesChange = useCallback((newWorkspaces: Workspace[]) => {
    console.log('Atualizando lista de workspaces:', newWorkspaces.length);
    setWorkspaces(newWorkspaces);
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  const navigateToView = useCallback((view: ViewState, project?: Project) => {
    if (view !== currentView) {
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
    if (!query.trim()) {
      return;
    }

    try {
      // Buscar todos os projetos do workspace atual
      const allProjects = await getProjects();
      const workspaceProjects = currentWorkspace 
        ? allProjects.filter(p => p.workspaceId === currentWorkspace.id)
        : allProjects;

      // Buscar por nome do projeto ou cliente (case-insensitive)
      const searchLower = query.toLowerCase();
      const foundProject = workspaceProjects.find(p => 
        p.name.toLowerCase().includes(searchLower) || 
        p.client.toLowerCase().includes(searchLower)
      );

      if (foundProject) {
        // Converter o tipo do projeto para o formato do filtro
        const filterKey = foundProject.type.toLowerCase().replace(/\s+/g, '-');
        
        // Navegar para o Dashboard com o filtro do serviço e projeto destacado
        setDashboardInitialFilter(filterKey);
        setDashboardHighlightedProjectId(foundProject.id);
        setCurrentView('Dashboard');
        setPreviousView(currentView);
      }
    } catch (error) {
      console.error('Erro ao buscar projetos:', error);
    }
  }, [currentWorkspace, currentView]);

  const handleCreateProject = useCallback(() => {
    setOpenAddProjectModal(true);
    setCurrentView('Dashboard');
  }, []);

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
      />;
      case 'Financial': return <Financial 
        currentWorkspace={currentWorkspace} 
        onCreateInvoice={() => navigateToView('CreateInvoice')}
        onProjectClick={(project) => navigateToView('ProjectDetails', project)}
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
    return <Login onLoginSuccess={() => {}} />;
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
        onWorkspacesChange={handleWorkspacesChange}
        userId={user?.uid}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          onToggleSidebar={toggleSidebar} 
          onSearch={handleSearch} 
          currentWorkspace={currentWorkspace}
          user={user}
          onLogout={handleLogout}
        />
        <main className="flex-1 overflow-y-auto">
          {renderView()}
        </main>
      </div>
    </div>
  );
};

export default App;
