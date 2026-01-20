
import React, { useState } from 'react';

export const Settings: React.FC = () => {
  const [step, setStep] = useState(1);

  return (
    <div className="p-8 bg-slate-50 dark:bg-slate-900/20 h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight">Configurações da Agência</h2>
          <p className="text-sm text-slate-500">Gerencie sua conta e cadastre novos parceiros</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 p-8 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-12 relative">
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -translate-y-1/2 z-0"></div>
            <div className="absolute top-1/2 left-0 w-1/3 h-0.5 bg-primary -translate-y-1/2 z-0"></div>
            
            <StepIndicator number={1} label="Dados Cadastrais" active={step >= 1} current={step === 1} />
            <StepIndicator number={2} label="Contato Principal" active={step >= 2} current={step === 2} />
            <StepIndicator number={3} label="Plano de Serviços" active={step >= 3} current={step === 3} />
          </div>

          <div className="mt-16">
            <div className="mb-6">
              <h3 className="text-lg font-bold">Cadastro de Novo Cliente</h3>
              <p className="text-sm text-slate-500">Inicie o registro das informações básicas da empresa.</p>
            </div>

            <form className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InputGroup label="Tipo de Documento">
                  <select className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary">
                    <option>CNPJ (Pessoa Jurídica)</option>
                    <option>CPF (Pessoa Física)</option>
                  </select>
                </InputGroup>
                <InputGroup label="CNPJ / CPF">
                  <input className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary" placeholder="00.000.000/0000-00" type="text"/>
                </InputGroup>
                <div className="md:col-span-2">
                  <InputGroup label="Razão Social / Nome Completo">
                    <input className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary" placeholder="Ex: Nome da Empresa LTDA" type="text"/>
                  </InputGroup>
                </div>
                <InputGroup label="Nome Fantasia">
                  <input className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary" placeholder="Como a empresa é conhecida" type="text"/>
                </InputGroup>
                <InputGroup label="Setor de Atuação">
                  <select className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary">
                    <option>Tecnologia & SaaS</option>
                    <option>Saúde & Bem-estar</option>
                    <option>Varejo & E-commerce</option>
                  </select>
                </InputGroup>
              </div>

              <div className="mt-8 pt-8 border-t border-slate-100">
                <h4 className="text-sm font-bold mb-4">Serviços Contratados (Pré-seleção)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <ServiceCard icon="brush" label="Branding" desc="Identidade visual." color="text-amber-500" />
                  <ServiceCard icon="language" label="Web Design" desc="Interfaces UI/UX." color="text-primary" active />
                  <ServiceCard icon="phone_iphone" label="App Dev" desc="Apps nativos." color="text-emerald-500" />
                </div>
              </div>

              <div className="flex items-center justify-between pt-8 mt-8 border-t border-slate-100">
                <button className="px-6 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors" type="button">Cancelar</button>
                <div className="flex gap-4">
                  <button className="px-6 py-2.5 text-sm font-semibold text-slate-500 bg-slate-100 rounded-lg disabled:opacity-50" disabled type="button">Voltar</button>
                  <button className="px-8 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center gap-2" type="button" onClick={() => setStep(prev => Math.min(prev + 1, 3))}>
                    Próximo Passo <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InfoCard icon="info" title="Dica" desc="Certifique-se de que o CNPJ esteja correto para o preenchimento automático." color="text-blue-600" bg="bg-blue-50" borderColor="border-blue-100" />
          <InfoCard icon="security" title="Segurança" desc="Todas as informações são criptografadas seguindo a LGPD." color="text-amber-600" bg="bg-amber-50" borderColor="border-amber-100" />
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

const InputGroup: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-2">
    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</label>
    {children}
  </div>
);

const ServiceCard: React.FC<{ icon: string; label: string; desc: string; color: string; active?: boolean }> = ({ icon, label, desc, color, active }) => (
  <div className={`border-2 p-4 rounded-xl cursor-pointer transition-colors ${active ? 'border-primary bg-primary/5' : 'border-slate-100 hover:border-primary/30'}`}>
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-3">
        <span className={`material-symbols-outlined ${color}`}>{icon}</span>
        <span className="text-xs font-bold">{label}</span>
      </div>
      {active && <span className="material-symbols-outlined text-primary text-sm">check_circle</span>}
    </div>
    <p className="text-[10px] text-slate-500">{desc}</p>
  </div>
);

const InfoCard: React.FC<{ icon: string; title: string; desc: string; color: string; bg: string; borderColor: string }> = ({ icon, title, desc, color, bg, borderColor }) => (
  <div className={`${bg} p-4 rounded-xl border ${borderColor} flex gap-4`}>
    <span className={`material-symbols-outlined ${color}`}>{icon}</span>
    <div>
      <h5 className={`text-sm font-bold mb-1`}>{title}</h5>
      <p className="text-xs text-slate-700">{desc}</p>
    </div>
  </div>
);
