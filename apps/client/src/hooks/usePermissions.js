import { useAuth } from '../views/context/AuthContext';

export function usePermissions() {
  const { permissions, role, rawRoles } = useAuth();
  
  const isTrueAdmin = role === 'admin' || (rawRoles && rawRoles.some(r => r.includes('Administrator')));

  const hasPermission = (key) => {
    // Los administradores (por rol explícito o por claims IMS) tienen todos los permisos.
    if (isTrueAdmin) return true; 
    return !!permissions?.[key]?.value;
  };

  return {
    canViewFeedback: hasPermission('view_feedback'),
    canEditFeedback: hasPermission('edit_feedback'),
    canSubmitFeedback: hasPermission('submit_feedback'),
    canConfigLLM: hasPermission('config_llm'),
    hasPermission
  };
}
