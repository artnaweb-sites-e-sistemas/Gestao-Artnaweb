import React, { useState } from 'react';
import { Client, Workspace } from '../types';
import { searchAsaasCustomers, syncAsaasCustomer, AsaasCustomerResult } from '../firebase/asaas';

interface AsaasLinkModalProps {
  client: Client;
  workspace: Workspace;
  onClose: () => void;
  onLinked: () => void;
}

export const AsaasLinkModal: React.FC<AsaasLinkModalProps> = ({
  client,
  workspace,
  onClose,
  onLinked
}) => {
  const [searchQuery, setSearchQuery] = useState(client.cpfCnpj || client.name);
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState(false);
  const [searchResults, setSearchResults] = useState<AsaasCustomerResult[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<AsaasCustomerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    setError(null);
    setSearchResults([]);
    setSelectedCustomer(null);

    try {
      const result = await searchAsaasCustomers(workspace.id, searchQuery);
      setSearchResults(result.customers);
      setHasSearched(true);
      
      if (result.customers.length === 0) {
        setError('Nenhum cliente encontrado no Asaas com esse termo.');
      }
    } catch (err: any) {
      console.error('Error searching Asaas customers:', err);
      setError(err.message || 'Erro ao buscar clientes no Asaas');
    } finally {
      setSearching(false);
    }
  };

  const handleLink = async () => {
    if (!selectedCustomer) return;

    setLinking(true);
    setError(null);

    try {
      await syncAsaasCustomer(workspace.id, client.id, selectedCustomer.id);
      onLinked();
    } catch (err: any) {
      console.error('Error linking customer:', err);
      setError(err.message || 'Erro ao vincular cliente');
    } finally {
      setLinking(false);
    }
  };

  const formatCpfCnpj = (value: string): string => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    if (cleaned.length === 14) {
      return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return value;
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Vincular Cliente ao Asaas</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Busque um cliente existente no Asaas para vincular
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Info do cliente local */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
            <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Cliente Local</p>
            <p className="font-bold">{client.name}</p>
            <p className="text-sm text-slate-500">{formatCpfCnpj(client.cpfCnpj)} • {client.email}</p>
          </div>

          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Buscar no Asaas por CPF/CNPJ ou Nome
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Digite CPF/CNPJ ou nome..."
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={searching || !searchQuery.trim()}
                className="px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {searching ? (
                  <span className="material-symbols-outlined text-lg animate-spin">sync</span>
                ) : (
                  <span className="material-symbols-outlined text-lg">search</span>
                )}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">error</span>
              {error}
            </div>
          )}

          {/* Results */}
          {hasSearched && searchResults.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">
                Resultados ({searchResults.length})
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {searchResults.map((customer) => (
                  <button
                    key={customer.id}
                    onClick={() => setSelectedCustomer(customer)}
                    className={`w-full p-4 rounded-xl border text-left transition-all ${
                      selectedCustomer?.id === customer.id
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-primary/30 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-sm">{customer.name}</p>
                        <p className="text-xs text-slate-500">
                          {formatCpfCnpj(customer.cpfCnpj)} • {customer.email}
                        </p>
                      </div>
                      {selectedCustomer?.id === customer.id && (
                        <span className="material-symbols-outlined text-primary">check_circle</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* No results message */}
          {hasSearched && searchResults.length === 0 && !error && (
            <div className="text-center py-6 text-slate-400">
              <span className="material-symbols-outlined text-4xl mb-2">person_search</span>
              <p className="text-sm">Nenhum cliente encontrado</p>
              <p className="text-xs mt-1">Tente buscar com outro termo ou cadastre o cliente no Asaas</p>
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
            onClick={handleLink}
            disabled={!selectedCustomer || linking}
            className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {linking ? (
              <>
                <span className="material-symbols-outlined text-lg animate-spin">sync</span>
                Vinculando...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">link</span>
                Vincular Cliente
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

