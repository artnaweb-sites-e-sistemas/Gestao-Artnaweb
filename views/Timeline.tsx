
import React from 'react';

const timelineWeeks = ['JAN 01', 'JAN 08', 'JAN 15', 'JAN 22', 'FEV 01', 'FEV 08', 'FEV 15', 'FEV 22', 'MAR 01', 'MAR 08'];

export const Timeline: React.FC = () => {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-8 py-6 bg-white dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Cronograma e Prazos</h2>
            <p className="text-sm text-slate-500">Visualização global de entregas e marcos de projetos</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              <button className="px-4 py-1.5 text-xs font-semibold rounded-md text-slate-500">Mês</button>
              <button className="px-4 py-1.5 text-xs font-semibold rounded-md bg-white dark:bg-slate-700 shadow-sm">Trimestre</button>
              <button className="px-4 py-1.5 text-xs font-semibold rounded-md text-slate-500">Ano</button>
            </div>
            <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition-colors">
              <span className="material-symbols-outlined text-sm">filter_list</span> Filtros
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors">
              <span className="material-symbols-outlined text-sm">ios_share</span> Exportar
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex -space-x-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="size-8 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200" style={{ backgroundImage: `url('https://picsum.photos/seed/${i*20}/40/40')`, backgroundSize: 'cover' }}></div>
            ))}
            <div className="size-8 rounded-full border-2 border-white dark:border-slate-900 bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">+5</div>
          </div>
          <div className="h-4 w-[1px] bg-slate-300"></div>
          <div className="flex gap-2">
            <Badge color="bg-amber-50 text-amber-600 border-amber-200/30" dotColor="bg-amber-500" label="Proposta Enviada" />
            <Badge color="bg-blue-50 text-blue-600 border-blue-200/30" dotColor="bg-blue-500" label="Em Desenvolvimento" />
            <Badge color="bg-emerald-50 text-emerald-600 border-emerald-200/30" dotColor="bg-emerald-500" label="Concluído" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-900/20">
        <div className="min-w-[1200px]">
          <div className="sticky top-0 z-10 flex bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="w-64 flex-shrink-0 p-4 border-r border-slate-200 dark:border-slate-800 font-bold text-xs uppercase tracking-wider text-slate-400">Projetos / Clientes</div>
            <div className="flex-1 flex gantt-grid">
              {timelineWeeks.map((week, i) => (
                <div key={week} className="w-[100px] p-4 text-center border-r border-slate-100 dark:border-slate-800/50">
                  <span className="block text-xs font-bold">{week}</span>
                  <span className="text-[10px] text-slate-400 uppercase">S{i+1}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            <TimelineRow name="Solar Solutions" tag="Redesign Web" tagColor="bg-blue-50 text-blue-600" barPos="left-[100px]" barWidth="w-[350px]" barColor="bg-blue-500" label="Desenvolvimento Frontend (65%)" progress={65} />
            <TimelineRow name="TechStart Inc." tag="Identidade Visual" tagColor="bg-amber-50 text-amber-600" barPos="left-[300px]" barWidth="w-[200px]" barColor="bg-amber-500" label="Briefing & Conceito (20%)" progress={20} />
            <TimelineRow name="Global Logistics" tag="App Dev" tagColor="bg-emerald-50 text-emerald-600" barPos="left-[50px]" barWidth="w-[500px]" barColor="bg-emerald-500" label="QA & Testes Finais (95%)" progress={95} />
            <TimelineRow name="FinEdge Banking" tag="Design System" tagColor="bg-indigo-50 text-indigo-600" barPos="left-[450px]" barWidth="w-[300px]" barColor="bg-indigo-500" label="Componentização UI (40%)" progress={40} />
            <TimelineRow name="Artisan Coffee" tag="Packaging" tagColor="bg-rose-50 text-rose-600" barPos="left-[200px]" barWidth="w-[150px]" barColor="bg-rose-500" label="Atrasado: Impressão" progress={10} isLate />
          </div>

          {/* Today Indicator */}
          <div className="absolute top-[160px] left-[264px] bottom-0 w-[2px] bg-primary z-0 opacity-20 pointer-events-none">
            <div className="bg-primary text-white text-[8px] font-bold px-1 py-0.5 rounded absolute -top-5 -left-4">HOJE</div>
          </div>
        </div>
      </div>
      
      <footer className="h-12 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-8 flex items-center justify-between text-[10px] font-medium text-slate-400">
        <div className="flex gap-6">
          <FooterLegend color="bg-blue-500" label="Redesign Web" />
          <FooterLegend color="bg-amber-500" label="Identidade Visual" />
          <FooterLegend color="bg-emerald-500" label="Aplicativos" />
          <FooterLegend color="bg-indigo-500" label="UI/UX Kits" />
        </div>
        <div>Exibindo 12 de 48 projetos ativos</div>
      </footer>
    </div>
  );
};

const Badge: React.FC<{ color: string; dotColor: string; label: string }> = ({ color, dotColor, label }) => (
  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${color}`}>
    <span className={`size-1.5 rounded-full ${dotColor}`}></span> {label}
  </span>
);

const TimelineRow: React.FC<{ name: string; tag: string; tagColor: string; barPos: string; barWidth: string; barColor: string; label: string; progress: number; isLate?: boolean }> = ({ name, tag, tagColor, barPos, barWidth, barColor, label, progress, isLate }) => (
  <div className="flex hover:bg-white dark:hover:bg-slate-800/50 transition-colors group">
    <div className="w-64 flex-shrink-0 p-4 border-r border-slate-200 dark:border-slate-800 flex flex-col gap-1">
      <h4 className="text-sm font-bold">{name}</h4>
      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded w-fit ${tagColor}`}>{tag}</span>
    </div>
    <div className="flex-1 relative flex items-center gantt-grid h-20">
      <div className={`absolute ${barPos} ${barWidth} h-8 ${barColor}/10 border-l-4 border-${isLate ? 'rose' : barColor.split('-')[1]}-500 rounded-r-lg flex items-center px-3 gap-2 cursor-pointer relative`}>
        <div className={`h-full absolute left-0 top-0 ${barColor}/20 rounded-r`} style={{ width: `${progress}%` }}></div>
        <span className={`text-[10px] font-bold relative z-10 whitespace-nowrap ${isLate ? 'text-rose-700' : `${barColor.replace('bg-', 'text-').replace('500', '700')}`}`}>
          {label}
        </span>
        {isLate && <span className="material-symbols-outlined text-rose-500 text-sm relative z-10">priority_high</span>}
      </div>
    </div>
  </div>
);

const FooterLegend: React.FC<{ color: string; label: string }> = ({ color, label }) => (
  <span className="flex items-center gap-1.5">
    <span className={`size-2 rounded-full ${color}`}></span> {label}
  </span>
);
