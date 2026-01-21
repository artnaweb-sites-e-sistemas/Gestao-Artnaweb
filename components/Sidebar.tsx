
import React, { useState, useEffect, useRef } from 'react';
import { ViewState, Workspace } from '../types';
import { subscribeToWorkspaces, addWorkspace, deleteWorkspace } from '../firebase/services';

interface SidebarProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
  isOpen: boolean;
  onCreateProject?: () => void;
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  onWorkspaceChange: (workspace: Workspace | null) => void;
  onWorkspacesChange: (workspaces: Workspace[]) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentView, 
  setView, 
  isOpen, 
  onCreateProject,
  currentWorkspace,
  workspaces,
  onWorkspaceChange,
  onWorkspacesChange
}) => {
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [showAddWorkspace, setShowAddWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(null);
  const currentWorkspaceRef = useRef(currentWorkspace);
  const isInitialLoadRef = useRef(true);

  // Atualizar ref quando currentWorkspace mudar
  useEffect(() => {
    currentWorkspaceRef.current = currentWorkspace;
  }, [currentWorkspace]);

  // Carregar workspaces do Firebase
  useEffect(() => {
    console.log('🔵 [Sidebar] Iniciando subscription de workspaces...');
    let isCreatingDefault = false;
    
    const unsubscribe = subscribeToWorkspaces((fetchedWorkspaces) => {
      console.log('📦 [Sidebar] Workspaces recebidos:', fetchedWorkspaces.length, fetchedWorkspaces.map(w => ({ id: w.id, name: w.name })));
      
      // Sempre atualizar a lista de workspaces primeiro
      onWorkspacesChange(fetchedWorkspaces);
      
      // Usar ref para obter o valor atual de currentWorkspace
      const current = currentWorkspaceRef.current;
      
      // Se não houver workspaces, criar um padrão (apenas uma vez na primeira carga)
      if (fetchedWorkspaces.length === 0 && isInitialLoadRef.current && !isCreatingDefault) {
        isCreatingDefault = true;
        isInitialLoadRef.current = false;
        console.log('⚠️ [Sidebar] Nenhum workspace encontrado, criando padrão...');
        addWorkspace({ name: 'Workspace da Agência' }).then((id) => {
          console.log('✅ [Sidebar] Workspace padrão criado com ID:', id);
          isCreatingDefault = false;
          // A subscription irá atualizar automaticamente e selecionar o workspace
        }).catch((error) => {
          console.error('❌ [Sidebar] Error creating default workspace:', error);
          isCreatingDefault = false;
        });
        return; // Aguardar a próxima atualização da subscription
      }
      
      // Marcar que não é mais o carregamento inicial após receber workspaces
      if (fetchedWorkspaces.length > 0) {
        isInitialLoadRef.current = false;
      }
      
      // Se não houver workspace selecionado e houver workspaces disponíveis, selecionar o primeiro
      if (!current && fetchedWorkspaces.length > 0) {
        console.log('🔵 [Sidebar] Selecionando primeiro workspace:', fetchedWorkspaces[0]);
        onWorkspaceChange(fetchedWorkspaces[0]);
        return;
      }
      
      // Verificar se o workspace atual ainda existe na lista
      if (current && fetchedWorkspaces.length > 0) {
        const workspaceExists = fetchedWorkspaces.find(w => w.id === current.id);
        if (!workspaceExists) {
          // Se o workspace atual não existe mais, selecionar o primeiro disponível
          console.log('⚠️ [Sidebar] Workspace atual não encontrado, selecionando primeiro disponível');
          onWorkspaceChange(fetchedWorkspaces[0]);
          return;
        }
        
        // Atualizar o workspace atual com os dados mais recentes do Firebase se houver mudanças
        const updatedWorkspace = fetchedWorkspaces.find(w => w.id === current.id);
        if (updatedWorkspace && updatedWorkspace.name !== current.name) {
          console.log('🔄 [Sidebar] Atualizando workspace atual com dados do Firebase');
          onWorkspaceChange(updatedWorkspace);
        }
      }
    });

    return () => {
      console.log('🔴 [Sidebar] Desinscrevendo de workspaces...');
      unsubscribe();
    };
  }, []); // Sem dependências - usar refs para valores atuais

  const handleAddWorkspace = async () => {
    if (!newWorkspaceName.trim()) return;
    
    const workspaceName = newWorkspaceName.trim();
    
    // Fechar modal e limpar estado PRIMEIRO (de forma síncrona)
    setNewWorkspaceName('');
    setShowAddWorkspace(false);
    
    try {
      console.log('Criando workspace com nome:', workspaceName);
      const id = await addWorkspace({ name: workspaceName });
      console.log('Workspace criado com sucesso, ID:', id);
      
      // Criar objeto temporário enquanto a subscription atualiza
      const tempWorkspace: Workspace = {
        id,
        name: workspaceName,
        createdAt: new Date()
      };
      console.log('✅ [Sidebar] Selecionando novo workspace temporário:', tempWorkspace);
      onWorkspaceChange(tempWorkspace);
      
      // Mostrar feedback de sucesso
      const successMessage = document.createElement('div');
      successMessage.className = 'fixed top-4 right-4 bg-emerald-500 text-white px-4 py-3 rounded-lg shadow-lg z-[60] flex items-center gap-2';
      successMessage.innerHTML = `
        <span class="material-symbols-outlined">check_circle</span>
        <span>Workspace "${workspaceName}" criado com sucesso!</span>
      `;
      document.body.appendChild(successMessage);
      setTimeout(() => {
        successMessage.style.opacity = '0';
        successMessage.style.transition = 'opacity 0.3s';
        setTimeout(() => {
          successMessage.remove();
        }, 300);
      }, 3000);
    } catch (error: any) {
      console.error('Error adding workspace:', error);
      console.error('Error details:', error?.message, error?.code);
      alert(`Erro ao adicionar workspace: ${error?.message || 'Erro desconhecido'}. Verifique o console para mais detalhes.`);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!workspaceToDelete) {
      console.warn('⚠️ [Sidebar] Nenhum workspace selecionado para exclusão');
      return;
    }
    
    console.log('🗑️ [Sidebar] Iniciando exclusão do workspace:', workspaceToDelete.id, workspaceToDelete.name);
    
    // Não permitir excluir se for o único workspace
    if (workspaces.length <= 1) {
      alert('Não é possível excluir o último workspace. Crie um novo antes de excluir este.');
      setWorkspaceToDelete(null);
      return;
    }
    
    // Guardar valores ANTES de excluir
    const deletedName = workspaceToDelete.name;
    const workspaceId = workspaceToDelete.id;
    
    // Fechar o modal PRIMEIRO (de forma síncrona)
    setWorkspaceToDelete(null);
    
    try {
      console.log('🗑️ [Sidebar] Chamando deleteWorkspace...');
      
      await deleteWorkspace(workspaceId);
      console.log('✅ [Sidebar] Workspace excluído com sucesso');
      
      // Se o workspace excluído for o atual, selecionar outro
      if (currentWorkspace?.id === workspaceId) {
        const remainingWorkspaces = workspaces.filter(w => w.id !== workspaceId);
        if (remainingWorkspaces.length > 0) {
          console.log('🔄 [Sidebar] Selecionando workspace alternativo:', remainingWorkspaces[0].name);
          onWorkspaceChange(remainingWorkspaces[0]);
        } else {
          onWorkspaceChange(null);
        }
      }
      
      // Mostrar feedback de sucesso
      const successMessage = document.createElement('div');
      successMessage.className = 'fixed top-4 right-4 bg-emerald-500 text-white px-4 py-3 rounded-lg shadow-lg z-[60] flex items-center gap-2';
      successMessage.innerHTML = `
        <span class="material-symbols-outlined">check_circle</span>
        <span>Workspace "${deletedName}" excluído com sucesso!</span>
      `;
      document.body.appendChild(successMessage);
      setTimeout(() => {
        successMessage.style.opacity = '0';
        successMessage.style.transition = 'opacity 0.3s';
        setTimeout(() => {
          successMessage.remove();
        }, 300);
      }, 3000);
    } catch (error: any) {
      console.error('❌ [Sidebar] Error deleting workspace:', error);
      console.error('❌ [Sidebar] Error details:', error?.message, error?.code);
      alert(`Erro ao excluir workspace: ${error?.message || 'Erro desconhecido'}. Verifique o console para mais detalhes.`);
    }
  };
  const menuItems: { id: ViewState; label: string; icon: string }[] = [
    { id: 'Dashboard', label: 'Painel', icon: 'dashboard' },
    { id: 'Timeline', label: 'Cronograma', icon: 'calendar_month' },
    { id: 'Tasks', label: 'Tarefas', icon: 'check_box' },
    { id: 'Financial', label: 'Financeiro', icon: 'payments' },
    { id: 'Documents', label: 'Documentos', icon: 'description' },
  ];

  const teamItems: { id: ViewState; label: string; icon: string }[] = [
    { id: 'Clients', label: 'Clientes', icon: 'group' },
    { id: 'Settings', label: 'Configurações', icon: 'settings' },
  ];

  if (!isOpen) return null;

  return (
    <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col transition-all">
      <div className="p-6 flex items-center gap-3">
        <div className="bg-primary size-8 rounded flex items-center justify-center text-white">
          <span className="material-symbols-outlined">auto_awesome</span>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold tracking-tight">CRM Criativo</h1>
          <div className="relative">
            <button
              onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
              className="text-[10px] text-slate-500 uppercase tracking-widest hover:text-primary transition-colors flex items-center gap-1"
            >
              <span className="truncate">{currentWorkspace?.name || 'Selecionar Workspace'}</span>
              <span className="material-symbols-outlined text-xs">expand_more</span>
            </button>
            
            {showWorkspaceMenu && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowWorkspaceMenu(false)}
                />
                <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg z-20">
                  <div className="p-2 max-h-64 overflow-y-auto">
                    {workspaces.map((workspace) => (
                      <div
                        key={workspace.id}
                        className={`flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer ${
                          currentWorkspace?.id === workspace.id ? 'bg-primary/10' : ''
                        }`}
                        onClick={() => {
                          onWorkspaceChange(workspace);
                          setShowWorkspaceMenu(false);
                        }}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="material-symbols-outlined text-sm text-slate-400">
                            {currentWorkspace?.id === workspace.id ? 'check_circle' : 'radio_button_unchecked'}
                          </span>
                          <span className="text-xs font-medium truncate">{workspace.name}</span>
                        </div>
                        {workspaces.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setWorkspaceToDelete(workspace);
                            }}
                            className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900/20 rounded transition-colors"
                          >
                            <span className="material-symbols-outlined text-rose-500 text-sm">delete</span>
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        setShowAddWorkspace(true);
                        setShowWorkspaceMenu(false);
                      }}
                      className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-primary mt-1"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      Novo Workspace
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal Adicionar Workspace */}
      {showAddWorkspace && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-full max-w-md">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-xl font-bold">Novo Workspace</h3>
              <p className="text-sm text-slate-500 mt-1">Digite o nome do novo workspace</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                  Nome do Workspace
                </label>
                <input
                  type="text"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddWorkspace();
                    if (e.key === 'Escape') setShowAddWorkspace(false);
                  }}
                  placeholder="Ex: Workspace da Agência"
                  className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
                  autoFocus
                />
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddWorkspace(false);
                    setNewWorkspaceName('');
                  }}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    console.log('🖱️ [Sidebar] Botão Criar clicado');
                    handleAddWorkspace();
                  }}
                  disabled={!newWorkspaceName.trim()}
                  className="px-4 py-2 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Criar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Exclusão de Workspace */}
      {workspaceToDelete && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            // Fechar ao clicar fora do modal
            if (e.target === e.currentTarget) {
              setWorkspaceToDelete(null);
            }
          }}
        >
          <div 
            className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-full max-w-md"
            onClick={(e) => {
              // Prevenir fechamento ao clicar dentro do modal
              e.stopPropagation();
            }}
          >
            <div className="p-6 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-4 mb-4">
                <div className="size-12 rounded-full bg-rose-100 dark:bg-rose-900/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-rose-600 dark:text-rose-400">warning</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold">Excluir Workspace</h3>
                  <p className="text-sm text-slate-500 mt-1">Esta ação não pode ser desfeita</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Tem certeza que deseja excluir o workspace <span className="font-bold">"{workspaceToDelete.name}"</span>? Todos os dados relacionados serão perdidos permanentemente.
              </p>
            </div>
            <div className="p-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  console.log('🚫 [Sidebar] Cancelando exclusão');
                  setWorkspaceToDelete(null);
                }}
                className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  console.log('🖱️ [Sidebar] Botão Excluir clicado');
                  handleDeleteWorkspace();
                }}
                className="px-4 py-2 text-sm font-semibold bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="flex-1 px-4 space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
              currentView === item.id
                ? 'bg-primary/10 text-primary'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}

        <div className="pt-4 pb-2 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Equipe</div>
        
        {teamItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setView(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
              currentView === item.id
                ? 'bg-primary/10 text-primary'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 mt-auto">
        <button 
          onClick={onCreateProject}
          className="w-full flex items-center justify-center gap-2 bg-primary text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          <span>Novo Projeto</span>
        </button>
      </div>
    </aside>
  );
};
