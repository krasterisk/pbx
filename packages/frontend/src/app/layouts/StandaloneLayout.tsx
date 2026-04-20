import { useEffect } from 'react';
import { useSearchParams, Outlet } from 'react-router-dom';
import { useAppDispatch } from '@/shared/hooks/useAppStore';
import { setToken } from '@/features/auth/model/authSlice';

export const StandaloneLayout = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (token) {
      dispatch(setToken(token));
    }
  }, [token, dispatch]);

  // If there is a token in the URL but we haven't stored it yet, wait.
  // We can just rely on the fact that useEffect will run, but to avoid early API calls:
  if (token && localStorage.getItem('accessToken') !== token) {
    return null;
  }

  return (
    <div className="p-4 bg-transparent min-h-screen">
      <Outlet />
    </div>
  );
};
