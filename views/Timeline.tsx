
import React, { useState, useEffect, useRef } from 'react';
import { Project, Workspace, Category, Stage, parseSafeDate } from '../types';
import { subscribeToProjects, subscribeToCategories, subscribeToStages } from '../firebase/services';

interface TimelineProps {
  currentWorkspace: Workspace | null;
  onProjectClick?: (project: Project) => void;
}

export const Timeline: React.FC<TimelineProps> = ({ currentWorkspace, onProjectClick }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string[]>([]);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, scrollLeft: 0 });
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasMovedRef = useRef(false); // Rastrear se houve movimento significativo
  const clickPreventedRef = useRef(false); // Prevenir clique se houve arrasto
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

  // Carregar etapas do Firebase
  useEffect(() => {
    if (!currentWorkspace?.id) return;

    const unsubscribe = subscribeToStages((fetchedStages) => {
      // Filtrar etapas do workspace atual
      const workspaceStages = fetchedStages.filter(s => (s as any).workspaceId === currentWorkspace.id);
      setStages(workspaceStages);
    }, currentWorkspace.id);

    return () => unsubscribe();
  }, [currentWorkspace?.id]);

  // Calcular a data inicial do cronograma
  const calculateStartDate = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let earliestDate: Date | null = null;

    projects.forEach(project => {
      // Verificar se o projeto deve aparecer no cronograma (tem deadline ativo ou é recorrente com datas)
      const hasActiveDeadline = project.deadline && project.status !== 'Completed' && project.status !== 'Finished';
      const hasMaintenanceOrReport = project.maintenanceDate || project.reportDate;

      if (hasActiveDeadline || hasMaintenanceOrReport) {
        // Considerar a data de criação do projeto como data de início da barra
        // Isso garante que o cronograma mostrará desde o início do projeto até a entrega
        if (project.createdAt) {
          const createdDate = project.createdAt instanceof Date
            ? new Date(project.createdAt)
            : new Date(project.createdAt);
          createdDate.setHours(0, 0, 0, 0);
          if (!earliestDate || createdDate < earliestDate) earliestDate = createdDate;
        }

        // Também verificar deadline como possível data mais antiga (caso criação não exista)
        if (project.deadline) {
          const date = parseSafeDate(project.deadline);
          if (date) {
            date.setHours(0, 0, 0, 0);
            if (!earliestDate || date < earliestDate) earliestDate = date;
          }
        }

        // Verificar data de manutenção
        if (project.maintenanceDate) {
          const date = parseSafeDate(project.maintenanceDate);
          if (date) {
            date.setHours(0, 0, 0, 0);
            if (!earliestDate || date < earliestDate) earliestDate = date;
          }
        }

        // Verificar data de relatório
        if (project.reportDate) {
          const date = parseSafeDate(project.reportDate);
          if (date) {
            date.setHours(0, 0, 0, 0);
            if (!earliestDate || date < earliestDate) earliestDate = date;
          }
        }
      }
    });

    // Limitar a data de início a no máximo 7 dias antes de hoje
    // Para evitar que o cronograma fique muito extenso com projetos antigos
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    if (earliestDate && earliestDate < sevenDaysAgo) {
      return sevenDaysAgo;
    }

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
        const date = parseSafeDate(project.deadline);
        if (date) {
          date.setHours(0, 0, 0, 0);
          if (!latestDate || date > latestDate) latestDate = date;
        }
      }

      // Verificar data de manutenção
      if (project.maintenanceDate) {
        const date = parseSafeDate(project.maintenanceDate);
        if (date) {
          date.setHours(0, 0, 0, 0);
          if (!latestDate || date > latestDate) latestDate = date;
        }
      }

      // Verificar data de relatório
      if (project.reportDate) {
        const date = parseSafeDate(project.reportDate);
        if (date) {
          date.setHours(0, 0, 0, 0);
          if (!latestDate || date > latestDate) latestDate = date;
        }
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
    const weekDays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

    // Sempre mostrar o primeiro dia
    const firstMonth = monthNames[startDate.getMonth()];
    const firstDay = startDate.getDate().toString().padStart(2, '0');
    const firstWeekDay = weekDays[startDate.getDay()];
    days.push({
      label: `${firstMonth} ${firstDay} ${firstWeekDay}`,
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
      const weekDay = weekDays[currentDate.getDay()];

      days.push({
        label: `${month} ${day} ${weekDay}`,
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
      endDate = parseSafeDate(project.deadline) || new Date();
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
    let finalStartColumn = Math.min(startColumn, maxStartColumn);

    const maxDuration = days.length - finalStartColumn;

    let finalDuration = Math.min(durationColumns, maxDuration);

    // Preencher o espaço à esquerda: se a barra não começa na primeira coluna, estender para a esquerda até o início da janela visível
    if (finalStartColumn > 0) {
      finalStartColumn = 0;
      finalDuration = Math.min(endColumn + 1, days.length);
      finalDuration = Math.max(1, finalDuration);
    }

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

  // Obter label do status - usar título da etapa se disponível
  const getStatusLabel = (project: Project) => {
    // Verificar etapa baseado no stageId
    const isAdjustmentsStage = project.stageId?.includes('adjustments') || false;

    // Se estiver na etapa Ajustes, mostrar "Ajustes"
    if (isAdjustmentsStage) {
      return 'Ajustes';
    }

    // Buscar a etapa correspondente ao status do projeto
    const currentStage = stages.find(stage => stage.status === project.status);

    if (currentStage) {
      // Se for serviço recorrente e status Completed, mostrar "Manutenção"
      const pTypes = project.types || (project.type ? [project.type] : []);
      const isRecurringService = pTypes.some(typeName =>
        categories.find(cat => cat.name === typeName && cat.isRecurring)
      );
      if (isRecurringService && project.status === 'Completed') {
        return 'Manutenção';
      }
      // Retornar o título da etapa
      return currentStage.title;
    }

    // Fallback para labels padrão se não encontrar etapa
    const progress = project.progress || 0;
    if (project.status === 'Active') return `Em Desenvolvimento (${progress}%)`;
    if (project.status === 'Lead') return 'On-boarding';
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

    const deadline = parseSafeDate(project.deadline);
    if (!deadline) return 0;
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
  }).sort((a, b) => {
    // Ordenar por data de vencimento (mais próximos primeiro)
    // Para projetos recorrentes, usar a data mais próxima entre manutenção e relatório
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    const getSortDate = (project: Project): number => {
      // Prioridade: deadline > (manutenção ou relatório - a mais próxima)
      if (project.deadline) {
        return parseSafeDate(project.deadline)?.getTime() || Number.MAX_SAFE_INTEGER;
      }
      
      // Se tem tanto maintenanceDate quanto reportDate, usar a mais próxima de hoje
      const maintenanceDate = project.maintenanceDate ? parseSafeDate(project.maintenanceDate) : null;
      const reportDate = project.reportDate ? parseSafeDate(project.reportDate) : null;
      
      if (maintenanceDate && reportDate) {
        // Calcular a diferença em dias de cada data em relação a hoje
        const maintenanceDiff = Math.abs(maintenanceDate.getTime() - todayTime);
        const reportDiff = Math.abs(reportDate.getTime() - todayTime);
        
        // Usar a data mais próxima (menor diferença)
        return maintenanceDiff < reportDiff ? maintenanceDate.getTime() : reportDate.getTime();
      }
      
      // Se tem apenas uma das duas, usar ela
      if (maintenanceDate) {
        return maintenanceDate.getTime();
      }
      if (reportDate) {
        return reportDate.getTime();
      }
      
      // Se não tiver nenhuma data, colocar no final
      return Number.MAX_SAFE_INTEGER;
    };

    const dateA = getSortDate(a);
    const dateB = getSortDate(b);

    // Ordenar do menor para o maior (mais próximo primeiro)
    return dateA - dateB;
  });

  // Função para obter a coluna de uma data específica
  const getDateColumn = (dateString: string | undefined): number => {
    if (!dateString || days.length === 0) return -1;

    const targetDate = parseSafeDate(dateString);
    if (!targetDate) return -1;
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

    const date = parseSafeDate(dateString);
    if (!date) return 'text-slate-400 bg-slate-100 border-slate-200';
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
      const deadline = parseSafeDate(p.deadline);
      return deadline && deadline < new Date();
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
        </div>
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex gap-2 flex-wrap">
            {/* Badge "Todas" */}
            <button
              onClick={() => setSelectedCategoryFilter([])}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all cursor-pointer ${selectedCategoryFilter.length === 0
                ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                }`}
            >
              <span className="size-1.5 rounded-full bg-current"></span> Todas
            </button>
            {categories.length > 0 ? (
              categories.map((category, index) => {
                // Obter cor baseada no índice - evitando verde (emerald) para não confundir com projetos concluídos
                // Cores mais suaves para o modo dark
                const colorMap: { [key: number]: { bg: string; bgDark: string; text: string; textDark: string; border: string; borderDark: string; dot: string } } = {
                  0: { bg: 'bg-amber-50', bgDark: 'dark:bg-amber-500/15', text: 'text-amber-600', textDark: 'dark:text-amber-400', border: 'border-amber-200/50', borderDark: 'dark:border-amber-500/30', dot: 'bg-amber-500' },
                  1: { bg: 'bg-blue-50', bgDark: 'dark:bg-blue-500/15', text: 'text-blue-600', textDark: 'dark:text-blue-400', border: 'border-blue-200/50', borderDark: 'dark:border-blue-500/30', dot: 'bg-blue-500' },
                  2: { bg: 'bg-indigo-50', bgDark: 'dark:bg-indigo-500/15', text: 'text-indigo-600', textDark: 'dark:text-indigo-400', border: 'border-indigo-200/50', borderDark: 'dark:border-indigo-500/30', dot: 'bg-indigo-500' },
                  3: { bg: 'bg-purple-50', bgDark: 'dark:bg-purple-500/15', text: 'text-purple-600', textDark: 'dark:text-purple-400', border: 'border-purple-200/50', borderDark: 'dark:border-purple-500/30', dot: 'bg-purple-500' },
                  4: { bg: 'bg-rose-50', bgDark: 'dark:bg-rose-500/15', text: 'text-rose-600', textDark: 'dark:text-rose-400', border: 'border-rose-200/50', borderDark: 'dark:border-rose-500/30', dot: 'bg-rose-500' },
                  5: { bg: 'bg-emerald-50', bgDark: 'dark:bg-emerald-500/15', text: 'text-emerald-600', textDark: 'dark:text-emerald-400', border: 'border-emerald-200/50', borderDark: 'dark:border-emerald-500/30', dot: 'bg-emerald-500' },
                };
                // Usar módulo 6 para incluir todas as cores, mas verde só aparece depois de outras cores
                const colors = colorMap[index % 6] || colorMap[0];
                const isSelected = selectedCategoryFilter.includes(category.name);
                const hasAnySelection = selectedCategoryFilter.length > 0;

                return (
                  <button
                    key={category.id || index}
                    onClick={() => toggleCategoryFilter(category.name)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all cursor-pointer ${isSelected
                      ? `${colors.bg} ${colors.bgDark} ${colors.text} ${colors.textDark} ${colors.border} ${colors.borderDark} ring-2 ring-offset-2 ring-current dark:ring-offset-slate-900`
                      : hasAnySelection
                        ? 'bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800/50 dark:text-slate-500 dark:border-slate-700/50 opacity-60'
                        : `${colors.bg} ${colors.bgDark} ${colors.text} ${colors.textDark} ${colors.border} ${colors.borderDark} hover:opacity-80`
                      }`}
                  >
                    <span className={`size-1.5 rounded-full ${isSelected ? colors.dot : 'bg-slate-400 dark:bg-slate-500'}`}></span> {category.name}
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
          cursor: isPanning ? 'grabbing' : 'grab'
        }}
        onMouseDown={(e: React.MouseEvent) => {
          // Não ativa se for botão direito do mouse
          if (e.button !== 0) return;

          const target = e.target as HTMLElement;

          // Não ativa apenas em elementos realmente interativos (inputs, buttons, etc)
          // Mas permite em qualquer outro lugar, incluindo projetos
          if (
            target.closest('input') ||
            target.closest('select') ||
            target.closest('textarea') ||
            target.closest('a[href]')
          ) {
            return;
          }

          // Resetar flags
          hasMovedRef.current = false;
          clickPreventedRef.current = false;

          // Ativa pan em qualquer lugar
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

          const deltaX = Math.abs(e.pageX - panStart.x);
          const deltaY = Math.abs(e.pageY - panStart.y);
          const threshold = 5; // Threshold de 5px para considerar movimento

          // Se moveu mais que o threshold, considera arrasto
          if (deltaX > threshold || deltaY > threshold) {
            hasMovedRef.current = true;
            clickPreventedRef.current = true;
          }

          e.preventDefault();
          const x = e.pageX;
          const walk = (x - panStart.x) * 1.5;
          scrollContainerRef.current.scrollLeft = panStart.scrollLeft - walk;
        }}
        onMouseUp={() => {
          setIsPanning(false);
          // Resetar após um pequeno delay para permitir que onClick seja processado primeiro
          setTimeout(() => {
            hasMovedRef.current = false;
            clickPreventedRef.current = false;
          }, 100);
        }}
        onMouseLeave={() => {
          setIsPanning(false);
          hasMovedRef.current = false;
          clickPreventedRef.current = false;
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
            <div className="sticky top-0 z-10 flex bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="w-64 flex-shrink-0 sticky left-0 z-20 p-4 border-r border-slate-200 dark:border-slate-600 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-300 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-[4px_0_16px_-2px_rgba(0,0,0,0.12)] dark:shadow-[4px_0_16px_-2px_rgba(0,0,0,0.5)]">Projetos / Clientes</div>
              <div className="flex-1 flex bg-white/70 dark:bg-slate-900/70 backdrop-blur-md">
                {days.map((day, i) => {
                  const today = isToday(day.date);

                  // Calcular posição da bolinha no topo baseado no horário atual
                  const now = new Date();
                  const minutesInDay = (now.getHours() * 60) + now.getMinutes();
                  const positionX = (minutesInDay / 1440) * 100;

                  const dayOfWeek = day.date.getDay();
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                  return (
                    <div
                      key={i}
                      className={`w-[100px] flex-shrink-0 text-center border-r flex items-center justify-center relative ${today
                        ? 'bg-slate-50/30 dark:bg-slate-800/10 border-r-slate-100 dark:border-r-slate-800/50'
                        : isWeekend
                          ? 'bg-slate-100/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800/50'
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
                        <span className={`block text-[8px] font-bold leading-none uppercase mb-1 ${today ? 'text-primary' : isWeekend ? 'text-rose-400 dark:text-rose-500/70' : 'text-slate-400 dark:text-slate-500'}`}>
                          {day.label.split(' ')[0]}
                        </span>
                        <span className={`flex items-center justify-center size-7 text-sm font-black tracking-tight rounded-full transition-all mb-1 ${today
                          ? 'bg-primary text-white shadow-sm shadow-primary/20'
                          : isWeekend
                            ? 'text-rose-500 dark:text-rose-400'
                            : 'text-slate-900 dark:text-white'
                          }`}>
                          {day.label.split(' ')[1]}
                        </span>
                        <span className={`block text-[8px] font-bold leading-none uppercase ${today ? 'text-primary' : isWeekend ? 'text-rose-400 dark:text-rose-500/70' : 'text-slate-400 dark:text-slate-500'}`}>
                          {day.label.split(' ')[2]}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {/* Preenchimento para ocupar o resto do espaço */}
                <div className="flex-1 bg-white dark:bg-slate-900" />
              </div>
            </div>

            {/* Container dos projetos com linha vertical contínua */}
            <div className="relative">
              {/* Linha vertical contínua do dia atual - atravessa todos os projetos */}
              {(() => {
                const todayIndex = days.findIndex(day => isToday(day.date));
                if (todayIndex === -1) return null;

                const now = new Date();
                const minutesInDay = (now.getHours() * 60) + now.getMinutes();
                const positionX = (minutesInDay / 1440) * 100;
                // Posição = largura da coluna de nomes (256px) + (índice do dia * largura da coluna) + posição dentro da coluna
                const leftPosition = 256 + (todayIndex * 100) + positionX;

                return (
                  <div
                    className="absolute top-0 bottom-0 w-px bg-primary/40 z-30 pointer-events-none"
                    style={{ left: `${leftPosition}px` }}
                  />
                );
              })()}

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {projectsForTimeline.map((project) => {
                  const { startColumn, duration } = getProjectPosition(project);
                  const pTypes = project.types || (project.type ? [project.type] : []);
                  const categoryColor = getCategoryColor(pTypes[0] || '');
                  const deadlineDate = parseSafeDate(project.deadline);
                  // Verificar se está atrasado (comparando apenas a data, sem horas)
                  let isLate = false;
                  if (deadlineDate && project.status !== 'Completed' && project.status !== 'Finished') {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const deadline = new Date(deadlineDate);
                    deadline.setHours(0, 0, 0, 0);
                    isLate = deadline < today;
                    
                    // Log para debug
                    if (project.name === 'Renascençaa retrovisores' || project.name === 'Editora N-1') {
                      console.log(`🔍 [Timeline] Projeto: ${project.name}`, {
                        deadlineDate: deadlineDate,
                        deadline: deadline.toISOString(),
                        today: today.toISOString(),
                        isLate: isLate,
                        status: project.status,
                        stageId: project.stageId,
                        deadlineTimestamp: deadline.getTime(),
                        todayTimestamp: today.getTime(),
                        comparison: deadline < today
                      });
                    }
                  } else {
                    // Log quando não tem deadline ou está concluído
                    if (project.name === 'Renascençaa retrovisores' || project.name === 'Editora N-1') {
                      console.log(`🔍 [Timeline] Projeto: ${project.name} - Sem deadline ou concluído`, {
                        hasDeadline: !!deadlineDate,
                        status: project.status,
                        deadlineDate: project.deadline
                      });
                    }
                  }
                  // Verificar se está na etapa "Em Revisão" APENAS pelo stageId
                  // Não usar status porque tanto "Em Revisão" quanto "Ajustes" têm status 'Review'
                  const isReviewStage = project.stageId?.includes('review') && !project.stageId?.includes('adjustments');
                  const isReview = isReviewStage; // Só considerar em revisão se realmente estiver na etapa de revisão pelo stageId
                  const temporalProgress = getTemporalProgress(project, startColumn, duration);

                  const maintenanceCol = getDateColumn(project.maintenanceDate);
                  const reportCol = getDateColumn(project.reportDate);
                  const isRecurring = pTypes.some(typeName => categories.find(cat => cat.name === typeName && cat.isRecurring));

                  // Recorrentes: verificar se manutenção ou relatório estão vencidos (para sinalização no cronograma)
                  const todayForLate = new Date();
                  todayForLate.setHours(0, 0, 0, 0);
                  const maintenanceDateParsed = project.maintenanceDate ? parseSafeDate(project.maintenanceDate) : null;
                  const isMaintenanceLate = maintenanceDateParsed
                    ? new Date(maintenanceDateParsed.getFullYear(), maintenanceDateParsed.getMonth(), maintenanceDateParsed.getDate()) < todayForLate
                    : false;
                  const reportDateParsed = project.reportDate ? parseSafeDate(project.reportDate) : null;
                  const isReportLate = reportDateParsed
                    ? new Date(reportDateParsed.getFullYear(), reportDateParsed.getMonth(), reportDateParsed.getDate()) < todayForLate
                    : false;
                  const isRecurringOverdue = isRecurring && (isMaintenanceLate || isReportLate);

                  const showProjectBar = project.deadline && project.status !== 'Completed' && project.status !== 'Finished';

                  // Obter classes CSS baseadas na cor da categoria
                  const getCategoryBadgeClasses = (color: string) => {
                    const colorMap: { [key: string]: string } = {
                      'amber': 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
                      'blue': 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400',
                      'emerald': 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
                      'indigo': 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400',
                      'purple': 'bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400',
                      'rose': 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
                    };
                    return colorMap[color] || 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400';
                  };

                  return (
                    <div
                      key={project.id}
                      onClick={(e) => {
                        // Prevenir clique se houve arrasto ou ainda está arrastando
                        if (clickPreventedRef.current || hasMovedRef.current || isPanning) {
                          e.preventDefault();
                          e.stopPropagation();
                          return;
                        }
                        onProjectClick?.(project);
                      }}
                      className={`flex hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group ${isPanning ? 'cursor-grabbing' : 'cursor-pointer'}`}
                    >
                      <div className="w-64 flex-shrink-0 sticky left-0 z-10 p-4 border-r border-slate-200 dark:border-slate-600 flex flex-col gap-1 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-[4px_0_16px_-2px_rgba(0,0,0,0.12)] dark:shadow-[4px_0_16px_-2px_rgba(0,0,0,0.5)]">
                        <h4 className="text-sm font-bold truncate">{project.name}</h4>
                        <div className="flex flex-wrap items-center gap-1">
                          {pTypes.slice(0, 2).map((typeName, idx) => (
                            <span key={idx} className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded w-fit ${getCategoryBadgeClasses(getCategoryColor(typeName))}`}>
                              {typeName}
                            </span>
                          ))}
                          {pTypes.length > 2 && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-1 py-0.5 rounded text-slate-500 bg-slate-100 dark:bg-slate-800">
                              +{pTypes.length - 2}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Colunas - mesma estrutura flex do header */}
                      <div className="flex-1 flex relative bg-white dark:bg-slate-900 h-20">
                        {/* Sinalização de vencido na área do calendário (recorrentes) - no canto superior esquerdo da linha para não sobrepor a barra */}
                        {isRecurringOverdue && (
                          <div className="absolute left-2 top-1.5 z-0 flex items-center gap-1.5 flex-wrap">
                            {isMaintenanceLate && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500 text-white dark:bg-rose-600 dark:text-white shadow-sm border border-rose-400/50" title="Data de manutenção vencida">
                                <span className="material-symbols-outlined text-xs">build</span> Manutenção vencida
                              </span>
                            )}
                            {isReportLate && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500 text-white dark:bg-rose-600 dark:text-white shadow-sm border border-rose-400/50" title="Data de relatório vencida">
                                <span className="material-symbols-outlined text-xs">description</span> Relatório vencido
                              </span>
                            )}
                          </div>
                        )}
                        {/* Grid de colunas de fundo */}
                        {days.map((day, i) => {
                          const today = isToday(day.date);

                          return (
                            <div
                              key={i}
                              className={`w-[100px] h-20 border-r flex-shrink-0 relative ${today
                                ? 'bg-primary/[0.01] dark:bg-primary/[0.02] border-r-slate-100 dark:border-r-slate-800/50'
                                : 'border-slate-100 dark:border-slate-800/50'
                                }`}
                            >
                            </div>
                          );
                        })}
                        {/* Preenchimento para ocupar o resto do espaço */}
                        <div className="flex-1 h-20 bg-white dark:bg-slate-900" />

                        {/* Barra do projeto (se aplicável) */}
                        {showProjectBar && (() => {
                          // Calcular posição da régua em relação à barra do projeto
                          const today = new Date();
                          const todayColumn = days.findIndex(day => {
                            const dayDate = new Date(day.date);
                            return dayDate.toDateString() === today.toDateString();
                          });

                          // Calcular a largura do overlay baseado na posição atual no tempo
                          let overlayWidth = 0;

                          if (todayColumn >= 0) {
                            const now = new Date();
                            const minutesInDay = (now.getHours() * 60) + now.getMinutes();
                            const positionInColumn = (minutesInDay / 1440) * 100; // Posição em pixels dentro da coluna (0-100)

                            // Posição absoluta da régua em pixels (considerando todas as colunas)
                            const rulerAbsolutePosition = todayColumn * 100 + positionInColumn;

                            // Posição absoluta do início da barra do projeto
                            const barStartPosition = startColumn * 100;

                            // Posição absoluta do fim da barra do projeto
                            const barEndPosition = barStartPosition + (duration * 100);

                            // Se a régua está antes do início da barra, overlay = 0%
                            if (rulerAbsolutePosition <= barStartPosition) {
                              overlayWidth = 0;
                            }
                            // Se a régua está depois do fim da barra, overlay = 100%
                            else if (rulerAbsolutePosition >= barEndPosition) {
                              overlayWidth = 100;
                            }
                            // senão, calcular a porcentagem proporcional
                            else {
                              const barWidth = duration * 100;
                              const positionInBar = rulerAbsolutePosition - barStartPosition;
                              overlayWidth = (positionInBar / barWidth) * 100;
                            }
                          } else {
                            // Se hoje não está visível no cronograma, usar o cálculo temporal original
                            overlayWidth = temporalProgress;
                          }

                          // Determinar cor baseada no status/stageId do projeto
                          const isAdjustmentsStage = project.stageId?.includes('adjustments') || false;
                          const isMaintenanceStage = project.stageId?.includes('maintenance') || false;
                          const isOnboardingStage = project.stageId?.includes('onboarding') || project.status === 'Lead';
                          const isDevelopmentStage = project.stageId?.includes('development') || project.status === 'Active';

                          // Definir classe de cor baseada no estágio do projeto
                          const getStageColorClass = (type: 'bg' | 'border' | 'text' | 'overlay') => {
                            // Log para debug dos projetos específicos
                            if ((project.name === 'Renascençaa retrovisores' || project.name === 'Editora N-1') && type === 'bg') {
                              console.log(`🎨 [Timeline] Determinando cor para: ${project.name}`, {
                                isReview,
                                isLate,
                                isAdjustmentsStage,
                                isDevelopmentStage,
                                isOnboardingStage,
                                isMaintenanceStage,
                                status: project.status,
                                stageId: project.stageId
                              });
                            }
                            
                            // Prioridade: Revisão > Atraso > Outros estágios
                            // Efeito glass (fundos semitransparentes + backdrop-blur na barra)
                            if (isReview) {
                              if (type === 'bg') return 'bg-amber-500/15 dark:bg-amber-500/25';
                              if (type === 'border') return 'border-l-4 border-l-amber-500 ring-2 ring-amber-500/30';
                              if (type === 'text') return 'text-amber-700 dark:text-amber-300 font-semibold';
                              return 'bg-amber-500/45 dark:bg-amber-500/55';
                            }
                            if (isLate && !isReview) {
                              if (project.name === 'Renascençaa retrovisores' || project.name === 'Editora N-1') {
                                console.log(`🔴 [Timeline] Aplicando cor VERMELHA para: ${project.name}`, { type });
                              }
                              if (type === 'bg') return 'bg-rose-500/15 dark:bg-rose-500/25';
                              if (type === 'border') return 'border-l-4 border-l-rose-500';
                              if (type === 'text') return 'text-rose-700 dark:text-rose-300 font-semibold';
                              return 'bg-rose-500/45 dark:bg-rose-500/55';
                            }
                            if (isMaintenanceStage) {
                              if (type === 'bg') return 'bg-amber-800/15 dark:bg-amber-800/25';
                              if (type === 'border') return 'border-l-4 border-l-amber-800';
                              if (type === 'text') return 'text-amber-800 dark:text-amber-300 font-semibold';
                              return 'bg-amber-800/45 dark:bg-amber-800/55';
                            }
                            if (isAdjustmentsStage || isDevelopmentStage) {
                              if (type === 'bg') return 'bg-blue-500/15 dark:bg-blue-500/25';
                              if (type === 'border') return 'border-l-4 border-l-blue-500';
                              if (type === 'text') return 'text-blue-700 dark:text-blue-300 font-semibold';
                              return 'bg-blue-500/45 dark:bg-blue-500/55';
                            }
                            if (isOnboardingStage) {
                              if (type === 'bg') return 'bg-slate-400/15 dark:bg-slate-400/25';
                              if (type === 'border') return 'border-l-4 border-l-slate-400';
                              if (type === 'text') return 'text-slate-600 dark:text-slate-300 font-semibold';
                              return 'bg-slate-400/45 dark:bg-slate-400/55';
                            }
                            if (type === 'bg') return 'bg-blue-500/15 dark:bg-blue-500/25';
                            if (type === 'border') return 'border-l-4 border-l-blue-500';
                            if (type === 'text') return 'text-blue-700 dark:text-blue-300 font-semibold';
                            return 'bg-blue-500/45 dark:bg-blue-500/55';
                          };

                          return (
                            <div
                              className={`absolute top-1/2 -translate-y-1/2 h-8 ${getStageColorClass('bg')} ${getStageColorClass('border')} rounded-r-lg flex items-center px-3 gap-2 overflow-hidden z-0 backdrop-blur-md`}
                              style={{
                                left: `${startColumn * 100}px`,
                                width: `${duration * 100}px`,
                                minWidth: '100px'
                              }}
                            >
                              <div
                                className={`h-full absolute left-0 top-0 rounded-r transition-all z-0 ${getStageColorClass('overlay')}`}
                                style={{ width: `${overlayWidth}%` }}
                                title={`Progresso temporal: ${temporalProgress.toFixed(1)}%`}
                              />
                              <span className={`text-[11px] font-bold relative z-10 truncate flex-1 min-w-0 ${getStageColorClass('text')} drop-shadow-sm`}>
                                {isLate && !isReview ? 'Atrasado' : getStatusLabel(project)}
                              </span>
                              {isAdjustmentsStage && (
                                <span className={`material-symbols-outlined text-sm relative z-10 flex-shrink-0 drop-shadow-sm ${
                                  isLate && !isReview 
                                    ? 'text-rose-500 dark:text-rose-400' 
                                    : 'text-blue-600 dark:text-blue-400'
                                }`}>
                                  build
                                </span>
                              )}
                              {isReview && !isAdjustmentsStage && <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-sm relative z-10 flex-shrink-0 drop-shadow-sm">rate_review</span>}
                              {isLate && !isReview && !isAdjustmentsStage && <span className="material-symbols-outlined text-rose-500 dark:text-rose-400 text-sm relative z-10 flex-shrink-0 drop-shadow-sm">priority_high</span>}
                            </div>
                          );
                        })()}

                        {/* Marcadores de Manutenção e Relatório (para Recorrência) */}
                        {(() => {
                          // Verificar se ambos estão no mesmo dia
                          const sameDay = maintenanceCol !== -1 && reportCol !== -1 && maintenanceCol === reportCol;
                          // Offset harmonioso quando estão no mesmo dia (12px para um espaçamento mais natural)
                          const offset = sameDay ? 12 : 0;

                          return (
                            <>
                              {maintenanceCol !== -1 && (
                                <div
                                  className={`absolute top-1/2 z-20 flex flex-col items-center gap-1 group/marker transition-all`}
                                  style={{
                                    left: `${maintenanceCol * 100 + 50 - (sameDay ? offset : 0)}px`,
                                    transform: 'translate(-50%, -50%)'
                                  }}
                                >
                                  <div className={`size-10 rounded-full border-2 flex items-center justify-center shadow-sm transition-transform group-hover/marker:scale-110 ${
                                    isMaintenanceLate
                                      ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800/50 text-rose-600 dark:text-rose-400'
                                      : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/50 text-blue-600 dark:text-blue-400'
                                  }`}>
                                    <span className="material-symbols-outlined text-xl">build</span>
                                  </div>
                                  <span className="bg-slate-800 text-white text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover/marker:opacity-100 transition-opacity whitespace-nowrap">
                                    Manutenção: {new Date(project.maintenanceDate!).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                  </span>
                                </div>
                              )}

                              {reportCol !== -1 && (
                                <div
                                  className={`absolute top-1/2 z-20 flex flex-col items-center gap-1 group/marker transition-all`}
                                  style={{
                                    left: `${reportCol * 100 + 50 + (sameDay ? offset : 0)}px`,
                                    transform: 'translate(-50%, -50%)'
                                  }}
                                >
                                  <div className={`size-10 rounded-full border-2 flex items-center justify-center shadow-sm transition-transform group-hover/marker:scale-110 ${
                                    isReportLate
                                      ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-800/50 text-rose-600 dark:text-rose-400'
                                      : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/50 text-amber-600 dark:text-amber-400'
                                  }`}>
                                    <span className="material-symbols-outlined text-xl">description</span>
                                  </div>
                                  <span className="bg-slate-800 text-white text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover/marker:opacity-100 transition-opacity whitespace-nowrap">
                                    Relatório: {new Date(project.reportDate!).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                  </span>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
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

