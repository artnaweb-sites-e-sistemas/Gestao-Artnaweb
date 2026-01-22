import React, { useState, useRef, useEffect } from 'react';
import { Workspace, Category } from '../types';
import { updateWorkspace, uploadWorkspaceAvatar, subscribeToCategories, deleteCategoryById } from '../firebase/services';

interface SettingsProps {
  currentWorkspace?: Workspace | null;
  onWorkspaceUpdate?: (workspace: Workspace) => void;
  userId?: string | null;
}

export const Settings: React.FC<SettingsProps> = ({ currentWorkspace, onWorkspaceUpdate, userId }) => {
  const [activeSection, setActiveSection] = useState<'general' | 'services' | 'appearance' | 'danger'>('general');
  const [workspaceName, setWorkspaceName] = useState(currentWorkspace?.name || '');
  const [workspaceDescription, setWorkspaceDescription] = useState(currentWorkspace?.description || '');
  const [workspaceColor, setWorkspaceColor] = useState(currentWorkspace?.color || '#6366f1');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const avatarInputRef = useRef<HTMLInputElement>(null);

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
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-in slide-in-from-right ${
          toast.type === 'success' 
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
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeSection === item.id
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
                      className="size-24 rounded-2xl bg-slate-200 ring-4 ring-slate-100 dark:ring-slate-800 shadow-lg cursor-pointer hover:opacity-80 transition-opacity"
                      style={{ 
                        backgroundImage: `url('${getWorkspaceAvatar()}')`, 
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                      }}
                      onClick={() => avatarInputRef.current?.click()}
                    />
                    <div 
                      className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      onClick={() => avatarInputRef.current?.click()}
                    >
                      <span className="material-symbols-outlined text-white text-2xl">photo_camera</span>
                    </div>
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
                      onClick={() => avatarInputRef.current?.click()}
                      className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors"
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
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    placeholder="Ex: Minha Agência"
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
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    placeholder="Ex: Agência Digital"
                  />
                  <p className="text-xs text-slate-400 mt-1 text-right">{workspaceDescription.length}/30</p>
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={handleSaveGeneral}
                    disabled={saving}
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
                    {categories.map((category) => (
                      <div 
                        key={category.id}
                        className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700"
                      >
                        <div className="flex items-center gap-4">
                          <div className={`size-10 rounded-xl flex items-center justify-center ${
                            category.isRecurring 
                              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                              : 'bg-primary/10 text-primary'
                          }`}>
                            <span className="material-symbols-outlined">
                              {category.isRecurring ? 'autorenew' : 'inventory_2'}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{category.name}</p>
                            <p className="text-xs text-slate-500">
                              {category.isRecurring ? 'Serviço Recorrente' : 'Serviço Normal'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDeleteCategory(category.id)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          >
                            <span className="material-symbols-outlined text-lg">delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
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
                      onClick={() => setWorkspaceColor(color)}
                      className={`size-10 rounded-xl transition-all ${
                        workspaceColor === color 
                          ? 'ring-4 ring-offset-2 ring-slate-300 dark:ring-slate-600 scale-110' 
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
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
                      className="w-16 h-10 rounded-lg cursor-pointer border-0"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-slate-500 mb-2">Código HEX</label>
                    <input
                      type="text"
                      value={workspaceColor}
                      onChange={(e) => setWorkspaceColor(e.target.value)}
                      className="w-32 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono"
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
                    disabled={saving}
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
                      className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-bold transition-colors"
                      onClick={() => {
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
    </div>
  );
};
