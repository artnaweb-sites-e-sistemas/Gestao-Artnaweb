
import React, { useState, useEffect, useRef } from 'react';
import { Project, Activity, TeamMember, StageTask, ProjectStageTask, ProjectFile, Category, Invoice } from '../types';
import { 
  subscribeToProjectActivities, 
  subscribeToProjectTeamMembers,
  addActivity,
  addTeamMember,
  removeTeamMember,
  updateProject,
  subscribeToProject,
  subscribeToCategories,
  subscribeToStages,
  Stage,
  getStageTasks,
  subscribeToProjectStageTasks,
  toggleProjectStageTask,
  initializeProjectStageTasks,
  subscribeToProjectFiles,
  uploadProjectFile,
  deleteProjectFile,
  getUniqueClients,
  uploadProjectAvatar,
  deleteProject,
  subscribeToInvoices,
  addInvoice,
  updateInvoice
} from '../firebase/services';

interface ProjectDetailsProps {
  project: Project;
  onClose: () => void;
}

export const ProjectDetails: React.FC<ProjectDetailsProps> = ({ project, onClose }) => {
  const [currentProject, setCurrentProject] = useState<Project>(project);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);
  const [showShareProject, setShowShareProject] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stageTasks, setStageTasks] = useState<{ [stageId: string]: StageTask[] }>({});
  const [projectStageTasks, setProjectStageTasks] = useState<ProjectStageTask[]>([]);
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);
  const [fileToDelete, setFileToDelete] = useState<ProjectFile | null>(null);
  const [showDeleteProjectConfirm, setShowDeleteProjectConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'description' | 'tasks' | 'access' | 'files'>('description');
  const [activeManagementTab, setActiveManagementTab] = useState<'overview' | 'billing' | 'roadmap'>('overview');
  const [showAddCredential, setShowAddCredential] = useState(false);
  const [showEditCredential, setShowEditCredential] = useState<{ id: string; title: string; sub: string; icon: string; url: string; user: string; password: string } | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showMaintenanceDatePicker, setShowMaintenanceDatePicker] = useState(false);
  const [showReportDatePicker, setShowReportDatePicker] = useState(false);
  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [credentials, setCredentials] = useState<Array<{ id: string; title: string; sub: string; icon: string; url: string; user: string; password: string }>>([
    { id: '1', title: 'WP Engine Hosting', sub: 'Servidor de Produção', icon: 'dns', url: 'wpengine.example.com', user: 'admin_user', password: '••••••••' },
    { id: '2', title: 'Shopify Storefront', sub: 'Acesso Admin API', icon: 'data_object', url: 'store.myshopify.com', user: 'api_key_...', password: '••••••••' }
  ]);

  // Sincroniza o estado local quando o projeto prop mudar
  useEffect(() => {
    setCurrentProject(project);
  }, [project]);

  // Fechar calendários ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (showDatePicker && !target.closest('.date-picker-container')) {
        setShowDatePicker(false);
      }
      if (showMaintenanceDatePicker && !target.closest('.date-picker-container')) {
        setShowMaintenanceDatePicker(false);
      }
      if (showReportDatePicker && !target.closest('.date-picker-container')) {
        setShowReportDatePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDatePicker, showMaintenanceDatePicker, showReportDatePicker]);

  useEffect(() => {
    if (!currentProject.id) {
      console.error("Project ID is missing:", currentProject);
      return;
    }

    console.log("Subscribing to project, activities and members for project:", currentProject.id);
    
    // Subscrever atualizações do projeto em tempo real
    const unsubscribeProject = subscribeToProject(currentProject.id, (updatedProject) => {
      if (updatedProject) {
        console.log("Project updated:", updatedProject);
        setCurrentProject(updatedProject);
      }
    });

    const unsubscribeActivities = subscribeToProjectActivities(currentProject.id, (data) => {
      console.log("Activities updated:", data);
      setActivities(data);
    });

    const unsubscribeMembers = subscribeToProjectTeamMembers(currentProject.id, (data) => {
      console.log("Team members updated:", data);
      setTeamMembers(data);
    });

    const unsubscribeStages = subscribeToStages((firebaseStages) => {
      setStages(firebaseStages);
      // Carregar tarefas de cada etapa
      firebaseStages.forEach(async (stage) => {
        const tasks = await getStageTasks(stage.id);
        setStageTasks(prev => ({ ...prev, [stage.id]: tasks }));
      });
    });

    const unsubscribeCategories = subscribeToCategories((firebaseCategories) => {
      setCategories(firebaseCategories);
    }, currentProject.workspaceId);

    const unsubscribeProjectStageTasks = subscribeToProjectStageTasks(currentProject.id, (data) => {
      setProjectStageTasks(data);
    });

    const unsubscribeProjectFiles = subscribeToProjectFiles(currentProject.id, (data) => {
      setProjectFiles(data);
    });

    const unsubscribeInvoices = subscribeToInvoices((fetchedInvoices) => {
      setInvoices(fetchedInvoices);
    }, currentProject.id);

    // Inicializar tarefas do projeto para a etapa atual
    initializeProjectStageTasks(currentProject.id, currentProject.status).catch(console.error);

    return () => {
      unsubscribeProject();
      unsubscribeActivities();
      unsubscribeMembers();
      unsubscribeStages();
      unsubscribeInvoices();
      unsubscribeCategories();
      unsubscribeProjectStageTasks();
      unsubscribeProjectFiles();
    };
  }, [currentProject.id, currentProject.status, currentProject.workspaceId]);

  const formatDate = (date: Date | any): string => {
    if (!date) return 'Data não disponível';
    const now = new Date();
    const activityDate = date.toDate ? date.toDate() : new Date(date);
    const diffInMs = now.getTime() - activityDate.getTime();
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'hoje';
    if (diffInDays === 1) return 'ontem';
    if (diffInDays < 7) return `há ${diffInDays} dias`;
    if (diffInDays < 30) return `há ${Math.floor(diffInDays / 7)} semanas`;
    return `há ${Math.floor(diffInDays / 30)} meses`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        await uploadProjectFile(currentProject.id, files[i]);
      }
      setToast({ message: "Arquivo(s) enviado(s) com sucesso!", type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      console.error("Error uploading file:", error);
      setToast({ message: "Erro ao enviar arquivo(s). Tente novamente.", type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteFile = (file: ProjectFile) => {
    setFileToDelete(file);
  };

  const confirmDeleteFile = async () => {
    if (!fileToDelete) return;

    try {
      await deleteProjectFile(fileToDelete.id, fileToDelete.url);
      setToast({ message: "Arquivo excluído com sucesso!", type: 'success' });
      setTimeout(() => setToast(null), 3000);
      setFileToDelete(null);
    } catch (error) {
      console.error("Error deleting file:", error);
      setToast({ message: "Erro ao excluir arquivo. Tente novamente.", type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    const member = teamMembers.find(m => m.id === memberId);
    if (member) {
      setMemberToRemove(member);
    }
  };

  const confirmRemoveMember = async () => {
    if (!memberToRemove) return;
    
    try {
      await removeTeamMember(memberToRemove.id);
      setToast({ message: "Membro removido com sucesso!", type: 'success' });
      setTimeout(() => setToast(null), 3000);
      setMemberToRemove(null);
    } catch (error) {
      console.error("Error removing team member:", error);
      setToast({ message: "Erro ao remover membro. Tente novamente.", type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  // Obter cor baseada na categoria do projeto (mesma lógica da legenda do Timeline)
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

  // Obter classes CSS baseadas na cor da categoria
  const getCategoryBadgeClasses = (projectType: string) => {
    const color = getCategoryColor(projectType);
    const colorMap: { [key: string]: string } = {
      'amber': 'text-amber-600 bg-amber-50 dark:bg-amber-900/20',
      'blue': 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
      'emerald': 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20',
      'indigo': 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20',
      'purple': 'text-purple-600 bg-purple-50 dark:bg-purple-900/20',
      'rose': 'text-rose-600 bg-rose-50 dark:bg-rose-900/20',
    };
    return colorMap[color] || 'text-blue-600 bg-blue-50 dark:bg-blue-900/20';
  };

  return (
    <>
    <div className="flex h-full">
      {/* Coluna do Meio - Informações do Projeto */}
      <aside className="w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between p-6 overflow-y-auto">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-primary/10 rounded-xl p-2 relative group">
                {currentProject.avatar ? (
                  <div 
                    className="size-12 rounded-lg bg-slate-200 cursor-pointer hover:opacity-80 transition-opacity" 
                    style={{ backgroundImage: `url(${currentProject.avatar})`, backgroundSize: 'cover' }}
                    onClick={() => avatarInputRef.current?.click()}
                    title="Alterar foto de perfil"
                  ></div>
                ) : (
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    className="size-12 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center cursor-pointer hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                    title="Adicionar foto de perfil"
                  >
                    <span className="material-symbols-outlined text-slate-500 dark:text-slate-400">add</span>
                  </button>
                )}
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    
                    setUploadingAvatar(true);
                    try {
                      const avatarUrl = await uploadProjectAvatar(currentProject.id, file);
                      await updateProject(currentProject.id, { avatar: avatarUrl });
                      setToast({ message: "Foto de perfil atualizada com sucesso!", type: 'success' });
                      setTimeout(() => setToast(null), 3000);
                    } catch (error) {
                      console.error("Error uploading avatar:", error);
                      setToast({ message: "Erro ao fazer upload da foto. Tente novamente.", type: 'error' });
                      setTimeout(() => setToast(null), 3000);
                    } finally {
                      setUploadingAvatar(false);
                      if (avatarInputRef.current) {
                        avatarInputRef.current.value = '';
                      }
                    }
                  }}
                />
                {uploadingAvatar && (
                  <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                    <span className="material-symbols-outlined text-white animate-spin">sync</span>
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight">{currentProject.name}</h1>
                <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">{currentProject.client}</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <span className={`px-2 py-1 text-[10px] font-bold rounded uppercase ${
                currentProject.status === 'Active' ? 'bg-blue-100 text-blue-700' :
                currentProject.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                currentProject.status === 'Lead' ? 'bg-amber-100 text-amber-700' :
                currentProject.status === 'Finished' ? 'bg-rose-100 text-rose-700' :
                'bg-indigo-100 text-indigo-700'
              }`}>
                {(() => {
                  // Verificar se é um serviço recorrente
                  const isRecurringService = categories.find(cat => 
                    cat.name === currentProject.type && cat.isRecurring
                  );
                  
                  // Se for serviço recorrente e status Completed, mostrar "Gestão"
                  if (isRecurringService && currentProject.status === 'Completed') {
                    return 'Gestão';
                  }
                  
                  // Caso contrário, usar a lógica padrão
                  return currentProject.status === 'Lead' ? 'On-boarding' : 
                         currentProject.status === 'Active' ? 'Em Desenvolvimento' :
                         currentProject.status === 'Completed' ? 'Concluído' : 
                         currentProject.status === 'Finished' ? 'Finalizado' : 'Em Revisão';
                })()}
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded ${getCategoryBadgeClasses(currentProject.type)}`}>
                {currentProject.type}
              </span>
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-8">
            <div className="flex flex-col gap-1">
              <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest mb-2">Informações</p>
            <ContactInfo label="Cliente" value={currentProject.client} />
            <ContactInfo label="Projeto" value={currentProject.name} />
            <div className="py-2">
              <p className="text-slate-500 text-xs mb-1">Data de Entrega</p>
              <div className="flex items-center gap-2">
                <div className="relative date-picker-container flex-1">
                  <button
                    onClick={() => setShowDatePicker(!showDatePicker)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs text-left flex items-center justify-between hover:border-primary/50 transition-colors"
                  >
                    <span className={currentProject.deadline ? 'text-slate-900 dark:text-white' : 'text-slate-400'}>
                      {currentProject.deadline 
                        ? new Date(currentProject.deadline).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                        : 'Selecione uma data'
                      }
                    </span>
                    <span className="material-symbols-outlined text-sm text-slate-400">calendar_today</span>
                  </button>
                  {showDatePicker && (
                    <DatePicker
                      selectedDate={currentProject.deadline ? new Date(currentProject.deadline) : null}
                      onSelectDate={async (date) => {
                        const newDeadline = date ? date.toISOString() : null;
                        try {
                          await updateProject(currentProject.id, { deadline: newDeadline });
                          setToast({ message: "Data de entrega atualizada", type: 'success' });
                          setTimeout(() => setToast(null), 3000);
                          setShowDatePicker(false);
                        } catch (error) {
                          console.error("Error updating deadline:", error);
                          setToast({ message: "Erro ao atualizar data de entrega", type: 'error' });
                          setTimeout(() => setToast(null), 3000);
                        }
                      }}
                      onClose={() => setShowDatePicker(false)}
                    />
                  )}
                </div>
              </div>
              
              {/* Botão Pendente - aparece logo após Data de Entrega */}
              {currentProject.status === 'Completed' && (
                <div className="mt-2 w-full">
                  <button
                    onClick={async () => {
                      try {
                        // Buscar a etapa "Em Desenvolvimento" para voltar
                        const activeStage = stages.find(s => s.status === 'Active') || 
                                            stages.find(s => s.status === 'Review') || 
                                            stages.find(s => s.status === 'Lead') ||
                                            stages[Math.max(0, stages.length - 2)];
                        await updateProject(currentProject.id, { 
                          status: (activeStage?.status || 'Active') as Project['status'],
                          stageId: activeStage?.id, // Atualizar stageId
                          progress: activeStage ? activeStage.progress : 50
                        });
                        setToast({ message: "Projeto marcado como pendente", type: 'success' });
                        setTimeout(() => setToast(null), 3000);
                      } catch (error) {
                        console.error("Error marking project as pending:", error);
                        setToast({ message: "Erro ao marcar projeto como pendente", type: 'error' });
                        setTimeout(() => setToast(null), 3000);
                      }
                    }}
                    className="w-full px-3 py-1.5 bg-slate-500 hover:bg-slate-600 text-white rounded text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                    title="Marcar como pendente"
                  >
                    <span className="material-symbols-outlined text-sm">pending</span>
                    <span className="hidden sm:inline">Pendente</span>
                  </button>
                </div>
              )}
              
              {/* Campos de data para projetos recorrentes em Manutenção */}
              {(() => {
                const isRecurringService = categories.find(cat => 
                  cat.name === currentProject.type && cat.isRecurring
                );
                const isInMaintenance = isRecurringService && currentProject.status === 'Completed';
                
                if (!isInMaintenance) return null;
                
                return (
                  <>
                    <div className="py-2 mt-2">
                      <p className="text-slate-500 text-xs mb-1">Data da Manutenção</p>
                      <div className="flex items-center gap-2">
                        <div className="relative date-picker-container flex-1">
                          <button
                            onClick={() => setShowMaintenanceDatePicker(!showMaintenanceDatePicker)}
                            className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs text-left flex items-center justify-between hover:border-primary/50 transition-colors"
                          >
                            <span className={currentProject.maintenanceDate ? 'text-slate-900 dark:text-white' : 'text-slate-400'}>
                              {currentProject.maintenanceDate 
                                ? new Date(currentProject.maintenanceDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                : 'Selecione uma data'
                              }
                            </span>
                            <span className="material-symbols-outlined text-sm text-slate-400">calendar_today</span>
                          </button>
                          {showMaintenanceDatePicker && (
                            <DatePicker
                              selectedDate={currentProject.maintenanceDate ? new Date(currentProject.maintenanceDate) : null}
                              onSelectDate={async (date) => {
                                const newDate = date ? date.toISOString() : null;
                                try {
                                  await updateProject(currentProject.id, { maintenanceDate: newDate });
                                  setToast({ message: "Data da Manutenção atualizada", type: 'success' });
                                  setTimeout(() => setToast(null), 3000);
                                  setShowMaintenanceDatePicker(false);
                                } catch (error) {
                                  console.error("Error updating maintenance date:", error);
                                  setToast({ message: "Erro ao atualizar data da manutenção", type: 'error' });
                                  setTimeout(() => setToast(null), 3000);
                                }
                              }}
                              onClose={() => setShowMaintenanceDatePicker(false)}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="py-2">
                      <p className="text-slate-500 text-xs mb-1">Data do Relatório</p>
                      <div className="flex items-center gap-2">
                        <div className="relative date-picker-container flex-1">
                          <button
                            onClick={() => setShowReportDatePicker(!showReportDatePicker)}
                            className="w-full px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs text-left flex items-center justify-between hover:border-primary/50 transition-colors"
                          >
                            <span className={currentProject.reportDate ? 'text-slate-900 dark:text-white' : 'text-slate-400'}>
                              {currentProject.reportDate 
                                ? new Date(currentProject.reportDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                : 'Selecione uma data'
                              }
                            </span>
                            <span className="material-symbols-outlined text-sm text-slate-400">calendar_today</span>
                          </button>
                          {showReportDatePicker && (
                            <DatePicker
                              selectedDate={currentProject.reportDate ? new Date(currentProject.reportDate) : null}
                              onSelectDate={async (date) => {
                                const newDate = date ? date.toISOString() : null;
                                try {
                                  await updateProject(currentProject.id, { reportDate: newDate });
                                  setToast({ message: "Data do Relatório atualizada", type: 'success' });
                                  setTimeout(() => setToast(null), 3000);
                                  setShowReportDatePicker(false);
                                } catch (error) {
                                  console.error("Error updating report date:", error);
                                  setToast({ message: "Erro ao atualizar data do relatório", type: 'error' });
                                  setTimeout(() => setToast(null), 3000);
                                }
                              }}
                              onClose={() => setShowReportDatePicker(false)}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
              
              {/* Botões Concluir e Revisar */}
              {currentProject.status !== 'Completed' && (
                <div className="flex items-center gap-2 mt-2 w-full">
                  <button
                    onClick={async () => {
                      try {
                        // Buscar a etapa "Concluído"
                        const completedStage = stages.find(s => s.status === 'Completed') || stages[stages.length - 1];
                        await updateProject(currentProject.id, { 
                          status: 'Completed' as Project['status'],
                          stageId: completedStage?.id, // Atualizar stageId
                          progress: completedStage ? completedStage.progress : 100
                        });
                        setToast({ message: "Projeto marcado como concluído", type: 'success' });
                        setTimeout(() => setToast(null), 3000);
                      } catch (error) {
                        console.error("Error marking project as completed:", error);
                        setToast({ message: "Erro ao marcar projeto como concluído", type: 'error' });
                        setTimeout(() => setToast(null), 3000);
                      }
                    }}
                    className={`flex-1 px-3 py-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${
                      currentProject.status === 'Completed'
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-emerald-500 hover:text-white hover:border-emerald-500'
                    }`}
                    title="Marcar como concluído"
                  >
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    <span className="hidden sm:inline">Concluir</span>
                  </button>
                  {currentProject.status !== 'Completed' && (
                    <button
                      onClick={async () => {
                        try {
                          // Buscar a etapa "Em Revisão"
                          const reviewStage = stages.find(s => s.status === 'Review');
                          await updateProject(currentProject.id, { 
                            status: 'Review' as Project['status'],
                            stageId: reviewStage?.id, // Atualizar stageId
                            progress: reviewStage ? reviewStage.progress : 75,
                            updatedAt: new Date()
                          });
                          setToast({ message: "Projeto enviado para revisão", type: 'success' });
                          setTimeout(() => setToast(null), 3000);
                        } catch (error) {
                          console.error("Error marking project as review:", error);
                          setToast({ message: "Erro ao enviar projeto para revisão", type: 'error' });
                          setTimeout(() => setToast(null), 3000);
                        }
                      }}
                      className={`flex-1 px-3 py-1.5 rounded text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${
                        currentProject.status === 'Review'
                          ? 'bg-amber-500 hover:bg-amber-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-amber-500 hover:text-white hover:border-amber-500'
                      }`}
                      title="Enviar para revisão"
                    >
                      <span className="material-symbols-outlined text-sm">rate_review</span>
                      <span className="hidden sm:inline">Revisar</span>
                    </button>
                  )}
                </div>
              )}
            </div>
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-8">
            <div className="flex flex-col gap-1">
              <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest mb-2">Budget</p>
            <div className="py-2">
              <p className="text-slate-500 text-xs mb-1">Valor do Projeto</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">
                {currentProject.budget ? 
                  new Intl.NumberFormat('pt-BR', { 
                    style: 'currency', 
                    currency: 'BRL' 
                  }).format(currentProject.budget) 
                  : 'R$ 0,00'}
              </p>
            </div>
            <div className="py-2">
              <p className="text-slate-500 text-xs mb-1">Status de Pagamento</p>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    if (currentProject.isPaid) return;
                    try {
                      // Atualizar status geral do projeto
                      await updateProject(currentProject.id, { isPaid: true });
                      
                      // Atualizar todas as faturas pendentes para Pago
                      const pendingInvoices = invoices.filter(inv => inv.status !== 'Paid');
                      for (const invoice of pendingInvoices) {
                        await updateInvoice(invoice.id, { status: 'Paid' });
                      }
                      
                      setToast({ message: "Todas as faturas marcadas como pagas", type: 'success' });
                      setTimeout(() => setToast(null), 3000);
                    } catch (error) {
                      console.error("Error updating payment status:", error);
                      setToast({ message: "Erro ao atualizar status de pagamento", type: 'error' });
                      setTimeout(() => setToast(null), 3000);
                    }
                  }}
                  className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                    currentProject.isPaid
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-700'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
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
                      await updateProject(currentProject.id, { isPaid: false });
                      
                      // Atualizar todas as faturas pagas para Pendente
                      const paidInvoices = invoices.filter(inv => inv.status === 'Paid');
                      for (const invoice of paidInvoices) {
                        await updateInvoice(invoice.id, { status: 'Pending' });
                      }
                      
                      setToast({ message: "Todas as faturas marcadas como pendentes", type: 'success' });
                      setTimeout(() => setToast(null), 3000);
                    } catch (error) {
                      console.error("Error updating payment status:", error);
                      setToast({ message: "Erro ao atualizar status de pagamento", type: 'error' });
                      setTimeout(() => setToast(null), 3000);
                    }
                  }}
                  className={`flex-1 flex items-center justify-center gap-1 px-3 py-1.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                    !currentProject.isPaid
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-700'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">pending</span>
                  Pendente
                </button>
              </div>
            </div>
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-800 pt-8">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between mb-2">
                <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest">Equipe</p>
              <button
                onClick={() => setShowAddMember(true)}
                className="size-5 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-primary transition-colors"
                title="Adicionar membro"
              >
                <span className="material-symbols-outlined text-base">add</span>
              </button>
            </div>
            {teamMembers.length > 0 ? (
              <>
                <div className="flex -space-x-2 mb-3 flex-wrap">
                  {teamMembers.slice(0, 5).map((member) => (
                    <div 
                      key={member.id}
                      className="size-10 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200 relative group"
                      style={{ backgroundImage: `url(${member.avatar})`, backgroundSize: 'cover' }}
                      title={member.name}
                    >
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="absolute -top-1 -right-1 size-4 bg-rose-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        title="Remover membro"
                      >
                        <span className="material-symbols-outlined text-xs">close</span>
                      </button>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={() => setShowAllMembers(true)}
                  className="text-sm font-semibold text-primary hover:underline text-left"
                >
                  {teamMembers.length} {teamMembers.length === 1 ? 'membro' : 'membros'}
                </button>
              </>
            ) : (
              <div className="text-center py-2">
                <p className="text-xs text-slate-500 mb-2">Nenhum membro</p>
                <button
                  onClick={() => setShowAddMember(true)}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Adicionar membro
                </button>
              </div>
            )}
            </div>
          </div>

          <nav className="border-t border-slate-200 dark:border-slate-800 pt-8 pb-8 flex flex-col gap-1">
            <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest mb-2">Gestão</p>
            <NavBtn 
              icon="description" 
              label="Visão Geral" 
              active={activeManagementTab === 'overview'} 
              onClick={() => setActiveManagementTab('overview')} 
            />
            <NavBtn 
              icon="payments" 
              label="Faturamento e Notas" 
              active={activeManagementTab === 'billing'} 
              onClick={() => setActiveManagementTab('billing')} 
            />
            <NavBtn 
              icon="rocket_launch" 
              label="Roteiro do Projeto" 
              active={activeManagementTab === 'roadmap'} 
              onClick={() => setActiveManagementTab('roadmap')} 
            />
          </nav>
        </div>
        <div className="border-t border-slate-200 dark:border-slate-800 pt-8 mt-auto">
          <button 
            onClick={() => setShowEditProject(true)}
            className="flex w-full items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
          >
            <span className="material-symbols-outlined text-lg">edit</span>
            Editar Projeto
          </button>
          <button
            onClick={() => setShowDeleteProjectConfirm(true)}
            className="flex w-full items-center justify-center gap-2 px-4 py-2 bg-rose-500 text-white rounded-lg text-sm font-semibold hover:bg-rose-600 transition-colors shadow-lg shadow-rose-500/20 mt-3"
          >
            <span className="material-symbols-outlined text-lg">delete</span>
            Excluir Projeto
          </button>
        </div>
      </aside>

      {/* Coluna Direita - Conteúdo Principal */}
      <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900/10">
        {activeManagementTab === 'overview' && (
          <div className="p-8">
            <div className="max-w-5xl mx-auto flex flex-col gap-6">
              <div className="flex items-center gap-2 text-slate-500 mb-2">
                <button 
                  onClick={onClose}
                  className="flex items-center gap-2 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">arrow_back</span>
                  <span className="text-xs font-bold uppercase tracking-wider">Painel</span>
                </button>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">/</span>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{currentProject.name}</span>
              </div>
              <div className="flex flex-wrap justify-between items-end gap-3 border-b border-slate-200 dark:border-slate-800 pb-6">
                <div className="flex flex-col gap-1">
                  <p className="text-3xl font-black leading-tight tracking-tight">Detalhes do Projeto</p>
                  <p className="text-slate-500 text-sm">Gerencie informações, tarefas, atividades e arquivos do projeto.</p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowShareProject(true)}
                    className="flex items-center px-4 h-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px] mr-2">share</span> Compartilhar
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="border-b border-slate-100 dark:border-slate-800 px-6 pt-2 flex gap-10">
                <TabLink 
                  label="Descrição" 
                  icon="description" 
                  active={activeTab === 'description'} 
                  onClick={() => setActiveTab('description')} 
                />
                <TabLink 
                  label="Tarefas" 
                  icon="checklist" 
                  active={activeTab === 'tasks'} 
                  badge={(() => {
                    let totalTasks = 0;
                    let completedTasks = 0;
                    stages.forEach((stage) => {
                      const tasks = stageTasks[stage.id] || [];
                      totalTasks += tasks.length;
                      tasks.forEach((task) => {
                        const projectTask = projectStageTasks.find(
                          pt => pt.stageTaskId === task.id && pt.stageId === stage.id
                        );
                        if (projectTask?.completed) completedTasks++;
                      });
                    });
                    const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
                    return totalTasks > 0 ? `${progressPercentage}%` : undefined;
                  })()}
                  onClick={() => setActiveTab('tasks')} 
                />
                <TabLink 
                  label="Dados de Acesso" 
                  icon="key" 
                  active={activeTab === 'access'} 
                  onClick={() => setActiveTab('access')} 
                />
                <TabLink 
                  label="Arquivos" 
                  icon="folder" 
                  active={activeTab === 'files'} 
                  onClick={() => setActiveTab('files')} 
                />
              </div>
              <div className="p-6">
                {activeTab === 'description' && (
                  <div>
                    <h3 className="text-lg font-bold mb-4">Descrição do Projeto</h3>
                    <p className="text-slate-600 dark:text-slate-400 break-words whitespace-pre-wrap overflow-wrap-anywhere leading-relaxed">
                      {currentProject.description || 'Nenhuma descrição adicionada ainda.'}
                    </p>
                  </div>
                )}

                {activeTab === 'tasks' && (
                  <div>
                    <div className="mb-6">
                      <h3 className="text-lg font-bold">Progresso de Tarefas</h3>
                    </div>
                    {stages.length > 0 && Object.keys(stageTasks).length > 0 ? (
                      <>
                        {/* Calcular progresso total */}
                        {(() => {
                          let totalTasks = 0;
                          let completedTasks = 0;
                          stages.forEach((stage) => {
                            const tasks = stageTasks[stage.id] || [];
                            totalTasks += tasks.length;
                            tasks.forEach((task) => {
                              const projectTask = projectStageTasks.find(
                                pt => pt.stageTaskId === task.id && pt.stageId === stage.id
                              );
                              if (projectTask?.completed) completedTasks++;
                            });
                          });
                          const progressPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
                          
                          return (
                            <div className="space-y-4 mb-6">
                              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                <div 
                                  className="bg-primary h-full rounded-full transition-all" 
                                  style={{ width: `${progressPercentage}%` }}
                                ></div>
                              </div>
                            </div>
                          );
                        })()}
                        
                        <div className="space-y-6">
                          {stages.map((stage) => {
                            const tasks = stageTasks[stage.id] || [];
                            if (tasks.length === 0) return null;
                            
                            const isCurrentStage = stage.status === currentProject.status;
                            const currentStage = stages.find(s => s.status === currentProject.status);
                            const currentStageOrder = currentStage?.order ?? -1;
                            const stageOrder = stage.order;
                            const isPreviousStage = stageOrder < currentStageOrder;
                            
                            const allTasksCompleted = tasks.every((task) => {
                              const projectTask = projectStageTasks.find(
                                pt => pt.stageTaskId === task.id && pt.stageId === stage.id
                              );
                              return projectTask?.completed || false;
                            });
                            
                            const isCompleted = allTasksCompleted && (isCurrentStage || isPreviousStage);
                            
                            return (
                              <div key={stage.id} className="space-y-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className={`text-sm font-semibold uppercase tracking-wider ${
                                    isCompleted
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : isCurrentStage 
                                      ? 'text-primary dark:text-primary' 
                                      : 'text-slate-600 dark:text-slate-400'
                                  }`}>
                                    {stage.title}
                                  </h4>
                                  {(isCurrentStage || isPreviousStage) && (
                                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${
                                      isCompleted 
                                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' 
                                        : isCurrentStage 
                                        ? 'bg-primary/10 text-primary' 
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                    }`}>
                                      {isCompleted ? 'CONCLUÍDA' : isCurrentStage ? 'ETAPA ATUAL' : 'ANTERIOR'}
                                    </span>
                                  )}
                                </div>
                                <div className="space-y-3">
                                  {tasks.map((task) => {
                                    const projectTask = projectStageTasks.find(
                                      pt => pt.stageTaskId === task.id && pt.stageId === stage.id
                                    );
                                    const isTaskCompleted = projectTask?.completed || false;
                                    const isTaskInProgress = isCurrentStage && !isTaskCompleted;
                                    
                                    return (
                                      <label
                                        key={task.id}
                                        className="flex items-center gap-3 cursor-pointer group"
                                        onClick={async (e) => {
                                          if (e.target instanceof HTMLElement && e.target.closest('input')) return;
                                          try {
                                            await toggleProjectStageTask(currentProject.id, task.id, stage.id, !isTaskCompleted);
                                          } catch (error) {
                                            console.error("Error toggling task:", error);
                                            setToast({ message: "Erro ao atualizar tarefa. Tente novamente.", type: 'error' });
                                            setTimeout(() => setToast(null), 3000);
                                          }
                                        }}
                                      >
                                        <span className={`material-symbols-outlined transition-colors ${
                                          isTaskCompleted 
                                            ? 'text-green-500' 
                                            : isTaskInProgress 
                                            ? 'text-primary' 
                                            : 'text-slate-400'
                                        }`}>
                                          {isTaskCompleted ? 'check_circle' : 'radio_button_unchecked'}
                                        </span>
                                        <p className={`text-sm flex-1 ${isTaskCompleted ? 'line-through text-slate-400' : isTaskInProgress ? 'font-bold' : ''}`}>
                                          {task.title}
                                        </p>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-slate-500 text-center py-8">Nenhuma tarefa definida para este projeto.</p>
                    )}
                  </div>
                )}

                {activeTab === 'access' && (
                  <>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-bold">Credenciais de Hospedagem e CMS</h3>
                      <div className="flex items-center gap-3">
                        <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 rounded-lg flex items-center gap-2">
                          <span className="material-symbols-outlined text-[16px]">lock</span> Compartilhado com {teamMembers.length} {teamMembers.length === 1 ? 'membro' : 'membros'}
                        </div>
                        <button 
                          onClick={() => setShowAddCredential(true)}
                          className="flex items-center gap-2 px-4 h-9 bg-primary text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors"
                        >
                          <span className="material-symbols-outlined text-base">add</span>
                          Adicionar Credencial
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {credentials.map((credential) => (
                        <CredentialCard 
                          key={credential.id}
                          title={credential.title} 
                          sub={credential.sub} 
                          icon={credential.icon} 
                          url={credential.url} 
                          user={credential.user}
                          password={credential.password}
                          onEdit={() => setShowEditCredential(credential)}
                          onDelete={() => {
                            setCredentials(credentials.filter(c => c.id !== credential.id));
                            setToast({ message: "Credencial removida com sucesso!", type: 'success' });
                            setTimeout(() => setToast(null), 3000);
                          }}
                        />
                      ))}
                    </div>
                  </>
                )}

                {activeTab === 'files' && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold">Mídias e Documentos</h3>
                      <div className="flex items-center gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          onChange={handleFileUpload}
                          className="hidden"
                          id="file-upload"
                          disabled={uploading}
                        />
                        <label
                          htmlFor="file-upload"
                          className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                            uploading
                              ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                              : 'text-primary hover:bg-primary/10'
                          }`}
                        >
                          <span className="material-symbols-outlined text-sm">
                            {uploading ? 'hourglass_empty' : 'upload'}
                          </span>
                          {uploading ? 'Enviando...' : 'Enviar Arquivo'}
                        </label>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {projectFiles.length > 0 ? (
                        projectFiles.map((file) => (
                          <div
                            key={file.id}
                            className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-primary/50 transition-colors"
                          >
                            <div className="flex-shrink-0">
                              {file.type === 'image' ? (
                                <span className="material-symbols-outlined text-2xl text-blue-500">image</span>
                              ) : file.type === 'video' ? (
                                <span className="material-symbols-outlined text-2xl text-purple-500">videocam</span>
                              ) : file.type === 'document' ? (
                                <span className="material-symbols-outlined text-2xl text-red-500">description</span>
                              ) : (
                                <span className="material-symbols-outlined text-2xl text-slate-500">attach_file</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium text-slate-900 dark:text-slate-100 hover:text-primary transition-colors block truncate"
                              >
                                {file.name}
                              </a>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-slate-500">{formatFileSize(file.size)}</span>
                                <span className="text-xs text-slate-400">•</span>
                                <span className="text-xs text-slate-500">{formatDate(file.uploadedAt)}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteFile(file)}
                              className="flex-shrink-0 text-rose-600 hover:text-rose-700 transition-colors p-1"
                              title="Excluir arquivo"
                            >
                              <span className="material-symbols-outlined text-lg">delete</span>
                            </button>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500 text-center py-8">Nenhum arquivo enviado ainda</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        )}

        {activeManagementTab === 'billing' && (
          <div className="p-8">
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
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{currentProject.name}</span>
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
                            <td className="px-6 py-4 text-sm text-slate-500">
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
                                {sortedInvoices.length > 1 && (
                                  <span className="text-[10px] font-normal text-slate-500">
                                    {index + 1}/{sortedInvoices.length}
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
                                      const allPaid = updatedInvoices.every(inv => inv.status === 'Paid');
                                      if (allPaid !== currentProject.isPaid) {
                                        await updateProject(currentProject.id, { isPaid: allPaid });
                                      }
                                    } catch (error) {
                                      console.error("Error updating invoice:", error);
                                    }
                                  }}
                                  className={`flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                                    invoice.status === 'Paid'
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
                                      const allPaid = updatedInvoices.every(inv => inv.status === 'Paid');
                                      if (allPaid !== currentProject.isPaid) {
                                        await updateProject(currentProject.id, { isPaid: allPaid });
                                      }
                                    } catch (error) {
                                      console.error("Error updating invoice:", error);
                                    }
                                  }}
                                  className={`flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                                    invoice.status === 'Pending'
                                      ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-700'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-red-100 hover:text-red-700 hover:border-red-300'
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
          </div>
        )}

        {activeManagementTab === 'roadmap' && (
          <div className="p-8">
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
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{currentProject.name}</span>
              </div>
              <div className="flex flex-wrap justify-between items-end gap-3 border-b border-slate-200 dark:border-slate-800 pb-6 mb-6">
                <div className="flex flex-col gap-1">
                  <h1 className="text-3xl font-black leading-tight tracking-tight">Roteiro do Projeto</h1>
                  <p className="text-slate-500 text-sm">Acompanhe os marcos e entregas do projeto</p>
                </div>
                <button className="flex items-center px-4 h-10 bg-primary text-white rounded-lg text-xs font-bold hover:bg-blue-700">
                  <span className="material-symbols-outlined text-[18px] mr-2">add</span> Novo Marco
                </button>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8">
                <div className="relative">
                  {[
                    { id: '1', title: 'Kickoff do Projeto', date: '15 Jan, 2024', status: 'completed', description: 'Reunião inicial com o cliente' },
                    { id: '2', title: 'Briefing Aprovado', date: '20 Jan, 2024', status: 'completed', description: 'Documentação de requisitos finalizada' },
                    { id: '3', title: 'Design Inicial', date: '25 Jan, 2024', status: 'current', description: 'Primeiros mockups e wireframes' },
                    { id: '4', title: 'Desenvolvimento', date: '01 Fev, 2024', status: 'pending', description: 'Início da fase de codificação' },
                    { id: '5', title: 'Testes e QA', date: '15 Fev, 2024', status: 'pending', description: 'Validação e correções' },
                    { id: '6', title: 'Lançamento', date: '01 Mar, 2024', status: 'pending', description: 'Deploy em produção' },
                  ].map((milestone, index) => (
                    <div key={milestone.id} className="flex gap-6 pb-8 last:pb-0">
                      <div className="flex flex-col items-center">
                        <div className={`size-12 rounded-full flex items-center justify-center font-bold text-sm ${
                          milestone.status === 'completed' ? 'bg-green-500 text-white' :
                          milestone.status === 'current' ? 'bg-primary text-white ring-4 ring-primary/20' :
                          'bg-slate-200 text-slate-400'
                        }`}>
                          {milestone.status === 'completed' ? (
                            <span className="material-symbols-outlined">check</span>
                          ) : (
                            <span>{index + 1}</span>
                          )}
                        </div>
                        {index < 5 && (
                          <div className={`w-0.5 h-full mt-2 ${
                            milestone.status === 'completed' ? 'bg-green-500' : 'bg-slate-200'
                          }`} style={{ minHeight: '80px' }}></div>
                        )}
                      </div>
                      <div className="flex-1 pb-8">
                        <div className={`p-4 rounded-lg border-2 ${
                          milestone.status === 'completed' ? 'border-green-200 bg-green-50/50 dark:bg-green-900/10' :
                          milestone.status === 'current' ? 'border-primary bg-primary/5' :
                          'border-slate-200 bg-slate-50 dark:bg-slate-800/50'
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-bold">{milestone.title}</h3>
                            <span className="text-sm text-slate-500">{milestone.date}</span>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400">{milestone.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal Adicionar Credencial */}
      {showAddCredential && (
        <AddCredentialModal
          onClose={() => setShowAddCredential(false)}
          onSave={(credentialData) => {
            const newCredential = {
              id: Date.now().toString(),
              ...credentialData
            };
            setCredentials([...credentials, newCredential]);
            setShowAddCredential(false);
            setToast({ message: "Credencial adicionada com sucesso!", type: 'success' });
            setTimeout(() => setToast(null), 3000);
          }}
        />
      )}

      {/* Modal Editar Credencial */}
      {showEditCredential && (
        <EditCredentialModal
          credential={showEditCredential}
          onClose={() => setShowEditCredential(null)}
          onSave={(credentialData) => {
            setCredentials(credentials.map(c => c.id === showEditCredential.id ? { ...c, ...credentialData } : c));
            setShowEditCredential(null);
            setToast({ message: "Credencial atualizada com sucesso!", type: 'success' });
            setTimeout(() => setToast(null), 3000);
          }}
        />
      )}

      {/* Modal Adicionar Atividade */}
      {showAddActivity && (
        <AddActivityModal
          projectId={currentProject.id}
          onClose={() => setShowAddActivity(false)}
          onSave={async (activityData) => {
            try {
              console.log("Adding activity:", { projectId: currentProject.id, ...activityData });
              const activityId = await addActivity({
                projectId: currentProject.id,
                text: activityData.text,
                icon: activityData.icon,
                userName: activityData.userName || 'Usuário',
              });
              console.log("Activity added successfully:", activityId);
              setShowAddActivity(false);
            } catch (error: any) {
              console.error("Error adding activity:", error);
              const errorMessage = error?.message || "Erro desconhecido";
              alert(`Erro ao adicionar atividade: ${errorMessage}. Verifique o console para mais detalhes.`);
            }
          }}
        />
      )}

      {/* Modal Adicionar Membro */}
      {showAddMember && (
        <AddMemberModal
          projectId={currentProject.id}
          onClose={() => setShowAddMember(false)}
          onSave={async (memberData) => {
            try {
              console.log("Adding team member:", { projectId: currentProject.id, ...memberData });
              const memberId = await addTeamMember({
                projectId: currentProject.id,
                name: memberData.name,
                role: memberData.role,
                avatar: memberData.avatar || `https://picsum.photos/seed/${memberData.name}/40/40`,
                email: memberData.email,
              });
              console.log("Team member added successfully:", memberId);
              setShowAddMember(false);
            } catch (error: any) {
              console.error("Error adding team member:", error);
              const errorMessage = error?.message || "Erro desconhecido";
              alert(`Erro ao adicionar membro: ${errorMessage}. Verifique o console para mais detalhes.`);
            }
          }}
        />
      )}

      {/* Modal Ver Todos os Membros */}
      {showAllMembers && (
        <AllMembersModal
          members={teamMembers}
          onClose={() => setShowAllMembers(false)}
          onRemove={(memberId) => {
            const member = teamMembers.find(m => m.id === memberId);
            if (member) {
              setMemberToRemove(member);
            }
          }}
        />
      )}

      {/* Modal Editar Projeto */}
      {showEditProject && (
        <EditProjectModal
          project={currentProject}
          onClose={() => setShowEditProject(false)}
          onSave={async (updatedData) => {
            try {
              await updateProject(currentProject.id, updatedData);
              // Atualiza o estado local imediatamente para refletir as mudanças
              setCurrentProject(prev => ({ ...prev, ...updatedData }));
              setToast({ message: "Projeto atualizado com sucesso!", type: 'success' });
              setTimeout(() => setToast(null), 3000);
            } catch (error: any) {
              console.error("Error updating project:", error);
              setToast({ message: "Erro ao atualizar projeto. Tente novamente.", type: 'error' });
              setTimeout(() => setToast(null), 3000);
            }
          }}
        />
      )}

      {/* Modal Compartilhar Projeto */}
      {showShareProject && (
        <ShareProjectModal
          project={currentProject}
          onClose={() => setShowShareProject(false)}
        />
      )}

      {/* Modal Confirmar Exclusão de Arquivo */}
      {fileToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-full max-w-md">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-4 mb-4">
                <div className="size-12 rounded-full bg-rose-100 dark:bg-rose-900/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-rose-600 dark:text-rose-400">warning</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold">Excluir Arquivo</h3>
                  <p className="text-sm text-slate-500 mt-1">Esta ação não pode ser desfeita</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Tem certeza que deseja excluir <span className="font-bold">"{fileToDelete.name}"</span>?
              </p>
            </div>
            <div className="p-6 flex items-center justify-end gap-3">
              <button 
                onClick={() => setFileToDelete(null)}
                className="px-6 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDeleteFile}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Remoção de Membro */}
      {memberToRemove && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-full max-w-md">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-4 mb-4">
                <div className="size-12 rounded-full bg-rose-100 dark:bg-rose-900/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-rose-600 dark:text-rose-400">warning</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold">Remover Membro</h3>
                  <p className="text-sm text-slate-500 mt-1">Esta ação não pode ser desfeita</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Tem certeza que deseja remover <span className="font-bold">"{memberToRemove.name}"</span> da equipe?
              </p>
            </div>
            <div className="p-6 flex items-center justify-end gap-3">
              <button 
                onClick={() => setMemberToRemove(null)}
                className="px-6 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmRemoveMember}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors"
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteProjectConfirm && (
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
                Tem certeza que deseja excluir o projeto <span className="font-bold">"{currentProject.name}"</span>? Todos os dados relacionados serão perdidos permanentemente.
              </p>
            </div>
            <div className="p-6 flex items-center justify-end gap-3">
              <button 
                onClick={() => setShowDeleteProjectConfirm(false)}
                className="px-6 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={async () => {
                  try {
                    await deleteProject(currentProject.id);
                    setToast({ message: "Projeto excluído com sucesso!", type: 'success' });
                    setTimeout(() => {
                      setShowDeleteProjectConfirm(false);
                      onClose();
                    }, 1000);
                  } catch (error) {
                    console.error("Error deleting project:", error);
                    setToast({ message: "Erro ao excluir projeto. Tente novamente.", type: 'error' });
                    setTimeout(() => setToast(null), 3000);
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

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-[slideIn_0.3s_ease-out]">
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

      {/* Modal Adicionar Nova Fatura */}
      {showAddInvoice && (
        <AddInvoiceModal
          projectId={currentProject.id}
          workspaceId={currentProject.workspaceId}
          defaultNumber={(() => {
            const year = new Date().getFullYear();
            const count = invoices.length + 1;
            return `INV-${year}-${count.toString().padStart(3, '0')}`;
          })()}
          onClose={() => setShowAddInvoice(false)}
          onSave={async (invoiceData) => {
            try {
              await addInvoice({
                ...invoiceData,
                projectId: currentProject.id,
                workspaceId: currentProject.workspaceId
              });
              setShowAddInvoice(false);
              setToast({ message: "Fatura criada com sucesso!", type: 'success' });
              setTimeout(() => setToast(null), 3000);
            } catch (error) {
              console.error("Error adding invoice:", error);
              setToast({ message: "Erro ao criar fatura. Tente novamente.", type: 'error' });
              setTimeout(() => setToast(null), 3000);
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
              setToast({ message: "Fatura atualizada com sucesso!", type: 'success' });
              setTimeout(() => setToast(null), 3000);
            } catch (error) {
              console.error("Error updating invoice:", error);
              setToast({ message: "Erro ao atualizar fatura. Tente novamente.", type: 'error' });
              setTimeout(() => setToast(null), 3000);
            }
          }}
        />
      )}
    </div>
    </>
  );
};

const ActivityItem: React.FC<{ icon: string; text: string; date: string }> = ({ icon, text, date }) => (
  <div className="flex items-start gap-3">
    <span className="material-symbols-outlined text-primary">{icon}</span>
    <div className="flex-1">
      <p className="text-sm font-medium">{text}</p>
      <p className="text-xs text-slate-500">{date}</p>
    </div>
  </div>
);

const ContactInfo: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="py-2">
    <p className="text-slate-500 text-xs mb-0.5">{label}</p>
    <p className="text-sm font-semibold">{value}</p>
  </div>
);

const DatePicker: React.FC<{ selectedDate: Date | null; onSelectDate: (date: Date | null) => void; onClose: () => void }> = ({ selectedDate, onSelectDate, onClose }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const today = new Date();
  
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const lastDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  const startingDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();
  
  const days = [];
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
    // Comparar apenas ano, mês e dia para evitar problemas de timezone
    return date.getFullYear() === selectedDate.getFullYear() &&
           date.getMonth() === selectedDate.getMonth() &&
           date.getDate() === selectedDate.getDate();
  };
  
  const handleDateClick = (date: Date | null) => {
    if (date) {
      // Criar data no horário local para evitar problemas de timezone
      const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      onSelectDate(localDate);
    }
  };
  
  const clearDate = () => {
    onSelectDate(null);
  };
  
  return (
    <div className="absolute bottom-full left-0 mb-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg z-[60] p-4 w-72">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <span className="material-symbols-outlined text-lg text-slate-600 dark:text-slate-400">chevron_left</span>
        </button>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          {months[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h3>
        <button
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
      
      <div className="flex items-center justify-start mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
        <button
          onClick={clearDate}
          className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
        >
          Limpar
        </button>
      </div>
    </div>
  );
};

// DatePicker para modais de fatura - renderiza como modal fixo
const InvoiceDatePicker: React.FC<{ selectedDate: Date | null; onSelectDate: (date: Date | null) => void; onClose: () => void }> = ({ selectedDate, onSelectDate, onClose }) => {
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

const TabLink: React.FC<{ label: string; icon: string; active?: boolean; badge?: string; onClick?: () => void }> = ({ label, icon, active, badge, onClick }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2 border-b-[3px] pb-3 pt-4 font-bold text-sm transition-colors ${
      active ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-primary'
    }`}
  >
    <span className="material-symbols-outlined text-[18px]">{icon}</span>
    {label}
    {badge && <span className="ml-1 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] rounded">{badge}</span>}
  </button>
);

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

const CredentialCard: React.FC<{ 
  title: string; 
  sub: string; 
  icon: string; 
  url: string; 
  user: string; 
  password: string;
  onEdit?: () => void;
  onDelete?: () => void;
}> = ({ title, sub, icon, url, user, password, onEdit, onDelete }) => {
  const [showPassword, setShowPassword] = useState(false);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    // TODO: Mostrar toast de sucesso
  };

  return (
    <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col gap-3">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded bg-white dark:bg-slate-900 flex items-center justify-center border border-slate-100 dark:border-slate-800">
            <span className="material-symbols-outlined text-primary">{icon}</span>
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">{title}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{sub}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={onEdit}
            className="text-slate-400 hover:text-primary transition-colors p-1"
            title="Editar credencial"
          >
            <span className="material-symbols-outlined text-[18px]">edit</span>
          </button>
          {onDelete && (
            <button 
              onClick={onDelete}
              className="text-slate-400 hover:text-red-500 transition-colors p-1"
              title="Excluir credencial"
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
            </button>
          )}
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between items-center text-xs py-1 border-b border-slate-100 dark:border-slate-800">
          <span className="text-slate-500 dark:text-slate-400">URL</span>
          <div className="flex items-center gap-2">
            <span className="text-primary font-medium">{url}</span>
            <button 
              onClick={() => copyToClipboard(url, 'URL')}
              className="text-slate-400 hover:text-primary transition-colors"
              title="Copiar URL"
            >
              <span className="material-symbols-outlined text-[14px]">content_copy</span>
            </button>
          </div>
        </div>
        <div className="flex justify-between items-center text-xs py-1 border-b border-slate-100 dark:border-slate-800">
          <span className="text-slate-500 dark:text-slate-400">Usuário</span>
          <div className="flex items-center gap-2">
            <span className="font-medium">{user}</span>
            <button 
              onClick={() => copyToClipboard(user, 'Usuário')}
              className="text-slate-400 hover:text-primary transition-colors"
              title="Copiar usuário"
            >
              <span className="material-symbols-outlined text-[14px]">content_copy</span>
            </button>
          </div>
        </div>
        <div className="flex justify-between items-center text-xs py-1">
          <span className="text-slate-500 dark:text-slate-400">Senha</span>
          <div className="flex items-center gap-2">
            <span className="font-medium">{showPassword ? password : '••••••••'}</span>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setShowPassword(!showPassword)}
                className="text-slate-400 hover:text-primary transition-colors"
                title={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                <span className="material-symbols-outlined text-[14px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
              </button>
              <button 
                onClick={() => copyToClipboard(password, 'Senha')}
                className="text-slate-400 hover:text-primary transition-colors"
                title="Copiar senha"
              >
                <span className="material-symbols-outlined text-[14px]">content_copy</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const AddCredentialModal: React.FC<{ onClose: () => void; onSave: (data: { title: string; sub: string; icon: string; url: string; user: string; password: string }) => void }> = ({ onClose, onSave }) => {
  const [formData, setFormData] = useState({ title: '', sub: '', icon: 'dns', url: '', user: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const iconOptions = [
    { value: 'dns', label: 'DNS', icon: 'dns' },
    { value: 'data_object', label: 'API', icon: 'data_object' },
    { value: 'storage', label: 'Storage', icon: 'storage' },
    { value: 'cloud', label: 'Cloud', icon: 'cloud' },
    { value: 'database', label: 'Database', icon: 'database' },
    { value: 'key', label: 'Key', icon: 'key' },
    { value: 'web', label: 'WordPress', icon: 'web' },
    { value: 'rocket_launch', label: 'Vercel', icon: 'rocket_launch' },
    { value: 'code', label: 'GitHub', icon: 'code' },
    { value: 'more_horiz', label: 'Outro', icon: 'more_horiz' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.title.trim() && formData.url.trim() && formData.user.trim()) {
      onSave(formData);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-xl font-bold">Adicionar Credencial</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Título</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder="Ex: WP Engine Hosting"
              required
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Subtítulo</label>
            <input
              type="text"
              value={formData.sub}
              onChange={(e) => setFormData({ ...formData, sub: e.target.value })}
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder="Ex: Servidor de Produção"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 block">Ícone</label>
            <div className="grid grid-cols-5 gap-2">
              {iconOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, icon: option.value })}
                  className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center justify-center gap-1 ${
                    formData.icon === option.value
                      ? 'border-primary bg-primary/10'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-primary/50'
                  }`}
                  title={option.label}
                >
                  <span className={`material-symbols-outlined text-xl ${
                    formData.icon === option.value ? 'text-primary' : 'text-slate-600 dark:text-slate-400'
                  }`}>
                    {option.icon}
                  </span>
                  <span className={`text-[10px] font-medium ${
                    formData.icon === option.value ? 'text-primary' : 'text-slate-500 dark:text-slate-400'
                  }`}>
                    {option.label.length > 8 ? option.label.substring(0, 6) + '..' : option.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">URL</label>
            <input
              type="text"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder="Ex: wpengine.example.com"
              required
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Usuário</label>
            <input
              type="text"
              value={formData.user}
              onChange={(e) => setFormData({ ...formData, user: e.target.value })}
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder="Ex: admin_user"
              required
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Senha</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-2.5 pr-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="••••••••"
              />
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  togglePasswordVisibility();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  togglePasswordVisibility();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors z-20 cursor-pointer select-none"
                title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    togglePasswordVisibility();
                  }
                }}
              >
                <span className="material-symbols-outlined text-lg pointer-events-none">{showPassword ? 'visibility_off' : 'visibility'}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="px-6 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-blue-700 transition-colors"
            >
              Adicionar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const EditCredentialModal: React.FC<{ 
  credential: { id: string; title: string; sub: string; icon: string; url: string; user: string; password: string }; 
  onClose: () => void; 
  onSave: (data: { title: string; sub: string; icon: string; url: string; user: string; password: string }) => void 
}> = ({ credential, onClose, onSave }) => {
  const [formData, setFormData] = useState(credential);
  const [showPassword, setShowPassword] = useState(false);
  const iconOptions = [
    { value: 'dns', label: 'DNS', icon: 'dns' },
    { value: 'data_object', label: 'API', icon: 'data_object' },
    { value: 'storage', label: 'Storage', icon: 'storage' },
    { value: 'cloud', label: 'Cloud', icon: 'cloud' },
    { value: 'database', label: 'Database', icon: 'database' },
    { value: 'key', label: 'Key', icon: 'key' },
    { value: 'web', label: 'WordPress', icon: 'web' },
    { value: 'rocket_launch', label: 'Vercel', icon: 'rocket_launch' },
    { value: 'code', label: 'GitHub', icon: 'code' },
    { value: 'more_horiz', label: 'Outro', icon: 'more_horiz' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.title.trim() && formData.url.trim() && formData.user.trim()) {
      onSave(formData);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-xl font-bold">Editar Credencial</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Título</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder="Ex: WP Engine Hosting"
              required
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Subtítulo</label>
            <input
              type="text"
              value={formData.sub}
              onChange={(e) => setFormData({ ...formData, sub: e.target.value })}
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder="Ex: Servidor de Produção"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 block">Ícone</label>
            <div className="grid grid-cols-5 gap-2">
              {iconOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, icon: option.value })}
                  className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center justify-center gap-1 ${
                    formData.icon === option.value
                      ? 'border-primary bg-primary/10'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-primary/50'
                  }`}
                  title={option.label}
                >
                  <span className={`material-symbols-outlined text-xl ${
                    formData.icon === option.value ? 'text-primary' : 'text-slate-600 dark:text-slate-400'
                  }`}>
                    {option.icon}
                  </span>
                  <span className={`text-[10px] font-medium ${
                    formData.icon === option.value ? 'text-primary' : 'text-slate-500 dark:text-slate-400'
                  }`}>
                    {option.label.length > 8 ? option.label.substring(0, 6) + '..' : option.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">URL</label>
            <input
              type="text"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder="Ex: wpengine.example.com"
              required
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Usuário</label>
            <input
              type="text"
              value={formData.user}
              onChange={(e) => setFormData({ ...formData, user: e.target.value })}
              className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
              placeholder="Ex: admin_user"
              required
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Senha</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-2.5 pr-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                placeholder="••••••••"
              />
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  togglePasswordVisibility();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  togglePasswordVisibility();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors z-20 cursor-pointer select-none"
                title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    togglePasswordVisibility();
                  }
                }}
              >
                <span className="material-symbols-outlined text-lg pointer-events-none">{showPassword ? 'visibility_off' : 'visibility'}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="px-6 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-blue-700 transition-colors"
            >
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AddActivityModal: React.FC<{ projectId: string; onClose: () => void; onSave: (data: { text: string; icon: string; userName?: string }) => void }> = ({ onClose, onSave }) => {
  const [formData, setFormData] = useState({ text: '', icon: 'check_circle', userName: '' });
  const iconOptions = [
    { value: 'check_circle', label: 'Concluído' },
    { value: 'description', label: 'Documento' },
    { value: 'person', label: 'Equipe' },
    { value: 'comment', label: 'Comentário' },
    { value: 'update', label: 'Atualização' },
    { value: 'event', label: 'Evento' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.text.trim()) {
      console.log("Form submitted with data:", formData);
      try {
        await onSave(formData);
      } catch (error) {
        console.error("Error in handleSubmit:", error);
      }
    } else {
      alert("Por favor, preencha a descrição da atividade.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-full max-w-md">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-xl font-bold">Adicionar Atividade</h3>
          <button onClick={onClose} className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Descrição da Atividade</label>
            <textarea
              value={formData.text}
              onChange={(e) => setFormData({ ...formData, text: e.target.value })}
              rows={3}
              className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary resize-none"
              placeholder="Ex: Briefing aprovado pelo cliente"
              required
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Tipo de Atividade</label>
            <select
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary"
            >
              {iconOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button type="button" onClick={onClose} className="px-6 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors">
              Cancelar
            </button>
            <button type="submit" className="px-8 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 transition-all">
              Adicionar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AddMemberModal: React.FC<{ projectId: string; onClose: () => void; onSave: (data: { name: string; role?: string; avatar?: string; email?: string }) => void }> = ({ onClose, onSave }) => {
  const [formData, setFormData] = useState({ name: '', role: '', email: '', avatar: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name.trim()) {
      console.log("Form submitted with data:", formData);
      try {
        await onSave(formData);
      } catch (error) {
        console.error("Error in handleSubmit:", error);
      }
    } else {
      alert("Por favor, preencha o nome do membro.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-full max-w-md">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-xl font-bold">Adicionar Membro</h3>
          <button onClick={onClose} className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Nome</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary"
              placeholder="Nome do membro"
              required
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Função/Cargo</label>
            <input
              type="text"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary"
              placeholder="Ex: Designer, Desenvolvedor"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">E-mail (opcional)</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary"
              placeholder="email@exemplo.com"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">URL do Avatar (opcional)</label>
            <input
              type="url"
              value={formData.avatar}
              onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
              className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary"
              placeholder="https://exemplo.com/avatar.jpg"
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button type="button" onClick={onClose} className="px-6 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors">
              Cancelar
            </button>
            <button type="submit" className="px-8 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 transition-all">
              Adicionar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AllMembersModal: React.FC<{ members: TeamMember[]; onClose: () => void; onRemove: (memberId: string) => void }> = ({ members, onClose, onRemove }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-xl font-bold">Membros da Equipe</h3>
          <button onClick={onClose} className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-6">
          {members.length > 0 ? (
            <div className="space-y-3">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div 
                      className="size-12 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200"
                      style={{ backgroundImage: `url(${member.avatar})`, backgroundSize: 'cover' }}
                    ></div>
                    <div>
                      <p className="font-semibold">{member.name}</p>
                      {member.role && <p className="text-sm text-slate-500">{member.role}</p>}
                      {member.email && <p className="text-xs text-slate-400">{member.email}</p>}
                    </div>
                  </div>
                  <button
                    onClick={() => onRemove(member.id)}
                    className="size-8 flex items-center justify-center rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/20 text-rose-500 transition-colors"
                    title="Remover membro"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-500">Nenhum membro adicionado ainda</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const EditProjectModal: React.FC<{ project: Project; onClose: () => void; onSave: (data: Partial<Project>) => void }> = ({ project, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: project.name,
    client: project.client,
    description: project.description,
    type: project.type,
    status: project.status,
    progress: project.progress,
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialFormDataRef = useRef(formData);
  const hasUserInteracted = useRef(false);
  const [availableClients, setAvailableClients] = useState<string[]>([]);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [filteredClients, setFilteredClients] = useState<string[]>([]);
  const clientInputRef = useRef<HTMLInputElement>(null);

  // Usar workspaceId do projeto para filtrar categorias e clientes
  const workspaceId = project.workspaceId;

  useEffect(() => {
    const unsubscribeCategories = subscribeToCategories((firebaseCategories) => {
      // Filtrar categorias pelo workspaceId do projeto
      // Se temos workspaceId, incluir APENAS categorias com esse workspaceId (excluir sem workspaceId)
      let filteredCategories = workspaceId 
        ? firebaseCategories.filter(cat => cat.workspaceId === workspaceId && cat.workspaceId !== undefined)
        : firebaseCategories;
      
      // Remover duplicatas baseado no nome (caso existam categorias duplicadas)
      const uniqueCategories = filteredCategories.reduce((acc, cat) => {
        if (!acc.find(c => c.name === cat.name)) {
          acc.push(cat);
        }
        return acc;
      }, [] as Category[]);
      
      // Ordenar por nome
      uniqueCategories.sort((a, b) => a.name.localeCompare(b.name));
      
      setCategories(uniqueCategories);
    }, workspaceId);

    const unsubscribeStages = subscribeToStages((firebaseStages) => {
      // Filtrar etapas pelo workspaceId do projeto
      const filteredStages = workspaceId
        ? firebaseStages.filter(stage => (stage as any).workspaceId === workspaceId)
        : firebaseStages;
      setStages(filteredStages);
    }, workspaceId);

    // Load available clients filtrados por workspaceId
    getUniqueClients(workspaceId).then(clients => {
      setAvailableClients(clients);
    });

    return () => {
      unsubscribeCategories();
      unsubscribeStages();
    };
  }, [workspaceId]);

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

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clientInputRef.current && !clientInputRef.current.contains(event.target as Node)) {
        setShowClientSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Auto-save quando formData mudar (apenas se o usuário interagiu)
  useEffect(() => {
    // Só salva se o usuário já interagiu com o formulário
    if (!hasUserInteracted.current) {
      return;
    }

    // Verifica se realmente houve mudança comparando com os dados iniciais
    const hasChanged = JSON.stringify(formData) !== JSON.stringify(initialFormDataRef.current);
    if (!hasChanged) {
      return;
    }

    // Limpa o timeout anterior se houver
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Define um novo timeout para salvar após 800ms de inatividade
    saveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        const selectedStage = stages.find(s => s.status === formData.status);
        const dataToSave = selectedStage 
          ? { ...formData, progress: selectedStage.progress }
          : formData;
        
        await onSave(dataToSave);
        setLastSaved(new Date());
        // Atualiza os dados iniciais após salvar
        initialFormDataRef.current = { ...formData };
        // Esconde a mensagem de "Salvo automaticamente" após 2 segundos
        setTimeout(() => {
          setLastSaved(null);
        }, 2000);
      } catch (error) {
        console.error("Error auto-saving project:", error);
      } finally {
        setIsSaving(false);
      }
    }, 800);

    // Limpa o timeout quando o componente desmontar
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, stages, onSave]);

  // Auto-save implementado via useEffect acima

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-xl font-bold">Editar Projeto</h3>
          <button onClick={onClose} className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-6 space-y-4">
          {(isSaving || lastSaved) && (
            <div className={`mb-4 flex items-center gap-2 text-sm ${
              isSaving ? 'text-primary' : 'text-emerald-600 dark:text-emerald-400'
            }`}>
              <span className={`material-symbols-outlined text-base ${isSaving ? 'animate-spin' : ''}`}>
                {isSaving ? 'sync' : 'check_circle'}
              </span>
              <span>{isSaving ? 'Salvando...' : 'Salvo automaticamente'}</span>
            </div>
          )}
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Nome do Projeto</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => {
                hasUserInteracted.current = true;
                setFormData({ ...formData, name: e.target.value });
              }}
              className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary"
              required
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Cliente</label>
            <div className="relative" ref={clientInputRef}>
              <input
                type="text"
                value={formData.client}
                onChange={(e) => {
                  hasUserInteracted.current = true;
                  setFormData({ ...formData, client: e.target.value });
                }}
                onFocus={() => {
                  if (formData.client.trim() && filteredClients.length > 0) {
                    setShowClientSuggestions(true);
                  }
                }}
                className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary"
                required
              />
              {showClientSuggestions && filteredClients.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                  {filteredClients.map((client, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        hasUserInteracted.current = true;
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
              onChange={(e) => {
                hasUserInteracted.current = true;
                setFormData({ ...formData, description: e.target.value });
              }}
              rows={3}
              className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Tipo (Serviço)</label>
              <div className="relative">
                <select
                  value={formData.type}
                  onChange={(e) => {
                    hasUserInteracted.current = true;
                    setFormData({ ...formData, type: e.target.value });
                  }}
                  className="w-full px-4 py-2.5 pr-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer transition-all hover:border-primary/50"
                >
                  <option value="">Selecione um serviço</option>
                  {categories
                    .filter((cat, index, self) => 
                      // Remover duplicatas baseado no nome
                      index === self.findIndex(c => c.name === cat.name)
                    )
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((category) => (
                      <option key={category.id || category.name} value={category.name}>
                        {category.name}
                      </option>
                    ))}
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
                  value={formData.status}
                  onChange={(e) => {
                    hasUserInteracted.current = true;
                    const selectedStatus = e.target.value as Project['status'];
                    const selectedStage = stages.find(s => s.status === selectedStatus);
                    setFormData({ 
                      ...formData, 
                      status: selectedStatus,
                      progress: selectedStage ? selectedStage.progress : formData.progress
                    });
                  }}
                  className="w-full px-4 py-2.5 pr-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary appearance-none cursor-pointer transition-all hover:border-primary/50"
                >
                  <option value="">Selecione uma etapa</option>
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.status}>
                      {stage.title}
                    </option>
                  ))}
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <span className="material-symbols-outlined text-lg">expand_more</span>
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
            <button type="button" onClick={onClose} className="px-8 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 transition-all">
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ShareProjectModal: React.FC<{ project: Project; onClose: () => void }> = ({ project, onClose }) => {
  const [copied, setCopied] = useState(false);
  const shareUrl = `${window.location.origin}/project/${project.id}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-full max-w-md">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-xl font-bold">Compartilhar Projeto</h3>
          <button onClick={onClose} className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Link do Projeto</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 px-4 py-2.5 bg-slate-50 border-slate-200 rounded-lg text-sm"
              />
              <button
                onClick={handleCopy}
                className="px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">{copied ? 'check' : 'content_copy'}</span>
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <p className="text-sm text-slate-500 mb-3">Compartilhar em:</p>
            <div className="flex gap-2">
              <button 
                onClick={() => window.open(`mailto:?subject=${encodeURIComponent(project.name)}&body=${encodeURIComponent(shareUrl)}`, '_blank')}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">mail</span>
                E-mail
              </button>
              <button 
                onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`${project.name} - ${shareUrl}`)}`, '_blank')}
                className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">chat</span>
                WhatsApp
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const AddInvoiceModal: React.FC<{
  projectId: string;
  workspaceId?: string;
  defaultNumber: string;
  onClose: () => void;
  onSave: (invoice: Omit<Invoice, "id">) => Promise<void>;
}> = ({ projectId, workspaceId, defaultNumber, onClose, onSave }) => {
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
                  <InvoiceDatePicker
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
            <h2 className="text-xl font-bold">Editar Fatura</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

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
                  <InvoiceDatePicker
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
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

