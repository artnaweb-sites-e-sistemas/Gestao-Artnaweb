import React, { useState } from 'react';
import { Workspace, WorkspaceMember } from '../types';
import { addWorkspaceMember, removeWorkspaceMember, updateWorkspaceMember } from '../firebase/services';
import { ConfirmationModal } from './ConfirmationModal';

interface TeamSettingsProps {
    currentWorkspace: Workspace;
    onUpdate: (workspace: Workspace) => void;
    canEdit?: boolean;
}

export const TeamSettings: React.FC<TeamSettingsProps> = ({ currentWorkspace, onUpdate, canEdit = true }) => {
    const [showAddMember, setShowAddMember] = useState(false);
    const [newMemberEmail, setNewMemberEmail] = useState('');
    const [newMemberRole, setNewMemberRole] = useState<'admin' | 'member'>('member');
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [editingMember, setEditingMember] = useState<WorkspaceMember | null>(null);

    // Modal de confirmação
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [memberToRemove, setMemberToRemove] = useState<string | null>(null);

    const defaultPermissions = {
        financial: 'view',
        timeline: 'view',
        pipeline: 'view',
        clients: 'view',
        settings: 'none'
    } as const;

    const handleAddMember = async () => {
        if (!newMemberEmail) return;

        setLoading(true);
        try {
            await addWorkspaceMember(
                currentWorkspace.id,
                newMemberEmail,
                newMemberRole,
                newMemberRole === 'admin'
                    ? { financial: 'edit', timeline: 'edit', pipeline: 'edit', clients: 'edit', settings: 'edit' }
                    : defaultPermissions
            );

            setToast({ message: 'Membro adicionado com sucesso!', type: 'success' });
            setShowAddMember(false);
            setNewMemberEmail('');

            // Update local state by re-fetching or optimistic update
            // Ideally onUpdate should refetch workspace, but for now we append locally if onUpdate handles merge?
            // Actually onUpdate simply updates parent state. We probably need to refresh data from server or simulate it.
            // Since `addWorkspaceMember` updates Firestore, the parent `Settings` component (if using subs) might not auto-update unless it subscribes to workspace changes. 
            // The `Settings` component subscribes to `currentWorkspace` prop, but that prop comes from `App` or `Dashboard` which might be subscribed.
            // Let's assume we need to manually trigger onUpdate if we want immediate feedback without refetch, 
            // OR rely on the parent's subscription if it exists. 
            // However, `addWorkspaceMember` adds to the doc.

            // Let's create a temporary updated workspace to show changes immediately
            const newMemberObj: WorkspaceMember = {
                id: crypto.randomUUID(),
                email: newMemberEmail,
                role: newMemberRole,
                permissions: newMemberRole === 'admin'
                    ? { financial: 'edit', timeline: 'edit', pipeline: 'edit', clients: 'edit', settings: 'edit' }
                    : defaultPermissions,
                addedAt: new Date()
            };

            onUpdate({
                ...currentWorkspace,
                members: [...(currentWorkspace.members || []), newMemberObj]
            });

        } catch (error: any) {
            console.error(error);
            setToast({ message: error.message || 'Erro ao adicionar membro.', type: 'error' });
        } finally {
            setLoading(false);
            setTimeout(() => setToast(null), 3000);
        }
    };

    const confirmRemoveMember = (email: string) => {
        setMemberToRemove(email);
        setShowConfirmModal(true);
    };

    const handleRemoveMember = async () => {
        if (!memberToRemove) return;

        const email = memberToRemove;
        setLoading(true);

        try {
            await removeWorkspaceMember(currentWorkspace.id, email);
            setToast({ message: 'Membro removido com sucesso!', type: 'success' });

            onUpdate({
                ...currentWorkspace,
                members: (currentWorkspace.members || []).filter(m => m.email !== email)
            });
        } catch (error) {
            console.error(error);
            setToast({ message: 'Erro ao remover membro.', type: 'error' });
        } finally {
            setLoading(false);
            setShowConfirmModal(false);
            setMemberToRemove(null);
        }
    };

    const handleUpdateMember = async (member: WorkspaceMember, updates: Partial<WorkspaceMember>) => {
        try {
            await updateWorkspaceMember(currentWorkspace.id, member.email, updates);
            setToast({ message: 'Permissões atualizadas!', type: 'success' });

            onUpdate({
                ...currentWorkspace,
                members: (currentWorkspace.members || []).map(m =>
                    m.email === member.email ? { ...m, ...updates } : m
                )
            });
            setEditingMember(null);
        } catch (error) {
            console.error(error);
            setToast({ message: 'Erro ao atualizar permissões.', type: 'error' });
        }
    };

    const PermissionToggle = ({
        label,
        value,
        onChange,
        allowedOptions
    }: {
        label: string,
        value: 'none' | 'view' | 'edit',
        onChange: (val: 'none' | 'view' | 'edit') => void,
        allowedOptions?: ('none' | 'view' | 'edit')[]
    }) => (
        <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                {(allowedOptions || ['none', 'view', 'edit']).map((option) => (
                    <button
                        key={option}
                        onClick={() => onChange(option)}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${value === option
                            ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                            }`}
                    >
                        {option === 'none' ? 'Sem Acesso' : option === 'view' ? 'Visualizar' : 'Editar'}
                    </button>
                ))}
            </div>
        </div>
    );


    return (
        <>
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {toast && (
                    <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-in slide-in-from-right ${toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                        }`}>
                        <span className="material-symbols-outlined text-lg">
                            {toast.type === 'success' ? 'check_circle' : 'error'}
                        </span>
                        {toast.message}
                    </div>
                )}

                <div>
                    <h3 className="text-2xl font-black tracking-tight mb-2">Equipe</h3>
                    <p className="text-slate-500 text-sm">Gerencie o acesso de usuários ao seu workspace</p>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Membros da Equipe</h4>
                        {canEdit && (
                            <button
                                onClick={() => setShowAddMember(true)}
                                className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined text-lg">person_add</span>
                                Adicionar Membro
                            </button>
                        )}
                    </div>

                    {/* Add Member Form */}
                    {showAddMember && (
                        <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95">
                            <h5 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Novo Membro</h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Email do Usuário</label>
                                    <input
                                        type="email"
                                        value={newMemberEmail}
                                        onChange={(e) => setNewMemberEmail(e.target.value)}
                                        placeholder="exemplo@email.com"
                                        className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Função</label>
                                    <select
                                        value={newMemberRole}
                                        onChange={(e) => setNewMemberRole(e.target.value as 'admin' | 'member')}
                                        className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                                    >
                                        <option value="member">Membro</option>
                                        <option value="admin">Administrador</option>
                                    </select>
                                    <p className="text-[10px] text-slate-400 mt-1">
                                        {newMemberRole === 'admin'
                                            ? 'Acesso total a todas as funcionalidades e configurações.'
                                            : 'Acesso restrito configurável por módulo.'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setShowAddMember(false)}
                                    className="px-4 py-2 text-slate-500 hover:text-slate-700 text-sm font-bold transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleAddMember}
                                    disabled={loading || !newMemberEmail}
                                    className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {loading ? <span className="material-symbols-outlined text-sm animate-spin">sync</span> : null}
                                    Enviar Convite
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Members List */}
                    <div className="space-y-3">
                        {(!currentWorkspace.members || currentWorkspace.members.length === 0) && (
                            <div className="text-center py-8 text-slate-400">
                                <span className="material-symbols-outlined text-4xl mb-2">group_off</span>
                                <p className="text-sm">Nenhum membro na equipe ainda.</p>
                            </div>
                        )}

                        {currentWorkspace.members?.map((member) => (
                            <div key={member.email} className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl hover:border-slate-200 dark:hover:border-slate-700 transition-all">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-bold text-lg">
                                            {member.email[0].toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{member.email}</p>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${member.role === 'admin'
                                                    ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                                                    : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                                                    }`}>
                                                    {member.role === 'admin' ? 'Administrador' : 'Membro'}
                                                </span>
                                                <span className="text-[10px] text-slate-400">
                                                    Adicionado em {new Date(member.addedAt?.seconds ? member.addedAt.seconds * 1000 : member.addedAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {canEdit && (
                                            <>
                                                <button
                                                    onClick={() => setEditingMember(member)}
                                                    className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                                                    title="Editar Permissões"
                                                >
                                                    <span className="material-symbols-outlined">settings</span>
                                                </button>
                                                <button
                                                    onClick={() => confirmRemoveMember(member.email)}
                                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                    title="Remover Membro"
                                                >
                                                    <span className="material-symbols-outlined">person_remove</span>
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Permission Editor (Inline or Expanded) */}
                                {editingMember?.email === member.email && (
                                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-2">
                                        <div className="flex items-center justify-between mb-4">
                                            <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Permissões de Acesso</h5>
                                            <button onClick={() => setEditingMember(null)} className="text-xs text-slate-400 hover:text-slate-600">Fechar</button>
                                        </div>

                                        <div className="grid grid-cols-1 gap-1 mb-4">
                                            <PermissionToggle
                                                label="Pipeline (Projetos)"
                                                value={editingMember.permissions.pipeline}
                                                onChange={(val) => setEditingMember({ ...editingMember, permissions: { ...editingMember.permissions, pipeline: val } })}
                                                allowedOptions={['view', 'edit']}
                                            />
                                            <PermissionToggle
                                                label="Financeiro"
                                                value={editingMember.permissions.financial}
                                                onChange={(val) => setEditingMember({ ...editingMember, permissions: { ...editingMember.permissions, financial: val } })}
                                            />
                                            <PermissionToggle
                                                label="Cronograma"
                                                value={editingMember.permissions.timeline}
                                                onChange={(val) => setEditingMember({ ...editingMember, permissions: { ...editingMember.permissions, timeline: val } })}
                                            />
                                            <PermissionToggle
                                                label="Clientes"
                                                value={editingMember.permissions.clients}
                                                onChange={(val) => setEditingMember({ ...editingMember, permissions: { ...editingMember.permissions, clients: val } })}
                                            />
                                            <PermissionToggle
                                                label="Configurações"
                                                value={editingMember.permissions.settings}
                                                onChange={(val) => setEditingMember({ ...editingMember, permissions: { ...editingMember.permissions, settings: val } })}
                                            />
                                        </div>

                                        <div className="flex justify-end gap-3">
                                            <button
                                                onClick={() => handleUpdateMember(member, { permissions: editingMember.permissions })}
                                                className="px-4 py-2 bg-slate-900 dark:bg-slate-700 text-white rounded-lg text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-600"
                                            >
                                                Salvar Alterações
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

            </div>

            <ConfirmationModal
                isOpen={showConfirmModal}
                onClose={() => setShowConfirmModal(false)}
                onConfirm={handleRemoveMember}
                title="Remover Membro"
                message={`Tem certeza que deseja remover o membro ${memberToRemove} da equipe? Ele perderá acesso imediato ao workspace.`}
                confirmText="Remover Membro"
                cancelText="Cancelar"
                type="danger"
                isLoading={loading}
            />
        </>
    );
};
