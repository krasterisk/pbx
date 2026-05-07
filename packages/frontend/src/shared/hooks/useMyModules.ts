import { useMemo } from 'react';
import { useGetMyModulesQuery } from '@/shared/api/endpoints/cloudAdminApi';
import { useAppSelector } from '@/shared/hooks/useAppStore';

/**
 * useMyModules — возвращает список кодов активных модулей текущего тенанта.
 *
 * SuperAdmin всегда получает пустой массив (у него нет модулей — только панель управления).
 * Если пользователь не авторизован или endpoint вернул ошибку — [] (всё открыто).
 */
export const useMyModules = () => {
  const user = useAppSelector((s) => s.auth.user);
  const isSuperAdmin = user?.level === 0;

  const { data: modules, isLoading } = useGetMyModulesQuery(undefined, {
    // Не делаем запрос для SuperAdmin
    skip: isSuperAdmin || !user,
  });

  const activeCodes = useMemo(
    () => new Set((modules ?? []).filter((m) => m.status === 'active').map((m) => m.module_code)),
    [modules],
  );

  const hasModule = (code: string) => activeCodes.has(code);

  return { modules: modules ?? [], activeCodes, hasModule, isLoading };
};
