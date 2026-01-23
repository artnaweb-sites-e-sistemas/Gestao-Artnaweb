
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Invoice, Project, Workspace } from '../types';
import { subscribeToInvoices, subscribeToProjects, updateInvoice, deleteInvoice, getProjects } from '../firebase/services';

interface FinancialProps {
  currentWorkspace?: Workspace | null;
  onCreateInvoice?: () => void;
  onProjectClick?: (project: Project) => void;
}

export const Financial: React.FC<FinancialProps> = ({ currentWorkspace, onCreateInvoice, onProjectClick }) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'paid' | 'pending' | 'implementation' | 'recurring' | 'normal'>('all');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Filtro de período (mês/ano)
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  
  // Nomes dos meses
  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  
  // Gerar lista de anos disponíveis (últimos 3 anos + atual)
  const availableYears = Array.from({ length: 4 }, (_, i) => currentDate.getFullYear() - i);

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

    return () => {
      unsubscribeInvoices();
      unsubscribeProjects();
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

  // Filtrar faturas por período selecionado
  const filteredByPeriod = useMemo(() => {
    return invoices.filter(inv => {
      if (selectedMonth === 'all') {
        // Filtrar apenas pelo ano
        const invDate = getInvoiceDate(inv.date);
        return invDate.getFullYear() === selectedYear;
      }
      // Filtrar por mês e ano
      const invDate = getInvoiceDate(inv.date);
      return invDate.getMonth() === selectedMonth && invDate.getFullYear() === selectedYear;
    });
  }, [invoices, selectedMonth, selectedYear, getInvoiceDate]);

  // Calcular métricas (usando faturas filtradas por período)
  const metrics = {
    totalReceived: filteredByPeriod.filter(inv => inv.status === 'Paid').reduce((sum, inv) => sum + inv.amount, 0),
    totalPending: filteredByPeriod.filter(inv => inv.status === 'Pending').reduce((sum, inv) => sum + inv.amount, 0),
    implementationTotal: filteredByPeriod.filter(inv => inv.number.startsWith('IMP-')).reduce((sum, inv) => sum + inv.amount, 0),
    implementationPaid: filteredByPeriod.filter(inv => inv.number.startsWith('IMP-') && inv.status === 'Paid').reduce((sum, inv) => sum + inv.amount, 0),
    recurringTotal: filteredByPeriod.filter(inv => inv.number.startsWith('REC-')).reduce((sum, inv) => sum + inv.amount, 0),
    recurringPaid: filteredByPeriod.filter(inv => inv.number.startsWith('REC-') && inv.status === 'Paid').reduce((sum, inv) => sum + inv.amount, 0),
    normalTotal: filteredByPeriod.filter(inv => inv.number.startsWith('INV-')).reduce((sum, inv) => sum + inv.amount, 0),
    normalPaid: filteredByPeriod.filter(inv => inv.number.startsWith('INV-') && inv.status === 'Paid').reduce((sum, inv) => sum + inv.amount, 0),
    paidCount: filteredByPeriod.filter(inv => inv.status === 'Paid').length,
    pendingCount: filteredByPeriod.filter(inv => inv.status === 'Pending').length,
  };

  // Dados para o gráfico de pizza
  const pieData = [
    { name: 'Implementação', value: metrics.implementationTotal, color: '#3b82f6' },
    { name: 'Mensalidade', value: metrics.recurringTotal, color: '#f59e0b' },
    { name: 'Avulso', value: metrics.normalTotal, color: '#8b5cf6' },
  ].filter(item => item.value > 0);

  // Gerar dados de receita por mês
  const generateMonthlyData = () => {
    const monthNames = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    const currentYear = new Date().getFullYear();
    const monthlyData: { name: string; received: number; pending: number }[] = [];

    for (let i = 0; i < 6; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - (5 - i));
      const month = date.getMonth();
      const year = date.getFullYear();

      const monthInvoices = invoices.filter(inv => {
        const invDate = inv.date instanceof Date ? inv.date : 
          inv.date?.toDate ? inv.date.toDate() : new Date(inv.date);
        return invDate.getMonth() === month && invDate.getFullYear() === year;
      });

      monthlyData.push({
        name: monthNames[month],
        received: monthInvoices.filter(inv => inv.status === 'Paid').reduce((sum, inv) => sum + inv.amount, 0),
        pending: monthInvoices.filter(inv => inv.status === 'Pending').reduce((sum, inv) => sum + inv.amount, 0),
      });
    }

    return monthlyData;
  };

  const monthlyData = generateMonthlyData();

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
  const getInvoiceType = (number: string) => {
    if (number.startsWith('IMP-')) return { label: 'Implementação', color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' };
    if (number.startsWith('REC-')) return { label: 'Mensalidade', color: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' };
    return { label: 'Avulso', color: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400' };
  };

  // Atualizar status da fatura
  const toggleInvoiceStatus = async (invoice: Invoice) => {
    try {
      const newStatus = invoice.status === 'Paid' ? 'Pending' : 'Paid';
      await updateInvoice(invoice.id, { status: newStatus });
      setToast({ message: `Fatura marcada como ${newStatus === 'Paid' ? 'paga' : 'pendente'}`, type: 'success' });
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
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${
          toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      <div className="flex flex-wrap justify-between items-end gap-4 mb-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black leading-tight tracking-tight">Controle Financeiro</h1>
          <p className="text-slate-500 text-base font-normal">Acompanhe todas as receitas e faturas dos seus projetos</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 h-10 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold hover:bg-slate-50 transition-colors">
            <span className="material-symbols-outlined text-lg">download</span> Exportar
          </button>
        </div>
      </div>

      {/* Filtro de Período - Design UI/UX Melhorado */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center">
          {/* Lado Esquerdo: Título e Ícone */}
          <div className="bg-slate-50/50 dark:bg-slate-800/30 px-6 py-4 lg:py-0 lg:h-16 flex items-center gap-3 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800">
            <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-xl">calendar_today</span>
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block leading-none mb-1">Filtro de</span>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200 block leading-none">Período</span>
            </div>
          </div>

          {/* Lado Direito: Controles e Atalhos */}
          <div className="flex-1 px-6 py-4 flex flex-wrap items-center justify-between gap-6">
            <div className="flex flex-wrap items-center gap-4">
              {/* Seletor de Mês Customizado */}
              <div className="relative group">
                <select
                  value={selectedMonth === 'all' ? 'all' : selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                  className="appearance-none pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none cursor-pointer min-w-[160px]"
                >
                  <option value="all">Todos os meses</option>
                  {monthNames.map((month, index) => (
                    <option key={index} value={index}>{month}</option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg group-hover:text-primary transition-colors pointer-events-none">
                  event_note
                </span>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none group-hover:text-primary transition-colors">
                  expand_more
                </span>
              </div>
              
              {/* Seletor de Ano Customizado */}
              <div className="relative group">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="appearance-none pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none cursor-pointer min-w-[110px]"
                >
                  {availableYears.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg group-hover:text-primary transition-colors pointer-events-none">
                  schedule
                </span>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none group-hover:text-primary transition-colors">
                  expand_more
                </span>
              </div>

              {/* Divisor Visual */}
              <div className="hidden sm:block w-px h-8 bg-slate-200 dark:bg-slate-800 mx-2"></div>

              {/* Atalhos Rápidos com Design de Pílula */}
              <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <button
                  onClick={() => {
                    setSelectedMonth(currentDate.getMonth());
                    setSelectedYear(currentDate.getFullYear());
                  }}
                  className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
                    selectedMonth === currentDate.getMonth() && selectedYear === currentDate.getFullYear()
                      ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  Este mês
                </button>
                <button
                  onClick={() => {
                    setSelectedMonth('all');
                    setSelectedYear(currentDate.getFullYear());
                  }}
                  className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
                    selectedMonth === 'all' && selectedYear === currentDate.getFullYear()
                      ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  Este ano
                </button>
              </div>
            </div>

            {/* Info do Período */}
            <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-primary/5 border border-primary/10">
              <div className="size-2 rounded-full bg-primary animate-pulse"></div>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                {filteredByPeriod.length} faturas em {' '}
                <span className="text-primary">
                  {selectedMonth === 'all' ? `${selectedYear}` : `${monthNames[selectedMonth as number]} ${selectedYear}`}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <KPICard 
          title="Total Recebido" 
          value={formatCurrency(metrics.totalReceived)} 
          trend={`${metrics.paidCount} faturas pagas`}
          trendType="up" 
          icon="account_balance" 
          iconBg="bg-emerald-100 dark:bg-emerald-900/30" 
          iconColor="text-emerald-600" 
        />
        <KPICard 
          title="Total Pendente" 
          value={formatCurrency(metrics.totalPending)} 
          trend={`${metrics.pendingCount} faturas pendentes`}
          trendType="neutral" 
          icon="pending_actions" 
          iconBg="bg-amber-100 dark:bg-amber-900/30" 
          iconColor="text-amber-600" 
        />
        <KPICard 
          title="Implementação" 
          value={formatCurrency(metrics.implementationPaid)} 
          trend={`de ${formatCurrency(metrics.implementationTotal)} total`}
          trendType="up" 
          icon="construction" 
          iconBg="bg-blue-100 dark:bg-blue-900/30" 
          iconColor="text-blue-600" 
        />
        <KPICard 
          title="Mensalidades" 
          value={formatCurrency(metrics.recurringPaid)} 
          trend={`de ${formatCurrency(metrics.recurringTotal)} total`}
          trendType="up" 
          icon="autorenew" 
          iconBg="bg-purple-100 dark:bg-purple-900/30" 
          iconColor="text-purple-600" 
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-base font-bold">Receita por Mês</h3>
              <p className="text-sm text-slate-500">Últimos 6 meses</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="size-3 rounded-full bg-emerald-500"></div>
                <span className="text-slate-500">Recebido</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="size-3 rounded-full bg-amber-500"></div>
                <span className="text-slate-500">Pendente</span>
              </div>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="colorReceived" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorPending" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(value) => `R$${(value/1000).toFixed(0)}k`} />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                <Area type="monotone" dataKey="received" name="Recebido" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorReceived)" />
                <Area type="monotone" dataKey="pending" name="Pendente" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorPending)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="mb-6">
            <h3 className="text-base font-bold">Receita por Tipo</h3>
            <p className="text-sm text-slate-500">Distribuição de faturas</p>
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
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-2 mt-4">
                {pieData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="size-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                      <span className="text-slate-600 dark:text-slate-400">{item.name}</span>
                    </div>
                    <span className="font-bold">{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <span className="material-symbols-outlined text-4xl mb-2">pie_chart</span>
              <p className="text-sm">Nenhuma fatura ainda</p>
            </div>
          )}
        </div>
      </div>

      {/* Tabela de Faturas */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-bold">Todas as Faturas</h3>
            {orphanInvoices.length > 0 && (
              <button
                onClick={deleteOrphanInvoices}
                className="flex items-center gap-2 px-3 py-1.5 bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 rounded-lg text-xs font-bold hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors"
                title={`Excluir ${orphanInvoices.length} fatura(s) órfã(s)`}
              >
                <span className="material-symbols-outlined text-sm">delete_sweep</span>
                Limpar órfãs ({orphanInvoices.length})
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <FilterButton label="Todas" active={selectedFilter === 'all'} onClick={() => setSelectedFilter('all')} count={filteredByPeriod.length} />
            <FilterButton label="Pagas" active={selectedFilter === 'paid'} onClick={() => setSelectedFilter('paid')} count={filteredByPeriod.filter(i => i.status === 'Paid').length} color="emerald" />
            <FilterButton label="Pendentes" active={selectedFilter === 'pending'} onClick={() => setSelectedFilter('pending')} count={filteredByPeriod.filter(i => i.status === 'Pending').length} color="amber" />
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
            <FilterButton label="Implementação" active={selectedFilter === 'implementation'} onClick={() => setSelectedFilter('implementation')} count={filteredByPeriod.filter(i => i.number.startsWith('IMP-')).length} color="blue" />
            <FilterButton label="Mensalidade" active={selectedFilter === 'recurring'} onClick={() => setSelectedFilter('recurring')} count={filteredByPeriod.filter(i => i.number.startsWith('REC-')).length} color="purple" />
            <FilterButton label="Avulso" active={selectedFilter === 'normal'} onClick={() => setSelectedFilter('normal')} count={filteredByPeriod.filter(i => i.number.startsWith('INV-')).length} color="slate" />
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredInvoices.map((invoice) => {
                  const invoiceType = getInvoiceType(invoice.number);
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
                      <td className="px-6 py-4 text-sm text-slate-500">{formatDate(invoice.date)}</td>
                      <td className="px-6 py-4 text-sm font-bold">{formatCurrency(invoice.amount)}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => toggleInvoiceStatus(invoice)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                            invoice.status === 'Paid' 
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-200' 
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200'
                          }`}
                        >
                          <span className="material-symbols-outlined text-sm">
                            {invoice.status === 'Paid' ? 'check_circle' : 'pending'}
                          </span>
                          {invoice.status === 'Paid' ? 'Pago' : 'Pendente'}
                        </button>
                      </td>
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
    </div>
  );
};

const KPICard: React.FC<{ title: string; value: string; trend: string; trendType: 'up' | 'down' | 'neutral'; icon: string; iconBg: string; iconColor: string }> = ({ title, value, trend, trendType, icon, iconBg, iconColor }) => (
  <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800">
    <div className="flex justify-between items-start mb-4">
      <div className={`size-10 ${iconBg} rounded-lg flex items-center justify-center ${iconColor}`}>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <span className={`text-xs font-bold px-2 py-1 rounded-full ${trendType === 'up' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30' : trendType === 'down' ? 'text-red-600 bg-red-50 dark:bg-red-900/30' : 'text-amber-600 bg-amber-50 dark:bg-amber-900/30'}`}>
        {trend}
      </span>
    </div>
    <p className="text-slate-500 text-sm font-medium mb-1">{title}</p>
    <p className="text-2xl font-black tracking-tight">{value}</p>
  </div>
);

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
      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
        active 
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
