
import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { Workspace } from '../types';

interface HeaderProps {
  onToggleSidebar: () => void;
  onSearch?: (query: string) => void;
  currentWorkspace?: Workspace | null;
  user: User | null;
  onLogout: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar, onSearch, currentWorkspace, user, onLogout, theme, onToggleTheme }) => {
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
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
  };

  const getUserDisplayName = () => {
    return user?.displayName || user?.email?.split('@')[0] || 'Usuário';
  };

  return (
    <header className="h-16 flex items-center justify-between px-8 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30">
      <div className="flex items-center gap-6 flex-1">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        <form onSubmit={handleSearchSubmit} className="relative w-full max-w-sm">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-primary/50 outline-none transition-shadow"
            placeholder="Buscar clientes ou projetos..."
          />
        </form>
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleTheme}
          className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:scale-105 transition-all active:scale-95"
          title={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
        >
          <span className="material-symbols-outlined text-[22px]">
            {theme === 'light' ? 'dark_mode' : 'light_mode'}
          </span>
        </button>

        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-3 p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <div className="text-right hidden sm:block">
              {currentWorkspace?.name ? (
                <>
                  <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">{currentWorkspace.name}</p>
                  <p className="text-[10px] text-slate-500 font-medium">Workspace</p>
                </>
              ) : (
                <>
                  <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">{getUserDisplayName()}</p>
                  <p className="text-[10px] text-slate-500 font-medium">{user?.email}</p>
                </>
              )}
            </div>
            <div
              className="size-9 rounded-lg bg-cover bg-center ring-2 ring-primary/10 flex-shrink-0 shadow-sm"
              style={{
                backgroundImage: currentWorkspace?.avatar
                  ? `url('${currentWorkspace.avatar}')`
                  : `url('${getUserAvatar()}')`
              }}
            ></div>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 min-w-[220px] overflow-hidden animate-fade-in">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                <p className="text-sm font-bold text-slate-900 dark:text-white">{getUserDisplayName()}</p>
                <p className="text-[11px] text-slate-500 truncate font-medium mt-0.5">{user?.email}</p>
              </div>
              <div className="p-1.5">
                <button
                  onClick={() => {
                    onLogout();
                    setShowUserMenu(false);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-colors flex items-center gap-3 font-semibold"
                >
                  <span className="material-symbols-outlined text-lg">logout</span>
                  <span>Sair da conta</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
