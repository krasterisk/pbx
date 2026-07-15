import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { UserLevel, selectUserLevel } from '@/entities/User';
import { useAppSelector } from '@/shared/hooks/useAppStore';

interface RequireRoleProps {
  allow: UserLevel[];
  children: ReactNode;
}

export function RequireRole({ allow, children }: RequireRoleProps) {
  const level = useAppSelector(selectUserLevel);

  if (level === undefined || !allow.includes(level)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
