import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Mapeamento de status do Asaas para status interno
const STATUS_MAP: { [key: string]: 'Paid' | 'Pending' | 'Overdue' | 'Refunded' } = {
  'PENDING': 'Pending',
  'RECEIVED': 'Paid',
  'CONFIRMED': 'Paid',
  'OVERDUE': 'Overdue',
  'REFUNDED': 'Refunded',
  'RECEIVED_IN_CASH': 'Paid',
  'REFUND_REQUESTED': 'Pending',
  'REFUND_IN_PROGRESS': 'Pending',
  'CHARGEBACK_REQUESTED': 'Pending',
  'CHARGEBACK_DISPUTE': 'Pending',
  'AWAITING_CHARGEBACK_REVERSAL': 'Pending',
  'DUNNING_REQUESTED': 'Overdue',
  'DUNNING_RECEIVED': 'Paid',
  'AWAITING_RISK_ANALYSIS': 'Pending'
};

// Handler principal do webhook
export async function asaasWebhookHandler(
  req: functions.https.Request, 
  res: functions.Response
) {
  // Apenas aceitar POST
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    const event = req.body;
    
    console.log('Webhook Asaas recebido:', JSON.stringify(event, null, 2));

    // Validar estrutura do evento
    if (!event || !event.event || !event.payment) {
      console.error('Evento inválido recebido');
      res.status(400).send('Invalid event structure');
      return;
    }

    const eventType = event.event;
    const payment = event.payment;
    const paymentId = payment.id;

    console.log(`Processando evento: ${eventType} para pagamento: ${paymentId}`);

    // Buscar fatura pelo asaasPaymentId
    const db = admin.firestore();
    const invoicesQuery = await db
      .collection('invoices')
      .where('asaasPaymentId', '==', paymentId)
      .limit(1)
      .get();

    if (invoicesQuery.empty) {
      console.warn(`Fatura não encontrada para paymentId: ${paymentId}`);
      // Retornar 200 mesmo assim para o Asaas não reenviar
      res.status(200).send('Invoice not found, but acknowledged');
      return;
    }

    const invoiceDoc = invoicesQuery.docs[0];
    const invoiceId = invoiceDoc.id;
    const invoiceData = invoiceDoc.data();

    console.log(`Fatura encontrada: ${invoiceId}`);

    // Processar evento baseado no tipo
    switch (eventType) {
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_CONFIRMED':
        await handlePaymentReceived(db, invoiceId, invoiceData, payment);
        break;
      
      case 'PAYMENT_OVERDUE':
        await handlePaymentOverdue(db, invoiceId);
        break;
      
      case 'PAYMENT_DELETED':
        await handlePaymentDeleted(db, invoiceId);
        break;
      
      case 'PAYMENT_REFUNDED':
        await handlePaymentRefunded(db, invoiceId);
        break;
      
      case 'PAYMENT_UPDATED':
        await handlePaymentUpdated(db, invoiceId, payment);
        break;
      
      default:
        console.log(`Evento não processado: ${eventType}`);
    }

    res.status(200).send('OK');
  } catch (error: any) {
    console.error('Erro ao processar webhook:', error);
    res.status(500).send('Internal Server Error');
  }
}

// Pagamento recebido
async function handlePaymentReceived(
  db: admin.firestore.Firestore, 
  invoiceId: string, 
  invoiceData: any,
  payment: any
) {
  console.log(`Processando pagamento recebido para fatura: ${invoiceId}`);

  await db.collection('invoices').doc(invoiceId).update({
    status: 'Paid',
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // Se a fatura está vinculada a um projeto, atualizar status de pagamento do projeto
  if (invoiceData.projectId) {
    const projectRef = db.collection('projects').doc(invoiceData.projectId);
    const projectDoc = await projectRef.get();
    
    if (projectDoc.exists) {
      const invoiceNumber = invoiceData.number || '';
      
      // Verificar se é fatura de implementação ou recorrente
      if (invoiceNumber.startsWith('REC-')) {
        // Fatura de recorrência/mensalidade
        await projectRef.update({
          isRecurringPaid: true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else if (invoiceNumber.startsWith('IMP-')) {
        // Fatura de implementação
        await projectRef.update({
          isImplementationPaid: true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        // Fatura normal - atualizar isPaid
        await projectRef.update({
          isPaid: true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }
  }

  console.log(`Fatura ${invoiceId} marcada como paga`);
}

// Pagamento vencido
async function handlePaymentOverdue(
  db: admin.firestore.Firestore, 
  invoiceId: string
) {
  console.log(`Processando pagamento vencido para fatura: ${invoiceId}`);

  await db.collection('invoices').doc(invoiceId).update({
    status: 'Overdue',
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log(`Fatura ${invoiceId} marcada como vencida`);
}

// Pagamento deletado/cancelado
async function handlePaymentDeleted(
  db: admin.firestore.Firestore, 
  invoiceId: string
) {
  console.log(`Processando pagamento deletado para fatura: ${invoiceId}`);

  // Remover vínculo com Asaas mas manter fatura como pendente
  await db.collection('invoices').doc(invoiceId).update({
    asaasPaymentId: admin.firestore.FieldValue.delete(),
    asaasBillingType: admin.firestore.FieldValue.delete(),
    asaasPaymentUrl: admin.firestore.FieldValue.delete(),
    asaasBankSlipUrl: admin.firestore.FieldValue.delete(),
    asaasPixQrCode: admin.firestore.FieldValue.delete(),
    asaasPixCopiaECola: admin.firestore.FieldValue.delete(),
    status: 'Pending',
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log(`Vínculo Asaas removido da fatura ${invoiceId}`);
}

// Pagamento estornado
async function handlePaymentRefunded(
  db: admin.firestore.Firestore, 
  invoiceId: string
) {
  console.log(`Processando estorno para fatura: ${invoiceId}`);

  await db.collection('invoices').doc(invoiceId).update({
    status: 'Refunded',
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log(`Fatura ${invoiceId} marcada como estornada`);
}

// Pagamento atualizado (status genérico)
async function handlePaymentUpdated(
  db: admin.firestore.Firestore, 
  invoiceId: string,
  payment: any
) {
  console.log(`Processando atualização de pagamento para fatura: ${invoiceId}`);

  const asaasStatus = payment.status;
  const internalStatus = STATUS_MAP[asaasStatus] || 'Pending';

  await db.collection('invoices').doc(invoiceId).update({
    status: internalStatus,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log(`Fatura ${invoiceId} atualizada para status: ${internalStatus}`);
}






