import React, { useEffect, useMemo, useState } from 'react';
import { Project, Workspace, Category, Client } from '../types';
import { subscribeToProjects, subscribeToCategories, subscribeToClients, addClient, updateClient, deleteClient } from '../firebase/services';
import { formatCpfCnpj, validateCpfCnpj, createAsaasCustomer } from '../firebase/asaas';

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
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [viewMode, setViewMode] = useState<'registered' | 'byProject'>('registered');
  
  // Modal de cliente
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [savingClient, setSavingClient] = useState(false);
  const [syncingAsaas, setSyncingAsaas] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
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

  // Gerar URL de avatar do cliente baseado no nome
  const getClientAvatar = (clientName: string) => {
    const seed = clientName.toLowerCase().replace(/\s+/g, '');
    return `https://picsum.photos/seed/${seed}/80/80`;
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

  // Filtrar projetos por status
  const filteredProjects = useMemo(() => {
    return projects.filter(project => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'active') return project.status === 'Lead' || project.status === 'Active' || project.status === 'Review';
      if (statusFilter === 'completed') return project.status === 'Completed' || project.status === 'Finished';
      return true;
    });
  }, [projects, statusFilter]);

  const groupedClients = useMemo(() => {
    const groups: Record<string, Project[]> = {};
    filteredProjects.forEach(project => {
      const clientName = (project.client || 'Sem cliente').trim() || 'Sem cliente';
      if (!groups[clientName]) groups[clientName] = [];
      groups[clientName].push(project);
    });

    return Object.entries(groups)
      .map(([client, items]) => ({
        client,
        projects: items.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
          const dateB = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        })
      }))
      .filter(group => {
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        return (
          group.client.toLowerCase().includes(query) ||
          group.projects.some(p => p.name.toLowerCase().includes(query))
        );
      })
      .sort((a, b) => {
        if (a.client === 'Sem cliente') return 1;
        if (b.client === 'Sem cliente') return -1;
        return a.client.localeCompare(b.client);
      });
  }, [filteredProjects, searchQuery]);

  // Filtrar clientes cadastrados
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const query = searchQuery.toLowerCase();
    return clients.filter(client =>
      client.name.toLowerCase().includes(query) ||
      client.email.toLowerCase().includes(query) ||
      client.cpfCnpj.includes(query.replace(/\D/g, ''))
    );
  }, [clients, searchQuery]);

  // Contadores
  const activeCount = projects.filter(p => p.status === 'Lead' || p.status === 'Active' || p.status === 'Review').length;
  const completedCount = projects.filter(p => p.status === 'Completed' || p.status === 'Finished').length;

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
      cpfCnpj: formatCpfCnpj(client.cpfCnpj),
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

  // Salvar cliente
  const handleSaveClient = async () => {
    if (!currentWorkspace?.id) return;
    
    // Validações
    if (!clientForm.name.trim()) {
      setToast({ message: 'Nome é obrigatório', type: 'error' });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    
    if (!clientForm.email.trim()) {
      setToast({ message: 'E-mail é obrigatório', type: 'error' });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    
    if (!clientForm.cpfCnpj.trim()) {
      setToast({ message: 'CPF/CNPJ é obrigatório', type: 'error' });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    
    if (!validateCpfCnpj(clientForm.cpfCnpj)) {
      setToast({ message: 'CPF/CNPJ inválido', type: 'error' });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    setSavingClient(true);
    try {
      const clientData = {
        name: clientForm.name.trim(),
        email: clientForm.email.trim(),
        cpfCnpj: clientForm.cpfCnpj.replace(/\D/g, ''),
        phone: clientForm.phone.replace(/\D/g, '') || undefined,
        mobilePhone: clientForm.mobilePhone.replace(/\D/g, '') || undefined,
        address: {
          street: clientForm.address.street.trim() || undefined,
          number: clientForm.address.number.trim() || undefined,
          complement: clientForm.address.complement.trim() || undefined,
          neighborhood: clientForm.address.neighborhood.trim() || undefined,
          city: clientForm.address.city.trim() || undefined,
          state: clientForm.address.state.trim() || undefined,
          postalCode: clientForm.address.postalCode.replace(/\D/g, '') || undefined,
        },
        workspaceId: currentWorkspace.id,
      };

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

  // Excluir cliente
  const handleDeleteClient = async (client: Client) => {
    if (!confirm(`Tem certeza que deseja excluir o cliente "${client.name}"?`)) {
      return;
    }

    try {
      await deleteClient(client.id);
      setToast({ message: 'Cliente excluído com sucesso!', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (error: any) {
      console.error('Error deleting client:', error);
      setToast({ message: error.message || 'Erro ao excluir cliente', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  // Sincronizar com Asaas
  const handleSyncWithAsaas = async (client: Client) => {
    if (!currentWorkspace?.id || !currentWorkspace.asaasApiKey) {
      setToast({ message: 'Configure a integração com Asaas nas Configurações primeiro', type: 'error' });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    setSyncingAsaas(true);
    try {
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
      setToast({ message: error.message || 'Erro ao sincronizar com Asaas', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSyncingAsaas(false);
    }
  };

  // Contar projetos de um cliente
  const getClientProjectCount = (clientName: string) => {
    return projects.filter(p => p.client?.toLowerCase() === clientName.toLowerCase()).length;
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

          {/* Modo de Visualização */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              onClick={() => setViewMode('registered')}
              className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${viewMode === 'registered'
                ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
            >
              <span className="material-symbols-outlined text-sm align-middle mr-1">badge</span>
              Cadastrados
            </button>
            <button
              onClick={() => setViewMode('byProject')}
              className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${viewMode === 'byProject'
                ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
            >
              <span className="material-symbols-outlined text-sm align-middle mr-1">folder</span>
              Por Projeto
            </button>
          </div>

          {/* Filtro de Status (só para visualização por projeto) */}
          {viewMode === 'byProject' && (
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${statusFilter === 'all'
                  ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
              >
                Todos
                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-slate-200/50 dark:bg-slate-600/50 text-[10px]">
                  {projects.length}
                </span>
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${statusFilter === 'active'
                  ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
              >
                Ativos
                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 text-[10px]">
                  {activeCount}
                </span>
              </button>
              <button
                onClick={() => setStatusFilter('completed')}
                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${statusFilter === 'completed'
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
              >
                Concluídos
                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 text-[10px]">
                  {completedCount}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : viewMode === 'registered' ? (
        // Visualização de Clientes Cadastrados
        filteredClients.length === 0 ? (
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
              const projectCount = getClientProjectCount(client.name);
              return (
                <div
                  key={client.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 hover:shadow-lg hover:border-primary/30 transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="size-12 rounded-xl bg-slate-200 ring-2 ring-white dark:ring-slate-800 shadow-sm"
                        style={{
                          backgroundImage: `url('${getClientAvatar(client.name)}')`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center'
                        }}
                      />
                      <div>
                        <h3 className="font-bold text-base">{client.name}</h3>
                        <p className="text-xs text-slate-500">{formatCpfCnpj(client.cpfCnpj)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {client.asaasCustomerId ? (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px] font-bold uppercase rounded-full flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">link</span>
                          Asaas
                        </span>
                      ) : currentWorkspace?.asaasApiKey && (
                        <button
                          onClick={() => handleSyncWithAsaas(client)}
                          disabled={syncingAsaas}
                          className="px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] font-bold uppercase rounded-full flex items-center gap-1 hover:bg-amber-200 transition-colors disabled:opacity-50"
                          title="Sincronizar com Asaas"
                        >
                          <span className="material-symbols-outlined text-xs">sync</span>
                          Sincronizar
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 mb-4 text-sm">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <span className="material-symbols-outlined text-base text-slate-400">mail</span>
                      <span className="truncate">{client.email}</span>
                    </div>
                    {client.phone && (
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <span className="material-symbols-outlined text-base text-slate-400">call</span>
                        <span>{client.phone}</span>
                      </div>
                    )}
                    {projectCount > 0 && (
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <span className="material-symbols-outlined text-base text-slate-400">folder</span>
                        <span>{projectCount} projeto{projectCount !== 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => handleEditClient(client)}
                      className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-base">edit</span>
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeleteClient(client)}
                      className="px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center justify-center"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        // Visualização por Projeto (agrupado)
        groupedClients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <span className="material-symbols-outlined text-5xl mb-3">group_off</span>
            <p className="text-base font-medium">Nenhum cliente encontrado</p>
            <p className="text-sm">Crie projetos para começar a ver clientes aqui</p>
          </div>
        ) : (
          <div className="columns-1 lg:columns-2 gap-6">
            {groupedClients.map(({ client, projects: clientProjects }) => {
              // Pegar a foto do cliente do primeiro projeto que tiver avatar
              const clientAvatar = clientProjects.find(p => p.avatar)?.avatar || getClientAvatar(client);

              return (
                <div key={client} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm mb-6 break-inside-avoid">
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 mb-4 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {/* Avatar do Cliente */}
                        <div
                          className="size-12 rounded-xl bg-slate-200 ring-2 ring-white dark:ring-slate-800 shadow-sm"
                          style={{
                            backgroundImage: `url('${clientAvatar}')`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center'
                          }}
                        />
                        <div>
                          <h3 className="text-lg font-bold">{client}</h3>
                          <p className="text-xs text-slate-500">{clientProjects.length} projeto{clientProjects.length !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Indicador de projetos ativos/concluídos */}
                        {clientProjects.some(p => p.status === 'Active' || p.status === 'Lead' || p.status === 'Review') && (
                          <span className="px-2 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                            {clientProjects.filter(p => p.status === 'Active' || p.status === 'Lead' || p.status === 'Review').length} ativo{clientProjects.filter(p => p.status === 'Active' || p.status === 'Lead' || p.status === 'Review').length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>


                  <div className="space-y-2">
                    {clientProjects.map(project => (
                      <div
                        key={project.id}
                        onClick={() => onProjectClick?.(project)}
                        className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 cursor-pointer hover:border-primary/30 hover:bg-primary/5 transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          {/* Foto do Projeto */}
                          <div
                            className="size-8 rounded-lg bg-slate-200"
                            style={{
                              backgroundImage: project.projectImage
                                ? `url('${project.projectImage}')`
                                : `url('${getProjectAvatar(project.name)}')`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center'
                            }}
                          />
                          <div className="flex flex-col gap-0.5">
                            <p className="text-sm font-bold group-hover:text-primary transition-colors">{project.name}</p>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500">
                              <span className="material-symbols-outlined text-xs">
                                {project.status === 'Completed' || project.status === 'Finished' ? 'check_circle' : 'progress_activity'}
                              </span>
                              <span>{getProjectTypes(project).join(', ')}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge project={project} categories={categories} />
                          <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors">
                            chevron_right
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )
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
                      E-mail *
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
                      CPF / CNPJ *
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
