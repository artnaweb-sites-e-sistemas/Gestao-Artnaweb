
import React, { useState, useEffect, useRef } from 'react';
import { Project, Invoice, Category } from '../types';
import { subscribeToInvoices, addInvoice, updateProject as updateProjectInFirebase, subscribeToProject, updateInvoice, subscribeToCategories } from '../firebase/services';

interface ProjectBillingProps {
  project: Project;
  onNavigate?: (view: string) => void;
  onClose?: () => void;
}

export const ProjectBilling: React.FC<ProjectBillingProps> = ({ project, onNavigate, onClose }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project>(project);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  // Estado para modal de nova fatura recorrente
  const [showRecurringConfirm, setShowRecurringConfirm] = useState(false);
  const [paidInvoiceForRecurring, setPaidInvoiceForRecurring] = useState<Invoice | null>(null);

  // Verificar se o projeto é recorrente
  const isProjectRecurring = () => {
    const projectCategory = categories.find(cat => cat.name === currentProject.type);
    return projectCategory?.isRecurring || false;
  };

  // Carregar faturas do Firebase
  useEffect(() => {
    if (!project.id) return;

    const unsubscribe = subscribeToInvoices((fetchedInvoices) => {
      setInvoices(fetchedInvoices);
    }, project.id);

    return () => unsubscribe();
  }, [project.id]);

  // Subscrever atualizações do projeto em tempo real
  useEffect(() => {
    if (!project.id) return;

    const unsubscribe = subscribeToProject(project.id, (updatedProject) => {
      if (updatedProject) {
        setCurrentProject(updatedProject);
      }
    });

    return () => unsubscribe();
  }, [project.id]);

  // Sincronizar projeto inicial
  useEffect(() => {
    setCurrentProject(project);
  }, [project]);

  // Carregar categorias para verificar se projeto é recorrente
  useEffect(() => {
    if (!project.workspaceId) return;

    const unsubscribe = subscribeToCategories((fetchedCategories) => {
      setCategories(fetchedCategories);
    }, project.workspaceId);

    return () => unsubscribe();
  }, [project.workspaceId]);

  // Criar nova fatura recorrente (+30 dias)
  const createRecurringInvoice = async (previousInvoice: Invoice) => {
    try {
      // Calcular data da próxima fatura (+30 dias)
      let previousDate: Date;
      if (previousInvoice.date instanceof Date) {
        previousDate = previousInvoice.date;
      } else if (typeof previousInvoice.date === 'string' && previousInvoice.date.includes('-')) {
        const [year, month, day] = previousInvoice.date.split('-').map(Number);
        previousDate = new Date(year, month - 1, day);
      } else if (previousInvoice.date?.toDate) {
        previousDate = previousInvoice.date.toDate();
      } else {
        previousDate = new Date();
      }

      const nextDate = new Date(previousDate);
      nextDate.setDate(nextDate.getDate() + 30);

      // Gerar número sequencial
      const year = nextDate.getFullYear();
      const count = invoices.length + 1;

      await addInvoice({
        projectId: currentProject.id,
        workspaceId: currentProject.workspaceId,
        number: `REC-${year}-${String(count).padStart(3, '0')}`,
        description: 'Mensalidade - Recorrência',
        amount: previousInvoice.amount,
        date: nextDate,
        status: 'Pending'
      });
    } catch (error) {
      console.error("Error creating recurring invoice:", error);
    }
  };

  // Gerar número de fatura sequencial
  const generateInvoiceNumber = () => {
    const year = new Date().getFullYear();
    const count = invoices.length + 1;
    return `INV-${year}-${count.toString().padStart(3, '0')}`;
  };

  // Verificar se a fatura está vencida
  const isOverdue = (date: Date | any): boolean => {
    if (!date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Zerar hora para comparar apenas data

    // Converter para objeto Date se necessário
    let invoiceDate: Date;
    if (date instanceof Date) {
      invoiceDate = date;
    } else if (typeof date === 'string' && date.includes('-')) {
      const [year, month, day] = date.split('-').map(Number);
      invoiceDate = new Date(year, month - 1, day);
    } else if (date?.toDate) {
      invoiceDate = date.toDate();
    } else {
      invoiceDate = new Date(date);
    }

    invoiceDate.setHours(0, 0, 0, 0);
    return invoiceDate.getTime() < today.getTime();
  };

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
              <span className={`px-2 py-1 text-[10px] font-bold rounded uppercase ${project.status === 'Active' ? 'bg-green-100 text-green-700' :
                  project.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                    project.status === 'Lead' ? 'bg-amber-100 text-amber-700' :
                      'bg-indigo-100 text-indigo-700'
                }`}>
                {project.status === 'Lead' ? 'Proposta Enviada' :
                  project.status === 'Active' ? 'Em Desenvolvimento' :
                    project.status === 'Completed' ? 'Concluído' : 'Em Revisão'}
              </span>
              <div className="flex flex-wrap gap-1">
                {(project.types && project.types.length > 0 ? project.types : (project.type ? [project.type] : ['Sem categoria'])).map((typeName, idx) => (
                  <span key={idx} className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded ${project.tagColor === 'amber' ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' :
                      project.tagColor === 'blue' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' :
                        project.tagColor === 'emerald' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' :
                          'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                    }`}>
                    {typeName}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-8">
            <div className="flex flex-col gap-1">
              <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest mb-2">
                {isProjectRecurring() ? 'Financeiro' : 'Implementação'}
              </p>
              <div className="py-2">
                <p className="text-slate-500 text-xs mb-1">
                  {isProjectRecurring() ? 'Valor da Implementação' : 'Valor do Projeto'}
                </p>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-lg font-bold text-slate-900 dark:text-white">
                    {currentProject.budget ?
                      new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                      }).format(currentProject.budget)
                      : 'R$ 0,00'}
                  </p>
                  {!isProjectRecurring() && invoices.length > 1 && (
                    <span className="text-[10px] font-normal text-slate-500">
                      Em {invoices.length}x
                    </span>
                  )}
                </div>
                {/* Status de pagamento da implementação apenas para projetos recorrentes */}
                {isProjectRecurring() && (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={async () => {
                        if (currentProject.isImplementationPaid) return;
                        try {
                          // Atualizar apenas faturas de implementação (IMP-*)
                          const implementationInvoices = invoices.filter(inv => inv.number.startsWith('IMP-'));
                          for (const invoice of implementationInvoices) {
                            if (invoice.status !== 'Paid') {
                              await updateInvoice(invoice.id, { status: 'Paid' });
                            }
                          }
                          await updateProjectInFirebase(currentProject.id, { isImplementationPaid: true });
                          setCurrentProject({ ...currentProject, isImplementationPaid: true });
                        } catch (error) {
                          console.error("Error updating implementation status:", error);
                        }
                      }}
                      className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer ${currentProject.isImplementationPaid
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-700'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                    >
                      <span className="material-symbols-outlined text-xs">check_circle</span>
                      Pago
                    </button>
                    <button
                      onClick={async () => {
                        if (!currentProject.isImplementationPaid) return;
                        try {
                          // Atualizar apenas faturas de implementação (IMP-*)
                          const implementationInvoices = invoices.filter(inv => inv.number.startsWith('IMP-'));
                          for (const invoice of implementationInvoices) {
                            if (invoice.status === 'Paid') {
                              await updateInvoice(invoice.id, { status: 'Pending' });
                            }
                          }
                          await updateProjectInFirebase(currentProject.id, { isImplementationPaid: false });
                          setCurrentProject({ ...currentProject, isImplementationPaid: false });
                        } catch (error) {
                          console.error("Error updating implementation status:", error);
                        }
                      }}
                      className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer ${!currentProject.isImplementationPaid
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-700'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                    >
                      <span className="material-symbols-outlined text-xs">pending</span>
                      Pendente
                    </button>
                  </div>
                )}
              </div>
              {/* Campo de Mensalidade apenas para projetos recorrentes */}
              {isProjectRecurring() && (
                <div className="py-2">
                  <p className="text-slate-500 text-xs mb-1">Valor da Mensalidade</p>
                  <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                    {currentProject.recurringAmount ?
                      new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                      }).format(currentProject.recurringAmount)
                      : 'R$ 0,00'}
                  </p>
                  {/* Status de pagamento da mensalidade */}
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={async () => {
                        if (currentProject.isRecurringPaid) return;
                        try {
                          // Encontrar a fatura de mensalidade mais recente pendente (REC-*)
                          const recurringInvoices = invoices.filter(inv => inv.number.startsWith('REC-') && inv.status !== 'Paid');
                          if (recurringInvoices.length > 0) {
                            // Marcar a fatura mais recente como paga
                            const latestRecurring = recurringInvoices[0];
                            await updateInvoice(latestRecurring.id, { status: 'Paid' });

                            // Mostrar modal para criar próxima fatura
                            setPaidInvoiceForRecurring(latestRecurring);
                            setShowRecurringConfirm(true);
                          }
                          await updateProjectInFirebase(currentProject.id, { isRecurringPaid: true });
                          setCurrentProject({ ...currentProject, isRecurringPaid: true });
                        } catch (error) {
                          console.error("Error updating recurring status:", error);
                        }
                      }}
                      className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer ${currentProject.isRecurringPaid
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-700'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                    >
                      <span className="material-symbols-outlined text-xs">check_circle</span>
                      Pago
                    </button>
                    <button
                      onClick={async () => {
                        if (!currentProject.isRecurringPaid) return;
                        try {
                          // Atualizar apenas faturas de mensalidade (REC-*)
                          const recurringInvoices = invoices.filter(inv => inv.number.startsWith('REC-'));
                          for (const invoice of recurringInvoices) {
                            if (invoice.status === 'Paid') {
                              await updateInvoice(invoice.id, { status: 'Pending' });
                            }
                          }
                          await updateProjectInFirebase(currentProject.id, { isRecurringPaid: false });
                          setCurrentProject({ ...currentProject, isRecurringPaid: false });
                        } catch (error) {
                          console.error("Error updating recurring status:", error);
                        }
                      }}
                      className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer ${!currentProject.isRecurringPaid
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                    >
                      <span className="material-symbols-outlined text-xs">pending</span>
                      Pendente
                    </button>
                  </div>
                </div>
              )}
              {/* Status de pagamento geral apenas para projetos normais */}
              {!isProjectRecurring() && (
                <div className="py-2">
                  <p className="text-slate-500 text-xs mb-1">Status de Pagamento</p>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        if (currentProject.isPaid) return;
                        try {
                          // Atualizar status geral do projeto
                          await updateProjectInFirebase(currentProject.id, { isPaid: true });
                          setCurrentProject({ ...currentProject, isPaid: true });

                          // Atualizar todas as faturas pendentes para Pago
                          const pendingInvoices = invoices.filter(inv => inv.status !== 'Paid');
                          for (const invoice of pendingInvoices) {
                            await updateInvoice(invoice.id, { status: 'Paid' });
                          }
                        } catch (error) {
                          console.error("Error updating payment status:", error);
                        }
                      }}
                      className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${currentProject.isPaid
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-emerald-500 hover:text-white hover:border-emerald-500'
                        }`}
                    >
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      Pago
                    </button>
                    <button
                      onClick={async () => {
                        if (!currentProject.isPaid) return;
                        try {
                          // Atualizar status geral do projeto
                          await updateProjectInFirebase(currentProject.id, { isPaid: false });
                          setCurrentProject({ ...currentProject, isPaid: false });

                          // Atualizar todas as faturas pagas para Pendente
                          const paidInvoices = invoices.filter(inv => inv.status === 'Paid');
                          for (const invoice of paidInvoices) {
                            await updateInvoice(invoice.id, { status: 'Pending' });
                          }
                        } catch (error) {
                          console.error("Error updating payment status:", error);
                        }
                      }}
                      className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${!currentProject.isPaid
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-amber-500 hover:text-white hover:border-amber-500'
                        }`}
                    >
                      <span className="material-symbols-outlined text-sm">pending</span>
                      Pendente
                    </button>
                  </div>
                </div>
              )}
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
            <button
              onClick={() => setShowAddInvoice(true)}
              className="flex items-center px-4 h-10 bg-primary text-white rounded-lg text-xs font-bold hover:bg-blue-700"
            >
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
                    <th className="px-6 py-4 text-[13px] font-bold text-slate-500 uppercase tracking-wider">Descrição</th>
                    <th className="px-6 py-4 text-[13px] font-bold text-slate-500 uppercase tracking-wider">Data</th>
                    <th className="px-6 py-4 text-[13px] font-bold text-slate-500 uppercase tracking-wider">Valor</th>
                    <th className="px-6 py-4 text-[13px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-[13px] font-bold text-slate-500 uppercase tracking-wider text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {invoices.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <span className="material-symbols-outlined text-4xl text-slate-300">receipt_long</span>
                          <p className="text-sm text-slate-500">Nenhuma fatura cadastrada</p>
                          <p className="text-xs text-slate-400">Clique em "Nova Fatura" para adicionar</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    [...invoices].sort((a, b) => {
                      const dateA = a.date instanceof Date ? a.date : new Date(a.date);
                      const dateB = b.date instanceof Date ? b.date : new Date(b.date);
                      return dateA.getTime() - dateB.getTime(); // Mais antiga primeiro
                    }).map((invoice, index, sortedInvoices) => (
                      <tr key={invoice.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <p className="text-sm font-medium">{invoice.description}</p>
                          <p className="text-[10px] text-slate-400">{invoice.number}</p>
                        </td>
                        <td className={`px-6 py-4 text-sm ${invoice.status === 'Pending' && isOverdue(invoice.date) ? 'text-red-500 font-bold' : 'text-slate-500'}`}>
                          {(() => {
                            if (!invoice.date) return '-';
                            let dateObj: Date;
                            if (invoice.date instanceof Date) {
                              dateObj = invoice.date;
                            } else if (typeof invoice.date === 'string' && invoice.date.includes('-')) {
                              // Parse YYYY-MM-DD sem problemas de timezone
                              const [year, month, day] = invoice.date.split('-').map(Number);
                              dateObj = new Date(year, month - 1, day);
                            } else if (invoice.date?.toDate) {
                              // Firebase Timestamp
                              dateObj = invoice.date.toDate();
                            } else {
                              dateObj = new Date(invoice.date);
                            }
                            return dateObj.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' });
                          })()}
                        </td>
                        <td className="px-6 py-4 text-sm font-bold">
                          <div className="flex items-baseline gap-1.5">
                            <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(invoice.amount)}</span>
                            {/* Mostrar contagem apenas para faturas de implementação (IMP-*) ou normais (INV-*), não para mensalidade (REC-*) */}
                            {sortedInvoices.length > 1 && !invoice.number.startsWith('REC-') && (
                              <span className="text-[10px] font-normal text-slate-500">
                                {(() => {
                                  // Contar apenas faturas do mesmo tipo (IMP-* ou INV-*)
                                  const sameTypeInvoices = sortedInvoices.filter(inv =>
                                    invoice.number.startsWith('IMP-')
                                      ? inv.number.startsWith('IMP-')
                                      : inv.number.startsWith('INV-')
                                  );
                                  const currentIndex = sameTypeInvoices.findIndex(inv => inv.id === invoice.id);
                                  return `${currentIndex + 1}/${sameTypeInvoices.length}`;
                                })()}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-1">
                            <button
                              onClick={async () => {
                                if (invoice.status === 'Paid') return;
                                try {
                                  await updateInvoice(invoice.id, { status: 'Paid' });
                                  const updatedInvoices = invoices.map(inv =>
                                    inv.id === invoice.id ? { ...inv, status: 'Paid' } : inv
                                  );

                                  // Atualizar status específico baseado no tipo de fatura
                                  if (isProjectRecurring()) {
                                    if (invoice.number.startsWith('IMP-')) {
                                      // Verificar se todas as faturas de implementação estão pagas
                                      const implementationInvoices = updatedInvoices.filter(inv => inv.number.startsWith('IMP-'));
                                      const allImplementationPaid = implementationInvoices.every(inv => inv.status === 'Paid');
                                      if (allImplementationPaid !== currentProject.isImplementationPaid) {
                                        await updateProjectInFirebase(currentProject.id, { isImplementationPaid: allImplementationPaid });
                                        setCurrentProject({ ...currentProject, isImplementationPaid: allImplementationPaid });
                                      }
                                    } else if (invoice.number.startsWith('REC-')) {
                                      // Para mensalidade, marcar como paga e perguntar se quer criar nova fatura
                                      await updateProjectInFirebase(currentProject.id, { isRecurringPaid: true });
                                      setCurrentProject({ ...currentProject, isRecurringPaid: true });
                                      setPaidInvoiceForRecurring(invoice);
                                      setShowRecurringConfirm(true);
                                    }
                                  } else {
                                    // Projeto normal: atualizar status geral
                                    const allPaid = updatedInvoices.every(inv => inv.status === 'Paid');
                                    if (allPaid !== currentProject.isPaid) {
                                      await updateProjectInFirebase(currentProject.id, { isPaid: allPaid });
                                      setCurrentProject({ ...currentProject, isPaid: allPaid });
                                    }
                                  }
                                } catch (error) {
                                  console.error("Error updating invoice:", error);
                                }
                              }}
                              className={`flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer ${invoice.status === 'Paid'
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-700'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-green-100 hover:text-green-700 hover:border-green-300'
                                }`}
                            >
                              <span className="material-symbols-outlined text-xs">check_circle</span>
                              Pago
                            </button>
                            <button
                              onClick={async () => {
                                if (invoice.status === 'Pending') return;
                                try {
                                  await updateInvoice(invoice.id, { status: 'Pending' });
                                  const updatedInvoices = invoices.map(inv =>
                                    inv.id === invoice.id ? { ...inv, status: 'Pending' } : inv
                                  );

                                  // Atualizar status específico baseado no tipo de fatura
                                  if (isProjectRecurring()) {
                                    if (invoice.number.startsWith('IMP-')) {
                                      // Verificar se alguma fatura de implementação está pendente
                                      const implementationInvoices = updatedInvoices.filter(inv => inv.number.startsWith('IMP-'));
                                      const allImplementationPaid = implementationInvoices.every(inv => inv.status === 'Paid');
                                      if (allImplementationPaid !== currentProject.isImplementationPaid) {
                                        await updateProjectInFirebase(currentProject.id, { isImplementationPaid: allImplementationPaid });
                                        setCurrentProject({ ...currentProject, isImplementationPaid: allImplementationPaid });
                                      }
                                    } else if (invoice.number.startsWith('REC-')) {
                                      // Para mensalidade, marcar como pendente
                                      await updateProjectInFirebase(currentProject.id, { isRecurringPaid: false });
                                      setCurrentProject({ ...currentProject, isRecurringPaid: false });
                                    }
                                  } else {
                                    // Projeto normal: atualizar status geral
                                    const allPaid = updatedInvoices.every(inv => inv.status === 'Paid');
                                    if (allPaid !== currentProject.isPaid) {
                                      await updateProjectInFirebase(currentProject.id, { isPaid: allPaid });
                                      setCurrentProject({ ...currentProject, isPaid: allPaid });
                                    }
                                  }
                                } catch (error) {
                                  console.error("Error updating invoice:", error);
                                }
                              }}
                              className={`flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer ${invoice.status === 'Pending'
                                  ? (isOverdue(invoice.date)
                                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-700'
                                    : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700')
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-amber-100 hover:text-amber-700 hover:border-amber-300'
                                }`}
                            >
                              <span className="material-symbols-outlined text-xs">pending</span>
                              Pendente
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => setEditingInvoice(invoice)}
                            className="size-8 rounded-lg flex items-center justify-center transition-all bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-primary/10 hover:text-primary border border-slate-200 dark:border-slate-700"
                            title="Editar fatura"
                          >
                            <span className="material-symbols-outlined text-lg">edit</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Modal Adicionar Nova Fatura */}
      {showAddInvoice && (
        <AddInvoiceModal
          projectId={project.id}
          workspaceId={project.workspaceId}
          defaultNumber={generateInvoiceNumber()}
          onClose={() => setShowAddInvoice(false)}
          isRecurring={isProjectRecurring()}
          recurringAmount={currentProject.recurringAmount || 0}
          onSave={async (invoiceData) => {
            try {
              await addInvoice({
                ...invoiceData,
                projectId: project.id,
                workspaceId: project.workspaceId
              });
              setShowAddInvoice(false);
            } catch (error) {
              console.error("Error adding invoice:", error);
            }
          }}
        />
      )}

      {/* Modal Editar Fatura */}
      {editingInvoice && (
        <EditInvoiceModal
          invoice={editingInvoice}
          onClose={() => setEditingInvoice(null)}
          onSave={async (updates) => {
            try {
              await updateInvoice(editingInvoice.id, updates);
              setEditingInvoice(null);
            } catch (error) {
              console.error("Error updating invoice:", error);
            }
          }}
        />
      )}

      {/* Modal Confirmar Nova Fatura Recorrente */}
      {showRecurringConfirm && paidInvoiceForRecurring && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-full max-w-md shadow-2xl">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="size-12 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-amber-600 dark:text-amber-400">autorenew</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold">Criar Nova Fatura?</h3>
                  <p className="text-sm text-slate-500">Projeto recorrente detectado</p>
                </div>
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                Deseja criar uma nova fatura com vencimento para <strong>30 dias</strong> após a fatura atual?
              </p>

              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">Valor</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(paidInvoiceForRecurring.amount)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">Próximo Vencimento</span>
                  <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                    {(() => {
                      let previousDate: Date;
                      if (paidInvoiceForRecurring.date instanceof Date) {
                        previousDate = paidInvoiceForRecurring.date;
                      } else if (typeof paidInvoiceForRecurring.date === 'string' && paidInvoiceForRecurring.date.includes('-')) {
                        const [year, month, day] = paidInvoiceForRecurring.date.split('-').map(Number);
                        previousDate = new Date(year, month - 1, day);
                      } else if (paidInvoiceForRecurring.date?.toDate) {
                        previousDate = paidInvoiceForRecurring.date.toDate();
                      } else {
                        previousDate = new Date();
                      }
                      const nextDate = new Date(previousDate);
                      nextDate.setDate(nextDate.getDate() + 30);
                      return nextDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    })()}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowRecurringConfirm(false);
                    setPaidInvoiceForRecurring(null);
                  }}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Não, obrigado
                </button>
                <button
                  onClick={async () => {
                    if (paidInvoiceForRecurring) {
                      await createRecurringInvoice(paidInvoiceForRecurring);
                    }
                    setShowRecurringConfirm(false);
                    setPaidInvoiceForRecurring(null);
                  }}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">add_circle</span>
                  Sim, criar fatura
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const NavBtn: React.FC<{ icon: string; label: string; active?: boolean; onClick?: () => void }> = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${active ? 'bg-primary/10 text-primary font-bold' : 'text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
      }`}
  >
    <span className="material-symbols-outlined text-[20px]">{icon}</span>
    {label}
  </button>
);

const AddInvoiceModal: React.FC<{
  projectId: string;
  workspaceId?: string;
  defaultNumber: string;
  onClose: () => void;
  onSave: (invoice: Omit<Invoice, "id">) => Promise<void>;
  isRecurring?: boolean;
  recurringAmount?: number;
}> = ({ projectId, workspaceId, defaultNumber, onClose, onSave, isRecurring = false, recurringAmount = 0 }) => {
  const [invoiceType, setInvoiceType] = useState<'custom' | 'implementation' | 'recurring'>('custom');
  const [formData, setFormData] = useState({
    number: defaultNumber,
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    status: 'Pending' as 'Paid' | 'Pending' | 'Overdue'
  });
  const [amountDisplay, setAmountDisplay] = useState<string>('0,00');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Atualizar descrição e valor quando o tipo de fatura muda
  useEffect(() => {
    if (invoiceType === 'recurring' && recurringAmount > 0) {
      const year = new Date().getFullYear();
      setFormData(prev => ({
        ...prev,
        number: `REC-${year}-${defaultNumber.split('-').pop() || '001'}`,
        description: 'Mensalidade - Recorrência'
      }));
      setAmountDisplay(new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(recurringAmount));
    } else if (invoiceType === 'implementation') {
      const year = new Date().getFullYear();
      setFormData(prev => ({
        ...prev,
        number: `IMP-${year}-${defaultNumber.split('-').pop() || '001'}`,
        description: 'Implementação do Projeto'
      }));
      setAmountDisplay('0,00');
    } else if (invoiceType === 'custom') {
      setFormData(prev => ({
        ...prev,
        number: defaultNumber,
        description: ''
      }));
      setAmountDisplay('0,00');
    }
  }, [invoiceType, recurringAmount, defaultNumber]);

  // Fechar date picker ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (showDatePicker && datePickerRef.current && !datePickerRef.current.contains(target)) {
        setShowDatePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDatePicker]);

  const formatCurrency = (value: string): string => {
    // Remove tudo que não é dígito
    const numbers = value.replace(/\D/g, '');
    if (numbers === '' || numbers === '0') return '0,00';

    // Converte para número e divide por 100 para ter centavos
    const amount = parseFloat(numbers) / 100;
    // Formata como número brasileiro (sem o símbolo R$)
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    // Remove tudo que não é dígito
    const numbers = inputValue.replace(/\D/g, '');

    // Atualiza o display formatado
    const formatted = formatCurrency(numbers);
    setAmountDisplay(formatted);

    // Extrai o valor numérico (divide por 100 porque estamos trabalhando com centavos)
    const numericValue = numbers ? parseFloat(numbers) / 100 : 0;
    setFormData({ ...formData, amount: numericValue.toString() });
  };

  const handleAmountFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Ao focar, seleciona todo o texto para facilitar substituição
    e.target.select();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.description || !amountDisplay || amountDisplay === '0,00') {
      return;
    }

    try {
      // Converte o valor formatado para número
      const numericAmount = parseFloat(amountDisplay.replace(/\./g, '').replace(',', '.'));

      // Parse da data sem problemas de timezone
      const [year, month, day] = formData.date.split('-').map(Number);
      const localDate = new Date(year, month - 1, day);

      await onSave({
        projectId,
        workspaceId,
        number: formData.number,
        description: formData.description,
        amount: numericAmount,
        date: localDate,
        status: formData.status
      });
      onClose();
    } catch (error) {
      console.error("Error saving invoice:", error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Nova Fatura</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {/* Seletor de tipo de fatura para projetos recorrentes */}
          {isRecurring && (
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">Tipo de Fatura</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setInvoiceType('custom')}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${invoiceType === 'custom'
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                >
                  <span className="material-symbols-outlined text-sm mr-1">receipt</span>
                  Personalizada
                </button>
                <button
                  type="button"
                  onClick={() => setInvoiceType('implementation')}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${invoiceType === 'implementation'
                      ? 'bg-indigo-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                >
                  <span className="material-symbols-outlined text-sm mr-1">build</span>
                  Implementação
                </button>
                <button
                  type="button"
                  onClick={() => setInvoiceType('recurring')}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${invoiceType === 'recurring'
                      ? 'bg-amber-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                >
                  <span className="material-symbols-outlined text-sm mr-1">autorenew</span>
                  Mensalidade
                </button>
              </div>
              {invoiceType === 'recurring' && recurringAmount > 0 && (
                <p className="text-xs text-amber-600 mt-2">
                  Valor da mensalidade: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(recurringAmount)}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold mb-1.5">Número da Fatura</label>
            <input
              type="text"
              value={formData.number}
              onChange={(e) => setFormData({ ...formData, number: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">Descrição</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Ex: Fatura principal do projeto"
              className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1.5">Valor</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none font-medium">R$</span>
                <input
                  type="text"
                  value={amountDisplay}
                  onChange={handleAmountChange}
                  onFocus={handleAmountFocus}
                  placeholder="0,00"
                  className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5">Data</label>
              <div className="relative date-picker-container overflow-visible" ref={datePickerRef}>
                <button
                  type="button"
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs text-left flex items-center justify-between hover:border-primary/50 transition-colors"
                >
                  <span className={formData.date ? 'text-slate-900 dark:text-white' : 'text-slate-400'}>
                    {formData.date
                      ? (() => {
                        const [year, month, day] = formData.date.split('-').map(Number);
                        return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
                      })()
                      : 'Selecione uma data'
                    }
                  </span>
                  <span className="material-symbols-outlined text-sm text-slate-400">calendar_today</span>
                </button>
                {showDatePicker && (
                  <DatePicker
                    selectedDate={formData.date ? (() => {
                      const [year, month, day] = formData.date.split('-').map(Number);
                      return new Date(year, month - 1, day);
                    })() : null}
                    onSelectDate={(date) => {
                      if (date) {
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        setFormData({ ...formData, date: `${year}-${month}-${day}` });
                        setShowDatePicker(false);
                      }
                    }}
                    onClose={() => setShowDatePicker(false)}
                  />
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'Paid' | 'Pending' | 'Overdue' })}
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary"
            >
              <option value="Pending">Pendente</option>
              <option value="Paid">Pago</option>
              <option value="Overdue">Atrasado</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-8 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 transition-all"
            >
              Criar Fatura
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const EditInvoiceModal: React.FC<{
  invoice: Invoice;
  onClose: () => void;
  onSave: (updates: Partial<Invoice>) => Promise<void>;
}> = ({ invoice, onClose, onSave }) => {
  const formatCurrencyDisplay = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatCurrency = (value: string): string => {
    // Remove tudo que não é dígito
    const numbers = value.replace(/\D/g, '');
    if (numbers === '' || numbers === '0') return '0,00';

    // Converte para número e divide por 100 para ter centavos
    const amount = parseFloat(numbers) / 100;
    // Formata como número brasileiro (sem o símbolo R$)
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const [formData, setFormData] = useState({
    number: invoice.number,
    description: invoice.description,
    amount: formatCurrencyDisplay(invoice.amount),
    date: (() => {
      if (invoice.date instanceof Date) {
        const year = invoice.date.getFullYear();
        const month = String(invoice.date.getMonth() + 1).padStart(2, '0');
        const day = String(invoice.date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      } else if (typeof invoice.date === 'string' && invoice.date.includes('-')) {
        return invoice.date.split('T')[0]; // Já está no formato YYYY-MM-DD
      } else if (invoice.date?.toDate) {
        const d = invoice.date.toDate();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      return new Date().toISOString().split('T')[0];
    })(),
    status: invoice.status
  });
  const [amountDisplay, setAmountDisplay] = useState<string>(formatCurrencyDisplay(invoice.amount));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Fechar date picker ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (showDatePicker && datePickerRef.current && !datePickerRef.current.contains(target)) {
        setShowDatePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDatePicker]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    // Remove tudo que não é dígito
    const numbers = inputValue.replace(/\D/g, '');

    // Atualiza o display formatado
    const formatted = formatCurrency(numbers);
    setAmountDisplay(formatted);

    // Atualiza formData com o valor formatado para manter consistência
    setFormData({ ...formData, amount: formatted });
  };

  const handleAmountFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Ao focar, seleciona todo o texto para facilitar substituição
    e.target.select();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.description || !amountDisplay || amountDisplay === '0,00') {
      return;
    }

    try {
      // Converte o valor formatado para número
      const numericAmount = parseFloat(amountDisplay.replace(/\./g, '').replace(',', '.'));

      // Parse da data sem problemas de timezone
      const [year, month, day] = formData.date.split('-').map(Number);
      const localDate = new Date(year, month - 1, day);

      await onSave({
        number: formData.number,
        description: formData.description,
        amount: numericAmount,
        date: localDate,
        status: formData.status
      });
      onClose();
    } catch (error) {
      console.error("Error saving invoice:", error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Editar Fatura</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5 text-slate-700 dark:text-slate-300">Número da Fatura</label>
            <input
              type="text"
              value={formData.number}
              onChange={(e) => setFormData({ ...formData, number: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-primary focus:border-primary"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5 text-slate-700 dark:text-slate-300">Descrição</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Ex: Fatura principal do projeto"
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-primary focus:border-primary"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1.5">Valor</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none font-medium">R$</span>
                <input
                  type="text"
                  value={amountDisplay}
                  onChange={handleAmountChange}
                  onFocus={handleAmountFocus}
                  placeholder="0,00"
                  className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5">Data</label>
              <div className="relative date-picker-container overflow-visible" ref={datePickerRef}>
                <button
                  type="button"
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs text-left flex items-center justify-between hover:border-primary/50 transition-colors"
                >
                  <span className={formData.date ? 'text-slate-900 dark:text-white' : 'text-slate-400'}>
                    {formData.date
                      ? (() => {
                        const [year, month, day] = formData.date.split('-').map(Number);
                        return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
                      })()
                      : 'Selecione uma data'
                    }
                  </span>
                  <span className="material-symbols-outlined text-sm text-slate-400">calendar_today</span>
                </button>
                {showDatePicker && (
                  <DatePicker
                    selectedDate={formData.date ? (() => {
                      const [year, month, day] = formData.date.split('-').map(Number);
                      return new Date(year, month - 1, day);
                    })() : null}
                    onSelectDate={(date) => {
                      if (date) {
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        setFormData({ ...formData, date: `${year}-${month}-${day}` });
                        setShowDatePicker(false);
                      }
                    }}
                    onClose={() => setShowDatePicker(false)}
                  />
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5 text-slate-700 dark:text-slate-300">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'Paid' | 'Pending' | 'Overdue' })}
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary"
            >
              <option value="Pending">Pendente</option>
              <option value="Paid">Pago</option>
              <option value="Overdue">Atrasado</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-300 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-8 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 transition-all"
            >
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// DatePicker para modais de fatura - renderiza como modal fixo
const DatePicker: React.FC<{ selectedDate: Date | null; onSelectDate: (date: Date | null) => void; onClose: () => void }> = ({ selectedDate, onSelectDate, onClose }) => {
  const [currentMonth, setCurrentMonth] = useState(selectedDate || new Date());
  const today = new Date();

  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const lastDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  const startingDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  const days: (Date | null)[] = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i));
  }

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const isToday = (date: Date | null) => {
    if (!date) return false;
    return date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate();
  };

  const isSelected = (date: Date | null) => {
    if (!date || !selectedDate) return false;
    return date.getFullYear() === selectedDate.getFullYear() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getDate() === selectedDate.getDate();
  };

  const handleDateClick = (date: Date | null) => {
    if (date) {
      const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      onSelectDate(localDate);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[100]" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-4 w-72"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={prevMonth}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined text-lg text-slate-600 dark:text-slate-400">chevron_left</span>
          </button>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {months[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </h3>
          <button
            type="button"
            onClick={nextMonth}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined text-lg text-slate-600 dark:text-slate-400">chevron_right</span>
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((day) => (
            <div key={day} className="text-center text-xs font-semibold text-slate-500 dark:text-slate-400 py-1">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((date, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleDateClick(date)}
              disabled={!date}
              className={`
                aspect-square flex items-center justify-center text-xs font-medium rounded-lg transition-all
                ${!date ? 'cursor-default' : 'cursor-pointer hover:bg-primary/10'}
                ${date && isToday(date) ? 'ring-2 ring-primary' : ''}
                ${date && isSelected(date)
                  ? 'bg-primary text-white hover:bg-primary/90'
                  : date
                    ? 'text-slate-700 dark:text-slate-300 hover:text-primary'
                    : 'text-transparent'
                }
              `}
            >
              {date ? date.getDate() : ''}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => onSelectDate(null)}
            className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            Limpar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

