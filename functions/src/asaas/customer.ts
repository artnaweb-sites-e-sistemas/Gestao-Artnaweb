import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';

interface CustomerData {
  workspaceId: string;
  clientId: string;
  name: string;
  email: string;
  cpfCnpj: string;
  phone?: string;
  mobilePhone?: string;
  address?: {
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
}

interface SearchCustomerData {
  workspaceId: string;
  query: string; // CPF/CNPJ ou nome
}

interface SyncCustomerData {
  workspaceId: string;
  clientId: string;
  asaasCustomerId: string;
}

// Helper para obter configurações do Asaas do workspace
async function getAsaasConfig(workspaceId: string) {
  const db = admin.firestore();
  const workspaceDoc = await db.collection('workspaces').doc(workspaceId).get();
  
  if (!workspaceDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Workspace não encontrado');
  }

  const workspace = workspaceDoc.data();
  const apiKey = workspace?.asaasApiKey;
  const environment = workspace?.asaasEnvironment || 'sandbox';

  if (!apiKey) {
    throw new functions.https.HttpsError('failed-precondition', 'API Key do Asaas não configurada');
  }

  const baseUrl = environment === 'production' 
    ? 'https://api.asaas.com/v3'
    : 'https://sandbox.asaas.com/api/v3';

  return { apiKey, baseUrl, environment };
}

// Criar cliente no Asaas
export async function createAsaasCustomer(
  data: CustomerData, 
  context: functions.https.CallableContext
) {
  console.log('[asaasCreateCustomer] Iniciando função', { 
    workspaceId: data?.workspaceId, 
    clientId: data?.clientId,
    hasAuth: !!context.auth,
    authUid: context.auth?.uid,
    timestamp: new Date().toISOString()
  });
  
  if (!context.auth) {
    console.error('[asaasCreateCustomer] Usuário não autenticado');
    throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
  }

  if (!data || !data.workspaceId || !data.clientId) {
    console.error('[asaasCreateCustomer] Dados inválidos', { 
      hasWorkspaceId: !!data?.workspaceId,
      hasClientId: !!data?.clientId 
    });
    throw new functions.https.HttpsError('invalid-argument', 'workspaceId e clientId são obrigatórios');
  }

  const { workspaceId, clientId, name, email, cpfCnpj, phone, mobilePhone, address } = data;

  try {
    console.log('[asaasCreateCustomer] Buscando configuração do Asaas', { workspaceId });
    const { apiKey, baseUrl } = await getAsaasConfig(workspaceId);
    console.log('[asaasCreateCustomer] Configuração obtida', { hasApiKey: !!apiKey, baseUrl });

    // Formatar CPF/CNPJ (remover caracteres especiais)
    const cleanCpfCnpj = cpfCnpj?.replace(/\D/g, '') || '';
    
    if (!cleanCpfCnpj) {
      console.error('[asaasCreateCustomer] CPF/CNPJ não fornecido');
      throw new functions.https.HttpsError('invalid-argument', 'CPF/CNPJ é obrigatório');
    }

    console.log('[asaasCreateCustomer] Verificando se cliente já existe no Asaas', { cleanCpfCnpj });
    
    // Verificar se cliente já existe no Asaas pelo CPF/CNPJ
    let searchResponse;
    try {
      searchResponse = await axios.get(`${baseUrl}/customers`, {
        headers: {
          'access_token': apiKey,
          'Content-Type': 'application/json'
        },
        params: {
          cpfCnpj: cleanCpfCnpj
        },
        timeout: 15000
      });
      console.log('[asaasCreateCustomer] Busca no Asaas concluída', { 
        found: searchResponse.data.data?.length > 0 
      });
    } catch (searchError: any) {
      console.error('[asaasCreateCustomer] Erro ao buscar cliente no Asaas:', {
        message: searchError.message,
        status: searchError.response?.status,
        data: searchError.response?.data
      });
      // Se for erro 401, significa que a API key está inválida
      if (searchError.response?.status === 401) {
        throw new functions.https.HttpsError('permission-denied', 'API Key do Asaas inválida ou expirada');
      }
      // Continuar tentando criar o cliente mesmo se a busca falhar
      searchResponse = { data: { data: [] } };
    }

    let asaasCustomerId: string;

    if (searchResponse.data.data && searchResponse.data.data.length > 0) {
      // Cliente já existe, usar o ID existente
      asaasCustomerId = searchResponse.data.data[0].id;
      console.log(`Cliente já existe no Asaas: ${asaasCustomerId}`);
    } else {
      // Criar novo cliente no Asaas
      console.log('[asaasCreateCustomer] Criando novo cliente no Asaas', { name, email });
      
      const customerPayload: any = {
        name,
        email,
        cpfCnpj: cleanCpfCnpj,
        notificationDisabled: false
      };

      if (phone) customerPayload.phone = phone.replace(/\D/g, '');
      if (mobilePhone) customerPayload.mobilePhone = mobilePhone.replace(/\D/g, '');
      
      if (address) {
        if (address.postalCode) customerPayload.postalCode = address.postalCode.replace(/\D/g, '');
        if (address.street) customerPayload.address = address.street;
        if (address.number) customerPayload.addressNumber = address.number;
        if (address.complement) customerPayload.complement = address.complement;
        if (address.neighborhood) customerPayload.province = address.neighborhood;
      }

      let createResponse;
      try {
        createResponse = await axios.post(`${baseUrl}/customers`, customerPayload, {
          headers: {
            'access_token': apiKey,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        });
        asaasCustomerId = createResponse.data.id;
        console.log('[asaasCreateCustomer] Cliente criado no Asaas:', asaasCustomerId);
      } catch (createError: any) {
        console.error('[asaasCreateCustomer] Erro ao criar cliente no Asaas:', {
          message: createError.message,
          status: createError.response?.status,
          data: createError.response?.data
        });
        
        if (createError.response?.status === 400) {
          const errors = createError.response.data?.errors || [];
          const errorMessages = errors.map((e: any) => e.description).join(', ');
          throw new functions.https.HttpsError('invalid-argument', errorMessages || 'Dados inválidos para criar cliente no Asaas');
        }
        
        if (createError.response?.status === 401) {
          throw new functions.https.HttpsError('permission-denied', 'API Key do Asaas inválida ou expirada');
        }
        
        throw new functions.https.HttpsError('internal', `Erro ao criar cliente no Asaas: ${createError.message}`);
      }
    }

    // Atualizar cliente no Firestore com o ID do Asaas
    console.log('[asaasCreateCustomer] Atualizando cliente no Firestore', { clientId, asaasCustomerId });
    const db = admin.firestore();
    try {
      await db.collection('clients').doc(clientId).update({
        asaasCustomerId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log('[asaasCreateCustomer] Cliente atualizado no Firestore com sucesso');
    } catch (firestoreError: any) {
      console.error('[asaasCreateCustomer] Erro ao atualizar cliente no Firestore:', firestoreError);
      // Mesmo se falhar a atualização no Firestore, retornar sucesso pois o cliente foi criado no Asaas
      // O usuário pode sincronizar manualmente depois
    }

    console.log('[asaasCreateCustomer] Função concluída com sucesso');
    return {
      success: true,
      asaasCustomerId,
      message: 'Cliente sincronizado com Asaas'
    };
  } catch (error: any) {
    console.error('[asaasCreateCustomer] Erro capturado:', {
      message: error.message,
      code: error.code,
      name: error.name,
      isHttpsError: error instanceof functions.https.HttpsError,
      response: error.response?.data
    });
    
    // Se for um HttpsError do Firebase, re-lançar
    if (error instanceof functions.https.HttpsError) {
      console.log('[asaasCreateCustomer] Re-lançando HttpsError:', error.code, error.message);
      throw error;
    }
    
    // Para qualquer outro erro, converter para HttpsError
    console.error('[asaasCreateCustomer] Convertendo erro genérico para HttpsError');
    throw new functions.https.HttpsError(
      'internal', 
      error.message || 'Erro desconhecido ao criar cliente no Asaas'
    );
  }
}

// Buscar clientes no Asaas
export async function searchAsaasCustomers(
  data: SearchCustomerData, 
  context: functions.https.CallableContext
) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
  }

  const { workspaceId, query } = data;

  try {
    const { apiKey, baseUrl } = await getAsaasConfig(workspaceId);

    // Tentar buscar por CPF/CNPJ primeiro
    const cleanQuery = query.replace(/\D/g, '');
    let searchParams: any = {};

    if (cleanQuery.length === 11 || cleanQuery.length === 14) {
      // Parece ser CPF ou CNPJ
      searchParams.cpfCnpj = cleanQuery;
    } else {
      // Buscar por nome
      searchParams.name = query;
    }

    const response = await axios.get(`${baseUrl}/customers`, {
      headers: {
        'access_token': apiKey,
        'Content-Type': 'application/json'
      },
      params: {
        ...searchParams,
        limit: 20
      }
    });

    const customers = response.data.data || [];

    return {
      success: true,
      customers: customers.map((c: any) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        cpfCnpj: c.cpfCnpj,
        phone: c.phone,
        mobilePhone: c.mobilePhone
      }))
    };
  } catch (error: any) {
    console.error('Erro ao buscar clientes no Asaas:', error.response?.data || error.message);
    throw new functions.https.HttpsError('internal', error.message || 'Erro ao buscar clientes no Asaas');
  }
}

// Sincronizar cliente existente do Asaas
export async function syncAsaasCustomer(
  data: SyncCustomerData, 
  context: functions.https.CallableContext
) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
  }

  const { workspaceId, clientId, asaasCustomerId } = data;

  try {
    const { apiKey, baseUrl } = await getAsaasConfig(workspaceId);

    // Verificar se o cliente existe no Asaas
    const response = await axios.get(`${baseUrl}/customers/${asaasCustomerId}`, {
      headers: {
        'access_token': apiKey,
        'Content-Type': 'application/json'
      }
    });

    const asaasCustomer = response.data;

    // Atualizar cliente no Firestore
    const db = admin.firestore();
    await db.collection('clients').doc(clientId).update({
      asaasCustomerId,
      // Opcionalmente atualizar dados do cliente local com dados do Asaas
      email: asaasCustomer.email || undefined,
      phone: asaasCustomer.phone || undefined,
      mobilePhone: asaasCustomer.mobilePhone || undefined,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: true,
      asaasCustomerId,
      customerData: {
        name: asaasCustomer.name,
        email: asaasCustomer.email,
        cpfCnpj: asaasCustomer.cpfCnpj
      }
    };
  } catch (error: any) {
    console.error('Erro ao sincronizar cliente do Asaas:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      throw new functions.https.HttpsError('not-found', 'Cliente não encontrado no Asaas');
    }
    
    throw new functions.https.HttpsError('internal', error.message || 'Erro ao sincronizar cliente');
  }
}

