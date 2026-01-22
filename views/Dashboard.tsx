
import React, { useState, useEffect, useRef } from 'react';
import { Project, Stage, Workspace, Category } from '../types';
import { 
  subscribeToProjects, 
  subscribeToCategories, 
  addProject as addProjectToFirebase,
  addCategory as addCategoryToFirebase,
  deleteCategory as deleteCategoryFromFirebase,
  updateProject as updateProjectInFirebase,
  subscribeToStages,
  saveStages,
  addStage,
  deleteStage as deleteStageFromFirebase,
  updateStage,
  getStages,
  Stage as FirebaseStage,
  getStageTasks,
  saveStageTasks,
  getUniqueClients,
  deleteProject,
  removeProjectStageId,
  addInvoice
} from '../firebase/services';

interface DashboardProps {
  onProjectClick?: (project: Project) => void;
  currentWorkspace?: Workspace | null;
  initialFilter?: string;
  highlightedProjectId?: string;
}

type ViewMode = 'board' | 'list';

const pipelineProjects: Project[] = [
  {
    id: '1',
    name: 'TechStart Inc.',
    client: 'TechStart Inc.',
    description: 'Refresh completo de identidade de marca e documentação de diretrizes.',
    type: 'Identidade Visual',
    status: 'Lead',
    progress: 0,
    tagColor: 'amber',
    avatar: 'https://picsum.photos/seed/tech/40/40',
    deadline: 'Follow up 2d'
  },
  {
    id: '2',
    name: 'Solar Solutions',
    client: 'Solar Solutions',
    description: 'Landing page corporativa para nova linha de produtos solares.',
    type: 'Redesign Web',
    status: 'Lead',
    progress: 0,
    tagColor: 'blue',
    avatar: 'https://picsum.photos/seed/solar/40/40',
    urgency: true
  },
  {
    id: '3',
    name: 'Global Logistics',
    client: 'Global Logistics',
    description: 'Sistema ERP personalizado para rastreamento de armazém.',
    type: 'App Dev',
    status: 'Active',
    progress: 65,
    tagColor: 'emerald',
    avatar: 'https://picsum.photos/seed/global/40/40'
  },
  {
    id: '4',
    name: 'FinEdge Banking',
    client: 'FinEdge Banking',
    description: 'Interface de dashboard bancário de próxima geração.',
    type: 'SaaS UI Kit',
    status: 'Review',
    progress: 90,
    tagColor: 'indigo',
    avatar: 'https://picsum.photos/seed/finedge/40/40'
  }
];

interface Stage {
  id: string;
  title: string;
  status: Project['status'];
  order: number;
  progress: number;
  isFixed?: boolean; // Etapas fixas não podem ser excluídas
}

// Função para recalcular progresso de todas as etapas
const recalculateStageProgress = (stages: Stage[]): Stage[] => {
  const totalStages = stages.length;
  if (totalStages === 0) return stages;
  
  return stages.map((stage, index) => {
    // Calcula progresso: (order / (total - 1)) * 100
    // Se só tem 1 etapa, progresso = 100%
    const progress = totalStages === 1 ? 100 : Math.round((index / (totalStages - 1)) * 100);
    
    // Para etapas fixas, preservar o status original
    // Para etapas personalizadas, determinar status automaticamente baseado na posição
    let status: Project['status'];
    
    if (stage.isFixed) {
      // Preservar status original das etapas fixas
      status = stage.status;
    } else {
      // Determinar status automaticamente para etapas personalizadas
      if (index === 0) status = 'Lead';
      else if (index === totalStages - 1) status = 'Completed';
      else if (index < totalStages / 2) status = 'Active';
      else status = 'Review';
    }
    
    return {
      ...stage,
      progress,
      status
    };
  });
};

// Etapas fixas para serviços normais (sob demanda)
const fixedStages: Stage[] = [
  { id: 'onboarding', title: 'On boarding', status: 'Lead', order: 0, progress: 0, isFixed: true },
  { id: 'development', title: 'Em desenvolvimento', status: 'Active', order: 1, progress: 33, isFixed: true },
  { id: 'review', title: 'Em Revisão', status: 'Review', order: 2, progress: 66, isFixed: true },
  { id: 'completed', title: 'Concluído', status: 'Completed', order: 3, progress: 100, isFixed: true }
];

// Etapas fixas para serviços recorrentes
const fixedStagesRecurring: Stage[] = [
  { id: 'onboarding-recurring', title: 'On boarding', status: 'Lead', order: 0, progress: 0, isFixed: true },
  { id: 'development-recurring', title: 'Em desenvolvimento', status: 'Active', order: 1, progress: 25, isFixed: true },
  { id: 'review-recurring', title: 'Em Revisão', status: 'Review', order: 2, progress: 50, isFixed: true },
  { id: 'maintenance-recurring', title: 'Manutenção', status: 'Completed', order: 3, progress: 75, isFixed: true },
  { id: 'finished-recurring', title: 'Finalizado', status: 'Finished', order: 4, progress: 100, isFixed: true }
];

export const Dashboard: React.FC<DashboardProps> = ({ onProjectClick, currentWorkspace, initialFilter, highlightedProjectId }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [selectedFilter, setSelectedFilter] = useState<string>(initialFilter || 'all');
  const [categories, setCategories] = useState<Category[]>([]);
  const [showAddProject, setShowAddProject] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddStage, setShowAddStage] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [stages, setStages] = useState<Stage[]>(recalculateStageProgress(fixedStages));
  const [loading, setLoading] = useState(true);
  const [draggedStage, setDraggedStage] = useState<Stage | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, scrollLeft: 0 });
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [stageMenuOpen, setStageMenuOpen] = useState<string | null>(null);
  const [stageToDelete, setStageToDelete] = useState<Stage | null>(null);
  const [stageToEditTasks, setStageToEditTasks] = useState<Stage | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const isInitialStagesLoad = useRef(true);
  const isDeletingStage = useRef(false);
  const isAddingFixedStages = useRef(false);

  // Verificar se o serviço selecionado é recorrente
  const isSelectedCategoryRecurring = React.useMemo(() => {
    if (selectedFilter === 'all' || selectedFilter === 'sem-categoria') return false;
    const selectedCategory = categories.find(cat => 
      cat.name.toLowerCase().replace(/\s+/g, '-') === selectedFilter
    );
    return selectedCategory?.isRecurring || false;
  }, [selectedFilter, categories]);

  // Obter as etapas fixas corretas baseado no tipo de serviço
  const currentFixedStages = React.useMemo(() => {
    return isSelectedCategoryRecurring ? fixedStagesRecurring : fixedStages;
  }, [isSelectedCategoryRecurring]);

  // Função para lidar com o drop de projeto
  const handleProjectDrop = async (project: Project, targetStage: Stage) => {
    try {
      // IDs fixos conhecidos para etapas normais
      const fixedStageIds = ['onboarding', 'development', 'review', 'completed'];
      
      // Verificar se é uma etapa recorrente (Manutenção ou Finalizado)
      const isRecurringStage = targetStage.title === 'Manutenção' || targetStage.title === 'Finalizado';
      
      // Para serviços recorrentes, não atualizar stageId (usar apenas status)
      const isProjectRecurring = categories.find(cat => 
        cat.name === project.type && cat.isRecurring
      );
      
      // Função para verificar se um stageId é de etapa fixa (considera variações de ID)
      const hasFixedStageId = (projectStageId: string | undefined): boolean => {
        if (!projectStageId) return false;
        const projectIdBase = projectStageId.split('-')[0];
        return fixedStageIds.includes(projectIdBase) || fixedStageIds.includes(projectStageId);
      };
      
      // Função para obter o ID base da etapa (originalId ou ID sem sufixo de workspace)
      const getStageBaseId = (stage: Stage): string => {
        const originalId = (stage as any).originalId;
        if (originalId) return originalId;
        // Se não tem originalId, extrair o ID base (antes do primeiro '-')
        const baseId = stage.id.split('-')[0];
        return fixedStageIds.includes(baseId) ? baseId : stage.id;
      };
      
      // Validar: projetos normais não podem ir para etapas recorrentes
      if (isRecurringStage && !isProjectRecurring) {
        setToast({ 
          message: "Apenas projetos de serviços recorrentes podem ser movidos para esta etapa.", 
          type: 'error' 
        });
        setTimeout(() => setToast(null), 5000);
        return;
      }
      
      // Validar: projetos recorrentes não podem ir para etapas normais (quando não está em "Todos os Projetos")
      if (!isRecurringStage && isProjectRecurring && selectedFilter !== 'all') {
        // Permitir apenas se for um serviço recorrente selecionado
        if (!isSelectedCategoryRecurring) {
          return;
        }
      }
      
      // Obter o ID base da etapa alvo para comparação
      const targetStageBaseId = getStageBaseId(targetStage);
      const projectStageBaseId = project.stageId ? project.stageId.split('-')[0] : null;
      
      // Verificar se o projeto já está na etapa de destino (usando ID base ou status)
      if (selectedFilter === 'all' && !isRecurringStage) {
        // Em "Todos os Projetos" com etapa normal:
        if (isProjectRecurring) {
          // Projeto recorrente: verificar por stageId (se tiver) ou por status (se não tiver)
          if (hasFixedStageId(project.stageId)) {
            if (projectStageBaseId === targetStageBaseId) return;
          } else {
            // Projeto recorrente sem stageId: verificar por status
            if (project.status === targetStage.status) return;
          }
        } else {
          // Projeto normal: verificar por stageId base
          if (projectStageBaseId === targetStageBaseId) return;
        }
      } else if (isRecurringStage) {
        // Para etapas recorrentes: verificar por status (projetos recorrentes sem stageId fixo)
        if (isProjectRecurring && !hasFixedStageId(project.stageId) && project.status === targetStage.status) return;
      } else if (isProjectRecurring && selectedFilter !== 'all') {
        // Para projetos recorrentes em serviço específico: verificar por status
        if (project.status === targetStage.status) return;
      } else {
        // Para projetos normais: verificar por stageId base
        if (projectStageBaseId === targetStageBaseId) return;
      }
      
      // Definir progresso: 100% para Manutenção e Finalizado, senão usar o progresso da etapa
      const progress = (targetStage.title === 'Manutenção' || targetStage.title === 'Finalizado') 
        ? 100 
        : targetStage.progress;
      
      const updates: Partial<Project> = {
        status: targetStage.status,
        progress: progress
      };
      
      if (selectedFilter === 'all') {
        // Em "Todos os Projetos":
        if (isRecurringStage) {
          // Movendo para etapa recorrente: remover stageId se existir
          if (project.stageId) {
            await removeProjectStageId(project.id);
          }
        } else {
          // Movendo para etapa normal: usar o ID base da etapa para consistência
          updates.stageId = targetStageBaseId;
        }
      } else if (isSelectedCategoryRecurring) {
        // Em serviço recorrente específico:
        // SEMPRE remover stageId para que o projeto seja filtrado por status em "Todos os Projetos"
        // Isso garante sincronização: movimentos na aba "Recorrência" refletem em "Todos os Projetos"
        if (project.stageId) {
          await removeProjectStageId(project.id);
        }
      } else {
        // Em serviço normal específico: usar o ID base da etapa para consistência
        updates.stageId = targetStageBaseId;
      }
      
      await updateProjectInFirebase(project.id, updates);
    } catch (error) {
      console.error("Error updating project status:", error);
      setToast({ 
        message: "Erro ao mover projeto. Tente novamente.", 
        type: 'error' 
      });
      setTimeout(() => setToast(null), 5000);
    }
  };

  // Aplicar filtro inicial quando vier da busca
  useEffect(() => {
    if (initialFilter && initialFilter !== selectedFilter) {
      setSelectedFilter(initialFilter);
    }
  }, [initialFilter]);

  // Scroll para o projeto destacado quando ele aparecer
  useEffect(() => {
    if (highlightedProjectId) {
      setTimeout(() => {
        const highlightedCard = document.querySelector(`[data-project-id="${highlightedProjectId}"]`);
        if (highlightedCard) {
          highlightedCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);
    }
  }, [highlightedProjectId, projects]);

  // Carregar dados do Firebase filtrados por workspace
  useEffect(() => {
    if (!currentWorkspace) {
      console.log('⚠️ [Dashboard] Nenhum workspace selecionado, aguardando...');
      setProjects([]);
      setCategories([]);
      setStages([]);
      return;
    }
    
    console.log('📊 [Dashboard] Carregando dados para workspace:', currentWorkspace.id, currentWorkspace.name);
    
    // Resetar flags quando o workspace muda
    isInitialStagesLoad.current = true;
    isAddingFixedStages.current = false;
    isDeletingStage.current = false;
    
    setLoading(true);
    setStages([]); // Limpar etapas anteriores

    // Subscribe to real-time updates filtrados por workspace
    const unsubscribeProjects = subscribeToProjects((firebaseProjects) => {
      console.log('📦 [Dashboard] Projetos recebidos:', firebaseProjects.length);
      setProjects(firebaseProjects);
      setLoading(false);
    }, currentWorkspace.id);

    const unsubscribeCategories = subscribeToCategories((firebaseCategories) => {
      console.log('📁 [Dashboard] Categorias recebidas:', firebaseCategories.length);
      setCategories(firebaseCategories);
    }, currentWorkspace.id);

    const unsubscribeStages = subscribeToStages((firebaseStages) => {
      console.log('🏷️ [Dashboard] Etapas recebidas:', firebaseStages.length, 'isAdding:', isAddingFixedStages.current, 'isDeleting:', isDeletingStage.current);
      
      // Ignorar atualizações do subscribe durante exclusão ou adição de etapas fixas
      if (isDeletingStage.current || isAddingFixedStages.current) {
        console.log('⏭️ [Dashboard] Ignorando atualização de etapas (operação em andamento)');
        return;
      }
      
      if (firebaseStages.length > 0) {
        // Apenas recalcular progresso sem adicionar etapas fixas
        // As etapas fixas devem vir do Firebase
        const recalculated = recalculateStageProgress(firebaseStages);
        setStages(recalculated);
        isInitialStagesLoad.current = false;
      } else if (isInitialStagesLoad.current) {
        // Só criar etapas fixas na primeira vez (quando o Firebase está vazio para este workspace)
        console.log('🆕 [Dashboard] Criando etapas fixas para novo workspace');
        isInitialStagesLoad.current = false;
        isAddingFixedStages.current = true;
        
        // Criar cópias das etapas fixas com workspaceId
        const fixedStagesForWorkspace = fixedStages.map(stage => ({
          ...stage,
          workspaceId: currentWorkspace.id
        }));
        
        const fixedStagesRecalculated = recalculateStageProgress(fixedStagesForWorkspace);
        setStages(fixedStagesRecalculated);
        
        // Salvar etapas fixas no Firebase para este workspace
        saveStages(fixedStagesRecalculated, currentWorkspace.id).then(() => {
          console.log('✅ [Dashboard] Etapas fixas salvas com sucesso');
          setTimeout(() => {
            isAddingFixedStages.current = false;
          }, 1000);
        }).catch(err => {
          console.error("Error saving fixed stages:", err);
          isAddingFixedStages.current = false;
        });
      }
    }, currentWorkspace.id);

    return () => {
      unsubscribeProjects();
      unsubscribeCategories();
      unsubscribeStages();
    };
  }, [currentWorkspace?.id]); // Recarregar quando o workspace mudar

  // Funções utilitárias para limpar cache e etapas (podem ser chamadas via console)
  useEffect(() => {
    // Função para limpar cache do IndexedDB
    (window as any).clearFirestoreCache = async () => {
      try {
        // Limpar IndexedDB do Firebase - tentar diferentes nomes de database
        const dbNames = [
          'firestore/[DEFAULT]/gestao-artnaweb/main',
          'firebaseLocalStorageDb',
          'firebase-heap-js-*'
        ];
        
        let cleared = false;
        for (const dbName of dbNames) {
          try {
            const deleteReq = indexedDB.deleteDatabase(dbName);
            deleteReq.onsuccess = () => {
              console.log(`✅ Cache ${dbName} limpo!`);
              cleared = true;
            };
            deleteReq.onerror = () => {
              console.log(`⚠️ Não foi possível limpar ${dbName}`);
            };
          } catch (e) {
            console.log(`⚠️ Erro ao tentar limpar ${dbName}:`, e);
          }
        }
        
        if (cleared) {
          console.log('✅ Cache do Firestore limpo com sucesso!');
          console.log('🔄 Recarregue a página para ver os dados atualizados.');
          alert('Cache limpo! Recarregue a página.');
        } else {
          console.log('⚠️ Nenhum cache encontrado para limpar.');
          alert('Nenhum cache encontrado ou já foi limpo.');
        }
      } catch (error) {
        console.error('❌ Erro ao limpar cache:', error);
        alert('Erro ao limpar cache. Verifique o console.');
      }
    };
    
    // Função para limpar todas as etapas não-fixas
    (window as any).clearAllStages = async () => {
      try {
        const allStages = await getStages();
        const nonFixedStages = allStages.filter(s => !s.isFixed);
        
        console.log(`Encontradas ${allStages.length} etapas no total`);
        console.log(`${nonFixedStages.length} etapas não-fixas para excluir`);
        
        if (nonFixedStages.length === 0) {
          console.log('✅ Nenhuma etapa não-fixa encontrada.');
          alert('✅ Nenhuma etapa não-fixa encontrada. Apenas as etapas fixas permanecem.');
          return;
        }
        
        const confirm = window.confirm(`Tem certeza que deseja excluir TODAS as ${nonFixedStages.length} etapas não-fixas? Esta ação não pode ser desfeita!`);
        if (!confirm) {
          console.log('Operação cancelada.');
          return;
        }
        
        console.log('Excluindo etapas não-fixas...');
        await Promise.all(nonFixedStages.map(stage => {
          console.log(`Excluindo etapa: ${stage.id} - ${stage.title}`);
          return deleteStageFromFirebase(stage.id);
        }));
        
        console.log(`✅ ${nonFixedStages.length} etapas foram excluídas com sucesso!`);
        alert(`✅ ${nonFixedStages.length} etapas foram excluídas com sucesso!`);
      } catch (error) {
        console.error('❌ Erro ao excluir etapas:', error);
        alert('Erro ao excluir etapas. Verifique o console.');
      }
    };
    
    // Função para resetar etapas para as fixas atualizadas (incluindo "Em Revisão")
    (window as any).resetStagesToFixed = async () => {
      try {
        if (!currentWorkspace) {
          alert('Nenhum workspace selecionado!');
          return;
        }
        
        const confirm = window.confirm('Isso vai excluir TODAS as etapas do workspace atual e recriar as etapas padrão (On boarding, Em desenvolvimento, Em Revisão, Concluído). Deseja continuar?');
        if (!confirm) {
          console.log('Operação cancelada.');
          return;
        }
        
        console.log('🔄 Resetando etapas do workspace:', currentWorkspace.id);
        
        // Buscar todas as etapas do workspace atual
        const allStages = await getStages();
        const workspaceStages = allStages.filter(s => s.workspaceId === currentWorkspace.id);
        
        console.log(`Encontradas ${workspaceStages.length} etapas para excluir`);
        
        // Excluir todas as etapas do workspace
        if (workspaceStages.length > 0) {
          await Promise.all(workspaceStages.map(stage => {
            console.log(`Excluindo etapa: ${stage.id} - ${stage.title}`);
            return deleteStageFromFirebase(stage.id);
          }));
        }
        
        console.log('✅ Etapas antigas excluídas');
        
        // Criar novas etapas fixas
        const fixedStagesForWorkspace = fixedStages.map(stage => ({
          ...stage,
          workspaceId: currentWorkspace.id
        }));
        
        const fixedStagesRecalculated = recalculateStageProgress(fixedStagesForWorkspace);
        
        await saveStages(fixedStagesRecalculated, currentWorkspace.id);
        
        console.log('✅ Novas etapas criadas com sucesso!');
        alert('✅ Etapas resetadas com sucesso! A página será recarregada.');
        window.location.reload();
      } catch (error) {
        console.error('❌ Erro ao resetar etapas:', error);
        alert('Erro ao resetar etapas. Verifique o console.');
      }
    };
    
    // Log para facilitar o uso
    console.log('💡 Funções disponíveis no console:');
    console.log('   - window.clearFirestoreCache() - Limpa o cache do IndexedDB');
    console.log('   - window.clearAllStages() - Exclui todas as etapas não-fixas');
    console.log('   - window.resetStagesToFixed() - Reseta as etapas para as fixas padrão (com "Em Revisão")');
    
    return () => {
      delete (window as any).clearFirestoreCache;
      delete (window as any).clearAllStages;
      delete (window as any).resetStagesToFixed;
    };
  }, [currentWorkspace]);

  // Função utilitária para limpar todas as etapas (pode ser chamada via console)
  const clearAllStagesFunction = React.useCallback(async () => {
    try {
      const allStages = await getStages();
      console.log(`Encontradas ${allStages.length} etapas para excluir`);
      
      if (allStages.length === 0) {
        console.log('Nenhuma etapa encontrada.');
        alert('Nenhuma etapa encontrada.');
        return;
      }
      
      const confirm = window.confirm(`Tem certeza que deseja excluir TODAS as ${allStages.length} etapas? Esta ação não pode ser desfeita!`);
      if (!confirm) {
        console.log('Operação cancelada.');
        return;
      }
      
      console.log('Excluindo todas as etapas...');
      await Promise.all(allStages.map(stage => {
        console.log(`Excluindo etapa: ${stage.id} - ${stage.title}`);
        return deleteStageFromFirebase(stage.id);
      }));
      
      console.log('✅ Todas as etapas foram excluídas com sucesso!');
      alert(`✅ ${allStages.length} etapas foram excluídas com sucesso!`);
      
      // Limpar estado local
      setStages([]);
    } catch (error) {
      console.error('❌ Erro ao excluir etapas:', error);
      alert('Erro ao excluir etapas. Verifique o console para mais detalhes.');
    }
  }, [setStages]);

  useEffect(() => {
    (window as any).clearAllStages = clearAllStagesFunction;
    console.log('💡 Para limpar todas as etapas, execute: clearAllStages() no console');
    
    return () => {
      delete (window as any).clearAllStages;
    };
  }, [clearAllStagesFunction]);

  // Fechar menu ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.stage-menu-container')) {
        setStageMenuOpen(null);
      }
    };

    if (stageMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [stageMenuOpen]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-8 py-6 bg-white dark:bg-slate-900/50">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Pipeline de Clientes</h2>
            <p className="text-sm text-slate-500">Gerencie seu fluxo de trabalho criativo</p>
          </div>
          <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              <button 
                onClick={() => setViewMode('board')}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  viewMode === 'board' 
                    ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Quadro
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  viewMode === 'list' 
                    ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Lista
              </button>
          </div>
            <button 
              onClick={() => setShowAddProject(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              <span>Novo Projeto</span>
            </button>
        </div>
        </div>
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-8 items-center">
          <button 
            onClick={() => {
              setSelectedFilter('all');
              // Limpar destaque quando mudar filtro manualmente
              if (highlightedProjectId) {
                // Isso será limpo pelo App quando necessário
              }
            }}
            className={`border-b-2 pb-3 text-sm font-semibold transition-colors ${
              selectedFilter === 'all' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Todos os Projetos
          </button>
          {categories.map((category, index) => {
            const filterKey = category.name.toLowerCase().replace(/\s+/g, '-');
            return (
              <div key={category.id || index} className="flex items-center gap-1 group relative">
                <button 
                  onClick={() => setSelectedFilter(filterKey)}
                  className={`border-b-2 pb-3 text-sm font-semibold transition-colors flex items-center gap-2 ${
                    selectedFilter === filterKey 
                      ? 'border-primary text-primary' 
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>{category.name}</span>
                  {category.isRecurring && (
                    <span className="material-symbols-outlined text-xs text-primary" title="Serviço Recorrente">
                      repeat
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setCategoryToDelete(category.name)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity size-5 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-rose-500 pb-3"
                  title="Excluir serviço"
                >
                  <span className="material-symbols-outlined text-xs">delete</span>
                </button>
              </div>
            );
          })}
          {projects.some(p => p.type === 'Sem categoria') && (
            <button 
              onClick={() => setSelectedFilter('sem-categoria')}
              className={`border-b-2 pb-3 text-sm font-semibold transition-colors ${
                selectedFilter === 'sem-categoria' 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Sem serviço
            </button>
          )}
          <button 
            onClick={() => setShowAddCategory(true)}
            className="flex items-center gap-1 border-b-2 border-transparent pb-3 text-sm font-semibold text-slate-500 hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            <span>Novo Serviço</span>
          </button>
        </div>
      </div>

      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-x-auto overflow-y-hidden p-8 bg-slate-50 dark:bg-slate-900/20" 
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
            target.closest('.project-card') ||
            target.closest('[draggable="true"]')
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
        {(() => {
          const filteredProjects = selectedFilter === 'all' 
            ? projects 
            : selectedFilter === 'sem-categoria'
            ? projects.filter(p => p.type === 'Sem categoria') // Mantendo valor interno como 'Sem categoria' para compatibilidade
            : projects.filter(p => {
                const selectedCategory = categories.find(cat => cat.name.toLowerCase().replace(/\s+/g, '-') === selectedFilter);
                if (selectedCategory) {
                  // Normalizar strings para comparação (remover espaços extras, converter para lowercase, remover acentos opcionalmente)
                  const normalizeString = (str: string) => {
                    return str.toLowerCase()
                      .trim()
                      .replace(/\s+/g, ' ')
                      .normalize('NFD')
                      .replace(/[\u0300-\u036f]/g, ''); // Remove acentos
                  };
                  
                  const categoryNameNormalized = normalizeString(selectedCategory.name);
                  const projectTypeNormalized = normalizeString(p.type);
                  
                  // Comparação exata primeiro (mais precisa)
                  if (projectTypeNormalized === categoryNameNormalized) {
                    return true;
                  }
                  
                  // Comparação sem acentos também
                  const categoryNameNoAccent = selectedCategory.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                  const projectTypeNoAccent = p.type.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                  if (projectTypeNoAccent === categoryNameNoAccent || 
                      projectTypeNoAccent.includes(categoryNameNoAccent) ||
                      categoryNameNoAccent.includes(projectTypeNoAccent)) {
                    return true;
                  }
                  
                  // Fallback: verificar se contém o nome completo ou primeira palavra (com e sem acentos)
                  return projectTypeNormalized.includes(categoryNameNormalized) || 
                         categoryNameNormalized.includes(projectTypeNormalized) ||
                         projectTypeNormalized.includes(categoryNameNormalized.split(' ')[0]);
                }
                return true;
              });
          
          // Usar projetos filtrados diretamente (agora temos etapa "Em Revisão" no quadro)
          // Migrar projetos para garantir integridade de stageId
          // IMPORTANTE: Não remover stageId de projetos recorrentes em "Todos os Projetos"
          // pois eles podem estar em etapas normais
          
          // IDs fixos conhecidos para etapas normais
          const fixedStageIdsLocal = ['onboarding', 'development', 'review', 'completed'];
          
          // Função para verificar se um stageId é de etapa fixa (considera variações de ID)
          const hasFixedStageIdLocal = (projectStageId: string | undefined): boolean => {
            if (!projectStageId) return false;
            const projectIdBase = projectStageId.split('-')[0];
            return fixedStageIdsLocal.includes(projectIdBase) || fixedStageIdsLocal.includes(projectStageId);
          };
          
          // Função para obter o ID base de uma etapa
          const getStageBaseIdLocal = (stage: Stage): string => {
            const originalId = (stage as any).originalId;
            if (originalId) return originalId;
            const baseId = stage.id.split('-')[0];
            return fixedStageIdsLocal.includes(baseId) ? baseId : stage.id;
          };
          
          const projectsForBoard = filteredProjects.map(p => {
            const isProjectRecurring = categories.find(cat => 
              cat.name === p.type && cat.isRecurring
            );
            
            if (isProjectRecurring) {
              // Para projetos recorrentes:
              // - Se tem stageId de etapa fixa (foi movido para etapa normal), NUNCA remover
              // - Se tem stageId de outra origem, pode remover quando em serviço recorrente específico
              if (selectedFilter !== 'all' && isSelectedCategoryRecurring && p.stageId && !hasFixedStageIdLocal(p.stageId)) {
                // Remover stageId apenas se NÃO for de etapa fixa
                removeProjectStageId(p.id).catch(err => {
                  console.error("Error removing project stageId:", err);
                });
                const { stageId, ...projectWithoutStageId } = p;
                return projectWithoutStageId;
              }
              // Manter o projeto como está (com ou sem stageId de etapa fixa)
            } else {
              // Serviços normais: adicionar stageId se não existir
              if (!p.stageId) {
                const matchingStage = stages.find(s => s.status === p.status);
                if (matchingStage) {
                  // Usar o ID base da etapa para consistência
                  const stageBaseId = getStageBaseIdLocal(matchingStage);
                  // Atualizar no Firebase (sem await para não bloquear UI)
                  updateProjectInFirebase(p.id, { stageId: stageBaseId }).catch(err => {
                    console.error("Error migrating project stageId:", err);
                  });
                  // Retornar projeto com stageId atualizado
                  return { ...p, stageId: stageBaseId };
                }
              }
            }
            return p;
          });

          if (viewMode === 'board') {
            // Quando "Todos os Projetos" está selecionado, mostrar etapas normais + etapas recorrentes (Manutenção e Finalizado)
            let displayStages: Stage[];
            
            if (selectedFilter === 'all') {
              // Combinar etapas normais FIXAS com etapas recorrentes (apenas Manutenção e Finalizado)
              // Usar sempre as etapas fixas para garantir IDs consistentes
              const normalStages = recalculateStageProgress(fixedStages.map(s => ({ ...s, workspaceId: currentWorkspace?.id })));
              
              const recurringStages = recalculateStageProgress(fixedStagesRecurring.map(s => ({ ...s, workspaceId: currentWorkspace?.id })));
              
              // Pegar apenas Manutenção e Finalizado das etapas recorrentes
              const maintenanceStage = recurringStages.find(s => s.status === 'Completed' && s.title === 'Manutenção');
              const finishedStage = recurringStages.find(s => s.status === 'Finished');
              
              // Combinar: etapas normais + Manutenção + Finalizado
              displayStages = [
                ...normalStages,
                ...(maintenanceStage ? [maintenanceStage] : []),
                ...(finishedStage ? [finishedStage] : [])
              ];
            } else if (isSelectedCategoryRecurring) {
              // Serviço recorrente selecionado: usar etapas recorrentes
              displayStages = recalculateStageProgress(currentFixedStages.map(s => ({ ...s, workspaceId: currentWorkspace?.id })));
            } else {
              // Serviço normal selecionado: usar etapas normais
              displayStages = stages;
            }
            
            const sortedStages = [...displayStages].sort((a, b) => a.order - b.order);
            
            const handleContainerDragOver = (e: React.DragEvent) => {
              e.preventDefault();
              if (e.dataTransfer.types.includes('stageId')) {
                e.dataTransfer.dropEffect = 'move';
              }
            };
            
            const handleContainerDrop = (e: React.DragEvent) => {
              e.preventDefault();
            };

            return (
              <div 
                className="flex gap-6 h-full pb-4"
                onDragOver={handleContainerDragOver}
                onDrop={handleContainerDrop}
                style={{ 
                  minWidth: 'max-content'
                }}
              >
                {sortedStages.map((stage, index) => {
                  // Verificar se é uma etapa recorrente (Manutenção ou Finalizado)
                  const isRecurringStage = stage.title === 'Manutenção' || stage.title === 'Finalizado';
                  
                  // IDs fixos conhecidos para etapas normais
                  const fixedStageIds = ['onboarding', 'development', 'review', 'completed'];
                  
                  // Função auxiliar para verificar se o stageId do projeto corresponde a esta etapa
                  // Considera: match direto, match por originalId, ou match parcial (ID base)
                  const matchesStageId = (projectStageId: string | undefined, stageId: string, stageOriginalId?: string): boolean => {
                    if (!projectStageId) return false;
                    
                    // Match direto
                    if (projectStageId === stageId) return true;
                    
                    // Match por originalId (se a etapa tiver)
                    if (stageOriginalId && projectStageId === stageOriginalId) return true;
                    
                    // Match por ID base (ex: 'onboarding' matches 'onboarding-workspace123')
                    const stageIdBase = stageId.split('-')[0];
                    if (projectStageId === stageIdBase) return true;
                    
                    // Match reverso (ex: 'onboarding-workspace123' matches 'onboarding')
                    const projectIdBase = projectStageId.split('-')[0];
                    if (projectIdBase === stageIdBase) return true;
                    
                    return false;
                  };
                  
                  // Verificar se o projeto tem stageId de etapa fixa (considera variações de ID)
                  const hasFixedStageId = (projectStageId: string | undefined): boolean => {
                    if (!projectStageId) return false;
                    const projectIdBase = projectStageId.split('-')[0];
                    return fixedStageIds.includes(projectIdBase) || fixedStageIds.includes(projectStageId);
                  };
                  
                  const stageProjects = projectsForBoard.filter(p => {
                    // Verificar se o projeto é de um serviço recorrente
                    const isProjectRecurring = categories.find(cat => 
                      cat.name === p.type && cat.isRecurring
                    );
                    
                    if (selectedFilter === 'all') {
                      // Quando "Todos os Projetos" está selecionado:
                      if (isRecurringStage) {
                        // Para etapas recorrentes (Manutenção/Finalizado): 
                        // Mostrar apenas projetos recorrentes que estão nesse status
                        // E que NÃO foram movidos para etapas normais (não têm stageId de etapa fixa)
                        return isProjectRecurring && p.status === stage.status && !hasFixedStageId(p.stageId);
                      } else {
                        // Para etapas normais:
                        if (isProjectRecurring) {
                          // Projeto recorrente:
                          // 1. Se tem stageId de etapa fixa → mostrar na etapa correspondente
                          if (hasFixedStageId(p.stageId)) {
                            return matchesStageId(p.stageId, stage.id, (stage as any).originalId);
                          }
                          // 2. Se NÃO tem stageId (projeto recém-criado em Recorrência):
                          //    Mostrar na etapa normal correspondente ao status
                          //    EXCETO se o status for Completed (vai para Manutenção) ou Finished (vai para Finalizado)
                          if (!p.stageId && p.status !== 'Completed' && p.status !== 'Finished') {
                            return p.status === stage.status;
                          }
                          return false;
                        } else {
                          // Projeto normal: filtrar por status OU stageId correspondente
                          // Prioriza stageId se existir, senão usa status
                          if (p.stageId) {
                            return matchesStageId(p.stageId, stage.id, (stage as any).originalId);
                          }
                          return p.status === stage.status;
                        }
                      }
                    } else if (isSelectedCategoryRecurring) {
                      // Serviço recorrente selecionado: filtrar apenas por status
                      return p.status === stage.status;
                    } else {
                      // Serviço normal selecionado: filtrar por stageId (com match flexível)
                      return matchesStageId(p.stageId, stage.id, (stage as any).originalId);
                    }
                  });
                  return (
                    <StageColumn 
                      key={stage.id}
                      stage={stage}
                      index={index}
                      count={stageProjects.length} 
                      projects={stageProjects}
                      allProjects={filteredProjects}
                      isActive={stage.status === 'Active'}
                      selectedFilter={selectedFilter}
                      highlightedProjectId={highlightedProjectId}
                      onProjectClick={onProjectClick}
                      onDelete={setProjectToDelete}
                      onDrop={(project) => {
                        handleProjectDrop(project, stage);
                      }}
                      onStageDragStart={(stage) => setDraggedStage(stage)}
                      onStageDragEnd={() => setDraggedStage(null)}
                      onDeleteStage={(stage) => setStageToDelete(stage)}
                      onEditTasks={(stage) => setStageToEditTasks(stage)}
                      onMenuToggle={(stageId) => setStageMenuOpen(stageMenuOpen === stageId ? null : stageId)}
                      menuOpen={stageMenuOpen === stage.id}
                      categories={categories}
                      onStageDrop={async (targetStage) => {
                        if (draggedStage && draggedStage.id !== targetStage.id) {
                          // Encontrar índices das etapas
                          const draggedIndex = stages.findIndex(s => s.id === draggedStage.id);
                          const targetIndex = stages.findIndex(s => s.id === targetStage.id);
                          
                          if (draggedIndex !== -1 && targetIndex !== -1) {
                            // Criar nova array com etapas reordenadas
                            const newStages = [...stages];
                            const [removed] = newStages.splice(draggedIndex, 1);
                            newStages.splice(targetIndex, 0, removed);
                            
                            // Atualizar ordem e recalcular progresso
                            const withNewOrder = newStages.map((s, idx) => ({ ...s, order: idx }));
                            const recalculated = recalculateStageProgress(withNewOrder);
                            
                            // Encontrar a nova etapa (com status e progresso atualizados)
                            const updatedDraggedStage = recalculated.find(s => s.id === draggedStage.id);
                            
                            if (updatedDraggedStage) {
                              // Atualizar todos os projetos que estavam na etapa arrastada (por stageId ou status)
                              const projectsInStage = projectsForBoard.filter(p => 
                                p.stageId ? p.stageId === draggedStage.id : p.status === draggedStage.status
                              );
                              
                              try {
                                // Atualizar todos os projetos no Firebase
                                if (projectsInStage.length > 0) {
                                  await Promise.all(
                                    projectsInStage.map(project =>
                                      updateProjectInFirebase(project.id, {
                                        status: updatedDraggedStage.status,
                                        stageId: updatedDraggedStage.id, // Manter stageId atualizado
                                        progress: updatedDraggedStage.progress
                                      })
                                    )
                                  );
                                }
                              } catch (error) {
                                console.error("Error updating projects:", error);
                                alert("Erro ao atualizar projetos. Tente novamente.");
                                return; // Não atualiza as etapas se houver erro
                              }
                            }
                            
                            setStages(recalculated);
                            // Salvar etapas atualizadas no Firebase
                            saveStages(recalculated).catch(err => {
                              console.error("Error saving reordered stages:", err);
                            });
                          }
                        }
                      }}
                    />
                  );
                })}
                <button
                  onClick={() => setShowAddStage(true)}
                  className="w-80 flex-shrink-0 py-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-center gap-2 text-slate-400 hover:border-primary hover:text-primary transition-all h-fit"
                >
                  <span className="material-symbols-outlined">add</span>
                  <span className="text-xs font-bold uppercase tracking-wider">Nova Etapa</span>
                </button>
        </div>
            );
          }
          
          if (viewMode === 'list') {
            return <ListView projects={filteredProjects} onProjectClick={onProjectClick} />;
          }
        })()}
      </div>

      {/* Modal Adicionar Projeto */}
      {showAddProject && (
        <AddProjectModal 
          categories={categories}
          stages={isSelectedCategoryRecurring 
            ? recalculateStageProgress(currentFixedStages.map(s => ({ ...s, workspaceId: currentWorkspace?.id })))
            : stages}
          workspaceId={currentWorkspace?.id}
          selectedFilter={selectedFilter}
          existingProjects={projects}
          onClose={() => setShowAddProject(false)}
          onSave={async (projectData) => {
            // Fechar modal ANTES de iniciar operação assíncrona
            setShowAddProject(false);
            
            try {
              // Usar as etapas corretas baseado no tipo de serviço
              const stagesForProject = isSelectedCategoryRecurring 
                ? recalculateStageProgress(currentFixedStages.map(s => ({ ...s, workspaceId: currentWorkspace?.id })))
                : stages;
              
              // Encontrar etapa pelo stageId se fornecido, ou pelo status
              const selectedStage = projectData.stageId 
                ? stagesForProject.find(s => s.id === projectData.stageId)
                : stagesForProject.find(s => s.status === projectData.status);
              const newProject: Omit<Project, "id"> = {
                name: projectData.name || '',
                client: projectData.client || '',
                description: projectData.description || '',
                type: projectData.type || 'Sem categoria', // Mantendo valor interno como 'Sem categoria' para compatibilidade
                status: selectedStage?.status as Project['status'] || stages[0]?.status as Project['status'] || 'Lead',
                // Para serviços recorrentes, não definir stageId (usar status)
                // Para serviços normais, definir stageId
                stageId: isSelectedCategoryRecurring ? undefined : (selectedStage?.id || stages[0]?.id),
                progress: selectedStage?.progress || 0,
                tagColor: 'blue',
                avatar: `https://picsum.photos/seed/${projectData.name}/40/40`,
                budget: projectData.budget || 0,
                isPaid: projectData.isPaid || false,
              };
              const projectId = await addProjectToFirebase(newProject, currentWorkspace?.id);
              
              // Verificar se é um projeto recorrente
              const selectedCategory = categories.find(cat => cat.name === projectData.type);
              const isRecurringProject = selectedCategory?.isRecurring || false;
              
              if (isRecurringProject && projectId) {
                // Para projetos recorrentes: criar faturas separadas para implementação e mensalidade
                const recurringAmount = (projectData as any).recurringAmount || 0;
                const recurringFirstDate = (projectData as any).recurringFirstDate || '';
                const implementationBudget = projectData.budget || 0; // Valor da implementação
                const parcelas = (projectData as any).parcelas || 1; // Número de parcelas da implementação
                const year = new Date().getFullYear();
                
                // 1. Criar faturas de implementação parceladas (se valor > 0)
                if (implementationBudget > 0) {
                  const valorParcela = implementationBudget / parcelas;
                  
                  for (let i = 0; i < parcelas; i++) {
                    const invoiceDate = new Date();
                    invoiceDate.setMonth(invoiceDate.getMonth() + i); // Cada parcela vence um mês depois
                    
                    await addInvoice({
                      projectId,
                      workspaceId: currentWorkspace?.id,
                      number: `IMP-${year}-${String(i + 1).padStart(3, '0')}`,
                      description: parcelas === 1 
                        ? 'Implementação do Projeto' 
                        : `Implementação - Parcela ${i + 1} de ${parcelas}`,
                      amount: valorParcela,
                      date: invoiceDate,
                      status: 'Pending'
                    });
                  }
                }
                
                // 2. Criar fatura de mensalidade (se valor e data definidos) - SEM numeração de parcelas
                if (recurringAmount > 0 && recurringFirstDate) {
                  const [rYear, rMonth, rDay] = recurringFirstDate.split('-').map(Number);
                  const recurringDate = new Date(rYear, rMonth - 1, rDay);
                  
                  await addInvoice({
                    projectId,
                    workspaceId: currentWorkspace?.id,
                    number: `REC-${rYear}-001`,
                    description: 'Mensalidade', // Sem numeração de parcelas
                    amount: recurringAmount,
                    date: recurringDate,
                    status: 'Pending'
                  });
                }
                
                // Restaurar o budget original (implementação) e salvar o recurringAmount (mensalidade)
                // O addInvoice sobrescreve o budget com a soma das faturas, então precisamos restaurar
                await updateProjectInFirebase(projectId, { 
                  budget: implementationBudget, 
                  recurringAmount: recurringAmount 
                });
              } else if (projectData.budget && projectData.budget > 0 && projectId) {
                // Para projetos normais: criar faturas baseadas em parcelas
                const parcelas = (projectData as any).parcelas || 1;
                const valorParcela = projectData.budget / parcelas;
                const year = new Date().getFullYear();
                
                // Criar uma fatura para cada parcela
                for (let i = 0; i < parcelas; i++) {
                  const invoiceDate = new Date();
                  invoiceDate.setMonth(invoiceDate.getMonth() + i); // Cada parcela vence um mês depois
                  
                  await addInvoice({
                    projectId,
                    workspaceId: currentWorkspace?.id,
                    number: `INV-${year}-${String(i + 1).padStart(3, '0')}`,
                    description: parcelas === 1 
                      ? 'Pagamento à vista' 
                      : `Parcela ${i + 1} de ${parcelas}`,
                    amount: valorParcela,
                    date: invoiceDate,
                    status: 'Pending'
                  });
                }
              }
            } catch (error) {
              console.error("Error adding project:", error);
              setToast({ message: "Erro ao adicionar projeto. Tente novamente.", type: 'error' });
              setTimeout(() => setToast(null), 3000);
            }
          }}
        />
      )}

      {/* Modal Adicionar Serviço */}
      {showAddCategory && (
        <AddCategoryModal 
          onClose={() => setShowAddCategory(false)}
          onSave={async (categoryData) => {
            try {
              if (categoryData.name && !categories.some(c => c.name === categoryData.name)) {
                await addCategoryToFirebase(categoryData.name, currentWorkspace?.id, categoryData.isRecurring);
              }
              console.log('✅ [Dashboard] Categoria adicionada, fechando modal...');
              setShowAddCategory(false);
            } catch (error) {
              console.error("Error adding category:", error);
              alert("Erro ao adicionar serviço. Tente novamente.");
            }
          }}
        />
      )}

      {/* Modal Confirmar Exclusão de Projeto */}
      {projectToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-full max-w-md">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-4 mb-4">
                <div className="size-12 rounded-full bg-rose-100 dark:bg-rose-900/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-rose-600 dark:text-rose-400">warning</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold">Excluir Projeto</h3>
                  <p className="text-sm text-slate-500 mt-1">Esta ação não pode ser desfeita</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Tem certeza que deseja excluir o projeto <span className="font-bold">"{projectToDelete.name}"</span>? Todos os dados relacionados serão perdidos permanentemente.
              </p>
            </div>
            <div className="p-6 flex items-center justify-end gap-3">
              <button 
                onClick={() => setProjectToDelete(null)}
                className="px-6 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={async () => {
                  const projectId = projectToDelete.id;
                  // Fechar modal ANTES de iniciar operação assíncrona
                  setProjectToDelete(null);
                  
                  try {
                    await deleteProject(projectId);
                    // O projeto será removido automaticamente pela subscription
                  } catch (error) {
                    console.error("Error deleting project:", error);
                    alert("Erro ao excluir projeto. Tente novamente.");
                  }
                }}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Exclusão de Serviço */}
      {categoryToDelete && (
        <DeleteCategoryModal
          categoryName={categoryToDelete}
          onClose={() => setCategoryToDelete(null)}
          onConfirm={async () => {
            try {
              // Atualizar projetos que usam esse serviço
              const projectsToUpdate = projects.filter(p => {
                const projectTypeLower = p.type.toLowerCase();
                const categoryLower = categoryToDelete.toLowerCase();
                return projectTypeLower.includes(categoryLower) || 
                       projectTypeLower.includes(categoryToDelete.split(' ')[0].toLowerCase());
              });

              // Atualizar cada projeto no Firebase
              for (const project of projectsToUpdate) {
                await updateProjectInFirebase(project.id, { type: 'Sem categoria' }); // Mantendo valor interno como 'Sem categoria' para compatibilidade
              }
              
              // Remove o serviço do Firebase
              await deleteCategoryFromFirebase(categoryToDelete, currentWorkspace?.id);
              
              // Se o serviço excluído estava selecionado, volta para "Todos"
              const filterKey = categoryToDelete.toLowerCase().replace(/\s+/g, '-');
              if (selectedFilter === filterKey) {
                setSelectedFilter('all');
              }
              
              setCategoryToDelete(null);
            } catch (error) {
              console.error("Error deleting category:", error);
              alert("Erro ao excluir serviço. Tente novamente.");
            }
          }}
        />
      )}

      {/* Modal Adicionar Nova Etapa */}
      {showAddStage && (
        <AddStageModal
          onClose={() => setShowAddStage(false)}
          onSave={async (stageData) => {
            // Fechar o modal imediatamente para melhor UX
            setShowAddStage(false);
            
            try {
              if (!currentWorkspace) {
                alert("Nenhum workspace selecionado.");
                return;
              }
              
              // Calcular progresso antes de criar
              const totalStages = stages.length + 1;
              const newOrder = stages.filter(s => !s.isFixed).length + fixedStages.length;
              const newProgress = Math.round((newOrder / (totalStages)) * 100);
              
              // Adicionar a nova etapa com progresso calculado
              const newStageData: Omit<Stage, "id"> = {
                title: stageData.title,
                status: 'Active', // Novas etapas customizadas são 'Active'
                order: newOrder,
                progress: newProgress,
                workspaceId: currentWorkspace.id,
                isFixed: false
              };
              
              // Adicionar a nova etapa no Firebase
              const newStageId = await addStage(newStageData, currentWorkspace.id);
              console.log('✅ [Dashboard] Nova etapa adicionada:', newStageId);
              
              // Recalcular progresso de todas as etapas existentes em background
              const allExistingStages = stages.filter(s => s.id !== newStageId);
              const recalculatedStages = recalculateStageProgress([...allExistingStages, { id: newStageId, ...newStageData }]);
              
              // Atualizar etapas existentes com novo progresso
              const updatePromises = recalculatedStages
                .filter(s => s.id !== newStageId && !s.isFixed)
                .map(stage => {
                  return updateStage(stage.id, { progress: stage.progress, order: stage.order });
                });
              
              await Promise.all(updatePromises);
              console.log('✅ [Dashboard] Progresso de todas as etapas atualizado');
            } catch (error) {
              console.error("Error saving stage:", error);
              alert("Erro ao salvar etapa. Tente novamente.");
            }
          }}
        />
      )}

      {/* Modal Confirmar Exclusão de Etapa */}
      {stageToDelete && (
        <DeleteStageModal
          stage={stageToDelete}
          projectCount={projects.filter(p => p.status === stageToDelete.status).length}
          onClose={() => setStageToDelete(null)}
          onConfirm={async () => {
            try {
              // Marcar que estamos excluindo para evitar que o subscribe sobrescreva
              isDeletingStage.current = true;
              
              // Não permitir excluir etapas fixas
              if (stageToDelete.isFixed) {
                alert("Não é possível excluir etapas fixas.");
                isDeletingStage.current = false;
                setStageToDelete(null);
                setStageMenuOpen(null);
                return;
              }
              
              // Encontrar a primeira etapa disponível (ou criar uma padrão)
              const remainingStages = stages.filter(s => s.id !== stageToDelete.id);
              const sortedRemaining = remainingStages.sort((a, b) => a.order - b.order);
              
              // Se não houver etapas restantes, criar uma padrão
              let targetStage: Stage;
              if (sortedRemaining.length === 0) {
                alert("Não é possível excluir a última etapa. Crie uma nova etapa antes de excluir esta.");
                isDeletingStage.current = false;
                setStageToDelete(null);
                setStageMenuOpen(null);
                return;
              } else {
                // Usar a primeira etapa disponível (preferir etapa fixa se houver)
                targetStage = sortedRemaining.find(s => s.isFixed) || sortedRemaining[0];
              }
              
              // Atualizar todos os projetos que estavam na etapa excluída (por stageId ou status)
              const projectsInStage = projects.filter(p => 
                p.stageId ? p.stageId === stageToDelete.id : p.status === stageToDelete.status
              );
              
              if (projectsInStage.length > 0) {
                await Promise.all(
                  projectsInStage.map(project =>
                    updateProjectInFirebase(project.id, {
                      status: targetStage.status,
                      stageId: targetStage.id, // Atualizar stageId para a nova etapa
                      progress: targetStage.progress
                    })
                  )
                );
              }
              
              // Atualizar as etapas localmente (remover a etapa excluída)
              const deletedStageOrder = stageToDelete.order;
              const updatedStages = stages.filter(s => s.id !== stageToDelete.id);
              const withNewOrder = updatedStages.map((s, idx) => ({ ...s, order: idx }));
              const recalculated = recalculateStageProgress(withNewOrder);
              
              console.log("Excluindo etapa:", stageToDelete.id);
              console.log("Etapas restantes:", recalculated.length);
              
              // Atualizar estado local primeiro para feedback imediato no frontend
              setStages(recalculated);
              
              // Deletar apenas a etapa específica do Firebase
              await deleteStageFromFirebase(stageToDelete.id);
              
              // Atualizar apenas as etapas que mudaram (as que estavam depois da etapa excluída)
              const stagesToUpdate = recalculated.filter(stage => {
                // Encontrar a etapa original para comparar
                const originalStage = stages.find(s => s.id === stage.id);
                if (!originalStage) return false;
                // Atualizar se a ordem ou progresso mudou
                return originalStage.order !== stage.order || 
                       originalStage.progress !== stage.progress ||
                       originalStage.status !== stage.status;
              });
              
              if (stagesToUpdate.length > 0) {
                await Promise.all(
                  stagesToUpdate.map((stage) => 
                    updateStage(stage.id, {
                      order: stage.order,
                      progress: stage.progress,
                      status: stage.status
                    })
                  )
                );
              }
              
              console.log("Etapa excluída e etapas atualizadas no Firebase");
              
              // Aguardar um pouco para garantir que o Firebase processou
              await new Promise(resolve => setTimeout(resolve, 300));
              
              // Liberar a flag para permitir atualizações do subscribe novamente
              isDeletingStage.current = false;
              
              setStageToDelete(null);
              setStageMenuOpen(null);
            } catch (error: any) {
              console.error("Error deleting stage:", error);
              isDeletingStage.current = false;
              const errorMessage = error?.message || "Erro desconhecido";
              console.error("Detalhes do erro:", error);
              alert(`Erro ao excluir etapa: ${errorMessage}. Verifique o console para mais detalhes.`);
            }
          }}
        />
      )}

      {/* Modal Definir Tarefas da Etapa */}
      {stageToEditTasks && (
        <DefineStageTasksModal
          stage={stageToEditTasks}
          onClose={() => setStageToEditTasks(null)}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-[60] animate-[slideIn_0.3s_ease-out]">
          <div className={`flex items-center gap-3 px-5 py-4 rounded-xl shadow-xl border backdrop-blur-sm min-w-[360px] max-w-[480px] ${
            toast.type === 'success' 
              ? 'bg-white/95 dark:bg-slate-900/95 border-emerald-200 dark:border-emerald-800/50' 
              : 'bg-white/95 dark:bg-slate-900/95 border-amber-200 dark:border-amber-800/50'
          }`}>
            <div className={`flex-shrink-0 size-10 rounded-full flex items-center justify-center ${
              toast.type === 'success' 
                ? 'bg-emerald-100 dark:bg-emerald-900/30' 
                : 'bg-amber-100 dark:bg-amber-900/30'
            }`}>
              <span className={`material-symbols-outlined text-xl ${
                toast.type === 'success' 
                  ? 'text-emerald-600 dark:text-emerald-400' 
                  : 'text-amber-600 dark:text-amber-400'
              }`}>
                {toast.type === 'success' ? 'check_circle' : 'warning'}
              </span>
            </div>
            <p className={`text-sm font-semibold flex-1 leading-relaxed ${
              toast.type === 'success' 
                ? 'text-emerald-900 dark:text-emerald-100' 
                : 'text-amber-900 dark:text-amber-100'
            }`}>
              {toast.message}
            </p>
            <button 
              onClick={() => setToast(null)}
              className="ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors flex-shrink-0 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Fechar"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const StageColumn: React.FC<{ 
  stage: Stage;
  index: number;
  count: number; 
  projects: Project[];
  allProjects: Project[];
  isActive?: boolean;
  selectedFilter?: string;
  highlightedProjectId?: string;
  onProjectClick?: (project: Project) => void;
  onDelete?: (project: Project) => void;
  onDrop?: (project: Project, targetStage: Stage) => void;
  onStageDragStart?: (stage: Stage) => void;
  onStageDragEnd?: () => void;
  onStageDrop?: (targetStage: Stage) => void;
  onDeleteStage?: (stage: Stage) => void;
  onEditTasks?: (stage: Stage) => void;
  onMenuToggle?: (stageId: string) => void;
  menuOpen?: boolean;
  categories?: Category[];
}> = ({ stage, index, count, projects, allProjects, isActive, selectedFilter, highlightedProjectId, onProjectClick, onDelete, onDrop, onStageDragStart, onStageDragEnd, onStageDrop, onDeleteStage, onEditTasks, onMenuToggle, menuOpen, categories = [] }) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isStageDragging, setIsStageDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const dataType = e.dataTransfer.types[0];
    // Permite drop de projetos e etapas
    if (dataType === 'projectId' || dataType === 'project' || dataType === 'stageId') {
      setIsDraggingOver(true);
      if (dataType === 'stageId') {
        e.dataTransfer.dropEffect = 'move';
      }
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    
    // Verificar se é uma etapa sendo arrastada (verificar primeiro)
    try {
      const stageId = e.dataTransfer.getData('stageId');
      if (stageId && stageId !== stage.id && onStageDrop) {
        onStageDrop(stage);
        return;
      }
    } catch (err) {
      // Não é uma etapa, continuar para verificar se é projeto
    }
    
    // Se for arrastar projeto
    const projectId = e.dataTransfer.getData('projectId');
    let project = allProjects.find(p => p.id === projectId);
    
    if (!project) {
      try {
        project = JSON.parse(e.dataTransfer.getData('project'));
      } catch (err) {
        console.error("Error parsing project data:", err);
        return;
      }
    }
    
    if (project && onDrop) {
      onDrop(project, stage);
    }
  };

  const handleStageDragStart = (e: React.DragEvent) => {
    e.stopPropagation();
    setIsStageDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('stageId', stage.id);
    // Não definir text/plain para evitar conflitos
    onStageDragStart?.(stage);
  };

  const handleStageDragEnd = () => {
    setIsStageDragging(false);
    onStageDragEnd?.();
  };

  return (
    <div 
      className={`stage-column w-80 flex flex-col gap-3 p-3 rounded-2xl transition-all duration-200 ${
        isDraggingOver 
          ? 'bg-primary/5 ring-2 ring-primary/20' 
          : 'bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/50'
      } ${isStageDragging ? 'opacity-50' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div 
        draggable
        onDragStart={handleStageDragStart}
        onDragEnd={handleStageDragEnd}
        className={`flex items-center justify-between px-2 py-1.5 cursor-move rounded-xl transition-all ${
          // Cores baseadas no título da etapa (para etapas fixas) para manter consistência
          stage.title.toLowerCase().includes('on boarding') || stage.title.toLowerCase().includes('onboarding')
            ? 'bg-slate-500/10 text-slate-700 dark:text-slate-400'
            : stage.title.toLowerCase().includes('desenvolvimento')
            ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
            : stage.title.toLowerCase().includes('revisão') || stage.title.toLowerCase().includes('revisao')
            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
            : stage.title.toLowerCase().includes('finalizado')
            ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
            : stage.title.toLowerCase().includes('manutenção') || stage.title.toLowerCase().includes('manutencao')
            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
            : stage.title.toLowerCase().includes('concluído') || stage.title.toLowerCase().includes('concluido')
            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
            // Novas etapas criadas pelo usuário ficam em azul
            : 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-[18px] opacity-40">drag_indicator</span>
          <div className="flex flex-col">
            <h3 className="text-[13px] font-extrabold uppercase tracking-wider leading-none mb-1">
              {stage.title}
            </h3>
            <span className="text-[10px] font-bold opacity-60 uppercase tracking-widest">
              {count} {count === 1 ? 'Projeto' : 'Projetos'}
            </span>
      </div>
    </div>
        <div className="relative stage-menu-container flex items-center gap-1">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onMenuToggle?.(stage.id);
            }}
            className="size-7 flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px] opacity-60">more_horiz</span>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-9 z-50 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xl min-w-[180px] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              {selectedFilter !== 'all' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditTasks?.(stage);
                    onMenuToggle?.(stage.id);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors border-b border-slate-100 dark:border-slate-800"
                >
                  <span className="material-symbols-outlined text-[18px]">checklist</span>
                  <span className="font-semibold">Definir Tarefas</span>
                </button>
              )}
              {!stage.isFixed && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteStage?.(stage);
                    onMenuToggle?.(stage.id);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                  <span className="font-semibold">Excluir Etapa</span>
        </button>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="flex-1 flex flex-col gap-3 min-h-[200px] overflow-y-auto custom-scrollbar pr-1 pb-2">
        {projects.length > 0 ? (
          projects.map(project => (
            <Card 
              key={project.id} 
              project={project} 
              onClick={() => onProjectClick?.(project)}
              onDelete={onDelete}
              isHighlighted={highlightedProjectId === project.id}
              categories={categories}
            />
          ))
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center py-8 opacity-20 grayscale select-none border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl">
            <span className="material-symbols-outlined text-4xl mb-2">folder_open</span>
            <p className="text-[10px] font-bold uppercase tracking-widest text-center px-4">
              Nenhum projeto nesta etapa
            </p>
          </div>
      )}
    </div>
  </div>
);
};

const Card: React.FC<{ project: Project; onClick?: () => void; onDelete?: (project: Project) => void; isHighlighted?: boolean; categories?: Category[] }> = ({ project, onClick, onDelete, isHighlighted, categories = [] }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  
  // Função auxiliar para determinar a cor da data baseada na proximidade
  const getDateColor = (dateString: string | undefined): string => {
    if (!dateString) return 'text-slate-500 dark:text-slate-400';
    
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Vermelho: data passou
    if (diffDays < 0) {
      return 'text-rose-600 dark:text-rose-400';
    }
    // Laranja: data próxima (até 7 dias)
    if (diffDays <= 7) {
      return 'text-amber-600 dark:text-amber-400';
    }
    // Cinza: data longe
    return 'text-slate-500 dark:text-slate-400';
  };

  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('projectId', project.id);
    e.dataTransfer.setData('project', JSON.stringify(project));
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDragStartPos(null);
    setIsMouseDown(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Não ativar se clicar no botão de deletar ou em qualquer botão
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.tagName === 'BUTTON' || target.closest('.material-symbols-outlined')) {
      return;
    }
    setIsMouseDown(true);
    setDragStartPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsMouseDown(false);
  };

  const handleMouseLeave = () => {
    setIsMouseDown(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    // Só chama onClick se não foi um drag (movimento mínimo)
    if (dragStartPos) {
      const deltaX = Math.abs(e.clientX - dragStartPos.x);
      const deltaY = Math.abs(e.clientY - dragStartPos.y);
      if (deltaX > 5 || deltaY > 5) {
        // Foi um drag, não um click
        return;
      }
    }
    onClick?.();
  };

  return (
    <div 
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      data-project-id={project.id}
      className={`bg-white dark:bg-slate-900 p-4 rounded-xl border ${project.status === 'Active' ? 'border-l-4 border-l-primary' : ''} ${isHighlighted ? 'ring-2 ring-primary shadow-lg' : 'border-slate-200 dark:border-slate-800 shadow-sm'} hover:shadow-md transition-all group ${isDragging ? 'opacity-50' : ''} ${isMouseDown ? 'cursor-grabbing' : 'cursor-pointer'}`}
    >
    <div className="flex justify-between items-start mb-3">
      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded ${
        project.tagColor === 'amber' ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' :
        project.tagColor === 'blue' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' :
        project.tagColor === 'emerald' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' :
        'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
      }`}>
        {project.type}
      </span>
      {onDelete && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(project);
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="material-symbols-outlined text-slate-300 hover:text-rose-500 transition-colors text-sm cursor-pointer z-10 relative"
          title="Excluir projeto"
        >
          delete
        </button>
      )}
    </div>
    <h4 className="font-bold text-slate-900 dark:text-white text-base mb-1">{project.name}</h4>
    <p className="text-xs text-slate-500 mb-3 line-clamp-2">{project.description}</p>
    
    {/* Verificar se é projeto recorrente */}
    {(() => {
      const projectCategory = categories.find(cat => cat.name === project.type);
      const isRecurring = projectCategory?.isRecurring || false;
      
      // Projeto recorrente: mostrar implementação e mensalidade separados
      if (isRecurring && (project.budget > 0 || project.recurringAmount > 0)) {
        return (
          <div className="mb-3 space-y-2">
            {/* Implementação */}
            {project.budget > 0 && (
              <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-indigo-400">build</span>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Implementação</span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(project.budget)}
                    </span>
                  </div>
                </div>
                {project.isImplementationPaid ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                    <span className="material-symbols-outlined text-xs">check_circle</span>
                    Pago
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                    <span className="material-symbols-outlined text-xs">pending</span>
                    Pendente
                  </span>
                )}
              </div>
            )}
            {/* Mensalidade */}
            {project.recurringAmount > 0 && (
              <div className="flex items-center justify-between p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200/50 dark:border-amber-800/30">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-amber-500">autorenew</span>
                  <div>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 block">Mensalidade</span>
                    <span className="text-sm font-bold text-amber-700 dark:text-amber-300">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(project.recurringAmount)}
                    </span>
                  </div>
                </div>
                {project.isRecurringPaid ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                    <span className="material-symbols-outlined text-xs">check_circle</span>
                    Pago
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                    <span className="material-symbols-outlined text-xs">pending</span>
                    Pendente
                  </span>
                )}
              </div>
            )}
          </div>
        );
      }
      
      // Projeto normal: mostrar apenas budget total
      if (project.budget && project.budget > 0) {
        return (
          <div className="flex items-center justify-between mb-3 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-slate-400">payments</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(project.budget)}
              </span>
            </div>
            {project.isPaid ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                <span className="material-symbols-outlined text-xs">check_circle</span>
                Pago
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                <span className="material-symbols-outlined text-xs">pending</span>
                Pendente
              </span>
            )}
          </div>
        );
      }
      
      return null;
    })()}
    
    {project.progress > 0 && (
      <div className="space-y-1.5 mb-4">
        <div className="flex justify-between text-[10px] font-bold text-slate-400">
          <span>{project.status === 'Active' ? 'Fase de Codificação' : 'Testes'}</span>
          <span>{project.progress}%</span>
        </div>
        <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
          <div className={`h-full ${project.tagColor === 'emerald' ? 'bg-emerald-500' : 'bg-primary'}`} style={{ width: `${project.progress}%` }}></div>
        </div>
      </div>
    )}

    {project.deadline ? (() => {
      const deadlineDate = new Date(project.deadline);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const deadline = new Date(deadlineDate);
      deadline.setHours(0, 0, 0, 0);
      
      const diffTime = deadline.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      let deadlineColor = '';
      if (project.status === 'Completed') {
        deadlineColor = 'text-emerald-600 dark:text-emerald-400';
      } else if (diffDays < 0) {
        deadlineColor = 'text-rose-600 dark:text-rose-400';
      } else if (diffDays === 0 || diffDays === 1) {
        deadlineColor = 'text-amber-600 dark:text-amber-400';
      } else {
        deadlineColor = 'text-slate-500 dark:text-slate-400';
      }
      
      return (
        <div className={`flex items-center gap-1.5 mb-3 text-xs font-semibold ${deadlineColor}`}>
          <span className="material-symbols-outlined text-sm">calendar_today</span>
          <span>
            {project.status === 'Completed' ? 'Data de conclusão: ' : 'Data de entrega: '}
            {deadlineDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </span>
      </div>
      );
    })() : (
      <div className="flex items-center gap-1.5 mb-3 px-2 py-1 rounded bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/50">
        <span className="material-symbols-outlined text-sm text-rose-600 dark:text-rose-400 animate-pulse">warning</span>
        <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 animate-pulse">Definir data de entrega</span>
      </div>
    )}
    
    {/* Datas de Manutenção e Relatório para projetos recorrentes em Manutenção */}
    {(() => {
      const isRecurringService = categories.find(cat => 
        cat.name === project.type && cat.isRecurring
      );
      const isInMaintenance = isRecurringService && project.status === 'Completed';
      
      if (!isInMaintenance || (!project.maintenanceDate && !project.reportDate)) return null;
      
      return (
        <div className="space-y-2 mb-3">
          {project.maintenanceDate && (
            <div className={`flex items-center gap-1.5 text-xs font-semibold ${getDateColor(project.maintenanceDate)}`}>
              <span className="material-symbols-outlined text-sm">build</span>
              <span>
                Manutenção: {new Date(project.maintenanceDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </span>
            </div>
          )}
          {project.reportDate && (
            <div className={`flex items-center gap-1.5 text-xs font-semibold ${getDateColor(project.reportDate)}`}>
              <span className="material-symbols-outlined text-sm">description</span>
              <span>
                Relatório: {new Date(project.reportDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
              </span>
            </div>
          )}
        </div>
      );
    })()}
        </div>
  );
};

const ListView: React.FC<{ projects: Project[]; onProjectClick?: (project: Project) => void }> = ({ projects, onProjectClick }) => (
  <div className="max-w-6xl mx-auto">
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left table-fixed">
          <colgroup>
            <col className="w-[28%]" />
            <col className="w-[15%]" />
            <col className="w-[12%]" />
            <col className="w-[15%]" />
            <col className="w-[15%]" />
            <col className="w-[15%]" />
          </colgroup>
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="px-6 py-4 text-[13px] font-bold text-slate-500 uppercase tracking-wider">Projeto</th>
              <th className="px-6 py-4 text-[13px] font-bold text-slate-500 uppercase tracking-wider">Cliente</th>
              <th className="px-6 py-4 text-[13px] font-bold text-slate-500 uppercase tracking-wider">Tipo</th>
              <th className="px-6 py-4 text-[13px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-[13px] font-bold text-slate-500 uppercase tracking-wider">Progresso</th>
              <th className="px-6 py-4 text-[13px] font-bold text-slate-500 uppercase tracking-wider">Prazo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {projects.map((project) => (
              <tr 
                key={project.id} 
                onClick={() => onProjectClick?.(project)}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
              >
                <td className="px-6 py-4 overflow-hidden">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex-shrink-0 size-10 rounded-lg bg-slate-200" style={{ backgroundImage: `url(${project.avatar})`, backgroundSize: 'cover' }}></div>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <p className="text-sm font-bold truncate">{project.name}</p>
                      <p className="text-xs text-slate-500 truncate">{project.description}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 overflow-hidden">
                  <span className="text-sm truncate block">{project.client}</span>
                </td>
                <td className="px-6 py-4 overflow-hidden">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded inline-block truncate max-w-full ${
                    project.tagColor === 'amber' ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' :
                    project.tagColor === 'blue' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' :
                    project.tagColor === 'emerald' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' :
                    'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                  }`}>
                    {project.type}
                  </span>
                </td>
                <td className="px-6 py-4 overflow-hidden">
                  <span className={`px-2 py-1 rounded text-[10px] font-bold inline-block truncate max-w-full ${
                    project.status === 'Lead' ? 'bg-amber-100 text-amber-700' :
                    project.status === 'Active' ? 'bg-primary/10 text-primary' :
                    project.status === 'Completed' ? 'bg-green-100 text-green-700' :
                    project.status === 'Finished' ? 'bg-rose-100 text-rose-700' :
                    'bg-indigo-100 text-indigo-700'
                  }`}>
                    {project.status === 'Lead' ? 'Proposta Enviada' : 
                     project.status === 'Active' ? 'Em Desenvolvimento' :
                     project.status === 'Completed' ? 'Concluído' : 
                     project.status === 'Finished' ? 'Finalizado' : 'Em Revisão'}
                  </span>
                </td>
                <td className="px-6 py-4 overflow-hidden">
                  {project.progress > 0 ? (
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex-shrink-0 w-20 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className={`h-full ${project.tagColor === 'emerald' ? 'bg-emerald-500' : 'bg-primary'}`} style={{ width: `${project.progress}%` }}></div>
                      </div>
                      <span className="text-xs font-bold text-slate-500 whitespace-nowrap">{project.progress}%</span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 overflow-hidden">
                  {project.deadline ? (() => {
                    const deadlineDate = new Date(project.deadline);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const deadline = new Date(deadlineDate);
                    deadline.setHours(0, 0, 0, 0);
                    
                    const diffTime = deadline.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    let deadlineColor = '';
                    if (project.status === 'Completed') {
                      deadlineColor = 'text-emerald-600 dark:text-emerald-400';
                    } else if (diffDays < 0) {
                      deadlineColor = 'text-rose-600 dark:text-rose-400';
                    } else if (diffDays === 0 || diffDays === 1) {
                      deadlineColor = 'text-amber-600 dark:text-amber-400';
                    } else {
                      deadlineColor = 'text-slate-500 dark:text-slate-400';
                    }
                    
                    return (
                      <div className={`flex items-center gap-1 min-w-0 ${deadlineColor}`}>
                        <span className="material-symbols-outlined text-sm flex-shrink-0">schedule</span>
                        <span className="text-xs truncate whitespace-nowrap">
                          {deadlineDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </span>
                      </div>
                    );
                  })() : project.urgency ? (
        <div className="flex items-center gap-1 text-rose-500">
                      <span className="material-symbols-outlined text-sm flex-shrink-0">priority_high</span>
                      <span className="text-xs font-bold whitespace-nowrap">Urgente</span>
        </div>
                  ) : (
                    <span className="text-xs text-slate-400">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
    </div>
  </div>
);

const TimelineView: React.FC<{ projects: Project[]; onProjectClick?: (project: Project) => void }> = ({ projects, onProjectClick }) => {
  // Calcular a data inicial do cronograma (deadline mais antiga de projetos não concluídos)
  const calculateStartDate = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Filtrar apenas projetos não concluídos que tenham deadline
    const activeProjects = projects.filter(p => 
      p.status !== 'Completed' && p.deadline
    );
    
    if (activeProjects.length === 0) {
      // Se não há projetos ativos, começar de hoje
      return today;
    }
    
    // Encontrar a deadline mais antiga entre projetos não concluídos
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
    
    // Se a deadline mais antiga for no futuro, usar hoje
    // Se for no passado, usar a deadline mais antiga
    if (earliestDeadline && earliestDeadline < today) {
      return earliestDeadline;
    }
    
    return today;
  };
  
  // Calcular até quando mostrar o cronograma (pelo menos 30 dias ou até a data de entrega mais distante)
  const calculateEndDate = (startDate: Date) => {
    let maxDeadline: Date | null = null;
    
    // Encontrar a deadline mais distante entre todos os projetos
    projects.forEach(project => {
      if (project.deadline) {
        const deadline = project.deadline instanceof Date ? project.deadline : new Date(project.deadline);
        deadline.setHours(0, 0, 0, 0);
        
        if (!maxDeadline || deadline > maxDeadline) {
          maxDeadline = deadline;
        }
      }
    });
    
    // Se não houver deadline, usar 30 dias a partir da data inicial
    if (!maxDeadline) {
      const defaultEndDate = new Date(startDate);
      defaultEndDate.setDate(startDate.getDate() + 30);
      return defaultEndDate;
    }
    
    // Sempre adicionar pelo menos 7 dias extras além da deadline mais distante para visualização
    const endDate = new Date(maxDeadline);
    endDate.setDate(maxDeadline.getDate() + 7);
    
    // Garantir que o cronograma mostre pelo menos 30 dias
    const defaultEndDate = new Date(startDate);
    defaultEndDate.setDate(startDate.getDate() + 30);
    
    // Retornar a data mais distante entre 30 dias e deadline + 7 dias
    return endDate > defaultEndDate ? endDate : defaultEndDate;
  };
  
  // Gerar dias dinamicamente
  const generateDays = () => {
    const days = [];
    const startDate = calculateStartDate();
    const endDate = calculateEndDate(startDate);
    
    const diffTime = endDate.getTime() - startDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    // Garantir que sempre mostramos pelo menos até a deadline mais distante + pelo menos 7 dias extras
    // Adicionar mais dias para garantir que alcancemos todas as deadlines
    const totalDays = diffDays + 14; // Adicionar 14 dias extras para garantir margem
    
    const monthNames = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    
    for (let i = 0; i < totalDays; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      
      // Agrupar por semana (mostrar apenas domingos, ou início do período)
      const dayOfWeek = currentDate.getDay();
      const isWeekStart = dayOfWeek === 0 || i === 0;
      
      if (isWeekStart || i % 7 === 0) {
        const month = monthNames[currentDate.getMonth()];
        const day = currentDate.getDate().toString().padStart(2, '0');
        
        days.push({
          label: `${month} ${day}`,
          date: new Date(currentDate),
          index: i
        });
      }
    }
    
    return days;
  };
  
  const days = generateDays();
  
  // Calcular posição e duração de cada projeto baseado nas datas
  const getProjectPosition = (project: Project) => {
    const startDate = calculateStartDate();
    startDate.setHours(0, 0, 0, 0);
    
    // Usar data de criação como início (ou data inicial do cronograma se não houver)
    const projectStartDate = project.createdAt 
      ? (project.createdAt instanceof Date ? project.createdAt : new Date(project.createdAt))
      : startDate;
    projectStartDate.setHours(0, 0, 0, 0);
    
    // Usar deadline como fim (ou calcular baseado no status)
    let endDate: Date;
    if (project.deadline) {
      endDate = project.deadline instanceof Date ? project.deadline : new Date(project.deadline);
      endDate.setHours(0, 0, 0, 0);
    } else {
      // Se não houver deadline, estimar duração baseado no status
      endDate = new Date(projectStartDate);
      const estimatedWeeks = project.status === 'Active' ? 4 : project.status === 'Completed' ? 2 : 3;
      endDate.setDate(endDate.getDate() + (estimatedWeeks * 7));
    }
    
    // Encontrar a primeira data do cronograma
    const firstDayDate = days[0]?.date || startDate;
    firstDayDate.setHours(0, 0, 0, 0);
    
    // Se a data de início do projeto for antes da data inicial do cronograma, usar a data inicial
    const actualStartDate = projectStartDate < firstDayDate ? firstDayDate : projectStartDate;
    
    // Calcular diferença em dias para posição inicial
    const diffTimeStart = actualStartDate.getTime() - firstDayDate.getTime();
    const diffDaysStart = Math.ceil(diffTimeStart / (1000 * 60 * 60 * 24));
    const startDay = Math.max(0, diffDaysStart);
    
    // Encontrar qual coluna (semana) corresponde ao dia inicial
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
    
    // Calcular diferença em dias até a deadline
    const diffTimeEnd = endDate.getTime() - firstDayDate.getTime();
    const diffDaysEnd = Math.ceil(diffTimeEnd / (1000 * 60 * 60 * 24));
    const endDay = Math.max(0, diffDaysEnd);
    
    // Encontrar qual coluna corresponde ao final (deadline)
    // Procurar a última coluna cujo index seja <= endDay (a coluna que contém ou está antes da deadline)
    // Se não encontrar, usar a primeira coluna que seja >= endDay
    let endColumn = days.length - 1;
    let foundExact = false;
    
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].index <= endDay) {
        endColumn = i;
        foundExact = true;
        break;
      }
    }
    
    // Se não encontrou nenhuma coluna antes ou igual à deadline, usar a primeira que seja >=
    if (!foundExact) {
      for (let i = 0; i < days.length; i++) {
        if (days[i].index >= endDay) {
          endColumn = i;
          break;
        }
      }
    }
    
    // Calcular duração baseada nas colunas (diferença entre coluna inicial e final + 1)
    let durationColumns = endColumn - startColumn + 1;
    
    // Garantir duração mínima de 1 coluna
    durationColumns = Math.max(1, durationColumns);
    
    // Limitar startColumn
    const maxStartColumn = Math.max(0, days.length - 1);
    const finalStartColumn = Math.min(startColumn, maxStartColumn);
    
    // Calcular duração final garantindo que alcance pelo menos até a deadline
    const maxDuration = days.length - finalStartColumn;
    
    // Se endColumn está além das colunas disponíveis, usar o máximo disponível
    if (endColumn >= days.length) {
      // A deadline está além do cronograma gerado
      // Usar o máximo disponível, mas isso indica que o cronograma precisa ser expandido
      const finalDuration = maxDuration;
      
      return {
        startColumn: finalStartColumn,
        duration: finalDuration
      };
    }
    
    // Garantir que a duração inclua pelo menos até a coluna da deadline
    const finalDuration = Math.min(durationColumns, maxDuration);
    
    return {
      startColumn: finalStartColumn,
      duration: finalDuration
    };
  };
  
  // Mapear status para cores do Timeline
  const getStatusColor = (status: string, tagColor?: string) => {
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

  return (
    <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-900/20">
      <div className="min-w-[1200px]">
        <div className="sticky top-0 z-10 flex bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="w-64 flex-shrink-0 p-4 border-r border-slate-200 dark:border-slate-800 font-bold text-xs uppercase tracking-wider text-slate-400">Projetos / Clientes</div>
          <div className="flex-1 flex">
            {days.map((day, i) => (
              <div key={i} className="w-[100px] p-4 text-center border-r border-slate-100 dark:border-slate-800/50">
                <span className="block text-xs font-bold">
                  {day.label.split(' ')[0]}
                  <br />
                  {day.label.split(' ')[1]}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {projects.filter(project => project.deadline).map((project) => {
            const { startColumn, duration } = getProjectPosition(project);
            const statusColor = getStatusColor(project.status, project.tagColor);
            const isLate = project.deadline && new Date(project.deadline) < new Date() && project.status !== 'Completed';
            
            // Calcular progresso temporal baseado nas datas (até a deadline)
            // O progresso começa a contar a partir da data em que o deadline foi definido
            let temporalProgress = 0;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            if (project.deadline) {
              const deadline = project.deadline instanceof Date ? project.deadline : new Date(project.deadline);
              deadline.setHours(0, 0, 0, 0);
              
              // Usar a data de atualização do projeto (quando o deadline foi definido/modificado)
              // Se não houver updatedAt, usar a data de criação ou a data atual
              let startDate: Date;
              if (project.updatedAt) {
                startDate = project.updatedAt instanceof Date ? project.updatedAt : new Date(project.updatedAt);
              } else if (project.createdAt) {
                startDate = project.createdAt instanceof Date ? project.createdAt : new Date(project.createdAt);
              } else {
                // Se não houver datas, usar a data atual (deadline foi definido hoje)
                startDate = today;
              }
              startDate.setHours(0, 0, 0, 0);
              
              // Se a deadline está no passado em relação à data de início, ajustar
              // Isso pode acontecer se o deadline foi atualizado para uma data anterior
              if (deadline < startDate) {
                startDate = deadline;
              }
              
              // Calcular a duração total (do início até a deadline)
              const totalDuration = deadline.getTime() - startDate.getTime();
              
              // Calcular quanto tempo já passou desde o início até hoje
              const elapsed = today.getTime() - startDate.getTime();
              
              if (totalDuration > 0) {
                // Progresso temporal: (tempo decorrido / duração total) * 100
                temporalProgress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
              } else if (totalDuration === 0) {
                // Se início e deadline são no mesmo dia, mostrar 100%
                temporalProgress = 100;
              } else {
                // Se deadline está antes da data de início (caso estranho), mostrar 100%
                temporalProgress = 100;
              }
              
              // Se o projeto foi concluído, mostrar 100%
              if (project.status === 'Completed') {
                temporalProgress = 100;
              }
              // Se passou da deadline, também mostrar 100%
              else if (deadline < today) {
                temporalProgress = 100;
              }
            } else {
              // Se não houver deadline, usar o progresso do projeto
              temporalProgress = project.progress || 0;
            }
            
            return (
              <div 
                key={project.id} 
                onClick={() => onProjectClick?.(project)}
                className="flex hover:bg-white dark:hover:bg-slate-800/50 transition-colors group"
              >
                <div className="w-64 flex-shrink-0 p-4 border-r border-slate-200 dark:border-slate-800 flex flex-col gap-1">
                  <h4 className="text-sm font-bold">{project.name}</h4>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded w-fit ${
                    project.tagColor === 'amber' ? 'bg-amber-50 text-amber-600' :
                    project.tagColor === 'blue' ? 'bg-blue-50 text-blue-600' :
                    project.tagColor === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
                    project.tagColor === 'indigo' ? 'bg-indigo-50 text-indigo-600' :
                    'bg-blue-50 text-blue-600'
                  }`}>
                    {project.type}
                  </span>
                </div>
                <div className="flex-1 relative flex items-center h-20">
                  {/* Barra do projeto */}
                  <div 
                    className={`absolute h-8 ${statusColor === 'amber' ? 'bg-amber-500/10 border-l-4 border-l-amber-500' :
                      statusColor === 'blue' ? 'bg-blue-500/10 border-l-4 border-l-blue-500' :
                      statusColor === 'emerald' ? 'bg-emerald-500/10 border-l-4 border-l-emerald-500' :
                      statusColor === 'indigo' ? 'bg-indigo-500/10 border-l-4 border-l-indigo-500' :
                      isLate ? 'bg-rose-500/10 border-l-4 border-l-rose-500' :
                      'bg-blue-500/10 border-l-4 border-l-blue-500'
                    } rounded-r-lg flex items-center px-3 gap-2 cursor-pointer relative overflow-hidden`}
                    style={{ 
                      left: `${startColumn * 100}px`, 
                      width: `${duration * 100}px`,
                      minWidth: '100px'
                    }}
                  >
                    {/* Overlay de progresso temporal (cresce até a deadline) */}
                    {project.deadline && (
                      <div 
                        className={`h-full absolute left-0 top-0 rounded-r transition-all z-0 ${
                          statusColor === 'amber' ? 'bg-amber-500/40' :
                          statusColor === 'blue' ? 'bg-blue-500/40' :
                          statusColor === 'emerald' ? 'bg-emerald-500/40' :
                          statusColor === 'indigo' ? 'bg-indigo-500/40' :
                          isLate ? 'bg-rose-500/40' :
                          'bg-blue-500/40'
                        }`}
                        style={{ 
                          width: `${temporalProgress}%`,
                        }}
                        title={`Progresso temporal: ${temporalProgress.toFixed(1)}%`}
                      />
                    )}
                    <span className={`text-[10px] font-bold relative z-10 truncate flex-1 min-w-0 ${
                      statusColor === 'amber' ? 'text-amber-700' :
                      statusColor === 'blue' ? 'text-blue-700' :
                      statusColor === 'emerald' ? 'text-emerald-700' :
                      statusColor === 'indigo' ? 'text-indigo-700' :
                      isLate ? 'text-rose-700' :
                      'text-blue-700'
                    }`}>
                      {getStatusLabel(project)}
                    </span>
                    {isLate && <span className="material-symbols-outlined text-rose-500 text-sm relative z-10 flex-shrink-0">priority_high</span>}
                  </div>
                  
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// DatePicker para campos de recorrência
const RecurringDatePicker: React.FC<{ selectedDate: Date | null; onSelectDate: (date: Date | null) => void; onClose: () => void }> = ({ selectedDate, onSelectDate, onClose }) => {
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
                ${!date ? 'cursor-default' : 'cursor-pointer hover:bg-amber-500/10'}
                ${date && isToday(date) ? 'ring-2 ring-amber-500' : ''}
                ${date && isSelected(date) 
                  ? 'bg-amber-500 text-white hover:bg-amber-500/90' 
                  : date 
                    ? 'text-slate-700 dark:text-slate-300 hover:text-amber-600' 
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
            className="text-xs font-semibold text-amber-600 hover:text-amber-500 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

const AddProjectModal: React.FC<{ 
  categories: Category[]; 
  stages: Stage[]; 
  workspaceId?: string | null; 
  selectedFilter?: string;
  existingProjects?: Project[];
  onClose: () => void; 
  onSave: (project: Partial<Project>) => Promise<void> 
}> = ({ categories, stages, workspaceId, selectedFilter, existingProjects = [], onClose, onSave }) => {
  // Determinar o tipo/serviço inicial baseado no filtro selecionado
  const getInitialType = () => {
    if (selectedFilter && selectedFilter !== 'all' && selectedFilter !== 'sem-categoria') {
      const selectedCategory = categories.find(cat => 
        cat.name.toLowerCase().replace(/\s+/g, '-') === selectedFilter
      );
      return selectedCategory?.name || '';
    }
    return '';
  };

  const [formData, setFormData] = useState({
    name: '',
    client: '',
    description: '',
    type: getInitialType(),
    stageId: stages.length > 0 ? stages[0].id : '', // Usar stageId em vez de status
    status: stages.length > 0 ? stages[0].status : 'Lead' as Project['status'],
    budget: 0,
    isPaid: false,
    parcelas: 1, // Número de parcelas (1x a 12x)
    // Campos para projeto recorrente
    recurringAmount: 0,
    recurringFirstDate: '',
  });
  const [budgetDisplay, setBudgetDisplay] = useState<string>('0,00');
  const [recurringAmountDisplay, setRecurringAmountDisplay] = useState<string>('0,00');
  const [showRecurringDatePicker, setShowRecurringDatePicker] = useState(false);
  const recurringDatePickerRef = useRef<HTMLDivElement>(null);
  
  // Verificar se o serviço selecionado é recorrente
  const isSelectedTypeRecurring = () => {
    const selectedCategory = categories.find(cat => cat.name === formData.type);
    return selectedCategory?.isRecurring || false;
  };
  const [availableClients, setAvailableClients] = useState<string[]>([]);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [filteredClients, setFilteredClients] = useState<string[]>([]);
  const clientInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Estados para autocomplete de projetos
  const [availableProjectNames, setAvailableProjectNames] = useState<string[]>([]);
  const [showProjectSuggestions, setShowProjectSuggestions] = useState(false);
  const [filteredProjects, setFilteredProjects] = useState<string[]>([]);
  const projectInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getUniqueClients(workspaceId).then(clients => {
      setAvailableClients(clients);
    });
  }, [workspaceId]);

  // Carregar nomes de projetos existentes do workspace
  useEffect(() => {
    const projectNames = existingProjects.map(p => p.name).filter(Boolean);
    setAvailableProjectNames([...new Set(projectNames)]);
  }, [existingProjects]);

  // Atualizar tipo quando categorias forem carregadas e selectedFilter estiver definido
  useEffect(() => {
    if (selectedFilter && selectedFilter !== 'all' && selectedFilter !== 'sem-categoria' && categories.length > 0) {
      const selectedCategory = categories.find(cat => 
        cat.name.toLowerCase().replace(/\s+/g, '-') === selectedFilter
      );
      if (selectedCategory && formData.type !== selectedCategory.name) {
        setFormData(prev => ({ ...prev, type: selectedCategory.name }));
      }
    }
  }, [categories, selectedFilter]);

  // Atualizar stageId quando stages mudarem
  useEffect(() => {
    if (stages.length > 0) {
      const currentStageExists = stages.some(s => s.id === formData.stageId);
      if (!currentStageExists) {
        setFormData(prev => ({ ...prev, stageId: stages[0].id, status: stages[0].status }));
      }
    }
  }, [stages]);

  // Filter clients based on input
  useEffect(() => {
    if (formData.client.trim()) {
      const filtered = availableClients.filter(client =>
        client.toLowerCase().includes(formData.client.toLowerCase())
      );
      setFilteredClients(filtered);
      setShowClientSuggestions(filtered.length > 0);
    } else {
      setFilteredClients([]);
      setShowClientSuggestions(false);
    }
  }, [formData.client, availableClients]);

  // Filter project names based on input
  useEffect(() => {
    if (formData.name.trim()) {
      const filtered = availableProjectNames.filter(name =>
        name.toLowerCase().includes(formData.name.toLowerCase())
      );
      setFilteredProjects(filtered);
      setShowProjectSuggestions(filtered.length > 0);
    } else {
      setFilteredProjects([]);
      setShowProjectSuggestions(false);
    }
  }, [formData.name, availableProjectNames]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clientInputRef.current && !clientInputRef.current.contains(event.target as Node)) {
        setShowClientSuggestions(false);
      }
      if (projectInputRef.current && !projectInputRef.current.contains(event.target as Node)) {
        setShowProjectSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const formatCurrency = (value: string): string => {
    const numbers = value.replace(/\D/g, '');
    if (numbers === '' || numbers === '0') return '0,00';
    const amount = parseFloat(numbers) / 100;
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const handleBudgetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const numbers = inputValue.replace(/\D/g, '');
    const formatted = formatCurrency(numbers);
    setBudgetDisplay(formatted);
    const numericValue = numbers ? parseFloat(numbers) / 100 : 0;
    setFormData({ ...formData, budget: numericValue });
  };

  const handleBudgetFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const handleRecurringAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const numbers = inputValue.replace(/\D/g, '');
    const formatted = formatCurrency(numbers);
    setRecurringAmountDisplay(formatted);
    const numericValue = numbers ? parseFloat(numbers) / 100 : 0;
    setFormData({ ...formData, recurringAmount: numericValue });
  };

  // Fechar date picker ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (recurringDatePickerRef.current && !recurringDatePickerRef.current.contains(event.target as Node)) {
        setShowRecurringDatePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.client && !isSubmitting) {
      setIsSubmitting(true);
      try {
        await onSave(formData);
        // Modal será fechado pelo onSave
      } catch (error) {
        console.error("Error in handleSubmit:", error);
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-xl font-bold">Adicionar Novo Projeto</h3>
          <button 
            onClick={onClose}
            className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Nome do Projeto</label>
            <div className="relative" ref={projectInputRef}>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                onFocus={() => {
                  if (formData.name.trim() && filteredProjects.length > 0) {
                    setShowProjectSuggestions(true);
                  }
                }}
                className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary"
                placeholder="Ex: Redesign de Site"
                required
              />
              {showProjectSuggestions && filteredProjects.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                  {filteredProjects.map((projectName, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, name: projectName });
                        setShowProjectSuggestions(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      {projectName}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Cliente</label>
            <div className="relative" ref={clientInputRef}>
              <input
                type="text"
                value={formData.client}
                onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                onFocus={() => {
                  if (formData.client.trim() && filteredClients.length > 0) {
                    setShowClientSuggestions(true);
                  }
                }}
                className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary"
                placeholder="Nome do cliente"
                required
              />
              {showClientSuggestions && filteredClients.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                  {filteredClients.map((client, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, client });
                        setShowClientSuggestions(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-b-0"
                    >
                      {client}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Descrição</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary resize-none"
              placeholder="Descreva o projeto..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Tipo</label>
              <div className="relative">
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full px-4 py-2.5 pr-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer transition-all hover:border-primary/50"
                >
                  <option value="">Selecione um serviço</option>
                  {categories.map((category, index) => (
                    <option key={category.id || index} value={category.name}>{category.name}</option>
                  ))}
                  <option value="Sem categoria">Sem serviço</option>
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <span className="material-symbols-outlined text-lg">expand_more</span>
                </span>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Etapa</label>
              <div className="relative">
                <select
                  value={formData.stageId}
                  onChange={(e) => {
                    const selectedStage = stages.find(s => s.id === e.target.value);
                    setFormData({ 
                      ...formData, 
                      stageId: e.target.value,
                      status: selectedStage?.status as Project['status'] || 'Lead'
                    });
                  }}
                  className="w-full px-4 py-2.5 pr-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer transition-all hover:border-primary/50"
                >
                  {stages.length > 0 ? (
                    stages.map((stage) => (
                      <option key={stage.id} value={stage.id}>{stage.title}</option>
                    ))
                  ) : (
                    <>
                      <option value="">Selecione uma etapa</option>
                    </>
                  )}
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <span className="material-symbols-outlined text-lg">expand_more</span>
                </span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Implementação</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none font-medium">R$</span>
                <input
                  type="text"
                  value={budgetDisplay}
                  onChange={handleBudgetChange}
                  onFocus={handleBudgetFocus}
                  className="w-full pl-12 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                  placeholder="0,00"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Forma de Pagamento</label>
              <div className="relative">
                <select
                  value={formData.parcelas}
                  onChange={(e) => setFormData({ ...formData, parcelas: parseInt(e.target.value) })}
                  className="w-full px-4 py-2.5 pr-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer transition-all hover:border-primary/50"
                >
                  <option value={1}>À vista (1x)</option>
                  <option value={2}>2x</option>
                  <option value={3}>3x</option>
                  <option value={4}>4x</option>
                  <option value={5}>5x</option>
                  <option value={6}>6x</option>
                  <option value={7}>7x</option>
                  <option value={8}>8x</option>
                  <option value={9}>9x</option>
                  <option value={10}>10x</option>
                  <option value={11}>11x</option>
                  <option value={12}>12x</option>
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <span className="material-symbols-outlined text-lg">expand_more</span>
                </span>
              </div>
              {formData.budget > 0 && formData.parcelas > 1 && (
                <p className="text-xs text-slate-500 mt-1.5">
                  {formData.parcelas}x de {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(formData.budget / formData.parcelas)}
                </p>
              )}
            </div>
          </div>
          
          {/* Campos para projeto recorrente */}
          {isSelectedTypeRecurring() && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2 block">Valor Mensal</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none font-medium">R$</span>
                    <input
                      type="text"
                      value={recurringAmountDisplay}
                      onChange={handleRecurringAmountChange}
                      onFocus={handleBudgetFocus}
                      className="w-full pl-12 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                      placeholder="0,00"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2 block">Data da 1ª Fatura</label>
                  <div className="relative" ref={recurringDatePickerRef}>
                    <button
                      type="button"
                      onClick={() => setShowRecurringDatePicker(!showRecurringDatePicker)}
                      className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg text-sm text-left flex items-center justify-between hover:border-amber-500 transition-colors"
                    >
                      <span className={formData.recurringFirstDate ? 'text-slate-900 dark:text-white' : 'text-slate-400'}>
                        {formData.recurringFirstDate 
                          ? (() => {
                              const [year, month, day] = formData.recurringFirstDate.split('-').map(Number);
                              return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
                            })()
                          : 'Selecione uma data'
                        }
                      </span>
                      <span className="material-symbols-outlined text-sm text-amber-500">calendar_today</span>
                    </button>
                    {showRecurringDatePicker && (
                      <RecurringDatePicker
                        selectedDate={formData.recurringFirstDate ? (() => {
                          const [year, month, day] = formData.recurringFirstDate.split('-').map(Number);
                          return new Date(year, month - 1, day);
                        })() : null}
                        onSelectDate={(date) => {
                          if (date) {
                            const year = date.getFullYear();
                            const month = String(date.getMonth() + 1).padStart(2, '0');
                            const day = String(date.getDate()).padStart(2, '0');
                            setFormData({ ...formData, recurringFirstDate: `${year}-${month}-${day}` });
                            setShowRecurringDatePicker(false);
                          }
                        }}
                        onClose={() => setShowRecurringDatePicker(false)}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
          
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
              className="px-8 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all"
            >
              Criar Projeto
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AddCategoryModal: React.FC<{ onClose: () => void; onSave: (category: { name: string; isRecurring: boolean }) => Promise<void> }> = ({ onClose, onSave }) => {
  const [categoryName, setCategoryName] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (categoryName.trim() && !isSubmitting) {
      setIsSubmitting(true);
      try {
        await onSave({ name: categoryName.trim(), isRecurring });
        setCategoryName('');
        setIsRecurring(false);
        // Modal será fechado pelo onSave
      } catch (error) {
        console.error("Error in handleSubmit:", error);
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-full max-w-md">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-xl font-bold">Adicionar Novo Serviço</h3>
          <button 
            onClick={onClose}
            className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Nome do Serviço</label>
            <input
              type="text"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary"
              placeholder="Ex: Marketing Digital"
              required
              autoFocus
            />
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-primary/50 transition-colors">
            <label htmlFor="isRecurring" className="text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
              Serviço Recorrente
            </label>
            <button
              type="button"
              onClick={() => setIsRecurring(!isRecurring)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                isRecurring ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                  isRecurring ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
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
              className="px-8 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all"
            >
              Adicionar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DeleteCategoryModal: React.FC<{ categoryName: string; onClose: () => void; onConfirm: () => void }> = ({ categoryName, onClose, onConfirm }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-full max-w-md">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-4 mb-4">
            <div className="size-12 rounded-full bg-rose-100 dark:bg-rose-900/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-rose-600 dark:text-rose-400">warning</span>
            </div>
            <div>
              <h3 className="text-xl font-bold">Excluir Serviço</h3>
              <p className="text-sm text-slate-500 mt-1">Esta ação não pode ser desfeita</p>
            </div>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Tem certeza que deseja excluir o serviço <span className="font-bold">"{categoryName}"</span>?
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Os projetos vinculados a este serviço serão marcados como "Sem serviço".
          </p>
        </div>
        <div className="p-6 flex items-center justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={onConfirm}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors"
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
};

const DeleteStageModal: React.FC<{ 
  stage: Stage; 
  projectCount: number;
  onClose: () => void; 
  onConfirm: () => void 
}> = ({ stage, projectCount, onClose, onConfirm }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-full max-w-md">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-4 mb-4">
            <div className="size-12 rounded-full bg-rose-100 dark:bg-rose-900/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-rose-600 dark:text-rose-400">warning</span>
            </div>
            <div>
              <h3 className="text-xl font-bold">Excluir Etapa</h3>
              <p className="text-sm text-slate-500 mt-1">Esta ação não pode ser desfeita</p>
            </div>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Tem certeza que deseja excluir a etapa <span className="font-bold">"{stage.title}"</span>?
          </p>
          {projectCount > 0 && (
            <p className="text-xs text-slate-500 mt-2">
              {projectCount} {projectCount === 1 ? 'projeto será' : 'projetos serão'} movido{projectCount > 1 ? 's' : ''} para a primeira etapa disponível.
            </p>
          )}
        </div>
        <div className="p-6 flex items-center justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={onConfirm}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors"
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
};

const DefineStageTasksModal: React.FC<{ 
  stage: Stage; 
  onClose: () => void;
}> = ({ stage, onClose }) => {
  const [tasks, setTasks] = useState<Array<{ title: string; order: number }>>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [draggedTaskIndex, setDraggedTaskIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const loadTasks = async () => {
      try {
        const existingTasks = await getStageTasks(stage.id);
        setTasks(existingTasks.map(t => ({ title: t.title, order: t.order })));
      } catch (error) {
        console.error("Error loading tasks:", error);
      } finally {
        setLoading(false);
      }
    };
    loadTasks();
  }, [stage.id]);

  const handleAddTask = () => {
    if (newTaskTitle.trim()) {
      setTasks([...tasks, { title: newTaskTitle.trim(), order: tasks.length }]);
      setNewTaskTitle('');
    }
  };

  const handleRemoveTask = (index: number) => {
    setTasks(tasks.filter((_, i) => i !== index).map((t, i) => ({ ...t, order: i })));
  };

  const handleTaskDragStart = (index: number) => {
    setDraggedTaskIndex(index);
  };

  const handleTaskDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedTaskIndex === null || draggedTaskIndex === index) return;
    setDragOverIndex(index);
  };

  const handleTaskDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleTaskDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedTaskIndex === null || draggedTaskIndex === dropIndex) {
      setDraggedTaskIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newTasks = [...tasks];
    const draggedTask = newTasks[draggedTaskIndex];
    
    // Remove a tarefa da posição original
    newTasks.splice(draggedTaskIndex, 1);
    
    // Insere a tarefa na nova posição
    newTasks.splice(dropIndex, 0, draggedTask);
    
    // Atualiza a ordem
    const reorderedTasks = newTasks.map((t, i) => ({ ...t, order: i }));
    setTasks(reorderedTasks);
    
    setDraggedTaskIndex(null);
    setDragOverIndex(null);
  };

  const handleTaskDragEnd = () => {
    setDraggedTaskIndex(null);
    setDragOverIndex(null);
  };

  const handleSave = async () => {
    try {
      await saveStageTasks(stage.id, tasks);
      setToast({ message: "Tarefas salvas com sucesso!", type: 'success' });
      setTimeout(() => {
        setToast(null);
        onClose();
      }, 2000);
    } catch (error) {
      console.error("Error saving tasks:", error);
      setToast({ message: "Erro ao salvar tarefas. Tente novamente.", type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold">Definir Tarefas - {stage.title}</h3>
            <p className="text-sm text-slate-500 mt-1">As tarefas definidas aqui aparecerão em todos os projetos desta etapa</p>
          </div>
          <button onClick={onClose} className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-6 space-y-4">
          {loading ? (
            <div className="text-center py-8 text-slate-500">Carregando...</div>
          ) : (
            <>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddTask()}
                  placeholder="Digite o nome da tarefa..."
                  className="flex-1 px-4 py-2.5 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary"
                />
                <button
                  onClick={handleAddTask}
                  className="px-6 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
                >
                  Adicionar
                </button>
              </div>
              
              <div className="space-y-2">
                {tasks.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-sm">
                    Nenhuma tarefa definida. Adicione tarefas acima.
                  </div>
                ) : (
                  tasks.map((task, index) => (
                    <div
                      key={index}
                      draggable
                      onDragStart={() => handleTaskDragStart(index)}
                      onDragOver={(e) => handleTaskDragOver(e, index)}
                      onDragLeave={handleTaskDragLeave}
                      onDrop={(e) => handleTaskDrop(e, index)}
                      onDragEnd={handleTaskDragEnd}
                      className={`flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 cursor-move transition-all ${
                        draggedTaskIndex === index ? 'opacity-50' : ''
                      } ${
                        dragOverIndex === index ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'hover:border-primary/50'
                      }`}
                    >
                      <span className="material-symbols-outlined text-slate-400 text-lg">drag_handle</span>
                      <span className="text-slate-400 text-sm font-bold">{index + 1}.</span>
                      <span className="flex-1 text-sm font-medium text-slate-900 dark:text-slate-100">{task.title}</span>
                      <button
                        onClick={() => handleRemoveTask(index)}
                        className="text-rose-600 hover:text-rose-700 transition-colors"
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
        <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave}
            className="px-8 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 transition-all"
          >
            Salvar Tarefas
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-[60] animate-[slideIn_0.3s_ease-out]">
          <div className={`flex items-center gap-3 px-5 py-4 rounded-xl shadow-xl border backdrop-blur-sm min-w-[360px] max-w-[480px] ${
            toast.type === 'success' 
              ? 'bg-white/95 dark:bg-slate-900/95 border-emerald-200 dark:border-emerald-800/50' 
              : 'bg-white/95 dark:bg-slate-900/95 border-amber-200 dark:border-amber-800/50'
          }`}>
            <div className={`flex-shrink-0 size-10 rounded-full flex items-center justify-center ${
              toast.type === 'success' 
                ? 'bg-emerald-100 dark:bg-emerald-900/30' 
                : 'bg-amber-100 dark:bg-amber-900/30'
            }`}>
              <span className={`material-symbols-outlined text-xl ${
                toast.type === 'success' 
                  ? 'text-emerald-600 dark:text-emerald-400' 
                  : 'text-amber-600 dark:text-amber-400'
              }`}>
                {toast.type === 'success' ? 'check_circle' : 'warning'}
              </span>
            </div>
            <p className={`text-sm font-semibold flex-1 leading-relaxed ${
              toast.type === 'success' 
                ? 'text-emerald-900 dark:text-emerald-100' 
                : 'text-amber-900 dark:text-amber-100'
            }`}>
              {toast.message}
            </p>
            <button 
              onClick={() => setToast(null)}
              className="ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors flex-shrink-0 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Fechar"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const AddStageModal: React.FC<{ onClose: () => void; onSave: (stage: { title: string }) => Promise<void> }> = ({ onClose, onSave }) => {
  const [formData, setFormData] = useState({
    title: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (formData.title.trim() && !isSubmitting) {
      setIsSubmitting(true);
      console.log('📝 [AddStageModal] Salvando etapa:', formData.title);
      try {
        await onSave(formData);
        setFormData({ title: '' });
        // Modal será fechado pelo onSave
      } catch (error) {
        console.error("Error in handleSubmit:", error);
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-full max-w-md">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-xl font-bold">Adicionar Nova Etapa</h3>
          <button 
            onClick={onClose}
            className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Nome da Etapa</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary"
              placeholder="Ex: Em Revisão"
              required
              autoFocus
            />
          </div>
          <p className="text-xs text-slate-400">
            A porcentagem de progresso será calculada automaticamente baseado na quantidade de etapas. Você pode reordenar as etapas arrastando o cabeçalho de cada coluna.
          </p>
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
              className="px-8 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all"
            >
              Adicionar Etapa
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
