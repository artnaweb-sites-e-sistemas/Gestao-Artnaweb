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
  enableIndexedDbPersistence 
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
import { Project, Activity, TeamMember, StageTask, ProjectStageTask, ProjectFile, Category, Invoice } from "../types";

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
    return () => {};
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
export const updateClientAvatarInAllProjects = async (clientName: string, avatarUrl: string, workspaceId?: string | null, userId?: string | null): Promise<void> => {
  try {
    if (!db) {
      throw new Error("Firebase não está inicializado");
    }

    const conditions: any[] = [where("client", "==", clientName)];
    
    if (workspaceId) {
      conditions.push(where("workspaceId", "==", workspaceId));
    }
    
    if (userId) {
      conditions.push(where("userId", "==", userId));
    }

    const q = query(collection(db, PROJECTS_COLLECTION), ...conditions);
    const querySnapshot = await getDocs(q);

    // Atualizar todos os projetos do mesmo cliente
    const updatePromises = querySnapshot.docs.map(docRef => 
      updateDoc(docRef.ref, { 
        avatar: avatarUrl,
        updatedAt: new Date()
      })
    );

    await Promise.all(updatePromises);
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
    return () => {};
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
    return () => {};
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
export const getStageTasks = async (stageId: string): Promise<StageTask[]> => {
  try {
    if (!db) {
      console.warn("Firebase não está inicializado");
      return [];
    }
    // Remover orderBy para evitar necessidade de índice composto
    // Ordenar no cliente
    const q = query(
      collection(db, STAGE_TASKS_COLLECTION),
      where("stageId", "==", stageId)
    );
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

export const subscribeToStageTasks = (stageId: string, callback: (tasks: StageTask[]) => void) => {
  if (!db) {
    console.warn("Firebase não está inicializado");
    return () => {};
  }
  
  // Remover orderBy para evitar necessidade de índice composto
  // Ordenar no cliente
  const q = query(
    collection(db, STAGE_TASKS_COLLECTION),
    where("stageId", "==", stageId)
  );
  
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

export const saveStageTasks = async (stageId: string, tasks: Omit<StageTask, "id" | "createdAt">[]): Promise<void> => {
  try {
    if (!db) {
      throw new Error("Firebase não está inicializado");
    }
    
    // Buscar tarefas existentes
    const existingTasks = await getStageTasks(stageId);
    
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
        await addStageTask({ ...task, stageId, order: index, createdAt: new Date() });
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
    return () => {};
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

export const initializeProjectStageTasks = async (projectId: string, stageId: string): Promise<void> => {
  try {
    if (!db) {
      throw new Error("Firebase não está inicializado");
    }
    
    // Buscar tarefas da etapa
    const stageTasks = await getStageTasks(stageId);
    
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
    return () => {};
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

export const subscribeToWorkspaces = (callback: (workspaces: Workspace[]) => void, userId?: string | null) => {
  if (!db) {
    console.warn("Firebase não está inicializado");
    return () => {};
  }
  
  try {
    // Filtrar por userId se fornecido
    let q;
    if (userId) {
      q = query(
        collection(db, WORKSPACES_COLLECTION),
        where("userId", "==", userId)
      );
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
        console.error("Error code:", error?.code);
        console.error("Error message:", error?.message);
        
        // Se for erro de permissão, tentar novamente após um delay
        if (error?.code === 'permission-denied') {
          console.warn("⚠️ Erro de permissão detectado. Verifique as regras do Firestore no Firebase Console.");
          console.warn("⚠️ As regras devem permitir leitura/escrita para a coleção 'workspaces'");
        }
        
        // Retornar array vazio em caso de erro para não quebrar a UI
        callback([]);
      }
    );
  } catch (error: any) {
    console.error("Error setting up workspaces subscription:", error);
    return () => {};
  }
};

// Serviços padrão para novos workspaces
const DEFAULT_CATEGORIES = [
  { name: 'Sob Demanda', isRecurring: false },
  { name: 'Recorrência', isRecurring: true }
];

export const addWorkspace = async (workspace: Omit<Workspace, "id">, userId?: string | null): Promise<string> => {
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
    return () => {};
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
