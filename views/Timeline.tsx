
import React, { useState, useEffect, useRef } from 'react';
import { Project, Workspace, Category } from '../types';
import { subscribeToProjects, subscribeToCategories } from '../firebase/services';

interface TimelineProps {
  currentWorkspace: Workspace | null;
  onProjectClick?: (project: Project) => void;
}

export const Timeline: React.FC<TimelineProps> = ({ currentWorkspace, onProjectClick }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string[]>([]);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, scrollLeft: 0 });
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Carregar projetos do Firebase
  useEffect(() => {
    if (!currentWorkspace?.id) return;

    const unsubscribe = subscribeToProjects((fetchedProjects) => {
      // Filtrar projetos do workspace atual
      const workspaceProjects = fetchedProjects.filter(p => p.workspaceId === currentWorkspace.id);
      setProjects(workspaceProjects);
    }, currentWorkspace.id);

    return () => unsubscribe();
  }, [currentWorkspace?.id]);

  // Carregar categorias do Firebase
  useEffect(() => {
    if (!currentWorkspace?.id) return;

    const unsubscribe = subscribeToCategories((fetchedCategories) => {
      setCategories(fetchedCategories);
    }, currentWorkspace.id);

    return () => unsubscribe();
  }, [currentWorkspace?.id]);

  // Calcular a data inicial do cronograma
  const calculateStartDate = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let earliestDate: Date | null = null;
    
    projects.forEach(project => {
      // Verificar deadline
      if (project.deadline && project.status !== 'Completed' && project.status !== 'Finished') {
        const date = new Date(project.deadline);
        date.setHours(0, 0, 0, 0);
        if (!earliestDate || date < earliestDate) earliestDate = date;
      }
      
      // Verificar data de manutenção
      if (project.maintenanceDate) {
        const date = new Date(project.maintenanceDate);
        date.setHours(0, 0, 0, 0);
        if (!earliestDate || date < earliestDate) earliestDate = date;
      }
      
      // Verificar data de relatório
      if (project.reportDate) {
        const date = new Date(project.reportDate);
        date.setHours(0, 0, 0, 0);
        if (!earliestDate || date < earliestDate) earliestDate = date;
      }
    });
    
    if (earliestDate && earliestDate < today) {
      return earliestDate;
    }
    
    return today;
  };
  
  // Calcular até quando mostrar o cronograma
  const calculateEndDate = (startDate: Date) => {
    let latestDate: Date | null = null;
    
    projects.forEach(project => {
      // Verificar deadline
      if (project.deadline) {
        const date = new Date(project.deadline);
        date.setHours(0, 0, 0, 0);
        if (!latestDate || date > latestDate) latestDate = date;
      }
      
      // Verificar data de manutenção
      if (project.maintenanceDate) {
        const date = new Date(project.maintenanceDate);
        date.setHours(0, 0, 0, 0);
        if (!latestDate || date > latestDate) latestDate = date;
      }
      
      // Verificar data de relatório
      if (project.reportDate) {
        const date = new Date(project.reportDate);
        date.setHours(0, 0, 0, 0);
        if (!latestDate || date > latestDate) latestDate = date;
      }
    });
    
    if (!latestDate) {
      const defaultEndDate = new Date(startDate);
      defaultEndDate.setDate(startDate.getDate() + 7);
      return defaultEndDate;
    }
    
    const endDate = new Date(latestDate);
    endDate.setDate(latestDate.getDate() + 3);
    
    return endDate;
  };
  
  // Gerar dias dinamicamente (a cada 2 dias)
  const generateDays = () => {
    const days = [];
    const startDate = calculateStartDate();
    const endDate = calculateEndDate(startDate);
    
    const diffTime = endDate.getTime() - startDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    // Garantir pelo menos 7 dias de visualização para evitar cronograma muito pequeno
    const totalDays = Math.max(diffDays, 7);
    
    const monthNames = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    
    // Sempre mostrar o primeiro dia
    const firstMonth = monthNames[startDate.getMonth()];
    const firstDay = startDate.getDate().toString().padStart(2, '0');
    days.push({
      label: `${firstMonth} ${firstDay}`,
      date: new Date(startDate),
      index: 0
    });
    
    // Depois mostrar dia após dia
    for (let i = 1; i < totalDays; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      
      // Verificar se não ultrapassou a data final
      if (currentDate > endDate) break;
      
      const month = monthNames[currentDate.getMonth()];
      const day = currentDate.getDate().toString().padStart(2, '0');
      
      days.push({
        label: `${month} ${day}`,
        date: new Date(currentDate),
        index: i
      });
    }
    
    return days;
  };
  
  const days = generateDays();
  
  // Função para verificar se uma data é hoje
  const isToday = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    return today.getTime() === compareDate.getTime();
  };
  
  // Calcular posição e duração de cada projeto
  const getProjectPosition = (project: Project) => {
    const startDate = calculateStartDate();
    startDate.setHours(0, 0, 0, 0);
    
    const projectStartDate = project.createdAt 
      ? (project.createdAt instanceof Date ? project.createdAt : new Date(project.createdAt))
      : startDate;
    projectStartDate.setHours(0, 0, 0, 0);
    
    let endDate: Date;
    if (project.deadline) {
      endDate = project.deadline instanceof Date ? project.deadline : new Date(project.deadline);
      endDate.setHours(0, 0, 0, 0);
    } else {
      endDate = new Date(projectStartDate);
      const estimatedWeeks = project.status === 'Active' ? 4 : project.status === 'Completed' ? 2 : 3;
      endDate.setDate(endDate.getDate() + (estimatedWeeks * 7));
    }
    
    const firstDayDate = days[0]?.date || startDate;
    firstDayDate.setHours(0, 0, 0, 0);
    
    const actualStartDate = projectStartDate < firstDayDate ? firstDayDate : projectStartDate;
    
    const diffTimeStart = actualStartDate.getTime() - firstDayDate.getTime();
    const diffDaysStart = Math.floor(diffTimeStart / (1000 * 60 * 60 * 24));
    const startDay = Math.max(0, diffDaysStart);
    
    let startColumn = startDay;
    
    const diffTimeEnd = endDate.getTime() - firstDayDate.getTime();
    const diffDaysEnd = Math.floor(diffTimeEnd / (1000 * 60 * 60 * 24));
    const endDay = Math.max(0, diffDaysEnd);
    
    let endColumn = endDay;
    
    let durationColumns = endColumn - startColumn + 1;
    durationColumns = Math.max(1, durationColumns);
    
    const maxStartColumn = Math.max(0, days.length - 1);
    const finalStartColumn = Math.min(startColumn, maxStartColumn);
    
    const maxDuration = days.length - finalStartColumn;
    
    const finalDuration = Math.min(durationColumns, maxDuration);
    
    return {
      startColumn: finalStartColumn,
      duration: finalDuration
    };
  };
  
  // Obter cor baseada na categoria do projeto (mesma lógica da legenda)
  // Evitando verde (emerald) para as primeiras categorias para não confundir com projetos concluídos
  const getCategoryColor = (projectType: string) => {
    const categoryIndex = categories.findIndex(cat => cat.name === projectType);
    if (categoryIndex === -1) return 'blue'; // Cor padrão se não encontrar
    
    const colorMap: { [key: number]: string } = {
      0: 'amber',
      1: 'blue',
      2: 'indigo',
      3: 'purple',
      4: 'rose',
      5: 'emerald', // Verde só aparece depois de outras cores
    };
    
    return colorMap[categoryIndex % 6] || 'blue';
  };

  // Mapear status para cores (mantido para compatibilidade, mas agora usa categoria)
  const getStatusColor = (status: string, tagColor?: string, projectType?: string) => {
    // Priorizar cor baseada na categoria do projeto
    if (projectType && categories.length > 0) {
      return getCategoryColor(projectType);
    }
    
    // Fallback para cores baseadas em status/tagColor
    if (status === 'Active') return 'blue';
    if (status === 'Lead') return 'amber';
    if (status === 'Completed') return 'emerald';
    if (status === 'Finished') return 'rose';
    if (tagColor === 'amber') return 'amber';
    if (tagColor === 'blue') return 'blue';
    if (tagColor === 'emerald') return 'emerald';
    if (tagColor === 'indigo') return 'indigo';
    return 'blue';
  };

  // Obter label do status
  const getStatusLabel = (project: Project) => {
    const progress = project.progress || 0;
    if (project.status === 'Active') return `Em Desenvolvimento (${progress}%)`;
    if (project.status === 'Lead') return 'Proposta Enviada';
    if (project.status === 'Completed') return 'Concluído';
    if (project.status === 'Finished') return 'Finalizado';
    return `Em Revisão (${progress}%)`;
  };

  // Calcular progresso temporal (baseado na posição dentro da barra do projeto)
  const getTemporalProgress = (project: Project, startColumn: number, duration: number) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (!project.deadline) {
      return 0; // Sem deadline, sem overlay
    }
    
    const deadline = project.deadline instanceof Date ? project.deadline : new Date(project.deadline);
    deadline.setHours(0, 0, 0, 0);
    
    // Usar a data inicial do cronograma como referência
    const startDate = calculateStartDate();
    startDate.setHours(0, 0, 0, 0);
    
    // Data de início do projeto (quando o deadline foi definido)
    // Usar updatedAt se disponível (quando deadline foi atualizado), senão createdAt
    let projectStartDate: Date;
    if (project.updatedAt) {
      projectStartDate = project.updatedAt instanceof Date ? project.updatedAt : new Date(project.updatedAt);
    } else if (project.createdAt) {
      projectStartDate = project.createdAt instanceof Date ? project.createdAt : new Date(project.createdAt);
    } else {
      // Se não houver datas, usar a data inicial do cronograma
      projectStartDate = startDate;
    }
    projectStartDate.setHours(0, 0, 0, 0);
    
    // Se a data de início do projeto for antes da data inicial do cronograma, usar a data inicial
    const firstDayDate = days[0]?.date || startDate;
    firstDayDate.setHours(0, 0, 0, 0);
    const actualStartDate = projectStartDate < firstDayDate ? firstDayDate : projectStartDate;
    
    // Calcular a duração total do projeto (do início até a deadline)
    const totalDuration = deadline.getTime() - actualStartDate.getTime();
    
    // Calcular quanto tempo já passou desde o início até hoje
    // Adicionar 1 dia completo (não 24h exatas, mas 1 dia no calendário) ao tempo decorrido
    // Isso faz o overlay aparecer como se já tivesse passado 1 dia desde a definição do deadline
    const oneDayLater = new Date(actualStartDate);
    oneDayLater.setDate(oneDayLater.getDate() + 1); // Adiciona 1 dia completo no calendário
    oneDayLater.setHours(0, 0, 0, 0); // Zera as horas para considerar apenas o dia
    
    // Se hoje já passou do dia seguinte à definição do deadline, usar hoje
    // Caso contrário, usar o dia seguinte como referência
    const referenceDate = today >= oneDayLater ? today : oneDayLater;
    const elapsed = referenceDate.getTime() - actualStartDate.getTime();
    
    // Se o projeto foi concluído ou finalizado, mostrar 100%
    if (project.status === 'Completed' || project.status === 'Finished') {
      return 100;
    }
    
    // Se passou da deadline, mostrar 100%
    if (deadline < today) {
      return 100;
    }
    
    // Se a deadline está no passado em relação à data de início, ajustar
    if (deadline < actualStartDate) {
      return 100;
    }
    
    // Calcular o progresso como porcentagem da duração total
    // O overlay aparece desde o momento que o deadline é definido, já contando 24h para frente
    if (totalDuration > 0) {
      const progress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
      return progress;
    } else if (totalDuration === 0) {
      // Se início e deadline são no mesmo dia, mostrar 100% se já passou
      return today >= deadline ? 100 : 0;
    }
    
    return 0;
  };

  // Filtrar apenas projetos com deadline, não concluídos (exceto recorrentes em manutenção) e por categoria
  const projectsForTimeline = projects.filter(p => {
    // Verificar se é um serviço recorrente
    const isRecurringService = categories.find(cat => 
      cat.name === p.type && cat.isRecurring
    );
    
    // Critérios para aparecer no cronograma:
    // 1. Tem deadline e não está concluído
    const hasDeadlineAndActive = p.deadline && p.status !== 'Completed' && p.status !== 'Finished';
    
    // 2. É recorrente e tem data de manutenção ou relatório (mesmo se status for 'Completed')
    const isRecurringWithDates = isRecurringService && (p.maintenanceDate || p.reportDate);
    
    if (!hasDeadlineAndActive && !isRecurringWithDates) return false;
    
    // Filtro de categoria
    if (selectedCategoryFilter.length === 0) return true;
    return selectedCategoryFilter.some(filter => p.type === filter);
  });

  // Função para obter a coluna de uma data específica
  const getDateColumn = (dateString: string | undefined): number => {
    if (!dateString || days.length === 0) return -1;
    
    const targetDate = new Date(dateString);
    targetDate.setHours(0, 0, 0, 0);
    
    const firstDayDate = days[0].date;
    firstDayDate.setHours(0, 0, 0, 0);
    
    const diffTime = targetDate.getTime() - firstDayDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0 || diffDays >= days.length) return -1;
    
    return diffDays;
  };

  // Função auxiliar para determinar a cor da data baseada na proximidade
  const getDateColorClass = (dateString: string | undefined): string => {
    if (!dateString) return 'text-slate-400 bg-slate-100 border-slate-200';
    
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-900/20 dark:border-rose-800/50';
    if (diffDays <= 7) return 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800/50';
    return 'text-slate-500 bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700';
  };

  // Função para toggle de categoria
  const toggleCategoryFilter = (category: string) => {
    setSelectedCategoryFilter(prev => {
      if (prev.includes(category)) {
        // Remove se já estiver selecionada
        return prev.filter(c => c !== category);
      } else {
        // Adiciona se não estiver selecionada
        return [...prev, category];
      }
    });
  };

  // Calcular estatísticas
  const stats = {
    inDevelopment: projectsForTimeline.filter(p => p.status === 'Active').length,
    completed: projectsForTimeline.filter(p => p.status === 'Completed' || p.status === 'Finished').length,
    late: projectsForTimeline.filter(p => {
      if (!p.deadline || p.status === 'Completed' || p.status === 'Finished') return false;
      const deadline = new Date(p.deadline);
      return deadline < new Date();
    }).length,
  };

  // Formatar período do cronograma
  const formatPeriod = () => {
    if (days.length === 0) return '';
    const startDate = days[0].date;
    const endDate = days[days.length - 1].date;
    const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const formatDate = (date: Date) => {
      const day = date.getDate().toString().padStart(2, '0');
      const month = monthNames[date.getMonth()];
      return `${day} ${month}`;
    };
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-8 py-6 bg-white dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Cronograma e Prazos</h2>
            <p className="text-sm text-slate-500">Visualização global de entregas e marcos de projetos</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors">
              <span className="material-symbols-outlined text-sm">filter_list</span> Filtros
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors">
              <span className="material-symbols-outlined text-sm">ios_share</span> Exportar
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex gap-2 flex-wrap">
            {/* Badge "Todas" */}
            <button
              onClick={() => setSelectedCategoryFilter([])}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all cursor-pointer ${
                selectedCategoryFilter.length === 0
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
              }`}
            >
              <span className="size-1.5 rounded-full bg-current"></span> Todas
            </button>
            {categories.length > 0 ? (
              categories.map((category, index) => {
                // Obter cor baseada no índice - evitando verde (emerald) para não confundir com projetos concluídos
                const colorMap: { [key: number]: { bg: string; text: string; border: string; dot: string } } = {
                  0: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200/30', dot: 'bg-amber-500' },
                  1: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200/30', dot: 'bg-blue-500' },
                  2: { bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200/30', dot: 'bg-indigo-500' },
                  3: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200/30', dot: 'bg-purple-500' },
                  4: { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-200/30', dot: 'bg-rose-500' },
                  5: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200/30', dot: 'bg-emerald-500' },
                };
                // Usar módulo 6 para incluir todas as cores, mas verde só aparece depois de outras cores
                const colors = colorMap[index % 6] || colorMap[0];
                const isSelected = selectedCategoryFilter.includes(category.name);
                const hasAnySelection = selectedCategoryFilter.length > 0;
                
                return (
                  <button
                    key={category.id || index}
                    onClick={() => toggleCategoryFilter(category.name)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all cursor-pointer ${
                      isSelected
                        ? `${colors.bg} ${colors.text} ${colors.border} ring-2 ring-offset-2 ring-current`
                        : hasAnySelection
                        ? 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700 opacity-60'
                        : `${colors.bg} ${colors.text} ${colors.border} hover:opacity-80`
                    }`}
                  >
                    <span className={`size-1.5 rounded-full ${isSelected ? colors.dot : 'bg-slate-400'}`}></span> {category.name}
                  </button>
                );
              })
            ) : (
              <span className="text-xs text-slate-400">Nenhum serviço cadastrado</span>
            )}
          </div>
        </div>
      </div>

      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-x-auto overflow-y-auto bg-white dark:bg-slate-900"
        style={{ 
          scrollbarWidth: 'thin', 
          WebkitOverflowScrolling: 'touch',
          cursor: isPanning ? 'grabbing' : 'default'
        }}
        onMouseDown={(e: React.MouseEvent) => {
          // Não ativa se for botão direito do mouse
          if (e.button !== 0) return;
          
          const target = e.target as HTMLElement;
          
          // Não ativa se clicar em elementos interativos específicos
          if (
            target.closest('button') ||
            target.closest('input') ||
            target.closest('select') ||
            target.closest('textarea') ||
            target.closest('a') ||
            target.closest('[draggable="true"]') ||
            target.closest('.group')
          ) {
            return;
          }
          
          // Ativa pan
          if (scrollContainerRef.current) {
            setIsPanning(true);
            setPanStart({
              x: e.pageX,
              y: e.pageY,
              scrollLeft: scrollContainerRef.current.scrollLeft
            });
            e.preventDefault();
          }
        }}
        onMouseMove={(e: React.MouseEvent) => {
          if (!isPanning || !scrollContainerRef.current) return;
          
          e.preventDefault();
          const x = e.pageX;
          const walk = (x - panStart.x) * 1.5;
          scrollContainerRef.current.scrollLeft = panStart.scrollLeft - walk;
        }}
        onMouseUp={() => {
          setIsPanning(false);
        }}
        onMouseLeave={() => {
          setIsPanning(false);
        }}
      >
        {projectsForTimeline.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">calendar_month</span>
            <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-400 mb-2">Nenhum projeto para exibir</h3>
            <p className="text-sm text-slate-500">Projetos ativos com prazos ou serviços recorrentes em manutenção aparecerão aqui.</p>
          </div>
        ) : (
          <div className="min-w-full">
          <div className="sticky top-0 z-10 flex bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="w-64 flex-shrink-0 p-4 border-r border-slate-200 dark:border-slate-800 font-bold text-xs uppercase tracking-wider text-slate-400">Projetos / Clientes</div>
              <div className="flex-1 flex bg-white dark:bg-slate-900">
                {days.map((day, i) => {
                  const today = isToday(day.date);
                  
                  // Calcular posição da bolinha no topo baseado no horário atual
                  const now = new Date();
                  const minutesInDay = (now.getHours() * 60) + now.getMinutes();
                  const positionX = (minutesInDay / 1440) * 100;

                  return (
                    <div 
                      key={i} 
                      className={`w-[100px] flex-shrink-0 text-center border-r flex items-center justify-center relative ${
                        today 
                          ? 'bg-slate-50/30 dark:bg-slate-800/10 border-r-slate-100 dark:border-r-slate-800/50' 
                          : 'border-slate-100 dark:border-slate-800/50'
                      }`}
                    >
                      {/* Bolinha única no topo */}
                      {today && (
                        <div 
                          className="absolute -bottom-1 size-2 rounded-full bg-primary z-30 shadow-sm"
                          style={{ left: `${positionX - 4}px` }}
                        ></div>
                      )}
                      <div className="flex flex-col items-center justify-center py-2">
                        <span className={`block text-[9px] font-bold leading-tight uppercase ${today ? 'text-primary' : 'text-slate-400 dark:text-slate-500'}`}>
                          {day.label.split(' ')[0]}
                        </span>
                        <span className={`flex items-center justify-center size-7 text-sm font-black tracking-tight rounded-full transition-all ${
                          today 
                            ? 'bg-primary text-white shadow-sm shadow-primary/20' 
                            : 'text-slate-900 dark:text-white'
                        }`}>
                          {day.label.split(' ')[1]}
                        </span>
                      </div>
                </div>
                  );
                })}
                {/* Preenchimento para ocupar o resto do espaço */}
                <div className="flex-1 bg-white dark:bg-slate-900" />
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {projectsForTimeline.map((project) => {
                const { startColumn, duration } = getProjectPosition(project);
                const categoryColor = getCategoryColor(project.type);
                const isLate = project.deadline && new Date(project.deadline) < new Date() && project.status !== 'Completed' && project.status !== 'Finished';
                const isReview = project.status === 'Review';
                const temporalProgress = getTemporalProgress(project, startColumn, duration);
                
                const maintenanceCol = getDateColumn(project.maintenanceDate);
                const reportCol = getDateColumn(project.reportDate);
                const isRecurring = categories.find(cat => cat.name === project.type)?.isRecurring;
                const showProjectBar = project.deadline && project.status !== 'Completed' && project.status !== 'Finished';

                // Obter classes CSS baseadas na cor da categoria
                const getCategoryBadgeClasses = (color: string) => {
                  const colorMap: { [key: string]: string } = {
                    'amber': 'bg-amber-50 text-amber-600',
                    'blue': 'bg-blue-50 text-blue-600',
                    'emerald': 'bg-emerald-50 text-emerald-600',
                    'indigo': 'bg-indigo-50 text-indigo-600',
                    'purple': 'bg-purple-50 text-purple-600',
                    'rose': 'bg-rose-50 text-rose-600',
                  };
                  return colorMap[color] || 'bg-blue-50 text-blue-600';
                };
                
                return (
                  <div 
                    key={project.id} 
                    onClick={() => onProjectClick?.(project)}
                    className="flex hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer"
                  >
                    <div className="w-64 flex-shrink-0 p-4 border-r border-slate-200 dark:border-slate-800 flex flex-col gap-1 bg-white dark:bg-slate-900">
                      <h4 className="text-sm font-bold truncate">{project.name}</h4>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded w-fit ${getCategoryBadgeClasses(categoryColor)}`}>
                          {project.type}
                        </span>
                        {isRecurring && project.status === 'Completed' && (
                          <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-1.5 rounded border border-emerald-100">Gestão</span>
                        )}
                      </div>
          </div>
                    {/* Colunas - mesma estrutura flex do header */}
                    <div className="flex-1 flex relative bg-white dark:bg-slate-900">
                      {/* Grid de colunas de fundo */}
                      {days.map((day, i) => {
                        const today = isToday(day.date);
                        
                        // Calcular posição da linha baseado no horário atual (0-100px)
                        const now = new Date();
                        const minutesInDay = (now.getHours() * 60) + now.getMinutes();
                        const positionX = (minutesInDay / 1440) * 100;

                        return (
                          <div 
                            key={i} 
                            className={`w-[100px] h-20 border-r flex-shrink-0 relative ${
                              today 
                                ? 'bg-primary/[0.01] dark:bg-primary/[0.02] border-r-slate-100 dark:border-r-slate-800/50' 
                                : 'border-slate-100 dark:border-slate-800/50'
                            }`}
                          >
                            {/* Linha vertical indicadora do horário atual */}
                            {today && (
                              <div 
                                className="absolute inset-y-0 w-px bg-primary/40 z-20"
                                style={{ left: `${positionX}px` }}
                              >
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {/* Preenchimento para ocupar o resto do espaço */}
                      <div className="flex-1 h-20 bg-white dark:bg-slate-900" />
                      
                      {/* Barra do projeto (se aplicável) */}
                      {showProjectBar && (
                        <div 
                          className={`absolute top-1/2 -translate-y-1/2 h-8 ${isReview ? 'bg-amber-500/10 border-l-4 border-l-amber-500 ring-2 ring-amber-500/30' :
                            categoryColor === 'amber' ? 'bg-amber-500/10 border-l-4 border-l-amber-500' :
                            categoryColor === 'blue' ? 'bg-blue-500/10 border-l-4 border-l-blue-500' :
                            categoryColor === 'emerald' ? 'bg-emerald-500/10 border-l-4 border-l-emerald-500' :
                            categoryColor === 'indigo' ? 'bg-indigo-500/10 border-l-4 border-l-indigo-500' :
                            categoryColor === 'purple' ? 'bg-purple-500/10 border-l-4 border-l-purple-500' :
                            categoryColor === 'rose' ? 'bg-rose-500/10 border-l-4 border-l-rose-500' :
                            isLate ? 'bg-rose-500/10 border-l-4 border-l-rose-500' :
                            'bg-blue-500/10 border-l-4 border-l-blue-500'
                          } rounded-r-lg flex items-center px-3 gap-2 overflow-hidden z-10`}
                          style={{ 
                            left: `${startColumn * 100}px`, 
                            width: `${duration * 100}px`,
                            minWidth: '100px'
                          }}
                        >
                          <div 
                            className={`h-full absolute left-0 top-0 rounded-r transition-all z-0 ${
                              isReview ? 'bg-amber-500/40' :
                              categoryColor === 'amber' ? 'bg-amber-500/40' :
                              categoryColor === 'blue' ? 'bg-blue-500/40' :
                              categoryColor === 'emerald' ? 'bg-emerald-500/40' :
                              categoryColor === 'indigo' ? 'bg-indigo-500/40' :
                              categoryColor === 'purple' ? 'bg-purple-500/40' :
                              categoryColor === 'rose' ? 'bg-rose-500/40' :
                              isLate ? 'bg-rose-500/40' :
                              'bg-blue-500/40'
                            }`}
                            style={{ width: `${temporalProgress}%` }}
                            title={`Progresso temporal: ${temporalProgress.toFixed(1)}%`}
                          />
                          <span className={`text-[10px] font-bold relative z-10 truncate flex-1 min-w-0 ${
                            isReview ? 'text-amber-700' :
                            categoryColor === 'amber' ? 'text-amber-700' :
                            categoryColor === 'blue' ? 'text-blue-700' :
                            categoryColor === 'emerald' ? 'text-emerald-700' :
                            categoryColor === 'indigo' ? 'text-indigo-700' :
                            categoryColor === 'purple' ? 'text-purple-700' :
                            categoryColor === 'rose' ? 'text-rose-700' :
                            isLate ? 'text-rose-700' :
                            'text-blue-700'
                          }`}>
                            {getStatusLabel(project)}
                          </span>
                          {isReview && <span className="material-symbols-outlined text-amber-600 text-sm relative z-10 flex-shrink-0">rate_review</span>}
                          {isLate && !isReview && <span className="material-symbols-outlined text-rose-500 text-sm relative z-10 flex-shrink-0">priority_high</span>}
                        </div>
                      )}

                      {/* Marcadores de Manutenção e Relatório (para Recorrência) */}
                      {maintenanceCol !== -1 && (
                        <div 
                          className={`absolute top-1/2 -translate-y-1/2 -ml-5 z-20 flex flex-col items-center gap-1 group/marker transition-all`}
                          style={{ left: `${maintenanceCol * 100 + 50}px` }}
                          title={`Manutenção: ${new Date(project.maintenanceDate!).toLocaleDateString('pt-BR')}`}
                        >
                          <div className={`size-10 rounded-full border-2 flex items-center justify-center shadow-sm transition-transform group-hover/marker:scale-110 ${getDateColorClass(project.maintenanceDate)}`}>
                            <span className="material-symbols-outlined text-xl">build</span>
                          </div>
                          <span className="bg-slate-800 text-white text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover/marker:opacity-100 transition-opacity whitespace-nowrap">Manutenção</span>
                        </div>
                      )}

                      {reportCol !== -1 && (
                        <div 
                          className={`absolute top-1/2 -translate-y-1/2 -ml-5 z-20 flex flex-col items-center gap-1 group/marker transition-all`}
                          style={{ left: `${reportCol * 100 + 50}px` }}
                          title={`Relatório: ${new Date(project.reportDate!).toLocaleDateString('pt-BR')}`}
                        >
                          <div className={`size-10 rounded-full border-2 flex items-center justify-center shadow-sm transition-transform group-hover/marker:scale-110 ${getDateColorClass(project.reportDate)}`}>
                            <span className="material-symbols-outlined text-xl">description</span>
                          </div>
                          <span className="bg-slate-800 text-white text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover/marker:opacity-100 transition-opacity whitespace-nowrap">Relatório</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
        )}
      </div>
      
      <footer className="h-12 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-8 flex items-center justify-between text-[10px] font-medium text-slate-400">
        <div className="flex items-center gap-6">
          {days.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-xs">calendar_today</span>
              <span>Período: {formatPeriod()}</span>
            </div>
          )}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-blue-500"></span>
              <span>Projetos ativos</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-xs">build</span>
              <span>Manutenção</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-xs">description</span>
              <span>Relatório</span>
            </div>
          </div>
        </div>
        <div>Exibindo {projectsForTimeline.length} de {projects.length} projetos</div>
      </footer>
    </div>
  );
};

const Badge: React.FC<{ color: string; dotColor: string; label: string }> = ({ color, dotColor, label }) => (
  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${color}`}>
    <span className={`size-1.5 rounded-full ${dotColor}`}></span> {label}
  </span>
);

