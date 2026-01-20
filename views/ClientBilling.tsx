
import React from 'react';

interface ClientBillingProps {
  onNavigate?: (view: string) => void;
}

export const ClientBilling: React.FC<ClientBillingProps> = ({ onNavigate }) => {
  const invoices = [
    { id: '1', number: 'INV-2024-001', date: '15 Jan, 2024', amount: 12400, status: 'Paid', project: 'Construção de Plataforma E-commerce' },
    { id: '2', number: 'INV-2024-002', date: '20 Jan, 2024', amount: 4500, status: 'Pending', project: 'Redesign de Identidade Visual' },
    { id: '3', number: 'INV-2024-003', date: '25 Jan, 2024', amount: 8200, status: 'Overdue', project: 'Conceito de App Mobile' },
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
            <NavBtn icon="payments" label="Faturamento e Notas" active onClick={() => onNavigate?.('ClientBilling')} />
            <NavBtn icon="rocket_launch" label="Roteiro do Projeto" onClick={() => onNavigate?.('ClientRoadmap')} />
            <NavBtn icon="history" label="Log de Atividades" onClick={() => onNavigate?.('ClientActivityLog')} />
          </nav>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900/10 p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-wrap justify-between items-end gap-3 border-b border-slate-200 pb-6 mb-6">
            <div className="flex flex-col gap-1">
              <h1 className="text-3xl font-black leading-tight tracking-tight">Faturamento e Notas</h1>
              <p className="text-slate-500 text-sm">Gerencie faturas e notas fiscais do cliente</p>
            </div>
            <button className="flex items-center px-4 h-10 bg-primary text-white rounded-lg text-xs font-bold hover:bg-blue-700">
              <span className="material-symbols-outlined text-[18px] mr-2">add</span> Nova Fatura
            </button>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Faturas</h3>
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors">Filtros</button>
                  <button className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors">Exportar</button>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-4 text-[13px] font-bold text-slate-500 uppercase tracking-wider">Número</th>
                    <th className="px-6 py-4 text-[13px] font-bold text-slate-500 uppercase tracking-wider">Projeto</th>
                    <th className="px-6 py-4 text-[13px] font-bold text-slate-500 uppercase tracking-wider">Data</th>
                    <th className="px-6 py-4 text-[13px] font-bold text-slate-500 uppercase tracking-wider text-right">Valor</th>
                    <th className="px-6 py-4 text-[13px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-[13px] font-bold text-slate-500 uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold">{invoice.number}</span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm">{invoice.project}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">{invoice.date}</td>
                      <td className="px-6 py-4 text-sm font-bold text-right">R$ {invoice.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4">
                        <div className={`flex items-center gap-1.5 ${invoice.status === 'Paid' ? 'text-green-600' : invoice.status === 'Pending' ? 'text-amber-600' : 'text-red-600'}`}>
                          <div className={`size-1.5 rounded-full ${invoice.status === 'Paid' ? 'bg-green-600' : invoice.status === 'Pending' ? 'bg-amber-600' : 'bg-red-600'}`}></div>
                          <span className="text-xs font-bold">{invoice.status === 'Paid' ? 'Pago' : invoice.status === 'Pending' ? 'Pendente' : 'Atrasado'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button className="text-slate-400 hover:text-primary">
                            <span className="material-symbols-outlined text-lg">download</span>
                          </button>
                          <button className="text-slate-400 hover:text-primary">
                            <span className="material-symbols-outlined text-lg">edit</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

