
import React, { useState, useRef, useEffect } from 'react';
import { Workspace } from '../types';
import { User } from 'firebase/auth';

interface HeaderProps {
  onToggleSidebar: () => void;
  onSearch?: (query: string) => void;
  currentWorkspace?: Workspace | null;
  user?: User | null;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar, onSearch, currentWorkspace, user, onLogout }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Limpar timeout anterior
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Se houver query e função de busca, executar após 500ms de inatividade
    if (searchQuery.trim() && onSearch) {
      searchTimeoutRef.current = setTimeout(() => {
        onSearch(searchQuery.trim());
      }, 500);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, onSearch]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim() && onSearch) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      onSearch(searchQuery.trim());
    }
  };

  return (
    <header className="h-16 flex items-center justify-between px-8 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30">
      <div className="flex items-center gap-4 flex-1">
        <button 
          onClick={onToggleSidebar}
          className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        <div className="relative w-full max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">search</span>
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none" 
            placeholder="Buscar clientes ou projetos..." 
          />
        </div>
      </div>
      <div className="flex items-center gap-4 relative">
        <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-700 mx-2"></div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block max-w-[150px]">
            <p className="text-xs font-bold truncate">{currentWorkspace?.name || 'Meu Workspace'}</p>
            <p className="text-[10px] text-slate-500 truncate">{currentWorkspace?.description || 'Workspace'}</p>
          </div>
          
          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <div 
                className="size-10 rounded-full bg-cover bg-center ring-2 ring-primary/20" 
                style={{ 
                  backgroundImage: user?.photoURL 
                    ? `url('${user.photoURL}')` 
                    : currentWorkspace?.avatar 
                      ? `url('${currentWorkspace.avatar}')` 
                      : `url('https://picsum.photos/seed/${(currentWorkspace?.name || 'workspace').toLowerCase().replace(/\s+/g, '')}/100/100')` 
                }}
              ></div>
            </button>
            
            {showUserMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowUserMenu(false)}
                />
                <div className="absolute top-12 right-0 w-64 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg z-50 overflow-hidden">
                  {/* User Info */}
                  <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                      <div 
                        className="size-12 rounded-full bg-cover bg-center ring-2 ring-primary/20 flex-shrink-0" 
                        style={{ 
                          backgroundImage: user?.photoURL 
                            ? `url('${user.photoURL}')` 
                            : `url('https://picsum.photos/seed/user/100/100')` 
                        }}
                      ></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{user?.displayName || 'Usuário'}</p>
                        <p className="text-xs text-slate-500 truncate">{user?.email || ''}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Menu Options */}
                  <div className="p-2">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        onLogout?.();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <span className="material-symbols-outlined text-xl">logout</span>
                      <span>Sair da conta</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
