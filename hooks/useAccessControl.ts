import { useMemo } from 'react';
import { User } from 'firebase/auth';
import { Workspace } from '../types';

export type PermissionModule = 'financial' | 'timeline' | 'pipeline' | 'clients' | 'settings';
export type AccessLevel = 'none' | 'view' | 'edit';

interface UseAccessControlProps {
    user: User | null;
    workspace: Workspace | null;
}

export const useAccessControl = ({ user, workspace }: UseAccessControlProps) => {
    const permissions = useMemo(() => {
        if (!user || !workspace) {
            return null;
        }

        // Dono do workspace tem acesso total
        if (workspace.userId === user.uid) {
            return {
                isAdmin: true,
                canView: (module: PermissionModule) => true,
                canEdit: (module: PermissionModule) => true
            };
        }

        const member = workspace.members?.find(m => m.email === user.email);

        if (!member) {
            // Se não é membro nem dono, sem acesso (ou lógica de fallback)
            return {
                isAdmin: false,
                canView: (module: PermissionModule) => false,
                canEdit: (module: PermissionModule) => false
            };
        }

        // Admin tem acesso total
        if (member.role === 'admin') {
            return {
                isAdmin: true,
                canView: (module: PermissionModule) => true,
                canEdit: (module: PermissionModule) => true
            };
        }

        // Membro regular - verificar permissões granulares
        return {
            isAdmin: false,
            canView: (module: PermissionModule) => {
                const level = member.permissions?.[module] || 'none';
                return level === 'view' || level === 'edit';
            },
            canEdit: (module: PermissionModule) => {
                const level = member.permissions?.[module] || 'none';
                return level === 'edit';
            }
        };
    }, [user, workspace]);

    return { permissions };
};
