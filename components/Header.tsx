
import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { Workspace } from '../types';

interface HeaderProps {
  onToggleSidebar: () => void;
  onSearch?: (query: string) => void;
  currentWorkspace?: Workspace | null;
  user: User | null;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar, onSearch, currentWorkspace, user, onLogout }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Fechar menu ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    // Sempre chamar onSearch, mesmo quando vazio, para resetar os filtros
    if (onSearch) {
      onSearch(value);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch && searchQuery.trim()) {
      onSearch(searchQuery.trim());
    }
  };

  // Gerar avatar do usuário
  const getUserAvatar = () => {
    if (user?.photoURL) {
      return user.photoURL;
    }
    // Gerar avatar baseado no nome ou email
    const seed = user?.displayName || user?.email || 'user';
    return `https://picsum.photos/seed/${seed}/100/100`;
  };

  const getUserDisplayName = () => {
    return user?.displayName || user?.email?.split('@')[0] || 'Usuário';
  };

  return (
    <header className="h-16 flex items-center justify-between px-8 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30">
      <div className="flex items-center gap-4 flex-1">
        <button 
          onClick={onToggleSidebar}
          className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        <form onSubmit={handleSearchSubmit} className="relative w-full max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">search</span>
          <input 
            type="text" 
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none" 
            placeholder="Buscar clientes ou projetos..." 
          />
        </form>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <div className="text-right hidden sm:block">
              {/* Priorizar informações do workspace se disponíveis, senão mostrar informações do usuário */}
              {currentWorkspace?.name ? (
                <>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{currentWorkspace.name}</p>
                  {currentWorkspace.description ? (
                    <p className="text-[10px] text-slate-500">{currentWorkspace.description}</p>
                  ) : (
                    <p className="text-[10px] text-slate-500">{user?.email}</p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{getUserDisplayName()}</p>
                  <p className="text-[10px] text-slate-500">{user?.email}</p>
                </>
              )}
            </div>
            <div 
              className="size-10 rounded-full bg-cover bg-center ring-2 ring-primary/20 flex-shrink-0" 
              style={{ 
                backgroundImage: currentWorkspace?.avatar 
                  ? `url('${currentWorkspace.avatar}')` 
                  : `url('${getUserAvatar()}')` 
              }}
            ></div>
          </button>
          
          {showUserMenu && (
            <div className="absolute right-0 top-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl z-50 min-w-[200px]">
              <div className="p-3 border-b border-slate-200 dark:border-slate-800">
                <p className="text-sm font-bold text-slate-900 dark:text-white">{getUserDisplayName()}</p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </div>
              <button
                onClick={() => {
                  onLogout();
                  setShowUserMenu(false);
                }}
                className="w-full px-4 py-2.5 text-left text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">logout</span>
                <span>Sair</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
