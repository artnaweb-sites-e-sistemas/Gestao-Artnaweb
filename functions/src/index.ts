import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import cors from 'cors';

// Inicializar Firebase Admin apenas se ainda não foi inicializado
if (!admin.apps.length) {
  admin.initializeApp();
}

// Configurar CORS
const corsHandler = cors({ origin: true });

// Importar funções de Asaas
import { createAsaasCustomer, searchAsaasCustomers, syncAsaasCustomer } from './asaas/customer';
import { createAsaasPayment, getAsaasPayment, cancelAsaasPayment } from './asaas/payment';
import { asaasWebhookHandler } from './asaas/webhook';

// Exportar funções de cliente Asaas
export const asaasCreateCustomer = functions.https.onCall(async (data, context) => {
  return createAsaasCustomer(data, context);
});

export const asaasSearchCustomers = functions.https.onCall(async (data, context) => {
  return searchAsaasCustomers(data, context);
});

export const asaasSyncCustomer = functions.https.onCall(async (data, context) => {
  return syncAsaasCustomer(data, context);
});

// Exportar funções de pagamento Asaas
export const asaasCreatePayment = functions.https.onCall(async (data, context) => {
  return createAsaasPayment(data, context);
});

export const asaasGetPayment = functions.https.onCall(async (data, context) => {
  return getAsaasPayment(data, context);
});

export const asaasCancelPayment = functions.https.onCall(async (data, context) => {
  return cancelAsaasPayment(data, context);
});

// Webhook do Asaas (endpoint HTTP público)
export const asaasWebhook = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    await asaasWebhookHandler(req, res);
  });
});

// Função para testar conexão com Asaas
export const asaasTestConnection = functions.https.onCall(async (data, context) => {
  console.log('asaasTestConnection chamada', { workspaceId: data?.workspaceId, hasAuth: !!context.auth });
  
  // Verificar se data foi passado
  if (!data || !data.workspaceId) {
    console.error('workspaceId não fornecido');
    throw new functions.https.HttpsError('invalid-argument', 'workspaceId é obrigatório');
  }
  
  const { workspaceId } = data;
  
  if (!context.auth) {
    console.error('Usuário não autenticado');
    throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
  }

  try {
    const db = admin.firestore();
    const workspaceDoc = await db.collection('workspaces').doc(workspaceId).get();
    
    if (!workspaceDoc.exists) {
      console.error('Workspace não encontrado:', workspaceId);
      throw new functions.https.HttpsError('not-found', 'Workspace não encontrado');
    }

    const workspace = workspaceDoc.data();
    const apiKey = workspace?.asaasApiKey;
    const environment = workspace?.asaasEnvironment || 'sandbox';

    if (!apiKey) {
      console.error('API Key não configurada');
      throw new functions.https.HttpsError('failed-precondition', 'API Key do Asaas não configurada');
    }

    console.log('Testando conexão com Asaas', { environment, hasApiKey: !!apiKey });
    
    // Importar axios dinamicamente
    const axios = (await import('axios')).default;
    
    const baseUrl = environment === 'production' 
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';

    // Testar conexão buscando informações da conta
    const response = await axios.get(`${baseUrl}/myAccount`, {
      headers: {
        'access_token': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 segundos de timeout
    });

    console.log('Conexão com Asaas bem-sucedida', { accountName: response.data.name });

    return {
      success: true,
      accountName: response.data.name,
      email: response.data.email,
      environment
    };
  } catch (error: any) {
    console.error('Erro ao testar conexão Asaas:', error);
    console.error('Detalhes do erro:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      code: error.code
    });
    
    if (error.response?.status === 401) {
      throw new functions.https.HttpsError('permission-denied', 'API Key inválida');
    }
    
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      throw new functions.https.HttpsError('deadline-exceeded', 'Timeout ao conectar com Asaas. Tente novamente.');
    }
    
    throw new functions.https.HttpsError('internal', error.message || 'Erro ao conectar com Asaas');
  }
});

