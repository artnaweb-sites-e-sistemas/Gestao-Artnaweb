import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Project, Workspace, Category, Client } from '../types';
import { subscribeToProjects, subscribeToCategories, subscribeToClients, addClient, updateClient, deleteClient, deleteProject, syncOldClientsFromProjects, uploadClientAvatar } from '../firebase/services';
import { formatCpfCnpj, validateCpfCnpj, createAsaasCustomer } from '../firebase/asaas';
import { ConfirmationModal } from '../components/ConfirmationModal';

interface ClientProfileProps {
  currentWorkspace?: Workspace | null;
  onProjectClick?: (project: Project) => void;
}

export const ClientProfile: React.FC<ClientProfileProps> = ({ currentWorkspace, onProjectClick }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  
  // Modal de cliente
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [savingClient, setSavingClient] = useState(false);
  const [syncingAsaas, setSyncingAsaas] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  
  // Modal de confirmação de exclusão
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState(false);
  
  // Sincronização de clientes antigos
  const [syncingOldClients, setSyncingOldClients] = useState(false);
  const [hasOldProjects, setHasOldProjects] = useState(false);
  
  // Form do cliente
  const [clientForm, setClientForm] = useState({
    name: '',
    email: '',
    cpfCnpj: '',
    phone: '',
    mobilePhone: '',
    address: {
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      postalCode: '',
    }
  });

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

  // Verificar se cliente tem avatar
  const hasClientAvatar = (client: Client | string): boolean => {
    if (typeof client === 'string') {
      return false; // Strings não têm avatar
    }
    return !!(client.avatar && client.avatar.trim() !== '');
  };

  // Gerar URL de avatar do projeto baseado no nome do projeto
  const getProjectAvatar = (projectName: string) => {
    const seed = projectName.toLowerCase().replace(/\s+/g, '');
    return `https://picsum.photos/seed/${seed}/80/80`;
  };

  useEffect(() => {
    if (!currentWorkspace?.id) {
      setProjects([]);
      setClients([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const unsubscribeProjects = subscribeToProjects((fetchedProjects) => {
      const workspaceProjects = fetchedProjects.filter(p => p.workspaceId === currentWorkspace.id);
      setProjects(workspaceProjects);
      
      // Verificar se há projetos antigos (com client mas sem clientId)
      const oldProjects = workspaceProjects.filter(p => p.client && !p.clientId);
      setHasOldProjects(oldProjects.length > 0);
      
      setLoading(false);
    }, currentWorkspace.id);

    const unsubscribeClients = subscribeToClients((fetchedClients) => {
      setClients(fetchedClients);
    }, currentWorkspace.id);

    return () => {
      unsubscribeProjects();
      unsubscribeClients();
    };
  }, [currentWorkspace?.id]);

  useEffect(() => {
    if (!currentWorkspace?.id) {
      setCategories([]);
      return;
    }

    const unsubscribe = subscribeToCategories((fetchedCategories) => {
      setCategories(fetchedCategories);
    }, currentWorkspace.id);

    return () => unsubscribe();
  }, [currentWorkspace?.id]);

  // Obter projetos de um cliente específico
  const getClientProjects = (client: Client): Project[] => {
    return projects.filter(p => {
      // Se o projeto tem clientId, comparar pelo ID
      if (p.clientId) {
        return p.clientId === client.id;
      }
      // Caso contrário, comparar pelo nome (compatibilidade com projetos antigos)
      return p.client?.toLowerCase() === client.name.toLowerCase();
    });
  };

  // Filtrar clientes (todos os clientes cadastrados)
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const query = searchQuery.toLowerCase();
    return clients.filter(client =>
      client.name.toLowerCase().includes(query) ||
      (client.email && client.email.toLowerCase().includes(query)) ||
      (client.cpfCnpj && client.cpfCnpj.includes(query.replace(/\D/g, '')))
    );
  }, [clients, searchQuery]);

  const totalClients = clients.length;
  const totalProjects = projects.length;

  // Resetar form do cliente
  const resetClientForm = () => {
    setClientForm({
      name: '',
      email: '',
      cpfCnpj: '',
      phone: '',
      mobilePhone: '',
      address: {
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        state: '',
        postalCode: '',
      }
    });
    setEditingClient(null);
  };

  // Abrir modal para novo cliente
  const handleNewClient = () => {
    resetClientForm();
    setShowClientModal(true);
  };

  // Abrir modal para editar cliente
  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setClientForm({
      name: client.name,
      email: client.email,
      cpfCnpj: client.cpfCnpj ? formatCpfCnpj(client.cpfCnpj) : '',
      phone: client.phone || '',
      mobilePhone: client.mobilePhone || '',
      address: {
        street: client.address?.street || '',
        number: client.address?.number || '',
        complement: client.address?.complement || '',
        neighborhood: client.address?.neighborhood || '',
        city: client.address?.city || '',
        state: client.address?.state || '',
        postalCode: client.address?.postalCode || '',
      }
    });
    setShowClientModal(true);
  };

  // Upload de avatar do cliente
  const handleAvatarUpload = async (file: File) => {
    if (!editingClient?.id || !currentWorkspace?.id) return;

    setUploadingAvatar(true);
    try {
      const avatarUrl = await uploadClientAvatar(editingClient.id, file);
      await updateClient(editingClient.id, { avatar: avatarUrl });
      
      // Sincronizar avatar com todos os projetos vinculados a este cliente
      const { updateClientAvatarInAllProjects } = await import('../firebase/services');
      await updateClientAvatarInAllProjects(
        editingClient.name,
        avatarUrl,
        currentWorkspace.id,
        null,
        editingClient.id
      );
      
      // Atualizar o cliente local e na lista de clientes
      const updatedClient = { ...editingClient, avatar: avatarUrl };
      setEditingClient(updatedClient);
      
      // Atualizar na lista de clientes também
      setClients(prevClients => 
        prevClients.map(c => c.id === editingClient.id ? updatedClient : c)
      );
      
      setToast({ message: 'Foto do perfil atualizada com sucesso em todos os projetos!', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      setToast({ message: 'Erro ao fazer upload da foto. Tente novamente.', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
    }
  };

  // Salvar cliente
  const handleSaveClient = async () => {
    if (!currentWorkspace?.id) return;
    
    // Validações
    if (!clientForm.name.trim()) {
      setToast({ message: 'Nome é obrigatório', type: 'error' });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    
    // Validar CPF/CNPJ apenas se foi preenchido
    if (clientForm.cpfCnpj.trim() && !validateCpfCnpj(clientForm.cpfCnpj)) {
      setToast({ message: 'CPF/CNPJ inválido', type: 'error' });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    setSavingClient(true);
    try {
      // Preparar dados do cliente (sem campos undefined)
      const clientData: any = {
        name: clientForm.name.trim(),
        workspaceId: currentWorkspace.id,
      };
      
      // Manter avatar existente se estiver editando, senão não adicionar avatar (aparecerá com bordas tracejadas)
      if (editingClient?.avatar) {
        clientData.avatar = editingClient.avatar;
      }
      
      // Adicionar campos opcionais apenas se tiverem valor
      if (clientForm.email.trim()) {
        clientData.email = clientForm.email.trim();
      }
      if (clientForm.cpfCnpj.replace(/\D/g, '')) {
        clientData.cpfCnpj = clientForm.cpfCnpj.replace(/\D/g, '');
      }
      if (clientForm.phone.replace(/\D/g, '')) {
        clientData.phone = clientForm.phone.replace(/\D/g, '');
      }
      if (clientForm.mobilePhone.replace(/\D/g, '')) {
        clientData.mobilePhone = clientForm.mobilePhone.replace(/\D/g, '');
      }
      
      // Adicionar endereço apenas se tiver pelo menos um campo preenchido
      const address: any = {};
      if (clientForm.address.street.trim()) address.street = clientForm.address.street.trim();
      if (clientForm.address.number.trim()) address.number = clientForm.address.number.trim();
      if (clientForm.address.complement.trim()) address.complement = clientForm.address.complement.trim();
      if (clientForm.address.neighborhood.trim()) address.neighborhood = clientForm.address.neighborhood.trim();
      if (clientForm.address.city.trim()) address.city = clientForm.address.city.trim();
      if (clientForm.address.state.trim()) address.state = clientForm.address.state.trim();
      if (clientForm.address.postalCode.replace(/\D/g, '')) {
        address.postalCode = clientForm.address.postalCode.replace(/\D/g, '');
      }
      
      if (Object.keys(address).length > 0) {
        clientData.address = address;
      }

      if (editingClient) {
        await updateClient(editingClient.id, clientData);
        setToast({ message: 'Cliente atualizado com sucesso!', type: 'success' });
      } else {
        await addClient(clientData as any);
        setToast({ message: 'Cliente cadastrado com sucesso!', type: 'success' });
      }
      
      setTimeout(() => setToast(null), 3000);
      setShowClientModal(false);
      resetClientForm();
    } catch (error: any) {
      console.error('Error saving client:', error);
      setToast({ message: error.message || 'Erro ao salvar cliente', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSavingClient(false);
    }
  };

  // Abrir modal de confirmação de exclusão
  const handleDeleteClient = (client: Client) => {
    setClientToDelete(client);
    setShowDeleteModal(true);
  };

  // Confirmar exclusão do cliente
  const handleConfirmDeleteClient = async () => {
    if (!clientToDelete) return;

    setDeletingClient(true);
    try {
      // Obter todos os projetos vinculados ao cliente
      const clientProjects = getClientProjects(clientToDelete);
      
      // Excluir todos os projetos vinculados
      if (clientProjects.length > 0) {
        const deleteProjectPromises = clientProjects.map(project => deleteProject(project.id));
        await Promise.all(deleteProjectPromises);
      }

      // Excluir o cliente
      await deleteClient(clientToDelete.id);
      
      setToast({ 
        message: `Cliente "${clientToDelete.name}" e ${clientProjects.length} projeto${clientProjects.length !== 1 ? 's' : ''} vinculado${clientProjects.length !== 1 ? 's' : ''} excluído${clientProjects.length !== 1 ? 's' : ''} com sucesso!`, 
        type: 'success' 
      });
      setTimeout(() => setToast(null), 5000);
      
      setShowDeleteModal(false);
      setClientToDelete(null);
    } catch (error: any) {
      console.error('Error deleting client:', error);
      setToast({ message: error.message || 'Erro ao excluir cliente', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setDeletingClient(false);
    }
  };

  // Sincronizar com Asaas
  const handleSyncWithAsaas = async (client: Client) => {
    if (!currentWorkspace?.id || !currentWorkspace.asaasApiKey) {
      setToast({ message: 'Configure a integração com Asaas nas Configurações primeiro', type: 'error' });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    // Verificar se usuário está autenticado
    const { getCurrentUser } = await import('../firebase/services');
    const currentUser = getCurrentUser();
    if (!currentUser) {
      setToast({ message: 'Você precisa estar logado para sincronizar com Asaas', type: 'error' });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    // Validar dados do cliente (email e CPF/CNPJ são obrigatórios para sincronizar com Asaas)
    const missingFields: string[] = [];
    if (!client.email) {
      missingFields.push('e-mail');
    }
    if (!client.cpfCnpj) {
      missingFields.push('CPF/CNPJ');
    }
    
    if (missingFields.length > 0) {
      const fieldsText = missingFields.length === 1 
        ? missingFields[0] 
        : `${missingFields[0]} e ${missingFields[1]}`;
      setToast({ 
        message: `Para sincronizar com Asaas, é necessário preencher o ${fieldsText}. Edite o cliente e adicione essas informações.`, 
        type: 'error' 
      });
      setTimeout(() => setToast(null), 5000);
      return;
    }

    setSyncingAsaas(true);
    try {
      console.log('[handleSyncWithAsaas] Iniciando sincronização', { 
        clientId: client.id, 
        workspaceId: currentWorkspace.id,
        hasAuth: !!currentUser 
      });
      
      await createAsaasCustomer({
        workspaceId: currentWorkspace.id,
        clientId: client.id,
        name: client.name,
        email: client.email,
        cpfCnpj: client.cpfCnpj,
        phone: client.phone,
        mobilePhone: client.mobilePhone,
        address: client.address,
      });
      
      setToast({ message: 'Cliente sincronizado com Asaas!', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (error: any) {
      console.error('Error syncing with Asaas:', error);
      
      let errorMessage = 'Erro ao sincronizar com Asaas';
      if (error.code === 'functions/unavailable' || error.message?.includes('CORS') || error.message?.includes('Failed to fetch')) {
        errorMessage = 'Erro de conexão. Verifique sua conexão e se as Functions foram deployadas corretamente. Se o problema persistir, verifique os logs no Firebase Console.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setToast({ message: errorMessage, type: 'error' });
      setTimeout(() => setToast(null), 5000);
    } finally {
      setSyncingAsaas(false);
    }
  };

  // Toggle expandir/colapsar projetos do cliente
  const toggleClientProjects = (clientId: string) => {
    setExpandedClientId(expandedClientId === clientId ? null : clientId);
  };

  // Sincronizar clientes antigos dos projetos
  const handleSyncOldClients = async () => {
    if (!currentWorkspace?.id) return;

    setSyncingOldClients(true);
    try {
      const result = await syncOldClientsFromProjects(currentWorkspace.id);
      
      setToast({ 
        message: `Sincronização concluída! ${result.clientsCreated} cliente${result.clientsCreated !== 1 ? 's' : ''} criado${result.clientsCreated !== 1 ? 's' : ''} e ${result.projectsUpdated} projeto${result.projectsUpdated !== 1 ? 's' : ''} vinculado${result.projectsUpdated !== 1 ? 's' : ''}.`, 
        type: 'success' 
      });
      setTimeout(() => setToast(null), 5000);
      
      setHasOldProjects(false);
    } catch (error: any) {
      console.error('Error syncing old clients:', error);
      setToast({ message: error.message || 'Erro ao sincronizar clientes antigos', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSyncingOldClients(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-in slide-in-from-right ${
          toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
        }`}>
          <span className="material-symbols-outlined text-lg">
            {toast.type === 'success' ? 'check_circle' : 'error'}
          </span>
          {toast.message}
        </div>
      )}

      <div className="flex flex-wrap justify-between items-end gap-4 mb-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-black leading-tight tracking-tight">Clientes</h1>
          <p className="text-slate-500 text-base font-normal">Gerencie seus clientes e veja projetos vinculados</p>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-2 px-4 h-10 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold">
            <span className="material-symbols-outlined text-lg text-primary">groups</span>
            {totalClients} clientes
          </div>
          <div className="flex items-center gap-2 px-4 h-10 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold">
            <span className="material-symbols-outlined text-lg text-primary">folder_open</span>
            {totalProjects} projetos
          </div>
          <button
            onClick={handleNewClient}
            className="flex items-center gap-2 px-4 h-10 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">person_add</span>
            Novo Cliente
          </button>
        </div>
      </div>

      {/* Banner de sincronização de clientes antigos */}
      {hasOldProjects && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-amber-600 dark:text-amber-400">sync</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-900 dark:text-amber-100">
                  Clientes antigos detectados
                </h3>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                  Alguns projetos foram criados antes do sistema de clientes. Sincronize para importá-los.
                </p>
              </div>
            </div>
            <button
              onClick={handleSyncOldClients}
              disabled={syncingOldClients}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-bold hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center gap-2 flex-shrink-0"
            >
              {syncingOldClients ? (
                <>
                  <span className="material-symbols-outlined text-base animate-spin">sync</span>
                  Sincronizando...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">sync</span>
                  Sincronizar Clientes
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 mb-8">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[240px]">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar cliente..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-sm font-semibold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none"
            />
          </div>

        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <span className="material-symbols-outlined text-5xl mb-3">person_add</span>
          <p className="text-base font-medium">Nenhum cliente cadastrado</p>
          <p className="text-sm mb-4">Cadastre clientes para gerar cobranças automáticas</p>
          <button
            onClick={handleNewClient}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors"
          >
            Cadastrar Cliente
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map(client => {
            const clientProjects = getClientProjects(client);
            const projectCount = clientProjects.length;
            const isExpanded = expandedClientId === client.id;
            
            return (
              <div
                key={client.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 hover:shadow-lg hover:border-primary/30 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 flex-1">
                    {hasClientAvatar(client) ? (
                      <div
                        className="size-12 rounded-xl bg-slate-200 ring-2 ring-white dark:ring-slate-800 shadow-sm flex-shrink-0"
                        style={{
                          backgroundImage: `url('${client.avatar}')`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center'
                        }}
                      />
                    ) : (
                      <div className="size-12 rounded-xl bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 text-2xl">person</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-base truncate">{client.name}</h3>
                      {client.cpfCnpj ? (
                        <p className="text-xs text-slate-500">{formatCpfCnpj(client.cpfCnpj)}</p>
                      ) : (
                        <p className="text-xs text-slate-400 italic">Sem CPF/CNPJ</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {client.asaasCustomerId ? (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px] font-bold uppercase rounded-full flex items-center gap-1" title="Sincronizado com Asaas">
                        <span className="material-symbols-outlined text-xs">check_circle</span>
                        Asaas
                      </span>
                    ) : currentWorkspace?.asaasApiKey ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSyncWithAsaas(client);
                        }}
                        disabled={syncingAsaas}
                        className="px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] font-bold uppercase rounded-full flex items-center gap-1 hover:bg-amber-200 transition-colors disabled:opacity-50"
                        title="Sincronizar com Asaas"
                      >
                        <span className="material-symbols-outlined text-xs">sync</span>
                        Sincronizar
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2 mb-4 text-sm">
                  {client.email && (
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <span className="material-symbols-outlined text-base text-slate-400">mail</span>
                      <span className="truncate">{client.email}</span>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <span className="material-symbols-outlined text-base text-slate-400">call</span>
                      <span>{client.phone}</span>
                    </div>
                  )}
                  {projectCount > 0 && (
                    <button
                      onClick={() => toggleClientProjects(client.id)}
                      className="w-full flex items-center justify-between gap-2 text-slate-600 dark:text-slate-400 hover:text-primary transition-colors p-2 -mx-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-base text-slate-400">folder</span>
                        <span>{projectCount} projeto{projectCount !== 1 ? 's' : ''}</span>
                      </div>
                      <span className={`material-symbols-outlined text-base transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                        expand_more
                      </span>
                    </button>
                  )}
                </div>

                {/* Lista de projetos expandida */}
                {isExpanded && projectCount > 0 && (
                  <div className="mb-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    {clientProjects.map(project => (
                      <div
                        key={project.id}
                        onClick={() => onProjectClick?.(project)}
                        className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 cursor-pointer hover:border-primary/30 hover:bg-primary/5 transition-all group"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div
                            className="size-8 rounded-lg bg-slate-200 flex-shrink-0"
                            style={{
                              backgroundImage: project.projectImage
                                ? `url('${project.projectImage}')`
                                : `url('${getProjectAvatar(project.name)}')`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center'
                            }}
                          />
                          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                            <p className="text-sm font-bold group-hover:text-primary transition-colors truncate">{project.name}</p>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500">
                              <span className="material-symbols-outlined text-xs">
                                {project.status === 'Completed' || project.status === 'Finished' ? 'check_circle' : 'progress_activity'}
                              </span>
                              <span className="truncate">{getProjectTypes(project).join(', ')}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <StatusBadge project={project} categories={categories} />
                          <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors">
                            chevron_right
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditClient(client);
                    }}
                    className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined text-base">edit</span>
                    Editar
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClient(client);
                    }}
                    className="px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center justify-center"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {showDeleteModal && clientToDelete && (
        <ConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setClientToDelete(null);
          }}
          onConfirm={handleConfirmDeleteClient}
          title="Excluir Cliente"
          message={
            <>
              <p className="mb-2">
                Tem certeza que deseja excluir o cliente <span className="font-bold">"{clientToDelete.name}"</span>?
              </p>
              {getClientProjects(clientToDelete).length > 0 && (
                <p className="text-amber-600 dark:text-amber-400 font-semibold mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                  <span className="material-symbols-outlined text-base align-middle mr-1">warning</span>
                  Atenção: {getClientProjects(clientToDelete).length} projeto{getClientProjects(clientToDelete).length !== 1 ? 's' : ''} vinculado{getClientProjects(clientToDelete).length !== 1 ? 's' : ''} a este cliente {getClientProjects(clientToDelete).length !== 1 ? 'serão' : 'será'} excluído{getClientProjects(clientToDelete).length !== 1 ? 's' : ''} permanentemente.
                </p>
              )}
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                Esta ação não pode ser desfeita.
              </p>
            </>
          }
          confirmText="Excluir"
          cancelText="Cancelar"
          type="danger"
          isLoading={deletingClient}
        />
      )}

      {/* Modal de Cliente */}
      {showClientModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-slate-900 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-xl font-black">
                {editingClient ? 'Editar Cliente' : 'Novo Cliente'}
              </h2>
              <button
                onClick={() => {
                  setShowClientModal(false);
                  resetClientForm();
                }}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Foto do Perfil */}
              {editingClient && (
                <div className="flex items-center gap-6 pb-6 border-b border-slate-200 dark:border-slate-800">
                  <div className="relative">
                    {editingClient.avatar ? (
                      <div
                        className="size-20 rounded-xl bg-slate-200 ring-2 ring-white dark:ring-slate-800 shadow-sm relative"
                        style={{
                          backgroundImage: `url('${editingClient.avatar}')`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center'
                        }}
                      >
                        {uploadingAvatar && (
                          <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                            <span className="material-symbols-outlined text-white animate-spin text-2xl">sync</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="size-20 rounded-xl bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center relative">
                        <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 text-4xl">person</span>
                        {uploadingAvatar && (
                          <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                            <span className="material-symbols-outlined text-white animate-spin text-2xl">sync</span>
                          </div>
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="absolute -bottom-2 -right-2 size-8 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-colors shadow-lg disabled:opacity-50"
                      title="Trocar foto"
                    >
                      <span className="material-symbols-outlined text-base">camera_alt</span>
                    </button>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        await handleAvatarUpload(file);
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Foto do Perfil</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                      Clique no ícone da câmera para trocar a foto
                    </p>
                    {!editingClient.avatar && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Foto atual: gerada automaticamente
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Dados Básicos */}
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Dados Básicos</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Nome Completo / Razão Social *
                    </label>
                    <input
                      type="text"
                      value={clientForm.name}
                      onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      placeholder="João da Silva ou Empresa LTDA"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      E-mail <span className="text-xs text-slate-400">(opcional)</span>
                    </label>
                    <input
                      type="email"
                      value={clientForm.email}
                      onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      placeholder="email@exemplo.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      CPF / CNPJ
                    </label>
                    <input
                      type="text"
                      value={clientForm.cpfCnpj}
                      onChange={(e) => setClientForm({ ...clientForm, cpfCnpj: formatCpfCnpj(e.target.value) })}
                      className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      placeholder="000.000.000-00 ou 00.000.000/0000-00"
                      maxLength={18}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Telefone
                    </label>
                    <input
                      type="text"
                      value={clientForm.phone}
                      onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      placeholder="(00) 0000-0000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Celular
                    </label>
                    <input
                      type="text"
                      value={clientForm.mobilePhone}
                      onChange={(e) => setClientForm({ ...clientForm, mobilePhone: e.target.value })}
                      className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>
              </div>

              {/* Endereço */}
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Endereço (opcional)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      CEP
                    </label>
                    <input
                      type="text"
                      value={clientForm.address.postalCode}
                      onChange={(e) => setClientForm({
                        ...clientForm,
                        address: { ...clientForm.address, postalCode: e.target.value }
                      })}
                      className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      placeholder="00000-000"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Rua / Logradouro
                    </label>
                    <input
                      type="text"
                      value={clientForm.address.street}
                      onChange={(e) => setClientForm({
                        ...clientForm,
                        address: { ...clientForm.address, street: e.target.value }
                      })}
                      className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      placeholder="Rua das Flores"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Número
                    </label>
                    <input
                      type="text"
                      value={clientForm.address.number}
                      onChange={(e) => setClientForm({
                        ...clientForm,
                        address: { ...clientForm.address, number: e.target.value }
                      })}
                      className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      placeholder="123"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Complemento
                    </label>
                    <input
                      type="text"
                      value={clientForm.address.complement}
                      onChange={(e) => setClientForm({
                        ...clientForm,
                        address: { ...clientForm.address, complement: e.target.value }
                      })}
                      className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      placeholder="Apto 101"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Bairro
                    </label>
                    <input
                      type="text"
                      value={clientForm.address.neighborhood}
                      onChange={(e) => setClientForm({
                        ...clientForm,
                        address: { ...clientForm.address, neighborhood: e.target.value }
                      })}
                      className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      placeholder="Centro"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Cidade
                    </label>
                    <input
                      type="text"
                      value={clientForm.address.city}
                      onChange={(e) => setClientForm({
                        ...clientForm,
                        address: { ...clientForm.address, city: e.target.value }
                      })}
                      className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                      placeholder="São Paulo"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Estado
                    </label>
                    <select
                      value={clientForm.address.state}
                      onChange={(e) => setClientForm({
                        ...clientForm,
                        address: { ...clientForm.address, state: e.target.value }
                      })}
                      className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                    >
                      <option value="">Selecione</option>
                      <option value="AC">AC</option>
                      <option value="AL">AL</option>
                      <option value="AP">AP</option>
                      <option value="AM">AM</option>
                      <option value="BA">BA</option>
                      <option value="CE">CE</option>
                      <option value="DF">DF</option>
                      <option value="ES">ES</option>
                      <option value="GO">GO</option>
                      <option value="MA">MA</option>
                      <option value="MT">MT</option>
                      <option value="MS">MS</option>
                      <option value="MG">MG</option>
                      <option value="PA">PA</option>
                      <option value="PB">PB</option>
                      <option value="PR">PR</option>
                      <option value="PE">PE</option>
                      <option value="PI">PI</option>
                      <option value="RJ">RJ</option>
                      <option value="RN">RN</option>
                      <option value="RS">RS</option>
                      <option value="RO">RO</option>
                      <option value="RR">RR</option>
                      <option value="SC">SC</option>
                      <option value="SP">SP</option>
                      <option value="SE">SE</option>
                      <option value="TO">TO</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white dark:bg-slate-900 px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowClientModal(false);
                  resetClientForm();
                }}
                className="px-4 py-2.5 text-slate-600 dark:text-slate-400 rounded-xl text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveClient}
                disabled={savingClient}
                className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {savingClient ? (
                  <>
                    <span className="material-symbols-outlined text-lg animate-spin">sync</span>
                    Salvando...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-lg">save</span>
                    {editingClient ? 'Salvar Alterações' : 'Cadastrar Cliente'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StatusBadge: React.FC<{ project: Project; categories: Category[] }> = ({ project, categories }) => {
  const status = project.status;

  // Verificar se é um projeto recorrente (considerando múltiplos tipos)
  const projectTypes = project.types || (project.type ? [project.type] : []);
  const isRecurring = projectTypes.some(typeName =>
    categories.find(cat => cat.name === typeName && cat.isRecurring)
  );

  // Verificar etapa baseado no stageId
  const isOnboardingStage = project.stageId?.includes('onboarding') || false;
  const isDevelopmentStage = project.stageId?.includes('development') || false;
  const isAdjustmentsStage = project.stageId?.includes('adjustments') || false;
  const isMaintenanceStage = project.stageId?.includes('maintenance') || false;

  const styles: Record<Project['status'], string> = {
    Lead: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    Active: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    Review: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    Completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    Finished: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  };

  // Determinar o label a ser exibido baseado na etapa (stageId)
  let displayLabel: string;
  let badgeStyle: string;

  // Se for serviço recorrente e estiver na etapa Manutenção, mostrar "Gestão" em marrom
  if (status === 'Completed' && isMaintenanceStage && isRecurring) {
    displayLabel = 'Gestão';
    badgeStyle = 'bg-amber-800/20 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
  } else if (isAdjustmentsStage) {
    // Se estiver na etapa Ajustes - azul
    displayLabel = 'Ajustes';
    badgeStyle = 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
  } else if (status === 'Lead' && isOnboardingStage) {
    displayLabel = 'On-boarding';
    badgeStyle = styles[status];
  } else if (status === 'Active' && isDevelopmentStage) {
    displayLabel = 'Desenvolvimento';
    badgeStyle = styles[status];
  } else if (status === 'Review') {
    displayLabel = 'Revisão';
    badgeStyle = styles[status];
  } else if (status === 'Completed') {
    displayLabel = 'Concluído';
    badgeStyle = styles[status];
  } else if (status === 'Finished') {
    displayLabel = 'Finalizado';
    badgeStyle = styles[status];
  } else {
    // Fallback para os labels padrão
    displayLabel = status === 'Lead' ? 'Lead' : status === 'Active' ? 'Ativo' : status;
    badgeStyle = styles[status];
  }

  return (
    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${badgeStyle}`}>
      {displayLabel}
    </span>
  );
};
