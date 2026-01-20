
import React, { useState, useEffect, useRef } from 'react';
import { Project } from '../types';
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
  saveStageTasks
} from '../firebase/services';

interface DashboardProps {
  onProjectClick?: (project: Project) => void;
}

type ViewMode = 'board' | 'list' | 'timeline';

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
}

// Função para recalcular progresso de todas as etapas
const recalculateStageProgress = (stages: Stage[]): Stage[] => {
  const totalStages = stages.length;
  if (totalStages === 0) return stages;
  
  return stages.map((stage, index) => {
    // Calcula progresso: (order / (total - 1)) * 100
    // Se só tem 1 etapa, progresso = 100%
    const progress = totalStages === 1 ? 100 : Math.round((index / (totalStages - 1)) * 100);
    
    // Determina status automaticamente baseado na posição
    let status: Project['status'] = 'Lead';
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

const defaultStages: Stage[] = [
  { id: 'lead', title: 'Leads (Proposta Enviada)', status: 'Lead', order: 0, progress: 0 },
  { id: 'active', title: 'Desenvolvimento Ativo', status: 'Active', order: 1, progress: 50 },
  { id: 'completed', title: 'Projetos Concluídos', status: 'Completed', order: 2, progress: 100 }
];

export const Dashboard: React.FC<DashboardProps> = ({ onProjectClick }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [categories, setCategories] = useState<string[]>(['Web Design', 'App Dev', 'Identidade Visual']);
  const [showAddProject, setShowAddProject] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showAddStage, setShowAddStage] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [stages, setStages] = useState<Stage[]>(recalculateStageProgress(defaultStages));
  const [loading, setLoading] = useState(true);
  const [draggedStage, setDraggedStage] = useState<Stage | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, scrollLeft: 0 });
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [stageMenuOpen, setStageMenuOpen] = useState<string | null>(null);
  const [stageToDelete, setStageToDelete] = useState<Stage | null>(null);
  const [stageToEditTasks, setStageToEditTasks] = useState<Stage | null>(null);
  const isInitialStagesLoad = useRef(true);
  const isDeletingStage = useRef(false);

  // Função para lidar com o drop de projeto
  const handleProjectDrop = async (project: Project, targetStage: Stage) => {
    if (project.status === targetStage.status) return;
    
    try {
      await updateProjectInFirebase(project.id, { 
        status: targetStage.status,
        progress: targetStage.progress
      });
    } catch (error) {
      console.error("Error updating project status:", error);
      alert("Erro ao mover projeto. Tente novamente.");
    }
  };

  // Carregar dados do Firebase
  useEffect(() => {
    setLoading(true);

    // Subscribe to real-time updates
    const unsubscribeProjects = subscribeToProjects((firebaseProjects) => {
      // Se houver projetos no Firebase, usa eles. Caso contrário, usa os dados mock
      if (firebaseProjects.length > 0) {
        setProjects(firebaseProjects);
      } else {
        // Primeira vez - usar dados mock
        setProjects(pipelineProjects);
      }
      setLoading(false);
    });

    const unsubscribeCategories = subscribeToCategories((firebaseCategories) => {
      setCategories(firebaseCategories);
    });

    const unsubscribeStages = subscribeToStages((firebaseStages) => {
      // Ignorar atualizações do subscribe durante exclusão (já atualizamos o estado local)
      if (isDeletingStage.current) {
        console.log("subscribeToStages: Ignorando atualização durante exclusão");
        return;
      }
      
      if (firebaseStages.length > 0) {
        const recalculated = recalculateStageProgress(firebaseStages);
        setStages(recalculated);
        isInitialStagesLoad.current = false;
      } else if (isInitialStagesLoad.current) {
        // Só criar etapas padrão na primeira vez (quando o Firebase está vazio)
        isInitialStagesLoad.current = false;
        const defaultStagesRecalculated = recalculateStageProgress(defaultStages);
        setStages(defaultStagesRecalculated);
        // Salvar etapas padrão no Firebase apenas na primeira vez
        saveStages(defaultStagesRecalculated).catch(err => {
          console.error("Error saving default stages:", err);
        });
      }
      // Se firebaseStages.length === 0 mas não é o load inicial, não fazer nada
      // (pode ser durante uma exclusão em andamento - o estado local já foi atualizado)
    });

    return () => {
      unsubscribeProjects();
      unsubscribeCategories();
      unsubscribeStages();
    };
  }, []);

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
            <button 
              onClick={() => setShowAddProject(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
            >
              <span className="material-symbols-outlined text-lg">add</span>
              <span>Novo Projeto</span>
            </button>
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
            <button 
              onClick={() => setViewMode('timeline')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                viewMode === 'timeline' 
                  ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Cronograma
            </button>
          </div>
          </div>
        </div>
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-8 items-center">
          <button 
            onClick={() => setSelectedFilter('all')}
            className={`border-b-2 pb-3 text-sm font-semibold transition-colors ${
              selectedFilter === 'all' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Todos os Projetos
          </button>
          {categories.map((category, index) => {
            const filterKey = category.toLowerCase().replace(/\s+/g, '-');
            return (
              <div key={index} className="flex items-center gap-1 group relative">
                <button 
                  onClick={() => setSelectedFilter(filterKey)}
                  className={`border-b-2 pb-3 text-sm font-semibold transition-colors ${
                    selectedFilter === filterKey 
                      ? 'border-primary text-primary' 
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {category}
                </button>
                <button
                  onClick={() => setCategoryToDelete(category)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity size-5 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-rose-500 pb-3"
                  title="Excluir categoria"
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
              Sem categoria
            </button>
          )}
          <button 
            onClick={() => setShowAddCategory(true)}
            className="flex items-center gap-1 border-b-2 border-transparent pb-3 text-sm font-semibold text-slate-500 hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            <span>Nova Categoria</span>
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
            ? projects.filter(p => p.type === 'Sem categoria')
            : projects.filter(p => {
                const selectedCategory = categories.find(cat => cat.toLowerCase().replace(/\s+/g, '-') === selectedFilter);
                if (selectedCategory) {
                  return p.type.toLowerCase().includes(selectedCategory.toLowerCase()) || 
                         p.type.toLowerCase().includes(selectedCategory.split(' ')[0].toLowerCase());
                }
                return true;
              });

          if (viewMode === 'board') {
            const sortedStages = [...stages].sort((a, b) => a.order - b.order);
            
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
                  const stageProjects = filteredProjects.filter(p => p.status === stage.status);
                  return (
                    <StageColumn 
                      key={stage.id}
                      stage={stage}
                      index={index}
                      count={stageProjects.length} 
                      projects={stageProjects}
                      allProjects={filteredProjects}
                      isActive={stage.status === 'Active'}
                      onProjectClick={onProjectClick}
                      onDrop={(project) => {
                        handleProjectDrop(project, stage);
                      }}
                      onStageDragStart={(stage) => setDraggedStage(stage)}
                      onStageDragEnd={() => setDraggedStage(null)}
                      onDeleteStage={(stage) => setStageToDelete(stage)}
                      onEditTasks={(stage) => setStageToEditTasks(stage)}
                      onMenuToggle={(stageId) => setStageMenuOpen(stageMenuOpen === stageId ? null : stageId)}
                      menuOpen={stageMenuOpen === stage.id}
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
                              // Atualizar todos os projetos que estavam na etapa arrastada
                              const projectsInStage = filteredProjects.filter(p => p.status === draggedStage.status);
                              
                              try {
                                // Atualizar todos os projetos no Firebase
                                if (projectsInStage.length > 0) {
                                  await Promise.all(
                                    projectsInStage.map(project =>
                                      updateProjectInFirebase(project.id, {
                                        status: updatedDraggedStage.status,
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
          
          if (viewMode === 'timeline') {
            return <TimelineView projects={filteredProjects} onProjectClick={onProjectClick} />;
          }
        })()}
      </div>

      {/* Modal Adicionar Projeto */}
      {showAddProject && (
        <AddProjectModal 
          categories={categories}
          onClose={() => setShowAddProject(false)}
          onSave={async (projectData) => {
            try {
              const newProject: Omit<Project, "id"> = {
                name: projectData.name || '',
                client: projectData.client || '',
                description: projectData.description || '',
                type: projectData.type || 'Sem categoria',
                status: projectData.status || 'Lead',
                progress: projectData.status === 'Active' ? 0 : projectData.status === 'Completed' ? 100 : 0,
                tagColor: 'blue',
                avatar: `https://picsum.photos/seed/${projectData.name}/40/40`,
              };
              await addProjectToFirebase(newProject);
              setShowAddProject(false);
            } catch (error) {
              console.error("Error adding project:", error);
              alert("Erro ao adicionar projeto. Tente novamente.");
            }
          }}
        />
      )}

      {/* Modal Adicionar Categoria */}
      {showAddCategory && (
        <AddCategoryModal 
          onClose={() => setShowAddCategory(false)}
          onSave={async (category) => {
            try {
              if (category && !categories.includes(category)) {
                await addCategoryToFirebase(category);
              }
              setShowAddCategory(false);
            } catch (error) {
              console.error("Error adding category:", error);
              alert("Erro ao adicionar categoria. Tente novamente.");
            }
          }}
        />
      )}

      {/* Modal Confirmar Exclusão de Categoria */}
      {categoryToDelete && (
        <DeleteCategoryModal
          categoryName={categoryToDelete}
          onClose={() => setCategoryToDelete(null)}
          onConfirm={async () => {
            try {
              // Atualizar projetos que usam essa categoria
              const projectsToUpdate = projects.filter(p => {
                const projectTypeLower = p.type.toLowerCase();
                const categoryLower = categoryToDelete.toLowerCase();
                return projectTypeLower.includes(categoryLower) || 
                       projectTypeLower.includes(categoryToDelete.split(' ')[0].toLowerCase());
              });

              // Atualizar cada projeto no Firebase
              for (const project of projectsToUpdate) {
                await updateProjectInFirebase(project.id, { type: 'Sem categoria' });
              }
              
              // Remove a categoria do Firebase
              await deleteCategoryFromFirebase(categoryToDelete);
              
              // Se a categoria excluída estava selecionada, volta para "Todos"
              const filterKey = categoryToDelete.toLowerCase().replace(/\s+/g, '-');
              if (selectedFilter === filterKey) {
                setSelectedFilter('all');
              }
              
              setCategoryToDelete(null);
            } catch (error) {
              console.error("Error deleting category:", error);
              alert("Erro ao excluir categoria. Tente novamente.");
            }
          }}
        />
      )}

      {/* Modal Adicionar Nova Etapa */}
      {showAddStage && (
        <AddStageModal
          onClose={() => setShowAddStage(false)}
          onSave={async (stageData) => {
            try {
              // Adicionar etapa diretamente no Firebase
              const newStageData: Omit<Stage, "id"> = {
                title: stageData.title,
                status: 'Lead', // Será recalculado
                order: stages.length,
                progress: 0 // Será recalculado
              };
              
              // Adicionar temporariamente para recalcular
              const tempStage: Stage = { id: 'temp', ...newStageData };
              const updatedStages = recalculateStageProgress([...stages, tempStage]);
              
              // Salvar todas as etapas atualizadas no Firebase (que vai gerar o ID correto)
              await saveStages(updatedStages);
              setShowAddStage(false);
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
                // Usar a primeira etapa disponível
                targetStage = sortedRemaining[0];
              }
              
              // Atualizar todos os projetos que estavam na etapa excluída
              const projectsInStage = projects.filter(p => p.status === stageToDelete.status);
              
              if (projectsInStage.length > 0) {
                await Promise.all(
                  projectsInStage.map(project =>
                    updateProjectInFirebase(project.id, {
                      status: targetStage.status,
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
            } catch (error) {
              console.error("Error deleting stage:", error);
              isDeletingStage.current = false;
              alert("Erro ao excluir etapa. Tente novamente.");
            }
          }          }
        />
      )}

      {/* Modal Definir Tarefas da Etapa */}
      {stageToEditTasks && (
        <DefineStageTasksModal
          stage={stageToEditTasks}
          onClose={() => setStageToEditTasks(null)}
        />
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
  onProjectClick?: (project: Project) => void;
  onDrop?: (project: Project, targetStage: Stage) => void;
  onStageDragStart?: (stage: Stage) => void;
  onStageDragEnd?: () => void;
  onStageDrop?: (targetStage: Stage) => void;
  onDeleteStage?: (stage: Stage) => void;
  onEditTasks?: (stage: Stage) => void;
  onMenuToggle?: (stageId: string) => void;
  menuOpen?: boolean;
}> = ({ stage, index, count, projects, allProjects, isActive, onProjectClick, onDrop, onStageDragStart, onStageDragEnd, onStageDrop, onDeleteStage, onEditTasks, onMenuToggle, menuOpen }) => {
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
      className={`stage-column w-80 flex flex-col gap-4 ${isDraggingOver ? 'bg-primary/5 border-2 border-primary/20' : ''} ${isStageDragging ? 'opacity-50' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div 
        draggable
        onDragStart={handleStageDragStart}
        onDragEnd={handleStageDragEnd}
        className="flex items-center justify-between px-1 cursor-move hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg p-1 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-slate-400 text-sm">drag_indicator</span>
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">{stage.title}</h3>
          <span className={`${isActive ? 'bg-primary/10 text-primary' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'} px-2 py-0.5 rounded-full text-[10px] font-bold`}>{count}</span>
        </div>
        <div className="relative stage-menu-container">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onMenuToggle?.(stage.id);
            }}
            className="material-symbols-outlined text-slate-400 hover:text-primary transition-colors"
          >
            more_horiz
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 z-50 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-lg min-w-[160px]">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditTasks?.(stage);
                  onMenuToggle?.(stage.id);
                }}
                className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">checklist</span>
                <span>Definir Tarefas</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteStage?.(stage);
                  onMenuToggle?.(stage.id);
                }}
                className="w-full px-4 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center gap-2 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
                <span>Excluir Etapa</span>
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 space-y-4 min-h-[200px]">
        {projects.map(project => (
          <Card 
            key={project.id} 
            project={project} 
            onClick={() => onProjectClick?.(project)} 
          />
        ))}
      </div>
    </div>
  );
};

const Card: React.FC<{ project: Project; onClick?: () => void }> = ({ project, onClick }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);

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
      onClick={handleClick}
      className={`bg-white dark:bg-slate-900 p-4 rounded-xl border ${project.status === 'Active' ? 'border-l-4 border-l-primary' : ''} border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all cursor-move group ${isDragging ? 'opacity-50' : ''}`}
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
      {project.status === 'Active' ? (
        <div className="bg-primary size-2 rounded-full animate-pulse"></div>
      ) : (
        <span className="material-symbols-outlined text-slate-300 group-hover:text-slate-500 transition-colors">edit</span>
      )}
    </div>
    <h4 className="font-bold text-slate-900 dark:text-white text-base mb-1">{project.name}</h4>
    <p className="text-xs text-slate-500 mb-3 line-clamp-2">{project.description}</p>
    
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

    <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-50 dark:border-slate-800">
      <div className="flex -space-x-2">
        <div className="size-6 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200" style={{ backgroundImage: `url(${project.avatar})`, backgroundSize: 'cover' }}></div>
      </div>
      {project.urgency ? (
        <div className="flex items-center gap-1 text-rose-500">
          <span className="material-symbols-outlined text-sm">priority_high</span>
          <span className="text-[10px] font-bold">Urgente</span>
        </div>
      ) : project.deadline ? (
        <div className="flex items-center gap-1 text-slate-400">
          <span className="material-symbols-outlined text-sm">schedule</span>
          <span className="text-[10px] font-medium">{project.deadline}</span>
        </div>
      ) : null}
    </div>
  </div>
  );
};

const ListView: React.FC<{ projects: Project[]; onProjectClick?: (project: Project) => void }> = ({ projects, onProjectClick }) => (
  <div className="max-w-6xl mx-auto">
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
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
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-lg bg-slate-200" style={{ backgroundImage: `url(${project.avatar})`, backgroundSize: 'cover' }}></div>
                    <div>
                      <p className="text-sm font-bold">{project.name}</p>
                      <p className="text-xs text-slate-500 line-clamp-1">{project.description}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm">{project.client}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded ${
                    project.tagColor === 'amber' ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' :
                    project.tagColor === 'blue' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' :
                    project.tagColor === 'emerald' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' :
                    'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                  }`}>
                    {project.type}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                    project.status === 'Lead' ? 'bg-amber-100 text-amber-700' :
                    project.status === 'Active' ? 'bg-primary/10 text-primary' :
                    project.status === 'Completed' ? 'bg-green-100 text-green-700' :
                    'bg-indigo-100 text-indigo-700'
                  }`}>
                    {project.status === 'Lead' ? 'Proposta Enviada' : 
                     project.status === 'Active' ? 'Em Desenvolvimento' :
                     project.status === 'Completed' ? 'Concluído' : 'Em Revisão'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {project.progress > 0 ? (
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className={`h-full ${project.tagColor === 'emerald' ? 'bg-emerald-500' : 'bg-primary'}`} style={{ width: `${project.progress}%` }}></div>
                      </div>
                      <span className="text-xs font-bold text-slate-500">{project.progress}%</span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  {project.deadline ? (
                    <div className="flex items-center gap-1 text-slate-400">
                      <span className="material-symbols-outlined text-sm">schedule</span>
                      <span className="text-xs">{project.deadline}</span>
                    </div>
                  ) : project.urgency ? (
                    <div className="flex items-center gap-1 text-rose-500">
                      <span className="material-symbols-outlined text-sm">priority_high</span>
                      <span className="text-xs font-bold">Urgente</span>
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
  const weeks = ['JAN 01', 'JAN 08', 'JAN 15', 'JAN 22', 'FEV 01', 'FEV 08', 'FEV 15', 'FEV 22', 'MAR 01', 'MAR 08'];
  
  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="sticky top-0 z-10 flex bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="w-64 flex-shrink-0 p-4 border-r border-slate-200 dark:border-slate-800 font-bold text-xs uppercase tracking-wider text-slate-400">Projetos</div>
          <div className="flex-1 flex">
            {weeks.map((week, i) => (
              <div key={week} className="w-[120px] p-4 text-center border-r border-slate-100 dark:border-slate-800/50">
                <span className="block text-xs font-bold">{week}</span>
                <span className="text-[10px] text-slate-400 uppercase">S{i+1}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {projects.map((project, index) => {
            const startWeek = index * 2;
            const duration = project.status === 'Active' ? 4 : project.status === 'Completed' ? 2 : 3;
            
            return (
              <div 
                key={project.id} 
                onClick={() => onProjectClick?.(project)}
                className="flex hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
              >
                <div className="w-64 flex-shrink-0 p-4 border-r border-slate-200 dark:border-slate-800 flex flex-col gap-1">
                  <h4 className="text-sm font-bold">{project.name}</h4>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded w-fit ${
                    project.tagColor === 'amber' ? 'bg-amber-50 text-amber-600' :
                    project.tagColor === 'blue' ? 'bg-blue-50 text-blue-600' :
                    project.tagColor === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
                    'bg-indigo-50 text-indigo-600'
                  }`}>
                    {project.type}
                  </span>
                </div>
                <div className="flex-1 relative flex items-center h-20">
                  <div 
                    className={`absolute h-8 rounded-lg flex items-center px-3 gap-2 cursor-pointer ${
                      project.tagColor === 'amber' ? 'bg-amber-500/20 border-l-4 border-l-amber-500' :
                      project.tagColor === 'blue' ? 'bg-blue-500/20 border-l-4 border-l-blue-500' :
                      project.tagColor === 'emerald' ? 'bg-emerald-500/20 border-l-4 border-l-emerald-500' :
                      'bg-indigo-500/20 border-l-4 border-l-indigo-500'
                    }`}
                    style={{ left: `${startWeek * 120}px`, width: `${duration * 120}px` }}
                  >
                    <span className={`text-[10px] font-bold ${
                      project.tagColor === 'amber' ? 'text-amber-700' :
                      project.tagColor === 'blue' ? 'text-blue-700' :
                      project.tagColor === 'emerald' ? 'text-emerald-700' :
                      'text-indigo-700'
                    }`}>
                      {project.status === 'Active' ? 'Em Desenvolvimento' : 
                       project.status === 'Lead' ? 'Proposta Enviada' :
                       project.status === 'Completed' ? 'Concluído' : 'Em Revisão'}
                    </span>
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

const AddProjectModal: React.FC<{ categories: string[]; onClose: () => void; onSave: (project: Partial<Project>) => void }> = ({ categories, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    client: '',
    description: '',
    type: '',
    status: 'Lead' as Project['status'],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.client) {
      onSave(formData);
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
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary"
              placeholder="Ex: Redesign de Site"
              required
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Cliente</label>
            <input
              type="text"
              value={formData.client}
              onChange={(e) => setFormData({ ...formData, client: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary"
              placeholder="Nome do cliente"
              required
            />
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
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary"
              >
                <option value="">Selecione uma categoria</option>
                {categories.map((category, index) => (
                  <option key={index} value={category}>{category}</option>
                ))}
                <option value="Sem categoria">Sem categoria</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as Project['status'] })}
                className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary"
              >
                <option value="Lead">Lead</option>
                <option value="Active">Em Desenvolvimento</option>
                <option value="Review">Em Revisão</option>
                <option value="Completed">Concluído</option>
              </select>
            </div>
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
              Criar Projeto
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AddCategoryModal: React.FC<{ onClose: () => void; onSave: (category: string) => void }> = ({ onClose, onSave }) => {
  const [categoryName, setCategoryName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (categoryName.trim()) {
      onSave(categoryName.trim());
      setCategoryName('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-full max-w-md">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-xl font-bold">Adicionar Nova Categoria</h3>
          <button 
            onClick={onClose}
            className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Nome da Categoria</label>
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
              <h3 className="text-xl font-bold">Excluir Categoria</h3>
              <p className="text-sm text-slate-500 mt-1">Esta ação não pode ser desfeita</p>
            </div>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Tem certeza que deseja excluir a categoria <span className="font-bold">"{categoryName}"</span>?
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Os projetos vinculados a esta categoria serão marcados como "Sem categoria".
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
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border min-w-[320px] ${
            toast.type === 'success' 
              ? 'bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-800/50' 
              : 'bg-white dark:bg-slate-900 border-red-200 dark:border-red-800/50'
          }`}>
            <span className={`material-symbols-outlined flex-shrink-0 ${
              toast.type === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
            }`}>
              {toast.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <p className={`text-sm font-semibold flex-1 ${
              toast.type === 'success' 
                ? 'text-emerald-900 dark:text-emerald-100' 
                : 'text-red-900 dark:text-red-100'
            }`}>
              {toast.message}
            </p>
            <button 
              onClick={() => setToast(null)}
              className="ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors flex-shrink-0"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const AddStageModal: React.FC<{ onClose: () => void; onSave: (stage: { title: string }) => void }> = ({ onClose, onSave }) => {
  const [formData, setFormData] = useState({
    title: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.title.trim()) {
      onSave(formData);
      setFormData({ title: '' });
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
