
import React, { useState, useRef, useEffect } from 'react';

interface HeaderProps {
  onToggleSidebar: () => void;
  onSearch?: (query: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar, onSearch }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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
        <button 
          onClick={() => setShowNotifications(!showNotifications)}
          className="size-10 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 transition-colors relative"
        >
          <span className="material-symbols-outlined">notifications</span>
          <span className="absolute top-1 right-1 size-2 bg-primary rounded-full"></span>
        </button>
        {showNotifications && (
          <div className="absolute top-14 right-0 w-80 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg z-50">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-sm">Notificações</h3>
              <button 
                onClick={() => setShowNotifications(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                <p className="text-sm font-semibold mb-1">Nova tarefa atribuída</p>
                <p className="text-xs text-slate-500">Você foi atribuído à tarefa "Wireframing - Home & Serviços"</p>
                <p className="text-[10px] text-slate-400 mt-1">há 2 horas</p>
              </div>
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                <p className="text-sm font-semibold mb-1">Comentário novo</p>
                <p className="text-xs text-slate-500">João Silva comentou no projeto "TechStart Inc."</p>
                <p className="text-[10px] text-slate-400 mt-1">há 5 horas</p>
              </div>
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                <p className="text-sm font-semibold mb-1">Projeto atualizado</p>
                <p className="text-xs text-slate-500">O status do projeto "Solar Solutions" foi alterado</p>
                <p className="text-[10px] text-slate-400 mt-1">ontem</p>
              </div>
            </div>
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 text-center">
              <button className="text-xs font-semibold text-primary hover:underline">Ver todas as notificações</button>
            </div>
          </div>
        )}
        <div className="h-8 w-[1px] bg-slate-200 dark:bg-slate-700 mx-2"></div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold">Alex Sterling</p>
            <p className="text-[10px] text-slate-500">Diretor Criativo</p>
          </div>
          <div 
            className="size-10 rounded-full bg-cover bg-center ring-2 ring-primary/20" 
            style={{ backgroundImage: `url('https://picsum.photos/seed/alex/100/100')` }}
          ></div>
        </div>
      </div>
    </header>
  );
};
