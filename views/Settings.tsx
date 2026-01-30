import React, { useState, useRef, useEffect } from 'react';
import { Workspace, Category, Stage } from '../types';
import { updateWorkspace, uploadWorkspaceAvatar, subscribeToCategories, deleteCategoryById, subscribeToStages, getStages, deleteStage as deleteStageFromFirebase } from '../firebase/services';
import { DefineStageTasksModal } from '../components/DefineStageTasksModal';
import { TeamSettings } from '../components/TeamSettings';
import { testAsaasConnection, getWebhookUrl } from '../firebase/asaas';

interface SettingsProps {
  currentWorkspace?: Workspace | null;
  onWorkspaceUpdate?: (workspace: Workspace) => void;
  userId?: string | null;
  canEdit?: boolean;
}

// Etapas fixas para serviços padrão (não recorrentes)
const fixedStages: Stage[] = [
  { id: 'onboarding', title: 'On boarding', status: 'Lead', order: 0, progress: 10, isFixed: true },
  { id: 'development', title: 'Em desenvolvimento', status: 'Active', order: 1, progress: 25, isFixed: true },
  { id: 'review', title: 'Em Revisão', status: 'Review', order: 2, progress: 40, isFixed: true },
  { id: 'adjustments', title: 'Ajustes', status: 'Review', order: 3, progress: 55, isFixed: true },
  { id: 'completed', title: 'Concluído', status: 'Completed', order: 4, progress: 100, isFixed: true }
];

// Etapas fixas para serviços recorrentes (copiado do Dashboard)
const fixedStagesRecurring: Stage[] = [
  { id: 'onboarding-recurring', title: 'On boarding', status: 'Lead', order: 0, progress: 10, isFixed: true },
  { id: 'development-recurring', title: 'Em desenvolvimento', status: 'Active', order: 1, progress: 25, isFixed: true },
  { id: 'review-recurring', title: 'Em Revisão', status: 'Review', order: 2, progress: 40, isFixed: true },
  { id: 'adjustments-recurring', title: 'Ajustes', status: 'Review', order: 3, progress: 55, isFixed: true },
  { id: 'maintenance-recurring', title: 'Manutenção', status: 'Completed', order: 4, progress: 80, isFixed: true },
  { id: 'finished-recurring', title: 'Finalizado', status: 'Finished', order: 5, progress: 100, isFixed: true }
];

export const Settings: React.FC<SettingsProps> = ({ currentWorkspace, onWorkspaceUpdate, userId, canEdit = true }) => {
  const [activeSection, setActiveSection] = useState<'general' | 'services' | 'stages' | 'team' | 'integrations' | 'appearance' | 'danger'>('general');
  const [workspaceName, setWorkspaceName] = useState(currentWorkspace?.name || '');
  const [workspaceDescription, setWorkspaceDescription] = useState(currentWorkspace?.description || '');
  const [workspaceColor, setWorkspaceColor] = useState(currentWorkspace?.color || '#6366f1');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [stageToEditTasks, setStageToEditTasks] = useState<Stage | null>(null);
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('all');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Estados para integração Asaas
  const [asaasApiKey, setAsaasApiKey] = useState(currentWorkspace?.asaasApiKey || '');
  const [asaasEnvironment, setAsaasEnvironment] = useState<'sandbox' | 'production'>(currentWorkspace?.asaasEnvironment || 'sandbox');
  const [testingAsaas, setTestingAsaas] = useState(false);
  const [asaasStatus, setAsaasStatus] = useState<{ connected: boolean; accountName?: string; error?: string } | null>(null);
  const [savingAsaas, setSavingAsaas] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Cores predefinidas para o workspace
  const presetColors = [
    '#6366f1', // Indigo (Primary)
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#ef4444', // Red
    '#f97316', // Orange
    '#eab308', // Yellow
    '#22c55e', // Green
    '#14b8a6', // Teal
    '#0ea5e9', // Sky
    '#3b82f6', // Blue
  ];

  useEffect(() => {
    if (currentWorkspace) {
      setWorkspaceName(currentWorkspace.name || '');
      setWorkspaceDescription(currentWorkspace.description || '');
      setWorkspaceColor(currentWorkspace.color || '#6366f1');
      setAsaasApiKey(currentWorkspace.asaasApiKey || '');
      setAsaasEnvironment(currentWorkspace.asaasEnvironment || 'sandbox');
      // Reset status quando mudar de workspace
      setAsaasStatus(null);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    if (!currentWorkspace?.id) return;

    const unsubscribe = subscribeToCategories((fetchedCategories) => {
      const workspaceCategories = fetchedCategories.filter(c => c.workspaceId === currentWorkspace.id);
      setCategories(workspaceCategories);
    }, currentWorkspace.id);

    return () => unsubscribe();
  }, [currentWorkspace?.id]);

  useEffect(() => {
    if (!currentWorkspace?.id) return;

    const unsubscribe = subscribeToStages((fetchedStages) => {
      const workspaceStages = fetchedStages.filter(s => (s as any).workspaceId === currentWorkspace.id);
      // Ordenar por order
      const sortedStages = workspaceStages.sort((a, b) => (a.order || 0) - (b.order || 0));
      console.log('🔍 [Settings] Etapas carregadas:', sortedStages.length);
      console.log('🔍 [Settings] Todas as etapas:', sortedStages.map(s => ({ id: s.id, title: s.title, isFixed: s.isFixed, workspaceId: (s as any).workspaceId })));
      const customStages = sortedStages.filter(s => s.isFixed !== true);
      console.log('🔍 [Settings] Etapas customizadas:', customStages.length, customStages.map(s => ({ id: s.id, title: s.title })));
      setStages(sortedStages);
    }, currentWorkspace.id, userId);

    return () => unsubscribe();
  }, [currentWorkspace?.id, userId]);

  const handleSaveGeneral = async () => {
    if (!currentWorkspace?.id) return;

    setSaving(true);
    try {
      await updateWorkspace(currentWorkspace.id, {
        name: workspaceName,
        description: workspaceDescription,
      });

      if (onWorkspaceUpdate) {
        onWorkspaceUpdate({
          ...currentWorkspace,
          name: workspaceName,
          description: workspaceDescription,
        });
      }

      setToast({ message: 'Configurações salvas com sucesso!', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setToast({ message: 'Erro ao salvar configurações.', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAppearance = async () => {
    if (!currentWorkspace?.id) return;

    setSaving(true);
    try {
      await updateWorkspace(currentWorkspace.id, {
        color: workspaceColor,
      });

      if (onWorkspaceUpdate) {
        onWorkspaceUpdate({
          ...currentWorkspace,
          color: workspaceColor,
        });
      }

      setToast({ message: 'Aparência salva com sucesso!', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      console.error('Error saving appearance:', error);
      setToast({ message: 'Erro ao salvar aparência.', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    if (!currentWorkspace?.id) return;

    setUploadingAvatar(true);
    try {
      const avatarUrl = await uploadWorkspaceAvatar(currentWorkspace.id, file, userId);
      await updateWorkspace(currentWorkspace.id, { avatar: avatarUrl });

      if (onWorkspaceUpdate) {
        onWorkspaceUpdate({
          ...currentWorkspace,
          avatar: avatarUrl,
        });
      }

      setToast({ message: 'Foto atualizada com sucesso!', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      console.error('Error uploading avatar:', error);
      setToast({ message: 'Erro ao fazer upload da foto.', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Tem certeza que deseja excluir este serviço? Todos os projetos vinculados perderão a categoria.')) {
      return;
    }

    try {
      await deleteCategoryById(categoryId);
      setToast({ message: 'Serviço excluído com sucesso!', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      console.error('Error deleting category:', error);
      setToast({ message: 'Erro ao excluir serviço.', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleDeleteStage = async (stageId: string, stageTitle: string) => {
    if (!confirm(`Tem certeza que deseja excluir a etapa "${stageTitle}"? Os projetos nesta etapa serão movidos para a primeira etapa disponível.`)) {
      return;
    }

    try {
      await deleteStageFromFirebase(stageId);
      setToast({ message: 'Etapa excluída com sucesso!', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      console.error('Error deleting stage:', error);
      setToast({ message: 'Erro ao excluir etapa.', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  // Salvar configurações Asaas
  const handleSaveAsaas = async () => {
    if (!currentWorkspace?.id) return;

    setSavingAsaas(true);
    try {
      await updateWorkspace(currentWorkspace.id, {
        asaasApiKey: asaasApiKey,
        asaasEnvironment: asaasEnvironment,
      });

      if (onWorkspaceUpdate) {
        onWorkspaceUpdate({
          ...currentWorkspace,
          asaasApiKey: asaasApiKey,
          asaasEnvironment: asaasEnvironment,
        });
      }

      setToast({ message: 'Configurações do Asaas salvas com sucesso!', type: 'success' });
      setTimeout(() => setToast(null), 3000);
      
      // Resetar status para testar novamente
      setAsaasStatus(null);
    } catch (error) {
      console.error('Error saving Asaas settings:', error);
      setToast({ message: 'Erro ao salvar configurações do Asaas.', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSavingAsaas(false);
    }
  };

  // Testar conexão com Asaas
  const handleTestAsaasConnection = async () => {
    if (!currentWorkspace?.id || !asaasApiKey) {
      setToast({ message: 'Por favor, insira a API Key antes de testar.', type: 'error' });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    // Verificar se usuário está autenticado
    const { getCurrentUser } = await import('../firebase/services');
    const currentUser = getCurrentUser();
    if (!currentUser) {
      setToast({ message: 'Você precisa estar logado para testar a conexão.', type: 'error' });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    // Primeiro salvar as configurações
    await handleSaveAsaas();

    setTestingAsaas(true);
    setAsaasStatus(null);

    try {
      const result = await testAsaasConnection(currentWorkspace.id);
      setAsaasStatus({
        connected: true,
        accountName: result.accountName,
      });
      setToast({ message: `Conectado com sucesso à conta: ${result.accountName}`, type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (error: any) {
      console.error('Error testing Asaas connection:', error);
      
      let errorMessage = 'Erro ao conectar com Asaas';
      
      if (error.code === 'functions/unavailable') {
        errorMessage = 'Serviço temporariamente indisponível. Tente novamente em alguns instantes.';
      } else if (error.message?.includes('CORS') || error.message?.includes('Failed to fetch')) {
        errorMessage = 'Erro de conexão. Verifique se as Functions foram deployadas corretamente.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setAsaasStatus({
        connected: false,
        error: errorMessage,
      });
      setToast({ message: errorMessage, type: 'error' });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setTestingAsaas(false);
    }
  };

  // Remover integração Asaas
  const handleRemoveAsaasIntegration = async () => {
    if (!currentWorkspace?.id) return;
    
    if (!confirm('Tem certeza que deseja remover a integração com Asaas? As faturas existentes não serão afetadas.')) {
      return;
    }

    setSavingAsaas(true);
    try {
      await updateWorkspace(currentWorkspace.id, {
        asaasApiKey: '',
        asaasEnvironment: 'sandbox',
        asaasWebhookToken: '',
      });

      if (onWorkspaceUpdate) {
        onWorkspaceUpdate({
          ...currentWorkspace,
          asaasApiKey: '',
          asaasEnvironment: 'sandbox',
          asaasWebhookToken: '',
        });
      }

      setAsaasApiKey('');
      setAsaasEnvironment('sandbox');
      setAsaasStatus(null);

      setToast({ message: 'Integração com Asaas removida!', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      console.error('Error removing Asaas integration:', error);
      setToast({ message: 'Erro ao remover integração.', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSavingAsaas(false);
    }
  };

  const getWorkspaceAvatar = () => {
    if (currentWorkspace?.avatar) {
      return currentWorkspace.avatar;
    }
    const seed = (currentWorkspace?.name || 'workspace').toLowerCase().replace(/\s+/g, '');
    return `https://picsum.photos/seed/${seed}/200/200`;
  };

  const menuItems = [
    { id: 'general', icon: 'tune', label: 'Geral' },
    { id: 'services', icon: 'category', label: 'Serviços' },
    { id: 'stages', icon: 'checklist', label: 'Etapas e Tarefas' },
    { id: 'team', icon: 'group', label: 'Equipe' },
    { id: 'integrations', icon: 'extension', label: 'Integrações' },
    { id: 'appearance', icon: 'palette', label: 'Aparência' },
    { id: 'danger', icon: 'warning', label: 'Zona de Perigo' },
  ];

  if (!currentWorkspace) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">folder_off</span>
          <p className="text-slate-500">Selecione um workspace para configurar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-slate-50 dark:bg-slate-900/20">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-in slide-in-from-right ${toast.type === 'success'
          ? 'bg-emerald-500 text-white'
          : 'bg-red-500 text-white'
          }`}>
          <span className="material-symbols-outlined text-lg">
            {toast.type === 'success' ? 'check_circle' : 'error'}
          </span>
          {toast.message}
        </div>
      )}

      {/* Sidebar de navegação */}
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-6">
        <div className="mb-8">
          <h2 className="text-xl font-black tracking-tight">Configurações</h2>
          <p className="text-xs text-slate-500 mt-1">Gerencie seu workspace</p>
        </div>

        <nav className="space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id as any)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeSection === item.id
                ? 'bg-primary/10 text-primary'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                } ${item.id === 'danger' ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' : ''}`}
            >
              <span className={`material-symbols-outlined text-xl ${item.id === 'danger' && activeSection !== 'danger' ? 'text-red-500' : ''}`}>
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Conteúdo principal */}
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl mx-auto">

          {/* Seção Geral */}
          {activeSection === 'general' && (
            <div className="space-y-8">
              <div>
                <h3 className="text-2xl font-black tracking-tight mb-2">Configurações Gerais</h3>
                <p className="text-slate-500 text-sm">Informações básicas do seu workspace</p>
              </div>

              {/* Avatar do Workspace */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Foto do Workspace</h4>
                <div className="flex items-center gap-6">
                  <div className="relative group">
                    <div
                      className={`size-24 rounded-2xl bg-slate-200 ring-4 ring-slate-100 dark:ring-slate-800 shadow-lg transition-opacity ${canEdit ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                      style={{
                        backgroundImage: `url('${getWorkspaceAvatar()}')`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                      }}
                      onClick={() => canEdit && avatarInputRef.current?.click()}
                    />
                    {canEdit && (
                      <div
                        className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        onClick={() => avatarInputRef.current?.click()}
                      >
                        <span className="material-symbols-outlined text-white text-2xl">photo_camera</span>
                      </div>
                    )}
                    {uploadingAvatar && (
                      <div className="absolute inset-0 rounded-2xl bg-black/70 flex items-center justify-center">
                        <span className="material-symbols-outlined text-white animate-spin">sync</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Alterar foto</p>
                    <p className="text-xs text-slate-500 mb-3">JPG, PNG ou GIF. Tamanho máximo de 5MB.</p>
                    <button
                      onClick={() => canEdit && avatarInputRef.current?.click()}
                      className={`px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm font-medium transition-colors ${canEdit ? 'hover:bg-slate-200 dark:hover:bg-slate-700' : 'opacity-50 cursor-not-allowed'}`}
                      disabled={!canEdit}
                    >
                      Escolher arquivo
                    </button>
                  </div>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleAvatarUpload(file);
                    }}
                  />
                </div>
              </div>

              {/* Nome e Descrição */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Nome do Workspace
                  </label>
                  <input
                    type="text"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Ex: Minha Agência"
                    disabled={!canEdit}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Descrição
                  </label>
                  <input
                    type="text"
                    value={workspaceDescription}
                    onChange={(e) => setWorkspaceDescription(e.target.value.slice(0, 30))}
                    maxLength={30}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="Ex: Agência Digital"
                    disabled={!canEdit}
                  />
                  <p className="text-xs text-slate-400 mt-1 text-right">{workspaceDescription.length}/30</p>
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={handleSaveGeneral}
                    disabled={saving || !canEdit}
                    className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving ? (
                      <>
                        <span className="material-symbols-outlined text-lg animate-spin">sync</span>
                        Salvando...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-lg">save</span>
                        Salvar Alterações
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Informações do Workspace */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Informações</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <p className="text-xs text-slate-500 mb-1">ID do Workspace</p>
                    <p className="text-sm font-mono text-slate-700 dark:text-slate-300 truncate">{currentWorkspace.id}</p>
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <p className="text-xs text-slate-500 mb-1">Criado em</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      {currentWorkspace.createdAt?.toDate?.()?.toLocaleDateString('pt-BR') ||
                        new Date(currentWorkspace.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Seção Serviços */}
          {activeSection === 'services' && (
            <div className="space-y-8">
              <div>
                <h3 className="text-2xl font-black tracking-tight mb-2">Serviços</h3>
                <p className="text-slate-500 text-sm">Gerencie os tipos de serviços do seu workspace</p>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Serviços Cadastrados</h4>
                  <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-400">
                    {categories.length} serviço{categories.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {categories.length === 0 ? (
                  <div className="text-center py-12">
                    <span className="material-symbols-outlined text-5xl text-slate-300 mb-4">category</span>
                    <p className="text-slate-500 text-sm">Nenhum serviço cadastrado</p>
                    <p className="text-slate-400 text-xs mt-1">Crie serviços no painel principal</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {categories.map((category) => {
                      const isExpanded = expandedServiceId === category.id;

                      return (
                        <div key={category.id} className="space-y-2">
                          <div
                            className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            onClick={() => setExpandedServiceId(isExpanded ? null : category.id)}
                          >
                            <div className="flex items-center gap-4 flex-1">
                              <div className={`size-10 rounded-xl flex items-center justify-center ${category.isRecurring
                                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                                : 'bg-primary/10 text-primary'
                                }`}>
                                <span className="material-symbols-outlined">
                                  {category.isRecurring ? 'autorenew' : 'inventory_2'}
                                </span>
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{category.name}</p>
                                <p className="text-xs text-slate-500">
                                  {category.isRecurring ? 'Serviço Recorrente' : 'Serviço Normal'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`material-symbols-outlined text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                                expand_more
                              </span>
                              {canEdit && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteCategory(category.id);
                                  }}
                                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                >
                                  <span className="material-symbols-outlined text-lg">delete</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Etapas expandidas */}
                          {isExpanded && (
                            <div className="ml-4 pl-4 border-l-2 border-slate-200 dark:border-slate-700 space-y-2">
                              {(() => {
                                // Filtrar etapas customizadas: isFixed !== true (inclui false e undefined)
                                const customStages = stages.filter(s => s.isFixed !== true);
                                console.log(`🔍 [Settings] Serviço "${category.name}": ${customStages.length} etapas customizadas`, customStages.map(s => s.title));

                                return customStages.length === 0 ? (
                                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
                                    <p className="text-xs text-slate-500 text-center">
                                      Nenhuma etapa customizada encontrada. Apenas as etapas fixas estão disponíveis.
                                    </p>
                                    <p className="text-xs text-slate-400 text-center mt-2">
                                      Total de etapas no workspace: {stages.length} ({stages.filter(s => s.isFixed === true).length} fixas, {stages.filter(s => s.isFixed !== true).length} customizadas)
                                    </p>
                                  </div>
                                ) : (
                                  customStages.map((stage) => {
                                    const statusColors: Record<string, string> = {
                                      'Lead': 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
                                      'Active': 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
                                      'Review': 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
                                      'Completed': 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
                                      'Finished': 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
                                    };
                                    const statusColor = statusColors[stage.status] || 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';

                                    return (
                                      <div
                                        key={stage.id}
                                        className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700"
                                      >
                                        <div className="flex items-center gap-3 flex-1">
                                          <div className={`size-8 rounded-lg flex items-center justify-center ${statusColor}`}>
                                            <span className="material-symbols-outlined text-sm">
                                              {stage.status === 'Lead' ? 'play_arrow' :
                                                stage.status === 'Active' ? 'progress_activity' :
                                                  stage.status === 'Review' ? 'rate_review' :
                                                    stage.status === 'Completed' ? 'check_circle' :
                                                      'done_all'}
                                            </span>
                                          </div>
                                          <div className="flex-1">
                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{stage.title}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                              <span className="text-[10px] text-slate-500">
                                                {stage.status} • {stage.progress}%
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                        {canEdit && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteStage(stage.id, stage.title);
                                            }}
                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                            title="Excluir etapa"
                                          >
                                            <span className="material-symbols-outlined text-base">delete</span>
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-800 p-6">
                <div className="flex gap-4">
                  <span className="material-symbols-outlined text-blue-500">info</span>
                  <div>
                    <p className="text-sm font-bold text-blue-700 dark:text-blue-300">Dica</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      Para adicionar novos serviços, use o botão "Novo Serviço" no painel principal.
                      Você pode reordenar os serviços arrastando as abas.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          )}


          {/* Seção Etapas e Tarefas */}
          {activeSection === 'stages' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div>
                <h3 className="text-2xl font-black tracking-tight mb-2">Etapas e Tarefas</h3>
                <p className="text-slate-500 text-sm">Configure as tarefas padrão para cada etapa do fluxo de trabalho</p>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <div className="mb-6">
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Selecione o Serviço para Configurar
                  </label>
                  <select
                    value={selectedServiceId}
                    onChange={(e) => setSelectedServiceId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all cursor-pointer"
                  >
                    <option value="all">Padrão (Configuração Global)</option>
                    <optgroup label="Serviços Padrão">
                      {categories.filter(c => !c.isRecurring).map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Serviços Recorrentes">
                      {categories.filter(c => c.isRecurring).map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </optgroup>
                  </select>
                  <p className="text-xs text-slate-500 mt-2">
                    {selectedServiceId === 'all'
                      ? "Estas tarefas serão aplicadas a todos os serviços que não tiverem uma configuração específica."
                      : "Defina tarefas específicas para este serviço. Se vazio, o sistema usará a configuração global."}
                  </p>
                </div>
                <div className="space-y-4">
                  {(() => {
                    const selectedCategory = categories.find(c => c.id === selectedServiceId);
                    const isRecurring = selectedCategory?.isRecurring;
                    // Se for recorrente, usa fixedStagesRecurring. Se não (ou se for 'all'), usa fixedStages padrão.
                    const currentStages = isRecurring ? fixedStagesRecurring : fixedStages;

                    return currentStages.map((stage) => (
                      <div key={stage.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary/30 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="size-10 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300">
                            {stage.order + 1}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800 dark:text-slate-200">{stage.title}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${stage.status === 'Completed' || stage.status === 'Finished'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                : stage.status === 'Review'
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                }`}>
                                {stage.status}
                              </span>
                              {stage.isFixed && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                  FIXA
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => setStageToEditTasks(stage)}
                          className={`flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-400 transition-all shadow-sm ${canEdit ? 'hover:text-primary hover:border-primary hover:shadow-md' : 'opacity-50 cursor-not-allowed'}`}
                          disabled={!canEdit}
                        >
                          <span className="material-symbols-outlined text-lg">checklist</span>
                          Definir Tarefas
                        </button>
                      </div>
                    ));
                  })()}

                  {(() => {
                    const selectedCategory = categories.find(c => c.id === selectedServiceId);
                    const isRecurring = selectedCategory?.isRecurring;
                    const currentStages = isRecurring ? fixedStagesRecurring : fixedStages;
                    return currentStages.length === 0;
                  })() && (
                      <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                        <span className="material-symbols-outlined text-4xl mb-2">playlist_remove</span>
                        <p>Nenhuma etapa encontrada neste workspace.</p>
                      </div>
                    )}
                </div>
              </div>
            </div>
          )}

          {/* Seção Equipe */}
          {activeSection === 'team' && currentWorkspace && (
            <TeamSettings
              currentWorkspace={currentWorkspace}
              onUpdate={(updatedSpace) => {
                if (onWorkspaceUpdate) onWorkspaceUpdate(updatedSpace);
              }}
              canEdit={canEdit}
            />
          )}

          {/* Seção Aparência */}
          {activeSection === 'appearance' && (
            <div className="space-y-8">
              <div>
                <h3 className="text-2xl font-black tracking-tight mb-2">Aparência</h3>
                <p className="text-slate-500 text-sm">Personalize a aparência do seu workspace</p>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Cor do Tema</h4>
                <p className="text-xs text-slate-500 mb-4">Escolha uma cor para identificar seu workspace</p>

                <div className="flex flex-wrap gap-3 mb-6">
                  {presetColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => canEdit && setWorkspaceColor(color)}
                      className={`size-10 rounded-xl transition-all ${workspaceColor === color
                        ? 'ring-4 ring-offset-2 ring-slate-300 dark:ring-slate-600 scale-110'
                        : canEdit ? 'hover:scale-105' : 'opacity-70 cursor-not-allowed'
                        }`}
                      style={{ backgroundColor: color }}
                      disabled={!canEdit}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-2">Cor personalizada</label>
                    <input
                      type="color"
                      value={workspaceColor}
                      onChange={(e) => setWorkspaceColor(e.target.value)}
                      className="w-16 h-10 rounded-lg cursor-pointer border-0 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!canEdit}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-slate-500 mb-2">Código HEX</label>
                    <input
                      type="text"
                      value={workspaceColor}
                      onChange={(e) => setWorkspaceColor(e.target.value)}
                      className="w-32 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!canEdit}
                    />
                  </div>
                </div>

                {/* Preview */}
                <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-xs text-slate-500 mb-3">Preview</p>
                  <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <div
                      className="size-12 rounded-xl"
                      style={{ backgroundColor: workspaceColor }}
                    />
                    <div>
                      <p className="text-sm font-bold" style={{ color: workspaceColor }}>{workspaceName || 'Meu Workspace'}</p>
                      <p className="text-xs text-slate-500">{workspaceDescription || 'Descrição do workspace'}</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-6 border-t border-slate-100 dark:border-slate-800 mt-6">
                  <button
                    onClick={handleSaveAppearance}
                    disabled={saving || !canEdit}
                    className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving ? (
                      <>
                        <span className="material-symbols-outlined text-lg animate-spin">sync</span>
                        Salvando...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-lg">save</span>
                        Salvar Aparência
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Seção Integrações */}
          {activeSection === 'integrations' && (
            <div className="space-y-8">
              <div>
                <h3 className="text-2xl font-black tracking-tight mb-2">Integrações</h3>
                <p className="text-slate-500 text-sm">Conecte serviços externos ao seu workspace</p>
              </div>

              {/* Asaas Integration */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                <div className="flex items-start gap-4 mb-6">
                  <div className="size-14 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-green-500/20">
                    <span className="material-symbols-outlined text-white text-2xl">payments</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="text-lg font-bold">Asaas</h4>
                      {asaasStatus?.connected && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px] font-bold uppercase rounded-full">
                          Conectado
                        </span>
                      )}
                      {asaasStatus && !asaasStatus.connected && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-[10px] font-bold uppercase rounded-full">
                          Erro
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      Gere cobranças automáticas via boleto, PIX ou cartão de crédito
                    </p>
                    {asaasStatus?.accountName && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                        Conta: {asaasStatus.accountName}
                      </p>
                    )}
                    {asaasStatus?.error && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                        {asaasStatus.error}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Ambiente */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Ambiente
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => canEdit && setAsaasEnvironment('sandbox')}
                        disabled={!canEdit}
                        className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                          asaasEnvironment === 'sandbox'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 ring-2 ring-amber-500/50'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        } ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <span className="material-symbols-outlined text-lg align-middle mr-2">science</span>
                        Sandbox (Testes)
                      </button>
                      <button
                        onClick={() => canEdit && setAsaasEnvironment('production')}
                        disabled={!canEdit}
                        className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                          asaasEnvironment === 'production'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 ring-2 ring-green-500/50'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        } ${!canEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <span className="material-symbols-outlined text-lg align-middle mr-2">verified</span>
                        Produção
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2">
                      {asaasEnvironment === 'sandbox' 
                        ? 'Ambiente de testes. Cobranças não são reais.' 
                        : 'Ambiente de produção. Cobranças serão processadas.'}
                    </p>
                  </div>

                  {/* API Key */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      API Key
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          value={asaasApiKey}
                          onChange={(e) => setAsaasApiKey(e.target.value)}
                          placeholder="$aact_YTU5YTE0M2M2..."
                          disabled={!canEdit}
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono pr-12 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <span className="material-symbols-outlined text-lg">
                            {showApiKey ? 'visibility_off' : 'visibility'}
                          </span>
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2">
                      Encontre sua API Key em: Asaas &gt; Minha Conta &gt; Integrações &gt; Criar nova chave de API
                    </p>
                  </div>

                  {/* Webhook URL */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      URL do Webhook
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={getWebhookUrl()}
                        readOnly
                        className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-500"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(getWebhookUrl());
                          setToast({ message: 'URL copiada!', type: 'success' });
                          setTimeout(() => setToast(null), 2000);
                        }}
                        className="px-4 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-lg">content_copy</span>
                        Copiar
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-2">
                      Configure este URL no Asaas em: Minha Conta &gt; Integrações &gt; Webhooks
                    </p>
                  </div>

                  {/* Ações */}
                  <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={handleTestAsaasConnection}
                      disabled={testingAsaas || !asaasApiKey || !canEdit}
                      className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {testingAsaas ? (
                        <>
                          <span className="material-symbols-outlined text-lg animate-spin">sync</span>
                          Testando...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-lg">wifi_tethering</span>
                          Testar Conexão
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleSaveAsaas}
                      disabled={savingAsaas || !asaasApiKey || !canEdit}
                      className="flex-1 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {savingAsaas ? (
                        <>
                          <span className="material-symbols-outlined text-lg animate-spin">sync</span>
                          Salvando...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-lg">save</span>
                          Salvar
                        </>
                      )}
                    </button>
                  </div>

                  {/* Remover Integração */}
                  {currentWorkspace?.asaasApiKey && (
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                      <button
                        onClick={handleRemoveAsaasIntegration}
                        disabled={savingAsaas || !canEdit}
                        className="text-sm text-red-500 hover:text-red-600 font-medium flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-lg">link_off</span>
                        Remover integração
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Outras integrações futuras */}
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-6">
                <div className="text-center">
                  <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-3">add_circle</span>
                  <p className="text-sm font-medium text-slate-500">Mais integrações em breve</p>
                  <p className="text-xs text-slate-400 mt-1">Stripe, PagSeguro, Pix direto...</p>
                </div>
              </div>
            </div>
          )}

          {/* Zona de Perigo */}
          {activeSection === 'danger' && (
            <div className="space-y-8">
              <div>
                <h3 className="text-2xl font-black tracking-tight mb-2 text-red-500">Zona de Perigo</h3>
                <p className="text-slate-500 text-sm">Ações irreversíveis para o workspace</p>
              </div>

              <div className="bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-200 dark:border-red-800 p-6">
                <div className="flex items-start gap-4">
                  <div className="size-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-red-500">delete_forever</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-red-700 dark:text-red-400">Excluir Workspace</h4>
                    <p className="text-xs text-red-600 dark:text-red-400/80 mt-1 mb-4">
                      Esta ação irá excluir permanentemente o workspace e todos os seus dados, incluindo projetos,
                      faturas e arquivos. Esta ação não pode ser desfeita.
                    </p>
                    <button
                      className={`px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-bold transition-colors ${!canEdit ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-600'}`}
                      disabled={!canEdit}
                      onClick={() => {
                        if (!canEdit) return;
                        const confirmed = prompt(`Para confirmar, digite "${currentWorkspace.name}":`);
                        if (confirmed === currentWorkspace.name) {
                          // TODO: Implementar exclusão do workspace
                          setToast({ message: 'Funcionalidade em desenvolvimento', type: 'error' });
                          setTimeout(() => setToast(null), 3000);
                        } else if (confirmed !== null) {
                          setToast({ message: 'Nome incorreto. Exclusão cancelada.', type: 'error' });
                          setTimeout(() => setToast(null), 3000);
                        }
                      }}
                    >
                      Excluir Workspace
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-200 dark:border-amber-800 p-6">
                <div className="flex gap-4">
                  <span className="material-symbols-outlined text-amber-500">warning</span>
                  <div>
                    <p className="text-sm font-bold text-amber-700 dark:text-amber-300">Atenção</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      Antes de excluir, considere exportar seus dados. Uma vez excluído, não será possível recuperar
                      nenhuma informação deste workspace.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modal de Definir Tarefas */}
      {stageToEditTasks && (
        <DefineStageTasksModal
          stage={stageToEditTasks}
          onClose={() => setStageToEditTasks(null)}
          categoryId={selectedServiceId}
        />
      )}
    </div>
  );
};
