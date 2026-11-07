import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { EmptyState, Loading } from '../components/ui';

/** Exige usuário autenticado. */
export function ProtectedRoute() {
  const { usuario, carregando } = useAuth();
  const location = useLocation();
  if (carregando) return <Loading texto="Verificando sessão…" />;
  if (!usuario) return <Navigate to="/login" replace state={{ de: location }} />;
  return <Outlet />;
}

/** Restringe a rota a perfis de acesso específicos. */
export function RoleRoute({ perfis }) {
  const { temPerfil } = useAuth();
  if (!temPerfil(...perfis)) {
    return (
      <EmptyState icon={ShieldAlert} title="Acesso restrito">
        Seu perfil não tem permissão para acessar esta página.
      </EmptyState>
    );
  }
  return <Outlet />;
}
