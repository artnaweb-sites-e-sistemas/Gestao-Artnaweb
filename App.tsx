
import React, { useState, useCallback, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './views/Dashboard';
import { Tasks } from './views/Tasks';
import { Financial } from './views/Financial';
import { Documents } from './views/Documents';
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
import { ViewState, Project, Workspace } from './types';
import { getProjects } from './firebase/services';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('Dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [previousView, setPreviousView] = useState<ViewState>('Dashboard');
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [dashboardInitialFilter, setDashboardInitialFilter] = useState<string | undefined>(undefined);
  const [dashboardHighlightedProjectId, setDashboardHighlightedProjectId] = useState<string | undefined>(undefined);

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

  const renderView = () => {
    switch (currentView) {
      case 'Dashboard': return <Dashboard 
        onProjectClick={(project) => navigateToView('ProjectDetails', project)} 
        currentWorkspace={currentWorkspace}
        initialFilter={dashboardInitialFilter}
        highlightedProjectId={dashboardHighlightedProjectId}
      />;
      case 'Tasks': return <Tasks onCreateTask={() => navigateToView('CreateTask')} />;
      case 'Financial': return <Financial onCreateInvoice={() => navigateToView('CreateInvoice')} />;
      case 'Documents': return <Documents />;
      case 'Timeline': return <Timeline currentWorkspace={currentWorkspace} onProjectClick={(project) => navigateToView('ProjectDetails', project)} />;
      case 'Settings': return <Settings />;
      case 'Clients': return <ClientProfile 
        onNavigate={(view) => navigateToView(view as ViewState)}
      />;
      case 'ProjectDetails': return selectedProject ? (
        <ProjectDetails 
          project={selectedProject} 
          onClose={goBack}
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

  return (
    <div className="flex h-screen overflow-hidden bg-background-light dark:bg-background-dark">
      <Sidebar 
        currentView={currentView} 
        setView={(view) => navigateToView(view)} 
        isOpen={isSidebarOpen}
        onCreateProject={() => navigateToView('Settings')}
        currentWorkspace={currentWorkspace}
        workspaces={workspaces}
        onWorkspaceChange={handleWorkspaceChange}
        onWorkspacesChange={handleWorkspacesChange}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onToggleSidebar={toggleSidebar} onSearch={handleSearch} />
        <main className="flex-1 overflow-y-auto">
          {renderView()}
        </main>
      </div>
    </div>
  );
};

export default App;
