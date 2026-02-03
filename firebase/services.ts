import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  setDoc,
  query,
  orderBy,
  where,
  onSnapshot,
  enableIndexedDbPersistence,
  or
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  StorageReference
} from "firebase/storage";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User
} from "firebase/auth";
import { db, storage, auth } from "./config";
import { Project, Activity, TeamMember, StageTask, ProjectStageTask, ProjectFile, Category, Invoice, WorkspaceMember, Workspace, Client } from "../types";

// Habilitar persistência offline (opcional)
try {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') {
      console.warn("Multiple tabs open, persistence can only be enabled in one tab at a time.");
    } else if (err.code == 'unimplemented') {
      console.warn("The current browser does not support all of the features required to enable persistence");
    }
  });
} catch (error) {
  console.warn("Error enabling persistence:", error);
}

const PROJECTS_COLLECTION = "projects";
const CATEGORIES_COLLECTION = "categories";
const ACTIVITIES_COLLECTION = "activities";
const TEAM_MEMBERS_COLLECTION = "teamMembers";
const STAGES_COLLECTION = "stages";
const STAGE_TASKS_COLLECTION = "stageTasks";
const PROJECT_STAGE_TASKS_COLLECTION = "projectStageTasks";
const PROJECT_FILES_COLLECTION = "projectFiles";
const WORKSPACES_COLLECTION = "workspaces";
const INVOICES_COLLECTION = "invoices";
const CLIENTS_COLLECTION = "clients";

// Projects
export const getProjects = async (): Promise<Project[]> => {
  try {
    const q = query(collection(db, PROJECTS_COLLECTION), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt
    })) as Project[];
  } catch (error) {
    console.error("Error getting projects:", error);
    return [];
  }
};

export const subscribeToProjects = (callback: (projects: Project[]) => void, workspaceId?: string | null, userId?: string | null) => {
  if (!db) {
    console.warn("Firebase não está inicializado");
    return () => { };
  }

  // Filtrar por userId e workspaceId
  let q;
  const conditions: any[] = [];

  if (userId) {
    conditions.push(where("userId", "==", userId));
  }

  if (workspaceId) {
    conditions.push(where("workspaceId", "==", workspaceId));
  }

  if (conditions.length > 0) {
    q = query(collection(db, PROJECTS_COLLECTION), ...conditions);
  } else {
    // Se não houver filtros, usar orderBy
    q = query(collection(db, PROJECTS_COLLECTION), orderBy("createdAt", "desc"));
  }

  return onSnapshot(q, (querySnapshot) => {
    const projects = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt
      };
    }) as Project[];

    // Se houver workspaceId, filtrar no cliente (caso haja projetos sem workspaceId)
    let filteredProjects = projects;
    if (workspaceId) {
      filteredProjects = projects.filter(p => p.workspaceId === workspaceId || !p.workspaceId);
      // Ordenar no cliente por createdAt (mais recente primeiro)
      filteredProjects.sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt || 0).getTime();
        const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt || 0).getTime();
        return dateB - dateA; // Descendente
      });
    }

    callback(filteredProjects);
  }, (error) => {
    console.error("Error in projects subscription:", error);
    callback([]);
  });
};

// Get unique clients from all projects (filtered by workspaceId)
export const getUniqueClients = async (workspaceId?: string | null): Promise<string[]> => {
  try {
    let q;
    if (workspaceId) {
      q = query(collection(db, PROJECTS_COLLECTION), where("workspaceId", "==", workspaceId));
    } else {
      q = collection(db, PROJECTS_COLLECTION);
    }
    const querySnapshot = await getDocs(q);
    const clients = new Set<string>();
    querySnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.client && typeof data.client === 'string') {
        clients.add(data.client);
      }
    });
    return Array.from(clients).sort();
  } catch (error) {
    console.error("Error getting unique clients:", error);
    return [];
  }
};

export const addProject = async (project: Omit<Project, "id">, workspaceId?: string | null, userId?: string | null): Promise<string> => {
  try {
    const projectData: any = {
      ...project,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Adicionar workspaceId se fornecido
    if (workspaceId) {
      projectData.workspaceId = workspaceId;
    }

    // Adicionar userId se fornecido
    if (userId) {
      projectData.userId = userId;
    }

    // Remover campos undefined (Firestore não aceita undefined)
    Object.keys(projectData).forEach(key => {
      if (projectData[key] === undefined) {
        delete projectData[key];
      }
    });

    const docRef = await addDoc(collection(db, PROJECTS_COLLECTION), projectData);
    return docRef.id;
  } catch (error) {
    console.error("Error adding project:", error);
    throw error;
  }
};

export const updateProject = async (projectId: string, updates: Partial<Project>): Promise<void> => {
  try {
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
    const updateData: any = {
      ...updates,
      updatedAt: new Date()
    };

    // Remover campos undefined (Firestore não aceita undefined)
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    await updateDoc(projectRef, updateData);
  } catch (error) {
    console.error("Error updating project:", error);
    throw error;
  }
};

// Atualizar avatar de todos os projetos do mesmo cliente
export const updateClientAvatarInAllProjects = async (
  clientName: string, 
  avatarUrl: string, 
  workspaceId?: string | null, 
  userId?: string | null,
  clientId?: string | null
): Promise<void> => {
  try {
    if (!db) {
      throw new Error("Firebase não está inicializado");
    }

    // Buscar projetos por clientId (prioridade) ou por nome do cliente
    const projectIds = new Set<string>();
    
    // Buscar por clientId se fornecido
    if (clientId) {
      const conditionsById: any[] = [where("clientId", "==", clientId)];
      if (workspaceId) {
        conditionsById.push(where("workspaceId", "==", workspaceId));
      }
      const qById = query(collection(db, PROJECTS_COLLECTION), ...conditionsById);
      const snapshotById = await getDocs(qById);
      snapshotById.docs.forEach(doc => projectIds.add(doc.id));
    }
    
    // Buscar por nome do cliente (compatibilidade com projetos antigos)
    const conditionsByName: any[] = [where("client", "==", clientName)];
    if (workspaceId) {
      conditionsByName.push(where("workspaceId", "==", workspaceId));
    }
    if (userId) {
      conditionsByName.push(where("userId", "==", userId));
    }
    const qByName = query(collection(db, PROJECTS_COLLECTION), ...conditionsByName);
    const snapshotByName = await getDocs(qByName);
    snapshotByName.docs.forEach(doc => projectIds.add(doc.id));

    // Atualizar todos os projetos encontrados
    if (projectIds.size > 0) {
      const updatePromises = Array.from(projectIds).map(projectId =>
        updateDoc(doc(db, PROJECTS_COLLECTION, projectId), {
          avatar: avatarUrl,
          updatedAt: new Date()
        })
      );

      await Promise.all(updatePromises);
      console.log(`✅ [updateClientAvatarInAllProjects] ${projectIds.size} projeto(s) atualizado(s) com novo avatar`);
    }
  } catch (error) {
    console.error("Error updating client avatar in all projects:", error);
    throw error;
  }
};

// Função para remover o campo stageId de um projeto (para serviços recorrentes)
export const removeProjectStageId = async (projectId: string): Promise<void> => {
  try {
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
    await updateDoc(projectRef, {
      stageId: deleteField(),
      updatedAt: new Date()
    });
  } catch (error) {
    console.error("Error removing project stageId:", error);
    throw error;
  }
};

export const subscribeToProject = (projectId: string, callback: (project: Project | null) => void) => {
  const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
  return onSnapshot(projectRef, (docSnapshot) => {
    if (docSnapshot.exists()) {
      const data = docSnapshot.data();
      const project = {
        id: docSnapshot.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt
      } as Project;
      callback(project);
    } else {
      callback(null);
    }
  }, (error) => {
    console.error("Error in project subscription:", error);
    callback(null);
  });
};

export const deleteProject = async (projectId: string): Promise<void> => {
  try {
    if (!db) {
      throw new Error("Firebase não está inicializado");
    }

    // Primeiro, buscar e excluir todas as faturas relacionadas ao projeto
    const invoicesQuery = query(
      collection(db, INVOICES_COLLECTION),
      where("projectId", "==", projectId)
    );
    const invoicesSnapshot = await getDocs(invoicesQuery);

    // Excluir todas as faturas encontradas
    const deleteInvoicePromises = invoicesSnapshot.docs.map(invoiceDoc =>
      deleteDoc(doc(db, INVOICES_COLLECTION, invoiceDoc.id))
    );
    await Promise.all(deleteInvoicePromises);

    // Depois, excluir o projeto
    await deleteDoc(doc(db, PROJECTS_COLLECTION, projectId));
  } catch (error) {
    console.error("Error deleting project:", error);
    throw error;
  }
};

// Categories
export const getCategories = async (): Promise<string[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, CATEGORIES_COLLECTION));
    const categories = querySnapshot.docs.map(doc => doc.data().name);
    return categories.length > 0 ? categories : ['Web Design', 'App Dev', 'Identidade Visual'];
  } catch (error) {
    console.error("Error getting categories:", error);
    return ['Web Design', 'App Dev', 'Identidade Visual'];
  }
};

export const subscribeToCategories = (callback: (categories: Category[]) => void, workspaceId?: string | null, userId?: string | null) => {
  if (!db) {
    console.warn("Firebase não está inicializado");
    return () => { };
  }

  // Filtrar ESTRITAMENTE por workspaceId - só retorna categorias do workspace específico
  let q;

  if (workspaceId) {
    // Buscar APENAS categorias que pertencem a este workspace
    q = query(
      collection(db, CATEGORIES_COLLECTION),
      where("workspaceId", "==", workspaceId)
    );
  } else if (userId) {
    // Se não tem workspaceId mas tem userId, buscar todas do usuário
    q = query(
      collection(db, CATEGORIES_COLLECTION),
      where("userId", "==", userId)
    );
  } else {
    // Sem filtros - não deveria acontecer em produção
    q = query(collection(db, CATEGORIES_COLLECTION));
  }

  return onSnapshot(q, (querySnapshot) => {
    const categories = querySnapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          isRecurring: data.isRecurring || false,
          workspaceId: data.workspaceId,
          order: data.order ?? 999,
          createdAt: data.createdAt
        };
      }) as Category[];

    // Ordenar por order (menor primeiro), depois por createdAt para estabilidade
    categories.sort((a, b) => {
      const orderA = a.order ?? 999;
      const orderB = b.order ?? 999;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      // Se order for igual, ordenar por data de criação
      const dateA = a.createdAt?.toDate?.() || new Date(0);
      const dateB = b.createdAt?.toDate?.() || new Date(0);
      return dateA.getTime() - dateB.getTime();
    });

    // Retornar as categorias encontradas (pode ser vazio se todas foram deletadas)
    callback(categories);
  }, (error) => {
    console.error("Error in categories subscription:", error);
    // Se não houver workspaceId, retornar padrão em caso de erro
    if (!workspaceId) {
      callback([
        { id: 'default-1', name: 'Web Design', isRecurring: false },
        { id: 'default-2', name: 'App Dev', isRecurring: false },
        { id: 'default-3', name: 'Identidade Visual', isRecurring: false }
      ]);
    } else {
      callback([]);
    }
  });
};

export const addCategory = async (categoryName: string, workspaceId?: string | null, isRecurring: boolean = false, userId?: string | null): Promise<void> => {
  try {
    if (!db) {
      throw new Error("Firebase não está inicializado");
    }

    // Calcular o próximo order baseado nas categorias existentes
    let maxOrder = 0;
    const conditions: any[] = [];
    if (workspaceId) {
      conditions.push(where("workspaceId", "==", workspaceId));
    }
    if (userId) {
      conditions.push(where("userId", "==", userId));
    }

    if (conditions.length > 0) {
      const q = query(collection(db, CATEGORIES_COLLECTION), ...conditions);
      const snapshot = await getDocs(q);
      snapshot.forEach((doc) => {
        const data = doc.data();
        const order = data.order ?? 0;
        if (order > maxOrder) maxOrder = order;
      });
    }

    const categoryData: any = {
      name: categoryName,
      isRecurring: isRecurring,
      order: maxOrder + 1,
      createdAt: new Date()
    };
    if (workspaceId) {
      categoryData.workspaceId = workspaceId;
    }
    if (userId) {
      categoryData.userId = userId;
    }
    await addDoc(collection(db, CATEGORIES_COLLECTION), categoryData);
  } catch (error) {
    console.error("Error adding category:", error);
    throw error;
  }
};

export const updateCategoryOrder = async (categoryId: string, newOrder: number): Promise<void> => {
  try {
    if (!db) {
      throw new Error("Firebase não está inicializado");
    }
    await updateDoc(doc(db, CATEGORIES_COLLECTION, categoryId), {
      order: newOrder
    });
  } catch (error) {
    console.error("Error updating category order:", error);
    throw error;
  }
};

export const updateCategoriesOrder = async (categoryOrders: { id: string; order: number }[]): Promise<void> => {
  try {
    if (!db) {
      throw new Error("Firebase não está inicializado");
    }
    // Atualizar todas as categorias em paralelo
    const updates = categoryOrders.map(({ id, order }) =>
      updateDoc(doc(db, CATEGORIES_COLLECTION, id), { order })
    );
    await Promise.all(updates);
  } catch (error) {
    console.error("Error updating categories order:", error);
    throw error;
  }
};

export const deleteCategoryById = async (categoryId: string): Promise<void> => {
  try {
    if (!db) {
      throw new Error("Firebase não está inicializado");
    }
    await deleteDoc(doc(db, CATEGORIES_COLLECTION, categoryId));
  } catch (error) {
    console.error("Error deleting category by ID:", error);
    throw error;
  }
};

export const deleteCategory = async (categoryName: string, workspaceId?: string | null): Promise<void> => {
  try {
    if (!db) {
      throw new Error("Firebase não está inicializado");
    }

    // Usar apenas workspaceId na query para evitar índice composto, filtrar nome no cliente
    let q;
    if (workspaceId) {
      // Filtrar por workspaceId apenas
      q = query(
        collection(db, CATEGORIES_COLLECTION),
        where("workspaceId", "==", workspaceId)
      );
    } else {
      // Se não houver workspaceId, buscar todas
      q = query(collection(db, CATEGORIES_COLLECTION));
    }

    const querySnapshot = await getDocs(q);
    const categoryDoc = querySnapshot.docs.find(doc => {
      const data = doc.data();
      // Filtrar por nome no cliente
      if (data.name !== categoryName) {
        return false;
      }
      // Se houver workspaceId, garantir que corresponde
      if (workspaceId && data.workspaceId !== workspaceId) {
        return false;
      }
      return true;
    });

    if (categoryDoc) {
      await deleteDoc(doc(db, CATEGORIES_COLLECTION, categoryDoc.id));
      console.log(`✅ Categoria "${categoryName}" excluída com sucesso`);
    } else {
      console.warn(`⚠️ Categoria "${categoryName}" não encontrada para exclusão no workspace ${workspaceId || 'geral'}`);
    }
  } catch (error) {
    console.error("Error deleting category:", error);
    throw error;
  }
};

// Activities
export const getProjectActivities = async (projectId: string): Promise<Activity[]> => {
  try {
    const q = query(
      collection(db, ACTIVITIES_COLLECTION),
      where("projectId", "==", projectId)
    );
    const querySnapshot = await getDocs(q);
    const activities = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || data.createdAt
      } as Activity;
    });
    // Ordenar em memória
    return activities.sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return dateB.getTime() - dateA.getTime();
    });
  } catch (error) {
    console.error("Error getting activities:", error);
    return [];
  }
};

export const subscribeToProjectActivities = (projectId: string, callback: (activities: Activity[]) => void) => {
  const q = query(
    collection(db, ACTIVITIES_COLLECTION),
    where("projectId", "==", projectId)
  );
  return onSnapshot(q, (querySnapshot) => {
    const activities = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || data.createdAt
      } as Activity;
    }).sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return dateB.getTime() - dateA.getTime();
    });
    callback(activities);
  }, (error) => {
    console.error("Error in activities subscription:", error);
    // Se o erro for de índice, tenta sem orderBy
    if (error.code === 'failed-precondition') {
      const qSimple = query(collection(db, ACTIVITIES_COLLECTION), where("projectId", "==", projectId));
      return onSnapshot(qSimple, (querySnapshot) => {
        const activities = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate?.() || data.createdAt
          } as Activity;
        }).sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return dateB.getTime() - dateA.getTime();
        });
        callback(activities);
      });
    }
    callback([]);
  });
};

export const addActivity = async (activity: Omit<Activity, "id">): Promise<string> => {
  try {
    const activityData = {
      projectId: activity.projectId,
      text: activity.text,
      icon: activity.icon,
      userName: activity.userName || 'Usuário',
      createdAt: new Date()
    };
    console.log("Saving activity to Firestore:", activityData);
    const docRef = await addDoc(collection(db, ACTIVITIES_COLLECTION), activityData);
    console.log("Activity saved with ID:", docRef.id);
    return docRef.id;
  } catch (error: any) {
    console.error("Error adding activity:", error);
    console.error("Error code:", error?.code);
    console.error("Error message:", error?.message);
    throw error;
  }
};

// Team Members
export const getProjectTeamMembers = async (projectId: string): Promise<TeamMember[]> => {
  try {
    const q = query(
      collection(db, TEAM_MEMBERS_COLLECTION),
      where("projectId", "==", projectId)
    );
    const querySnapshot = await getDocs(q);
    const members = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        addedAt: data.addedAt?.toDate?.() || data.addedAt
      } as TeamMember;
    });
    // Ordenar em memória
    return members.sort((a, b) => {
      const dateA = a.addedAt?.toDate ? a.addedAt.toDate() : new Date(a.addedAt);
      const dateB = b.addedAt?.toDate ? b.addedAt.toDate() : new Date(b.addedAt);
      return dateB.getTime() - dateA.getTime();
    });
  } catch (error) {
    console.error("Error getting team members:", error);
    return [];
  }
};

export const subscribeToProjectTeamMembers = (projectId: string, callback: (members: TeamMember[]) => void) => {
  const q = query(
    collection(db, TEAM_MEMBERS_COLLECTION),
    where("projectId", "==", projectId)
  );
  return onSnapshot(q, (querySnapshot) => {
    const members = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        addedAt: data.addedAt?.toDate?.() || data.addedAt
      } as TeamMember;
    }).sort((a, b) => {
      const dateA = a.addedAt?.toDate ? a.addedAt.toDate() : new Date(a.addedAt);
      const dateB = b.addedAt?.toDate ? b.addedAt.toDate() : new Date(b.addedAt);
      return dateB.getTime() - dateA.getTime();
    });
    callback(members);
  }, (error) => {
    console.error("Error in team members subscription:", error);
    callback([]);
  });
};

export const addTeamMember = async (member: Omit<TeamMember, "id">): Promise<string> => {
  try {
    const memberData = {
      projectId: member.projectId,
      name: member.name,
      role: member.role || '',
      avatar: member.avatar || `https://picsum.photos/seed/${member.name}/40/40`,
      email: member.email || '',
      addedAt: new Date()
    };
    console.log("Saving team member to Firestore:", memberData);
    const docRef = await addDoc(collection(db, TEAM_MEMBERS_COLLECTION), memberData);
    console.log("Team member saved with ID:", docRef.id);
    return docRef.id;
  } catch (error: any) {
    console.error("Error adding team member:", error);
    console.error("Error code:", error?.code);
    console.error("Error message:", error?.message);
    throw error;
  }
};

export const removeTeamMember = async (memberId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, TEAM_MEMBERS_COLLECTION, memberId));
  } catch (error) {
    console.error("Error removing team member:", error);
    throw error;
  }
};

// Stages
export interface Stage {
  id: string;
  title: string;
  status: 'Lead' | 'Active' | 'Completed' | 'Review';
  order: number;
  progress: number;
  isFixed?: boolean; // Etapas fixas não podem ser excluídas
}

export const getStages = async (): Promise<Stage[]> => {
  try {
    const q = query(collection(db, STAGES_COLLECTION), orderBy("order", "asc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Stage[];
  } catch (error) {
    console.error("Error getting stages:", error);
    return [];
  }
};

export const subscribeToStages = (callback: (stages: Stage[]) => void, workspaceId?: string | null, userId?: string | null) => {
  if (!db) {
    console.warn("Firebase não está inicializado");
    return () => { };
  }

  // Filtrar por userId e workspaceId
  let q;
  const conditions: any[] = [];

  if (userId) {
    conditions.push(where("userId", "==", userId));
  }

  if (workspaceId) {
    conditions.push(where("workspaceId", "==", workspaceId));
  }

  if (conditions.length > 0) {
    q = query(collection(db, STAGES_COLLECTION), ...conditions);
  } else {
    q = query(collection(db, STAGES_COLLECTION), orderBy("order", "asc"));
  }

  return onSnapshot(q, (querySnapshot) => {
    const stages = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Stage[];

    // Filtrar no cliente se necessário
    let filteredStages = stages;
    if (workspaceId) {
      filteredStages = stages.filter(s => {
        // Incluir etapas do workspace ou etapas sem workspaceId (compatibilidade)
        return s.workspaceId === workspaceId || !s.workspaceId;
      });
    }

    // Sempre ordenar no cliente quando há workspaceId (ou se não há orderBy)
    if (workspaceId || !q || !q._query || !q._query.explicitOrderBy) {
      filteredStages.sort((a, b) => (a.order || 0) - (b.order || 0));
    }

    callback(filteredStages);
  }, (error) => {
    console.error("Error in stages subscription:", error);
    callback([]);
  });
};

export const addStage = async (stage: Omit<Stage, "id">, workspaceId?: string | null, userId?: string | null): Promise<string> => {
  try {
    const stageData: any = { ...stage };
    if (workspaceId) {
      stageData.workspaceId = workspaceId;
    }
    if (userId) {
      stageData.userId = userId;
    }
    const docRef = await addDoc(collection(db, STAGES_COLLECTION), stageData);
    return docRef.id;
  } catch (error) {
    console.error("Error adding stage:", error);
    throw error;
  }
};

export const updateStage = async (stageId: string, updates: Partial<Stage>): Promise<void> => {
  try {
    const stageRef = doc(db, STAGES_COLLECTION, stageId);
    await updateDoc(stageRef, updates);
  } catch (error) {
    console.error("Error updating stage:", error);
    throw error;
  }
};

export const deleteStage = async (stageId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, STAGES_COLLECTION, stageId));
  } catch (error) {
    console.error("Error deleting stage:", error);
    throw error;
  }
};

export const saveStages = async (stages: Stage[], workspaceId?: string | null, userId?: string | null): Promise<void> => {
  try {
    console.log("saveStages: Iniciando salvamento de", stages.length, "etapas para workspace:", workspaceId);

    // Primeiro, deletar todas as etapas existentes do workspace
    const existingStages = await getStages();
    const stagesToDelete = workspaceId
      ? existingStages.filter(s =>
        (s.workspaceId === workspaceId || (!s.workspaceId && workspaceId)) &&
        (!userId || (s as any).userId === userId)
      )
      : existingStages.filter(s => !userId || (s as any).userId === userId);

    console.log("saveStages: Etapas existentes no Firebase para deletar:", stagesToDelete.length);

    if (stagesToDelete.length > 0) {
      await Promise.all(stagesToDelete.map(stage => {
        console.log("saveStages: Deletando etapa:", stage.id);
        return deleteStage(stage.id);
      }));
    }

    // Depois, adicionar as novas etapas com workspaceId
    // IMPORTANTE: Para etapas fixas (isFixed: true), usar setDoc com ID explícito
    // para preservar os IDs como 'onboarding', 'development', 'review', 'completed'
    const promises = stages.map(stage => {
      const { id, ...stageData } = stage;
      if (workspaceId) {
        (stageData as any).workspaceId = workspaceId;
      }

      // Adicionar userId se fornecido
      if (userId) {
        (stageData as any).userId = userId;
      }

      // Se é uma etapa fixa com ID predefinido, usar setDoc para preservar o ID
      if (stage.isFixed && id) {
        // Criar ID único combinando o ID da etapa com o workspaceId para evitar conflitos
        const uniqueId = workspaceId ? `${id}-${workspaceId}` : id;
        console.log("saveStages: Salvando etapa fixa com ID:", uniqueId, "título:", stageData.title);
        const stageRef = doc(db, STAGES_COLLECTION, uniqueId);
        return setDoc(stageRef, { ...stageData, originalId: id });
      }

      console.log("saveStages: Adicionando etapa:", stageData.title, "workspaceId:", workspaceId, "userId:", userId);
      return addDoc(collection(db, STAGES_COLLECTION), stageData);
    });

    await Promise.all(promises);
    console.log("saveStages: Todas as etapas foram salvas com sucesso");
  } catch (error) {
    console.error("Error saving stages:", error);
    throw error;
  }
};

// Stage Tasks
export const getStageTasks = async (stageId: string, categoryId?: string): Promise<StageTask[]> => {
  try {
    if (!db) {
      console.warn("Firebase não está inicializado");
      return [];
    }
    // Remover orderBy para evitar necessidade de índice composto
    // Ordenar no cliente
    const conditions: any[] = [where("stageId", "==", stageId)];

    // Se categoryId for fornecido, filtrar por ele
    // Se não, buscar tarefas sem categoryId (padrão global antigo ou quando não especificado)
    // Para simplificar, vamos assumir que categoryId é opcional.
    // Mas o Firestore não suporta "where field is null" diretamente de forma simples misturado.
    // Melhor estratégia: Se categoryId fornecido, busca exato.
    // Se não fornecido, busca onde o campo não existe ou é null? 
    // Por enquanto, vamos suportar apenas a busca EXATA se o parametro for passado.
    // Se categoryId for 'all' ou undefined, talvez devêssemos buscar as "padrão".

    // Se categoryId for fornecido, filtrar por ele
    // Se não, buscar tarefas sem categoryId (padrão global antigo ou quando não especificado)

    if (categoryId && categoryId !== 'all') {
      conditions.push(where("categoryId", "==", categoryId));
    } else if (categoryId === 'all') {
      // Se for explicitamente 'all', pode ser que queira filtrar
      conditions.push(where("categoryId", "==", "all"));
    } else {
      // Se não passado (undefined), por compatibilidade não filtramos?
      // Ou filtramos para onde categoryId não existe?
      // Vamos manter a lógica anterior: se não passar, busca tudo (para compatibilidade)
    }
    const q = query(collection(db, STAGE_TASKS_COLLECTION), ...conditions);
    const querySnapshot = await getDocs(q);
    const tasks = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
    })) as StageTask[];

    // Ordenar no cliente por ordem
    return tasks.sort((a, b) => (a.order || 0) - (b.order || 0));
  } catch (error) {
    console.error("Error getting stage tasks:", error);
    return [];
  }
};

export const subscribeToStageTasks = (stageId: string, callback: (tasks: StageTask[]) => void, categoryId?: string) => {
  if (!db) {
    console.warn("Firebase não está inicializado");
    return () => { };
  }

  // Remover orderBy para evitar necessidade de índice composto
  // Ordenar no cliente
  const conditions: any[] = [where("stageId", "==", stageId)];
  if (categoryId && categoryId !== 'all') {
    conditions.push(where("categoryId", "==", categoryId));
  } else if (categoryId === 'all') {
    conditions.push(where("categoryId", "==", "all"));
  }

  const q = query(collection(db, STAGE_TASKS_COLLECTION), ...conditions);

  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt
    })) as StageTask[];

    // Ordenar no cliente por ordem
    const sortedTasks = tasks.sort((a, b) => (a.order || 0) - (b.order || 0));
    callback(sortedTasks);
  }, (error) => {
    console.error("Error in stage tasks subscription:", error);
  });
};

export const addStageTask = async (task: Omit<StageTask, "id">): Promise<string> => {
  try {
    if (!db) {
      throw new Error("Firebase não está inicializado");
    }
    const docRef = await addDoc(collection(db, STAGE_TASKS_COLLECTION), {
      ...task,
      createdAt: new Date()
    });
    return docRef.id;
  } catch (error) {
    console.error("Error adding stage task:", error);
    throw error;
  }
};

export const updateStageTask = async (taskId: string, updates: Partial<StageTask>): Promise<void> => {
  try {
    if (!db) {
      throw new Error("Firebase não está inicializado");
    }
    await updateDoc(doc(db, STAGE_TASKS_COLLECTION, taskId), updates);
  } catch (error) {
    console.error("Error updating stage task:", error);
    throw error;
  }
};

export const deleteStageTask = async (taskId: string): Promise<void> => {
  try {
    if (!db) {
      throw new Error("Firebase não está inicializado");
    }
    await deleteDoc(doc(db, STAGE_TASKS_COLLECTION, taskId));
  } catch (error) {
    console.error("Error deleting stage task:", error);
    throw error;
  }
};

export const saveStageTasks = async (stageId: string, tasks: Omit<StageTask, "id" | "createdAt">[], categoryId: string = 'all'): Promise<void> => {
  try {
    if (!db) {
      throw new Error("Firebase não está inicializado");
    }

    // Buscar tarefas existentes
    // Buscar tarefas existentes com o mesmo categoryId
    const existingTasks = await getStageTasks(stageId, categoryId);

    // Deletar tarefas que não estão mais na lista
    const tasksToKeep = tasks.map(t => t.title);
    const tasksToDelete = existingTasks.filter(t => !tasksToKeep.includes(t.title));

    await Promise.all(tasksToDelete.map(t => deleteStageTask(t.id)));

    // Adicionar ou atualizar tarefas
    const promises = tasks.map(async (task, index) => {
      const existing = existingTasks.find(t => t.title === task.title);
      if (existing) {
        await updateStageTask(existing.id, { order: index });
      } else {
        await addStageTask({ ...task, stageId, order: index, createdAt: new Date(), categoryId });
      }
    });

    await Promise.all(promises);
  } catch (error) {
    console.error("Error saving stage tasks:", error);
    throw error;
  }
};

// Project Stage Tasks (checklist de tarefas por projeto)
export const getProjectStageTasks = async (projectId: string): Promise<ProjectStageTask[]> => {
  try {
    if (!db) {
      console.warn("Firebase não está inicializado");
      return [];
    }
    const q = query(
      collection(db, PROJECT_STAGE_TASKS_COLLECTION),
      where("projectId", "==", projectId)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      completedAt: doc.data().completedAt?.toDate?.() || doc.data().completedAt
    })) as ProjectStageTask[];
  } catch (error) {
    console.error("Error getting project stage tasks:", error);
    return [];
  }
};

export const subscribeToProjectStageTasks = (projectId: string, callback: (tasks: ProjectStageTask[]) => void) => {
  if (!db) {
    console.warn("Firebase não está inicializado");
    return () => { };
  }

  const q = query(
    collection(db, PROJECT_STAGE_TASKS_COLLECTION),
    where("projectId", "==", projectId)
  );

  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      completedAt: doc.data().completedAt?.toDate?.() || doc.data().completedAt
    })) as ProjectStageTask[];
    callback(tasks);
  }, (error) => {
    console.error("Error in project stage tasks subscription:", error);
  });
};

export const toggleProjectStageTask = async (projectId: string, stageTaskId: string, stageId: string, completed: boolean): Promise<void> => {
  try {
    if (!db) {
      throw new Error("Firebase não está inicializado");
    }

    // Verificar se já existe
    const q = query(
      collection(db, PROJECT_STAGE_TASKS_COLLECTION),
      where("projectId", "==", projectId),
      where("stageTaskId", "==", stageTaskId)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      // Criar novo
      await addDoc(collection(db, PROJECT_STAGE_TASKS_COLLECTION), {
        projectId,
        stageTaskId,
        stageId,
        completed,
        completedAt: completed ? new Date() : null,
        createdAt: new Date()
      });
    } else {
      // Atualizar existente
      const docRef = snapshot.docs[0];
      await updateDoc(docRef.ref, {
        completed,
        completedAt: completed ? new Date() : null
      });
    }
  } catch (error) {
    console.error("Error toggling project stage task:", error);
    throw error;
  }
};

export const initializeProjectStageTasks = async (projectId: string, stageId: string, categoryId?: string): Promise<void> => {
  try {
    if (!db) {
      throw new Error("Firebase não está inicializado");
    }

    // Buscar tarefas da etapa
    // Buscar tarefas da etapa para essa categoria (ou geral se não tiver)
    // Tenta buscar específicas primeiro
    let stageTasks: StageTask[] = [];

    if (categoryId) {
      stageTasks = await getStageTasks(stageId, categoryId);
    }

    // Se não achar específicas (ou se categoria não foi passada), busca as globais ('all')
    if (stageTasks.length === 0) {
      const globalTasks = await getStageTasks(stageId, 'all');
      // Se ainda não achar, tenta buscar sem filtro (legado)
      if (globalTasks.length === 0) {
        const allTasks = await getStageTasks(stageId);
        // Filtrar as que não tem categoryId (legado)
        stageTasks = allTasks.filter(t => !t.categoryId);
      } else {
        stageTasks = globalTasks;
      }
    }

    if (stageTasks.length === 0 && categoryId) {
      // Fallback: se não tem tasks específicas nem globais 'all', tenta as legadas
      const allTasks = await getStageTasks(stageId);
      stageTasks = allTasks.filter(t => !t.categoryId || t.categoryId === 'all');
    }

    // Criar tarefas do projeto para cada tarefa da etapa
    const promises = stageTasks.map(async (stageTask) => {
      const q = query(
        collection(db, PROJECT_STAGE_TASKS_COLLECTION),
        where("projectId", "==", projectId),
        where("stageTaskId", "==", stageTask.id)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        await addDoc(collection(db, PROJECT_STAGE_TASKS_COLLECTION), {
          projectId,
          stageTaskId: stageTask.id,
          stageId,
          title: stageTask.title, // Copiar título do template
          order: stageTask.order, // Copiar ordem do template
          completed: false,
          createdAt: new Date()
        });
      }
    });

    await Promise.all(promises);
  } catch (error) {
    console.error("Error initializing project stage tasks:", error);
    throw error;
  }
};

// Adicionar tarefa manualmente a um projeto
export const addProjectTask = async (
  projectId: string,
  stageId: string,
  title: string,
  order: number
): Promise<string> => {
  try {
    if (!db) {
      throw new Error("Firebase não está inicializado");
    }

    const docRef = await addDoc(collection(db, PROJECT_STAGE_TASKS_COLLECTION), {
      projectId,
      stageTaskId: '', // Vazio para tarefas manuais
      stageId,
      title,
      order,
      completed: false,
      createdAt: new Date()
    });

    return docRef.id;
  } catch (error) {
    console.error("Error adding project task:", error);
    throw error;
  }
};

// Remover tarefa de um projeto
export const removeProjectTask = async (taskId: string): Promise<void> => {
  try {
    if (!db) {
      throw new Error("Firebase não está inicializado");
    }

    await deleteDoc(doc(db, PROJECT_STAGE_TASKS_COLLECTION, taskId));
  } catch (error) {
    console.error("Error removing project task:", error);
    throw error;
  }
};

// Atualizar tarefa de um projeto
export const updateProjectTask = async (taskId: string, updates: Partial<ProjectStageTask> | { completed: boolean }): Promise<void> => {
  try {
    if (!db) {
      throw new Error("Firebase não está inicializado");
    }

    const dataToUpdate: any = { ...updates };
    if (updates.hasOwnProperty('completed')) {
      dataToUpdate.completedAt = updates.completed ? new Date() : null;
    }

    await updateDoc(doc(db, PROJECT_STAGE_TASKS_COLLECTION, taskId), dataToUpdate);
  } catch (error) {
    console.error("Error updating project task:", error);
    throw error;
  }
};

// Atualizar ordem das tarefas de um projeto
export const updateProjectTasksOrder = async (
  tasks: Array<{ id: string; order: number }>
): Promise<void> => {
  try {
    if (!db) {
      throw new Error("Firebase não está inicializado");
    }

    const promises = tasks.map(task =>
      updateDoc(doc(db, PROJECT_STAGE_TASKS_COLLECTION, task.id), { order: task.order })
    );

    await Promise.all(promises);
  } catch (error) {
    console.error("Error updating project tasks order:", error);
    throw error;
  }
};

// Redefinir tarefas de uma etapa para o padrão do template
export const resetProjectStageTasks = async (
  projectId: string,
  stageId: string,
  categoryId?: string
): Promise<void> => {
  try {
    if (!db) {
      throw new Error("Firebase não está inicializado");
    }

    console.log('resetProjectStageTasks called with:', { projectId, stageId, categoryId });

    // Mapeamento de stageId fixo para títulos (usado em fixedStages)
    const fixedStageMap: { [key: string]: string } = {
      'onboarding': 'On boarding',
      'development': 'Em Desenvolvimento',
      'review': 'Em Revisão',
      'adjustments': 'Ajustes',
      'completed': 'Concluído',
      'adjustments-recurring': 'Ajustes',
      'maintenance-recurring': 'Manutenção',
      'finished-recurring': 'Finalizado'
    };

    // 1. Buscar todos os stages do Firestore para encontrar o ID correto
    let firestoreStageIds: string[] = [stageId]; // Começar com o stageId passado

    const stagesSnapshot = await getDocs(collection(db, STAGES_COLLECTION));
    const firestoreStages = stagesSnapshot.docs.map(doc => ({
      id: doc.id,
      title: doc.data().title as string
    }));

    console.log('Firestore stages found:', firestoreStages.map(s => ({ id: s.id, title: s.title })));

    // Se o stageId for um ID fixo, encontrar o stage correspondente no Firestore pelo título
    const fixedTitle = fixedStageMap[stageId];
    if (fixedTitle) {
      const matchingStage = firestoreStages.find(s => s.title === fixedTitle);
      if (matchingStage) {
        console.log(`Found matching Firestore stage for "${fixedTitle}":`, matchingStage.id);
        firestoreStageIds.push(matchingStage.id);
      }
    }

    // Também verificar se algum stage tem o mesmo ID (caso seja ID Firestore)
    const directMatch = firestoreStages.find(s => s.id === stageId);
    if (directMatch) {
      console.log('Direct ID match found:', directMatch.id);
    }

    // 2. DEBUG: Buscar TODAS as stageTasks para ver que stageIds existem
    const allStageTasksSnapshot = await getDocs(collection(db, STAGE_TASKS_COLLECTION));
    const allStageTasks = allStageTasksSnapshot.docs.map(doc => ({
      id: doc.id,
      stageId: doc.data().stageId as string,
      title: doc.data().title as string,
      categoryId: doc.data().categoryId as string | undefined,
      order: doc.data().order as number | undefined
    }));
    console.log('DEBUG - All stageTasks in database:', allStageTasks.map(t => ({ stageId: t.stageId, title: t.title, categoryId: t.categoryId, order: t.order })));

    // Extrair stageIds únicos das tasks
    const uniqueStageIdsInTasks = [...new Set(allStageTasks.map(t => t.stageId))];
    console.log('DEBUG - Unique stageIds in stageTasks:', uniqueStageIdsInTasks);

    // Tentar extrair base do stageId composto (ex: "onboarding-pFiTgBJXn1owxfpppJ04" -> tentar "onboarding")
    const baseStageId = stageId.split('-')[0]; // Ex: "onboarding"
    console.log('DEBUG - Base stageId extracted:', baseStageId);

    // Adicionar stageIds que podem corresponder ao encontrado nas tasks
    const matchingStageIdsInTasks = uniqueStageIdsInTasks.filter(taskStageId => {
      const taskBaseId = taskStageId.split('-')[0];
      return taskBaseId === baseStageId || taskStageId === stageId;
    });
    console.log('DEBUG - Matching stageIds found in tasks:', matchingStageIdsInTasks);

    // Adicionar os stageIds encontrados na busca
    for (const matchId of matchingStageIdsInTasks) {
      if (!firestoreStageIds.includes(matchId)) {
        firestoreStageIds.push(matchId);
      }
    }

    console.log('All stageIds to try:', firestoreStageIds);

    // 3. USAR OS DADOS JÁ BUSCADOS - filtrar por stageId diretamente
    // Primeiro tentar encontrar tasks específicas da categoria
    let matchedTasks = allStageTasks.filter(t =>
      firestoreStageIds.includes(t.stageId) && t.categoryId === categoryId
    );
    console.log('Found category-specific tasks from allStageTasks:', matchedTasks.length);

    // Se não encontrou específicas, buscar globais ('all')
    if (matchedTasks.length === 0) {
      matchedTasks = allStageTasks.filter(t =>
        firestoreStageIds.includes(t.stageId) && t.categoryId === 'all'
      );
      console.log('Found global (all) tasks from allStageTasks:', matchedTasks.length);
    }

    // Se ainda não encontrou, buscar qualquer task do stageId (legado - sem categoryId ou com qualquer categoryId)
    if (matchedTasks.length === 0) {
      matchedTasks = allStageTasks.filter(t =>
        firestoreStageIds.includes(t.stageId)
      );
      console.log('Found ANY tasks for stageId from allStageTasks:', matchedTasks.length);
    }

    // Ordenar pelo campo order antes de converter
    matchedTasks.sort((a, b) => (a.order || 0) - (b.order || 0));

    // Converter para StageTask format
    const stageTasks: StageTask[] = matchedTasks.map((t, index) => ({
      id: t.id,
      stageId: t.stageId,
      title: t.title,
      order: t.order ?? index, // Usar order do Firestore ou fallback para index
      categoryId: t.categoryId,
      createdAt: new Date()
    }));

    // Se não encontrou nenhum template, lançar erro ao invés de apagar tudo
    if (stageTasks.length === 0) {
      console.warn('No template tasks found for stage:', stageId, 'tried:', firestoreStageIds);
      throw new Error('Nenhum template de tarefas encontrado para esta etapa. Configure as tarefas em Configurações > Etapas e Tarefas.');
    }

    console.log('Will create tasks:', stageTasks.map(t => t.title));

    // 3. AGORA podemos remover as tarefas atuais dessa etapa no projeto
    const currentTasksQuery = query(
      collection(db, PROJECT_STAGE_TASKS_COLLECTION),
      where("projectId", "==", projectId),
      where("stageId", "==", stageId)
    );
    const currentTasksSnapshot = await getDocs(currentTasksQuery);
    console.log('Deleting existing tasks:', currentTasksSnapshot.docs.length);

    const deletePromises = currentTasksSnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);

    // 4. Criar novas tarefas do projeto baseadas no template
    const createPromises = stageTasks.map(stageTask =>
      addDoc(collection(db, PROJECT_STAGE_TASKS_COLLECTION), {
        projectId,
        stageTaskId: stageTask.id,
        stageId,
        title: stageTask.title,
        order: stageTask.order,
        completed: false,
        createdAt: new Date()
      })
    );

    await Promise.all(createPromises);
    console.log('Successfully created', stageTasks.length, 'tasks');
  } catch (error) {
    console.error("Error resetting project stage tasks:", error);
    throw error;
  }
};

// Project Files
const getFileType = (fileName: string, mimeType: string): 'image' | 'document' | 'video' | 'other' => {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
  const videoExtensions = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'];
  const documentExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'];

  if (mimeType.startsWith('image/') || imageExtensions.includes(extension)) {
    return 'image';
  }
  if (mimeType.startsWith('video/') || videoExtensions.includes(extension)) {
    return 'video';
  }
  if (documentExtensions.includes(extension)) {
    return 'document';
  }
  return 'other';
};

export const uploadProjectFile = async (
  projectId: string,
  file: File,
  uploadedBy?: string,
  userId?: string | null
): Promise<string> => {
  try {
    if (!storage) {
      throw new Error("Firebase Storage não está inicializado");
    }

    // Criar referência no Storage com isolamento por usuário
    const path = userId
      ? `users/${userId}/projects/${projectId}/${Date.now()}_${file.name}`
      : `projects/${projectId}/${Date.now()}_${file.name}`;
    const fileRef = ref(storage, path);

    // Fazer upload do arquivo
    const snapshot = await uploadBytes(fileRef, file);

    // Obter URL de download
    const downloadURL = await getDownloadURL(snapshot.ref);

    // Salvar metadados no Firestore
    const fileData = {
      projectId,
      name: file.name,
      url: downloadURL,
      type: getFileType(file.name, file.type),
      size: file.size,
      uploadedBy: uploadedBy || 'Usuário',
      uploadedAt: new Date()
    };

    const docRef = await addDoc(collection(db, PROJECT_FILES_COLLECTION), fileData);
    return docRef.id;
  } catch (error) {
    console.error("Error uploading file:", error);
    throw error;
  }
};

export const getProjectFiles = async (projectId: string): Promise<ProjectFile[]> => {
  try {
    if (!db) {
      console.warn("Firebase não está inicializado");
      return [];
    }
    // Remover orderBy para evitar necessidade de índice composto
    // Ordenar no cliente
    const q = query(
      collection(db, PROJECT_FILES_COLLECTION),
      where("projectId", "==", projectId)
    );
    const querySnapshot = await getDocs(q);
    const files = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      uploadedAt: doc.data().uploadedAt?.toDate?.() || doc.data().uploadedAt
    })) as ProjectFile[];

    // Ordenar no cliente por data de upload (mais recente primeiro)
    return files.sort((a, b) => {
      const dateA = a.uploadedAt?.toDate ? a.uploadedAt.toDate() : new Date(a.uploadedAt);
      const dateB = b.uploadedAt?.toDate ? b.uploadedAt.toDate() : new Date(b.uploadedAt);
      return dateB.getTime() - dateA.getTime();
    });
  } catch (error) {
    console.error("Error getting project files:", error);
    return [];
  }
};

export const subscribeToProjectFiles = (projectId: string, callback: (files: ProjectFile[]) => void) => {
  if (!db) {
    console.warn("Firebase não está inicializado");
    return () => { };
  }

  // Remover orderBy para evitar necessidade de índice composto
  const q = query(
    collection(db, PROJECT_FILES_COLLECTION),
    where("projectId", "==", projectId)
  );

  return onSnapshot(q, (snapshot) => {
    const files = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      uploadedAt: doc.data().uploadedAt?.toDate?.() || doc.data().uploadedAt
    })) as ProjectFile[];

    // Ordenar no cliente por data de upload (mais recente primeiro)
    const sortedFiles = files.sort((a, b) => {
      const dateA = a.uploadedAt?.toDate ? a.uploadedAt.toDate() : new Date(a.uploadedAt);
      const dateB = b.uploadedAt?.toDate ? b.uploadedAt.toDate() : new Date(b.uploadedAt);
      return dateB.getTime() - dateA.getTime();
    });

    callback(sortedFiles);
  }, (error) => {
    console.error("Error in project files subscription:", error);
  });
};

export const deleteProjectFile = async (fileId: string, fileUrl: string): Promise<void> => {
  try {
    if (!storage || !db) {
      throw new Error("Firebase não está inicializado");
    }

    // Deletar do Storage
    // Extrair o caminho do arquivo da URL do Firebase Storage
    try {
      const urlObj = new URL(fileUrl);
      const pathMatch = urlObj.pathname.match(/\/o\/(.+)\?/);
      if (pathMatch) {
        const filePath = decodeURIComponent(pathMatch[1]);
        const fileRef = ref(storage, filePath);
        await deleteObject(fileRef);
      }
    } catch (error: any) {
      // Se o arquivo não existir no Storage, continua e deleta do Firestore
      if (error.code !== 'storage/object-not-found') {
        console.warn("Error deleting file from storage:", error);
      }
    }

    // Deletar do Firestore
    await deleteDoc(doc(db, PROJECT_FILES_COLLECTION, fileId));
  } catch (error) {
    console.error("Error deleting file:", error);
    throw error;
  }
};

// Adicionar um link ao projeto
export const addProjectLink = async (
  projectId: string,
  url: string,
  title?: string,
  uploadedBy?: string
): Promise<string> => {
  try {
    if (!db) {
      throw new Error("Firebase não está inicializado");
    }

    // Extrair nome do link da URL se não houver título
    let linkName = title || url;
    try {
      const urlObj = new URL(url);
      linkName = title || urlObj.hostname;
    } catch {
      // Se não for uma URL válida, usa a URL como nome
    }

    const linkData = {
      projectId,
      name: linkName,
      title: title || '',
      url: url.startsWith('http') ? url : `https://${url}`,
      type: 'link' as const,
      size: 0,
      isLink: true,
      uploadedBy: uploadedBy || 'Usuário',
      uploadedAt: new Date()
    };

    const docRef = await addDoc(collection(db, PROJECT_FILES_COLLECTION), linkData);
    return docRef.id;
  } catch (error) {
    console.error("Error adding project link:", error);
    throw error;
  }
};

// Atualizar título de um arquivo ou link
export const updateProjectFile = async (
  fileId: string,
  updates: { title?: string; name?: string }
): Promise<void> => {
  try {
    if (!db) {
      throw new Error("Firebase não está inicializado");
    }

    await updateDoc(doc(db, PROJECT_FILES_COLLECTION, fileId), updates);
  } catch (error) {
    console.error("Error updating project file:", error);
    throw error;
  }
};

// Upload project avatar
export const uploadProjectAvatar = async (projectId: string, file: File): Promise<string> => {
  try {
    if (!storage) {
      throw new Error("Firebase Storage não está inicializado");
    }

    // Criar referência no Storage
    const fileRef = ref(storage, `projects/${projectId}/avatar/${Date.now()}_${file.name}`);

    // Fazer upload do arquivo
    const snapshot = await uploadBytes(fileRef, file);

    // Obter URL de download
    const downloadURL = await getDownloadURL(snapshot.ref);

    return downloadURL;
  } catch (error) {
    console.error("Error uploading project avatar:", error);
    throw error;
  }
};

// Upload client avatar
export const uploadClientAvatar = async (clientId: string, file: File): Promise<string> => {
  try {
    if (!storage) {
      throw new Error("Firebase Storage não está inicializado");
    }

    // Criar referência no Storage
    const fileRef = ref(storage, `clients/${clientId}/avatar/${Date.now()}_${file.name}`);

    // Fazer upload do arquivo
    const snapshot = await uploadBytes(fileRef, file);

    // Obter URL de download
    const downloadURL = await getDownloadURL(snapshot.ref);

    return downloadURL;
  } catch (error) {
    console.error("Error uploading client avatar:", error);
    throw error;
  }
};

export const uploadProjectImage = async (projectId: string, file: File, userId?: string | null): Promise<string> => {
  try {
    if (!storage) {
      throw new Error("Firebase Storage não está inicializado");
    }

    // Criar referência no Storage para a imagem do projeto com isolamento por usuário
    const path = userId
      ? `users/${userId}/projects/${projectId}/project-image/${Date.now()}_${file.name}`
      : `projects/${projectId}/project-image/${Date.now()}_${file.name}`;
    const fileRef = ref(storage, path);

    // Fazer upload do arquivo
    const snapshot = await uploadBytes(fileRef, file);

    // Obter URL de download
    const downloadURL = await getDownloadURL(snapshot.ref);

    return downloadURL;
  } catch (error) {
    console.error("Error uploading project image:", error);
    throw error;
  }
};

// Workspaces
export const getWorkspaces = async (): Promise<Workspace[]> => {
  try {
    if (!db) {
      console.warn("Firebase não está inicializado");
      return [];
    }
    const q = query(collection(db, WORKSPACES_COLLECTION));
    const querySnapshot = await getDocs(q);
    const workspaces = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt
    })) as Workspace[];

    // Ordenar no cliente por data de criação (mais recente primeiro)
    workspaces.sort((a, b) => {
      const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt || 0).getTime();
      const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    return workspaces;
  } catch (error) {
    console.error("Error getting workspaces:", error);
    console.error("Error details:", error);
    return [];
  }
};

export const subscribeToWorkspaces = (callback: (workspaces: Workspace[]) => void, userId?: string | null, userEmail?: string | null) => {
  if (!db) {
    console.warn("Firebase não está inicializado");
    return () => { };
  }

  try {
    let q;
    if (userId) {
      if (userEmail) {
        // Se tiver email, buscar workspaces onde é dono OU membro
        q = query(
          collection(db, WORKSPACES_COLLECTION),
          or(
            where("userId", "==", userId),
            where("memberEmails", "array-contains", userEmail)
          )
        );
      } else {
        // Se não tiver email, buscar apenas onde é dono
        q = query(
          collection(db, WORKSPACES_COLLECTION),
          where("userId", "==", userId)
        );
      }
    } else {
      q = query(collection(db, WORKSPACES_COLLECTION));
    }

    return onSnapshot(q,
      (querySnapshot) => {
        const workspaces = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
          updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt
        })) as Workspace[];

        // Ordenar no cliente por data de criação (mais recente primeiro)
        workspaces.sort((a, b) => {
          const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt || 0).getTime();
          const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt || 0).getTime();
          return dateB - dateA;
        });

        callback(workspaces);
      },
      (error) => {
        console.error("Error in workspaces subscription:", error);

        // Se for erro de permissão ou índice (comum com 'or'), tentar fallback
        if (error?.code === 'failed-precondition' || error?.message?.includes('index')) {
          console.warn("⚠️ Query complexa falhou (possivelmente falta de índice). Tentando query simples por userId.");
          // Fallback: buscar apenas pelo ID do usuário
          const qSimple = query(collection(db, WORKSPACES_COLLECTION), where("userId", "==", userId));
          return onSnapshot(qSimple, (snap) => {
            const simpleWorkspaces = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
            callback(simpleWorkspaces);
          });
        }

        // Retornar array vazio em caso de erro para não quebrar a UI
        callback([]);
      }
    );
  } catch (error: any) {
    console.error("Error setting up workspaces subscription:", error);
    return () => { };
  }
};

// Serviços padrão para novos workspaces
const DEFAULT_CATEGORIES = [
  { name: 'Sob Demanda', isRecurring: false },
  { name: 'Recorrência', isRecurring: true }
];

export const addWorkspace = async (workspace: { name: string } & Partial<Workspace>, userId?: string | null): Promise<string> => {
  try {
    if (!db) {
      console.error("Firebase não está inicializado - db é", db);
      throw new Error("Firebase não está inicializado");
    }

    if (!workspace.name || !workspace.name.trim()) {
      throw new Error("Nome do workspace é obrigatório");
    }

    const workspaceData: any = {
      name: workspace.name.trim(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Adicionar userId se fornecido
    if (userId) {
      workspaceData.userId = userId;
    }

    console.log("Adicionando workspace:", workspaceData);
    const docRef = await addDoc(collection(db, WORKSPACES_COLLECTION), workspaceData);
    const workspaceId = docRef.id;
    console.log("Workspace adicionado com ID:", workspaceId);

    // Criar serviços padrão para o novo workspace
    try {
      console.log("Criando serviços padrão para o workspace:", workspaceId);
      const defaultCategoriesPromises = DEFAULT_CATEGORIES.map(category =>
        addCategory(category.name, workspaceId, category.isRecurring, workspace.userId)
      );
      await Promise.all(defaultCategoriesPromises);
      console.log("✅ Serviços padrão criados com sucesso:", DEFAULT_CATEGORIES.map(c => c.name));
    } catch (error) {
      console.error("⚠️ Erro ao criar serviços padrão (workspace já foi criado):", error);
      // Não lançar erro aqui - o workspace já foi criado, apenas logar o erro
    }

    return workspaceId;
  } catch (error: any) {
    console.error("Error adding workspace:", error);
    console.error("Error code:", error?.code);
    console.error("Error message:", error?.message);
    console.error("Error stack:", error?.stack);
    throw error;
  }
};

export const updateWorkspace = async (workspaceId: string, updates: Partial<Workspace>): Promise<void> => {
  try {
    if (!db) {
      throw new Error("Firebase não está inicializado");
    }
    const workspaceRef = doc(db, WORKSPACES_COLLECTION, workspaceId);
    await updateDoc(workspaceRef, {
      ...updates,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error("Error updating workspace:", error);
    throw error;
  }
};

export const uploadWorkspaceAvatar = async (workspaceId: string, file: File, userId?: string | null): Promise<string> => {
  try {
    if (!storage) {
      throw new Error("Firebase Storage não está inicializado");
    }

    // Criar referência no Storage para o avatar do workspace com isolamento por usuário
    const path = userId
      ? `users/${userId}/workspaces/${workspaceId}/avatar/${Date.now()}_${file.name}`
      : `workspaces/${workspaceId}/avatar/${Date.now()}_${file.name}`;
    const fileRef = ref(storage, path);

    // Fazer upload do arquivo
    const snapshot = await uploadBytes(fileRef, file);

    // Obter URL de download
    const downloadURL = await getDownloadURL(snapshot.ref);

    return downloadURL;
  } catch (error) {
    console.error("Error uploading workspace avatar:", error);
    throw error;
  }
};

export const deleteWorkspace = async (workspaceId: string): Promise<void> => {
  try {
    if (!db) {
      throw new Error("Firebase não está inicializado");
    }
    await deleteDoc(doc(db, WORKSPACES_COLLECTION, workspaceId));
  } catch (error) {
    console.error("Error deleting workspace:", error);
    throw error;
  }
};

// Invoices
export const subscribeToInvoices = (callback: (invoices: Invoice[]) => void, projectId?: string, userId?: string | null) => {
  if (!db) {
    console.warn("Firebase não está inicializado");
    return () => { };
  }

  // Filtrar por projectId e userId
  const conditions: any[] = [];

  if (projectId) {
    conditions.push(where("projectId", "==", projectId));
  }

  if (userId) {
    conditions.push(where("userId", "==", userId));
  }

  const q = conditions.length > 0
    ? query(collection(db, INVOICES_COLLECTION), ...conditions)
    : query(collection(db, INVOICES_COLLECTION));

  return onSnapshot(q, (querySnapshot) => {
    const invoices = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      date: doc.data().date?.toDate?.() || doc.data().date,
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt
    })) as Invoice[];

    console.log(`📋 [subscribeToInvoices] Carregadas ${invoices.length} faturas para projectId: ${projectId}`);

    // Ordenar no cliente por data (mais recente primeiro)
    invoices.sort((a, b) => {
      const dateA = a.date instanceof Date ? a.date : new Date(a.date);
      const dateB = b.date instanceof Date ? b.date : new Date(b.date);
      return dateB.getTime() - dateA.getTime();
    });

    callback(invoices);
  }, (error) => {
    console.error("❌ [subscribeToInvoices] Erro ao buscar faturas:", error);
    // Retornar lista vazia em caso de erro
    callback([]);
  });
};

export const addInvoice = async (invoice: Omit<Invoice, "id">, userId?: string | null): Promise<string> => {
  try {
    if (!db) {
      throw new Error("Firebase não está inicializado");
    }

    console.log(`💰 [addInvoice] Criando fatura:`, {
      projectId: invoice.projectId,
      description: invoice.description,
      amount: invoice.amount,
      number: invoice.number,
      userId
    });

    const invoiceData: any = {
      ...invoice,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Adicionar userId se fornecido
    if (userId) {
      invoiceData.userId = userId;
    }

    // Remover campos undefined
    Object.keys(invoiceData).forEach(key => {
      if (invoiceData[key as keyof typeof invoiceData] === undefined) {
        delete invoiceData[key as keyof typeof invoiceData];
      }
    });

    const docRef = await addDoc(collection(db, INVOICES_COLLECTION), invoiceData);

    console.log(`✅ [addInvoice] Fatura criada com sucesso! ID: ${docRef.id}`);

    // Atualizar o budget do projeto (somar apenas faturas de implementação, não de mensalidade)
    const invoicesSnapshot = await getDocs(
      query(collection(db, INVOICES_COLLECTION), where("projectId", "==", invoice.projectId))
    );

    // Somar apenas faturas que NÃO são de mensalidade (REC-*)
    const totalAmount = invoicesSnapshot.docs.reduce((sum, doc) => {
      const invoiceNumber = doc.data().number || '';
      // Não somar faturas de mensalidade (REC-*) ao budget
      if (invoiceNumber.startsWith('REC-')) {
        return sum;
      }
      return sum + (doc.data().amount || 0);
    }, 0);

    const projectRef = doc(db, PROJECTS_COLLECTION, invoice.projectId);
    await updateDoc(projectRef, {
      budget: totalAmount,
      updatedAt: new Date()
    });

    return docRef.id;
  } catch (error) {
    console.error("Error adding invoice:", error);
    throw error;
  }
};

export const updateInvoice = async (invoiceId: string, updates: Partial<Invoice>): Promise<void> => {
  try {
    if (!db) {
      throw new Error("Firebase não está inicializado");
    }

    const invoiceRef = doc(db, INVOICES_COLLECTION, invoiceId);
    const updateData = {
      ...updates,
      updatedAt: new Date()
    };

    // Remover campos undefined
    Object.keys(updateData).forEach(key => {
      if (updateData[key as keyof typeof updateData] === undefined) {
        delete updateData[key as keyof typeof updateData];
      }
    });

    await updateDoc(invoiceRef, updateData);

    // Buscar o projectId para atualizar o budget
    const invoiceDoc = await getDoc(doc(db, INVOICES_COLLECTION, invoiceId));
    if (invoiceDoc.exists()) {
      const projectId = invoiceDoc.data().projectId;

      // Recalcular o budget total (excluindo faturas de mensalidade REC-*)
      const invoicesSnapshot = await getDocs(
        query(collection(db, INVOICES_COLLECTION), where("projectId", "==", projectId))
      );

      // Somar apenas faturas que NÃO são de mensalidade (REC-*)
      const totalAmount = invoicesSnapshot.docs.reduce((sum, doc) => {
        const invoiceNumber = doc.data().number || '';
        // Não somar faturas de mensalidade (REC-*) ao budget
        if (invoiceNumber.startsWith('REC-')) {
          return sum;
        }
        return sum + (doc.data().amount || 0);
      }, 0);

      const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
      await updateDoc(projectRef, {
        budget: totalAmount,
        updatedAt: new Date()
      });
    }
  } catch (error) {
    console.error("Error updating invoice:", error);
    throw error;
  }
};

export const deleteInvoice = async (invoiceId: string): Promise<void> => {
  try {
    if (!db) {
      throw new Error("Firebase não está inicializado");
    }

    // Buscar o projectId antes de deletar
    const invoiceDoc = await getDoc(doc(db, INVOICES_COLLECTION, invoiceId));
    let projectId: string | null = null;

    if (invoiceDoc.exists()) {
      projectId = invoiceDoc.data().projectId;
    }

    await deleteDoc(doc(db, INVOICES_COLLECTION, invoiceId));

    // Recalcular o budget total (excluindo faturas de mensalidade REC-*)
    if (projectId) {
      const invoicesSnapshot = await getDocs(
        query(collection(db, INVOICES_COLLECTION), where("projectId", "==", projectId))
      );

      // Somar apenas faturas que NÃO são de mensalidade (REC-*)
      const totalAmount = invoicesSnapshot.docs.reduce((sum, doc) => {
        const invoiceNumber = doc.data().number || '';
        // Não somar faturas de mensalidade (REC-*) ao budget
        if (invoiceNumber.startsWith('REC-')) {
          return sum;
        }
        return sum + (doc.data().amount || 0);
      }, 0);

      const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
      await updateDoc(projectRef, {
        budget: totalAmount,
        updatedAt: new Date()
      });
    }
  } catch (error) {
    console.error("Error deleting invoice:", error);
    throw error;
  }
};

// ==================== AUTENTICAÇÃO ====================

const googleProvider = new GoogleAuthProvider();

// Login com Google
export const signInWithGoogle = async (): Promise<User> => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google:", error);
    throw error;
  }
};

// Logout
export const signOut = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error("Error signing out:", error);
    throw error;
  }
};

// Observar mudanças no estado de autenticação
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// Obter usuário atual
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

// Workspace Members Management

// Adicionar membro ao workspace
export const addWorkspaceMember = async (workspaceId: string, memberEmail: string, role: 'admin' | 'member', permissions: WorkspaceMember['permissions']): Promise<void> => {
  try {
    if (!db) throw new Error("Firebase não está inicializado");

    const workspaceRef = doc(db, WORKSPACES_COLLECTION, workspaceId);
    const workspaceSnap = await getDoc(workspaceRef);

    if (!workspaceSnap.exists()) {
      throw new Error("Workspace não encontrado");
    }

    const workspaceData = workspaceSnap.data() as Workspace;
    const currentMembers = workspaceData.members || [];
    const currentMemberEmails = workspaceData.memberEmails || [];

    // Verificar se já existe
    if (currentMembers.some(m => m.email === memberEmail)) {
      throw new Error("Este email já é membro do workspace");
    }

    const newMember: WorkspaceMember = {
      id: crypto.randomUUID(), // Gerar ID único para o membro
      email: memberEmail,
      role,
      permissions,
      addedAt: new Date()
    };

    const updatedMembers = [...currentMembers, newMember];

    // Atualizar lista de emails para facilitar query
    // Garantir que não haja duplicatas
    const updatedMemberEmails = Array.from(new Set([...currentMemberEmails, memberEmail]));

    await updateDoc(workspaceRef, {
      members: updatedMembers,
      memberEmails: updatedMemberEmails,
      updatedAt: new Date()
    });

  } catch (error) {
    console.error("Error adding workspace member:", error);
    throw error;
  }
};

// Atualizar membro do workspace
export const updateWorkspaceMember = async (workspaceId: string, memberEmail: string, updates: Partial<WorkspaceMember>): Promise<void> => {
  try {
    if (!db) throw new Error("Firebase não está inicializado");

    const workspaceRef = doc(db, WORKSPACES_COLLECTION, workspaceId);
    const workspaceSnap = await getDoc(workspaceRef);

    if (!workspaceSnap.exists()) {
      throw new Error("Workspace não encontrado");
    }

    const workspaceData = workspaceSnap.data() as Workspace;
    const currentMembers = workspaceData.members || [];

    const memberIndex = currentMembers.findIndex(m => m.email === memberEmail);
    if (memberIndex === -1) {
      throw new Error("Membro não encontrado");
    }

    const updatedMembers = [...currentMembers];
    updatedMembers[memberIndex] = {
      ...updatedMembers[memberIndex],
      ...updates
    };

    // Se o email mudou (improvável, mas possível), atualizar lista de emails
    let memberEmailsUpdate = {};
    if (updates.email && updates.email !== memberEmail) {
      const currentMemberEmails = workspaceData.memberEmails || [];
      const updatedMemberEmails = currentMemberEmails
        .filter(e => e !== memberEmail)
        .concat(updates.email);
      memberEmailsUpdate = { memberEmails: updatedMemberEmails };
    }

    await updateDoc(workspaceRef, {
      members: updatedMembers,
      ...memberEmailsUpdate,
      updatedAt: new Date()
    });

  } catch (error) {
    console.error("Error updating workspace member:", error);
    throw error;
  }
};

// Remover membro do workspace
export const removeWorkspaceMember = async (workspaceId: string, memberEmail: string): Promise<void> => {
  try {
    if (!db) throw new Error("Firebase não está inicializado");

    const workspaceRef = doc(db, WORKSPACES_COLLECTION, workspaceId);
    const workspaceSnap = await getDoc(workspaceRef);

    if (!workspaceSnap.exists()) {
      throw new Error("Workspace não encontrado");
    }

    const workspaceData = workspaceSnap.data() as Workspace;
    const currentMembers = workspaceData.members || [];
    const currentMemberEmails = workspaceData.memberEmails || [];

    const updatedMembers = currentMembers.filter(m => m.email !== memberEmail);
    const updatedMemberEmails = currentMemberEmails.filter(e => e !== memberEmail);

    await updateDoc(workspaceRef, {
      members: updatedMembers,
      memberEmails: updatedMemberEmails,
      updatedAt: new Date()
    });

  } catch (error) {
    console.error("Error removing workspace member:", error);
    throw error;
  }
};

// ==========================================
// Clients Management (Integração Asaas)
// ==========================================

// Adicionar cliente
export const addClient = async (client: Omit<Client, 'id'>): Promise<string> => {
  try {
    if (!db) throw new Error("Firebase não está inicializado");

    // Remover campos undefined (Firestore não aceita undefined)
    const clientData: any = {
      name: client.name,
      workspaceId: client.workspaceId,
      createdAt: client.createdAt || new Date(),
      updatedAt: new Date()
    };

    // Adicionar campos opcionais apenas se não forem undefined
    if (client.email !== undefined && client.email !== null && client.email !== '') {
      clientData.email = client.email;
    }
    if (client.cpfCnpj !== undefined && client.cpfCnpj !== null && client.cpfCnpj !== '') {
      clientData.cpfCnpj = client.cpfCnpj;
    }
    if (client.phone !== undefined && client.phone !== null && client.phone !== '') {
      clientData.phone = client.phone;
    }
    if (client.mobilePhone !== undefined && client.mobilePhone !== null && client.mobilePhone !== '') {
      clientData.mobilePhone = client.mobilePhone;
    }
    if (client.avatar !== undefined && client.avatar !== null && client.avatar !== '') {
      clientData.avatar = client.avatar;
    }
    if (client.asaasCustomerId !== undefined && client.asaasCustomerId !== null && client.asaasCustomerId !== '') {
      clientData.asaasCustomerId = client.asaasCustomerId;
    }
    if (client.address !== undefined && client.address !== null) {
      const address: any = {};
      if (client.address.street) address.street = client.address.street;
      if (client.address.number) address.number = client.address.number;
      if (client.address.complement) address.complement = client.address.complement;
      if (client.address.neighborhood) address.neighborhood = client.address.neighborhood;
      if (client.address.city) address.city = client.address.city;
      if (client.address.state) address.state = client.address.state;
      if (client.address.postalCode) address.postalCode = client.address.postalCode;
      
      if (Object.keys(address).length > 0) {
        clientData.address = address;
      }
    }

    const docRef = await addDoc(collection(db, CLIENTS_COLLECTION), clientData);
    console.log(`✅ [addClient] Cliente criado com sucesso! ID: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error("Error adding client:", error);
    throw error;
  }
};

// Atualizar cliente
export const updateClient = async (clientId: string, updates: Partial<Client>): Promise<void> => {
  try {
    if (!db) throw new Error("Firebase não está inicializado");

    // Remover campos undefined (Firestore não aceita undefined)
    const updateData: any = {
      updatedAt: new Date()
    };

    // Adicionar apenas campos que não são undefined
    Object.keys(updates).forEach(key => {
      const value = (updates as any)[key];
      if (value !== undefined && value !== null) {
        // Se for objeto (como address), verificar se tem propriedades
        if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
          const objKeys = Object.keys(value);
          if (objKeys.length > 0) {
            updateData[key] = value;
          }
        } else if (value !== '') {
          // Não adicionar strings vazias
          updateData[key] = value;
        }
      }
    });

    const clientRef = doc(db, CLIENTS_COLLECTION, clientId);
    await updateDoc(clientRef, updateData);
    console.log(`✅ [updateClient] Cliente atualizado! ID: ${clientId}`);
  } catch (error) {
    console.error("Error updating client:", error);
    throw error;
  }
};

// Deletar cliente
export const deleteClient = async (clientId: string): Promise<void> => {
  try {
    if (!db) throw new Error("Firebase não está inicializado");

    const clientRef = doc(db, CLIENTS_COLLECTION, clientId);
    await deleteDoc(clientRef);
    console.log(`✅ [deleteClient] Cliente deletado! ID: ${clientId}`);
  } catch (error) {
    console.error("Error deleting client:", error);
    throw error;
  }
};

// Obter cliente por ID
export const getClient = async (clientId: string): Promise<Client | null> => {
  try {
    if (!db) throw new Error("Firebase não está inicializado");

    const clientRef = doc(db, CLIENTS_COLLECTION, clientId);
    const clientSnap = await getDoc(clientRef);

    if (!clientSnap.exists()) {
      return null;
    }

    return {
      id: clientSnap.id,
      ...clientSnap.data()
    } as Client;
  } catch (error) {
    console.error("Error getting client:", error);
    throw error;
  }
};

// Obter cliente por nome (busca aproximada)
export const getClientByName = async (name: string, workspaceId: string): Promise<Client | null> => {
  try {
    if (!db) throw new Error("Firebase não está inicializado");

    const q = query(
      collection(db, CLIENTS_COLLECTION),
      where("workspaceId", "==", workspaceId),
      where("name", "==", name)
    );

    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }

    const docData = querySnapshot.docs[0];
    return {
      id: docData.id,
      ...docData.data()
    } as Client;
  } catch (error) {
    console.error("Error getting client by name:", error);
    throw error;
  }
};

// Obter cliente por CPF/CNPJ
export const getClientByCpfCnpj = async (cpfCnpj: string, workspaceId: string): Promise<Client | null> => {
  try {
    if (!db) throw new Error("Firebase não está inicializado");

    // Remover caracteres não numéricos para busca
    const cleanCpfCnpj = cpfCnpj.replace(/\D/g, '');

    const q = query(
      collection(db, CLIENTS_COLLECTION),
      where("workspaceId", "==", workspaceId),
      where("cpfCnpj", "==", cleanCpfCnpj)
    );

    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }

    const docData = querySnapshot.docs[0];
    return {
      id: docData.id,
      ...docData.data()
    } as Client;
  } catch (error) {
    console.error("Error getting client by CPF/CNPJ:", error);
    throw error;
  }
};

// Listar todos os clientes de um workspace
export const getClients = async (workspaceId: string): Promise<Client[]> => {
  try {
    if (!db) throw new Error("Firebase não está inicializado");

    // Remover orderBy temporariamente enquanto índice está sendo construído
    // A ordenação será feita no cliente
    const q = query(
      collection(db, CLIENTS_COLLECTION),
      where("workspaceId", "==", workspaceId)
    );

    const querySnapshot = await getDocs(q);
    
    const clients = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Client[];
    
    // Ordenar no cliente por nome (enquanto índice está sendo construído)
    clients.sort((a, b) => {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
    
    return clients;
  } catch (error) {
    console.error("Error getting clients:", error);
    return [];
  }
};

// Subscribe para clientes (realtime)
export const subscribeToClients = (callback: (clients: Client[]) => void, workspaceId: string) => {
  if (!db) {
    console.error("Firebase não está inicializado");
    callback([]);
    return () => {};
  }

  // Usar apenas where enquanto o índice composto está sendo construído
  // A ordenação será feita no cliente
  const q = query(
    collection(db, CLIENTS_COLLECTION),
    where("workspaceId", "==", workspaceId)
  );

  return onSnapshot(q, (snapshot) => {
    const clients = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Client[];
    
    // Ordenar no cliente por nome (enquanto índice está sendo construído)
    clients.sort((a, b) => {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
    
    console.log(`📋 [subscribeToClients] Carregados ${clients.length} clientes`);
    callback(clients);
  }, (error) => {
    console.error("Error subscribing to clients:", error);
    // Se o erro for sobre índice ainda sendo construído, tentar novamente sem orderBy
    if (error.code === 'failed-precondition' && error.message?.includes('index')) {
      console.log('⚠️ Índice ainda sendo construído, usando ordenação no cliente');
      // A query já está sem orderBy, então apenas retornar array vazio
      callback([]);
    } else {
      callback([]);
    }
  });
};

// Vincular cliente com Asaas (atualizar asaasCustomerId)
export const linkClientToAsaas = async (clientId: string, asaasCustomerId: string): Promise<void> => {
  try {
    if (!db) throw new Error("Firebase não está inicializado");

    const clientRef = doc(db, CLIENTS_COLLECTION, clientId);
    await updateDoc(clientRef, {
      asaasCustomerId,
      updatedAt: new Date()
    });
    console.log(`✅ [linkClientToAsaas] Cliente ${clientId} vinculado ao Asaas: ${asaasCustomerId}`);
  } catch (error) {
    console.error("Error linking client to Asaas:", error);
    throw error;
  }
};

// Buscar clientes por termo (nome ou email)
export const searchClients = async (searchTerm: string, workspaceId: string): Promise<Client[]> => {
  try {
    if (!db) throw new Error("Firebase não está inicializado");

    // Firebase não suporta busca "like", então buscamos todos e filtramos
    const allClients = await getClients(workspaceId);
    
    const term = searchTerm.toLowerCase();
    return allClients.filter(client => 
      client.name.toLowerCase().includes(term) ||
      client.email.toLowerCase().includes(term) ||
      client.cpfCnpj.includes(term.replace(/\D/g, ''))
    );
  } catch (error) {
    console.error("Error searching clients:", error);
    return [];
  }
};

// Sincronizar clientes antigos dos projetos (migração)
export const syncOldClientsFromProjects = async (workspaceId: string): Promise<{
  clientsCreated: number;
  projectsUpdated: number;
  clients: { name: string; clientId: string; projectCount: number }[];
}> => {
  try {
    if (!db) throw new Error("Firebase não está inicializado");

    console.log('🔄 [syncOldClientsFromProjects] Iniciando sincronização de clientes antigos...');

    // 1. Buscar todos os projetos do workspace que têm `client` mas não têm `clientId`
    const projectsQuery = query(
      collection(db, PROJECTS_COLLECTION),
      where("workspaceId", "==", workspaceId)
    );
    const projectsSnapshot = await getDocs(projectsQuery);
    
    const projectsWithoutClientId: Array<{ id: string; client: string }> = [];
    projectsSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.client && !data.clientId) {
        projectsWithoutClientId.push({
          id: doc.id,
          client: data.client.trim()
        });
      }
    });

    if (projectsWithoutClientId.length === 0) {
      console.log('✅ [syncOldClientsFromProjects] Nenhum projeto antigo encontrado para sincronizar');
      return { clientsCreated: 0, projectsUpdated: 0, clients: [] };
    }

    console.log(`📋 [syncOldClientsFromProjects] Encontrados ${projectsWithoutClientId.length} projetos sem clientId`);

    // 2. Agrupar por nome de cliente (case-insensitive)
    const clientNamesMap = new Map<string, string[]>(); // nome normalizado -> [nomes originais]
    const clientNamesToProjects = new Map<string, string[]>(); // nome normalizado -> [projectIds]
    
    projectsWithoutClientId.forEach(project => {
      const normalizedName = project.client.toLowerCase().trim();
      if (!clientNamesMap.has(normalizedName)) {
        clientNamesMap.set(normalizedName, []);
        clientNamesToProjects.set(normalizedName, []);
      }
      // Guardar o nome original (primeira ocorrência)
      if (!clientNamesMap.get(normalizedName)!.includes(project.client)) {
        clientNamesMap.get(normalizedName)!.push(project.client);
      }
      clientNamesToProjects.get(normalizedName)!.push(project.id);
    });

    console.log(`👥 [syncOldClientsFromProjects] Encontrados ${clientNamesMap.size} clientes únicos para processar`);

    // 3. Para cada cliente único, verificar se já existe na coleção `clients`
    let clientsCreated = 0;
    let projectsUpdated = 0;
    const createdClients: { name: string; clientId: string; projectCount: number }[] = [];

    for (const [normalizedName, originalNames] of clientNamesMap.entries()) {
      const clientName = originalNames[0]; // Usar o primeiro nome original encontrado
      const projectIds = clientNamesToProjects.get(normalizedName)!;

      // Verificar se já existe um cliente com esse nome
      let existingClient = await getClientByName(clientName, workspaceId);

      if (!existingClient) {
        // Criar novo cliente (só com nome, sem email/CPF pois não temos esses dados dos projetos antigos)
        // Não gerar avatar automaticamente - deixar sem foto (aparecerá com bordas tracejadas)
        console.log(`➕ [syncOldClientsFromProjects] Criando cliente: "${clientName}"`);
        const newClientId = await addClient({
          name: clientName,
          workspaceId,
          createdAt: new Date()
        });
        
        existingClient = await getClient(newClientId);
        clientsCreated++;
        
        if (existingClient) {
          createdClients.push({
            name: clientName,
            clientId: existingClient.id,
            projectCount: projectIds.length
          });
        }
      } else {
        console.log(`✓ [syncOldClientsFromProjects] Cliente já existe: "${clientName}"`);
        createdClients.push({
          name: clientName,
          clientId: existingClient.id,
          projectCount: projectIds.length
        });
      }

      // 4. Atualizar todos os projetos desse cliente para incluir o `clientId`
      if (existingClient) {
        const updatePromises = projectIds.map(projectId => 
          updateDoc(doc(db, PROJECTS_COLLECTION, projectId), {
            clientId: existingClient!.id,
            updatedAt: new Date()
          })
        );
        await Promise.all(updatePromises);
        projectsUpdated += projectIds.length;
        console.log(`🔗 [syncOldClientsFromProjects] ${projectIds.length} projetos vinculados ao cliente "${clientName}"`);
      }
    }

    console.log(`✅ [syncOldClientsFromProjects] Sincronização concluída!`);
    console.log(`   - Clientes criados: ${clientsCreated}`);
    console.log(`   - Projetos atualizados: ${projectsUpdated}`);

    return {
      clientsCreated,
      projectsUpdated,
      clients: createdClients
    };
  } catch (error) {
    console.error("Error syncing old clients from projects:", error);
    throw error;
  }
};
