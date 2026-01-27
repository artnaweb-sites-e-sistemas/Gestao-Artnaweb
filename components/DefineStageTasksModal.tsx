import React, { useState, useEffect } from 'react';
import { Stage, StageTask } from '../types';
import { getStageTasks, saveStageTasks } from '../firebase/services';

interface DefineStageTasksModalProps {
    stage: Stage;
    onClose: () => void;
    categoryId?: string;
}

// Sugestões de tarefas por serviço e etapa
const taskSuggestions: { [serviceKey: string]: { label: string; stages: { [stageId: string]: string[] } } } = {
    'site-institucional': {
        label: 'Site Institucional',
        stages: {
            // Etapas padrão
            'onboarding': [
                'Reunião de briefing com cliente',
                'Coletar informações da empresa (missão, visão, valores)',
                'Definir estrutura de páginas',
                'Solicitar logotipo e materiais visuais',
                'Definir paleta de cores e tipografia'
            ],
            'development': [
                'Criar wireframes das páginas',
                'Desenvolver layout da Home',
                'Desenvolver páginas internas',
                'Implementar formulário de contato',
                'Configurar responsividade mobile',
                'Integrar Google Analytics',
                'Configurar SEO básico'
            ],
            'review': [
                'Preparar material para apresentação ao cliente',
                'Enviar primeiro conceito/entrega para o cliente',
                'Aguardar feedback do cliente',
                'Coletar e documentar ajustes solicitados',
                'Enviar para segunda revisão (após ajustes)'
            ],
            'adjustments': [
                'Analisar ajustes solicitados pelo cliente',
                'Planejar implementação das alterações',
                'Realizar alterações solicitadas',
                'Revisar qualidade das alterações',
                'Notificar equipe para nova revisão com cliente'
            ],
            'completed': [
                'Oferecer pacote de manutenção mensal (Upsell)',
                'Solicitar depoimento/feedback no Instagram/Google',
                'Propor melhorias futuras e estratégias de marketing',
                'Solicitar indicação de novos clientes'
            ],
            // Etapas recorrentes (usar IDs com sufixo -recurring)
            'onboarding-recurring': [
                'Reunião de briefing com cliente',
                'Coletar informações da empresa',
                'Definir estrutura de páginas',
                'Solicitar materiais visuais'
            ],
            'development-recurring': [
                'Desenvolver layout',
                'Implementar funcionalidades',
                'Configurar responsividade'
            ],
            'review-recurring': [
                'Preparar material para apresentação ao cliente',
                'Enviar primeiro conceito/entrega para o cliente',
                'Aguardar feedback do cliente',
                'Coletar e documentar ajustes solicitados',
                'Enviar para segunda revisão (após ajustes)'
            ],
            'adjustments-recurring': [
                'Analisar ajustes solicitados pelo cliente',
                'Planejar implementação das alterações',
                'Realizar alterações solicitadas',
                'Revisar qualidade das alterações',
                'Notificar equipe para nova revisão com cliente'
            ],
            'maintenance-recurring': [
                'Monitorar uptime do site',
                'Atualizar plugins e segurança',
                'Backup mensal'
            ],
            'finished-recurring': [
                'Encerrar contrato',
                'Entregar documentação final'
            ]
        }
    },
    'sob-demanda': {
        label: 'Sob Demanda',
        stages: {
            'onboarding': [
                'Reunião de entendimento da demanda',
                'Análise de viabilidade técnica',
                'Levantamento de requisitos Específicos',
                'Definição de prazo e orçamento',
                'Solicitar acesso ao ambiente (se necessário)'
            ],
            'development': [
                'Executar desenvolvimento da demanda',
                'Realizar testes locais unitários',
                'Documentar alterações no código',
                'Versionar alterações (Git)'
            ],
            'review': [
                'Preparar material para apresentação ao cliente',
                'Enviar primeiro conceito/entrega para o cliente',
                'Aguardar feedback do cliente',
                'Coletar e documentar ajustes solicitados',
                'Enviar para segunda revisão (após ajustes)'
            ],
            'adjustments': [
                'Analisar ajustes solicitados pelo cliente',
                'Planejar implementação das alterações',
                'Realizar alterações solicitadas',
                'Revisar qualidade das alterações',
                'Notificar equipe para nova revisão com cliente'
            ],
            'completed': [
                'Solicitar feedback sobre a entrega',
                'Verificar novas necessidades (Upsell)',
                'Solicitar depoimento se aplicável'
            ]
        }
    },
    'e-commerce': {
        label: 'E-commerce',
        stages: {
            'onboarding': [
                'Definir catálogo de produtos inicial',
                'Coletar dados de frete e entrega',
                'Definir gateways de pagamento',
                'Coletar políticas (privacidade, troca, devolução)',
                'Definir regras de desconto e cupons'
            ],
            'development': [
                'Configurar plataforma/CMS',
                'Cadastrar produtos piloto',
                'Configurar métodos de envio (Correios/Transportadoras)',
                'Configurar gateway de pagamento',
                'Personalizar layout da loja',
                'Configurar e-mails transacionais'
            ],
            'review': [
                'Preparar material para apresentação ao cliente',
                'Enviar primeiro conceito/entrega para o cliente',
                'Aguardar feedback do cliente',
                'Coletar e documentar ajustes solicitados',
                'Enviar para segunda revisão (após ajustes)'
            ],
            'adjustments': [
                'Analisar ajustes solicitados pelo cliente',
                'Planejar implementação das alterações',
                'Realizar alterações solicitadas',
                'Revisar qualidade das alterações',
                'Notificar equipe para nova revisão com cliente'
            ],
            'completed': [
                'Oferecer gestão de tráfego pago (Upsell)',
                'Propor campanhas de email marketing',
                'Monitorar abandonos de carrinho',
                'Solicitar avaliações da loja'
            ]
        }
    },
    'landing-page': {
        label: 'Landing Page',
        stages: {
            'onboarding': [
                'Definir objetivo único de conversão',
                'Definir público-alvo e persona',
                'Coletar/Redigir Copy (textos persuasivos)',
                'Definir isca digital ou oferta',
                'Selecionar imagens de alta qualidade'
            ],
            'development': [
                'Criar estrutura de seções (Hero, Prova Social, Benefícios, CTA)',
                'Implementar design focado em conversão',
                'Configurar formulários de captura',
                'Integrar com ferramenta de Email Marketing/CRM',
                'Otimizar imagens para velocidade'
            ],
            'review': [
                'Preparar material para apresentação ao cliente',
                'Enviar primeiro conceito/entrega para o cliente',
                'Aguardar feedback do cliente',
                'Coletar e documentar ajustes solicitados',
                'Enviar para segunda revisão (após ajustes)'
            ],
            'adjustments': [
                'Analisar ajustes solicitados pelo cliente',
                'Planejar implementação das alterações',
                'Realizar alterações solicitadas',
                'Revisar qualidade das alterações',
                'Notificar equipe para nova revisão com cliente'
            ],
            'completed': [
                'Oferecer gestão de tráfego (Upsell)',
                'Configurar testes A/B',
                'Analisar taxa de conversão inicial',
                'Solicitar feedback'
            ]
        }
    },
    'app': {
        label: 'App',
        stages: {
            'onboarding': [
                'Definir escopo funcional (MVP)',
                'Criar User Stories',
                'Definir fluxo de navegação (User Flow)',
                'Criar contas de desenvolvedor (Apple/Google)',
                'Validar protótipo de baixa fidelidade'
            ],
            'development': [
                'Desenvolver telas (Front-end)',
                'Implementar lógica e integrações (API)',
                'Configurar banco de dados local/remoto',
                'Implementar notificações push',
                'Configurar modo offline (se aplicável)'
            ],
            'review': [
                'Preparar material para apresentação ao cliente',
                'Enviar primeiro conceito/entrega para o cliente',
                'Aguardar feedback do cliente',
                'Coletar e documentar ajustes solicitados',
                'Enviar para segunda revisão (após ajustes)'
            ],
            'adjustments': [
                'Analisar ajustes solicitados pelo cliente',
                'Planejar implementação das alterações',
                'Realizar alterações solicitadas',
                'Revisar qualidade das alterações',
                'Notificar equipe para nova revisão com cliente'
            ],
            'completed': [
                'Monitorar crashes e bugs em produção',
                'Planejar versão 2.0 (Upsell)',
                'Solicitar review nas lojas',
                'Oferecer manutenção evolutiva'
            ]
        }
    },
    'sistema': {
        label: 'Sistema',
        stages: {
            'onboarding': [
                'Mapear processos de negócio',
                'Definir perfis de acesso e permissões',
                'Modelar banco de dados',
                'Definir requisitos não-funcionais (segurança, performance)',
                'Aprovar cronograma de sprints'
            ],
            'development': [
                'Desenvolver API e Backend',
                'Desenvolver Interface Administrativa',
                'Implementar relatórios e dashboards',
                'Implementar logs e auditoria',
                'Realizar migração de dados (se necessário)'
            ],
            'review': [
                'Preparar material para apresentação ao cliente',
                'Enviar primeiro conceito/entrega para o cliente',
                'Aguardar feedback do cliente',
                'Coletar e documentar ajustes solicitados',
                'Enviar para segunda revisão (após ajustes)'
            ],
            'adjustments': [
                'Analisar ajustes solicitados pelo cliente',
                'Planejar implementação das alterações',
                'Realizar alterações solicitadas',
                'Revisar qualidade das alterações',
                'Notificar equipe para nova revisão com cliente'
            ],
            'completed': [
                'Estabelecer acordo de nível de serviço (SLA)',
                'Oferecer suporte mensal (Upsell)',
                'Mapear novos módulos',
                'Solicitar caso de sucesso'
            ]
        }
    },
    'identidade-visual': {
        label: 'Identidade Visual',
        stages: {
            'onboarding': [
                'Briefing profundo da marca',
                'Definir arquétipos e personalidade',
                'Pesquisa de concorrentes e mercado',
                'Criar moodboard de inspiração'
            ],
            'development': [
                'Brainstorming e rascunhos',
                'Vetorização das melhores opções',
                'Desenvolver tipografia e paleta de cores',
                'Criar padrões e elementos de apoio',
                'Aplicar em mockups (cartão, social media, etc)'
            ],
            'review': [
                'Preparar material para apresentação ao cliente',
                'Enviar primeiro conceito/entrega para o cliente',
                'Aguardar feedback do cliente',
                'Coletar e documentar ajustes solicitados',
                'Enviar para segunda revisão (após ajustes)'
            ],
            'adjustments': [
                'Analisar ajustes solicitados pelo cliente',
                'Planejar implementação das alterações',
                'Realizar alterações solicitadas',
                'Revisar qualidade das alterações',
                'Notificar equipe para nova revisão com cliente'
            ],
            'completed': [
                'Fechar arquivos finais (logo, fontes, assets)',
                'Criar Manual da Marca (Brandbook)',
                'Entregar arquivos via drive/email',
                'Oferecer design de papelaria/social media (Upsell)'
            ]
        }
    }
};

export const DefineStageTasksModal: React.FC<DefineStageTasksModalProps> = ({ stage, onClose, categoryId }) => {
    const [tasks, setTasks] = useState<Array<{ title: string; order: number }>>([]);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [loading, setLoading] = useState(true);
    const [draggedTaskIndex, setDraggedTaskIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
    const [dragDirection, setDragDirection] = useState<'up' | 'down' | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [showSuggestions, setShowSuggestions] = useState(false);

    useEffect(() => {
        const loadTasks = async () => {
            try {
                const existingTasks = await getStageTasks(stage.id, categoryId);
                setTasks(existingTasks.map(t => ({ title: t.title, order: t.order })));
            } catch (error) {
                console.error("Error loading tasks:", error);
            } finally {
                setLoading(false);
            }
        };
        loadTasks();
    }, [stage.id, categoryId]);

    const handleAddTask = () => {
        if (newTaskTitle.trim()) {
            setTasks([...tasks, { title: newTaskTitle.trim(), order: tasks.length }]);
            setNewTaskTitle('');
        }
    };

    const handleRemoveTask = (index: number) => {
        setTasks(tasks.filter((_, i) => i !== index).map((t, i) => ({ ...t, order: i })));
    };

    const handleTaskDragStart = (index: number) => {
        setDraggedTaskIndex(index);
    };

    const handleTaskDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedTaskIndex === null || draggedTaskIndex === index) return;

        // Detectar direção
        if (draggedTaskIndex < index) {
            setDragDirection('down');
        } else {
            setDragDirection('up');
        }

        setDragOverIndex(index);
    };

    const handleTaskDragLeave = () => {
        setDragOverIndex(null);
    };

    const handleTaskDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        if (draggedTaskIndex === null || draggedTaskIndex === dropIndex) {
            setDraggedTaskIndex(null);
            setDragOverIndex(null);
            return;
        }

        const newTasks = [...tasks];
        const draggedTask = newTasks[draggedTaskIndex];

        // Remove a tarefa da posição original
        newTasks.splice(draggedTaskIndex, 1);

        // Insere a tarefa na nova posição
        newTasks.splice(dropIndex, 0, draggedTask);

        // Atualiza a ordem
        const reorderedTasks = newTasks.map((t, i) => ({ ...t, order: i }));
        setTasks(reorderedTasks);

        setDraggedTaskIndex(null);
        setDragOverIndex(null);
        setDragDirection(null);
    };

    const handleTaskDragEnd = () => {
        setDraggedTaskIndex(null);
        setDragOverIndex(null);
        setDragDirection(null);
    };

    const handleSave = async () => {
        try {
            await saveStageTasks(stage.id, tasks, categoryId);
            setToast({ message: "Tarefas salvas com sucesso!", type: 'success' });
            setTimeout(() => {
                setToast(null);
                onClose();
            }, 2000);
        } catch (error) {
            console.error("Error saving tasks:", error);
            setToast({ message: "Erro ao salvar tarefas. Tente novamente.", type: 'error' });
            setTimeout(() => setToast(null), 3000);
        }
    };

    const handleApplySuggestion = (serviceKey: string) => {
        const suggestion = taskSuggestions[serviceKey];
        if (!suggestion) return;

        // Função para encontrar a chave correta da sugestão baseada na etapa
        let targetKey = stage.id;

        // 1. Tentar pelo ID direto
        if (!suggestion.stages[targetKey]) {
            // 2. Tentar normalizando o título
            const normalizedTitle = stage.title.toLowerCase().replace(/\s+/g, '');
            if (normalizedTitle.includes('onboarding')) targetKey = 'onboarding';
            else if (normalizedTitle.includes('desenvolvimento') || normalizedTitle.includes('development')) targetKey = 'development';
            else if (normalizedTitle.includes('ajuste') || normalizedTitle.includes('adjustment')) targetKey = 'adjustments';
            else if (normalizedTitle.includes('revisão') || normalizedTitle.includes('revisao') || normalizedTitle.includes('review')) targetKey = 'review';
            else if (normalizedTitle.includes('concluído') || normalizedTitle.includes('concluido') || normalizedTitle.includes('completed')) targetKey = 'completed';

            // 3. Tentar pelo status se ainda não encontrou
            if (!suggestion.stages[targetKey]) {
                if (stage.status === 'Lead') targetKey = 'onboarding';
                else if (stage.status === 'Active') targetKey = 'development';
                else if (stage.status === 'Review') targetKey = 'review';
                else if (stage.status === 'Completed') targetKey = 'completed';
                else if (stage.status === 'Finished') targetKey = 'completed';
            }
        }

        const stageTasks = suggestion.stages[targetKey] || [];

        if (stageTasks.length === 0) {
            console.log(`Debug: Stage ID: ${stage.id}, Title: ${stage.title}, Status: ${stage.status}, Resolved Key: ${targetKey}`);
            setToast({ message: `Nenhuma sugestão disponível para esta etapa.`, type: 'error' });
            setTimeout(() => setToast(null), 3000);
            return;
        }

        // Adicionar tarefas sugeridas (sem duplicar)
        const existingTitles = new Set(tasks.map(t => t.title.toLowerCase()));
        const newTasks = stageTasks
            .filter(title => !existingTitles.has(title.toLowerCase()))
            .map((title, index) => ({ title, order: tasks.length + index }));

        if (newTasks.length === 0) {
            setToast({ message: `Todas as sugestões já foram adicionadas.`, type: 'error' });
            setTimeout(() => setToast(null), 3000);
            return;
        }

        setTasks([...tasks, ...newTasks]);
        setShowSuggestions(false);
        setToast({ message: `${newTasks.length} tarefa(s) adicionada(s)!`, type: 'success' });
        setTimeout(() => setToast(null), 3000);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold">Definir Tarefas - {stage.title}</h3>
                        <p className="text-sm text-slate-500 mt-1">As tarefas definidas aqui aparecerão em todos os projetos desta etapa</p>
                    </div>
                    <button onClick={onClose} className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    {loading ? (
                        <div className="text-center py-8 text-slate-500">Carregando...</div>
                    ) : (
                        <>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={newTaskTitle}
                                    onChange={(e) => setNewTaskTitle(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleAddTask()}
                                    placeholder="Digite o nome da tarefa..."
                                    className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                                />
                                <button
                                    onClick={handleAddTask}
                                    className="px-6 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
                                >
                                    Adicionar
                                </button>
                            </div>

                            {/* Botão Usar Sugestão */}
                            <button
                                onClick={() => setShowSuggestions(true)}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
                            >
                                <span className="material-symbols-outlined text-lg">auto_awesome</span>
                                Usar sugestão
                            </button>

                            {/* Modal de Sugestões */}
                            {showSuggestions && (
                                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[80] p-4" onClick={() => setShowSuggestions(false)}>
                                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
                                        {/* Header */}
                                        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                                            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Escolha o serviço</h3>
                                            <button
                                                onClick={() => setShowSuggestions(false)}
                                                className="size-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-lg">close</span>
                                            </button>
                                        </div>

                                        {/* Lista de Serviços */}
                                        <div className="p-2 max-h-80 overflow-y-auto">
                                            {Object.entries(taskSuggestions).map(([key, value]) => {
                                                let targetKey = stage.id;
                                                if (!value.stages[targetKey]) {
                                                    const normalizedTitle = stage.title.toLowerCase().replace(/\s+/g, '');
                                                    if (normalizedTitle.includes('onboarding')) targetKey = 'onboarding';
                                                    else if (normalizedTitle.includes('desenvolvimento') || normalizedTitle.includes('development')) targetKey = 'development';
                                                    else if (normalizedTitle.includes('ajuste') || normalizedTitle.includes('adjustment')) targetKey = 'adjustments';
                                                    else if (normalizedTitle.includes('revisão') || normalizedTitle.includes('revisao') || normalizedTitle.includes('review')) targetKey = 'review';
                                                    else if (normalizedTitle.includes('concluído') || normalizedTitle.includes('concluido') || normalizedTitle.includes('completed')) targetKey = 'completed';
                                                }
                                                const stageTasks = value.stages[targetKey] || [];
                                                const hasTasksForStage = stageTasks.length > 0;

                                                return (
                                                    <button
                                                        key={key}
                                                        onClick={() => hasTasksForStage && handleApplySuggestion(key)}
                                                        disabled={!hasTasksForStage}
                                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${hasTasksForStage
                                                            ? 'hover:bg-primary/5 text-slate-700 dark:text-slate-200'
                                                            : 'opacity-40 cursor-not-allowed text-slate-400'
                                                            }`}
                                                    >
                                                        <span className={`material-symbols-outlined text-lg ${hasTasksForStage ? 'text-primary' : 'text-slate-300'}`}>
                                                            {key === 'site-institucional' ? 'language' :
                                                                key === 'sob-demanda' ? 'build' :
                                                                    key === 'e-commerce' ? 'shopping_cart' :
                                                                        key === 'landing-page' ? 'web' :
                                                                            key === 'app' ? 'smartphone' :
                                                                                key === 'sistema' ? 'dns' :
                                                                                    key === 'identidade-visual' ? 'palette' : 'web'}
                                                        </span>
                                                        <span className="flex-1 text-sm font-medium">{value.label}</span>
                                                        {hasTasksForStage && (
                                                            <span className="text-xs text-slate-400">{stageTasks.length} tarefas</span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                {tasks.length === 0 ? (
                                    <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                        Nenhuma tarefa definida. Adicione tarefas acima.
                                    </div>
                                ) : (
                                    tasks.map((task, index) => (
                                        <div
                                            key={index}
                                            draggable
                                            onDragStart={() => handleTaskDragStart(index)}
                                            onDragOver={(e) => handleTaskDragOver(e, index)}
                                            onDragLeave={handleTaskDragLeave}
                                            onDrop={(e) => handleTaskDrop(e, index)}
                                            onDragEnd={handleTaskDragEnd}
                                            className={`flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border transition-all cursor-move
                                                ${draggedTaskIndex === index
                                                    ? 'opacity-40 bg-slate-100 border-dashed border-slate-300'
                                                    : 'border-slate-200 dark:border-slate-700 hover:border-primary/50'}
                                                ${dragOverIndex === index && dragDirection === 'down' ? 'border-b-4 border-b-primary mb-1' : ''}
                                                ${dragOverIndex === index && dragDirection === 'up' ? 'border-t-4 border-t-primary mt-1' : ''}
                                            `}
                                        >
                                            <span className="material-symbols-outlined text-slate-400 text-lg">drag_indicator</span>
                                            <span className="text-slate-400 text-sm font-bold">{index + 1}.</span>
                                            <span className="flex-1 text-sm font-medium text-slate-900 dark:text-slate-100">{task.title}</span>
                                            <button
                                                onClick={() => handleRemoveTask(index)}
                                                className="text-rose-600 hover:text-rose-700 transition-colors bg-white dark:bg-slate-900 p-1.5 rounded-md border border-slate-200 dark:border-slate-700 shadow-sm"
                                                onMouseDown={(e) => e.stopPropagation()}
                                            >
                                                <span className="material-symbols-outlined text-lg">delete</span>
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    )}
                </div>
                <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-8 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 transition-all shadow-lg shadow-primary/25"
                    >
                        Salvar Tarefas
                    </button>
                </div>
            </div>

            {/* Toast Notification */}
            {toast && (
                <div className="fixed top-4 right-4 z-[80] animate-[slideIn_0.3s_ease-out]">
                    <div className={`flex items-center gap-3 px-5 py-4 rounded-xl shadow-xl border backdrop-blur-sm min-w-[360px] max-w-[480px] ${toast.type === 'success'
                        ? 'bg-white/95 dark:bg-slate-900/95 border-emerald-200 dark:border-emerald-800/50'
                        : 'bg-white/95 dark:bg-slate-900/95 border-amber-200 dark:border-amber-800/50'
                        }`}>
                        <div className={`flex-shrink-0 size-10 rounded-full flex items-center justify-center ${toast.type === 'success'
                            ? 'bg-emerald-100 dark:bg-emerald-900/30'
                            : 'bg-amber-100 dark:bg-amber-900/30'
                            }`}>
                            <span className={`material-symbols-outlined text-xl ${toast.type === 'success'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-amber-600 dark:text-amber-400'
                                }`}>
                                {toast.type === 'success' ? 'check_circle' : 'warning'}
                            </span>
                        </div>
                        <p className={`text-sm font-semibold flex-1 leading-relaxed ${toast.type === 'success'
                            ? 'text-emerald-900 dark:text-emerald-100'
                            : 'text-amber-900 dark:text-amber-100'
                            }`}>
                            {toast.message}
                        </p>
                        <button
                            onClick={() => setToast(null)}
                            className="ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors flex-shrink-0 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                            aria-label="Fechar"
                        >
                            <span className="material-symbols-outlined text-lg">close</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
