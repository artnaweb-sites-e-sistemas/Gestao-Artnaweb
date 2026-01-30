
import React, { useState } from 'react';

interface CreateInvoiceProps {
  onClose: () => void;
}

export const CreateInvoice: React.FC<CreateInvoiceProps> = ({ onClose }) => {
  const [step, setStep] = useState(1);

  return (
    <div className="p-8 h-full bg-slate-50 dark:bg-slate-900/20 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={onClose}
              className="size-10 flex items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Criar Nova Fatura</h1>
              <p className="text-sm text-slate-500">Preencha os dados para gerar uma nova fatura</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8">
          <div className="flex items-center justify-between mb-8 relative">
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -translate-y-1/2 z-0"></div>
            <div className="absolute top-1/2 left-0 h-0.5 bg-primary -translate-y-1/2 z-0" style={{ width: `${(step / 3) * 100}%` }}></div>
            
            <StepIndicator number={1} label="Cliente" active={step >= 1} current={step === 1} />
            <StepIndicator number={2} label="Serviços" active={step >= 2} current={step === 2} />
            <StepIndicator number={3} label="Revisão" active={step >= 3} current={step === 3} />
          </div>

          <div className="mt-8">
            {step === 1 && (
              <div className="space-y-6">
                <h3 className="text-lg font-bold mb-4">Selecione o Cliente</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ClientCard name="TechStart Inc." project="Identidade Visual" selected />
                  <ClientCard name="Solar Solutions" project="Redesign Web" />
                  <ClientCard name="Global Logistics" project="App Dev" />
                  <ClientCard name="FinEdge Banking" project="SaaS UI Kit" />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <h3 className="text-lg font-bold mb-4">Adicionar Serviços</h3>
                <div className="space-y-4">
                  <ServiceRow description="Desenvolvimento Frontend" quantity={40} unitPrice={150} />
                  <ServiceRow description="Design UI/UX" quantity={20} unitPrice={200} />
                  <button className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-sm font-semibold text-slate-500 hover:border-primary hover:text-primary transition-colors">
                    + Adicionar Serviço
                  </button>
                </div>
                <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold">Subtotal</span>
                    <span className="text-lg font-bold">R$ 10.000,00</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-500">Total</span>
                    <span className="text-2xl font-black text-primary">R$ 10.000,00</span>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <h3 className="text-lg font-bold mb-4">Revisar Fatura</h3>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-6 space-y-4">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Cliente:</span>
                    <span className="font-semibold">TechStart Inc.</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Projeto:</span>
                    <span className="font-semibold">Identidade Visual</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Vencimento:</span>
                    <span className="font-semibold">30 dias</span>
                  </div>
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold">Total:</span>
                      <span className="text-2xl font-black text-primary">R$ 10.000,00</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-8 mt-8 border-t border-slate-100">
              <button 
                onClick={onClose}
                className="px-6 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors"
              >
                Cancelar
              </button>
              <div className="flex gap-4">
                {step > 1 && (
                  <button 
                    onClick={() => setStep(prev => prev - 1)}
                    className="px-6 py-2.5 text-sm font-semibold text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    Voltar
                  </button>
                )}
                <button 
                  onClick={() => step < 3 ? setStep(prev => prev + 1) : onClose()}
                  className="px-8 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center gap-2"
                >
                  {step < 3 ? 'Próximo' : 'Criar Fatura'} 
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StepIndicator: React.FC<{ number: number; label: string; active?: boolean; current?: boolean }> = ({ number, label, active, current }) => (
  <div className="relative z-10 flex flex-col items-center">
    <div className={`size-10 rounded-full flex items-center justify-center font-bold text-sm ring-4 ring-white transition-colors ${active ? 'bg-primary text-white' : 'bg-slate-100 text-slate-400'}`}>
      {number}
    </div>
    <span className={`absolute top-12 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${current ? 'text-primary' : 'text-slate-400'}`}>{label}</span>
  </div>
);

const ClientCard: React.FC<{ name: string; project: string; selected?: boolean }> = ({ name, project, selected }) => (
  <button className={`p-4 rounded-lg border-2 text-left transition-colors ${selected ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-primary/30'}`}>
    <h4 className="font-bold mb-1">{name}</h4>
    <p className="text-sm text-slate-500">{project}</p>
  </button>
);

const ServiceRow: React.FC<{ description: string; quantity: number; unitPrice: number }> = ({ description, quantity, unitPrice }) => (
  <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
    <div className="flex-1">
      <p className="font-semibold">{description}</p>
      <p className="text-sm text-slate-500">{quantity} horas × R$ {unitPrice.toLocaleString('pt-BR')}</p>
    </div>
    <span className="text-lg font-bold">R$ {(quantity * unitPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
  </div>
);








