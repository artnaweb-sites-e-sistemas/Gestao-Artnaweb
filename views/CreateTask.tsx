
import React, { useState } from 'react';

interface CreateTaskProps {
  onClose: () => void;
}

export const CreateTask: React.FC<CreateTaskProps> = ({ onClose }) => {
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    priority: 'Média',
    assignee: '',
    dueDate: '',
    description: ''
  });

  return (
    <div className="p-8 h-full bg-slate-50 dark:bg-slate-900/20 overflow-y-auto">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={onClose}
              className="size-10 flex items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Adicionar Nova Tarefa</h1>
              <p className="text-sm text-slate-500">Crie uma nova tarefa para o projeto</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8">
          <form className="space-y-6">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Título da Tarefa</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary"
                placeholder="Ex: Wireframing - Home & Serviços"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Serviço</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary"
                >
                  <option value="">Selecione...</option>
                  <option value="Web">Web</option>
                  <option value="Apps">Apps</option>
                  <option value="Branding">Branding</option>
                  <option value="Dev">Dev</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Prioridade</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary"
                >
                  <option value="Baixa">Baixa</option>
                  <option value="Média">Média</option>
                  <option value="Urgente">Urgente</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Responsável</label>
                <select
                  value={formData.assignee}
                  onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary"
                >
                  <option value="">Selecione...</option>
                  <option value="joao">João Silva</option>
                  <option value="maria">Maria Santos</option>
                  <option value="pedro">Pedro Costa</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Prazo</label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Descrição</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="w-full px-4 py-2.5 bg-slate-50 border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary resize-none"
                placeholder="Descreva os detalhes da tarefa..."
              />
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-slate-100">
              <button 
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={onClose}
                className="px-8 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center gap-2"
              >
                Criar Tarefa
                <span className="material-symbols-outlined text-sm">check</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

