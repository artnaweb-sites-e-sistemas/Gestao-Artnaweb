
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
import { ViewState } from './types';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('Dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  const renderView = () => {
    switch (currentView) {
      case 'Dashboard': return <Dashboard />;
      case 'Tasks': return <Tasks />;
      case 'Financial': return <Financial />;
      case 'Documents': return <Documents />;
      case 'Timeline': return <Timeline />;
      case 'Settings': return <Settings />;
      case 'Clients': return <ClientProfile />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background-light dark:bg-background-dark">
      <Sidebar 
        currentView={currentView} 
        setView={setCurrentView} 
        isOpen={isSidebarOpen}
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
