
import React from 'react';

export const Documents: React.FC = () => {
  return (
    <div className="p-8 h-full bg-slate-50 dark:bg-slate-900/20 overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-primary mb-1">
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              <span className="text-xs font-bold uppercase tracking-wider">Cliente: TechStart Inc.</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Gerenciamento de Documentos</h2>
            <p className="text-sm text-slate-500">Acesse e organize briefings, contratos e ativos do projeto.</p>
          </div>
          <div className="flex bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
            <button className="px-4 py-1.5 text-xs font-semibold rounded-md bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm">Todos</button>
            <button className="px-4 py-1.5 text-xs font-semibold rounded-md text-slate-500 hover:text-slate-700">Contratos</button>
            <button className="px-4 py-1.5 text-xs font-semibold rounded-md text-slate-500 hover:text-slate-700">Briefings</button>
            <button className="px-4 py-1.5 text-xs font-semibold rounded-md text-slate-500 hover:text-slate-700">Ativos</button>
          </div>
        </div>

        <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-12 bg-white/50 dark:bg-slate-900/50 flex flex-col items-center justify-center text-center transition-colors hover:border-primary/50 group">
          <div className="size-16 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-3xl">cloud_upload</span>
          </div>
          <h3 className="text-lg font-bold">Arraste e solte seus arquivos aqui</h3>
          <p className="text-sm text-slate-500 mt-1 mb-6">Ou se preferir, clique no botão abaixo para selecionar do seu computador</p>
          <button className="bg-primary text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
            Selecionar Arquivos
          </button>
          <p className="text-[10px] text-slate-400 mt-4 uppercase tracking-widest font-bold">Formatos aceitos: PDF, DOCX, FIG, PNG, SVG (Máx 50MB)</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Arquivos Recentes</h3>
            <button className="text-xs font-bold text-primary hover:underline">Ver Todos</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FileItem icon="picture_as_pdf" iconColor="text-rose-500" iconBg="bg-rose-50" name="Contrato_Prestacao_Servicos.pdf" meta="Contratos • 1.2 MB • Enviado há 2h" />
            <FileItem icon="design_services" iconColor="text-purple-500" iconBg="bg-purple-50" name="Diretrizes_de_Marca_V2.fig" meta="Ativos • 45.8 MB • Ontem" />
            <FileItem icon="description" iconColor="text-blue-500" iconBg="bg-blue-50" name="Briefing_Campanha_Natal.docx" meta="Briefings • 256 KB • 12 Jan 2024" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1 w-full space-y-2">
            <div className="flex justify-between items-end">
              <h4 className="text-sm font-bold">Espaço Utilizado</h4>
              <span className="text-xs text-slate-500 font-medium">1.2 GB de 5 GB</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
              <div className="bg-primary h-full w-[24%]"></div>
            </div>
          </div>
          <div className="flex gap-6 items-center border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800 pt-4 md:pt-0 md:pl-8">
            <Stat label="Arquivos" value="124" />
            <Stat label="Pastas" value="12" />
            <button className="bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-4 py-2 rounded-lg text-xs font-bold hover:opacity-90">Upgrade</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const FileItem: React.FC<{ icon: string; iconColor: string; iconBg: string; name: string; meta: string }> = ({ icon, iconColor, iconBg, name, meta }) => (
  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex gap-4 group">
    <div className={`size-12 ${iconBg} rounded-lg flex items-center justify-center ${iconColor} flex-shrink-0`}>
      <span className="material-symbols-outlined text-2xl">{icon}</span>
    </div>
    <div className="flex-1 min-w-0">
      <h4 className="text-sm font-bold truncate">{name}</h4>
      <p className="text-[10px] text-slate-500">{meta}</p>
    </div>
    <button className="material-symbols-outlined text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">more_vert</button>
  </div>
);

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="text-center">
    <p className="text-lg font-bold">{value}</p>
    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">{label}</p>
  </div>
);
