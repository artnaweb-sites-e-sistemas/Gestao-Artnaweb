
import React from 'react';

interface ClientRoadmapProps {
  onNavigate?: (view: string) => void;
}

export const ClientRoadmap: React.FC<ClientRoadmapProps> = ({ onNavigate }) => {
  const milestones = [
    { id: '1', title: 'Kickoff do Projeto', date: '15 Jan, 2024', status: 'completed', description: 'Reunião inicial com o cliente' },
    { id: '2', title: 'Briefing Aprovado', date: '20 Jan, 2024', status: 'completed', description: 'Documentação de requisitos finalizada' },
    { id: '3', title: 'Design Inicial', date: '25 Jan, 2024', status: 'current', description: 'Primeiros mockups e wireframes' },
    { id: '4', title: 'Desenvolvimento', date: '01 Fev, 2024', status: 'pending', description: 'Início da fase de codificação' },
    { id: '5', title: 'Testes e QA', date: '15 Fev, 2024', status: 'pending', description: 'Validação e correções' },
    { id: '6', title: 'Lançamento', date: '01 Mar, 2024', status: 'pending', description: 'Deploy em produção' },
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
            <NavBtn icon="rocket_launch" label="Roteiro do Projeto" active onClick={() => onNavigate?.('ClientRoadmap')} />
            <NavBtn icon="history" label="Log de Atividades" onClick={() => onNavigate?.('ClientActivityLog')} />
          </nav>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900/10 p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-wrap justify-between items-end gap-3 border-b border-slate-200 pb-6 mb-6">
            <div className="flex flex-col gap-1">
              <h1 className="text-3xl font-black leading-tight tracking-tight">Roteiro do Projeto</h1>
              <p className="text-slate-500 text-sm">Acompanhe os marcos e entregas do projeto</p>
            </div>
            <button className="flex items-center px-4 h-10 bg-primary text-white rounded-lg text-xs font-bold hover:bg-blue-700">
              <span className="material-symbols-outlined text-[18px] mr-2">add</span> Novo Marco
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8">
            <div className="relative">
              {milestones.map((milestone, index) => (
                <div key={milestone.id} className="flex gap-6 pb-8 last:pb-0">
                  <div className="flex flex-col items-center">
                    <div className={`size-12 rounded-full flex items-center justify-center font-bold text-sm ${
                      milestone.status === 'completed' ? 'bg-green-500 text-white' :
                      milestone.status === 'current' ? 'bg-primary text-white ring-4 ring-primary/20' :
                      'bg-slate-200 text-slate-400'
                    }`}>
                      {milestone.status === 'completed' ? (
                        <span className="material-symbols-outlined">check</span>
                      ) : (
                        <span>{index + 1}</span>
                      )}
                    </div>
                    {index < milestones.length - 1 && (
                      <div className={`w-0.5 h-full mt-2 ${
                        milestone.status === 'completed' ? 'bg-green-500' : 'bg-slate-200'
                      }`} style={{ minHeight: '80px' }}></div>
                    )}
                  </div>
                  <div className="flex-1 pb-8">
                    <div className={`p-4 rounded-lg border-2 ${
                      milestone.status === 'completed' ? 'border-green-200 bg-green-50/50' :
                      milestone.status === 'current' ? 'border-primary bg-primary/5' :
                      'border-slate-200 bg-slate-50'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-bold">{milestone.title}</h3>
                        <span className="text-sm text-slate-500">{milestone.date}</span>
                      </div>
                      <p className="text-sm text-slate-600">{milestone.description}</p>
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

