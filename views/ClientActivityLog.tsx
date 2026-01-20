
import React from 'react';

interface ClientActivityLogProps {
  onNavigate?: (view: string) => void;
}

export const ClientActivityLog: React.FC<ClientActivityLogProps> = ({ onNavigate }) => {
  const activities = [
    { id: '1', type: 'document', action: 'Documento enviado', user: 'João Silva', date: 'há 2 horas', icon: 'description', color: 'text-blue-500' },
    { id: '2', type: 'comment', action: 'Comentário adicionado', user: 'Maria Santos', date: 'há 5 horas', icon: 'comment', color: 'text-purple-500' },
    { id: '3', type: 'update', action: 'Status atualizado', user: 'Pedro Costa', date: 'ontem', icon: 'update', color: 'text-green-500' },
    { id: '4', type: 'meeting', action: 'Reunião agendada', user: 'João Silva', date: 'há 2 dias', icon: 'event', color: 'text-amber-500' },
    { id: '5', type: 'invoice', action: 'Fatura criada', user: 'Sistema', date: 'há 3 dias', icon: 'receipt', color: 'text-rose-500' },
    { id: '6', type: 'project', action: 'Projeto criado', user: 'João Silva', date: 'há 1 semana', icon: 'rocket_launch', color: 'text-primary' },
  ];

  return (
    <div className="flex h-full">
      <aside className="w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between p-6 overflow-y-auto">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-primary/10 rounded-xl p-2">
                <div className="size-12 rounded-lg bg-slate-200" style={{ backgroundImage: `url('https://picsum.photos/seed/acme/100/100')`, backgroundSize: 'cover' }}></div>
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight">Acme Corp</h1>
                <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Tech Solutions</p>
              </div>
            </div>
            <div className="flex gap-2">
              <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded uppercase">Ativo</span>
            </div>
          </div>
          <nav className="flex flex-col gap-1">
            <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest mb-2">Gestão</p>
            <NavBtn icon="person" label="Perfil do Cliente" onClick={() => onNavigate?.('Clients')} />
            <NavBtn icon="payments" label="Faturamento e Notas" onClick={() => onNavigate?.('ClientBilling')} />
            <NavBtn icon="rocket_launch" label="Roteiro do Projeto" onClick={() => onNavigate?.('ClientRoadmap')} />
            <NavBtn icon="history" label="Log de Atividades" active onClick={() => onNavigate?.('ClientActivityLog')} />
          </nav>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900/10 p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-wrap justify-between items-end gap-3 border-b border-slate-200 pb-6 mb-6">
            <div className="flex flex-col gap-1">
              <h1 className="text-3xl font-black leading-tight tracking-tight">Log de Atividades</h1>
              <p className="text-slate-500 text-sm">Histórico completo de ações e eventos do cliente</p>
            </div>
            <div className="flex gap-2">
              <button className="flex items-center px-4 h-10 bg-white border border-slate-200 rounded-lg text-xs font-bold hover:bg-slate-50">
                <span className="material-symbols-outlined text-[18px] mr-2">filter_list</span> Filtros
              </button>
              <button className="flex items-center px-4 h-10 bg-white border border-slate-200 rounded-lg text-xs font-bold hover:bg-slate-50">
                <span className="material-symbols-outlined text-[18px] mr-2">download</span> Exportar
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {activities.map((activity) => (
                <div key={activity.id} className="p-6 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className={`size-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center ${activity.color}`}>
                      <span className="material-symbols-outlined">{activity.icon}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold">{activity.action}</p>
                        <span className="text-xs text-slate-500">{activity.date}</span>
                      </div>
                      <p className="text-xs text-slate-500">por {activity.user}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

const NavBtn: React.FC<{ icon: string; label: string; active?: boolean; onClick?: () => void }> = ({ icon, label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${active ? 'bg-primary/10 text-primary font-bold' : 'text-slate-600 hover:bg-slate-100'}`}
  >
    <span className="material-symbols-outlined text-[20px]">{icon}</span>
    {label}
  </button>
);

