
import React, { useState, useEffect } from 'react';
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

  // Calcular a data inicial do cronograma (deadline mais antiga de projetos não concluídos)
  const calculateStartDate = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Filtrar apenas projetos não concluídos que tenham deadline
    const activeProjects = projects.filter(p => 
      p.status !== 'Completed' && p.status !== 'Finished' && p.deadline
    );
    
    if (activeProjects.length === 0) {
      return today;
    }
    
    let earliestDeadline: Date | null = null;
    
    activeProjects.forEach(project => {
      if (project.deadline) {
        const deadline = project.deadline instanceof Date ? project.deadline : new Date(project.deadline);
        deadline.setHours(0, 0, 0, 0);
        
        if (!earliestDeadline || deadline < earliestDeadline) {
          earliestDeadline = deadline;
        }
      }
    });
    
    if (earliestDeadline && earliestDeadline < today) {
      return earliestDeadline;
    }
    
    return today;
  };
  
  // Calcular até quando mostrar o cronograma (3 dias após a deadline mais distante)
  const calculateEndDate = (startDate: Date) => {
    let maxDeadline: Date | null = null;
    
    projects.forEach(project => {
      if (project.deadline) {
        const deadline = project.deadline instanceof Date ? project.deadline : new Date(project.deadline);
        deadline.setHours(0, 0, 0, 0);
        
        if (!maxDeadline || deadline > maxDeadline) {
          maxDeadline = deadline;
        }
      }
    });
    
    if (!maxDeadline) {
      // Se não houver deadline, usar 3 dias a partir da data inicial
      const defaultEndDate = new Date(startDate);
      defaultEndDate.setDate(startDate.getDate() + 3);
      return defaultEndDate;
    }
    
    // Adicionar 3 dias após a deadline mais distante
    const endDate = new Date(maxDeadline);
    endDate.setDate(maxDeadline.getDate() + 3);
    
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
    
    // Depois mostrar a cada 2 dias
    for (let i = 2; i < totalDays; i += 2) {
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
    const diffDaysStart = Math.ceil(diffTimeStart / (1000 * 60 * 60 * 24));
    const startDay = Math.max(0, diffDaysStart);
    
    let startColumn = 0;
    for (let i = 0; i < days.length; i++) {
      if (days[i].index >= startDay) {
        startColumn = i;
        break;
      }
      if (i === days.length - 1) {
        startColumn = i;
      }
    }
    
    const diffTimeEnd = endDate.getTime() - firstDayDate.getTime();
    const diffDaysEnd = Math.ceil(diffTimeEnd / (1000 * 60 * 60 * 24));
    const endDay = Math.max(0, diffDaysEnd);
    
    // Encontrar a coluna que contém ou está imediatamente antes do deadline
    // A barra deve terminar na ou antes da deadline, nunca depois
    let endColumn = startColumn; // Começar com a coluna inicial como mínimo
    
    // Procurar a coluna mais próxima que seja <= endDay
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].index <= endDay && i >= startColumn) {
        endColumn = i;
        break;
      }
    }
    
    // Se não encontrou nenhuma coluna <= endDay, usar a última coluna disponível
    if (endColumn === startColumn && endDay > days[days.length - 1]?.index) {
      endColumn = days.length - 1;
    }
    
    let durationColumns = endColumn - startColumn + 1;
    durationColumns = Math.max(1, durationColumns);
    
    const maxStartColumn = Math.max(0, days.length - 1);
    const finalStartColumn = Math.min(startColumn, maxStartColumn);
    
    const maxDuration = days.length - finalStartColumn;
    
    if (endColumn >= days.length) {
      const finalDuration = maxDuration;
      return {
        startColumn: finalStartColumn,
        duration: finalDuration
      };
    }
    
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

  // Filtrar apenas projetos com deadline, não concluídos e por categoria se selecionada
  const projectsWithDeadline = projects.filter(p => {
    if (!p.deadline) return false;
    if (p.status === 'Completed' || p.status === 'Finished') return false; // Excluir projetos finalizados
    if (selectedCategoryFilter.length === 0) return true; // Nenhum filtro selecionado = mostra todos
    return selectedCategoryFilter.some(filter => p.type === filter);
  });

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
    inDevelopment: projectsWithDeadline.filter(p => p.status === 'Active').length,
    completed: projectsWithDeadline.filter(p => p.status === 'Completed' || p.status === 'Finished').length,
    late: projectsWithDeadline.filter(p => {
      if (!p.deadline || p.status === 'Completed' || p.status === 'Finished') return false;
      const deadline = p.deadline instanceof Date ? p.deadline : new Date(p.deadline);
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

      <div className="flex-1 overflow-auto bg-white dark:bg-slate-900">
        {projectsWithDeadline.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">calendar_month</span>
            <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-400 mb-2">Nenhum projeto com prazo definido</h3>
            <p className="text-sm text-slate-500">Adicione prazos aos seus projetos para visualizá-los no cronograma.</p>
          </div>
        ) : (
          <div className="min-w-full">
          <div className="sticky top-0 z-10 flex bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="w-64 flex-shrink-0 p-4 border-r border-slate-200 dark:border-slate-800 font-bold text-xs uppercase tracking-wider text-slate-400">Projetos / Clientes</div>
              <div className="flex-1 flex bg-white dark:bg-slate-900">
                {days.map((day, i) => (
                  <div key={i} className="w-[100px] flex-shrink-0 text-center border-r border-slate-100 dark:border-slate-800/50 flex items-center justify-center">
                    <span className="block text-xs font-bold py-4">
                      {day.label.split(' ')[0]}
                      <br />
                      {day.label.split(' ')[1]}
                    </span>
                </div>
              ))}
                {/* Preenchimento para ocupar o resto do espaço */}
                <div className="flex-1 bg-white dark:bg-slate-900" />
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {projectsWithDeadline.map((project) => {
                const { startColumn, duration } = getProjectPosition(project);
                const categoryColor = getCategoryColor(project.type);
                const statusColor = getStatusColor(project.status, project.tagColor, project.type);
                const isLate = project.deadline && new Date(project.deadline) < new Date() && project.status !== 'Completed' && project.status !== 'Finished';
                const isReview = project.status === 'Review';
                const temporalProgress = getTemporalProgress(project, startColumn, duration);
                
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
                      <h4 className="text-sm font-bold">{project.name}</h4>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded w-fit ${getCategoryBadgeClasses(categoryColor)}`}>
                        {project.type}
                      </span>
                    </div>
                    {/* Colunas - mesma estrutura flex do header */}
                    <div className="flex-1 flex relative bg-white dark:bg-slate-900">
                      {/* Grid de colunas de fundo */}
                      {days.map((_, i) => (
                        <div 
                          key={i} 
                          className="w-[100px] h-20 border-r border-slate-100 dark:border-slate-800/50 bg-white dark:bg-slate-900 flex-shrink-0"
                        />
                      ))}
                      {/* Preenchimento para ocupar o resto do espaço */}
                      <div className="flex-1 h-20 bg-white dark:bg-slate-900" />
                      {/* Barra do projeto posicionada sobre as colunas */}
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
                        } rounded-r-lg flex items-center px-3 gap-2 overflow-hidden`}
                        style={{ 
                          left: `${startColumn * 100}px`, 
                          width: `${duration * 100}px`,
                          minWidth: '100px'
                        }}
                      >
                        {project.deadline && (
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
                        )}
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
            {stats.inDevelopment > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-blue-500"></span>
                <span>{stats.inDevelopment} em desenvolvimento</span>
              </div>
            )}
            {stats.completed > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500"></span>
                <span>{stats.completed} concluídos</span>
              </div>
            )}
            {stats.late > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-xs text-rose-500">priority_high</span>
                <span className="text-rose-500">{stats.late} atrasados</span>
              </div>
            )}
          </div>
        </div>
        <div>Exibindo {projectsWithDeadline.length} de {projects.length} projetos</div>
      </footer>
    </div>
  );
};

const Badge: React.FC<{ color: string; dotColor: string; label: string }> = ({ color, dotColor, label }) => (
  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${color}`}>
    <span className={`size-1.5 rounded-full ${dotColor}`}></span> {label}
  </span>
);

