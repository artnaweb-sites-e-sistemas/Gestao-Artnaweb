import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';

interface PaymentData {
  workspaceId: string;
  invoiceId: string;
  clientId: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  description: string;
  billingType: 'BOLETO' | 'PIX' | 'CREDIT_CARD' | 'UNDEFINED';
  externalReference?: string;
}

interface GetPaymentData {
  workspaceId: string;
  asaasPaymentId: string;
}

interface CancelPaymentData {
  workspaceId: string;
  asaasPaymentId: string;
  invoiceId: string;
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

// Criar cobrança no Asaas
export async function createAsaasPayment(
  data: PaymentData, 
  context: functions.https.CallableContext
) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
  }

  const { workspaceId, invoiceId, clientId, amount, dueDate, description, billingType, externalReference } = data;

  try {
    const { apiKey, baseUrl } = await getAsaasConfig(workspaceId);
    const db = admin.firestore();

    // Buscar cliente para obter o asaasCustomerId
    const clientDoc = await db.collection('clients').doc(clientId).get();
    
    if (!clientDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Cliente não encontrado');
    }

    const client = clientDoc.data();
    const asaasCustomerId = client?.asaasCustomerId;

    if (!asaasCustomerId) {
      throw new functions.https.HttpsError('failed-precondition', 'Cliente não está vinculado ao Asaas. Por favor, sincronize o cliente primeiro.');
    }

    // Criar cobrança no Asaas
    const paymentPayload: any = {
      customer: asaasCustomerId,
      billingType: billingType,
      value: amount,
      dueDate: dueDate,
      description: description,
      externalReference: externalReference || invoiceId
    };

    const response = await axios.post(`${baseUrl}/payments`, paymentPayload, {
      headers: {
        'access_token': apiKey,
        'Content-Type': 'application/json'
      }
    });

    const payment = response.data;
    console.log(`Cobrança criada no Asaas: ${payment.id}`);

    // Preparar dados para atualização
    const invoiceUpdate: any = {
      asaasPaymentId: payment.id,
      asaasBillingType: billingType,
      asaasPaymentUrl: payment.invoiceUrl,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Se for boleto, adicionar URL do boleto
    if (billingType === 'BOLETO' && payment.bankSlipUrl) {
      invoiceUpdate.asaasBankSlipUrl = payment.bankSlipUrl;
    }

    // Se for PIX, buscar QR Code
    if (billingType === 'PIX') {
      try {
        const pixResponse = await axios.get(`${baseUrl}/payments/${payment.id}/pixQrCode`, {
          headers: {
            'access_token': apiKey,
            'Content-Type': 'application/json'
          }
        });

        if (pixResponse.data) {
          invoiceUpdate.asaasPixQrCode = pixResponse.data.encodedImage;
          invoiceUpdate.asaasPixCopiaECola = pixResponse.data.payload;
        }
      } catch (pixError) {
        console.error('Erro ao obter QR Code PIX:', pixError);
      }
    }

    // Atualizar fatura no Firestore
    await db.collection('invoices').doc(invoiceId).update(invoiceUpdate);

    return {
      success: true,
      paymentId: payment.id,
      paymentUrl: payment.invoiceUrl,
      bankSlipUrl: payment.bankSlipUrl || null,
      pixQrCode: invoiceUpdate.asaasPixQrCode || null,
      pixCopiaECola: invoiceUpdate.asaasPixCopiaECola || null,
      status: payment.status
    };
  } catch (error: any) {
    console.error('Erro ao criar cobrança no Asaas:', error.response?.data || error.message);
    
    if (error.response?.status === 400) {
      const errors = error.response.data?.errors || [];
      const errorMessages = errors.map((e: any) => e.description).join(', ');
      throw new functions.https.HttpsError('invalid-argument', errorMessages || 'Dados inválidos');
    }
    
    throw new functions.https.HttpsError('internal', error.message || 'Erro ao criar cobrança no Asaas');
  }
}

// Obter detalhes de uma cobrança do Asaas
export async function getAsaasPayment(
  data: GetPaymentData, 
  context: functions.https.CallableContext
) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
  }

  const { workspaceId, asaasPaymentId } = data;

  try {
    const { apiKey, baseUrl } = await getAsaasConfig(workspaceId);

    const response = await axios.get(`${baseUrl}/payments/${asaasPaymentId}`, {
      headers: {
        'access_token': apiKey,
        'Content-Type': 'application/json'
      }
    });

    const payment = response.data;

    return {
      success: true,
      payment: {
        id: payment.id,
        status: payment.status,
        value: payment.value,
        dueDate: payment.dueDate,
        paymentDate: payment.paymentDate,
        billingType: payment.billingType,
        invoiceUrl: payment.invoiceUrl,
        bankSlipUrl: payment.bankSlipUrl
      }
    };
  } catch (error: any) {
    console.error('Erro ao obter cobrança do Asaas:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      throw new functions.https.HttpsError('not-found', 'Cobrança não encontrada no Asaas');
    }
    
    throw new functions.https.HttpsError('internal', error.message || 'Erro ao obter cobrança');
  }
}

// Cancelar cobrança no Asaas
export async function cancelAsaasPayment(
  data: CancelPaymentData, 
  context: functions.https.CallableContext
) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado');
  }

  const { workspaceId, asaasPaymentId, invoiceId } = data;

  try {
    const { apiKey, baseUrl } = await getAsaasConfig(workspaceId);

    // Cancelar no Asaas
    await axios.delete(`${baseUrl}/payments/${asaasPaymentId}`, {
      headers: {
        'access_token': apiKey,
        'Content-Type': 'application/json'
      }
    });

    console.log(`Cobrança cancelada no Asaas: ${asaasPaymentId}`);

    // Remover vínculo no Firestore
    const db = admin.firestore();
    await db.collection('invoices').doc(invoiceId).update({
      asaasPaymentId: admin.firestore.FieldValue.delete(),
      asaasBillingType: admin.firestore.FieldValue.delete(),
      asaasPaymentUrl: admin.firestore.FieldValue.delete(),
      asaasBankSlipUrl: admin.firestore.FieldValue.delete(),
      asaasPixQrCode: admin.firestore.FieldValue.delete(),
      asaasPixCopiaECola: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: true,
      message: 'Cobrança cancelada com sucesso'
    };
  } catch (error: any) {
    console.error('Erro ao cancelar cobrança no Asaas:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      throw new functions.https.HttpsError('not-found', 'Cobrança não encontrada no Asaas');
    }
    
    throw new functions.https.HttpsError('internal', error.message || 'Erro ao cancelar cobrança');
  }
}

