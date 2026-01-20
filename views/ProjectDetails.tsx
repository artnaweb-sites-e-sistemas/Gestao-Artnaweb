
import React, { useState, useEffect, useRef } from 'react';
import { Project, Activity, TeamMember, StageTask, ProjectStageTask, ProjectFile } from '../types';
import { 
  subscribeToProjectActivities, 
  subscribeToProjectTeamMembers,
  addActivity,
  addTeamMember,
  removeTeamMember,
  updateProject,
  subscribeToCategories,
  subscribeToStages,
  Stage,
  getStageTasks,
  subscribeToProjectStageTasks,
  toggleProjectStageTask,
  initializeProjectStageTasks,
  subscribeToProjectFiles,
  uploadProjectFile,
  deleteProjectFile
} from '../firebase/services';

interface ProjectDetailsProps {
  project: Project;
  onClose: () => void;
}

export const ProjectDetails: React.FC<ProjectDetailsProps> = ({ project, onClose }) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);
  const [showShareProject, setShowShareProject] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [stageTasks, setStageTasks] = useState<{ [stageId: string]: StageTask[] }>({});
  const [projectStageTasks, setProjectStageTasks] = useState<ProjectStageTask[]>([]);
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);
  const [fileToDelete, setFileToDelete] = useState<ProjectFile | null>(null);

  useEffect(() => {
    if (!project.id) {
      console.error("Project ID is missing:", project);
      return;
    }

    console.log("Subscribing to activities and members for project:", project.id);
    
    const unsubscribeActivities = subscribeToProjectActivities(project.id, (data) => {
      console.log("Activities updated:", data);
      setActivities(data);
    });

    const unsubscribeMembers = subscribeToProjectTeamMembers(project.id, (data) => {
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

    const unsubscribeProjectStageTasks = subscribeToProjectStageTasks(project.id, (data) => {
      setProjectStageTasks(data);
    });

    const unsubscribeProjectFiles = subscribeToProjectFiles(project.id, (data) => {
      setProjectFiles(data);
    });

    // Inicializar tarefas do projeto para a etapa atual
    initializeProjectStageTasks(project.id, project.status).catch(console.error);

    return () => {
      unsubscribeActivities();
      unsubscribeMembers();
      unsubscribeStages();
      unsubscribeProjectStageTasks();
      unsubscribeProjectFiles();
    };
  }, [project.id, project.status]);

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
        await uploadProjectFile(project.id, files[i]);
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
  return (
    <div className="p-8 h-full bg-slate-50 dark:bg-slate-900/20 overflow-y-auto">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex items-center gap-4">
          <button 
            onClick={onClose}
            className="size-10 flex items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded ${
                project.tagColor === 'amber' ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' :
                project.tagColor === 'blue' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' :
                project.tagColor === 'emerald' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' :
                'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
              }`}>
                {project.type}
              </span>
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
            </div>
            <h1 className="text-3xl font-black tracking-tight">{project.name}</h1>
            <p className="text-slate-500 text-sm mt-1">Cliente: {project.client}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
              <h2 className="text-lg font-bold mb-4">Descrição do Projeto</h2>
              <p className="text-slate-600 dark:text-slate-400">{project.description}</p>
            </div>

            {/* Tarefas por Etapa */}
            {stages.length > 0 && Object.keys(stageTasks).length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
                <h2 className="text-lg font-bold mb-4">Tarefas do Projeto</h2>
                <div className="space-y-6">
                  {stages.map((stage) => {
                    const tasks = stageTasks[stage.id] || [];
                    if (tasks.length === 0) return null;
                    
                    const isCurrentStage = stage.status === project.status;
                    
                    // Encontrar a ordem da etapa atual
                    const currentStage = stages.find(s => s.status === project.status);
                    const currentStageOrder = currentStage?.order ?? -1;
                    const stageOrder = stage.order;
                    
                    // Verificar se é uma etapa anterior à atual (ordem menor)
                    const isPreviousStage = stageOrder < currentStageOrder;
                    
                    // Verificar se todas as tarefas da etapa estão concluídas
                    const allTasksCompleted = tasks.every((task) => {
                      const projectTask = projectStageTasks.find(
                        pt => pt.stageTaskId === task.id && pt.stageId === stage.id
                      );
                      return projectTask?.completed || false;
                    });
                    
                    // Se todas as tarefas estão concluídas E (é etapa atual OU é etapa anterior), usar verde
                    const isCompleted = allTasksCompleted && (isCurrentStage || isPreviousStage);
                    
                    return (
                      <div 
                        key={stage.id} 
                        className={`space-y-3 p-3 rounded-lg border transition-all ${
                          isCompleted
                            ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/30'
                            : isCurrentStage 
                            ? 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-300 dark:border-slate-700' 
                            : 'bg-transparent border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <h3 className={`text-sm font-semibold uppercase tracking-wider ${
                            isCompleted
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : isCurrentStage 
                              ? 'text-slate-700 dark:text-slate-300' 
                              : 'text-slate-600 dark:text-slate-400'
                          }`}>
                            {stage.title}
                          </h3>
                          {(isCurrentStage || isPreviousStage) && (
                            <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${
                              isCompleted 
                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' 
                                : isCurrentStage 
                                ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300' 
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}>
                              {isCompleted ? 'CONCLUÍDA' : isCurrentStage ? 'ETAPA ATUAL' : 'ANTERIOR'}
                            </span>
                          )}
                        </div>
                        <div className="space-y-2">
                          {tasks.map((task) => {
                            const projectTask = projectStageTasks.find(
                              pt => pt.stageTaskId === task.id && pt.stageId === stage.id
                            );
                            const isTaskCompleted = projectTask?.completed || false;
                            
                            return (
                              <label
                                key={task.id}
                                className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors cursor-pointer ${
                                  isCompleted
                                    ? 'bg-white dark:bg-slate-800/50 border-emerald-200 dark:border-emerald-800/30 hover:border-emerald-300'
                                    : isCurrentStage
                                    ? 'bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isTaskCompleted}
                                  onChange={async () => {
                                    try {
                                      await toggleProjectStageTask(project.id, task.id, stage.id, !isTaskCompleted);
                                    } catch (error) {
                                      console.error("Error toggling task:", error);
                                      setToast({ message: "Erro ao atualizar tarefa. Tente novamente.", type: 'error' });
                                      setTimeout(() => setToast(null), 3000);
                                    }
                                  }}
                                  className="size-4 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                                />
                                <span className={`flex-1 text-sm ${isTaskCompleted ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                  {task.title}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mídias e Documentos */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Mídias e Documentos</h2>
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
                  <p className="text-sm text-slate-500 text-center py-4">Nenhum arquivo enviado ainda</p>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Atividades Recentes</h2>
                <button
                  onClick={() => setShowAddActivity(true)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 rounded-lg transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                  Adicionar
                </button>
              </div>
              <div className="space-y-4">
                {activities.length > 0 ? (
                  activities.slice(0, 5).map((activity) => (
                    <ActivityItem 
                      key={activity.id}
                      icon={activity.icon} 
                      text={activity.text} 
                      date={formatDate(activity.createdAt)}
                    />
                  ))
                ) : (
                  <p className="text-sm text-slate-500 text-center py-4">Nenhuma atividade registrada ainda</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
              <h3 className="text-sm font-bold mb-4 uppercase tracking-wider text-slate-500">Informações</h3>
              <div className="space-y-4">
                <InfoRow label="Cliente" value={project.client} />
                <InfoRow label="Tipo" value={project.type} />
                <InfoRow 
                  label="Etapa" 
                  value={
                    stages.find(s => s.status === project.status)?.title || 
                    (project.status === 'Lead' ? 'Leads (Proposta Enviada)' :
                     project.status === 'Active' ? 'Desenvolvimento Ativo' :
                     project.status === 'Completed' ? 'Projetos Concluídos' :
                     project.status === 'Review' ? 'Em Revisão' : project.status)
                  } 
                />
                {project.deadline && <InfoRow label="Prazo" value={project.deadline} />}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Equipe</h3>
                <button
                  onClick={() => setShowAddMember(true)}
                  className="size-6 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-primary transition-colors"
                  title="Adicionar membro"
                >
                  <span className="material-symbols-outlined text-sm">add</span>
                </button>
              </div>
              {teamMembers.length > 0 ? (
                <>
                  <div className="flex -space-x-2 mb-4 flex-wrap">
                    {teamMembers.map((member) => (
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
                    className="w-full text-sm font-bold text-primary hover:underline"
                  >
                    {teamMembers.length} {teamMembers.length === 1 ? 'membro' : 'membros'}
                  </button>
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-slate-500 mb-3">Nenhum membro adicionado</p>
                  <button
                    onClick={() => setShowAddMember(true)}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Adicionar primeiro membro
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <button 
                onClick={() => setShowEditProject(true)}
                className="w-full bg-primary text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                Editar Projeto
              </button>
              <button 
                onClick={() => setShowShareProject(true)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Compartilhar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Adicionar Atividade */}
      {showAddActivity && (
        <AddActivityModal
          projectId={project.id}
          onClose={() => setShowAddActivity(false)}
          onSave={async (activityData) => {
            try {
              console.log("Adding activity:", { projectId: project.id, ...activityData });
              const activityId = await addActivity({
                projectId: project.id,
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
          projectId={project.id}
          onClose={() => setShowAddMember(false)}
          onSave={async (memberData) => {
            try {
              console.log("Adding team member:", { projectId: project.id, ...memberData });
              const memberId = await addTeamMember({
                projectId: project.id,
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
          project={project}
          onClose={() => setShowEditProject(false)}
          onSave={async (updatedData) => {
            try {
              await updateProject(project.id, updatedData);
              setShowEditProject(false);
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
          project={project}
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
    </div>
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

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-xs text-slate-500 mb-1">{label}</p>
    <p className="text-sm font-semibold">{value}</p>
  </div>
);

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
  const [categories, setCategories] = useState<string[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);

  useEffect(() => {
    const unsubscribeCategories = subscribeToCategories((firebaseCategories) => {
      setCategories(firebaseCategories);
    });

    const unsubscribeStages = subscribeToStages((firebaseStages) => {
      setStages(firebaseStages);
    });

    return () => {
      unsubscribeCategories();
      unsubscribeStages();
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Quando o status muda, atualizar também o progresso baseado na etapa selecionada
    const selectedStage = stages.find(s => s.status === formData.status);
    if (selectedStage) {
      onSave({
        ...formData,
        progress: selectedStage.progress
      });
    } else {
      onSave(formData);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h3 className="text-xl font-bold">Editar Projeto</h3>
          <button onClick={onClose} className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
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
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Tipo (Categoria)</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary"
              >
                <option value="">Selecione uma categoria</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Etapa</label>
              <select
                value={formData.status}
                onChange={(e) => {
                  const selectedStatus = e.target.value as Project['status'];
                  const selectedStage = stages.find(s => s.status === selectedStatus);
                  setFormData({ 
                    ...formData, 
                    status: selectedStatus,
                    progress: selectedStage ? selectedStage.progress : formData.progress
                  });
                }}
                className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary"
              >
                <option value="">Selecione uma etapa</option>
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.status}>
                    {stage.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button type="button" onClick={onClose} className="px-6 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors">
              Cancelar
            </button>
            <button type="submit" className="px-8 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 transition-all">
              Salvar Alterações
            </button>
          </div>
        </form>
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

