import React, { useState, useEffect } from 'react';
import { Invoice, Client, Workspace, Project } from '../types';
import { createAsaasPayment, AsaasPaymentResult, formatCpfCnpj } from '../firebase/asaas';
import { getClients } from '../firebase/services';

interface AsaasChargeModalProps {
  invoice: Invoice;
  project: Project;
  workspace: Workspace;
  onClose: () => void;
  onSuccess: (result: AsaasPaymentResult) => void;
}

export const AsaasChargeModal: React.FC<AsaasChargeModalProps> = ({
  invoice,
  project,
  workspace,
  onClose,
  onSuccess
}) => {
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [billingType, setBillingType] = useState<'BOLETO' | 'PIX' | 'UNDEFINED'>('UNDEFINED');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadClients();
  }, [workspace.id]);

  const loadClients = async () => {
    setLoading(true);
    try {
      const fetchedClients = await getClients(workspace.id);
      setClients(fetchedClients);
      
      // Tentar auto-selecionar cliente pelo nome do projeto
      if (project.clientId) {
        const linkedClient = fetchedClients.find(c => c.id === project.clientId);
        if (linkedClient) {
          setSelectedClient(linkedClient);
        }
      } else if (project.client) {
        const matchingClient = fetchedClients.find(
          c => c.name.toLowerCase() === project.client.toLowerCase()
        );
        if (matchingClient) {
          setSelectedClient(matchingClient);
        }
      }
    } catch (err) {
      console.error('Error loading clients:', err);
      setError('Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCharge = async () => {
    if (!selectedClient) {
      setError('Selecione um cliente');
      return;
    }

    if (!selectedClient.asaasCustomerId) {
      setError('O cliente selecionado não está vinculado ao Asaas. Clique no botão "Sincronizar" na tela de Clientes para vincular o cliente ao Asaas e poder gerar faturas automaticamente.');
      return;
    }

    if (billingType === 'UNDEFINED') {
      setError('Selecione um tipo de cobrança');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      // Formatar a data de vencimento
      const dueDate = invoice.date instanceof Date 
        ? invoice.date.toISOString().split('T')[0]
        : new Date(invoice.date?.seconds * 1000 || Date.now()).toISOString().split('T')[0];

      const result = await createAsaasPayment({
        workspaceId: workspace.id,
        invoiceId: invoice.id,
        clientId: selectedClient.id,
        amount: invoice.amount,
        dueDate: dueDate,
        description: `Fatura #${invoice.number} - ${project.name}`,
        billingType: billingType,
        externalReference: invoice.id,
      });

      onSuccess(result);
    } catch (err: any) {
      console.error('Error creating charge:', err);
      setError(err.message || 'Erro ao criar cobrança');
    } finally {
      setCreating(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    const d = date instanceof Date ? date : new Date(date?.seconds * 1000 || date);
    return d.toLocaleDateString('pt-BR');
  };

  // Filtrar apenas clientes vinculados ao Asaas
  const linkedClients = clients.filter(c => c.asaasCustomerId);
  const unlinkedClients = clients.filter(c => !c.asaasCustomerId);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-green-500/10 to-emerald-500/10">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/20">
              <span className="material-symbols-outlined text-white">payments</span>
            </div>
            <div>
              <h2 className="text-lg font-bold">Gerar Cobrança Asaas</h2>
              <p className="text-xs text-slate-500">Fatura #{invoice.number}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Invoice Info */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Fatura</p>
                <p className="font-bold">{invoice.description}</p>
                <p className="text-sm text-slate-500">{project.name} • {project.client}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-primary">{formatCurrency(invoice.amount)}</p>
                <p className="text-xs text-slate-500">Venc: {formatDate(invoice.date)}</p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              {/* Client Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Cliente para Cobrança *
                </label>
                {linkedClients.length === 0 ? (
                  <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-4 py-3 rounded-xl text-sm">
                    <div className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-lg mt-0.5">warning</span>
                      <div>
                        <p className="font-medium">Nenhum cliente vinculado ao Asaas</p>
                        <p className="text-xs mt-1">
                          Cadastre um cliente e sincronize-o com o Asaas na tela de Clientes antes de gerar cobranças.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <select
                    value={selectedClient?.id || ''}
                    onChange={(e) => {
                      const client = clients.find(c => c.id === e.target.value);
                      setSelectedClient(client || null);
                    }}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  >
                    <option value="">Selecione um cliente</option>
                    {linkedClients.length > 0 && (
                      <optgroup label="Vinculados ao Asaas">
                        {linkedClients.map(client => (
                          <option key={client.id} value={client.id}>
                            {client.name} ({formatCpfCnpj(client.cpfCnpj)})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {unlinkedClients.length > 0 && (
                      <optgroup label="Não vinculados (sincronize primeiro)">
                        {unlinkedClients.map(client => (
                          <option key={client.id} value={client.id} disabled>
                            ⚠️ {client.name} ({formatCpfCnpj(client.cpfCnpj)})
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                )}
              </div>

              {/* Billing Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Forma de Pagamento *
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setBillingType('PIX')}
                    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                      billingType === 'PIX'
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-primary/30'
                    }`}
                  >
                    <div className={`size-10 rounded-lg flex items-center justify-center ${
                      billingType === 'PIX' ? 'bg-primary/20' : 'bg-slate-100 dark:bg-slate-800'
                    }`}>
                      <span className="material-symbols-outlined text-primary">qr_code_2</span>
                    </div>
                    <span className="text-xs font-bold">PIX</span>
                  </button>
                  <button
                    onClick={() => setBillingType('BOLETO')}
                    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                      billingType === 'BOLETO'
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-primary/30'
                    }`}
                  >
                    <div className={`size-10 rounded-lg flex items-center justify-center ${
                      billingType === 'BOLETO' ? 'bg-primary/20' : 'bg-slate-100 dark:bg-slate-800'
                    }`}>
                      <span className="material-symbols-outlined text-primary">receipt_long</span>
                    </div>
                    <span className="text-xs font-bold">Boleto</span>
                  </button>
                  <button
                    onClick={() => setBillingType('UNDEFINED')}
                    className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                      billingType === 'UNDEFINED'
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-primary/30'
                    }`}
                  >
                    <div className={`size-10 rounded-lg flex items-center justify-center ${
                      billingType === 'UNDEFINED' ? 'bg-primary/20' : 'bg-slate-100 dark:bg-slate-800'
                    }`}>
                      <span className="material-symbols-outlined text-primary">payments</span>
                    </div>
                    <span className="text-xs font-bold">Escolha</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  {billingType === 'PIX' && 'QR Code PIX gerado na hora. Pagamento instantâneo.'}
                  {billingType === 'BOLETO' && 'Boleto bancário com código de barras. Compensação em 1-3 dias úteis.'}
                  {billingType === 'UNDEFINED' && 'Cliente escolhe entre PIX, Boleto ou Cartão na hora do pagamento.'}
                </p>
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">error</span>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-slate-600 dark:text-slate-400 rounded-xl text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreateCharge}
            disabled={creating || !selectedClient || linkedClients.length === 0}
            className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl text-sm font-bold hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-green-500/20"
          >
            {creating ? (
              <>
                <span className="material-symbols-outlined text-lg animate-spin">sync</span>
                Gerando...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">bolt</span>
                Gerar Cobrança
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Modal para exibir resultado da cobrança
export const AsaasChargeResultModal: React.FC<{
  result: AsaasPaymentResult;
  onClose: () => void;
}> = ({ result, onClose }) => {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white text-center">
          <div className="size-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
            <span className="material-symbols-outlined text-4xl">check_circle</span>
          </div>
          <h2 className="text-xl font-bold">Cobrança Gerada!</h2>
          <p className="text-sm opacity-80 mt-1">O cliente receberá um e-mail com o link de pagamento</p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Payment Link */}
          {result.paymentUrl && (
            <div>
              <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">
                Link de Pagamento
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={result.paymentUrl}
                  readOnly
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs truncate"
                />
                <button
                  onClick={() => copyToClipboard(result.paymentUrl!, 'link')}
                  className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">
                    {copied === 'link' ? 'check' : 'content_copy'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* PIX QR Code */}
          {result.pixQrCode && (
            <div className="text-center">
              <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-3">
                QR Code PIX
              </p>
              <img
                src={`data:image/png;base64,${result.pixQrCode}`}
                alt="QR Code PIX"
                className="w-48 h-48 mx-auto rounded-xl border border-slate-200 dark:border-slate-700"
              />
              {result.pixCopiaECola && (
                <div className="mt-3">
                  <button
                    onClick={() => copyToClipboard(result.pixCopiaECola!, 'pix')}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 mx-auto"
                  >
                    <span className="material-symbols-outlined text-lg">
                      {copied === 'pix' ? 'check' : 'content_copy'}
                    </span>
                    {copied === 'pix' ? 'Copiado!' : 'Copiar PIX'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Boleto Link */}
          {result.bankSlipUrl && (
            <div>
              <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">
                Boleto Bancário
              </p>
              <a
                href={result.bankSlipUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <span className="material-symbols-outlined">download</span>
                Baixar Boleto PDF
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

