
import React, { useState } from 'react';

interface ClientProfileProps {
  onNavigate?: (view: string) => void;
}

export const ClientProfile: React.FC<ClientProfileProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'access' | 'documents' | 'onboarding'>('access');
  return (
    <div className="flex h-full">
      <aside className="w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between p-6 overflow-y-auto">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-primary/10 rounded-xl p-2">
                <div className="size-12 rounded-lg bg-slate-200" style={{ backgroundImage: `url('https://picsum.photos/seed/acme/100/100')`, backgroundSize: 'cover' }}></div>
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight">Acme Corp</h1>
                <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Tech Solutions</p>
              </div>
            </div>
            <div className="flex gap-2">
              <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded uppercase">Ativo</span>
              <span className="px-2 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded uppercase">Em Onboarding</span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest mb-2">Contato Principal</p>
            <ContactInfo label="Responsável" value="Jane Doe" />
            <ContactInfo label="E-mail" value="jane@acme.com" />
            <ContactInfo label="CNPJ" value="00.000.000/0001-00" />
          </div>
          <nav className="flex flex-col gap-1">
            <p className="text-slate-400 text-[11px] font-bold uppercase tracking-widest mb-2">Gestão</p>
            <NavBtn icon="person" label="Perfil do Cliente" active onClick={() => onNavigate?.('Clients')} />
            <NavBtn icon="payments" label="Faturamento e Notas" onClick={() => onNavigate?.('ClientBilling')} />
            <NavBtn icon="rocket_launch" label="Roteiro do Projeto" onClick={() => onNavigate?.('ClientRoadmap')} />
            <NavBtn icon="history" label="Log de Atividades" onClick={() => onNavigate?.('ClientActivityLog')} />
          </nav>
        </div>
        <button className="flex w-full cursor-pointer items-center justify-center rounded-lg h-11 px-4 bg-primary text-white text-sm font-bold shadow-lg shadow-primary/20 hover:bg-blue-700 transition-all mt-8">
          Editar Perfil
        </button>
      </aside>

      <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900/10 p-8">
        <div className="max-w-5xl mx-auto flex flex-col gap-6">
          <div className="flex flex-wrap justify-between items-end gap-3 border-b border-slate-200 pb-6">
            <div className="flex flex-col gap-1">
              <p className="text-3xl font-black leading-tight tracking-tight">Perfil do Cliente e Área de Trabalho</p>
              <p className="text-slate-500 text-sm">Gerencie credenciais, arquivos legais e o progresso do onboarding.</p>
            </div>
            <div className="flex gap-3">
              <button className="flex items-center px-4 h-10 bg-white border border-slate-200 rounded-lg text-xs font-bold hover:bg-slate-50">
                <span className="material-symbols-outlined text-[18px] mr-2">share</span> Compartilhar
              </button>
              <button className="flex items-center px-4 h-10 bg-primary text-white rounded-lg text-xs font-bold hover:bg-blue-700">
                <span className="material-symbols-outlined text-[18px] mr-2">add</span> Adicionar Ativo
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="border-b border-slate-100 px-6 pt-2 flex gap-10">
              <TabLink label="Dados de Acesso" icon="key" active={activeTab === 'access'} onClick={() => setActiveTab('access')} />
              <TabLink label="Documentos" icon="folder" active={activeTab === 'documents'} onClick={() => setActiveTab('documents')} />
              <TabLink label="Onboarding" icon="checklist" badge="75%" active={activeTab === 'onboarding'} onClick={() => setActiveTab('onboarding')} />
            </div>
            <div className="p-6">
              {activeTab === 'access' && (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold">Credenciais de Hospedagem e CMS</h3>
                    <div className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">lock</span> Compartilhado com 3 membros
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <CredentialCard title="WP Engine Hosting" sub="Servidor de Produção" icon="dns" url="wpengine.acme.com" user="admin_acme_corp" />
                    <CredentialCard title="Shopify Storefront" sub="Acesso Admin API" icon="data_object" url="acme-official.myshopify.com" user="shppa_3289..." />
                  </div>
                </>
              )}
              {activeTab === 'documents' && (
                <div>
                  <h3 className="text-lg font-bold mb-4">Documentos do Cliente</h3>
                  <div className="space-y-3">
                    <DocItem icon="picture_as_pdf" name="Contrato_MSA_AcmeCorp.pdf" meta="há 2 dias • 1.2 MB" color="text-red-500" />
                    <DocItem icon="description" name="Briefing_Criativo_v2.docx" meta="ontem • 456 KB" color="text-blue-500" />
                    <DocItem icon="image" name="Guia_de_Estilo_Marca.fig" meta="há 4 horas • 12 MB" color="text-primary" />
                  </div>
                </div>
              )}
              {activeTab === 'onboarding' && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold">Progresso de Onboarding</h3>
                    <button className="text-primary text-xs font-bold hover:underline">Ver Checklist</button>
                  </div>
                  <div className="space-y-4">
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-primary h-full rounded-full" style={{ width: '75%' }}></div>
                    </div>
                    <div className="space-y-3">
                      <Step icon="check_circle" label="Contrato Assinado" active />
                      <Step icon="check_circle" label="Workshop de Briefing" active />
                      <Step icon="radio_button_checked" label="Entrega de Ativos (Em Andamento)" current />
                      <Step icon="radio_button_unchecked" label="Reunião de Kickoff" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <OnboardingCard />
            <RecentDocsCard />
          </div>
        </div>
      </main>
    </div>
  );
};

const ContactInfo: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="py-2">
    <p className="text-slate-500 text-xs mb-0.5">{label}</p>
    <p className="text-sm font-semibold">{value}</p>
  </div>
);

const NavBtn: React.FC<{ icon: string; label: string; active?: boolean; onClick?: () => void }> = ({ icon, label, active, onClick }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${active ? 'bg-primary/10 text-primary font-bold' : 'text-slate-600 hover:bg-slate-100'}`}
  >
    <span className="material-symbols-outlined text-[20px]">{icon}</span>
    {label}
  </button>
);

const TabLink: React.FC<{ label: string; icon: string; active?: boolean; badge?: string; onClick?: () => void }> = ({ label, icon, active, badge, onClick }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2 border-b-[3px] pb-3 pt-4 font-bold text-sm transition-colors ${active ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-primary'}`}
  >
    <span className="material-symbols-outlined text-[18px]">{icon}</span>
    {label}
    {badge && <span className="ml-1 px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded">{badge}</span>}
  </button>
);

const CredentialCard: React.FC<{ title: string; sub: string; icon: string; url: string; user: string }> = ({ title, sub, icon, url, user }) => (
  <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col gap-3">
    <div className="flex justify-between items-start">
      <div className="flex items-center gap-3">
        <div className="size-8 rounded bg-white flex items-center justify-center border border-slate-100">
          <span className="material-symbols-outlined text-primary">{icon}</span>
        </div>
        <div>
          <p className="text-sm font-bold leading-tight">{title}</p>
          <p className="text-[11px] text-slate-500">{sub}</p>
        </div>
      </div>
      <button className="text-slate-400 hover:text-primary"><span className="material-symbols-outlined text-[20px]">content_copy</span></button>
    </div>
    <div className="space-y-1">
      <div className="flex justify-between text-xs py-1 border-b border-slate-100">
        <span className="text-slate-500">URL</span>
        <span className="text-primary font-medium">{url}</span>
      </div>
      <div className="flex justify-between text-xs py-1">
        <span className="text-slate-500">Usuário</span>
        <span className="font-medium">{user}</span>
      </div>
    </div>
  </div>
);

const OnboardingCard: React.FC = () => (
  <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200">
    <div className="flex items-center justify-between mb-6">
      <h3 className="text-lg font-bold">Progresso de Onboarding</h3>
      <button className="text-primary text-xs font-bold hover:underline">Ver Checklist</button>
    </div>
    <div className="space-y-4">
      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
        <div className="bg-primary h-full rounded-full" style={{ width: '75%' }}></div>
      </div>
      <div className="space-y-3">
        <Step icon="check_circle" label="Contrato Assinado" active />
        <Step icon="check_circle" label="Workshop de Briefing" active />
        <Step icon="radio_button_checked" label="Entrega de Ativos (Em Andamento)" current />
        <Step icon="radio_button_unchecked" label="Reunião de Kickoff" />
      </div>
    </div>
  </div>
);

const RecentDocsCard: React.FC = () => (
  <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow-sm border border-slate-200">
    <div className="flex items-center justify-between mb-6">
      <h3 className="text-lg font-bold">Documentos Recentes</h3>
      <button className="text-primary text-xs font-bold hover:underline">Fazer Upload</button>
    </div>
    <div className="space-y-3">
      <DocItem icon="picture_as_pdf" name="MSA_AcmeCorp_2023.pdf" meta="há 2 dias • 1.2 MB" color="text-red-500" />
      <DocItem icon="description" name="Briefing_Criativo_v2.docx" meta="ontem • 456 KB" color="text-blue-500" />
      <DocItem icon="image" name="Guia_de_Estilo_Marca.fig" meta="há 4 horas • 12 MB" color="text-primary" />
    </div>
  </div>
);

const Step: React.FC<{ icon: string; label: string; active?: boolean; current?: boolean }> = ({ icon, label, active, current }) => (
  <div className={`flex items-center gap-3 ${!active && !current ? 'opacity-50' : ''}`}>
    <span className={`material-symbols-outlined ${active ? 'text-green-500' : current ? 'text-primary' : 'text-slate-400'}`}>{icon}</span>
    <p className={`text-sm ${current ? 'font-bold' : ''}`}>{label}</p>
  </div>
);

const DocItem: React.FC<{ icon: string; name: string; meta: string; color: string }> = ({ icon, name, meta, color }) => (
  <div className="flex items-center justify-between p-3 border border-slate-100 rounded-lg bg-slate-50/50">
    <div className="flex items-center gap-3">
      <span className={`material-symbols-outlined ${color}`}>{icon}</span>
      <div>
        <p className="text-xs font-bold">{name}</p>
        <p className="text-[10px] text-slate-400">{meta}</p>
      </div>
    </div>
    <button className="text-slate-400 hover:text-slate-900"><span className="material-symbols-outlined text-[20px]">download</span></button>
  </div>
);
