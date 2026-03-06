
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Project, Stage, Workspace, Category, parseSafeDate, projectHasRecurringType, Client } from '../types';
import { DefineStageTasksModal } from '../components/DefineStageTasksModal';
import {
  subscribeToProjects,
  subscribeToCategories,
  addProject as addProjectToFirebase,
  addCategory as addCategoryToFirebase,
  deleteCategory as deleteCategoryFromFirebase,
  updateProject as updateProjectInFirebase,
  subscribeToStages,
  saveStages,
  deleteStage as deleteStageFromFirebase,
  updateStage,
  getStages,
  Stage as FirebaseStage,
  getStageTasks,
  saveStageTasks,
  getUniqueClients,
  deleteProject,
  removeProjectStageId,
  addInvoice,
  updateCategoriesOrder,
  getClients,
  addClient,
  updateClient
} from '../firebase/services';
import { createAsaasCustomer } from '../firebase/asaas';

interface DashboardProps {
  onProjectClick?: (project: Project) => void;
  currentWorkspace?: Workspace | null;
  initialFilter?: string;
  highlightedProjectId?: string;
  openAddProjectModal?: boolean;
  onAddProjectModalClose?: () => void;
  userId?: string | null;
  searchQuery?: string;
  canEdit?: boolean;
}

type ViewMode = 'board' | 'list';

// Imagem padrão para avatar do cliente e imagem do projeto
const DEFAULT_PROJECT_IMAGE = 'https://picsum.photos/seed/default-project/200/200';

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
    deadline: 'Follow up 2d',
    stageId: 'onboarding'
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
    urgency: true,
    stageId: 'onboarding'
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
    avatar: 'https://picsum.photos/seed/global/40/40',
    stageId: 'development'
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
    avatar: 'https://picsum.photos/seed/finedge/40/40',
    stageId: 'review'
  }
];

interface DashboardStage {
  id: string;
  title: string;
  status: Project['status'];
  order: number;
  progress: number;
  isFixed?: boolean;
}

// Função para recalcular progresso de todas as etapas
const recalculateStageProgress = (stages: DashboardStage[]): DashboardStage[] => {
  const totalStages = stages.length;
  if (totalStages === 0) return stages;

  return stages.map((stage, index) => {
    // Para etapas fixas, preservar o progresso original
    if (stage.isFixed) {
      return {
        ...stage,
        progress: stage.progress, // Manter o progresso definido
        status: stage.status // Preservar status original
      };
    }

    // Para etapas personalizadas, calcular progresso baseado na posição
    const progress = totalStages === 1 ? 100 : Math.round((index / (totalStages - 1)) * 100);

    // Determinar status automaticamente para etapas personalizadas baseado na posição
    let status: Project['status'];
    if (index === 0) status = 'Lead';
    else if (index === totalStages - 1) status = 'Completed';
    else if (index < totalStages / 2) status = 'Active';
    else status = 'Review';

    return {
      ...stage,
      progress,
      status
    };
  });
};

// Etapas fixas para serviços normais (sob demanda)
const fixedStages: DashboardStage[] = [
  { id: 'onboarding', title: 'On boarding', status: 'Lead', order: 0, progress: 10, isFixed: true },
  { id: 'development', title: 'Em desenvolvimento', status: 'Active', order: 1, progress: 30, isFixed: true },
  { id: 'review', title: 'Em Revisão', status: 'Review', order: 2, progress: 50, isFixed: true },
  { id: 'adjustments', title: 'Ajustes', status: 'Review', order: 3, progress: 75, isFixed: true },
  { id: 'completed', title: 'Concluído', status: 'Completed', order: 4, progress: 100, isFixed: true }
];

// Etapas fixas para serviços recorrentes
const fixedStagesRecurring: DashboardStage[] = [
  { id: 'onboarding-recurring', title: 'On boarding', status: 'Lead', order: 0, progress: 10, isFixed: true },
  { id: 'development-recurring', title: 'Em desenvolvimento', status: 'Active', order: 1, progress: 25, isFixed: true },
  { id: 'review-recurring', title: 'Em Revisão', status: 'Review', order: 2, progress: 40, isFixed: true },
  { id: 'adjustments-recurring', title: 'Ajustes', status: 'Review', order: 3, progress: 55, isFixed: true },
  { id: 'maintenance-recurring', title: 'Manutenção', status: 'Completed', order: 4, progress: 80, isFixed: true },
  { id: 'finished-recurring', title: 'Finalizado', status: 'Finished' as any, order: 5, progress: 100, isFixed: true }
];

export const Dashboard: React.FC<DashboardProps> = ({ onProjectClick, currentWorkspace, initialFilter, highlightedProjectId, openAddProjectModal, onAddProjectModalClose, userId, searchQuery = '', canEdit = true }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedFilter, setSelectedFilter] = useState<string>(initialFilter || 'all');
  const [showCompletedProjects, setShowCompletedProjects] = useState<boolean>(() => {
    // Carregar preferência do localStorage
    const saved = localStorage.getItem(`showCompletedProjects_${currentWorkspace?.id || 'default'}`);
    return saved !== null ? saved === 'true' : true; // Padrão: true (mostrar)
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [showAddProject, setShowAddProject] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [stages, setStages] = useState<DashboardStage[]>(recalculateStageProgress(fixedStages));
  const [loading, setLoading] = useState(true);
  const [draggedStage, setDraggedStage] = useState<DashboardStage | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, scrollLeft: 0 });
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const categoryTabsRef = useRef<HTMLDivElement>(null); // Ref para container das abas de categorias
  const categoryPanStartRef = useRef({ x: 0, scrollLeft: 0 });
  const isCategoryPanningRef = useRef(false);
  const categoryHasMovedRef = useRef(false);
  const [stageMenuOpen, setStageMenuOpen] = useState<string | null>(null);
  const [stageToDelete, setStageToDelete] = useState<DashboardStage | null>(null);
  const [stageToEditTasks, setStageToEditTasks] = useState<DashboardStage | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const isInitialStagesLoad = useRef(true);
  const isDeletingStage = useRef(false);
  const isAddingFixedStages = useRef(false);
  const hasUpdatedOnboardingProgress = useRef(false); // Flag para evitar atualizações repetidas

  // Abrir modal de adicionar projeto quando solicitado externamente
  useEffect(() => {
    if (openAddProjectModal) {
      setShowAddProject(true);
    }
  }, [openAddProjectModal]);

  useEffect(() => {
    const saved = localStorage.getItem(`showCompletedProjects_${currentWorkspace?.id || 'default'}`);
    if (saved !== null) {
      setShowCompletedProjects(saved === 'true');
    } else {
      setShowCompletedProjects(true); // Padrão: true
    }
  }, [currentWorkspace?.id]);

  // Resetar filtro de categoria quando houver busca
  useEffect(() => {
    if (searchQuery && searchQuery.trim() !== '') {
      setSelectedFilter('all');
    }
  }, [searchQuery]);

  // Notificar quando o modal fechar
  const handleCloseAddProject = () => {
    setShowAddProject(false);
    onAddProjectModalClose?.();
  };

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
  const handleProjectDrop = async (project: Project, targetStage: DashboardStage) => {
    if (!canEdit) return;

    try {
      // IDs fixos conhecidos para etapas normais
      const fixedStageIds = ['onboarding', 'development', 'review', 'completed'];

      // Verificar se é uma etapa recorrente (Manutenção ou Finalizado)
      const isRecurringStage = targetStage.title === 'Manutenção' || targetStage.title === 'Finalizado';

      // Para serviços recorrentes, não atualizar stageId (usar apenas status)
      // Verificar se ALGUM dos tipos do projeto é recorrente
      const projectTypesArray = project.types || (project.type ? [project.type] : []);
      const isProjectRecurring = projectTypesArray.some(typeName =>
        categories.find(cat => cat.name === typeName && cat.isRecurring)
      );

      // Função para verificar se um stageId é de etapa fixa (considera variações de ID)
      const hasFixedStageId = (projectStageId: string | undefined): boolean => {
        if (!projectStageId) return false;
        const projectIdBase = projectStageId.split('-')[0];
        return fixedStageIds.includes(projectIdBase) || fixedStageIds.includes(projectStageId);
      };

      // Função para obter o ID base da etapa (originalId ou ID sem sufixo de workspace)
      const getStageBaseId = (stage: DashboardStage): string => {
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
    } else if (!initialFilter && selectedFilter !== 'all') {
      // Se não houver filtro inicial (busca foi limpa), resetar para 'all'
      setSelectedFilter('all');
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
    hasUpdatedOnboardingProgress.current = false; // Resetar flag ao mudar workspace

    setLoading(true);
    setStages([]); // Limpar etapas anteriores

    // Subscribe to real-time updates filtrados por workspace
    const unsubscribeProjects = subscribeToProjects((firebaseProjects) => {
      console.log('📦 [Dashboard] Projetos recebidos:', firebaseProjects.length);

      // Atualizar automaticamente projetos em On-boarding com progress: 0 para progress: 10
      // Fazer isso apenas uma vez por workspace para evitar atualizações repetidas
      if (!hasUpdatedOnboardingProgress.current) {
        const projectsToUpdate = firebaseProjects.filter(p => {
          const isOnboarding = p.status === 'Lead' &&
            (p.stageId?.includes('onboarding') || !p.stageId);
          return isOnboarding && (p.progress === 0 || !p.progress);
        });

        if (projectsToUpdate.length > 0) {
          console.log(`🔄 [Dashboard] Atualizando ${projectsToUpdate.length} projeto(s) em On-boarding para progress: 10`);
          hasUpdatedOnboardingProgress.current = true;
          projectsToUpdate.forEach(async (project) => {
            try {
              await updateProjectInFirebase(project.id, { progress: 10 });
            } catch (error) {
              console.error(`Erro ao atualizar progresso do projeto ${project.id}:`, error);
            }
          });
        }
      }

      setProjects(firebaseProjects);
      setLoading(false);
    }, currentWorkspace.id, null); // Passar null para userId para ver todos os projetos do workspace

    const unsubscribeCategories = subscribeToCategories((firebaseCategories) => {
      console.log('📁 [Dashboard] Categorias recebidas:', firebaseCategories.length);
      setCategories(firebaseCategories);
    }, currentWorkspace.id, userId);

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
        saveStages(fixedStagesRecalculated as any, currentWorkspace.id, userId).then(() => {
          console.log('✅ [Dashboard] Etapas fixas salvas com sucesso');
          setTimeout(() => {
            isAddingFixedStages.current = false;
          }, 1000);
        }).catch(err => {
          console.error("Error saving fixed stages:", err);
          isAddingFixedStages.current = false;
        });
      }
    }, currentWorkspace.id, userId);

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
        const workspaceStages = allStages.filter(s => (s as any).workspaceId === currentWorkspace.id);

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

        await saveStages(fixedStagesRecalculated as any, currentWorkspace.id);

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

    // Garantir que a função está disponível globalmente
    (window as any).clearAllStages = async () => {
      try {
        const allStages = await getStages();
        const nonFixedStages = allStages.filter(s => !s.isFixed && (s as any).workspaceId === currentWorkspace?.id);

        console.log(`Encontradas ${allStages.length} etapas no total`);
        console.log(`${nonFixedStages.length} etapas não-fixas para excluir no workspace atual`);

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

    return () => {
      delete (window as any).clearFirestoreCache;
      delete (window as any).clearAllStages;
      delete (window as any).resetStagesToFixed;
    };
  }, [currentWorkspace]);


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
    <div className="flex flex-col bg-background-light dark:bg-background-dark">
      <div className="px-8 py-10 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border-b border-white/20 dark:border-slate-800/50 flex-shrink-0">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div className="animate-fade-in">
            <h2 className="text-4xl font-black tracking-tight font-display text-slate-900 dark:text-white mb-2">
              Pipeline de <span className="text-primary">Projetos</span>
            </h2>
            <p className="text-base text-slate-500 font-medium">Gerencie seu fluxo de trabalho criativo com precisão</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 animate-fade-in" style={{ animationDelay: '100ms' }}>
            <div className="flex bg-slate-200/50 dark:bg-slate-800/50 backdrop-blur-md p-1.5 rounded-2xl border border-white/20 dark:border-slate-700/30 shadow-inner">
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-2 px-6 py-2 text-xs font-black rounded-xl transition-all ${viewMode === 'list'
                  ? 'bg-white dark:bg-slate-700 shadow-xl text-primary scale-105'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
              >
                <span className="material-symbols-outlined text-[18px]">format_list_bulleted</span>
                LISTA
              </button>
              <button
                onClick={() => setViewMode('board')}
                className={`flex items-center gap-2 px-6 py-2 text-xs font-black rounded-xl transition-all ${viewMode === 'board'
                  ? 'bg-white dark:bg-slate-700 shadow-xl text-primary scale-105'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
              >
                <span className="material-symbols-outlined text-[18px]">dashboard_customize</span>
                QUADRO
              </button>
            </div>

            <div className="flex items-center gap-2 px-4 py-2 bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-md rounded-xl border border-white/20 dark:border-slate-700/30">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCompletedProjects}
                  onChange={(e) => {
                    const newValue = e.target.checked;
                    setShowCompletedProjects(newValue);
                    localStorage.setItem(`showCompletedProjects_${currentWorkspace?.id || 'default'}`, String(newValue));
                  }}
                  className="sr-only"
                />
                <div className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${showCompletedProjects ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}>
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${showCompletedProjects ? 'translate-x-5' : 'translate-x-0'}`}></div>
                </div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                  Mostrar concluídos
                </span>
              </label>
            </div>

            {canEdit && (
              <button
                onClick={() => setShowAddProject(true)}
                className="group flex items-center gap-3 px-8 py-3.5 bg-primary text-white rounded-2xl text-sm font-black hover:scale-[1.02] active:scale-[0.98] transition-all shadow-2xl shadow-primary/30"
              >
                <span className="material-symbols-outlined text-[20px] group-hover:rotate-90 transition-transform">add</span>
                <span>NOVO PROJETO</span>
              </button>
            )}
          </div>
        </div>
        <div
          ref={categoryTabsRef}
          className="flex border-b border-slate-200 dark:border-slate-800 gap-2 items-center overflow-x-auto no-scrollbar"

          onMouseDown={(e: React.MouseEvent) => {
            // Não ativa se for botão direito do mouse
            if (e.button !== 0) return;

            const target = e.target as HTMLElement;

            // Não ativa se clicar no ícone drag_indicator (deixa o drag and drop funcionar)
            if (target.closest('.drag-indicator-handle')) {
              return;
            }

            // Não ativa em elementos interativos
            if (
              target.closest('input') ||
              target.closest('select') ||
              target.closest('textarea') ||
              target.closest('a[href]')
            ) {
              return;
            }

            // Resetar flags
            categoryHasMovedRef.current = false;
            isCategoryPanningRef.current = false;

            // Ativa pan horizontal
            if (categoryTabsRef.current) {
              isCategoryPanningRef.current = true;
              categoryPanStartRef.current = {
                x: e.pageX,
                scrollLeft: categoryTabsRef.current.scrollLeft
              };
              e.preventDefault();
            }
          }}
          onMouseMove={(e: React.MouseEvent) => {
            if (!isCategoryPanningRef.current || !categoryTabsRef.current) return;

            const deltaX = Math.abs(e.pageX - categoryPanStartRef.current.x);
            const threshold = 5; // Threshold de 5px para considerar movimento

            // Se moveu mais que o threshold, considera arrasto
            if (deltaX > threshold) {
              categoryHasMovedRef.current = true;
            }

            e.preventDefault();
            const x = e.pageX;
            const walk = (x - categoryPanStartRef.current.x) * 1.5;
            categoryTabsRef.current.scrollLeft = categoryPanStartRef.current.scrollLeft - walk;
          }}
          onMouseUp={() => {
            isCategoryPanningRef.current = false;
            // Resetar após um pequeno delay
            setTimeout(() => {
              categoryHasMovedRef.current = false;
            }, 100);
          }}
          onMouseLeave={() => {
            isCategoryPanningRef.current = false;
            categoryHasMovedRef.current = false;
          }}
          style={{
            cursor: isCategoryPanningRef.current ? 'grabbing' : 'grab',
            userSelect: 'none',
            msOverflowStyle: 'none',
            scrollbarWidth: 'none'
          }}
          onDragOver={(e) => {
            // Permitir drop no container (os divs individuais vão lidar com o drop)
            if (draggedCategoryId) {
              e.preventDefault();
            }
          }}
        >
          <button
            onClick={(e) => {
              // Prevenir clique se houve pan
              if (categoryHasMovedRef.current || isCategoryPanningRef.current) {
                e.preventDefault();
                e.stopPropagation();
                return;
              }
              setSelectedFilter('all');
            }}
            className={`flex items-center gap-2 px-4 pb-3 text-sm font-bold transition-all relative whitespace-nowrap ${selectedFilter === 'all'
              ? 'text-primary'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
          >
            <span className="material-symbols-outlined text-lg">grid_view</span>
            <span>Todos os Projetos</span>
            <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] ${selectedFilter === 'all' ? 'bg-primary/10 text-primary' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}>
              {projects.length}
            </span>
            {selectedFilter === 'all' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full shadow-[0_-1px_4px_rgba(var(--primary-rgb),0.3)]"></div>
            )}
          </button>

          {categories.map((category, index) => {
            const filterKey = category.name.toLowerCase().replace(/\s+/g, '-');
            const isActive = selectedFilter === filterKey;
            // Contar projetos que têm este serviço (considerando múltiplos tipos)
            const projectCount = projects.filter(p => {
              const types = p.types || (p.type ? [p.type] : []);
              return types.includes(category.name);
            }).length;
            const isDragging = draggedCategoryId === category.id;
            const isDragOver = dragOverIndex === index && draggedCategoryId !== category.id;

            return (
              <div
                key={category.id || index}
                className={`flex items-center group relative whitespace-nowrap transition-all ${isDragging ? 'opacity-30 scale-95' : ''
                  }`}
                onDragOver={(e) => {
                  if (draggedCategoryId && draggedCategoryId !== category.id) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = 'move';
                    setDragOverIndex(index);
                  }
                }}
                onDragLeave={(e) => {
                  // Só limpar se realmente saiu do elemento
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX;
                  const y = e.clientY;
                  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                    setDragOverIndex(null);
                  }
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const draggedId = draggedCategoryId;

                  if (draggedId && draggedId !== category.id) {
                    const draggedIndex = categories.findIndex(c => c.id === draggedId);
                    if (draggedIndex !== -1) {
                      const newCategories = [...categories];
                      const [removed] = newCategories.splice(draggedIndex, 1);
                      newCategories.splice(index, 0, removed);

                      // Atualizar ordem no Firebase
                      const categoryOrders = newCategories.map((cat, idx) => ({
                        id: cat.id,
                        order: idx + 1
                      }));

                      try {
                        await updateCategoriesOrder(categoryOrders);
                      } catch (error) {
                        console.error('Error updating category order:', error);
                      }
                    }
                  }

                  setDraggedCategoryId(null);
                  setDragOverIndex(null);
                }}
              >
                {/* Indicador visual de drop */}
                {isDragOver && (
                  <div className="absolute -left-1 top-0 bottom-0 w-1 bg-primary rounded-full z-10 animate-pulse"></div>
                )}

                <button
                  onClick={(e) => {
                    // Prevenir clique se houve pan
                    if (categoryHasMovedRef.current || isCategoryPanningRef.current) {
                      e.preventDefault();
                      e.stopPropagation();
                      return;
                    }
                    setSelectedFilter(filterKey);
                  }}
                  className={`flex items-center gap-2 px-4 pb-3 text-sm font-bold transition-all relative ${isActive
                    ? 'text-primary'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                  <span
                    className={`material-symbols-outlined text-base opacity-0 group-hover:opacity-100 transition-opacity drag-indicator-handle cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-100' : ''}`}
                    style={{ fontSize: '16px' }}
                    draggable={canEdit}
                    onDragStart={(e) => {
                      setDraggedCategoryId(category.id);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', category.id);
                      e.stopPropagation(); // Prevenir que o pan seja ativado
                    }}
                    onDragEnd={() => {
                      setDraggedCategoryId(null);
                      setDragOverIndex(null);
                    }}
                  >
                    drag_indicator
                  </span>
                  {category.isRecurring ? (
                    <span className={`material-symbols-outlined text-lg ${isActive ? 'text-primary' : 'text-amber-500'}`}>
                      autorenew
                    </span>
                  ) : (
                    <span className={`material-symbols-outlined text-lg ${isActive ? 'text-primary' : 'text-slate-400'}`}>
                      inventory_2
                    </span>
                  )}
                  <span>{category.name}</span>
                  <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] ${isActive ? 'bg-primary/10 text-primary' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}>
                    {projectCount}
                  </span>

                  {isActive && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full shadow-[0_-1px_4px_rgba(var(--primary-rgb),0.3)]"></div>
                  )}
                </button>

                {canEdit && (
                  <button
                    onClick={() => setCategoryToDelete(category.name)}
                    className="opacity-0 group-hover:opacity-100 transition-all size-6 flex items-center justify-center rounded-full hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-300 hover:text-rose-500 -ml-2 mr-2 mb-3"
                    title="Excluir serviço"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                )}
              </div>
            );
          })}

          {projects.some(p => {
            const types = p.types || (p.type ? [p.type] : []);
            return types.length === 0 || types.includes('Sem categoria');
          }) && (
              <button
                onClick={() => setSelectedFilter('sem-categoria')}
                className={`flex items-center gap-2 px-4 pb-3 text-sm font-bold transition-all relative whitespace-nowrap ${selectedFilter === 'sem-categoria'
                  ? 'text-primary'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
              >
                <span className="material-symbols-outlined text-lg">help_outline</span>
                <span>Sem serviço</span>
                {selectedFilter === 'sem-categoria' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full shadow-[0_-1px_4px_rgba(var(--primary-rgb),0.3)]"></div>
                )}
              </button>
            )}

          {canEdit && (
            <button
              onClick={() => setShowAddCategory(true)}
              className="flex items-center gap-1.5 px-4 pb-3 text-sm font-bold text-primary hover:bg-primary/5 transition-all whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-lg">add_circle</span>
              <span>Novo Serviço</span>
            </button>
          )}
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className={viewMode === 'board'
          ? 'flex-1 overflow-x-auto overflow-y-hidden p-8 bg-slate-50 dark:bg-slate-900/20'
          : 'flex-1 overflow-y-auto p-8 bg-slate-50 dark:bg-slate-900/20'}
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
          // Helper para obter os tipos de um projeto (compatibilidade com projetos antigos)
          const getProjectTypesLocal = (project: Project): string[] => {
            if (project.types && project.types.length > 0) {
              return project.types;
            }
            return project.type ? [project.type] : [];
          };

          const filteredProjects = (() => {
            let projectsToFilter = projects;

            // 1. Filtro de Busca (Global)
            if (searchQuery && searchQuery.trim() !== '') {
              const query = searchQuery.toLowerCase().trim();
              projectsToFilter = projectsToFilter.filter(p =>
                p.name.toLowerCase().includes(query) ||
                p.client.toLowerCase().includes(query) ||
                (p.description && p.description.toLowerCase().includes(query)) ||
                (p.type && p.type.toLowerCase().includes(query)) ||
                (p.types && p.types.some(t => t.toLowerCase().includes(query)))
              );
            }

            return selectedFilter === 'all'
              ? projectsToFilter
              : selectedFilter === 'sem-categoria'
                ? projects.filter(p => {
                  const types = getProjectTypesLocal(p);
                  return types.length === 0 || types.includes('Sem categoria');
                })
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

                    // Verificar se ALGUM dos tipos do projeto corresponde à categoria selecionada
                    const projectTypes = getProjectTypesLocal(p);
                    return projectTypes.some(typeName => {
                      const projectTypeNormalized = normalizeString(typeName);

                      // Comparação exata primeiro (mais precisa)
                      if (projectTypeNormalized === categoryNameNormalized) {
                        return true;
                      }

                      // Comparação sem acentos também
                      const categoryNameNoAccent = selectedCategory.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                      const projectTypeNoAccent = typeName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                      if (projectTypeNoAccent === categoryNameNoAccent ||
                        projectTypeNoAccent.includes(categoryNameNoAccent) ||
                        categoryNameNoAccent.includes(projectTypeNoAccent)) {
                        return true;
                      }

                      // Fallback: verificar se contém o nome completo ou primeira palavra (com e sem acentos)
                      return projectTypeNormalized.includes(categoryNameNormalized) ||
                        categoryNameNormalized.includes(projectTypeNormalized) ||
                        projectTypeNormalized.includes(categoryNameNormalized.split(' ')[0]);
                    });
                  }
                  return true;
                });
          })();

          // Aplicar filtro de projetos concluídos/finalizados
          const finalFilteredProjects = showCompletedProjects
            ? filteredProjects
            : filteredProjects.filter(p => {
              // Verificar se está em etapa final
              const isCompleted = p.status === 'Completed';
              const isFinished = p.status === 'Finished';
              const projectTypes = getProjectTypesLocal(p);
              const isRecurring = projectTypes.some(typeName =>
                categories.find(cat => cat.name === typeName && cat.isRecurring)
              );
              // Manter projetos em Manutenção sempre visíveis
              // Se é recorrente e está Concluído, é considerado Manutenção (ativo)
              const isInMaintenance = isRecurring && isCompleted;

              if (isInMaintenance) {
                return true;
              }

              // Excluir apenas Finalizado e Concluído (que não está em Manutenção)
              return !(isFinished || (isCompleted && !isInMaintenance));
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

          const projectsForBoard = finalFilteredProjects.map(p => {
            // Verificar se ALGUM dos tipos do projeto é recorrente
            const projectTypes = getProjectTypesLocal(p);
            const isProjectRecurring = projectTypes.some(typeName =>
              categories.find(cat => cat.name === typeName && cat.isRecurring)
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
                    // Verificar se ALGUM dos tipos do projeto é recorrente
                    const pTypes = p.types || (p.type ? [p.type] : []);
                    const isProjectRecurring = pTypes.some(typeName =>
                      categories.find(cat => cat.name === typeName && cat.isRecurring)
                    );

                    if (selectedFilter === 'all') {
                      // Quando "Todos os Projetos" está selecionado:
                      if (isRecurringStage) {
                        // Para etapas recorrentes (Manutenção/Finalizado): 
                        // Mostrar apenas projetos recorrentes que estão nesse status
                        // E que NÃO foram movidos para etapas normais (não têm stageId de etapa fixa)
                        return isProjectRecurring && p.status === stage.status && !hasFixedStageId((p as any).stageId);
                      } else {
                        // Para etapas normais:
                        if (isProjectRecurring) {
                          // Projeto recorrente:
                          // 1. Se tem stageId de etapa fixa → mostrar na etapa correspondente
                          if (hasFixedStageId((p as any).stageId)) {
                            return matchesStageId((p as any).stageId, stage.id, (stage as any).originalId);
                          }
                          // 2. Se NÃO tem stageId (projeto recém-criado em Recorrência):
                          //    Mostrar na etapa normal correspondente ao status
                          //    EXCETO se o status for Completed (vai para Manutenção) ou Finished (vai para Finalizado)
                          if (!(p as any).stageId && p.status !== 'Completed' && p.status !== 'Finished') {
                            return p.status === stage.status;
                          }
                          return false;
                        } else {
                          // Projeto normal: filtrar por status OU stageId correspondente
                          // Prioriza stageId se existir, senão usa status
                          if ((p as any).stageId) {
                            return matchesStageId((p as any).stageId, stage.id, (stage as any).originalId);
                          }
                          return p.status === stage.status;
                        }
                      }
                    } else if (isSelectedCategoryRecurring) {
                      // Serviço recorrente selecionado: filtrar apenas por status
                      return p.status === stage.status;
                    } else {
                      // Serviço normal selecionado: filtrar por stageId (com match flexível)
                      return matchesStageId((p as any).stageId, stage.id, (stage as any).originalId);
                    }
                  });
                  return (
                    <StageColumn
                      canEdit={canEdit}
                      key={stage.id}
                      stage={stage}
                      index={index}
                      count={stageProjects.length}
                      projects={stageProjects}
                      allProjects={finalFilteredProjects}
                      isActive={stage.status === 'Active'}
                      selectedFilter={selectedFilter}
                      highlightedProjectId={highlightedProjectId}
                      onProjectClick={onProjectClick}
                      onDelete={setProjectToDelete}
                      onDrop={(project) => {
                        handleProjectDrop(project, stage as any);
                      }}
                      onStageDragStart={(stage) => setDraggedStage(stage as any)}
                      onStageDragEnd={() => setDraggedStage(null)}
                      onDeleteStage={(stage) => setStageToDelete(stage as any)}
                      onEditTasks={(stage) => setStageToEditTasks(stage as any)}
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
                                (p as any).stageId ? (p as any).stageId === draggedStage.id : p.status === draggedStage.status
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
                            saveStages(recalculated as any).catch(err => {
                              console.error("Error saving reordered stages:", err);
                            });
                          }
                        }
                      }}
                    />
                  );
                })}
              </div>
            );
          }

          if (viewMode === 'list') {
            return <ListView
              projects={finalFilteredProjects}
              onProjectClick={onProjectClick}
              stages={isSelectedCategoryRecurring
                ? recalculateStageProgress(currentFixedStages.map(s => ({ ...s, workspaceId: currentWorkspace?.id })))
                : stages}
              categories={categories}
            />;
          }
        })()
        }
      </div>

      {/* Modal Adicionar Projeto */}
      {showAddProject && (
        <AddProjectModal
          categories={categories}
          stages={isSelectedCategoryRecurring
            ? recalculateStageProgress(currentFixedStages.map(s => ({ ...s, workspaceId: currentWorkspace?.id })))
            : stages}
          workspaceId={currentWorkspace?.id}
          workspace={currentWorkspace}
          selectedFilter={selectedFilter}
          existingProjects={projects}
          userId={userId}
          onClose={handleCloseAddProject}
          onSave={async (projectData) => {
            try {
              // Verificar se algum dos tipos selecionados no projeto é recorrente
              const projectTypes = (projectData as any).types || (projectData.type ? [projectData.type] : []);
              const isProjectRecurring = projectTypes.some((typeName: string) => {
                const category = categories.find(cat => cat.name === typeName);
                return category?.isRecurring || false;
              });

              // Usar as etapas corretas baseado nos tipos do projeto
              const stagesForProject = isProjectRecurring
                ? recalculateStageProgress(currentFixedStages.map(s => ({ ...s, workspaceId: currentWorkspace?.id })))
                : stages;

              console.log('🔍 [Dashboard] Buscando etapa:', {
                projectDataStageId: projectData.stageId,
                projectDataStatus: projectData.status,
                isProjectRecurring,
                stagesForProjectIds: stagesForProject.map(s => ({ id: s.id, title: s.title, status: s.status }))
              });

              // Encontrar etapa pelo stageId se fornecido, ou pelo status
              let selectedStage = null;
              if (projectData.stageId) {
                selectedStage = stagesForProject.find(s => s.id === projectData.stageId);
                if (!selectedStage) {
                  console.warn('⚠️ [Dashboard] Etapa não encontrada pelo stageId, tentando pelo status');
                  selectedStage = stagesForProject.find(s => s.status === projectData.status);
                }
              } else {
                selectedStage = stagesForProject.find(s => s.status === projectData.status);
              }

              console.log('✅ [Dashboard] Etapa selecionada:', {
                selectedStageId: selectedStage?.id,
                selectedStageTitle: selectedStage?.title,
                selectedStageStatus: selectedStage?.status
              });

              // Se não encontrou a etapa mas temos um stageId, usar diretamente
              // Priorizar o stageId fornecido pelo usuário
              const finalStageId = projectData.stageId || selectedStage?.id || stagesForProject[0]?.id;
              // Se temos stageId mas não encontramos a etapa, usar o status do projectData ou buscar pela primeira etapa com mesmo status
              let finalStatus: Project['status'];
              if (selectedStage) {
                finalStatus = selectedStage.status as Project['status'];
              } else if (projectData.stageId && projectData.status) {
                // Se temos stageId mas não encontramos a etapa, usar o status fornecido
                finalStatus = projectData.status as Project['status'];
              } else {
                finalStatus = stagesForProject[0]?.status as Project['status'] || 'Lead';
              }
              const finalProgress = selectedStage?.progress || 0;

              console.log('💾 [Dashboard] Salvando projeto com:', {
                finalStageId,
                finalStatus,
                finalProgress,
                projectDataStageId: projectData.stageId,
                selectedStageFound: !!selectedStage
              });

              const newProject: Omit<Project, "id"> = {
                name: projectData.name || '',
                client: projectData.client || '',
                description: projectData.description || '',
                type: projectData.type || 'Sem categoria', // Mantendo valor interno como 'Sem categoria' para compatibilidade
                types: projectTypes.length > 0 ? projectTypes : undefined, // Array de tipos
                status: finalStatus,
                // Salvar o stageId selecionado, independente de ser recorrente ou não
                stageId: finalStageId,
                progress: finalProgress,
                tagColor: 'blue',
                // Usar avatar do cliente se existir, senão deixar vazio para mostrar placeholder
                avatar: (projectData as any).avatar || '',
                // projectImage sempre vazio ao criar - será exibido placeholder com bordas tracejadas
                projectImage: '',
                budget: projectData.budget || 0,
                isPaid: projectData.isPaid || false,
                // Vincular projeto ao cliente via clientId (para integração Asaas)
                clientId: (projectData as any).clientId,
              };
              const projectId = await addProjectToFirebase(newProject, currentWorkspace?.id, userId);

              // Verificar se é um projeto recorrente (usar a variável já calculada)
              if (isProjectRecurring && projectId) {
                // Para projetos recorrentes: criar faturas separadas para implementação e mensalidade
                const recurringAmount = (projectData as any).recurringAmount || 0;
                const recurringFirstDate = (projectData as any).recurringFirstDate || '';
                const implementationBudget = projectData.budget || 0; // Valor da implementação
                const parcelas = (projectData as any).parcelas || 1; // Número de parcelas da implementação
                const year = new Date().getFullYear();

                console.log('🔄 [Dashboard] Criando faturas para projeto recorrente:', {
                  projectId,
                  recurringAmount,
                  recurringFirstDate,
                  implementationBudget,
                  parcelas
                });

                // 1. Criar faturas de implementação parceladas (se valor > 0)
                if (implementationBudget > 0) {
                  const valorParcela = implementationBudget / parcelas;

                  for (let i = 0; i < parcelas; i++) {
                    try {
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
                      }, userId);
                    } catch (invoiceError: any) {
                      // Ignorar erros de aborto (requisição cancelada) - não são críticos
                      if (invoiceError?.name !== 'AbortError' && invoiceError?.code !== 'cancelled') {
                        console.error(`Error creating implementation invoice ${i + 1}:`, invoiceError);
                      }
                    }
                  }
                }

                // 2. Criar fatura de mensalidade (se valor e data definidos) - SEM numeração de parcelas
                console.log('🔄 [Dashboard] Verificando condição para criar fatura de mensalidade:', {
                  recurringAmount,
                  recurringFirstDate,
                  condicaoAtendida: recurringAmount > 0 && recurringFirstDate
                });

                if (recurringAmount > 0 && recurringFirstDate) {
                  try {
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
                    }, userId);
                  } catch (invoiceError: any) {
                    // Ignorar erros de aborto (requisição cancelada) - não são críticos
                    if (invoiceError?.name !== 'AbortError' && invoiceError?.code !== 'cancelled') {
                      console.error("Error creating recurring invoice:", invoiceError);
                    }
                  }
                }

                // Restaurar o budget original (implementação) e salvar o recurringAmount (mensalidade)
                // O addInvoice sobrescreve o budget com a soma das faturas, então precisamos restaurar
                if (projectId) {
                  try {
                    await updateProjectInFirebase(projectId, {
                      budget: implementationBudget,
                      recurringAmount: recurringAmount
                    });
                  } catch (updateError: any) {
                    // Ignorar erros de aborto (requisição cancelada) - não são críticos
                    if (updateError?.name !== 'AbortError' && updateError?.code !== 'cancelled') {
                      console.error("Error updating project budget:", updateError);
                    }
                  }
                }
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
                  }, userId);
                }
              }

              // Fechar modal DEPOIS de todas as operações assíncronas serem concluídas
              handleCloseAddProject();

            } catch (error) {
              console.error("Error adding project:", error);
              // setIsSubmitting(false); // Removido pois não está definido neste escopo
              // Não fechar o modal em caso de erro para o usuário poder tentar novamente
              alert("Erro ao adicionar projeto. Verifique os dados e tente novamente.");
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
                await addCategoryToFirebase(categoryData.name, currentWorkspace?.id, categoryData.isRecurring, userId);
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
              // Atualizar projetos que usam esse serviço (considerando múltiplos tipos)
              const projectsToUpdate = projects.filter(p => {
                const pTypes = p.types || (p.type ? [p.type] : []);
                return pTypes.some(typeName =>
                  typeName.toLowerCase() === categoryToDelete.toLowerCase()
                );
              });

              // Atualizar cada projeto no Firebase (remover o serviço do array de tipos)
              for (const project of projectsToUpdate) {
                const currentTypes = project.types || (project.type ? [project.type] : []);
                const newTypes = currentTypes.filter(t =>
                  t.toLowerCase() !== categoryToDelete.toLowerCase()
                );
                await updateProjectInFirebase(project.id, {
                  types: newTypes.length > 0 ? newTypes : ['Sem categoria'],
                  type: newTypes[0] || 'Sem categoria' // Compatibilidade
                });
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
              alert("Erro ao adicionar serviço. Tente novamente.");
            }
          }}
        />
      )}

      {/* Modal Adicionar Nova Etapa */}

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
                      status: targetStage.status as any,
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
                      status: stage.status as any
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
          <div className={`flex items-center gap-3 px-5 py-4 rounded-xl shadow-xl border backdrop-blur-sm min-w-[360px] max-w-[480px] ${toast.type === 'success'
            ? 'bg-white/95 dark:bg-slate-900/95 border-emerald-200 dark:border-emerald-800/50'
            : 'bg-white/95 dark:bg-slate-900/95 border-amber-200 dark:border-amber-800/50'
            }`}>
            <div className={`flex-shrink-0 size-10 rounded-full flex items-center justify-center ${toast.type === 'success'
              ? 'bg-emerald-100 dark:bg-emerald-900/30'
              : 'bg-amber-100 dark:bg-amber-900/30'
              }`}>
              <span className={`material-symbols-outlined text-xl ${toast.type === 'success'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'
                }`}>
                {toast.type === 'success' ? 'check_circle' : 'warning'}
              </span>
            </div>
            <p className={`text-sm font-semibold flex-1 leading-relaxed ${toast.type === 'success'
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
  canEdit?: boolean;
}> = ({ stage, index, count, projects, allProjects, isActive, selectedFilter, highlightedProjectId, onProjectClick, onDelete, onDrop, onStageDragStart, onStageDragEnd, onStageDrop, onDeleteStage, onEditTasks, onMenuToggle, menuOpen, categories = [], canEdit = true }) => {
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
      className={`stage-column w-80 flex flex-col gap-3 p-3 rounded-2xl transition-all duration-200 ${isDraggingOver
        ? 'bg-primary/5 ring-2 ring-primary/20'
        : 'bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/50'
        } ${isStageDragging ? 'opacity-50' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        draggable={canEdit}
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
              canEdit={canEdit}
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

const Card: React.FC<{ project: Project; onClick?: () => void; onDelete?: (project: Project) => void; isHighlighted?: boolean; categories?: Category[]; canEdit?: boolean }> = ({ project, onClick, onDelete, isHighlighted, categories = [], canEdit = true }) => {
  const [isDragging, setIsDragging] = useState(false);
  const isRecurringProject = projectHasRecurringType(project, categories);
  const isMaintenanceProject = isRecurringProject && (project.stageId?.includes('maintenance') || project.status === 'Completed');
  const missingDateWarnings: string[] = [];

  if (isMaintenanceProject) {
    if (!project.maintenanceDate) missingDateWarnings.push('manuten��o');
    if (!project.reportDate) missingDateWarnings.push('relat�rio');
  } else if (!project.deadline) {
    missingDateWarnings.push('entrega');
  }

  // Helper para verificar se o projeto está em uma etapa final (não precisa de deadline)
  const isInFinalStage = () => {
    const isCompleted = project.status === 'Completed';
    const isFinished = project.status === 'Finished';
    const isMaintenanceStage = project.stageId?.includes('maintenance') || false;
    const projectTypes = project.types || (project.type ? [project.type] : []);
    const isRecurring = projectTypes.some(typeName =>
      categories.find(cat => cat.name === typeName && cat.isRecurring)
    );
    const isInMaintenance = isRecurring && isCompleted && isMaintenanceStage;

    // Retorna true se estiver em Finalizado, Concluído (não Manutenção), ou Manutenção/Gestão
    return isFinished || (isCompleted && !isInMaintenance) || isInMaintenance;
  };
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);

  // Helper para obter tipos do projeto, filtrando "Sem categoria" se houver outros tipos
  const getProjectTypes = (project: Project): string[] => {
    const types = project.types || (project.type ? [project.type] : []);
    // Se houver outros tipos além de "Sem categoria", remover "Sem categoria"
    const hasOtherTypes = types.some(t => t !== 'Sem categoria');
    if (hasOtherTypes) {
      return types.filter(t => t !== 'Sem categoria');
    }
    // Se só tiver "Sem categoria" ou estiver vazio, retornar ["Sem categoria"]
    return types.length > 0 ? types : ['Sem categoria'];
  };

  // Função auxiliar para determinar a cor da data baseada na proximidade
  const getDateColor = (dateString: string | undefined): string => {
    if (!dateString) return 'text-slate-500 dark:text-slate-400';

    const date = parseSafeDate(dateString);
    if (!date) return 'text-slate-500 dark:text-slate-400';
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
      draggable={canEdit}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      data-project-id={project.id}
      className={`group relative bg-white/70 dark:bg-slate-900/70 backdrop-blur-md p-5 rounded-2xl border transition-all duration-300 ${isHighlighted
        ? 'border-primary ring-4 ring-primary/10 shadow-2xl scale-[1.02]'
        : 'border-white/50 dark:border-slate-800/50 shadow-sm hover:shadow-xl hover:-translate-y-1'
        } ${isDragging ? 'opacity-50' : ''} ${isMouseDown ? 'cursor-grabbing' : 'cursor-pointer'}`}
    >
      {project.status === 'Active' && (
        <div className="absolute top-0 left-0 w-1.5 h-full bg-primary rounded-l-2xl" />
      )}
      <div className="flex justify-between items-start mb-4">
        <div className="flex flex-wrap gap-1.5">
          {getProjectTypes(project).slice(0, 2).map((typeName, idx) => (
            <span key={idx} className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${project.tagColor === 'amber' ? 'text-amber-600 bg-amber-500/10' :
              project.tagColor === 'blue' ? 'text-blue-600 bg-blue-500/10' :
                project.tagColor === 'emerald' ? 'text-emerald-600 bg-emerald-500/10' :
                  'text-primary bg-primary/10'
              }`}>
              {typeName}
            </span>
          ))}
        </div>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete?.(project);
          }}
          className="size-8 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all opacity-0 group-hover:opacity-100"
        >
          <span className="material-symbols-outlined text-[18px]">delete</span>
        </button>
      </div>
      <div className="flex items-center gap-4 mb-4">
        {project.projectImage ? (
          <div
            className="flex-shrink-0 size-12 rounded-xl bg-slate-200 shadow-inner overflow-hidden border border-white/20"
            style={{ backgroundImage: `url(${project.projectImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
          ></div>
        ) : (
          <div className="flex-shrink-0 size-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-600 group-hover:border-primary transition-colors">
            <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 text-xl">add_photo_alternate</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h4 className="font-display font-black text-slate-900 dark:text-white text-base leading-tight group-hover:text-primary transition-colors">{project.name}</h4>
          <p className="text-xs text-slate-500 font-bold mt-0.5">{project.client}</p>
        </div>
      </div>

      {/* Verificar se é projeto recorrente (considerando múltiplos tipos) */}
      {(() => {
        const pTypes = project.types || (project.type ? [project.type] : []);
        const isRecurring = pTypes.some(typeName =>
          categories.find(cat => cat.name === typeName && cat.isRecurring)
        );

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

      {project.progress >= 10 && (
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

      {project.deadline && !['review', 'review-recurring', 'maintenance-recurring', 'finished-recurring', 'completed'].includes(project.stageId || '') ? (() => {
        const date = parseSafeDate(project.deadline);
        if (!date) return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const deadline = new Date(date);
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
              {parseSafeDate(project.deadline)?.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </span>
          </div>
        );
      })() : (
        ((!isMaintenanceProject && !['review', 'review-recurring', 'maintenance-recurring', 'finished-recurring', 'completed'].includes(project.stageId || '') && !isInFinalStage()) ||
          (isMaintenanceProject && missingDateWarnings.length > 0)) ? (
          <div className="flex items-center gap-1.5 mb-3 px-2 py-1 rounded bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/50">
            <span className="material-symbols-outlined text-sm text-rose-600 dark:text-rose-400 animate-pulse">warning</span>
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 animate-pulse">
              {isMaintenanceProject
                ? `Definir data${missingDateWarnings.length > 1 ? 's' : ''} de ${missingDateWarnings.join(' e ')}`
                : 'Definir data de entrega'}
            </span>
          </div>
        ) : null
      )}

      {/* Datas de Manutenção e Relatório para projetos recorrentes em Manutenção */}
      {(() => {
        const pTypesForMaint = project.types || (project.type ? [project.type] : []);
        const isRecurringService = pTypesForMaint.some(typeName =>
          categories.find(cat => cat.name === typeName && cat.isRecurring)
        );
        const isInMaintenance = isRecurringService && project.status === 'Completed';

        if (!isInMaintenance || (!project.maintenanceDate && !project.reportDate)) return null;

        return (
          <div className="space-y-2 mb-3">
            {project.maintenanceDate && (
              <div className={`flex items-center gap-1.5 text-xs font-semibold ${getDateColor(project.maintenanceDate)}`}>
                <span className={`material-symbols-outlined text-sm ${getDateColor(project.maintenanceDate)}`}>build</span>
                <span>
                  Manutenção: {parseSafeDate(project.maintenanceDate)?.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
              </div>
            )}
            {project.reportDate && (
              <div className={`flex items-center gap-1.5 text-xs font-semibold ${getDateColor(project.reportDate)}`}>
                <span className={`material-symbols-outlined text-sm ${getDateColor(project.reportDate)}`}>description</span>
                <span>
                  Relatório: {parseSafeDate(project.reportDate)?.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
};

const ListView: React.FC<{
  projects: Project[];
  onProjectClick?: (project: Project) => void;
  stages: Stage[];
  categories: Category[];
}> = ({ projects, onProjectClick, stages, categories }) => {
  const [sortColumn, setSortColumn] = useState<string | null>('prazo'); // Ordenação padrão por prazo
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc'); // Mais próximos primeiro

  // Helper para obter tipos do projeto, filtrando "Sem categoria" se houver outros tipos
  const getProjectTypes = (project: Project): string[] => {
    const types = project.types || (project.type ? [project.type] : []);
    // Se houver outros tipos além de "Sem categoria", remover "Sem categoria"
    const hasOtherTypes = types.some(t => t !== 'Sem categoria');
    if (hasOtherTypes) {
      return types.filter(t => t !== 'Sem categoria');
    }
    // Se só tiver "Sem categoria" ou estiver vazio, retornar ["Sem categoria"]
    return types.length > 0 ? types : ['Sem categoria'];
  };

  // Helper para verificar se o projeto está em uma etapa final (não precisa de deadline)
  const isInFinalStage = (project: Project) => {
    const isCompleted = project.status === 'Completed';
    const isFinished = project.status === 'Finished';
    const isMaintenanceStage = project.stageId?.includes('maintenance') || false;
    const projectTypes = project.types || (project.type ? [project.type] : []);
    const isRecurring = projectTypes.some(typeName =>
      categories.find(cat => cat.name === typeName && cat.isRecurring)
    );
    const isInMaintenance = isRecurring && isCompleted && isMaintenanceStage;

    // Retorna true se estiver em Finalizado, Concluído (não Manutenção), ou Manutenção/Gestão
    return isFinished || (isCompleted && !isInMaintenance) || isInMaintenance;
  };

  // Helper para verificar se o projeto está na etapa de Manutenção
  const isMaintenanceStage = (project: Project) => {
    return project.stageId?.includes('maintenance') || project.status === 'Completed';
  };

  // Helper para verificar se o projeto está na etapa de Relatório (assumindo que é parte da manutenção ou um status específico)
  const isReportStage = (project: Project) => {
    // Pode ser um stageId específico ou um status que indica a necessidade de relatório
    return project.stageId?.includes('report') || project.status === 'Review'; // Exemplo: se 'Review' significa que um relatório está sendo gerado
  };

  const getMissingDateWarnings = (project: Project): string[] => {
    const isRecurringProject = projectHasRecurringType(project, categories);
    const isMaintenanceProject = isRecurringProject && (project.stageId?.includes('maintenance') || project.status === 'Completed');
    const warnings: string[] = [];

    if (isMaintenanceProject) {
      if (!project.maintenanceDate) warnings.push('manuten��o');
      if (!project.reportDate) warnings.push('relat�rio');
      return warnings;
    }

    if (!project.deadline) {
      warnings.push('entrega');
    }

    return warnings;
  };

  // Obter label do status - usar título da etapa se disponível (definido antes do useMemo)
  const getStatusLabel = (project: Project) => {
    const stageId = project.stageId || '';
    const pTypes = getProjectTypes(project);
    const isRecurring = pTypes.some(typeName =>
      categories.find(cat => cat.name === typeName && cat.isRecurring)
    );

    // 1. Caso especial: Gestão (Recorrência + Concluído + Estágio de manutenção)
    if (isRecurring && project.status === 'Completed' && (stageId.includes('maintenance') || stageId === 'management')) {
      return 'Gestão';
    }

    // 2. Caso especial: Ajustes
    if (stageId.includes('adjustments')) {
      return 'Ajustes';
    }

    // 3. Prioridade: Se houver um stageId, tenta usar o título daquela etapa específica
    const stage = stages.find(s => s.id === project.stageId);
    if (stage) return stage.title;

    // 4. Fallback baseado no status
    switch (project.status) {
      case 'Lead': return 'On boarding';
      case 'Active': return 'Em desenvolvimento';
      case 'Review': return 'Em Revisão';
      case 'Completed': return 'Concluído';
      case 'Finished': return 'Finalizado';
      default: return project.status;
    }
  };

  // Função de ordenação
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Ordenar projetos
  const sortedProjects = useMemo(() => {
    if (!sortColumn) return projects;

    const sorted = [...projects].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case 'projeto':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'cliente':
          aValue = a.client.toLowerCase();
          bValue = b.client.toLowerCase();
          break;
        case 'servico':
          aValue = getProjectTypes(a).join(', ').toLowerCase();
          bValue = getProjectTypes(b).join(', ').toLowerCase();
          break;
        case 'status':
          aValue = getStatusLabel(a).toLowerCase();
          bValue = getStatusLabel(b).toLowerCase();
          break;
        case 'progresso':
          aValue = a.progress || 0;
          bValue = b.progress || 0;
          break;
        case 'prazo': {
          const getWeight = (project: Project) => {
            const stageId = (project as any).stageId || '';
            const pTypes = project.types || (project.type ? [project.type] : []);
            const isRec = pTypes.some(typeName =>
              categories.find(cat => cat.name === typeName && cat.isRecurring)
            );

            // 1. On-boarding (Weight 0)
            if (stageId.includes('onboarding') || project.status === 'Lead') return 0;

            // 2. Desenvolvimento (Weight 1)
            if (stageId.includes('development') || (project.status === 'Active' && !stageId.includes('adjustments'))) return 1;

            // 3. Ajustes (Weight 2)
            if (stageId.includes('adjustments')) return 2;

            // 4. Em Revisão (Weight 3)
            if ((project.status === 'Review' || stageId.includes('review')) && !stageId.includes('adjustments')) return 3;

            // 5. Gestão (Weight 4)
            if (isRec && project.status === 'Completed' && stageId.includes('maintenance')) return 4;

            // 6. Concluído (Weight 5)
            if (project.status === 'Completed' || project.status === 'Finished' || stageId.includes('completed') || stageId.includes('finished')) return 5;

            return 6;
          };

          const weightA = getWeight(a);
          const weightB = getWeight(b);

          if (weightA !== weightB) {
            return sortDirection === 'asc' ? weightA - weightB : weightB - weightA;
          }

          // Se estiver no mesmo peso (mesma etapa), usa a data como critério de desempate
          const timeA = a.deadline ? parseSafeDate(a.deadline)?.getTime() || Infinity : Infinity;
          const timeB = b.deadline ? parseSafeDate(b.deadline)?.getTime() || Infinity : Infinity;

          if (timeA === timeB) return a.name.localeCompare(b.name);
          return sortDirection === 'asc' ? timeA - timeB : timeB - timeA;
        }
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [projects, sortColumn, sortDirection, categories, stages, getStatusLabel, getProjectTypes]);

  // Componente para renderizar seta de ordenação
  const SortArrow = ({ column }: { column: string }) => {
    if (sortColumn !== column) {
      return (
        <span className="material-symbols-outlined text-slate-300 text-sm ml-1">unfold_more</span>
      );
    }
    return (
      <span className={`material-symbols-outlined text-primary text-sm ml-1 ${sortDirection === 'asc' ? '' : 'rotate-180'}`}>
        arrow_drop_down
      </span>
    );
  };

  return (
    <div className="max-w-6xl mx-auto py-8">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto">
          <table className="w-full text-left table-fixed">
            <colgroup>
              <col className="w-[22%]" />
              <col className="w-[15%]" />
              <col className="w-[18%]" />
              <col className="w-[15%]" />
              <col className="w-[15%]" />
              <col className="w-[15%]" />
            </colgroup>
            <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10">
              <tr>
                <th
                  className="px-6 py-4 text-[13px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => handleSort('projeto')}
                >
                  <div className="flex items-center">
                    Projeto
                    <SortArrow column="projeto" />
                  </div>
                </th>
                <th
                  className="px-6 py-4 text-[13px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => handleSort('cliente')}
                >
                  <div className="flex items-center">
                    Cliente
                    <SortArrow column="cliente" />
                  </div>
                </th>
                <th
                  className="px-6 py-4 text-[13px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => handleSort('servico')}
                >
                  <div className="flex items-center">
                    Serviço
                    <SortArrow column="servico" />
                  </div>
                </th>
                <th
                  className="px-6 py-4 text-[13px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center">
                    Status
                    <SortArrow column="status" />
                  </div>
                </th>
                <th
                  className="px-6 py-4 text-[13px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => handleSort('progresso')}
                >
                  <div className="flex items-center">
                    Progresso
                    <SortArrow column="progresso" />
                  </div>
                </th>
                <th
                  className="px-6 py-4 text-[13px] font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => handleSort('prazo')}
                >
                  <div className="flex items-center">
                    Prazo
                    <SortArrow column="prazo" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sortedProjects.map((project) => (
                <tr
                  key={project.id}
                  onClick={() => onProjectClick?.(project)}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4 overflow-hidden">
                    <div className="flex items-center gap-3 min-w-0">
                      {project.projectImage ? (
                        <div className="flex-shrink-0 size-10 rounded-lg bg-slate-200" style={{ backgroundImage: `url(${project.projectImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
                      ) : (
                        <div className="flex-shrink-0 size-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-600">
                          <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 text-lg">add_photo_alternate</span>
                        </div>
                      )}
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <p className="text-sm font-bold truncate">{project.name}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{project.client}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 overflow-hidden">
                    <span className="text-sm truncate block">{project.client}</span>
                  </td>
                  <td className="px-6 py-4 overflow-hidden">
                    <div className="flex flex-wrap gap-1 whitespace-nowrap">
                      {getProjectTypes(project).slice(0, 2).map((typeName, idx) => (
                        <span key={idx} className="text-[10px] font-semibold uppercase tracking-[0.05em] inline-block text-slate-400 dark:text-slate-500">
                          {typeName}
                        </span>
                      ))}
                      {(getProjectTypes(project).length > 2) && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-1 py-1 rounded text-slate-500 bg-slate-100 dark:bg-slate-800">
                          +{getProjectTypes(project).length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 overflow-hidden">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold inline-block truncate max-w-full ${getStatusLabel(project) === 'Gestão'
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' :
                      getStatusLabel(project) === 'Ajustes' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        getStatusLabel(project) === 'On boarding' ? 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300' :
                          getStatusLabel(project) === 'Em desenvolvimento' ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary' :
                            getStatusLabel(project) === 'Em Revisão' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                              getStatusLabel(project) === 'Concluído' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                getStatusLabel(project) === 'Finalizado' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                                  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                      }`}>
                      {getStatusLabel(project)}
                    </span>
                  </td>
                  <td className="px-6 py-4 overflow-hidden">
                    {project.progress >= 10 ? (
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
                    <div className="flex flex-col gap-1 min-w-0">
                      {/* Prazo Principal (Deadline) */}
                      {project.deadline && !['review', 'review-recurring', 'maintenance-recurring', 'finished-recurring', 'completed'].includes(project.stageId || '') ? (() => {
                        const date = parseSafeDate(project.deadline);
                        if (!date) return null;

                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const deadline = new Date(date);
                        deadline.setHours(0, 0, 0, 0);

                        const diffTime = deadline.getTime() - today.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                        let deadlineColor = '';
                        if (project.status === 'Completed') {
                          deadlineColor = 'text-emerald-600 dark:text-emerald-400';
                        } else if (diffDays < 0) {
                          deadlineColor = 'text-rose-600 dark:text-rose-400 font-bold';
                        } else if (diffDays === 0 || diffDays === 1) {
                          deadlineColor = 'text-amber-600 dark:text-amber-400 font-bold';
                        } else {
                          deadlineColor = 'text-slate-500 dark:text-slate-400';
                        }

                        return (
                          <div className={`flex items-center gap-1 min-w-0 ${deadlineColor}`} title="Prazo de Entrega">
                            <span className="material-symbols-outlined text-sm flex-shrink-0">schedule</span>
                            <span className="text-xs truncate whitespace-nowrap">
                              {date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </span>
                          </div>
                        );
                      })() : null}

                      {/* Datas de Recorrência (Manutenção e Relatório) */}
                      {projectHasRecurringType(project, categories) && (
                        <>
                          {project.maintenanceDate && (() => {
                            const date = parseSafeDate(project.maintenanceDate);
                            if (!date) return null;
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                            const isLate = dateOnly < today;
                            return (
                              <div className={`flex items-center gap-1 min-w-0 ${isLate ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'}`} title="Data da Manutenção">
                                <span className="material-symbols-outlined text-[14px] flex-shrink-0">build</span>
                                <span className="text-[10px] font-bold truncate whitespace-nowrap">
                                  Manutenção: {date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                </span>
                              </div>
                            );
                          })()}
                          {project.reportDate && (() => {
                            const date = parseSafeDate(project.reportDate);
                            if (!date) return null;
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                            const isLate = dateOnly < today;
                            return (
                              <div className={`flex items-center gap-1 min-w-0 ${isLate ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`} title="Data do Relatório">
                                <span className="material-symbols-outlined text-[14px] flex-shrink-0">description</span>
                                <span className="text-[10px] font-bold truncate whitespace-nowrap">
                                  Relatório: {date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                </span>
                              </div>
                            );
                          })()}
                        </>
                      )}

                      {/* Aviso de datas pendentes */}
                      {(() => {
                        const missingDateWarnings = getMissingDateWarnings(project);
                        const isMaintenanceProject = projectHasRecurringType(project, categories) && (project.stageId?.includes('maintenance') || project.status === 'Completed');
                        const shouldShowWarning = isMaintenanceProject
                          ? missingDateWarnings.length > 0
                          : missingDateWarnings.length > 0 && !isInFinalStage(project);

                        return shouldShowWarning ? (
                          <div className="flex items-center gap-1 text-rose-500 animate-pulse">
                            <span className="material-symbols-outlined text-sm flex-shrink-0">warning</span>
                            <span className="text-[10px] font-bold uppercase whitespace-nowrap">
                              {isMaintenanceProject
                                ? `Definir data${missingDateWarnings.length > 1 ? 's' : ''}`
                                : 'Definir data'}
                            </span>
                          </div>
                        ) : (!project.deadline && !project.maintenanceDate && !project.reportDate ? (
                          <span className="text-xs text-slate-400">-</span>
                        ) : null);
                      })()}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const TimelineView: React.FC<{ projects: Project[]; onProjectClick?: (project: Project) => void; categories?: Category[]; stages?: Stage[] }> = ({ projects, onProjectClick, categories = [], stages = [] }) => {
  // Helper para obter tipos do projeto, filtrando "Sem categoria" se houver outros tipos
  const getProjectTypes = (project: Project): string[] => {
    const types = project.types || (project.type ? [project.type] : []);
    // Se houver outros tipos além de "Sem categoria", remover "Sem categoria"
    const hasOtherTypes = types.some(t => t !== 'Sem categoria');
    if (hasOtherTypes) {
      return types.filter(t => t !== 'Sem categoria');
    }
    // Se só tiver "Sem categoria" ou estiver vazio, retornar ["Sem categoria"]
    return types.length > 0 ? types : ['Sem categoria'];
  };

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
        const date = parseSafeDate(project.deadline);
        if (!date) return;
        const deadline = new Date(date);
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
        const date = parseSafeDate(project.deadline);
        if (!date) return;
        const deadline = new Date(date);
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
      endDate = new Date(project.deadline);
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

  // Obter label do status - usar título da etapa se disponível
  const getStatusLabel = (project: Project) => {
    // Verificar etapa baseado no stageId
    const isMaintenanceStage = project.stageId?.includes('maintenance') || false;

    // Verificar se é projeto recorrente
    const pTypesForLabel = project.types || (project.type ? [project.type] : []);
    const isRecurringService = pTypesForLabel.some(typeName =>
      categories.find(cat => cat.name === typeName && cat.isRecurring)
    );

    // Se for serviço recorrente e estiver na etapa Manutenção, mostrar "Gestão"
    if (isRecurringService && project.status === 'Completed' && isMaintenanceStage) {
      return 'Gestão';
    }

    // Buscar a etapa correspondente ao status do projeto
    const currentStage = stages.find(stage => stage.status === project.status);

    if (currentStage) {
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

  // Obter cor do status - retornar azul para "Gestão"
  const getStatusColorForLabel = (project: Project) => {
    const label = getStatusLabel(project);
    if (label === 'Gestão') return 'blue';
    return getStatusColor(project.status, project.tagColor);
  };

  return (
    <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-900/20">
      <div className="min-w-[1200px]">
        <div className="sticky top-0 z-10 flex bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="w-64 flex-shrink-0 p-4 border-r border-slate-200 dark:border-slate-800 font-bold text-xs uppercase tracking-wider text-slate-400">Projetos / Clientes</div>
          <div className="flex-1 flex">
            {days.map((day, i) => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const isDayToday = day.date.getTime() === today.getTime();

              // Calcular posição da linha baseado no horário atual (0-100px)
              const now = new Date();
              const minutesInDay = (now.getHours() * 60) + now.getMinutes();
              const positionX = (minutesInDay / 1440) * 100;

              return (
                <div
                  key={i}
                  className={`w-[100px] flex-shrink-0 text-center border-r flex items-center justify-center relative ${isDayToday
                    ? 'bg-slate-50/30 dark:bg-slate-800/10 border-r-slate-100 dark:border-r-slate-800/50'
                    : 'border-slate-100 dark:border-slate-800/50'
                    }`}
                >
                  {/* Bolinha única no topo */}
                  {isDayToday && (
                    <div
                      className="absolute -bottom-1 size-2 rounded-full bg-primary z-30 shadow-sm"
                      style={{ left: `${positionX - 4}px` }}
                    ></div>
                  )}
                  <div className="flex flex-col items-center justify-center py-2">
                    <span className={`block text-[9px] font-bold leading-tight uppercase ${isDayToday ? 'text-primary' : 'text-slate-400 dark:text-slate-500'}`}>
                      {day.label.split(' ')[0]}
                    </span>
                    <span className={`flex items-center justify-center size-7 text-sm font-black tracking-tight rounded-full transition-all ${isDayToday
                      ? 'bg-primary text-white shadow-sm shadow-primary/20'
                      : 'text-slate-900 dark:text-white'
                      }`}>
                      {day.label.split(' ')[1]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {projects.filter(project => project.deadline).map((project) => {
            const { startColumn, duration } = getProjectPosition(project);
            const statusColor = getStatusColorForLabel(project);
            const isLate = project.deadline && new Date(project.deadline) < new Date() && project.status !== 'Completed';

            // Calcular progresso temporal baseado nas datas (até a deadline)
            // O progresso começa a contar a partir da data em que o deadline foi definido
            let temporalProgress = 0;
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (project.deadline) {
              const deadline = new Date(project.deadline);
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
                  <div className="flex flex-wrap gap-1">
                    {getProjectTypes(project).slice(0, 2).map((typeName, idx) => (
                      <span key={idx} className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded w-fit ${project.tagColor === 'amber' ? 'bg-amber-50 text-amber-600' :
                        project.tagColor === 'blue' ? 'bg-blue-50 text-blue-600' :
                          project.tagColor === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
                            project.tagColor === 'indigo' ? 'bg-indigo-50 text-indigo-600' :
                              'bg-blue-50 text-blue-600'
                        }`}>
                        {typeName}
                      </span>
                    ))}
                    {(getProjectTypes(project).length > 2) && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1 py-0.5 rounded text-slate-500 bg-slate-100 dark:bg-slate-800">
                        +{getProjectTypes(project).length - 2}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex-1 relative flex items-center h-20">
                  {/* Grid de colunas de fundo */}
                  <div className="absolute inset-0 flex">
                    {days.map((day, i) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const isDayToday = day.date.getTime() === today.getTime();

                      // Calcular posição da linha baseado no horário atual (0-100px)
                      const now = new Date();
                      const minutesInDay = (now.getHours() * 60) + now.getMinutes();
                      const positionX = (minutesInDay / 1440) * 100;

                      return (
                        <div
                          key={i}
                          className={`w-[100px] h-full border-r flex-shrink-0 relative ${isDayToday
                            ? 'bg-primary/[0.01] dark:bg-primary/[0.02] border-r-slate-100 dark:border-r-slate-800/50'
                            : 'border-slate-100 dark:border-slate-800/50'
                            }`}
                        >
                          {/* Linha vertical indicadora do horário atual */}
                          {isDayToday && (
                            <div
                              className="absolute inset-y-0 w-px bg-primary/40 z-20"
                              style={{ left: `${positionX}px` }}
                            >
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

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
                        className={`h-full absolute left-0 top-0 rounded-r transition-all z-0 ${statusColor === 'amber' ? 'bg-amber-500/40' :
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
                    <span className={`text-[10px] font-bold relative z-10 truncate flex-1 min-w-0 ${statusColor === 'amber' ? 'text-amber-700' :
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
  workspace?: Workspace | null;
  selectedFilter?: string;
  existingProjects?: Project[];
  userId?: string | null;
  onClose: () => void;
  onSave: (project: Partial<Project>) => Promise<void>
}> = ({ categories, stages, workspaceId, workspace, selectedFilter, existingProjects = [], userId, onClose, onSave }) => {
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

  // Determinar os tipos iniciais baseado no filtro selecionado
  const getInitialTypes = (): string[] => {
    if (selectedFilter && selectedFilter !== 'all' && selectedFilter !== 'sem-categoria') {
      const selectedCategory = categories.find(cat =>
        cat.name.toLowerCase().replace(/\s+/g, '-') === selectedFilter
      );
      return selectedCategory?.name ? [selectedCategory.name] : [];
    }
    return [];
  };

  const [formData, setFormData] = useState({
    name: '',
    client: '',
    description: '',
    types: getInitialTypes(), // Array de serviços selecionados
    type: getInitialType(), // Mantido para compatibilidade
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
  const [showTypesDropdown, setShowTypesDropdown] = useState(false);
  const typesDropdownRef = useRef<HTMLDivElement>(null);
  const typesButtonRef = useRef<HTMLButtonElement>(null);
  const [typesDropdownPosition, setTypesDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  // Etapas fixas para projetos normais (usando useMemo para evitar recriação)
  const fixedStagesNormal = useMemo<Stage[]>(() => [
    { id: 'onboarding', title: 'On boarding', status: 'Lead', order: 0, progress: 10, isFixed: true },
    { id: 'development', title: 'Em desenvolvimento', status: 'Active', order: 1, progress: 30, isFixed: true },
    { id: 'review', title: 'Em Revisão', status: 'Review', order: 2, progress: 50, isFixed: true },
    { id: 'adjustments', title: 'Ajustes', status: 'Review', order: 3, progress: 75, isFixed: true },
    { id: 'completed', title: 'Concluído', status: 'Completed', order: 4, progress: 100, isFixed: true }
  ], []);

  // Etapas fixas para projetos recorrentes (usando useMemo para evitar recriação)
  const fixedStagesRecurringModal = useMemo<Stage[]>(() => [
    { id: 'onboarding-recurring', title: 'On boarding', status: 'Lead', order: 0, progress: 10, isFixed: true },
    { id: 'development-recurring', title: 'Em desenvolvimento', status: 'Active', order: 1, progress: 25, isFixed: true },
    { id: 'review-recurring', title: 'Em Revisão', status: 'Review', order: 2, progress: 40, isFixed: true },
    { id: 'adjustments-recurring', title: 'Ajustes', status: 'Review', order: 3, progress: 55, isFixed: true },
    { id: 'maintenance-recurring', title: 'Manutenção', status: 'Completed', order: 4, progress: 80, isFixed: true },
    { id: 'finished-recurring', title: 'Finalizado', status: 'Finished', order: 5, progress: 100, isFixed: true }
  ], []);

  // Verificar se algum dos serviços selecionados é recorrente
  const isSelectedTypeRecurring = () => {
    return formData.types.some(typeName => {
      const category = categories.find(cat => cat.name === typeName);
      return category?.isRecurring || false;
    });
  };

  // Toggle de seleção de tipo
  const toggleTypeSelection = (typeName: string) => {
    setFormData(prev => {
      let newTypes: string[];

      if (prev.types.includes(typeName)) {
        // Removendo o serviço
        newTypes = prev.types.filter(t => t !== typeName && t !== 'Sem categoria');
        // Se não sobrar nenhum serviço, adicionar "Sem categoria"
        if (newTypes.length === 0) {
          newTypes = ['Sem categoria'];
        }
      } else {
        // Adicionando o serviço - remover "Sem categoria" se existir
        newTypes = [...prev.types.filter(t => t !== 'Sem categoria'), typeName];
      }

      // Atualizar type para compatibilidade (primeiro tipo selecionado)
      return { ...prev, types: newTypes, type: newTypes[0] || '' };
    });
  };
  // Estados para clientes completos
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const clientInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientAvatar, setClientAvatar] = useState<string>(''); // Avatar do cliente selecionado
  const clientManuallySelectedRef = useRef(false); // Flag para rastrear seleção manual

  // Estados para campos expandidos de cliente
  const [showClientFields, setShowClientFields] = useState(false);
  const [clientData, setClientData] = useState({
    email: '',
    cpfCnpj: '',
    phone: ''
  });

  // Estados para autocomplete de projetos
  const [availableProjectNames, setAvailableProjectNames] = useState<string[]>([]);
  const [showProjectSuggestions, setShowProjectSuggestions] = useState(false);
  const [filteredProjects, setFilteredProjects] = useState<string[]>([]);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const projectManuallySelectedRef = useRef(false); // Flag para rastrear seleção manual

  // Carregar clientes completos
  useEffect(() => {
    if (workspaceId) {
      getClients(workspaceId).then(clientsList => {
        setClients(clientsList);
        // Também manter lista de nomes para compatibilidade com sugestões
        const clientNames = clientsList.map(c => c.name);
        setFilteredClients(clientsList);
      });
    }
  }, [workspaceId]);

  // Carregar nomes de projetos existentes do workspace, filtrados por cliente selecionado
  useEffect(() => {
    let projectNames: string[] = [];

    if (selectedClient) {
      // Se há cliente selecionado, filtrar apenas projetos desse cliente
      projectNames = existingProjects
        .filter(p => {
          // Verificar se o projeto pertence ao cliente pelo nome ou pelo ID
          return (p.client && p.client.toLowerCase() === selectedClient.name.toLowerCase()) ||
            (p.clientId && p.clientId === selectedClient.id);
        })
        .map(p => p.name)
        .filter(Boolean);
    } else if (formData.client.trim()) {
      // Se há nome de cliente digitado mas não selecionado, filtrar por nome
      projectNames = existingProjects
        .filter(p => p.client && p.client.toLowerCase() === formData.client.toLowerCase())
        .map(p => p.name)
        .filter(Boolean);
    } else {
      // Se não há cliente, não mostrar nenhum projeto
      projectNames = [];
    }

    setAvailableProjectNames([...new Set(projectNames)]);
  }, [existingProjects, selectedClient, formData.client]);

  // Buscar avatar do cliente quando o cliente for selecionado
  useEffect(() => {
    if (formData.client.trim()) {
      // Priorizar avatar da entidade Client
      if (selectedClient) {
        // Se cliente completo tem avatar válido (excluir Picsum/fotos aleatórias), usar diretamente
        if (selectedClient.avatar && selectedClient.avatar.trim() !== '' && !selectedClient.avatar.includes('picsum.photos')) {
          setClientAvatar(selectedClient.avatar);
        } else {
          // Se não tem avatar no cliente, buscar em projetos existentes como fallback
          const clientProject = existingProjects.find(p =>
            (p.client === formData.client || p.clientId === selectedClient.id) &&
            p.avatar && p.avatar.trim() !== '' && !p.avatar.includes('picsum.photos')
          );
          if (clientProject) {
            setClientAvatar(clientProject.avatar);
          } else {
            // Sem foto: deixar vazio para mostrar ícone padrão (bordas listradas + personagem)
            setClientAvatar('');
          }
        }
      } else {
        // Buscar o primeiro projeto desse cliente que tenha avatar
        const clientProject = existingProjects.find(p =>
          p.client === formData.client && p.avatar && p.avatar.trim() !== '' && !p.avatar.includes('picsum.photos')
        );
        if (clientProject) {
          setClientAvatar(clientProject.avatar);
        } else {
          // Sem foto: deixar vazio para mostrar ícone padrão (bordas listradas + personagem)
          setClientAvatar('');
        }
      }
    } else {
      setClientAvatar(''); // Limpar avatar se cliente estiver vazio
    }
  }, [formData.client, existingProjects, selectedClient]);

  // Atualizar tipos quando categorias forem carregadas e selectedFilter estiver definido
  useEffect(() => {
    if (selectedFilter && selectedFilter !== 'all' && selectedFilter !== 'sem-categoria' && categories.length > 0) {
      const selectedCategory = categories.find(cat =>
        cat.name.toLowerCase().replace(/\s+/g, '-') === selectedFilter
      );
      if (selectedCategory && !formData.types.includes(selectedCategory.name)) {
        setFormData(prev => ({
          ...prev,
          types: [selectedCategory.name],
          type: selectedCategory.name
        }));
      }
    }
  }, [categories, selectedFilter]);

  // Fechar dropdown de tipos ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Verificar se clicou fora do botão E fora do dropdown
      const clickedOutsideButton = typesDropdownRef.current && !typesDropdownRef.current.contains(target);
      const clickedInsideDropdown = (target as HTMLElement).closest?.('[data-types-dropdown]');

      if (clickedOutsideButton && !clickedInsideDropdown) {
        setShowTypesDropdown(false);
        setTypesDropdownPosition(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calcular etapas disponíveis baseado nos serviços selecionados
  const availableStages = useMemo(() => {
    return isSelectedTypeRecurring()
      ? fixedStagesRecurringModal
      : fixedStagesNormal;
  }, [formData.types, categories]);

  // Atualizar stageId quando os tipos mudarem ou quando as etapas disponíveis mudarem
  useEffect(() => {
    if (availableStages.length > 0) {
      const currentStageExists = availableStages.some(s => s.id === formData.stageId);
      if (!currentStageExists) {
        setFormData(prev => ({
          ...prev,
          stageId: availableStages[0].id,
          status: availableStages[0].status as Project['status']
        }));
      }
    }
  }, [formData.types, availableStages]);

  // Funções de formatação
  const formatCpfCnpj = (value: string): string => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      // CPF: 000.000.000-00
      return numbers
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
      // CNPJ: 00.000.000/0000-00
      return numbers
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
    }
  };

  const formatPhone = (value: string): string => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 10) {
      // Telefone fixo: (00) 0000-0000
      return numbers
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4})(\d{1,4})$/, '$1-$2');
    } else {
      // Celular: (00) 00000-0000
      return numbers
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d{1,4})$/, '$1-$2');
    }
  };

  // Detectar se cliente existe e tem dados completos
  const previousClientIdRef = useRef<string | null>(null);
  useEffect(() => {
    const clientName = formData.client.trim();
    if (clientName) {
      // Buscar cliente por nome
      const foundClient = clients.find(c =>
        c.name.toLowerCase() === clientName.toLowerCase()
      );

      if (foundClient) {
        // Se o cliente mudou, limpar o campo de projeto para forçar nova seleção
        if (previousClientIdRef.current !== foundClient.id) {
          setFormData(prev => ({ ...prev, name: '' }));
          previousClientIdRef.current = foundClient.id;
        }
        setSelectedClient(foundClient);
        // Verificar se tem dados completos (email e CPF/CNPJ)
        const hasCompleteData = foundClient.email && foundClient.cpfCnpj;
        setShowClientFields(!hasCompleteData);

        // Se não tem dados completos, preencher campos com dados existentes
        if (!hasCompleteData) {
          setClientData({
            email: foundClient.email || '',
            cpfCnpj: foundClient.cpfCnpj || '',
            phone: foundClient.phone || foundClient.mobilePhone || ''
          });
        } else {
          // Limpar campos se cliente tem dados completos
          setClientData({ email: '', cpfCnpj: '', phone: '' });
        }
      } else {
        // Cliente não existe, mostrar campos para cadastro
        // Se havia um cliente selecionado antes, limpar o campo de projeto
        if (previousClientIdRef.current !== null) {
          setFormData(prev => ({ ...prev, name: '' }));
          previousClientIdRef.current = null;
        }
        setSelectedClient(null);
        setShowClientFields(true);
        setClientData({ email: '', cpfCnpj: '', phone: '' });
      }
    } else {
      // Se o campo de cliente foi limpo, também limpar o campo de projeto
      if (previousClientIdRef.current !== null) {
        setFormData(prev => ({ ...prev, name: '' }));
        previousClientIdRef.current = null;
      }
      setSelectedClient(null);
      setShowClientFields(false);
      setClientData({ email: '', cpfCnpj: '', phone: '' });
    }
  }, [formData.client, clients]);

  // Filter clients based on input
  useEffect(() => {
    if (formData.client.trim()) {
      const filtered = clients.filter(client =>
        client.name.toLowerCase().includes(formData.client.toLowerCase())
      );
      setFilteredClients(filtered);

      // Se foi selecionado manualmente, não mostrar dropdown
      if (clientManuallySelectedRef.current) {
        clientManuallySelectedRef.current = false; // Resetar flag
        setShowClientSuggestions(false);
      } else {
        // Se não foi selecionado manualmente e há resultados, mostrar sugestões
        if (filtered.length > 0) {
          // Só mostrar se o input estiver focado ou se houver múltiplos resultados
          const exactMatch = clients.find(c =>
            c.name.toLowerCase() === formData.client.toLowerCase()
          );
          // Se não for correspondência exata ou houver múltiplos resultados, mostrar
          if (!exactMatch || filtered.length > 1) {
            setShowClientSuggestions(true);
          } else {
            setShowClientSuggestions(false);
          }
        } else {
          setShowClientSuggestions(false);
        }
      }
    } else {
      setFilteredClients([]);
      setShowClientSuggestions(false);
      clientManuallySelectedRef.current = false; // Resetar quando limpar
    }
  }, [formData.client, clients]);

  // Filter project names based on input
  useEffect(() => {
    if (formData.name.trim()) {
      const filtered = availableProjectNames.filter(name =>
        name.toLowerCase().includes(formData.name.toLowerCase())
      );
      setFilteredProjects(filtered);

      // Se foi selecionado manualmente, não mostrar dropdown
      if (projectManuallySelectedRef.current) {
        projectManuallySelectedRef.current = false; // Resetar flag
        setShowProjectSuggestions(false);
      } else {
        // Se não foi selecionado manualmente e há resultados, mostrar sugestões
        if (filtered.length > 0) {
          // Só mostrar se o input estiver focado ou se houver múltiplos resultados
          const exactMatch = availableProjectNames.find(n =>
            n.toLowerCase() === formData.name.toLowerCase()
          );
          // Se não for correspondência exata ou houver múltiplos resultados, mostrar
          if (!exactMatch || filtered.length > 1) {
            setShowProjectSuggestions(true);
          } else {
            setShowProjectSuggestions(false);
          }
        } else {
          setShowProjectSuggestions(false);
        }
      }
    } else {
      setFilteredProjects([]);
      setShowProjectSuggestions(false);
      projectManuallySelectedRef.current = false; // Resetar quando limpar
    }
  }, [formData.name, availableProjectNames]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Verificar se o clique foi dentro do container do dropdown
      const clientContainer = clientInputRef.current;
      const projectContainer = projectInputRef.current;

      // Verificar se clicou dentro do container de cliente (incluindo dropdown)
      if (clientContainer && !clientContainer.contains(target)) {
        setShowClientSuggestions(false);
      }

      // Verificar se clicou dentro do container de projeto (incluindo dropdown)
      if (projectContainer && !projectContainer.contains(target)) {
        setShowProjectSuggestions(false);
      }
    };

    // Usar um pequeno delay para garantir que o onMouseDown execute primeiro
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
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

  // Validações
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateCpfCnpj = (cpfCnpj: string): boolean => {
    const numbers = cpfCnpj.replace(/\D/g, '');
    return numbers.length === 11 || numbers.length === 14;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.client && !isSubmitting) {
      // Validar campos de cliente apenas se preenchidos (não são obrigatórios)
      if (showClientFields) {
        // Validar email apenas se foi preenchido
        if (clientData.email && !validateEmail(clientData.email)) {
          alert('Por favor, insira um e-mail válido ou deixe o campo vazio.');
          return;
        }
        // Validar CPF/CNPJ apenas se foi preenchido
        if (clientData.cpfCnpj && !validateCpfCnpj(clientData.cpfCnpj)) {
          alert('Por favor, insira um CPF (11 dígitos) ou CNPJ (14 dígitos) válido, ou deixe o campo vazio.');
          return;
        }
      }

      setIsSubmitting(true);
      try {
        let clientId: string | undefined = undefined;

        // Criar ou atualizar cliente se necessário
        if (showClientFields && workspaceId) {
          if (selectedClient) {
            // Cliente existe mas não tem dados completos, atualizar
            // Preparar dados para atualização (sem campos undefined)
            const clientUpdates: any = {};
            if (clientData.email && clientData.email.trim()) {
              clientUpdates.email = clientData.email.trim();
            }
            if (clientData.cpfCnpj && clientData.cpfCnpj.trim()) {
              clientUpdates.cpfCnpj = clientData.cpfCnpj.replace(/\D/g, '');
            }
            if (clientData.phone && clientData.phone.trim()) {
              clientUpdates.phone = clientData.phone.replace(/\D/g, '');
            }

            if (Object.keys(clientUpdates).length > 0) {
              await updateClient(selectedClient.id, clientUpdates);
            }
            clientId = selectedClient.id;

            // Se Asaas estiver configurado e cliente não estiver vinculado, tentar criar no Asaas automaticamente
            // Só cria se tiver email e CPF/CNPJ (obrigatórios para Asaas)
            if (workspace?.asaasApiKey && !selectedClient.asaasCustomerId && clientData.email && clientData.cpfCnpj) {
              try {
                await createAsaasCustomer({
                  workspaceId: workspaceId,
                  clientId: selectedClient.id,
                  name: formData.client,
                  email: clientData.email,
                  cpfCnpj: clientData.cpfCnpj.replace(/\D/g, ''),
                  phone: clientData.phone,
                });
                console.log('✅ Cliente criado no Asaas automaticamente');
              } catch (error) {
                console.error('Erro ao criar cliente no Asaas (não crítico):', error);
                // Não bloquear criação do projeto se falhar criação no Asaas
              }
            }
          } else {
            // Cliente não existe, criar novo
            // Preparar dados do cliente (sem campos undefined)
            // Não gerar avatar automaticamente - deixar sem foto (aparecerá com bordas tracejadas)
            const clientToAdd: any = {
              name: formData.client,
              workspaceId: workspaceId,
            };

            // Adicionar campos opcionais apenas se tiverem valor
            if (clientData.email && clientData.email.trim()) {
              clientToAdd.email = clientData.email.trim();
            }
            if (clientData.cpfCnpj && clientData.cpfCnpj.trim()) {
              clientToAdd.cpfCnpj = clientData.cpfCnpj.replace(/\D/g, '');
            }
            if (clientData.phone && clientData.phone.trim()) {
              clientToAdd.phone = clientData.phone.replace(/\D/g, '');
            }

            const newClientId = await addClient(clientToAdd);
            clientId = newClientId;

            // Se Asaas estiver configurado, tentar criar no Asaas automaticamente
            // Só cria se tiver email e CPF/CNPJ (obrigatórios para Asaas)
            if (workspace?.asaasApiKey && clientData.email && clientData.cpfCnpj) {
              try {
                await createAsaasCustomer({
                  workspaceId: workspaceId,
                  clientId: newClientId,
                  name: formData.client,
                  email: clientData.email,
                  cpfCnpj: clientData.cpfCnpj.replace(/\D/g, ''),
                  phone: clientData.phone,
                });
                console.log('✅ Cliente criado no Asaas automaticamente');
              } catch (error) {
                console.error('Erro ao criar cliente no Asaas (não crítico):', error);
                // Não bloquear criação do projeto se falhar criação no Asaas
              }
            }
          }
        } else if (selectedClient && selectedClient.id) {
          // Cliente existe e tem dados completos, usar ID existente
          clientId = selectedClient.id;
        }

        // Incluir avatar do cliente se existir e o array de tipos
        // Se não houver tipos selecionados, usar array vazio (não adicionar "Sem categoria" automaticamente)
        const finalTypes = formData.types.length > 0
          ? formData.types.filter(t => t !== 'Sem categoria') // Remover "Sem categoria" se houver outros tipos
          : (formData.type && formData.type !== 'Sem categoria' ? [formData.type] : []);

        // Se realmente não houver nenhum tipo, adicionar "Sem categoria"
        const projectTypes = finalTypes.length > 0 ? finalTypes : ['Sem categoria'];

        const projectData: any = {
          ...formData,
          types: projectTypes,
          type: projectTypes[0] || '', // Primeiro tipo para compatibilidade
          stageId: formData.stageId, // Garantir que stageId seja passado
          clientId: clientId, // Vincular projeto ao cliente
        };

        // Adicionar avatar apenas se existir e for válido (nunca Picsum/fotos aleatórias)
        if (clientAvatar && clientAvatar.trim() !== '' && !clientAvatar.includes('picsum.photos')) {
          projectData.avatar = clientAvatar;
        }
        console.log('📝 [AddProjectModal] Enviando dados do projeto:', {
          stageId: projectData.stageId,
          status: projectData.status,
          types: projectData.types,
          clientId: projectData.clientId
        });
        await onSave(projectData as any);
        // Modal será fechado pelo onSave
      } catch (error) {
        console.error("Error in handleSubmit:", error);
        setIsSubmitting(false);
        alert('Erro ao criar projeto. Tente novamente.');
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
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Cliente</label>
            <div className="relative" ref={clientInputRef}>
              <input
                type="text"
                value={formData.client}
                onChange={(e) => {
                  // Resetar flag quando usuário começar a digitar
                  clientManuallySelectedRef.current = false;
                  setFormData({ ...formData, client: e.target.value });
                }}
                onFocus={() => {
                  if (formData.client.trim() && filteredClients.length > 0) {
                    setShowClientSuggestions(true);
                  }
                }}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary"
                placeholder="Nome do cliente"
                required
              />
              {showClientSuggestions && filteredClients.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                  {filteredClients.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // Marcar como selecionado manualmente
                        clientManuallySelectedRef.current = true;
                        // Atualizar o valor do cliente
                        setFormData(prev => ({ ...prev, client: client.name }));
                        // Fechar dropdown imediatamente
                        setShowClientSuggestions(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-b-0 text-slate-900 dark:text-white cursor-pointer"
                    >
                      {client.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Campos expandidos para cadastro de cliente */}
            {showClientFields && (
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-sm">info</span>
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                    Dados opcionais. Preencha E-mail e CPF/CNPJ para sincronizar automaticamente com Asaas e gerar faturas.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    E-mail <span className="text-xs text-slate-400">(opcional - necessário para Asaas)</span>
                  </label>
                  <input
                    type="email"
                    value={clientData.email}
                    onChange={(e) => setClientData({ ...clientData, email: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="email@exemplo.com (opcional)"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    CPF / CNPJ <span className="text-xs text-slate-400">(opcional - necessário para Asaas)</span>
                  </label>
                  <input
                    type="text"
                    value={clientData.cpfCnpj}
                    onChange={(e) => {
                      const formatted = formatCpfCnpj(e.target.value);
                      setClientData({ ...clientData, cpfCnpj: formatted });
                    }}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="000.000.000-00 ou 00.000.000/0000-00 (opcional)"
                    maxLength={18}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Telefone (opcional)
                  </label>
                  <input
                    type="text"
                    value={clientData.phone}
                    onChange={(e) => {
                      const formatted = formatPhone(e.target.value);
                      setClientData({ ...clientData, phone: formatted });
                    }}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary"
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                  />
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Nome da Empresa/Projeto</label>
            <div className="relative" ref={projectInputRef}>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => {
                  // Resetar flag quando usuário começar a digitar
                  projectManuallySelectedRef.current = false;
                  setFormData({ ...formData, name: e.target.value });
                }}
                onFocus={() => {
                  if (formData.name.trim() && filteredProjects.length > 0) {
                    setShowProjectSuggestions(true);
                  }
                }}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary"
                placeholder="Ex: Nome da Empresa ou Projeto"
                required
              />
              {showProjectSuggestions && filteredProjects.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                  {filteredProjects.map((projectName, index) => (
                    <button
                      key={index}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // Marcar como selecionado manualmente
                        projectManuallySelectedRef.current = true;
                        // Atualizar o valor do projeto
                        setFormData(prev => ({ ...prev, name: projectName }));
                        // Fechar dropdown imediatamente
                        setShowProjectSuggestions(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 last:border-b-0 cursor-pointer"
                    >
                      {projectName}
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
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary resize-none"
              placeholder="Descreva o projeto..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Serviços</label>
              <div className="relative" ref={typesDropdownRef}>
                <button
                  ref={typesButtonRef}
                  type="button"
                  onClick={() => {
                    if (!showTypesDropdown && typesButtonRef.current) {
                      const rect = typesButtonRef.current.getBoundingClientRect();
                      const viewportHeight = window.innerHeight;
                      const spaceBelow = viewportHeight - rect.bottom;
                      const dropdownHeight = Math.min(320, (categories.length + 1) * 44); // Altura estimada

                      // Se não houver espaço suficiente abaixo, abrir para cima
                      const shouldOpenUp = spaceBelow < dropdownHeight && rect.top > dropdownHeight;

                      setTypesDropdownPosition({
                        top: shouldOpenUp ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
                        left: rect.left,
                        width: rect.width
                      });
                    }
                    setShowTypesDropdown(!showTypesDropdown);
                  }}
                  className="w-full px-4 py-2.5 pr-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-left text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary cursor-pointer transition-all hover:border-primary/50"
                >
                  {formData.types.length > 0
                    ? (formData.types.length === 1
                      ? formData.types[0]
                      : `${formData.types.length} serviços selecionados`)
                    : 'Selecione os serviços'}
                </button>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <span className="material-symbols-outlined text-lg">{showTypesDropdown ? 'expand_less' : 'expand_more'}</span>
                </span>

                {/* Dropdown de seleção múltipla - Posição fixa para não ser cortado */}
                {showTypesDropdown && typesDropdownPosition && (
                  <div
                    data-types-dropdown
                    className="fixed bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-2xl overflow-hidden"
                    style={{
                      top: typesDropdownPosition.top,
                      left: typesDropdownPosition.left,
                      width: typesDropdownPosition.width,
                      zIndex: 9999,
                      maxHeight: '320px'
                    }}
                  >
                    <div className="max-h-[320px] overflow-y-auto">
                      {categories.map((category, index) => (
                        <label
                          key={category.id || index}
                          className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors border-b border-slate-100 dark:border-slate-800 last:border-b-0 ${formData.types.includes(category.name)
                            ? 'bg-primary/10'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={formData.types.includes(category.name)}
                            onChange={() => toggleTypeSelection(category.name)}
                            className="size-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                          />
                          <span className="text-sm flex-1">{category.name}</span>
                          {category.isRecurring && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded font-bold">
                              RECORRENTE
                            </span>
                          )}
                        </label>
                      ))}
                      <label
                        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${formData.types.includes('Sem categoria')
                          ? 'bg-primary/10'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                      >
                        <input
                          type="checkbox"
                          checked={formData.types.includes('Sem categoria')}
                          onChange={() => toggleTypeSelection('Sem categoria')}
                          className="size-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                        />
                        <span className="text-sm text-slate-500">Sem serviço</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Chips dos serviços selecionados */}
                {formData.types.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {formData.types.map((typeName, index) => {
                      const category = categories.find(c => c.name === typeName);
                      return (
                        <span
                          key={index}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase rounded ${category?.isRecurring
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            }`}
                        >
                          {typeName}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleTypeSelection(typeName);
                            }}
                            className="hover:opacity-70"
                          >
                            <span className="material-symbols-outlined text-xs">close</span>
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Etapa</label>
              <div className="relative">
                <select
                  value={formData.stageId}
                  onChange={(e) => {
                    const selectedStage = availableStages.find(s => s.id === e.target.value);
                    setFormData({
                      ...formData,
                      stageId: e.target.value,
                      status: selectedStage?.status as Project['status'] || 'Lead'
                    });
                  }}
                  className="w-full px-4 py-2.5 pr-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer transition-all hover:border-primary/50"
                >
                  {availableStages.length > 0 ? (
                    availableStages.map((stage) => (
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
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Nome do Serviço</label>
            <div className="relative group">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
                label
              </span>
              <input
                type="text"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none"
                placeholder="Ex: Marketing Digital, Landing Pages..."
                required
                autoFocus
              />
            </div>
          </div>

          <div
            onClick={() => setIsRecurring(!isRecurring)}
            className={`flex flex-col gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${isRecurring
              ? 'bg-primary/5 border-primary shadow-sm shadow-primary/10'
              : 'bg-slate-50 dark:bg-slate-800/50 border-transparent hover:border-slate-200 dark:hover:border-slate-700'
              }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`size-10 rounded-lg flex items-center justify-center transition-colors ${isRecurring ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                  }`}>
                  <span className="material-symbols-outlined">autorenew</span>
                </div>
                <div>
                  <h4 className={`text-sm font-bold ${isRecurring ? 'text-primary' : 'text-slate-700 dark:text-slate-200'}`}>
                    Serviço Recorrente
                  </h4>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Cobranças mensais e gestão contínua
                  </p>
                </div>
              </div>
              <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isRecurring ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'
                }`}>
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${isRecurring ? 'translate-x-6' : 'translate-x-1'
                    }`}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-8 py-2.5 text-sm font-black text-white bg-primary rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : 'hover:bg-primary/90'
                }`}
            >
              {isSubmitting ? 'Criando...' : 'Criar Serviço'}
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

