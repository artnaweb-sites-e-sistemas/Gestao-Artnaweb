import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
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
import { db, storage } from "./config";
import { Project, Activity, TeamMember, StageTask, ProjectStageTask, ProjectFile } from "../types";

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

export const subscribeToProjects = (callback: (projects: Project[]) => void) => {
  const q = query(collection(db, PROJECTS_COLLECTION), orderBy("createdAt", "desc"));
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
    callback(projects);
  }, (error) => {
    console.error("Error in projects subscription:", error);
    callback([]);
  });
};

export const addProject = async (project: Omit<Project, "id">): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, PROJECTS_COLLECTION), {
      ...project,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return docRef.id;
  } catch (error) {
    console.error("Error adding project:", error);
    throw error;
  }
};

export const updateProject = async (projectId: string, updates: Partial<Project>): Promise<void> => {
  try {
    const projectRef = doc(db, PROJECTS_COLLECTION, projectId);
    await updateDoc(projectRef, {
      ...updates,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error("Error updating project:", error);
    throw error;
  }
};

export const deleteProject = async (projectId: string): Promise<void> => {
  try {
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

export const subscribeToCategories = (callback: (categories: string[]) => void) => {
  return onSnapshot(collection(db, CATEGORIES_COLLECTION), (querySnapshot) => {
    const categories = querySnapshot.docs.map(doc => doc.data().name);
    callback(categories.length > 0 ? categories : ['Web Design', 'App Dev', 'Identidade Visual']);
  }, (error) => {
    console.error("Error in categories subscription:", error);
    callback(['Web Design', 'App Dev', 'Identidade Visual']);
  });
};

export const addCategory = async (categoryName: string): Promise<void> => {
  try {
    await addDoc(collection(db, CATEGORIES_COLLECTION), {
      name: categoryName,
      createdAt: new Date()
    });
  } catch (error) {
    console.error("Error adding category:", error);
    throw error;
  }
};

export const deleteCategory = async (categoryName: string): Promise<void> => {
  try {
    const querySnapshot = await getDocs(collection(db, CATEGORIES_COLLECTION));
    const categoryDoc = querySnapshot.docs.find(doc => doc.data().name === categoryName);
    if (categoryDoc) {
      await deleteDoc(doc(db, CATEGORIES_COLLECTION, categoryDoc.id));
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

export const subscribeToStages = (callback: (stages: Stage[]) => void) => {
  const q = query(collection(db, STAGES_COLLECTION), orderBy("order", "asc"));
  return onSnapshot(q, (querySnapshot) => {
    const stages = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Stage[];
    callback(stages);
  }, (error) => {
    console.error("Error in stages subscription:", error);
    callback([]);
  });
};

export const addStage = async (stage: Omit<Stage, "id">): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, STAGES_COLLECTION), stage);
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

export const saveStages = async (stages: Stage[]): Promise<void> => {
  try {
    console.log("saveStages: Iniciando salvamento de", stages.length, "etapas");
    
    // Primeiro, deletar todas as etapas existentes
    const existingStages = await getStages();
    console.log("saveStages: Etapas existentes no Firebase:", existingStages.length);
    
    if (existingStages.length > 0) {
      await Promise.all(existingStages.map(stage => {
        console.log("saveStages: Deletando etapa:", stage.id);
        return deleteStage(stage.id);
      }));
    }
    
    // Depois, adicionar as novas etapas
    const promises = stages.map(stage => {
      const { id, ...stageData } = stage;
      console.log("saveStages: Adicionando etapa:", stageData.title);
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
  uploadedBy?: string
): Promise<string> => {
  try {
    if (!storage) {
      throw new Error("Firebase Storage não está inicializado");
    }
    
    // Criar referência no Storage
    const fileRef = ref(storage, `projects/${projectId}/${Date.now()}_${file.name}`);
    
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

