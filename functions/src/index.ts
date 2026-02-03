import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import cors from 'cors';
import axios from 'axios';

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
  try {
    console.log('[asaasCreateCustomer wrapper] Função chamada', {
      hasData: !!data,
      hasContext: !!context,
      hasAuth: !!context?.auth
    });
    const result = await createAsaasCustomer(data, context);
    console.log('[asaasCreateCustomer wrapper] Função concluída com sucesso');
    return result;
  } catch (error: any) {
    console.error('[asaasCreateCustomer wrapper] Erro capturado:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack
    });
    // Se for HttpsError, re-lançar
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    // Converter para HttpsError
    throw new functions.https.HttpsError('internal', error.message || 'Erro desconhecido');
  }
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

// Função de teste simples para verificar se callable functions funcionam
export const testConnection = functions.https.onCall(async (data, context) => {
  return { success: true, message: 'Função callable funcionando!', timestamp: new Date().toISOString() };
});

// Função para testar conexão com Asaas
export const asaasTestConnection = functions.https.onCall(async (data, context) => {
  console.log('[asaasTestConnection] Iniciando função', {
    workspaceId: data?.workspaceId,
    hasAuth: !!context.auth,
    authUid: context.auth?.uid,
    timestamp: new Date().toISOString()
  });

  try {
    // Verificar autenticação primeiro
    if (!context.auth) {
      console.error('[asaasTestConnection] Usuário não autenticado');
      throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
    }

    // Verificar se data foi passado
    if (!data || !data.workspaceId) {
      console.error('[asaasTestConnection] workspaceId não fornecido');
      throw new functions.https.HttpsError('invalid-argument', 'workspaceId é obrigatório');
    }

    const { workspaceId } = data;
    console.log('[asaasTestConnection] Buscando workspace:', workspaceId);

    const db = admin.firestore();
    const workspaceDoc = await db.collection('workspaces').doc(workspaceId).get();

    if (!workspaceDoc.exists) {
      console.error('[asaasTestConnection] Workspace não encontrado:', workspaceId);
      throw new functions.https.HttpsError('not-found', 'Workspace não encontrado');
    }

    const workspace = workspaceDoc.data();
    const apiKey = workspace?.asaasApiKey;
    const environment = workspace?.asaasEnvironment || 'sandbox';

    if (!apiKey) {
      console.error('[asaasTestConnection] API Key não configurada');
      throw new functions.https.HttpsError('failed-precondition', 'API Key do Asaas não configurada');
    }

    console.log('[asaasTestConnection] Testando conexão com Asaas', {
      environment,
      hasApiKey: !!apiKey,
      apiKeyLength: apiKey?.length
    });

    // Axios já importado no topo do arquivo

    const baseUrl = environment === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';

    console.log('[asaasTestConnection] Fazendo requisição para:', baseUrl);

    // Testar conexão buscando informações da conta
    let response;
    try {
      response = await axios.get(`${baseUrl}/myAccount`, {
        headers: {
          'access_token': apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 15000 // 15 segundos de timeout
      });
      console.log('[asaasTestConnection] Resposta recebida:', {
        status: response.status,
        hasData: !!response.data,
        accountName: response.data?.name
      });
    } catch (axiosError: any) {
      console.error('[asaasTestConnection] Erro na requisição axios:', {
        message: axiosError.message,
        code: axiosError.code,
        response: axiosError.response?.data,
        status: axiosError.response?.status
      });

      if (axiosError.response?.status === 401) {
        throw new functions.https.HttpsError('permission-denied', 'API Key inválida ou expirada');
      }

      if (axiosError.code === 'ECONNABORTED' || axiosError.message?.includes('timeout')) {
        throw new functions.https.HttpsError('deadline-exceeded', 'Timeout ao conectar com Asaas. Verifique sua conexão e tente novamente.');
      }

      if (axiosError.response?.status) {
        throw new functions.https.HttpsError('internal', `Erro do Asaas: ${axiosError.response.status} - ${JSON.stringify(axiosError.response.data)}`);
      }

      throw new functions.https.HttpsError('internal', `Erro ao conectar com Asaas: ${axiosError.message}`);
    }

    if (!response || !response.data) {
      console.error('[asaasTestConnection] Resposta inválida do Asaas');
      throw new functions.https.HttpsError('internal', 'Resposta inválida do Asaas');
    }

    console.log('[asaasTestConnection] Conexão bem-sucedida', {
      accountName: response.data.name,
      email: response.data.email
    });

    return {
      success: true,
      accountName: response.data.name || 'Conta Asaas',
      email: response.data.email || '',
      environment
    };
  } catch (error: any) {
    console.error('[asaasTestConnection] Erro capturado:', {
      message: error.message,
      code: error.code,
      name: error.name,
      isHttpsError: error instanceof functions.https.HttpsError
    });

    // Se for um HttpsError do Firebase, re-lançar (isso garante que o Firebase trata corretamente)
    if (error instanceof functions.https.HttpsError) {
      console.log('[asaasTestConnection] Re-lançando HttpsError:', error.code, error.message);
      throw error;
    }

    // Para qualquer outro erro, converter para HttpsError
    console.error('[asaasTestConnection] Convertendo erro genérico para HttpsError');
    throw new functions.https.HttpsError(
      'internal',
      error.message || 'Erro desconhecido ao conectar com Asaas'
    );
  }
});

