
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { Invoice, Project, Workspace, Category } from '../types';
import { subscribeToInvoices, subscribeToProjects, updateInvoice, deleteInvoice, getProjects, subscribeToCategories, addInvoice, updateProject } from '../firebase/services';
import { AsaasChargeModal, AsaasChargeResultModal } from '../components/AsaasChargeModal';
import { AsaasPaymentResult, cancelAsaasPayment } from '../firebase/asaas';

type PeriodOption = {
  value: string | number;
  label: string;
};

const PeriodSelect: React.FC<{
  value: string | number;
  onChange: (value: string | number) => void;
  options: PeriodOption[];
  icon: string;
  label: string;
  minWidth?: string;
}> = ({ value, onChange, options, icon, label, minWidth = 'min-w-[180px]' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (containerRef.current?.contains(target) || target.closest('[data-period-dropdown]')) return;
      setIsOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownRect({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
      });
    } else {
      setDropdownRect(null);
    }
  }, [isOpen]);

  const selectedOption = options.find(option => option.value === value) ?? options[0];

  const dropdownContent = isOpen && dropdownRect && (
    <div
      data-period-dropdown
      className="fixed z-[200] overflow-hidden rounded-xl border border-slate-200/60 dark:border-slate-600/50 bg-white/95 dark:bg-slate-800/95 shadow-lg backdrop-blur-md"
      style={{
        top: dropdownRect.top,
        left: dropdownRect.left,
        width: dropdownRect.width,
      }}
    >
      <div className="max-h-72 overflow-y-auto p-1.5">
        {options.map(option => {
          const isSelected = option.value === value;
          return (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${isSelected
                ? 'bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary font-medium'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 font-normal'
                }`}
              role="option"
              aria-selected={isSelected}
            >
              <span>{option.label}</span>
              {isSelected && <span className="material-symbols-outlined text-sm text-primary">check</span>}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      <div ref={containerRef} className={`relative ${minWidth}`}>
        <button
          type="button"
          onClick={() => setIsOpen(prev => !prev)}
          className={`group flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-all outline-none ${isOpen
            ? 'border-primary/40 dark:border-primary/40 bg-slate-50 dark:bg-slate-800/60 ring-2 ring-primary/20'
            : 'border-slate-200/60 dark:border-slate-600/60 bg-slate-50/80 dark:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-100/80 dark:hover:bg-slate-800/70'
            }`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/5 dark:bg-primary/10 text-primary">
            <span className="material-symbols-outlined text-[16px]">{icon}</span>
          </div>
          <div className="min-w-0 flex-1">
            <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {label}
            </span>
            <span className="block truncate text-sm font-medium text-slate-700 dark:text-slate-200">
              {selectedOption.label}
            </span>
          </div>
          <span className={`material-symbols-outlined text-base text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary' : 'group-hover:text-slate-600 dark:group-hover:text-slate-300'}`}>
            expand_more
          </span>
        </button>
      </div>
      {dropdownContent && createPortal(dropdownContent, document.body)}
    </>
  );
};

interface FinancialProps {
  currentWorkspace?: Workspace | null;
  onCreateInvoice?: () => void;
  onProjectClick?: (project: Project) => void;
  canEdit?: boolean;
}

export const Financial: React.FC<FinancialProps> = ({ currentWorkspace, onCreateInvoice, onProjectClick, canEdit = true }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'paid' | 'pending' | 'implementation' | 'recurring' | 'normal'>('all');
  const [categories, setCategories] = useState<Category[]>([]);
  const [showRecurringConfirm, setShowRecurringConfirm] = useState(false);
  const [paidInvoiceForRecurring, setPaidInvoiceForRecurring] = useState<Invoice | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Estados para integração Asaas
  const [showAsaasModal, setShowAsaasModal] = useState(false);
  const [selectedInvoiceForAsaas, setSelectedInvoiceForAsaas] = useState<Invoice | null>(null);
  const [asaasResult, setAsaasResult] = useState<AsaasPaymentResult | null>(null);
  const [cancelingAsaas, setCancelingAsaas] = useState<string | null>(null);

  // Filtro de período (mês/ano)
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());

  // Estado para modal de nova fatura recorrente
  const [recurringInvoiceDateMode, setRecurringInvoiceDateMode] = useState<'original' | 'custom'>('original');
  const [customRecurringDate, setCustomRecurringDate] = useState('');
  const [showRecurringCustomDatePicker, setShowRecurringCustomDatePicker] = useState(false);
  const recurringCustomDatePickerButtonRef = useRef<HTMLButtonElement>(null);

  // Nomes dos meses
  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  // Gerar lista de anos disponíveis (últimos 3 anos + atual)
  const availableYears = Array.from({ length: 4 }, (_, i) => currentDate.getFullYear() - i);
  const monthOptions: PeriodOption[] = useMemo(() => ([
    { value: 'all', label: 'Todos os meses' },
    ...monthNames.map((month, index) => ({ value: index, label: month }))
  ]), [monthNames]);
  const yearOptions: PeriodOption[] = useMemo(() => (
    availableYears.map(year => ({ value: year, label: String(year) }))
  ), [availableYears]);

  // Carregar dados do Firebase
  useEffect(() => {
    if (!currentWorkspace?.id) {
      setLoading(false);
      return;
    }

    const unsubscribeInvoices = subscribeToInvoices((fetchedInvoices) => {
      // Filtrar faturas do workspace atual
      const workspaceInvoices = fetchedInvoices.filter(inv => inv.workspaceId === currentWorkspace.id);
      setInvoices(workspaceInvoices);
      setLoading(false);
    }); // Sem projectId para buscar todas as faturas

    const unsubscribeProjects = subscribeToProjects((fetchedProjects) => {
      const workspaceProjects = fetchedProjects.filter(p => p.workspaceId === currentWorkspace.id);
      setProjects(workspaceProjects);
    }, currentWorkspace.id);

    const unsubscribeCategories = subscribeToCategories((fetchedCategories) => {
      setCategories(fetchedCategories);
    }, currentWorkspace.id);

    return () => {
      unsubscribeInvoices();
      unsubscribeProjects();
      unsubscribeCategories();
    };
  }, [currentWorkspace?.id]);

  // Função helper para obter data de uma fatura (retorna timestamp para comparação)
  const getInvoiceDate = useCallback((date: Date | any): Date => {
    if (!date) return new Date(0);

    // Se for um Firestore Timestamp
    if (date?.toDate) {
      return date.toDate();
    }

    // Se for uma Date
    if (date instanceof Date) {
      return date;
    }

    // Se for uma string no formato ISO ou YYYY-MM-DD
    if (typeof date === 'string') {
      // Formato YYYY-MM-DD
      if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = date.split('-').map(Number);
        return new Date(year, month - 1, day, 12, 0, 0); // Usar meio-dia para evitar problemas de timezone
      }
      // Tentar parsing padrão
      const parsed = new Date(date);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    // Se for um número (timestamp)
    if (typeof date === 'number') {
      return new Date(date);
    }

    // Se for um objeto com propriedades de data (Firebase Timestamp serializado)
    if (date && typeof date === 'object' && ('seconds' in date || 'nanoseconds' in date)) {
      // Firebase Timestamp serializado
      if ('seconds' in date) {
        return new Date(date.seconds * 1000);
      }
    }

    return new Date(0);
  }, []);

  // Filtrar faturas por período selecionado (por data de vencimento)
  const filteredByPeriod = useMemo(() => {
    return invoices.filter(inv => {
      if (selectedMonth === 'all') {
        const invDate = getInvoiceDate(inv.date);
        return invDate.getFullYear() === selectedYear;
      }
      const invDate = getInvoiceDate(inv.date);
      return invDate.getMonth() === selectedMonth && invDate.getFullYear() === selectedYear;
    });
  }, [invoices, selectedMonth, selectedYear, getInvoiceDate]);

  // Mês efetivo de recebimento: cartão de crédito cai no mês seguinte
  const getEffectiveReceiveDate = useCallback((inv: Invoice): { month: number; year: number } => {
    const invDate = getInvoiceDate(inv.date);
    if (inv.status === 'Paid' && inv.paidByCreditCard) {
      const next = new Date(invDate.getFullYear(), invDate.getMonth() + 1, 1);
      return { month: next.getMonth(), year: next.getFullYear() };
    }
    return { month: invDate.getMonth(), year: invDate.getFullYear() };
  }, [getInvoiceDate]);

  // Faturas cujo valor entra no fluxo de caixa no período selecionado
  const receivedInPeriod = useMemo(() => {
    return invoices.filter(inv => {
      if (inv.status !== 'Paid') return false;
      const { month, year } = getEffectiveReceiveDate(inv);
      if (selectedMonth === 'all') return year === selectedYear;
      return month === selectedMonth && year === selectedYear;
    });
  }, [invoices, selectedMonth, selectedYear, getEffectiveReceiveDate]);

  // Calcular métricas (totalReceived usa mês efetivo; totalPending e totais por tipo usam data de vencimento)
  const metrics = {
    totalReceived: receivedInPeriod.reduce((sum, inv) => sum + inv.amount, 0),
    totalPending: filteredByPeriod.filter(inv => inv.status === 'Pending').reduce((sum, inv) => sum + inv.amount, 0),
    implementationTotal: filteredByPeriod.filter(inv => inv.number.startsWith('IMP-')).reduce((sum, inv) => sum + inv.amount, 0),
    implementationPaid: receivedInPeriod.filter(inv => inv.number.startsWith('IMP-')).reduce((sum, inv) => sum + inv.amount, 0),
    recurringTotal: filteredByPeriod.filter(inv => inv.number.startsWith('REC-')).reduce((sum, inv) => sum + inv.amount, 0),
    recurringPaid: receivedInPeriod.filter(inv => inv.number.startsWith('REC-')).reduce((sum, inv) => sum + inv.amount, 0),
    normalTotal: filteredByPeriod.filter(inv => inv.number.startsWith('INV-')).reduce((sum, inv) => sum + inv.amount, 0),
    normalPaid: receivedInPeriod.filter(inv => inv.number.startsWith('INV-')).reduce((sum, inv) => sum + inv.amount, 0),
    paidCount: filteredByPeriod.filter(inv => inv.status === 'Paid').length,
    pendingCount: filteredByPeriod.filter(inv => inv.status === 'Pending').length,
  };

  // Receita por Tipo: Avulso = Implementação + Avulso (INV-); Mensalidade separada
  const pieData = [
    { name: 'Avulso', value: metrics.implementationTotal + metrics.normalTotal, color: '#f59e0b' },
    { name: 'Mensalidade', value: metrics.recurringTotal, color: '#10b981' },
  ].filter(item => item.value > 0);

  // Gerar dados de receita por mês — Avulso = Implementação + Avulso (INV-) recebidos; Mensalidade; Pendente
  const generateMonthlyRevenueData = useMemo(() => {
    const shortMonthNames = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const year = selectedYear;
    const data: { name: string; avulso: number; mensalidade: number; pendente: number }[] = [];

    for (let month = 0; month < 12; month++) {
      const monthInvoices = invoices.filter(inv => {
        const invDate = getInvoiceDate(inv.date);
        return invDate.getMonth() === month && invDate.getFullYear() === year;
      });

      const receivedThisMonth = invoices.filter(inv => {
        if (inv.status !== 'Paid') return false;
        const { month: effMonth, year: effYear } = getEffectiveReceiveDate(inv);
        return effMonth === month && effYear === year;
      });

      const avulso = receivedThisMonth
        .filter(inv => inv.number.startsWith('IMP-') || inv.number.startsWith('INV-'))
        .reduce((sum, inv) => sum + inv.amount, 0);
      const mensalidade = receivedThisMonth
        .filter(inv => inv.number.startsWith('REC-'))
        .reduce((sum, inv) => sum + inv.amount, 0);
      const pendente = monthInvoices
        .filter(inv => inv.status === 'Pending')
        .reduce((sum, inv) => sum + inv.amount, 0);

      data.push({
        name: shortMonthNames[month],
        avulso,
        mensalidade,
        pendente,
      });
    }

    return data;
  }, [invoices, selectedYear, getInvoiceDate, getEffectiveReceiveDate]);

  // Filtrar faturas (usando faturas já filtradas por período)
  const filteredInvoices = useMemo(() => {
    const filtered = filteredByPeriod.filter(inv => {
      switch (selectedFilter) {
        case 'paid': return inv.status === 'Paid';
        case 'pending': return inv.status === 'Pending';
        case 'implementation': return inv.number.startsWith('IMP-');
        case 'recurring': return inv.number.startsWith('REC-');
        case 'normal': return inv.number.startsWith('INV-');
        default: return true;
      }
    });

    // Criar uma cópia do array antes de ordenar (sort modifica o array original)
    const sorted = [...filtered].sort((a, b) => {
      const dateA = getInvoiceDate(a.date);
      const dateB = getInvoiceDate(b.date);
      const timeA = dateA.getTime();
      const timeB = dateB.getTime();

      // Se as datas forem iguais, ordenar por número da fatura
      if (timeA === timeB) {
        return a.number.localeCompare(b.number);
      }

      // Ordenar por data: mais antiga primeiro (menor timestamp primeiro)
      return timeA - timeB;
    });

    return sorted;
  }, [filteredByPeriod, selectedFilter, getInvoiceDate]);

  // Identificar faturas órfãs (sem projeto associado)
  const orphanInvoices = useMemo(() => {
    return filteredInvoices.filter(inv => {
      const project = projects.find(p => p.id === inv.projectId);
      return !project;
    });
  }, [filteredInvoices, projects]);

  // Função para excluir faturas órfãs
  const deleteOrphanInvoices = async () => {
    if (orphanInvoices.length === 0) {
      setToast({ message: 'Nenhuma fatura órfã encontrada', type: 'success' });
      return;
    }

    if (!confirm(`Tem certeza que deseja excluir ${orphanInvoices.length} fatura(s) órfã(s) (projetos não encontrados)?`)) {
      return;
    }

    try {
      const deletePromises = orphanInvoices.map(inv => deleteInvoice(inv.id));
      await Promise.all(deletePromises);
      setToast({ message: `${orphanInvoices.length} fatura(s) órfã(s) excluída(s) com sucesso`, type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      console.error('Error deleting orphan invoices:', error);
      setToast({ message: 'Erro ao excluir faturas órfãs', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  // Obter nome do projeto
  const getProjectName = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    return project?.name || 'Projeto não encontrado';
  };

  // Obter cliente do projeto
  const getProjectClient = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    return project?.client || '-';
  };

  // Formatar data
  const formatDate = (date: Date | any): string => {
    if (!date) return '-';
    const d = date instanceof Date ? date : date?.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Obter tipo da fatura
  // Implementação e Avulso (INV-) tratados como "Avulso"; Mensalidade separada
  const getInvoiceType = (number: string) => {
    if (number.startsWith('REC-')) return { label: 'Mensalidade', color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400' };
    return { label: 'Avulso', color: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' };
  };

  // Helper para calcular a data da próxima mensalidade (mesmo dia do próximo mês)
  const getRecurringDueDate = (previousInvoice: Invoice, mode: 'original' | 'custom' = 'original', customDate?: string): Date => {
    if (mode === 'custom' && customDate) {
      const [year, month, day] = customDate.split('-').map(Number);
      const custom = new Date(year, month - 1, day);
      if (!Number.isNaN(custom.getTime())) {
        return custom;
      }
    }

    const previousDate = getInvoiceDate(previousInvoice.date);
    const nextDate = new Date(previousDate.getFullYear(), previousDate.getMonth() + 1, previousDate.getDate());

    // Garantir que não pulamos o mês se o dia for 31 e o próximo mês tiver 30
    if (nextDate.getDate() !== previousDate.getDate()) {
      nextDate.setDate(0);
    }

    return nextDate;
  };

  const getCustomDefaultDueDate = (): Date => {
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());

    if (nextMonth.getDate() !== today.getDate()) {
      nextMonth.setDate(0);
    }

    return nextMonth;
  };

  // Criar nova fatura recorrente
  const createRecurringInvoice = async (previousInvoice: Invoice, mode: 'original' | 'custom' = 'original', customDate?: string) => {
    try {
      const nextDate = mode === 'custom' && customDate
        ? (() => {
          const [y, m, d] = customDate.split('-').map(Number);
          return new Date(y, m - 1, d);
        })()
        : getRecurringDueDate(previousInvoice);

      // Gerar número sequencial baseado nas faturas do PROJETO
      const projectInvoices = invoices.filter(inv => inv.projectId === previousInvoice.projectId);
      const year = nextDate.getFullYear();
      const count = projectInvoices.length + 1;

      await addInvoice({
        projectId: previousInvoice.projectId,
        workspaceId: previousInvoice.workspaceId,
        number: `REC-${year}-${String(count).padStart(3, '0')}`,
        description: 'Mensalidade - Recorrência',
        amount: previousInvoice.amount,
        date: nextDate,
        status: 'Pending'
      });

      setToast({ message: "Nova fatura recorrente criada com sucesso!", type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      console.error("Error creating recurring invoice:", error);
      setToast({ message: "Erro ao criar fatura recorrente", type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  // Atualizar status da fatura
  const toggleInvoiceStatus = async (invoice: Invoice) => {
    try {
      const newStatus = invoice.status === 'Paid' ? 'Pending' : 'Paid';
      await updateInvoice(invoice.id, { status: newStatus });

      // Atualizar a lista local de faturas para o cálculo de sync
      const updatedInvoices = invoices.map(inv =>
        inv.id === invoice.id ? { ...inv, status: newStatus } : inv
      );

      setToast({ message: `Fatura marcada como ${newStatus === 'Paid' ? 'paga' : 'pendente'}`, type: 'success' });

      // Lógica para sincronizar flags do projeto
      const project = projects.find(p => p.id === invoice.projectId);
      if (project) {
        const projectInvoices = updatedInvoices.filter(inv => inv.projectId === project.id);
        const projTypes = project.types || (project.type ? [project.type] : []);
        const isRecurring = projTypes.some(typeName =>
          categories.find(cat => cat.name === typeName && cat.isRecurring)
        );

        if (isRecurring) {
          // Sync para projeto recorrente
          const recurringInvoices = projectInvoices.filter(inv => inv.number.startsWith('REC-'));
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const nextRecurringPaid = recurringInvoices.length > 0 && recurringInvoices.every(inv => {
            if (inv.status === 'Paid') return true;
            const date = inv.date?.toDate ? inv.date.toDate() : new Date(inv.date);
            const invoiceDate = new Date(date);
            invoiceDate.setHours(0, 0, 0, 0);
            return invoiceDate >= today;
          });

          const implementationInvoices = projectInvoices.filter(inv => inv.number.startsWith('IMP-'));
          const nextImplementationPaid = implementationInvoices.length === 0
            ? project.isImplementationPaid
            : implementationInvoices.every(inv => inv.status === 'Paid');

          const updates: Partial<Project> = {};
          if (nextRecurringPaid !== project.isRecurringPaid) {
            updates.isRecurringPaid = nextRecurringPaid;
          }
          if (nextImplementationPaid !== project.isImplementationPaid) {
            updates.isImplementationPaid = nextImplementationPaid;
          }

          if (Object.keys(updates).length > 0) {
            await updateProject(project.id, updates);
          }

          // Se marcou como pago e é recorrente, oferecer criar próxima
          if (newStatus === 'Paid' && !invoice.number.startsWith('IMP-')) {
            setPaidInvoiceForRecurring(invoice);
            setRecurringInvoiceDateMode('original');

            const customDefault = getCustomDefaultDueDate();
            const formattedCustom = `${customDefault.getFullYear()}-${String(customDefault.getMonth() + 1).padStart(2, '0')}-${String(customDefault.getDate()).padStart(2, '0')}`;
            setCustomRecurringDate(formattedCustom);

            setShowRecurringCustomDatePicker(false);
            setShowRecurringConfirm(true);
          }
        } else {
          // Sync para projeto normal
          const nextIsPaid = projectInvoices.length > 0 ? projectInvoices.every(inv => inv.status === 'Paid') : false;
          if (nextIsPaid !== project.isPaid) {
            await updateProject(project.id, { isPaid: nextIsPaid });
          }
        }
      }

      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      console.error('Error updating invoice:', error);
      setToast({ message: 'Erro ao atualizar fatura', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  // Função para abrir modal de cobrança Asaas
  const handleOpenAsaasModal = (invoice: Invoice) => {
    setSelectedInvoiceForAsaas(invoice);
    setShowAsaasModal(true);
  };

  // Função para lidar com sucesso na criação de cobrança
  const handleAsaasSuccess = (result: AsaasPaymentResult) => {
    setShowAsaasModal(false);
    setSelectedInvoiceForAsaas(null);
    setAsaasResult(result);
    setToast({ message: 'Cobrança gerada com sucesso!', type: 'success' });
    setTimeout(() => setToast(null), 3000);
  };

  // Função para cancelar cobrança Asaas
  const handleCancelAsaasPayment = async (invoice: Invoice) => {
    if (!currentWorkspace?.id || !invoice.asaasPaymentId) return;

    if (!confirm('Tem certeza que deseja cancelar esta cobrança no Asaas?')) return;

    setCancelingAsaas(invoice.id);
    try {
      await cancelAsaasPayment(currentWorkspace.id, invoice.asaasPaymentId, invoice.id);
      setToast({ message: 'Cobrança cancelada com sucesso!', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (error: any) {
      console.error('Error canceling Asaas payment:', error);
      setToast({ message: error.message || 'Erro ao cancelar cobrança', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setCancelingAsaas(null);
    }
  };

  // Verificar se a fatura está vencida
  const isOverdue = (date: Date | any): boolean => {
    if (!date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Zerar hora para comparar apenas data

    const invoiceDate = getInvoiceDate(date);
    invoiceDate.setHours(0, 0, 0, 0);

    return invoiceDate.getTime() < today.getTime();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}>
          {toast.message}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 animate-fade-in">
        <div className="animate-fade-in">
          <h2 className="text-4xl font-black tracking-tight font-display text-slate-900 dark:text-white mb-2">
            Controle <span className="text-primary">Financeiro</span>
          </h2>
          <p className="text-base text-slate-500 font-medium font-jakarta">Acompanhe todas as receitas e faturas com precisão cirúrgica</p>
        </div>
      </div>

      {/* Filtro de Período — estilo leve e harmonioso */}
      <div className="relative rounded-xl border border-slate-200/60 dark:border-slate-600/50 bg-slate-50/50 dark:bg-slate-900/50 p-5 border-l-[3px] border-l-primary/60 shadow-sm mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="size-9 rounded-lg bg-primary/5 dark:bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-xl">calendar_today</span>
              </div>
              <div>
                <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400 block">Filtro de</span>
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200 block">Período</span>
              </div>
            </div>

            <div className="hidden sm:block w-px h-8 bg-slate-200/80 dark:bg-slate-600/60"></div>

            <PeriodSelect
              value={selectedMonth}
              onChange={(value) => setSelectedMonth(value === 'all' ? 'all' : Number(value))}
              options={monthOptions}
              icon="event_note"
              label="Mês"
              minWidth="min-w-[180px]"
            />

            <PeriodSelect
              value={selectedYear}
              onChange={(value) => setSelectedYear(Number(value))}
              options={yearOptions}
              icon="schedule"
              label="Ano"
              minWidth="min-w-[100px]"
            />

            <div className="flex items-center p-0.5 bg-slate-200/50 dark:bg-slate-700/40 rounded-lg">
              <button
                onClick={() => {
                  setSelectedMonth(currentDate.getMonth());
                  setSelectedYear(currentDate.getFullYear());
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${selectedMonth === currentDate.getMonth() && selectedYear === currentDate.getFullYear()
                  ? 'bg-white dark:bg-slate-600/60 text-primary shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
              >
                Este mês
              </button>
              <button
                onClick={() => {
                  setSelectedMonth('all');
                  setSelectedYear(currentDate.getFullYear());
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${selectedMonth === 'all' && selectedYear === currentDate.getFullYear()
                  ? 'bg-white dark:bg-slate-600/60 text-primary shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
              >
                Este ano
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/10">
            <div className="size-1.5 rounded-full bg-primary/80"></div>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {filteredByPeriod.length} fatura{filteredByPeriod.length !== 1 ? 's' : ''} em{' '}
              <span className="text-primary font-medium">
                {selectedMonth === 'all' ? selectedYear : `${monthNames[selectedMonth as number]} ${selectedYear}`}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        <KPICard
          title="Total Recebido"
          value={formatCurrency(metrics.totalReceived)}
          subtitle={`${metrics.paidCount} faturas pagas`}
          variant="success"
          icon="account_balance"
        />
        <KPICard
          title="Fatura pendente"
          value={formatCurrency(metrics.totalPending)}
          subtitle=""
          variant="warning"
          icon="pending_actions"
        />
        <KPICard
          title="Avulso"
          value={formatCurrency(metrics.implementationPaid + metrics.normalPaid)}
          subtitle={`de ${formatCurrency(metrics.implementationTotal + metrics.normalTotal)} total`}
          variant="avulso"
          icon="receipt"
        />
        <KPICard
          title="Mensalidades"
          value={formatCurrency(metrics.recurringPaid)}
          subtitle={`de ${formatCurrency(metrics.recurringTotal)} total`}
          variant="accent"
          icon="autorenew"
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Receita por Mês <span className="text-primary font-bold">{selectedYear}</span>
              </h3>
            </div>
            <div className="flex items-center gap-5 text-xs">
              <div className="flex items-center gap-2">
                <div className="size-3 rounded-sm bg-amber-500"></div>
                <span className="text-slate-600 dark:text-slate-400 font-medium">Avulso</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-3 rounded-sm bg-emerald-500"></div>
                <span className="text-slate-600 dark:text-slate-400 font-medium">Mensalidade</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-3 rounded-sm bg-red-500"></div>
                <span className="text-slate-600 dark:text-slate-400 font-medium">Pendente</span>
              </div>
            </div>
          </div>
          <div className="h-72 w-full">
            {generateMonthlyRevenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={generateMonthlyRevenueData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="barAvulso" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={1} />
                      <stop offset="100%" stopColor="#d97706" stopOpacity={0.9} />
                    </linearGradient>
                    <linearGradient id="barMensalidade" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                      <stop offset="100%" stopColor="#059669" stopOpacity={0.9} />
                    </linearGradient>
                    <linearGradient id="barPendente" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={1} />
                      <stop offset="100%" stopColor="#dc2626" stopOpacity={0.9} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(226 232 240)" className="dark:stroke-slate-700" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fontWeight: 600, fill: 'rgb(100 116 139)' }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: 'rgb(100 116 139)' }}
                    tickFormatter={(v) => (v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`)}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const colorByKey: Record<string, string> = {
                        avulso: '#f59e0b',
                        mensalidade: '#10b981',
                        pendente: '#ef4444',
                      };
                      return (
                        <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-xl px-4 py-3 min-w-[160px]">
                          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Mês: {label}</p>
                          {payload.map((entry) => (
                            <div key={entry.dataKey} className="flex items-center justify-between gap-4 text-sm">
                              <span className="font-medium" style={{ color: colorByKey[String(entry.dataKey)] ?? 'inherit' }}>{entry.name}</span>
                              <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(Number(entry.value))}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }}
                    contentStyle={{ backgroundColor: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }}
                    wrapperStyle={{ outline: 'none' }}
                    cursor={{ fill: 'rgba(99, 102, 241, 0.1)', stroke: 'rgba(99, 102, 241, 0.35)', strokeWidth: 1.5 }}
                  />
                  <Bar dataKey="avulso" name="Avulso" fill="url(#barAvulso)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="mensalidade" name="Mensalidade" fill="url(#barMensalidade)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="pendente" name="Pendente" fill="url(#barPendente)" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <span className="material-symbols-outlined text-5xl mb-3">bar_chart</span>
                <p className="text-sm font-medium">Nenhum dado para exibir</p>
                <p className="text-xs">Selecione um período com faturas</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Receita por Tipo</h3>
            <p className="text-sm text-slate-500 mt-0.5">Distribuição de faturas</p>
          </div>
          {pieData.length > 0 ? (
            <>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="transparent"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid rgb(226 232 240)',
                        boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                        padding: '12px 16px',
                        backgroundColor: 'white',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-2.5 mt-5">
                {pieData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-sm py-1">
                    <div className="flex items-center gap-2.5">
                      <div className="size-3 rounded-sm shrink-0" style={{ backgroundColor: item.color }}></div>
                      <span className="text-slate-600 dark:text-slate-400 font-medium">{item.name}</span>
                    </div>
                    <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <span className="material-symbols-outlined text-5xl mb-3">pie_chart</span>
              <p className="text-sm font-medium">Nenhuma fatura ainda</p>
            </div>
          )}
        </div>
      </div>

      {/* Tabela de Faturas */}
      <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl rounded-3xl border border-white/20 dark:border-slate-800/50 overflow-hidden shadow-2xl animate-fade-in" style={{ animationDelay: '300ms' }}>
        <div className="p-8 border-b border-white/20 dark:border-slate-800/50 flex flex-wrap justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <h3 className="text-xl font-black">Fluxo de Caixa</h3>
            {orphanInvoices.length > 0 && canEdit && (
              <button
                onClick={deleteOrphanInvoices}
                className="flex items-center gap-2 px-4 py-2 bg-rose-500 text-white rounded-xl text-xs font-black hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/20"
              >
                <span className="material-symbols-outlined text-sm">delete_sweep</span>
                LIMPAR Órfãs ({orphanInvoices.length})
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap bg-slate-100/50 dark:bg-slate-800/50 p-1.5 rounded-2xl backdrop-blur-md">
            <FilterButton label="TODAS" active={selectedFilter === 'all'} onClick={() => setSelectedFilter('all')} count={filteredByPeriod.length} />
            <FilterButton label="PAGAS" active={selectedFilter === 'paid'} onClick={() => setSelectedFilter('paid')} count={filteredByPeriod.filter(i => i.status === 'Paid').length} color="emerald" />
            <FilterButton label="PENDENTES" active={selectedFilter === 'pending'} onClick={() => setSelectedFilter('pending')} count={filteredByPeriod.filter(i => i.status === 'Pending').length} color="amber" />
          </div>
        </div>

        {filteredInvoices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Projeto / Cliente</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Descrição</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Data</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Valor</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  {currentWorkspace?.asaasApiKey && (
                    <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Cobrança</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredInvoices.map((invoice) => {
                  const invoiceType = getInvoiceType(invoice.number);
                  const isInvoiceOverdue = isOverdue(invoice.date);

                  return (
                    <tr key={invoice.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td
                        className="px-6 py-4 cursor-pointer"
                        onClick={() => {
                          const project = projects.find(p => p.id === invoice.projectId);
                          if (project && onProjectClick) {
                            onProjectClick(project);
                          }
                        }}
                      >
                        <div>
                          <p className="text-sm font-bold">{getProjectName(invoice.projectId)}</p>
                          <p className="text-xs text-slate-500">{getProjectClient(invoice.projectId)}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {invoice.description}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${invoiceType.color}`}>
                          {invoiceType.label}
                        </span>
                      </td>
                      <td className={`px-6 py-4 text-sm ${invoice.status === 'Pending' && isInvoiceOverdue ? 'text-red-500 font-bold' : 'text-slate-500'}`}>
                        {formatDate(invoice.date)}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold">{formatCurrency(invoice.amount)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          {invoice.status === 'Paid' && canEdit && (
                            <button
                              onClick={async () => {
                                try {
                                  await updateInvoice(invoice.id, { paidByCreditCard: !invoice.paidByCreditCard });
                                } catch (error) {
                                  console.error("Error updating paidByCreditCard:", error);
                                }
                              }}
                              title={invoice.paidByCreditCard ? "Pago no cartão - valor entra no mês seguinte" : "Marcar como pago no cartão de crédito"}
                              className={`flex items-center justify-center size-7 rounded-md text-[10px] transition-colors border shrink-0 ${invoice.paidByCreditCard
                                ? 'bg-primary/20 text-primary border-primary/40'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-600 border-slate-200 dark:border-slate-700'}`}
                            >
                              <span className="material-symbols-outlined text-sm">credit_card</span>
                            </button>
                          )}
                          <button
                            onClick={() => canEdit && toggleInvoiceStatus(invoice)}
                            disabled={!canEdit}
                            className={`flex items-center gap-1.5 ${invoice.status === 'Pending' ? 'px-4' : 'px-3'} py-1.5 rounded-lg text-xs font-bold transition-colors ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''} ${invoice.status === 'Paid'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-200'
                              : isInvoiceOverdue
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200'
                              }`}
                          >
                            <span className="material-symbols-outlined text-sm">
                              {invoice.status === 'Paid' ? 'check_circle' : 'pending'}
                            </span>
                            {invoice.status === 'Paid' ? 'Pago' : 'Pendente'}
                          </button>
                        </div>
                      </td>
                      {/* Coluna Asaas */}
                      {currentWorkspace?.asaasApiKey && (
                        <td className="px-6 py-4">
                          {invoice.asaasPaymentId ? (
                            <div className="flex items-center gap-2">
                              <span className="flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-lg text-[10px] font-bold uppercase">
                                <span className="material-symbols-outlined text-xs">link</span>
                                {invoice.asaasBillingType || 'Asaas'}
                              </span>
                              {invoice.asaasPaymentUrl && (
                                <a
                                  href={invoice.asaasPaymentUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                  title="Abrir link de pagamento"
                                >
                                  <span className="material-symbols-outlined text-sm text-slate-500">open_in_new</span>
                                </a>
                              )}
                              {canEdit && invoice.status !== 'Paid' && (
                                <button
                                  onClick={() => handleCancelAsaasPayment(invoice)}
                                  disabled={cancelingAsaas === invoice.id}
                                  className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors text-red-500"
                                  title="Cancelar cobrança"
                                >
                                  <span className="material-symbols-outlined text-sm">
                                    {cancelingAsaas === invoice.id ? 'sync' : 'cancel'}
                                  </span>
                                </button>
                              )}
                            </div>
                          ) : invoice.status !== 'Paid' && canEdit ? (
                            <button
                              onClick={() => {
                                const project = projects.find(p => p.id === invoice.projectId);
                                if (project) {
                                  handleOpenAsaasModal(invoice);
                                }
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg text-xs font-bold hover:from-green-600 hover:to-emerald-700 transition-all shadow-sm"
                            >
                              <span className="material-symbols-outlined text-sm">bolt</span>
                              Cobrar
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <span className="material-symbols-outlined text-5xl mb-3">receipt_long</span>
            <p className="text-base font-medium">Nenhuma fatura encontrada</p>
            <p className="text-sm">As faturas dos seus projetos aparecerão aqui</p>
          </div>
        )}
      </div>

      {/* Modal Confirmar Nova Fatura Recorrente */}
      {showRecurringConfirm && paidInvoiceForRecurring && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-full max-w-md shadow-2xl">
            <div className="p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
                    <span className="material-symbols-outlined text-amber-600 dark:text-amber-400">autorenew</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Criar Próxima Mensalidade?</h3>
                    <p className="text-sm text-slate-500">Projeto recorrente detectado</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowRecurringConfirm(false);
                    setPaidInvoiceForRecurring(null);
                    setRecurringInvoiceDateMode('original');
                    setCustomRecurringDate('');
                    setShowRecurringCustomDatePicker(false);
                  }}
                  className="size-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
                  aria-label="Fechar modal"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                Selecione a data de vencimento para a próxima mensalidade.
              </p>

              <div className="space-y-3 mb-6">
                <button
                  type="button"
                  onClick={() => setRecurringInvoiceDateMode('original')}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${recurringInvoiceDateMode === 'original'
                    ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 shadow-sm'
                    : 'border-slate-200 dark:border-slate-700 hover:border-amber-300 dark:hover:border-amber-700'
                    }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">Próxima mensalidade</span>
                    <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                      {getRecurringDueDate(paidInvoiceForRecurring, 'original').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                  </div>
                </button>


                <div
                  className={`w-full rounded-xl border px-4 py-3 transition-all ${recurringInvoiceDateMode === 'custom'
                    ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 shadow-sm'
                    : 'border-slate-200 dark:border-slate-700'
                    }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">Data personalizada</span>
                    <button
                      type="button"
                      onClick={() => setRecurringInvoiceDateMode('custom')}
                      className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                    >
                      Usar esta opcao
                    </button>
                  </div>
                  <div className="relative date-picker-container">
                    <button
                      type="button"
                      ref={recurringCustomDatePickerButtonRef}
                      onClick={() => {
                        setRecurringInvoiceDateMode('custom');
                        setShowRecurringCustomDatePicker(prev => !prev);
                      }}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white flex items-center justify-between"
                    >
                      <span>{customRecurringDate ? (() => {
                        const [y, m, d] = customRecurringDate.split('-').map(Number);
                        return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                      })() : 'Selecione uma data'}</span>
                      <span className="material-symbols-outlined text-sm text-slate-400">calendar_today</span>
                    </button>
                    {showRecurringCustomDatePicker && (
                      <DatePicker
                        selectedDate={(() => {
                          const [y, m, d] = customRecurringDate.split('-').map(Number);
                          return new Date(y, m - 1, d);
                        })()}
                        onSelectDate={(date) => {
                          if (date) {
                            const formatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                            setCustomRecurringDate(formatted);
                            setRecurringInvoiceDateMode('custom');
                          }
                          setShowRecurringCustomDatePicker(false);
                        }}
                        onClose={() => setShowRecurringCustomDatePicker(false)}
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">Valor</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(paidInvoiceForRecurring.amount)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">Vencimento</span>
                  <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                    {recurringInvoiceDateMode === 'original'
                      ? getRecurringDueDate(paidInvoiceForRecurring, 'original').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                      : (() => {
                        const [y, m, d] = customRecurringDate.split('-').map(Number);
                        return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                      })()
                    }
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowRecurringConfirm(false);
                    setPaidInvoiceForRecurring(null);
                    setRecurringInvoiceDateMode('original');
                    setCustomRecurringDate('');
                    setShowRecurringCustomDatePicker(false);
                  }}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Nao, obrigado
                </button>
                <button
                  onClick={async () => {
                    if (paidInvoiceForRecurring) {
                      await createRecurringInvoice(paidInvoiceForRecurring, recurringInvoiceDateMode, customRecurringDate || undefined);
                    }
                    setShowRecurringConfirm(false);
                    setPaidInvoiceForRecurring(null);
                    setRecurringInvoiceDateMode('original');
                    setCustomRecurringDate('');
                    setShowRecurringCustomDatePicker(false);
                  }}
                  disabled={recurringInvoiceDateMode === 'custom' && !customRecurringDate}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-amber-500 rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">add_circle</span>
                  Sim, criar fatura
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cobrança Asaas */}
      {showAsaasModal && selectedInvoiceForAsaas && currentWorkspace && (
        <AsaasChargeModal
          invoice={selectedInvoiceForAsaas}
          project={projects.find(p => p.id === selectedInvoiceForAsaas.projectId)!}
          workspace={currentWorkspace}
          onClose={() => {
            setShowAsaasModal(false);
            setSelectedInvoiceForAsaas(null);
          }}
          onSuccess={handleAsaasSuccess}
        />
      )}

      {/* Modal de Resultado da Cobrança */}
      {asaasResult && (
        <AsaasChargeResultModal
          result={asaasResult}
          onClose={() => setAsaasResult(null)}
        />
      )}
    </div>
  );
};

const variantStyles = {
  success: {
    iconBg: 'bg-emerald-500/15 dark:bg-emerald-500/20',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    accent: 'border-l-emerald-500',
    glow: 'group-hover:shadow-emerald-500/10',
  },
  warning: {
    iconBg: 'bg-amber-500/15 dark:bg-amber-500/20',
    iconColor: 'text-amber-600 dark:text-amber-400',
    accent: 'border-l-amber-500',
    glow: 'group-hover:shadow-amber-500/10',
  },
  info: {
    iconBg: 'bg-blue-500/15 dark:bg-blue-500/20',
    iconColor: 'text-blue-600 dark:text-blue-400',
    accent: 'border-l-blue-500',
    glow: 'group-hover:shadow-blue-500/10',
  },
  accent: {
    iconBg: 'bg-violet-500/15 dark:bg-violet-500/20',
    iconColor: 'text-violet-600 dark:text-violet-400',
    accent: 'border-l-violet-500',
    glow: 'group-hover:shadow-violet-500/10',
  },
  avulso: {
    iconBg: 'bg-amber-500/15 dark:bg-amber-500/20',
    iconColor: 'text-amber-600 dark:text-amber-400',
    accent: 'border-l-amber-500',
    glow: 'group-hover:shadow-amber-500/10',
  },
};

const KPICard: React.FC<{
  title: string;
  value: string;
  subtitle?: string;
  variant: keyof typeof variantStyles;
  icon: string;
}> = ({ title, value, subtitle = '', variant, icon }) => {
  const styles = variantStyles[variant];
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-900 p-6 border-l-4 ${styles.accent} shadow-sm hover:shadow-lg ${styles.glow} transition-all duration-300`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className={`size-12 rounded-xl flex items-center justify-center ${styles.iconBg} ${styles.iconColor} shrink-0`}>
          <span className="material-symbols-outlined text-2xl">{icon}</span>
        </div>
        {subtitle ? (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate max-w-[140px] text-right">
            {subtitle}
          </span>
        ) : null}
      </div>
      <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mt-4 mb-1">{title}</p>
      <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{value}</p>
    </div>
  );
};

const FilterButton: React.FC<{ label: string; active: boolean; onClick: () => void; count: number; color?: string }> = ({ label, active, onClick, count, color = 'primary' }) => {
  const colorClasses: { [key: string]: string } = {
    primary: 'bg-primary/10 text-primary border-primary',
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400',
    amber: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400',
    blue: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400',
    purple: 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-400',
    slate: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-400',
  };

  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${active
        ? colorClasses[color] || colorClasses.primary
        : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
        }`}
    >
      {label}
      <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] ${active ? 'bg-white/50 dark:bg-black/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
        {count}
      </span>
    </button>
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
    return date.toDateString() === today.toDateString();
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
    <>
      <div className="fixed inset-0 z-[90]" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl z-[100] p-3 w-64">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={prevMonth}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined text-base text-slate-600 dark:text-slate-400">chevron_left</span>
          </button>
          <h3 className="text-xs font-bold text-slate-900 dark:text-white">
            {months[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </h3>
          <button
            onClick={nextMonth}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined text-base text-slate-600 dark:text-slate-400">chevron_right</span>
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {weekDays.map((day) => (
            <div key={day} className="text-center text-[10px] font-semibold text-slate-500 dark:text-slate-400 py-0.5">
              {day.substring(0, 1)}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {days.map((date, index) => (
            <button
              key={index}
              onClick={() => handleDateClick(date)}
              disabled={!date}
              className={`
                aspect-square flex items-center justify-center text-[10px] font-medium rounded transition-all
                ${!date ? 'cursor-default' : 'cursor-pointer hover:bg-primary/10'}
                ${date && isToday(date) ? 'ring-1 ring-primary' : ''}
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

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={() => onSelectDate(null)}
            className="text-[10px] text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            Limpar
          </button>
          <button
            onClick={onClose}
            className="text-[10px] text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </>
  );
};
