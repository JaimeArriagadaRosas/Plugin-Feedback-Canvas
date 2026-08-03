import React from 'react';
import { usePermissions } from '../../hooks/usePermissions';

export default function RequirePermission({ permission, fallback = null, children }) {
  const { hasPermission } = usePermissions();
  return hasPermission(permission) ? <>{children}</> : fallback;
}
