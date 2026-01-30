import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import app from './config';

// Inicializar Functions com região explícita
const functions = getFunctions(app, 'us-central1');

// Configurar timeout maior para funções callable
// Funções callable já gerenciam CORS automaticamente

// Descomente para usar emulador local durante desenvolvimento
// connectFunctionsEmulator(functions, "localhost", 5001);

// ==========================================
// Tipos para integração Asaas
// ==========================================

export interface AsaasCustomerData {
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

export interface AsaasPaymentData {
  workspaceId: string;
  invoiceId: string;
  clientId: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  description: string;
  billingType: 'BOLETO' | 'PIX' | 'CREDIT_CARD' | 'UNDEFINED';
  externalReference?: string;
}

export interface AsaasCustomerResult {
  id: string;
  name: string;
  email: string;
  cpfCnpj: string;
  phone?: string;
  mobilePhone?: string;
}

export interface AsaasPaymentResult {
  success: boolean;
  paymentId: string;
  paymentUrl: string | null;
  bankSlipUrl: string | null;
  pixQrCode: string | null;
  pixCopiaECola: string | null;
  status: string;
}

export interface AsaasTestConnectionResult {
  success: boolean;
  accountName: string;
  email: string;
  environment: 'sandbox' | 'production';
}

// ==========================================
// Funções de Cliente Asaas
// ==========================================

/**
 * Criar ou sincronizar cliente no Asaas
 */
export const createAsaasCustomer = async (data: AsaasCustomerData): Promise<{
  success: boolean;
  asaasCustomerId: string;
  message: string;
}> => {
  const createCustomer = httpsCallable(functions, 'asaasCreateCustomer');
  const result = await createCustomer(data);
  return result.data as any;
};

/**
 * Buscar clientes no Asaas por CPF/CNPJ ou nome
 */
export const searchAsaasCustomers = async (
  workspaceId: string, 
  query: string
): Promise<{
  success: boolean;
  customers: AsaasCustomerResult[];
}> => {
  const searchCustomers = httpsCallable(functions, 'asaasSearchCustomers');
  const result = await searchCustomers({ workspaceId, query });
  return result.data as any;
};

/**
 * Sincronizar cliente existente do Asaas com cliente local
 */
export const syncAsaasCustomer = async (
  workspaceId: string,
  clientId: string,
  asaasCustomerId: string
): Promise<{
  success: boolean;
  asaasCustomerId: string;
  customerData: {
    name: string;
    email: string;
    cpfCnpj: string;
  };
}> => {
  const syncCustomer = httpsCallable(functions, 'asaasSyncCustomer');
  const result = await syncCustomer({ workspaceId, clientId, asaasCustomerId });
  return result.data as any;
};

// ==========================================
// Funções de Pagamento Asaas
// ==========================================

/**
 * Criar cobrança no Asaas
 */
export const createAsaasPayment = async (data: AsaasPaymentData): Promise<AsaasPaymentResult> => {
  const createPayment = httpsCallable(functions, 'asaasCreatePayment');
  const result = await createPayment(data);
  return result.data as any;
};

/**
 * Obter detalhes de uma cobrança do Asaas
 */
export const getAsaasPayment = async (
  workspaceId: string,
  asaasPaymentId: string
): Promise<{
  success: boolean;
  payment: {
    id: string;
    status: string;
    value: number;
    dueDate: string;
    paymentDate?: string;
    billingType: string;
    invoiceUrl: string;
    bankSlipUrl?: string;
  };
}> => {
  const getPayment = httpsCallable(functions, 'asaasGetPayment');
  const result = await getPayment({ workspaceId, asaasPaymentId });
  return result.data as any;
};

/**
 * Cancelar cobrança no Asaas
 */
export const cancelAsaasPayment = async (
  workspaceId: string,
  asaasPaymentId: string,
  invoiceId: string
): Promise<{
  success: boolean;
  message: string;
}> => {
  const cancelPayment = httpsCallable(functions, 'asaasCancelPayment');
  const result = await cancelPayment({ workspaceId, asaasPaymentId, invoiceId });
  return result.data as any;
};

// ==========================================
// Funções de Configuração/Teste
// ==========================================

/**
 * Testar conexão com Asaas
 */
export const testAsaasConnection = async (workspaceId: string): Promise<AsaasTestConnectionResult> => {
  try {
    const testConnection = httpsCallable(functions, 'asaasTestConnection');
    const result = await testConnection({ workspaceId });
    return result.data as any;
  } catch (error: any) {
    console.error('Erro ao chamar função testAsaasConnection:', error);
    // Se for erro de CORS ou rede, dar mensagem mais clara
    if (error.code === 'functions/unavailable' || error.message?.includes('CORS') || error.message?.includes('Failed to fetch')) {
      throw new Error('Não foi possível conectar com o servidor. Verifique sua conexão e se as Functions foram deployadas corretamente.');
    }
    throw error;
  }
};

// ==========================================
// Helpers
// ==========================================

/**
 * Formatar CPF (000.000.000-00)
 */
export const formatCPF = (cpf: string): string => {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return cpf;
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

/**
 * Formatar CNPJ (00.000.000/0000-00)
 */
export const formatCNPJ = (cnpj: string): string => {
  const cleaned = cnpj.replace(/\D/g, '');
  if (cleaned.length !== 14) return cnpj;
  return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};

/**
 * Formatar CPF ou CNPJ automaticamente
 */
export const formatCpfCnpj = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 11) {
    return formatCPF(cleaned);
  }
  return formatCNPJ(cleaned);
};

/**
 * Validar CPF
 */
export const validateCPF = (cpf: string): boolean => {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cleaned[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  return remainder === parseInt(cleaned[10]);
};

/**
 * Validar CNPJ
 */
export const validateCNPJ = (cnpj: string): boolean => {
  const cleaned = cnpj.replace(/\D/g, '');
  if (cleaned.length !== 14) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false;

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned[i]) * weights1[i];
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  if (digit1 !== parseInt(cleaned[12])) return false;

  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleaned[i]) * weights2[i];
  }
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  return digit2 === parseInt(cleaned[13]);
};

/**
 * Validar CPF ou CNPJ
 */
export const validateCpfCnpj = (value: string): boolean => {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length === 11) return validateCPF(cleaned);
  if (cleaned.length === 14) return validateCNPJ(cleaned);
  return false;
};

/**
 * Obter URL do webhook para configurar no Asaas
 */
export const getWebhookUrl = (): string => {
  return 'https://us-central1-gestao-artnaweb.cloudfunctions.net/asaasWebhook';
};

