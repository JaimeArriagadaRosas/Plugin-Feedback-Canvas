import { useAuth } from '../views/context/AuthContext';

export function usePermissions() {
  const { permissions, role, rawRoles } = useAuth();
  
  const isTrueAdmin = role === 'admin' || (rawRoles && rawRoles.some(r => r.includes('Administrator')));

  const hasPermission = (key) => {
    // Administrators (by explicit role or IMS claims) have all permissions.
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
