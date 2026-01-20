
import React, { useState, useCallback } from 'react';
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
import { ViewState, Project } from './types';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('Dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [previousView, setPreviousView] = useState<ViewState>('Dashboard');

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  const navigateToView = useCallback((view: ViewState, project?: Project) => {
    if (view !== currentView) {
      setPreviousView(currentView);
    }
    setCurrentView(view);
    if (project) {
      setSelectedProject(project);
    }
  }, [currentView]);

  const goBack = useCallback(() => {
    setCurrentView(previousView);
    setSelectedProject(null);
  }, [previousView]);

  const renderView = () => {
    switch (currentView) {
      case 'Dashboard': return <Dashboard onProjectClick={(project) => navigateToView('ProjectDetails', project)} />;
      case 'Tasks': return <Tasks onCreateTask={() => navigateToView('CreateTask')} />;
      case 'Financial': return <Financial onCreateInvoice={() => navigateToView('CreateInvoice')} />;
      case 'Documents': return <Documents />;
      case 'Timeline': return <Timeline />;
      case 'Settings': return <Settings />;
      case 'Clients': return <ClientProfile 
        onNavigate={(view) => navigateToView(view as ViewState)}
      />;
      case 'ProjectDetails': return selectedProject ? (
        <ProjectDetails project={selectedProject} onClose={goBack} />
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
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onToggleSidebar={toggleSidebar} />
        <main className="flex-1 overflow-y-auto">
          {renderView()}
        </main>
      </div>
    </div>
  );
};

export default App;
