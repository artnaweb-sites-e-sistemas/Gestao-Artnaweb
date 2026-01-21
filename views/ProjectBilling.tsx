
import React from 'react';
import { Project } from '../types';

interface ProjectBillingProps {
  project: Project;
  onNavigate?: (view: string) => void;
  onClose?: () => void;
}

export const ProjectBilling: React.FC<ProjectBillingProps> = ({ project, onNavigate, onClose }) => {
  const invoices = [
    { id: '1', number: 'INV-2024-001', date: '15 Jan, 2024', amount: project.budget || 0, status: project.isPaid ? 'Paid' : 'Pending', description: 'Fatura principal do projeto' },
  ];

  return (
    <div className="flex h-full">
      <aside className="w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between p-6 overflow-y-auto">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-primary/10 rounded-xl p-2">
                <div 
                  className="size-12 rounded-lg bg-slate-200" 
                  style={{ backgroundImage: `url(${project.avatar})`, backgroundSize: 'cover' }}
                ></div>
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight">{project.name}</h1>
                <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">{project.client}</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <span className={`px-2 py-1 text-[10px] font-bold rounded uppercase ${
                project.status === 'Active' ? 'bg-green-100 text-green-700' :
                project.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                project.status === 'Lead' ? 'bg-amber-100 text-amber-700' :
                'bg-indigo-100 text-indigo-700'
              }`}>
                {project.status === 'Lead' ? 'Proposta Enviada' : 
                 project.status === 'Active' ? 'Em Desenvolvimento' :
                 project.status === 'Completed' ? 'Concluído' : 'Em Revisão'}
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded ${
                project.tagColor === 'amber' ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' :
                project.tagColor === 'blue' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' :
                project.tagColor === 'emerald' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' :
                'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
              }`}>
                {project.type}
              </span>
            </div>
          </div>
          <nav className="flex flex-col gap-1">
            <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest mb-2">Gestão</p>
            <NavBtn icon="description" label="Visão Geral" onClick={() => onNavigate?.('ProjectDetails')} />
            <NavBtn icon="payments" label="Faturamento e Notas" active onClick={() => onNavigate?.('ProjectBilling')} />
            <NavBtn icon="rocket_launch" label="Roteiro do Projeto" onClick={() => onNavigate?.('ProjectRoadmap')} />
          </nav>
        </div>
        <button 
          onClick={onClose}
          className="flex w-full cursor-pointer items-center justify-center rounded-lg h-11 px-4 bg-primary text-white text-sm font-bold shadow-lg shadow-primary/20 hover:bg-blue-700 transition-all mt-8"
        >
          Voltar
        </button>
      </aside>

      <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900/10 p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 text-slate-500 mb-4">
            <button 
              onClick={onClose}
              className="flex items-center gap-2 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              <span className="text-xs font-bold uppercase tracking-wider">Painel</span>
            </button>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">/</span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{project.name}</span>
          </div>
          <div className="flex flex-wrap justify-between items-end gap-3 border-b border-slate-200 dark:border-slate-800 pb-6 mb-6">
            <div className="flex flex-col gap-1">
              <h1 className="text-3xl font-black leading-tight tracking-tight">Faturamento e Notas</h1>
              <p className="text-slate-500 text-sm">Gerencie faturas e notas fiscais do projeto</p>
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
                  <button className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Filtros</button>
                  <button className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Exportar</button>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-4 text-[13px] font-bold text-slate-500 uppercase tracking-wider">Número</th>
                    <th className="px-6 py-4 text-[13px] font-bold text-slate-500 uppercase tracking-wider">Descrição</th>
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
                        <p className="text-sm">{invoice.description}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">{invoice.date}</td>
                      <td className="px-6 py-4 text-sm font-bold text-right">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(invoice.amount)}
                      </td>
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
    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
      active ? 'bg-primary/10 text-primary font-bold' : 'text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
    }`}
  >
    <span className="material-symbols-outlined text-[20px]">{icon}</span>
    {label}
  </button>
);


