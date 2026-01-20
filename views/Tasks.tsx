
import React, { useState } from 'react';

interface TasksProps {
  onCreateTask?: () => void;
}

type TaskViewMode = 'list' | 'kanban' | 'timeline' | 'files';

export const Tasks: React.FC<TasksProps> = ({ onCreateTask }) => {
  const [viewMode, setViewMode] = useState<TaskViewMode>('list');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedTask, setSelectedTask] = useState<string | null>('wireframing');
  const [comment, setComment] = useState('');
  const [subtasks, setSubtasks] = useState([
    { id: '1', label: 'Layout do Header/Navegação', checked: true },
    { id: '2', label: 'Conceitos da Seção Hero', checked: true },
    { id: '3', label: 'Organização da Grade de Serviços', checked: false },
  ]);
  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-8 pt-8 pb-4">
          <div className="flex flex-wrap justify-between items-end gap-4">
            <div className="flex flex-col gap-1">
              <nav className="flex text-xs font-medium text-slate-500 uppercase tracking-wider gap-2 items-center mb-1">
                <span>Projetos</span>
                <span className="material-symbols-outlined text-[10px]">chevron_right</span>
                <span>Acme Corp</span>
              </nav>
              <h1 className="text-3xl font-black leading-tight tracking-tight">Redesign de Site e Identidade Visual</h1>
              <p className="text-slate-500 text-sm font-normal">
                <span className="font-medium text-slate-700">Cliente:</span> Acme Corp • 
                <span className="font-medium text-slate-700 ml-1">Prazo:</span> 30 Out, 2023 •
                <span className="font-medium text-primary ml-1">82% Concluído</span>
              </p>
            </div>
            <button 
              onClick={onCreateTask}
              className="flex items-center justify-center gap-2 px-6 h-11 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold hover:border-primary transition-all shadow-sm"
            >
              <span className="material-symbols-outlined">add</span>
              <span>Adicionar Nova Tarefa</span>
            </button>
          </div>
        </div>

        <div className="px-8 border-b border-slate-200 dark:border-slate-800">
          <div className="flex gap-8">
            <Tab active={viewMode === 'list'} icon="view_list" label="Visualização em Lista" onClick={() => setViewMode('list')} />
            <Tab active={viewMode === 'kanban'} icon="view_kanban" label="Visualização em Quadro" onClick={() => setViewMode('kanban')} />
            <Tab active={viewMode === 'timeline'} icon="calendar_month" label="Cronograma" onClick={() => setViewMode('timeline')} />
            <Tab active={viewMode === 'files'} icon="folder_open" label="Arquivos" onClick={() => setViewMode('files')} />
          </div>
        </div>

        <div className="flex-1 overflow-x-auto p-8 bg-slate-50 dark:bg-slate-900/20">
          {viewMode === 'kanban' && (
            <div className="flex gap-6 min-w-max">
              <TaskColumn title="A Fazer" count={4}>
                <TaskCard id="branding" title="Rascunho Identidade Visual - Style Scapes" category="Branding" date="24 Out" priority="Média" color="blue" onClick={() => { setSelectedTask('branding'); setIsSidebarOpen(true); }} />
                <TaskCard id="journey" title="Mapeamento da Jornada do Usuário (Mobile)" category="Apps" date="26 Out" priority="Baixa" color="purple" onClick={() => { setSelectedTask('journey'); setIsSidebarOpen(true); }} />
              </TaskColumn>
              <TaskColumn title="Em Andamento" count={2} active>
                <TaskCard id="wireframing" title="Wireframing - Home & Serviços" category="Web" sub="6/10 telas rascunhadas" date="Vence Amanhã" priority="Urgente" color="emerald" highlight onClick={() => { setSelectedTask('wireframing'); setIsSidebarOpen(true); }} />
              </TaskColumn>
              <TaskColumn title="Revisão" count={1}>
                <TaskCard id="backend" title="Setup do Backend - Integração CMS" category="Dev" sub="3 Comentários" date="28 Out" priority="Média" color="slate" onClick={() => { setSelectedTask('backend'); setIsSidebarOpen(true); }} />
              </TaskColumn>
              <TaskColumn title="Concluído" count={3}>
                <TaskCard id="design-system" title="Design System - Componentes Base" category="Design" date="20 Out" priority="Média" color="emerald" onClick={() => { setSelectedTask('design-system'); setIsSidebarOpen(true); }} />
                <TaskCard id="api-integration" title="Integração API - Autenticação" category="Dev" date="18 Out" priority="Média" color="blue" onClick={() => { setSelectedTask('api-integration'); setIsSidebarOpen(true); }} />
                <TaskCard id="content-audit" title="Auditoria de Conteúdo" category="Content" date="15 Out" priority="Baixa" color="purple" onClick={() => { setSelectedTask('content-audit'); setIsSidebarOpen(true); }} />
              </TaskColumn>
            </div>
          )}
          {viewMode === 'list' && (
            <div className="max-w-4xl mx-auto space-y-3">
              <TaskCard id="branding" title="Rascunho Identidade Visual - Style Scapes" category="Branding" date="24 Out" priority="Média" color="blue" onClick={() => { setSelectedTask('branding'); setIsSidebarOpen(true); }} />
              <TaskCard id="journey" title="Mapeamento da Jornada do Usuário (Mobile)" category="Apps" date="26 Out" priority="Baixa" color="purple" onClick={() => { setSelectedTask('journey'); setIsSidebarOpen(true); }} />
              <TaskCard id="wireframing" title="Wireframing - Home & Serviços" category="Web" sub="6/10 telas rascunhadas" date="Vence Amanhã" priority="Urgente" color="emerald" highlight onClick={() => { setSelectedTask('wireframing'); setIsSidebarOpen(true); }} />
              <TaskCard id="backend" title="Setup do Backend - Integração CMS" category="Dev" sub="3 Comentários" date="28 Out" priority="Média" color="slate" onClick={() => { setSelectedTask('backend'); setIsSidebarOpen(true); }} />
            </div>
          )}
          {viewMode === 'timeline' && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
                <p className="text-slate-500 text-sm">Visualização de cronograma de tarefas em desenvolvimento...</p>
              </div>
            </div>
          )}
          {viewMode === 'files' && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
                <p className="text-slate-500 text-sm">Gerenciamento de arquivos em desenvolvimento...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {isSidebarOpen && (
        <aside className="w-96 flex-shrink-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col hidden lg:flex">
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <h3 className="font-bold">Detalhes da Tarefa</h3>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          <div>
            <span className="bg-emerald-100 text-emerald-600 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider mb-2 inline-block">Redesign Web</span>
            <h2 className="text-xl font-bold mb-2">Wireframing - Home & Serviços</h2>
            <p className="text-sm text-slate-500">Criar wireframes de baixa fidelidade focando na seção hero e layouts de grade de serviços.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Responsáveis</span>
              <div className="flex items-center gap-2">
                <div className="size-6 rounded-full bg-slate-200" style={{ backgroundImage: `url('https://picsum.photos/seed/user1/40/40')`, backgroundSize: 'cover' }}></div>
                <span className="text-xs font-semibold">João Silva</span>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Prazo</span>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm text-rose-500">event</span>
                <span className="text-xs font-semibold text-rose-500">23 Out, 2023</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Subtarefas ({subtasks.filter(s => s.checked).length}/{subtasks.length})</span>
            {subtasks.map((subtask) => (
              <SubTask 
                key={subtask.id}
                label={subtask.label} 
                checked={subtask.checked}
                onClick={() => setSubtasks(prev => prev.map(s => s.id === subtask.id ? { ...s, checked: !s.checked } : s))}
              />
            ))}
          </div>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-800">
          <div className="flex gap-2 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <input 
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && comment.trim()) {
                  setComment('');
                  // Aqui você pode adicionar a lógica para salvar o comentário
                }
              }}
              className="flex-1 bg-transparent border-none text-xs focus:ring-0" 
              placeholder="Escreva um comentário..." 
              type="text"
            />
            <button 
              onClick={() => {
                if (comment.trim()) {
                  setComment('');
                  // Aqui você pode adicionar a lógica para salvar o comentário
                }
              }}
              className="bg-primary text-white p-2 rounded-lg hover:bg-primary/90 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">send</span>
            </button>
          </div>
        </div>
      </aside>
      )}
    </div>
  );
};

const Tab: React.FC<{ active?: boolean; icon: string; label: string; onClick?: () => void }> = ({ active, icon, label, onClick }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2 border-b-2 pb-3 pt-4 px-1 transition-colors ${active ? 'border-primary text-primary font-bold' : 'border-transparent text-slate-500 hover:text-slate-700 font-bold'}`}
  >
    <span className="material-symbols-outlined text-lg">{icon}</span>
    <p className="text-sm tracking-tight">{label}</p>
  </button>
);

const TaskColumn: React.FC<{ title: string; count: number; active?: boolean; children: React.ReactNode }> = ({ title, count, active, children }) => (
  <div className="w-80 flex flex-col gap-4">
    <div className="flex items-center justify-between px-1">
      <div className="flex items-center gap-2">
        <h3 className="font-bold text-sm">{title}</h3>
        <span className={`${active ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600'} px-2 py-0.5 rounded-full text-[10px] font-bold`}>{count}</span>
      </div>
      <button className="text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined text-lg">more_horiz</span></button>
    </div>
    <div className="flex flex-col gap-3">
      {children}
    </div>
  </div>
);

const TaskCard: React.FC<{ id: string; title: string; category: string; sub?: string; date: string; priority: string; color: string; highlight?: boolean; onClick?: () => void }> = ({ id, title, category, sub, date, priority, color, highlight, onClick }) => (
  <div 
    onClick={onClick}
    className={`bg-white dark:bg-slate-900 p-4 rounded-xl border ${highlight ? 'border-l-4 border-l-primary ring-1 ring-primary/5' : 'border-slate-200 dark:border-slate-800'} shadow-sm hover:border-primary/50 transition-all cursor-pointer group`}
  >
    <div className="flex justify-between items-start mb-2">
      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
        color === 'blue' ? 'bg-blue-100 text-blue-600' : 
        color === 'purple' ? 'bg-purple-100 text-purple-600' :
        color === 'emerald' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-600'
      }`}>{category}</span>
      <div className="size-6 rounded-full bg-slate-200" style={{ backgroundImage: `url('https://picsum.photos/seed/user2/40/40')`, backgroundSize: 'cover' }}></div>
    </div>
    <h4 className="text-sm font-semibold mb-1 leading-snug group-hover:text-primary">{title}</h4>
    {sub && <p className="text-[11px] text-slate-500 mb-3">{sub}</p>}
    <div className="flex items-center justify-between mt-2">
      <div className={`flex items-center gap-2 ${highlight ? 'text-rose-500 font-bold' : 'text-slate-400'}`}>
        <span className="material-symbols-outlined text-sm">{highlight ? 'timer' : 'calendar_today'}</span>
        <span className="text-[10px]">{date}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`material-symbols-outlined text-sm ${priority === 'Urgente' ? 'text-rose-500' : priority === 'Média' ? 'text-amber-500' : 'text-slate-400'}`}>flag</span>
        <span className={`text-[10px] font-bold ${priority === 'Urgente' ? 'text-rose-600' : priority === 'Média' ? 'text-amber-600' : 'text-slate-500'}`}>{priority}</span>
      </div>
    </div>
  </div>
);

const SubTask: React.FC<{ label: string; checked?: boolean; onClick?: () => void }> = ({ label, checked, onClick }) => (
  <div 
    onClick={onClick}
    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${checked ? 'bg-slate-50 border-slate-100' : 'bg-white border-slate-200 shadow-sm hover:bg-slate-50'}`}
  >
    <span className={`material-symbols-outlined ${checked ? 'text-emerald-500' : 'text-slate-300'}`}>{checked ? 'check_circle' : 'radio_button_unchecked'}</span>
    <span className={`text-sm ${checked ? 'line-through text-slate-400' : 'text-slate-700'}`}>{label}</span>
  </div>
);
